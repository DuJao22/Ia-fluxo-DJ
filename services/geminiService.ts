
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from '../constants';
import { FlowSchema, FlowContext } from '../types';
import { keyManager } from './keyManager';

export const generateFlowFromPrompt = async (userPrompt: string, context?: FlowContext): Promise<{ text: string, flowData?: FlowSchema }> => {
  let attempts = 0;
  const totalKeys = JSON.parse(keyManager.getStatus()).total;
  // Tenta pelo menos o número de chaves disponíveis ou 5 vezes se não houver chaves
  const maxAttempts = Math.max(totalKeys, 3);

  while (attempts < maxAttempts) {
    const activeKey = keyManager.getActiveKey();
    
    if (!activeKey) {
        return { 
          text: "❌ **Erro Crítico**: Nenhuma chave de API disponível no pool para este domínio.", 
          flowData: undefined 
        };
    }

    try {
      // Importante: Nova instância para garantir que a chave atualizada seja usada
      const ai = new GoogleGenAI({ apiKey: activeKey });
      
      let finalPromptParts: any[] = [{ text: SYSTEM_PROMPT }];

      if (context) {
          const recentLogs = context.logs.slice(-10).map(l => `[${l.level}] ${l.nodeLabel}: ${l.message}`).join('\n');
          const contextString = `
=== CONTEXTO DO FLOW ===
LOGS RECENTES: ${recentLogs || "Nenhum log."}
NODES ATIVOS: ${context.currentNodes.length}
========================`;
          finalPromptParts.push({ text: contextString });
      }

      finalPromptParts.push({ text: `SOLICITAÇÃO DO USUÁRIO: ${userPrompt}` });

      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview', // Mantendo o modelo solicitado
          contents: [{ role: 'user', parts: finalPromptParts }],
          config: { 
              temperature: 0.1, // Menor temperatura para JSON mais estável
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
          console.warn("[IA] Resposta não continha JSON puro, tentando extrair.");
      }

      return { 
        text: flowData ? `✅ **Fluxo Otimizado** (Processado pela Chave #${keyManager.getCurrentIndex() + 1})` : text, 
        flowData 
      };

    } catch (error: any) {
      const errorMsg = error.message || "";
      const status = error.status || (errorMsg.includes('403') ? 403 : errorMsg.includes('429') ? 429 : 500);
      
      console.error(`[IA] Falha na Chave #${keyManager.getCurrentIndex() + 1} | Status: ${status}`);

      // Se for 403 (Proibido/Restrição de Referenciador), 429 (Limite) ou 400 (Inválida)
      const isKeyError = status === 403 || status === 429 || status === 400 || errorMsg.includes('API key');

      if (isKeyError && keyManager.markCurrentKeyAsFailed()) {
          attempts++;
          // Pequeno delay antes de tentar a próxima chave para evitar overload
          await new Promise(r => setTimeout(r, 100));
          continue; 
      }

      return { 
          text: `❌ **Erro de API (Status ${status})**: ${errorMsg}. Verifique as restrições da chave no Google Cloud Console.`, 
          flowData: undefined 
      };
    }
  }
  
  return { text: "❌ **Falha Total**: Todas as chaves do pool retornaram erro 403 ou 429. Verifique as 'Restrições de API' no console do Google Cloud.", flowData: undefined };
};
