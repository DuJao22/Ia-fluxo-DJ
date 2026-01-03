
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { SYSTEM_PROMPT } from '../constants';
import { FlowSchema, FlowContext } from '../types';
import { keyManager } from './keyManager';

export const generateFlowFromPrompt = async (userPrompt: string, context?: FlowContext): Promise<{ text: string, flowData?: FlowSchema }> => {
  let attempts = 0;
  const poolStatus = JSON.parse(keyManager.getStatus());
  const maxAttempts = poolStatus.total > 0 ? poolStatus.total : 1;

  while (attempts < maxAttempts) {
    const activeKey = keyManager.getActiveKey();
    
    if (!activeKey) {
        return { 
          text: "❌ **Erro de Configuração**: Nenhuma chave de API detectada. Verifique o arquivo `api_keys_list.ts` ou as variáveis de ambiente do Vercel.", 
          flowData: undefined 
        };
    }

    try {
      // REGRA: Sempre instanciar um novo GoogleGenAI logo antes do uso
      const ai = new GoogleGenAI({ apiKey: activeKey });
      
      let finalPromptParts: any[] = [{ text: SYSTEM_PROMPT }];

      if (context) {
          const recentLogs = context.logs.slice(-10).map(l => `[${l.level}] ${l.nodeLabel}: ${l.message}`).join('\n');
          const contextString = `
=== CONTEXTO DO FLOW ===
LOGS: ${recentLogs || "Nenhum log."}
NODES: ${context.currentNodes.length} nodes ativos.
========================`;
          finalPromptParts.push({ text: contextString });
      }

      finalPromptParts.push({ text: `SOLICITAÇÃO: ${userPrompt}` });

      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ role: 'user', parts: finalPromptParts }],
          config: { 
              temperature: 0.2,
              maxOutputTokens: 4096,
              responseMimeType: 'application/json'
          }
      });

      const text = response.text || "";
      let flowData: FlowSchema | undefined;

      try {
          const jsonString = text.includes('```json') 
            ? text.split('```json')[1].split('```')[0].trim() 
            : text.trim();
          
          const parsed = JSON.parse(jsonString);
          if (parsed.nodes) flowData = parsed as FlowSchema;
      } catch (e) {
          console.error("[IA] Resposta não continha JSON válido.");
      }

      return { 
        text: flowData ? `✅ **Fluxo Gerado com Sucesso!** (Chave #${keyManager.getCurrentIndex() + 1})` : text, 
        flowData 
      };

    } catch (error: any) {
      const errorMsg = error.message || "Erro desconhecido";
      console.error(`[IA] Falha na Chave #${keyManager.getCurrentIndex() + 1}:`, errorMsg);
      
      // Lista de erros que justificam trocar de chave
      const isRetryable = 
        errorMsg.includes('429') || // Quota
        errorMsg.includes('403') || // Forbidden/Key problem
        errorMsg.includes('quota') || 
        errorMsg.includes('limit');

      if (isRetryable && keyManager.markCurrentKeyAsFailed()) {
          attempts++;
          continue; 
      }

      return { 
          text: `❌ **Erro na API Gemini**: ${errorMsg}\n\n*Tentativa ${attempts + 1} de ${maxAttempts}*`, 
          flowData: undefined 
      };
    }
  }
  
  return { text: "❌ **Falha Total**: Todas as chaves de API retornaram erro ou atingiram o limite.", flowData: undefined };
};
