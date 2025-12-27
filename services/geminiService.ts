import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { SYSTEM_PROMPT } from '../constants';
import { FlowSchema, FlowContext } from '../types';
import { storageService } from './storageService';

export const generateFlowFromPrompt = async (userPrompt: string, context?: FlowContext): Promise<{ text: string, flowData?: FlowSchema }> => {
  const storedKey = storageService.getApiKey();
  const envKey = process.env.API_KEY;
  
  // Validação robusta da chave
  let activeKey = storedKey || envKey;
  // Limpeza de chaves inválidas que podem vir do ambiente
  if (activeKey === "undefined" || activeKey === "null" || !activeKey || activeKey.trim() === "") {
    return { 
      text: "⚠️ **Configuração Necessária**\n\nPara a IA funcionar, você precisa de uma Chave de API do Google (Gemini).\n\n1. Clique no ícone de engrenagem (⚙️) no topo direito.\n2. Cole sua chave API (pegue uma gratuita no Google AI Studio).\n3. Tente novamente.", 
      flowData: undefined 
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: activeKey });
    
    // Preparação do Contexto
    let finalPromptParts: any[] = [{ text: SYSTEM_PROMPT }];

    if (context) {
        const recentLogs = context.logs.slice(-15).map(l => `[${l.level}] ${l.nodeLabel}: ${l.message}`).join('\n');
        const simplifiedNodes = context.currentNodes.map(n => ({
            id: n.id,
            type: n.data.type,
            label: n.data.label,
            config: n.data.config
        }));

        const contextString = `
=== CONTEXTO ATUAL (DEBUG) ===
O usuário já tem este fluxo. Se ele pedir para corrigir, baseie-se nisso:
LOGS:
${recentLogs || "Nenhum log disponível."}

NODES ATUAIS:
${JSON.stringify(simplifiedNodes, null, 2)}
==============================
`;
        finalPromptParts.push({ text: contextString });
    }

    finalPromptParts.push({ text: `USUÁRIO DIZ: ${userPrompt}` });

    // MODELO: gemini-3-flash-preview
    // Atualizado para evitar erro 404 com modelos antigos/deprecados
    const modelId = 'gemini-3-flash-preview';

    console.log(`[AI] Gerando com modelo: ${modelId}...`);

    const response = await ai.models.generateContent({
        model: modelId,
        contents: [{ role: 'user', parts: finalPromptParts }],
        config: { 
            temperature: 0.1, // Criatividade baixa para garantir JSON válido
            maxOutputTokens: 8192,
            responseMimeType: 'application/json', // Força retorno JSON
            // DESATIVA FILTROS DE SEGURANÇA para permitir geração de código/scripts
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ]
        }
    });

    const text = response?.text || "{}";
    let flowData: FlowSchema | undefined;

    // --- PARSER DE JSON SUPER RESILIENTE ---
    try {
        let jsonString = text.trim();
        
        // Remove blocos de markdown ```json ... ``` se o modelo insistir em mandar
        const jsonBlockMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonBlockMatch && jsonBlockMatch[1]) {
            jsonString = jsonBlockMatch[1];
        } else {
             // Tenta achar o primeiro { e o último }
             const firstOpen = jsonString.indexOf('{');
             const lastClose = jsonString.lastIndexOf('}');
             if (firstOpen !== -1 && lastClose > firstOpen) {
                 jsonString = jsonString.substring(firstOpen, lastClose + 1);
             }
        }

        const parsed = JSON.parse(jsonString);
        
        // Validação mínima do schema
        if (parsed.nodes && Array.isArray(parsed.nodes)) {
            flowData = parsed as FlowSchema;
        } else if (parsed.response && parsed.response.nodes) {
            // Algumas vezes o modelo encapsula em um objeto "response"
            flowData = parsed.response as FlowSchema;
        }

    } catch (e) {
        console.error("Erro ao processar JSON da IA:", e);
        console.log("Conteúdo recebido:", text);
    }

    let displayText = text;
    
    if (flowData) {
        const nodeCount = flowData.nodes.length;
        displayText = `✅ **Fluxo Criado com Sucesso!**\n\nEntendi seu pedido. Gere um fluxo com **${nodeCount} passos**.\n\n👇 Clique no botão abaixo para importar e testar.`;
    } else {
        // Se falhou o JSON, tenta mostrar uma mensagem amigável se a IA mandou texto explicativo
        if (!text.trim().startsWith('{')) {
            displayText = text;
        } else {
             displayText = "⚠️ **A IA respondeu, mas o formato estava incorreto.**\nTente ser mais específico, ex: 'Crie um fluxo que consulta o Google e salva em arquivo'.";
        }
    }

    return { text: displayText, flowData };

  } catch (error: any) {
    console.error("Fatal Gemini Error:", error);
    
    let errorMessage = error.message || String(error);
    
    // Tratamento de erros comuns do Google
    if (errorMessage.includes('404') || errorMessage.includes('NOT_FOUND')) {
        return { 
            text: "⛔ **Modelo Não Encontrado (Erro 404)**\n\nO modelo solicitado não está disponível. Isso pode acontecer com modelos 'Preview' antigos.\n\n**Tentativa de correção:** O sistema foi atualizado para usar `gemini-3-flash-preview`. Tente novamente.", 
            flowData: undefined 
        };
    }

    if (errorMessage.includes('403') || errorMessage.includes('permission')) {
        return { 
            text: "⛔ **Acesso Negado (Erro 403)**\n\nSua chave de API é válida, mas não tem permissão para usar este modelo ou serviço.\n\n**Solução:**\n1. Verifique se a 'Google Generative Language API' está ativada no seu projeto Google Cloud.\n2. Gere uma nova chave no Google AI Studio.", 
            flowData: undefined 
        };
    }
    
    if (errorMessage.includes('429')) {
        return { text: "⏳ **Muitas Requisições**\n\nVocê atingiu o limite gratuito da API. Aguarde um minuto e tente novamente.", flowData: undefined };
    }

    return { text: `❌ **Erro na IA**: ${errorMessage.substring(0, 200)}...`, flowData: undefined };
  }
};