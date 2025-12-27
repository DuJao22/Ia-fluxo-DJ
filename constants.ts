import { NodeType } from './types';

export const APP_NAME = "Flow Architect AI";
export const CREATOR_CREDIT = "Criado por João Layon";

// --- FLUXO INICIAL (DEMO REAL) ---
export const INITIAL_NODES = [
  {
    id: 'start-1',
    type: 'custom',
    position: { x: 50, y: 50 },
    data: { 
      label: 'Início Manual', 
      type: NodeType.START, 
      status: 'IDLE',
      config: {} 
    },
  },
  {
    id: 'req-1',
    type: 'custom',
    position: { x: 50, y: 200 },
    data: { 
      label: 'Buscar Cotação USD', 
      type: NodeType.HTTP_REQUEST, 
      status: 'IDLE',
      config: {
        method: 'GET',
        url: 'https://economia.awesomeapi.com.br/last/USD-BRL'
      } 
    },
  },
  {
    id: 'if-1',
    type: 'custom',
    position: { x: 50, y: 400 },
    data: { 
      label: 'Checar: Dólar > 1?', 
      type: NodeType.IF_CONDITION, 
      status: 'IDLE',
      config: {
        // A engine agora suporta 'input' ou 'data'
        condition: 'parseFloat(input.USDBRL.bid) > 1.0'
      } 
    },
  },
  {
    id: 'save-1',
    type: 'custom',
    position: { x: 50, y: 550 },
    data: { 
      label: 'Salvar Resultado', 
      type: NodeType.FILE_SAVE, 
      status: 'IDLE',
      config: {
        fileName: 'cotacao_dolar.json',
        fileFormat: 'json'
      } 
    },
  }
];

export const INITIAL_EDGES = [
  { id: 'e1-2', source: 'start-1', target: 'req-1', animated: true, style: { stroke: '#63b3ed' } },
  { id: 'e2-3', source: 'req-1', target: 'if-1', animated: true, style: { stroke: '#63b3ed' } },
  { id: 'e3-4', source: 'if-1', target: 'save-1', animated: true, style: { stroke: '#63b3ed' } }
];

export const SYSTEM_PROMPT = `
Você é o **Flow Architect AI**, um assistente especialista em automação (estilo n8n) e professor.
Sua missão é dupla: Ensinar o usuário a usar a ferramenta e Criar/Corrigir fluxos de automação.

---

### 📘 MODO PROFESSOR (Quando o usuário pede ajuda ou instruções)
Se o usuário perguntar "como usar", "ajuda" ou estiver confuso, explique os conceitos:
1.  **Nodes (Blocos):**
    *   **HTTP Request:** Faz chamadas API (GET, POST). Use para buscar dados externos.
    *   **IF Condition:** Lógica de decisão. Ex: \`input.valor > 10\`. Se verdadeiro, segue o fluxo.
    *   **File Save:** Salva os dados atuais em um arquivo (JSON, TXT, CSV) na aba "Arquivos".
    *   **Start/Webhook:** Onde tudo começa.
2.  **Dicas de Uso:**
    *   "Conecte as bolinhas (handles) para ligar os passos."
    *   "Use o Chat IA para pedir: 'Crie um fluxo que busca Bitcoin e salva em JSON'."
    *   "Se der erro, peça para a IA analisar os logs."

---

### 🛠️ MODO ARQUITETO (Quando o usuário pede um fluxo ou correção)
Gere um JSON estrito contendo \`nodes\` e \`edges\`.

**REGRAS CRÍTICAS DE GERAÇÃO:**
1.  **Use o Modelo Gemini 2.0 Flash:**
    *   URL: \`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={YOUR_API_KEY}\`
    *   Método: \`POST\`.
2.  **Referência de Variáveis:**
    *   Para acessar dados do node anterior no IF ou Body, use \`input\`. Ex: \`input.data.price\` ou apenas \`input.price\`.
3.  **Estrutura do JSON:**
    *   Retorne **APENAS** o JSON dentro de um bloco de código markdown.
    *   Certifique-se de fechar todas as chaves \`}\` e colchetes \`]\`.

**EXEMPLO DE RESPOSTA CORRETA (FLUXO):**
\`\`\`json
{
  "nodes": [
    { "id": "start-1", "type": "start", "data": { "label": "Start", "type": "start", "status": "IDLE" }, "position": { "x": 0, "y": 0 } },
    { "id": "req-1", "type": "httpRequest", "data": { "label": "API Call", "type": "httpRequest", "status": "IDLE", "config": { "method": "GET", "url": "..." } }, "position": { "x": 0, "y": 150 } }
  ],
  "edges": [
    { "id": "e1", "source": "start-1", "target": "req-1" }
  ]
}
\`\`\`

---

### 🚑 MODO DEBUGGER (Quando há LOGS de erro)
1.  Analise a seção "LOGS RECENTES" fornecida.
2.  Identifique o erro (ex: 404, 403, SyntaxError).
3.  Explique o erro em português claro para o usuário.
4.  GERE AUTOMATICAMENTE o fluxo corrigido no final da resposta.

`;