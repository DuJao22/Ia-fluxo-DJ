
import { FlowNode, FlowEdge, NodeType, NodeStatus, LogEntry, ExecutionContext, GeneratedFile } from '../types';
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

  private async fetchWithRetry(url: string, options: any, nodeId: string, label: string): Promise<any> {
    let attempts = 0;
    const totalKeys = JSON.parse(keyManager.getStatus()).total;
    const maxRetries = Math.max(totalKeys, 3);

    while (attempts < maxRetries) {
        const activeKey = keyManager.getActiveKey();
        let finalUrl = url;

        // Injeta a chave na URL se for Google API
        if (url.includes('googleapis.com')) {
            // Remove chave antiga se existir para não duplicar
            finalUrl = url.split('?')[0];
            const params = new URLSearchParams(url.split('?')[1] || "");
            params.set('key', activeKey);
            finalUrl = `${finalUrl}?${params.toString()}`;
        }

        try {
            const response = await fetch(finalUrl, options);
            const status = response.status;

            if (response.ok) {
                return await response.json();
            }

            // TRATAMENTO DE ERROS DE CHAVE (403: Referrer/Forbidden, 400: Invalid, 429: Quota)
            if (status === 403 || status === 400 || status === 429) {
                const errorData = await response.text();
                console.warn(`[FlowEngine] Falha na Chave Status ${status}:`, errorData);
                
                if (keyManager.markCurrentKeyAsFailed()) {
                    this.addLog(createLog(nodeId, label, 'WARN', `🔄 Chave #${keyManager.getCurrentIndex()} bloqueada (${status}). Rotacionando...`));
                    attempts++;
                    await wait(150);
                    continue; // Tenta com a próxima chave
                }
            }

            const errorText = await response.text();
            throw new Error(`Erro API (${status}): ${errorText.substring(0, 100)}`);

        } catch (err: any) {
            // Se for erro de rede ou se as tentativas acabaram
            if (attempts >= maxRetries - 1) throw err;
            attempts++;
            await wait(300);
        }
    }
  }

  private async executeNode(node: FlowNode): Promise<boolean> {
    let { type, config, label } = node.data;
    if (!type && node.type) type = node.type as NodeType;
    if (!label) label = type || 'Node';

    this.updateNodeStatus(node.id, NodeStatus.RUNNING);

    try {
        await wait(100);

        switch (type) {
          case NodeType.START:
              this.addLog(createLog(node.id, label, 'SUCCESS', `🟢 Execução iniciada.`));
              break;

          case NodeType.HTTP_REQUEST:
            let url = config?.url;
            if (!url) throw new Error("URL não definida no nó.");

            const method = (config?.method || 'GET').toUpperCase();
            const body = config?.body ? (typeof config.body === 'string' ? JSON.parse(config.body) : config.body) : undefined;
            
            const responseData = await this.fetchWithRetry(url, { 
                method, 
                headers: { 'Content-Type': 'application/json' }, 
                body: method !== 'GET' ? JSON.stringify(body) : undefined 
            }, node.id, label);
            
            this.context[node.id] = responseData;
            this.context['input'] = responseData; 
            this.addLog(createLog(node.id, label, 'SUCCESS', `📦 Requisição concluída.`));
            break;

          case NodeType.IF_CONDITION:
            const condition = config?.condition || 'true';
            const input = this.context['input'] || {};
            // Cria um sandbox simples para a condição
            const check = new Function('input', `try { return ${condition}; } catch(e) { return false; }`);
            const result = !!check(input);
            this.addLog(createLog(node.id, label, result ? 'SUCCESS' : 'WARN', `⚖️ Condição resultou em: ${result.toString().toUpperCase()}`));
            this.context[node.id] = result;
            break;

          case NodeType.FILE_SAVE:
            const fileName = config?.fileName || `output-${Date.now()}.txt`;
            let content = this.context['input'];
            
            // Se vier do Gemini, extrai o texto principal
            if (content?.candidates?.[0]?.content?.parts?.[0]?.text) {
                content = content.candidates[0].content.parts[0].text;
            }

            if (this.onFileGenerated && content) {
              this.onFileGenerated({
                  id: crypto.randomUUID(),
                  name: fileName,
                  content: typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content),
                  extension: config?.fileFormat || 'txt',
                  timestamp: Date.now(),
                  nodeId: node.id
              });
              this.addLog(createLog(node.id, label, 'SUCCESS', `💾 Arquivo gerado: ${fileName}`));
            }
            break;
        }

        this.updateNodeStatus(node.id, NodeStatus.SUCCESS);
        return true;

    } catch (error: any) {
        this.updateNodeStatus(node.id, NodeStatus.ERROR);
        this.addLog(createLog(node.id, label, 'ERROR', `❌ Falha: ${error.message}`));
        return false;
    }
  }

  public async run() {
    this.context = {}; 
    const startNodes = this.nodes.filter(n => n.data.type === NodeType.START);
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
      }
    }
    this.addLog(createLog('system', 'Engine', 'INFO', `🏁 Fluxo finalizado.`));
  }
}
