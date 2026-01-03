
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
    const maxRetries = 5;

    while (attempts < maxRetries) {
        const activeKey = keyManager.getActiveKey();
        let finalUrl = url;

        // Injeta a chave na URL se for Google API
        if (url.includes('googleapis.com')) {
            const sep = url.includes('?') ? '&' : '?';
            finalUrl = url.replace(/key=[^&]*/, `key=${activeKey}`);
            if (!finalUrl.includes('key=')) finalUrl += `${sep}key=${activeKey}`;
        }

        try {
            const response = await fetch(finalUrl, options);
            const status = response.status;

            if (response.ok) {
                return await response.json();
            }

            // ERROS CRÍTICOS DE CHAVE (400: Inválida, 403: Bloqueada, 429: Limite)
            if (status === 400 || status === 403 || status === 429) {
                const text = await response.text();
                console.error(`[API ERROR ${status}]`, text);
                
                if (keyManager.markCurrentKeyAsFailed()) {
                    this.addLog(createLog(nodeId, label, 'WARN', `🔄 Chave #${keyManager.getCurrentIndex()} falhou (Status ${status}). Trocando chave...`));
                    attempts++;
                    await wait(200);
                    continue; // Tenta de novo com a nova chave
                }
            }

            const errorText = await response.text();
            throw new Error(`Erro API (${status}): ${errorText.substring(0, 50)}...`);

        } catch (err: any) {
            if (err.name === 'TypeError' || attempts >= maxRetries - 1) throw err;
            attempts++;
            await wait(500);
        }
    }
  }

  private async executeNode(node: FlowNode): Promise<boolean> {
    let { type, config, label } = node.data;
    if (!type && node.type) type = node.type as NodeType;
    if (!label) label = type || 'Node';

    this.updateNodeStatus(node.id, NodeStatus.RUNNING);

    try {
        await wait(200);

        switch (type) {
          case NodeType.START:
              this.addLog(createLog(node.id, label, 'SUCCESS', `🟢 Gatilho ativado.`));
              break;

          case NodeType.HTTP_REQUEST:
            let url = config?.url;
            if (!url) throw new Error("URL não configurada.");

            const method = (config?.method || 'GET').toUpperCase();
            const body = config?.body ? (typeof config.body === 'string' ? JSON.parse(config.body) : config.body) : undefined;
            
            const responseData = await this.fetchWithRetry(url, { 
                method, 
                headers: { 'Content-Type': 'application/json' }, 
                body: method !== 'GET' ? JSON.stringify(body) : undefined 
            }, node.id, label);
            
            this.context[node.id] = responseData;
            this.context['input'] = responseData; 
            this.addLog(createLog(node.id, label, 'SUCCESS', `📦 Dados recebidos com sucesso.`));
            break;

          case NodeType.IF_CONDITION:
            const condition = config?.condition || 'true';
            const input = this.context['input'] || {};
            const check = new Function('input', `try { return ${condition}; } catch(e) { return false; }`);
            const result = check(input);
            this.addLog(createLog(node.id, label, result ? 'SUCCESS' : 'WARN', `⚖️ Condição: ${result ? 'VERDADEIRO' : 'FALSO'}`));
            this.context[node.id] = result;
            if (!result) return false; // Para o fluxo se o IF for falso (opcional dependendo da lógica)
            break;

          case NodeType.FILE_SAVE:
            const fileName = config?.fileName || `file-${Date.now()}.txt`;
            let content = this.context['input'];
            
            // Extrai texto do Gemini se for o caso
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
              this.addLog(createLog(node.id, label, 'SUCCESS', `💾 Arquivo "${fileName}" gerado.`));
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
    this.addLog(createLog('system', 'Fluxo', 'INFO', `🏁 Execução finalizada.`));
  }
}
