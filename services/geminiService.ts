import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from '../constants';
import { FlowSchema, FlowContext } from '../types';
import { storageService } from './storageService';

export const generateFlowFromPrompt = async (userPrompt: string, context?: FlowContext): Promise<{ text: string, flowData?: FlowSchema }> => {
  const storedKey = storageService.getApiKey();
  const envKey = process.env.API_KEY;
  const activeKey = storedKey || envKey;

  if (!activeKey) {
    return { 
      text: "⚠️ **Configuração Necessária**: Nenhuma API Key válida detectada. \n\nPara usar o Chat IA, clique no ícone de engrenagem (⚙️) e insira sua API Key do Google Gemini ou configure a variável de ambiente `API_KEY`.", 
      flowData: undefined 
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: activeKey });
    
    // Preparação do Contexto
    let finalPromptParts = [{ text: SYSTEM_PROMPT }];

    if (context) {
        const recentLogs = context.logs.slice(-15).map(l => `[${l.level}] ${l.nodeLabel}: ${l.message}`).join('\n');
        
        // Simplifica o fluxo atual para o prompt
        const simplifiedNodes = context.currentNodes.map(n => ({
            id: n.id,
            type: n.data.type,
            label: n.data.label,
            config: n.data.config
        }));

        const contextString = `
=== CONTEXTO DE DEBUG (O USUÁRIO ESTÁ VENDO ISSO) ===
LOGS DE ERRO/EXECUÇÃO:
${recentLogs || "Nenhum log disponível."}

ESTRUTURA ATUAL:
${JSON.stringify(simplifiedNodes, null, 2)}
=====================================================
`;
        finalPromptParts.push({ text: contextString });
    }

    finalPromptParts.push({ text: `USUÁRIO DIZ: ${userPrompt}` });

    // Tenta modelos robustos
    const modelsToTry = ['gemini-2.0-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'];
    let response;
    let lastError: any = null;

    for (const model of modelsToTry) {
        try {
            console.log(`[AI] Gerando com modelo: ${model}...`);
            response = await ai.models.generateContent({
                model: model,
                contents: [{ role: 'user', parts: finalPromptParts }],
                config: { 
                    temperature: 0.2,
                    // Aumenta token limit para evitar JSON cortado
                    maxOutputTokens: 8000 
                }
            });
            break;
        } catch (e: any) {
            lastError = e;
            const msg = e.message || "";
            if (msg.includes('404') || msg.includes('NOT_FOUND') || msg.includes('403') || msg.includes('503')) {
                continue;
            }
            // Se for outro erro, tenta o próximo anyway por segurança
            continue; 
        }
    }

    if (!response && lastError) throw lastError;

    const text = response?.text || "Não foi possível gerar uma resposta.";
    let flowData: FlowSchema | undefined;

    // --- PARSER DE JSON CIRÚRGICO ---
    // A IA muitas vezes mistura texto explicativo com o JSON.
    // Esta função procura o primeiro '{' e o último '}' para extrair o objeto principal.
    
    try {
        let jsonString = '';
        
        // 1. Tenta extrair de blocos de código Markdown (mais seguro)
        const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonBlockMatch && jsonBlockMatch[1]) {
            jsonString = jsonBlockMatch[1];
        } 
        // 2. Se não achar bloco, tenta achar o objeto JSON bruto no texto
        else {
            const firstOpenBrace = text.indexOf('{');
            const lastCloseBrace = text.lastIndexOf('}');
            
            if (firstOpenBrace !== -1 && lastCloseBrace !== -1 && lastCloseBrace > firstOpenBrace) {
                jsonString = text.substring(firstOpenBrace, lastCloseBrace + 1);
            }
        }

        if (jsonString) {
            // Limpeza extra para JSONs sujos
            jsonString = jsonString.replace(/\\n/g, "\\n")  
                                   .replace(/\\'/g, "\\'")
                                   .replace(/\\"/g, '\\"')
                                   .replace(/\\&/g, "\\&")
                                   .replace(/\\r/g, "\\r")
                                   .replace(/\\t/g, "\\t")
                                   .replace(/\\b/g, "\\b")
                                   .replace(/\\f/g, "\\f");
            // Remove caracteres de controle invisíveis que quebram JSON.parse
            jsonString = jsonString.replace(/[\u0000-\u0019]+/g,""); 

            const parsed = JSON.parse(jsonString);
            
            // Validação mínima para garantir que é um fluxo
            if (parsed.nodes && Array.isArray(parsed.nodes)) {
                flowData = parsed as FlowSchema;
                console.log("Fluxo extraído com sucesso:", flowData.nodes.length, "nodes");
            }
        }
    } catch (e) {
        console.error("Erro ao fazer parse do JSON gerado pela IA:", e);
        // Não falha silenciosamente, o texto explicativo ainda será mostrado ao usuário
    }

    return { text, flowData };

  } catch (error: any) {
    console.error("Fatal Gemini Error:", error);
    let friendlyError = "Erro de conexão com a IA.";
    
    if (error.message.includes('403')) {
        friendlyError = "⛔ **Erro de Permissão (403)**: Sua chave de API não tem permissão para usar o modelo Generativo. Ative a 'Google Generative Language API' no Google Cloud Console.";
    } else if (error.message.includes('404')) {
        friendlyError = "⛔ **Erro de Modelo (404)**: Os modelos configurados não estão disponíveis para sua chave.";
    }

    return { text: friendlyError, flowData: undefined };
  }
};