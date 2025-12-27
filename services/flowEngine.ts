import { FlowNode, FlowEdge, NodeType, NodeStatus, LogEntry, ExecutionContext, GeneratedFile } from '../types';
import { CREATOR_CREDIT } from '../constants';
import { storageService } from './storageService';

// Delay auxiliar para visualização
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

  // Novo parser robusto de Headers: Aceita JSON ou formato "Key: Value" e faz trim
  private parseHeaders(input: any): Record<string, string> {
      if (!input) return {};
      if (typeof input === 'object') return input;
      
      try {
          return JSON.parse(input);
      } catch (e) {
          // Fallback: Tenta parsear formato texto (ex: Postman raw headers)
          const headers: Record<string, string> = {};
          const lines = input.toString().split('\n');

          for (const line of lines) {
              const separatorIndex = line.indexOf(':');
              if (separatorIndex > -1) {
                  // Remove quotes extras que o usuário possa ter colado no início/fim da chave ou valor
                  let key = line.substring(0, separatorIndex).trim().replace(/^['"]|['"]$/g, '');
                  let value = line.substring(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
                  
                  if (key) {
                      headers[key] = value;
                  }
              }
          }
          return headers;
      }
  }

  // --- LÓGICA DE FETCH REFORÇADA (5 LAYERS) ---
  private async fetchRealData(url: string, options: any, nodeId: string, label: string, timeoutMs: number = 45000): Promise<any> {
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs); 

      // Verifica se nós enviamos autenticação (para saber se o erro é nosso ou do proxy)
      const hasAuth = options.headers && Object.keys(options.headers).some(k => k.toLowerCase() === 'authorization');

      // Helper para processar resposta e EXTRAIR DETALHES DO ERRO
      const processResponse = async (response: Response, sourceName: string) => {
          if (!response.ok) {
              let errorDetails = "";
              try {
                  const text = await response.text();
                  try {
                      const json = JSON.parse(text);
                      errorDetails = json.error?.message || json.message || json.error || text;
                  } catch {
                      errorDetails = text.substring(0, 300);
                  }
              } catch {
                  errorDetails = "Sem detalhes do servidor.";
              }
              
              // TRATAMENTO ESPECÍFICO: Erro de Modelo Gemini (404)
              if (response.status === 404 && (url.includes('generativelanguage.googleapis.com'))) {
                  throw new Error(`GEMINI_404: O modelo solicitado não foi encontrado (404) na URL: ${url}`);
              }

              if (response.status === 401 || (response.status === 403 && !errorDetails.includes('cors-anywhere'))) {
                  let hint = "";
                  const lowerDetails = errorDetails.toLowerCase();
                  if (lowerDetails.includes("your_api_key") || lowerDetails.includes("sua_chave")) {
                       hint = " 💡 DICA: O servidor recebeu um placeholder em vez de uma chave real. Configure sua API Key nas Configurações.";
                  } else if (lowerDetails.includes("incorrect api key") || lowerDetails.includes("api key not valid")) {
                       hint = " 💡 DICA: A chave de API enviada foi rejeitada. Verifique se ela está correta nas Configurações.";
                  } else if (lowerDetails.includes("provide an api key")) {
                       hint = " 💡 DICA: O header 'Authorization' ou parâmetro 'key' está ausente.";
                  } else if (response.status === 403) {
                       hint = " 💡 DICA: Verifique se a 'Google Generative Language API' está ATIVADA no Google Cloud Console ou se sua Chave API é válida.";
                  }
                  throw new Error(`AUTH_ERROR (${response.status}): ${errorDetails} ${hint}`);
              }
              throw new Error(`${sourceName} Error ${response.status}: ${errorDetails}`);
          }
          return response.json();
      };

      try {
          // 0. OTIMIZAÇÃO GEMINI: Tenta conexão direta sempre primeiro para Google APIs
          if (url.includes('googleapis.com')) {
               this.addLog(createLog(nodeId, label, 'INFO', `✨ Conectando ao Google Gemini...`));
               const response = await fetch(url, { ...options, signal: controller.signal });
               const data = await processResponse(response, 'GoogleDirect');
               clearTimeout(timeoutId);
               this.addLog(createLog(nodeId, label, 'SUCCESS', `✅ Gemini Respondeu.`));
               return data;
          }

          // 1. TENTATIVA DIRETA PADRÃO
          this.addLog(createLog(nodeId, label, 'INFO', `📡 [1/5] Tentando conexão direta...`));
          try {
              const response = await fetch(url, { ...options, signal: controller.signal });
              const data = await processResponse(response, 'Direct');
              clearTimeout(timeoutId);
              this.addLog(createLog(nodeId, label, 'SUCCESS', `✅ Conexão Direta: OK`));
              return data;
          } catch (e: any) {
              if (e.name === 'AbortError') throw e; // Timeout real
              if (e.message.includes('GEMINI_404')) throw e; // Erro fatal de modelo, não adianta tentar proxy
              if (e.message.includes('AUTH_ERROR')) {
                   // Se for erro de auth, não adianta tentar proxy, o erro é na chave ou permissão
                   throw e;
              } else if (e.message.match(/Error 400|Error 404|Error 405|Error 422/)) {
                  throw e;
              } else {
                   this.addLog(createLog(nodeId, label, 'WARN', `⚠️ Direto falhou. Iniciando rota de proxies...`));
              }
          }

          // 2. CORS PROXY IO
          try {
              this.addLog(createLog(nodeId, label, 'INFO', `🔄 [2/5] Tentando CorsProxy.io...`));
              const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
              const response = await fetch(proxyUrl, { ...options, signal: controller.signal });
              const data = await processResponse(response, 'CorsProxy');
              clearTimeout(timeoutId);
              this.addLog(createLog(nodeId, label, 'SUCCESS', `✅ Via CorsProxy`));
              return data;
          } catch (e: any) {
             if (e.name === 'AbortError') throw e;
             if (e.message.match(/Error 400|Error 404|Error 405|Error 422|GEMINI_404|AUTH_ERROR/)) throw e;
          }

          // 3. CODE TABS
          try {
              this.addLog(createLog(nodeId, label, 'INFO', `🔄 [3/5] Tentando CodeTabs...`));
              const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
              const response = await fetch(proxyUrl, { ...options, signal: controller.signal });
              const data = await processResponse(response, 'CodeTabs');
              clearTimeout(timeoutId);
              this.addLog(createLog(nodeId, label, 'SUCCESS', `✅ Via CodeTabs`));
              return data;
          } catch (e: any) {
               if (e.name === 'AbortError') throw e;
               if (e.message.match(/Error 400|Error 404|Error 405|Error 422|GEMINI_404|AUTH_ERROR/)) throw e;
          }

          // 4. THING PROXY
          try {
              this.addLog(createLog(nodeId, label, 'INFO', `🔄 [4/5] Tentando ThingProxy...`));
              const proxyUrl = `https://thingproxy.freeboard.io/fetch/${url}`;
              const response = await fetch(proxyUrl, { ...options, signal: controller.signal });
              const data = await processResponse(response, 'ThingProxy');
              clearTimeout(timeoutId);
              this.addLog(createLog(nodeId, label, 'SUCCESS', `✅ Via ThingProxy`));
              return data;
          } catch (e: any) {
               if (e.name === 'AbortError') throw e;
               if (e.message.match(/Error 400|Error 404|Error 405|Error 422|GEMINI_404|AUTH_ERROR/)) throw e;
          }

          // 5. CORS ANYWHERE (ULTIMATE FALLBACK)
          try {
              this.addLog(createLog(nodeId, label, 'INFO', `🛡️ [5/5] Tentando CorsAnywhere (Backup)...`));
              const proxyUrl = `https://cors-anywhere.herokuapp.com/${url}`;
              const response = await fetch(proxyUrl, { ...options, signal: controller.signal });
              
              if (response.status === 403) {
                   throw new Error("REQUIRES_ACTIVATION");
              }
              
              const data = await processResponse(response, 'CorsAnywhere');
              clearTimeout(timeoutId);
              this.addLog(createLog(nodeId, label, 'SUCCESS', `✅ Via CorsAnywhere`));
              return data;

          } catch (e: any) {
              if (e.name === 'AbortError') throw e;
              if (e.message.includes('AUTH_ERROR') || e.message.match(/Error 400|Error 404|GEMINI_404/)) throw e; 
              if (e.message === 'REQUIRES_ACTIVATION' || e.message.includes('See /corsdemo')) {
                  throw new Error(`
                      🔒 BLOQUEIO DE SEGURANÇA DETECTADO.
                      Para usar APIs privadas no navegador:
                      1. Abra uma nova aba: https://cors-anywhere.herokuapp.com/corsdemo
                      2. Clique em "Request temporary access"
                      3. Volte aqui e tente novamente.
                  `);
              }
          }

          clearTimeout(timeoutId);
          this.addLog(createLog(nodeId, label, 'ERROR', `❌ Todas as rotas falharam.`));
          throw new Error(`Não foi possível conectar a ${url} através de nenhum proxy.`);

      } catch (finalError: any) {
          clearTimeout(timeoutId);
          if (finalError.name === 'AbortError') {
              throw new Error(`Timeout de ${timeoutMs}ms excedido.`);
          }
          throw finalError;
      }
  }

  private async executeNode(node: FlowNode): Promise<boolean> {
    let { type, config, label } = node.data;
    if (!type && node.type) { type = node.type as NodeType; node.data.type = type; }
    if (!label) label = type || 'Node';

    this.updateNodeStatus(node.id, NodeStatus.RUNNING);
    
    try {
      await wait(800); 

      switch (type) {
        case NodeType.START:
            this.addLog(createLog(node.id, label, 'SUCCESS', `🟢 Início do Fluxo.`));
            break;

        case NodeType.HTTP_REQUEST:
          const method = (config?.method || 'GET').toUpperCase();
          let url = config?.url;
          
          if (!url) throw new Error("URL é obrigatória.");

          // --- SUPER INTELLIGENCE GEMINI FIXER ---
          const isGemini = url.includes('generativelanguage.googleapis.com');
          let bodyObj = this.parseConfigJSON(config?.body);
          
          // Variáveis mutáveis para permitir retry/correção
          let finalUrl = url;
          let finalMethod = method;
          let finalBody = bodyObj;
          
          // Timeout customizado
          const timeout = Number(config?.timeout) || 45000;

          // Recupera chave salva para uso em injeção automática e fallback
          const rawKey = storageService.getApiKey() || process.env.API_KEY;
          const storedKey = (rawKey && rawKey !== "undefined") ? rawKey : null;

          if (isGemini) {
             finalUrl = finalUrl.trim();

             // 0. Auto-Fix: Force v1beta if using v1 (v1 often gives 404 for newer models)
             if (finalUrl.includes('/v1/models')) {
                 finalUrl = finalUrl.replace('/v1/models', '/v1beta/models');
                 this.addLog(createLog(node.id, label, 'INFO', `✨ Auto-Fix Gemini: Endpoint atualizado de v1 para v1beta.`));
             }

             // 1. Proactive Auto-Fix: Model Name (Safer Regex)
             // Detects model name without eating query params
             const modelRegex = /models\/([^\/?:#]+)/;
             const match = finalUrl.match(modelRegex);
             if (match) {
                 const currentModel = match[1];
                 // If using legacy/broken models or simply not the standard gemini-3
                 // This ensures we switch to 'gemini-3-flash-preview' if we detect 1.5, 1.0 or generic 'pro'
                 if (currentModel.includes('gemini-pro') || currentModel.includes('1.0') || currentModel.includes('1.5') || currentModel.includes('preview')) {
                     
                     // Se não for especificamente o modelo 3, faz upgrade
                     if (!currentModel.includes('gemini-3')) {
                         finalUrl = finalUrl.replace(modelRegex, 'models/gemini-3-flash-preview');
                         this.addLog(createLog(node.id, label, 'INFO', `✨ Auto-Fix: Modelo '${currentModel}' atualizado para 'gemini-3-flash-preview'.`));
                     }
                 }
             }
             
             // 2. Ensure Action: :generateContent
             const hasAction = finalUrl.includes(':generateContent') || finalUrl.includes(':streamGenerateContent');
             if (!hasAction) {
                 // Try to insert before query params
                 const qIdx = finalUrl.indexOf('?');
                 if (qIdx !== -1) {
                     finalUrl = finalUrl.slice(0, qIdx) + ':generateContent' + finalUrl.slice(qIdx);
                 } else {
                     finalUrl = finalUrl + ':generateContent';
                 }
                 this.addLog(createLog(node.id, label, 'INFO', `✨ Auto-Fix: Action ':generateContent' anexada à URL.`));
                 finalMethod = 'POST'; // Force POST if we added generateContent
             }

             // 3. Force POST if generateContent is present
             if (finalUrl.includes(':generateContent') && finalMethod !== 'POST') {
                 finalMethod = 'POST';
                 this.addLog(createLog(node.id, label, 'INFO', `✨ Auto-Fix: Método ajustado para POST.`));
             }

             // 4. Auto-Format Body: JSON Body Simplified -> Google Standard
             if (finalBody && !finalBody.contents) {
                 const simpleText = finalBody.text || finalBody.prompt || finalBody.message || finalBody.content;
                 if (simpleText) {
                     finalBody = {
                         contents: [{ parts: [{ text: String(simpleText) }] }]
                     };
                     this.addLog(createLog(node.id, label, 'INFO', `✨ Auto-Format: Corpo JSON simplificado convertido para padrão Gemini.`));
                 }
             }

             // 5. Auto-Auth: Inject API Key
             if (storedKey) {
                 const hasPlaceholder = finalUrl.includes('{YOUR_API_KEY}') || finalUrl.includes('YOUR_API_KEY');
                 if (hasPlaceholder) {
                     finalUrl = finalUrl.replace(/\{?YOUR_API_KEY\}?/g, storedKey);
                     this.addLog(createLog(node.id, label, 'INFO', `🔑 Auto-Auth: Chave API injetada automaticamente.`));
                 } else if (!finalUrl.includes('key=')) {
                     const separator = finalUrl.includes('?') ? '&' : '?';
                     finalUrl = `${finalUrl}${separator}key=${storedKey}`;
                     this.addLog(createLog(node.id, label, 'INFO', `🔑 Auto-Auth: Parâmetro ?key= adicionado.`));
                 }
             } else {
                 this.addLog(createLog(node.id, label, 'WARN', `⚠️ Nenhuma API Key detectada. Configure nas Configurações (⚙️) para evitar erros de permissão.`));
             }
          }

          const customHeaders = this.parseHeaders(config?.headers);
          const placeholderPattern = /\{\{.*?\}\}|<.*?>|YOUR_API_KEY|SUA_CHAVE|INSERT_KEY/i;
          const headerStr = JSON.stringify(customHeaders);

          if (placeholderPattern.test(finalUrl) || placeholderPattern.test(headerStr)) {
               this.addLog(createLog(node.id, label, 'WARN', `⚠️ Configuração contém placeholders. Verifique a chave API.`));
          }
          
          const isBodyMethod = ['POST', 'PUT', 'PATCH'].includes(finalMethod);
          const headers: Record<string, string> = { ...customHeaders };
          if (isBodyMethod && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
          
          const bodyString = isBodyMethod ? JSON.stringify(finalBody) : undefined;

          // Executa Fetch Seguro COM Retry Lógico para Gemini e Timeout configurado
          let responseData;
          try {
              responseData = await this.fetchRealData(finalUrl, { method: finalMethod, headers, body: bodyString }, node.id, label, timeout);
          } catch (err: any) {
              // SELF-HEALING: Se falhar com erro de modelo (404) e for Gemini, tenta reconstruir a URL inteira para um fallback seguro
              // MAS NÃO para Timeout
              if (isGemini && (err.message.includes('GEMINI_404') || err.message.includes('404')) && !err.message.includes('Timeout')) {
                   this.addLog(createLog(node.id, label, 'WARN', `🚑 Self-Healing Ativado: Erro 404 detectado. Forçando modelo gemini-3-flash-preview...`));
                   
                   // Tenta extrair a chave da URL original
                   const keyMatch = finalUrl.match(/[?&]key=([^&]+)/);
                   let apiKey = keyMatch ? keyMatch[1] : '';

                   // Se não achou na URL, usa a do storage
                   if (!apiKey && storedKey) {
                       apiKey = storedKey;
                   }
                   
                   if (apiKey) {
                       // RECONSTRUÇÃO TOTAL DA URL PARA O MODELO ESTÁVEL gemini-3-flash-preview
                       const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
                       this.addLog(createLog(node.id, label, 'INFO', `🔄 Redirecionando para: ${fallbackUrl}`));
                       responseData = await this.fetchRealData(fallbackUrl, { method: 'POST', headers, body: bodyString }, node.id, label, timeout);
                   } else {
                       throw err; // Sem chave, não conseguimos reconstruir
                   }
              } else {
                  throw err; // Outros erros (Auth, Network, Timeout)
              }
          }
          
          // Salva no contexto
          this.context[node.id] = responseData;
          this.context['input'] = responseData; 
          this.context['data'] = responseData; 
          
          // Se for Gemini, tenta extrair o texto para facilitar o uso no próximo nó
          if (isGemini && responseData.candidates?.[0]?.content?.parts?.[0]?.text) {
              const generatedText = responseData.candidates[0].content.parts[0].text;
              this.context[node.id] = { ...responseData, simpleText: generatedText };
              // Também atualiza o input global para ser o texto simples, facilitando salvar em arquivo
              this.context['input'] = generatedText;
              
              const preview = generatedText.substring(0, 80) + "...";
              this.addLog(createLog(node.id, label, 'INFO', `🤖 Gemini Respondeu: "${preview}"`));
          } else {
              const preview = JSON.stringify(responseData).substring(0, 100) + "...";
              this.addLog(createLog(node.id, label, 'INFO', `📦 Dados recebidos: ${preview}`));
          }
          break;

        case NodeType.IF_CONDITION:
          const conditionStr = config?.condition || 'true';
          let result = true;
          
          const edgeIn = this.edges.find(e => e.target === node.id);
          const inputData = edgeIn ? this.context[edgeIn.source] : (this.context['input'] || {});

          try {
              const checkCondition = new Function('input', 'data', 'json', `
                  try { return ${conditionStr}; } catch(e) { return false; }
              `);
              result = checkCondition(inputData, inputData, inputData);
              this.addLog(createLog(node.id, label, result ? 'SUCCESS' : 'WARN', `⚖️ Condição (${conditionStr}) => ${result ? 'VERDADEIRO' : 'FALSO'}`));
          } catch (e) { 
              this.addLog(createLog(node.id, label, 'WARN', `⚠️ Erro na sintaxe da condição. Continuando fluxo (TRUE).`));
              result = true; 
          }
          this.context[node.id] = result;
          break;

        case NodeType.FILE_SAVE:
          const incomingEdge = this.edges.find(e => e.target === node.id);
          const fileName = config?.fileName || `output-${Date.now()}.txt`;
          
          let sourceData = incomingEdge ? this.context[incomingEdge.source] : this.context['input'];
          if (typeof sourceData === 'boolean') sourceData = this.context['input'];
          
          // Fallback inteligente para Gemini output
          if (sourceData && sourceData.candidates && sourceData.candidates[0]?.content?.parts?.[0]?.text) {
               sourceData = sourceData.candidates[0].content.parts[0].text;
          }

          if (sourceData) {
            let contentStr = typeof sourceData === 'object' ? JSON.stringify(sourceData, null, 2) : String(sourceData);
            if (this.onFileGenerated) {
                this.onFileGenerated({
                    id: crypto.randomUUID(),
                    name: fileName,
                    content: contentStr,
                    extension: config?.fileFormat || 'txt',
                    timestamp: Date.now(),
                    nodeId: node.id
                });
                this.addLog(createLog(node.id, label, 'SUCCESS', `💾 Arquivo salvo.`));
            }
          } else {
              this.addLog(createLog(node.id, label, 'WARN', `⚠️ Sem dados para salvar.`));
          }
          break;

        case NodeType.DELAY:
           const ms = config?.ms || 1000;
           this.addLog(createLog(node.id, label, 'INFO', `⏳ Aguardando ${ms}ms...`));
           await wait(ms);
           break;

        case NodeType.LOGGER:
            const edgeInLog = this.edges.find(e => e.target === node.id);
            const dataToLog = edgeInLog ? this.context[edgeInLog.source] : this.context;
            this.addLog(createLog(node.id, label, 'INFO', `📝 Log: ${JSON.stringify(dataToLog, null, 2)}`));
            break;
            
        case NodeType.WEBHOOK:
            this.addLog(createLog(node.id, label, 'SUCCESS', `🔔 Webhook acionado.`));
            break;

        default:
          break;
      }

      this.updateNodeStatus(node.id, NodeStatus.SUCCESS);
      return true;

    } catch (error: any) {
      console.error(error);
      this.updateNodeStatus(node.id, NodeStatus.ERROR);
      this.addLog(createLog(node.id, label, 'ERROR', `❌ ${error.message}`));
      return false; 
    }
  }

  public async run() {
    this.addLog(createLog('system', 'System', 'INFO', `🚀 --- INICIANDO EXECUÇÃO ---`));
    this.context = {}; 
    
    this.setNodes((nds: FlowNode[]) => nds.map(n => ({ ...n, data: { ...n.data, status: NodeStatus.IDLE } })));
    await wait(200);

    const startNodes = this.nodes.filter(n => n.data.type === NodeType.START || n.data.type === NodeType.WEBHOOK);
    const queue: FlowNode[] = startNodes.length > 0 ? startNodes : [this.nodes[0]];
    
    if (queue.length === 0 && this.nodes.length > 0) queue.push(this.nodes[0]);

    while (queue.length > 0) {
      const currentNode = queue.shift();
      if (!currentNode) continue;

      const success = await this.executeNode(currentNode);
      
      if (success) {
        if (currentNode.data.type === NodeType.IF_CONDITION && this.context[currentNode.id] === false) {
             this.addLog(createLog(currentNode.id, currentNode.data.label, 'WARN', `⚠️ Condição Falsa. Fluxo segue, mas verifique a lógica.`));
        }

        const outgoingEdges = this.edges.filter(e => e.source === currentNode.id);
        for (const edge of outgoingEdges) {
          const nextNode = this.nodes.find(n => n.id === edge.target);
          if (nextNode) {
             queue.push(nextNode);
          }
        }
      } else {
        break;
      }
    }
    
    this.addLog(createLog('system', 'System', 'INFO', `🏁 Execução Finalizada.`));
  }
}