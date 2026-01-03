
import React, { useState, useRef, useEffect } from 'react';
import { generateFlowFromPrompt } from '../services/geminiService';
import { AIMessage, FlowSchema, LogEntry, FlowNode, FlowEdge } from '../types';
import { CREATOR_CREDIT } from '../constants';

interface AIChatProps {
  onImportFlow: (flowData: FlowSchema) => void;
  onCloseMobile?: () => void;
  isMobile?: boolean;
  logs: LogEntry[];
  nodes: FlowNode[];
  edges: FlowEdge[];
}

const AIChat: React.FC<AIChatProps> = ({ onImportFlow, logs, nodes, edges }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AIMessage[]>([
    { role: 'system', content: `Olá! Sou o AI Architect. Posso criar fluxos novos para você ou analisar erros de execução. Como posso ajudar?`, timestamp: Date.now() }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: AIMessage = { role: 'user', content: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { text, flowData } = await generateFlowFromPrompt(input, { logs, currentNodes: nodes, currentEdges: edges });
      const aiMsg: AIMessage = { role: 'ai', content: text, timestamp: Date.now(), flowData };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: "Desculpe, tive um problema ao processar sua solicitação. Tente novamente.", 
        timestamp: Date.now() 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 w-full overflow-hidden relative">
      {/* Header do Chat */}
      <div className="p-3 border-b border-gray-800 bg-gray-900/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between shrink-0">
        <div>
            <h2 className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                AI Architect
            </h2>
            <p className="text-[9px] text-gray-500 font-medium uppercase tracking-tighter">{CREATOR_CREDIT}</p>
        </div>
      </div>

      {/* Lista de Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 space-y-4 custom-scrollbar">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[92%] md:max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-gray-850 text-gray-200 border border-gray-800 rounded-tl-none'
            }`}>
              <div 
                className="whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>') }} 
              />
              
              {msg.flowData && (
                <button 
                  onClick={() => onImportFlow(msg.flowData!)}
                  className="mt-3 w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-green-900/30 active:scale-95 transition-all"
                >
                  Importar Fluxo Sugerido
                </button>
              )}
            </div>
            <span className="text-[8px] text-gray-600 mt-1.5 font-mono uppercase">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        
        {loading && (
          <div className="flex flex-col items-start animate-pulse">
            <div className="bg-gray-900 rounded-2xl px-4 py-3 border border-gray-800 flex items-center gap-2">
                <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest ml-1">Analisando...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* Barra de Input Estilizada - AGORA NO FLUXO NORMAL (Flex) */}
      <div className="shrink-0 p-3 bg-gray-900 border-t border-gray-800 z-20 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="flex gap-2 bg-gray-950 p-1.5 border border-gray-700 rounded-2xl shadow-xl focus-within:border-blue-500 transition-colors">
          <input
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Descreva o fluxo..."
            className="flex-1 bg-transparent px-3 py-2 text-white text-base focus:outline-none placeholder-gray-600"
          />
          <button 
            onClick={handleSend} 
            disabled={loading || !input.trim()} 
            className="bg-blue-600 hover:bg-blue-500 text-white w-10 h-10 flex items-center justify-center rounded-xl shadow-lg active:scale-90 transition-all disabled:opacity-50 disabled:bg-gray-800 disabled:scale-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;