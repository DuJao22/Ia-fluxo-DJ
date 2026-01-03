
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { SYSTEM_PROMPT } from '../constants';
import { FlowSchema, FlowContext } from '../types';
import { keyManager } from './keyManager';

export const generateFlowFromPrompt = async (userPrompt: string, context?: FlowContext): Promise<{ text: string, flowData?: FlowSchema }> => {
  let attempts = 0;
  const maxAttempts = keyManager.getStatus().includes('0/0') ? 1 : 5; // Tenta mais vezes se houver chaves

  while (attempts < maxAttempts) {
    const activeKey = keyManager.getActiveKey();
    
    if (!activeKey) {
        return { text: "❌ **Erro**: Nenhuma chave de API configurada. Adicione suas chaves no arquivo `api_keys_list.ts`.", flowData: undefined };
    }

    try {
      const ai = new GoogleGenAI({ apiKey: activeKey });
      
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
LOGS:
${recentLogs || "Nenhum log disponível."}

NODES ATUAIS:
${JSON.stringify(simplifiedNodes, null, 2)}
==============================
`;
          finalPromptParts.push({ text: contextString });
      }

      finalPromptParts.push({ text: `USUÁRIO DIZ: ${userPrompt}` });

      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ role: 'user', parts: finalPromptParts }],
          config: { 
              temperature: 0.1,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json',
              safetySettings: [
                  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
              ]
          }
      });

      const text = response.text || "{}";
      let flowData: FlowSchema | undefined;

      try {
          let jsonString = text.trim();
          const jsonBlockMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonBlockMatch && jsonBlockMatch[1]) {
              jsonString = jsonBlockMatch[1];
          } else {
               const firstOpen = jsonString.indexOf('{');
               const lastClose = jsonString.lastIndexOf('}');
               if (firstOpen !== -1 && lastClose > firstOpen) {
                   jsonString = jsonString.substring(firstOpen, lastClose + 1);
               }
          }
          const parsed = JSON.parse(jsonString);
          if (parsed.nodes && Array.isArray(parsed.nodes)) {
              flowData = parsed as FlowSchema;
          }
      } catch (e) {
          console.error("Erro JSON IA:", e);
      }

      let displayText = flowData 
        ? `✅ **Fluxo Arquitetado!** (Usando Chave #${keyManager.getCurrentIndex() + 1})\n\nGere um fluxo com **${flowData.nodes.length} passos**.\n\n👇 Clique no botão abaixo para importar.`
        : text;

      return { text: displayText, flowData };

    } catch (error: any) {
      const errorMsg = error.message || "";
      
      // Se for erro de cota (429 ou 403), rotacionamos
      if ((errorMsg.includes('429') || errorMsg.includes('403') || errorMsg.includes('quota')) && keyManager.markCurrentKeyAsFailed()) {
          console.log(`[AI] Falha na Chave #${keyManager.getCurrentIndex()}. Tentando próxima...`);
          attempts++;
          continue; 
      }

      console.error("Fatal Gemini Error:", error);
      return { 
          text: `❌ **Erro Crítico**: ${errorMsg.substring(0, 200)}...\n\nStatus: ${keyManager.getStatus()}`, 
          flowData: undefined 
      };
    }
  }
  
  return { text: "❌ **Esgotado**: Todas as chaves da sua lista atingiram o limite de crédito.", flowData: undefined };
};
