
import { FlowNode, FlowEdge, NodeType, NodeStatus, LogEntry, ExecutionContext, GeneratedFile } from '../types';
import { CREATOR_CREDIT } from '../constants';
import { storageService } from './storageService';
import { keyManager } from './keyManager';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createLog = (nodeId: string, label: string, level: LogEntry['level'], message: string): LogEntry => ({
  id: Math.random().toString(36).substr(2, 9),
  timestamp: new Date().toISOString(),
  nodeId,
  nodeLabel: label,
  level,
  message
});

export class FlowEngine {
  private nodes: FlowNode[];
  private edges: FlowEdge[];
  private setNodes: (nodes: FlowNode[] | ((nodes: FlowNode[]) => FlowNode[])) => void;
  private addLog: (log: LogEntry) => void;
  private onFileGenerated?: (file: GeneratedFile) => void;
  private context: ExecutionContext = {};

  constructor(
    nodes: FlowNode[], 
    edges: FlowEdge[], 
    setNodes: any, 
    addLog: any,
    onFileGenerated?: (file: GeneratedFile) => void
  ) {
    this.nodes = nodes;
    this.edges = edges;
    this.setNodes = setNodes;
    this.addLog = addLog;
    this.onFileGenerated = onFileGenerated;
  }

  private updateNodeStatus(nodeId: string, status: NodeStatus) {
    this.setNodes((nds: FlowNode[]) => 
      nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, status } } : n)
    );
  }

  private parseConfigJSON(input: any): any {
      if (typeof input === 'object') return input;
      try { return JSON.parse(input); } catch (e) { return {}; }
  }

  private parseHeaders(input: any): Record<string, string> {
      if (!input) return {};
      if (typeof input === 'object') return input;
      try { return JSON.parse(input); } catch (e) { return {}; }
  }

  private async fetchRealData(url: string, options: any, nodeId: string, label: string, timeoutMs: number = 45000): Promise<any> {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs); 

      const processResponse = async (response: Response, sourceName: string) => {
          if (!response.ok) {
              const text = await response.text();
              
              // Se for erro de cota no Gemini (HTTP Node), sinalizamos para o KeyManager
              if ((response.status === 429 || response.status === 403) && url.includes('googleapis.com')) {
                  keyManager.markCurrentKeyAsFailed();
                  this.addLog(createLog(nodeId, label, 'WARN', `⚠️ Chave Gemini esgotada no nó HTTP. Rotacionando para próxima execução...`));
              }

              throw new Error(`[${sourceName}] Status ${response.status}: ${text.substring(0, 100)}`);
          }
          return response.json();
      };

      try {
          if (url.includes('googleapis.com')) {
               const response = await fetch(url, { ...options, signal: controller.signal });
               const data = await processResponse(response, 'GoogleAPI');
               clearTimeout(timeoutId);
               return data;
          }

          const response = await fetch(url, { ...options, signal: controller.signal });
          const data = await processResponse(response, 'Direct');
          clearTimeout(timeoutId);
          return data;
      } catch (err: any) {
          clearTimeout(timeoutId);
          throw err;
      }
  }

  private async executeNode(node: FlowNode): Promise<boolean> {
    let { type, config, label } = node.data;
    if (!type && node.type) { type = node.type as NodeType; node.data.type = type; }
    if (!label) label = type || 'Node';

    this.updateNodeStatus(node.id, NodeStatus.RUNNING);
    
    try {
      await wait(500); 

      switch (type) {
        case NodeType.START:
            this.addLog(createLog(node.id, label, 'SUCCESS', `🟢 Início`));
            break;

        case NodeType.HTTP_REQUEST:
          let url = config?.url;
          if (!url) throw new Error("URL é obrigatória.");

          const isGemini = url.includes('generativelanguage.googleapis.com');
          let finalUrl = url.trim();
          let finalMethod = (config?.method || 'GET').toUpperCase();
          let finalBody = this.parseConfigJSON(config?.body);
          
          // USA O KEYMANAGER PARA PEGAR A CHAVE ATIVA SAUDÁVEL
          const activeKey = keyManager.getActiveKey();

          if (isGemini) {
             if (finalUrl.includes('/v1/models')) finalUrl = finalUrl.replace('/v1/models', '/v1beta/models');
             if (!finalUrl.includes(':generateContent')) finalUrl += ':generateContent';
             finalMethod = 'POST';

             if (activeKey) {
                 const hasPlaceholder = finalUrl.includes('{YOUR_API_KEY}') || finalUrl.includes('YOUR_API_KEY');
                 if (hasPlaceholder) {
                     finalUrl = finalUrl.replace(/\{?YOUR_API_KEY\}?/g, activeKey);
                 } else if (!finalUrl.includes('key=')) {
                     const sep = finalUrl.includes('?') ? '&' : '?';
                     finalUrl = `${finalUrl}${sep}key=${activeKey}`;
                 }
             }
          }

          const headers = this.parseHeaders(config?.headers);
          if (finalMethod !== 'GET' && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
          
          const responseData = await this.fetchRealData(finalUrl, { 
              method: finalMethod, 
              headers, 
              body: finalMethod !== 'GET' ? JSON.stringify(finalBody) : undefined 
          }, node.id, label);
          
          this.context[node.id] = responseData;
          this.context['input'] = responseData; 

          if (isGemini && responseData.candidates?.[0]?.content?.parts?.[0]?.text) {
              const text = responseData.candidates[0].content.parts[0].text;
              this.addLog(createLog(node.id, label, 'SUCCESS', `🤖 Gemini: "${text.substring(0, 50)}..."`));
          } else {
              this.addLog(createLog(node.id, label, 'SUCCESS', `📦 Dados recebidos.`));
          }
          break;

        case NodeType.IF_CONDITION:
          const condition = config?.condition || 'true';
          const input = this.context['input'] || {};
          const check = new Function('input', `try { return ${condition}; } catch(e) { return false; }`);
          const result = check(input);
          this.addLog(createLog(node.id, label, result ? 'SUCCESS' : 'WARN', `⚖️ IF (${condition}) => ${result}`));
          this.context[node.id] = result;
          break;

        case NodeType.FILE_SAVE:
          const fileName = config?.fileName || `output-${Date.now()}.txt`;
          let content = this.context['input'];
          if (content && content.candidates) content = content.candidates[0].content.parts[0].text;
          
          if (this.onFileGenerated && content) {
            this.onFileGenerated({
                id: crypto.randomUUID(),
                name: fileName,
                content: typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content),
                extension: config?.fileFormat || 'txt',
                timestamp: Date.now(),
                nodeId: node.id
            });
            this.addLog(createLog(node.id, label, 'SUCCESS', `💾 Arquivo salvo.`));
          }
          break;

        case NodeType.DELAY:
           await wait(config?.ms || 1000);
           break;

        case NodeType.LOGGER:
            this.addLog(createLog(node.id, label, 'INFO', `📝 Contexto: ${JSON.stringify(this.context, null, 2).substring(0, 500)}`));
            break;

        default:
          break;
      }

      this.updateNodeStatus(node.id, NodeStatus.SUCCESS);
      return true;

    } catch (error: any) {
      this.updateNodeStatus(node.id, NodeStatus.ERROR);
      this.addLog(createLog(node.id, label, 'ERROR', `❌ ${error.message}`));
      return false; 
    }
  }

  public async run() {
    this.addLog(createLog('system', 'System', 'INFO', `🚀 Iniciando Fluxo... (${keyManager.getStatus()})`));
    this.context = {}; 
    const startNodes = this.nodes.filter(n => n.data.type === NodeType.START || n.data.type === NodeType.WEBHOOK);
    const queue: FlowNode[] = startNodes.length > 0 ? startNodes : [this.nodes[0]];

    while (queue.length > 0) {
      const currentNode = queue.shift();
      if (!currentNode) continue;

      const success = await this.executeNode(currentNode);
      if (success) {
        const nextNodes = this.edges
          .filter(e => e.source === currentNode.id)
          .map(e => this.nodes.find(n => n.id === e.target))
          .filter(Boolean) as FlowNode[];
        queue.push(...nextNodes);
      } else {
        break;
      }
    }
    this.addLog(createLog('system', 'System', 'INFO', `🏁 Execução Terminada.`));
  }
}
