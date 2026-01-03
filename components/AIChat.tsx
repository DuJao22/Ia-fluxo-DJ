
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
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg: AIMessage = { role: 'user', content: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const { text, flowData } = await generateFlowFromPrompt(input, { logs, currentNodes: nodes, currentEdges: edges });
    const aiMsg: AIMessage = { role: 'ai', content: text, timestamp: Date.now(), flowData };
    setMessages(prev => [...prev, aiMsg]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 w-full overflow-hidden">
      <div className="p-4 border-b border-gray-800 bg-gray-900/50">
        <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
            AI Architect
        </h2>
        <p className="text-[10px] text-gray-500 font-medium mt-1 uppercase tracking-tighter">{CREATOR_CREDIT}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar pb-24">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-lg ${
              msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-gray-850 text-gray-200 border border-gray-800 rounded-tl-none'
            }`}>
              <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>') }} />
              {msg.flowData && (
                <button 
                  onClick={() => onImportFlow(msg.flowData!)}
                  className="mt-4 w-full bg-green-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-green-900/20 active:scale-95 transition-transform"
                >
                  Carregar este Fluxo
                </button>
              )}
            </div>
            <span className="text-[9px] text-gray-600 mt-2 font-mono">{new Date(msg.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
        {loading && (
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex items-center gap-3 animate-pulse">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            <span className="text-xs text-blue-400 font-bold uppercase tracking-widest">Processando solução...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-gray-950 via-gray-950 to-transparent">
        <div className="flex gap-2 bg-gray-900 p-1.5 border border-gray-700 rounded-2xl shadow-2xl">
          <input
            type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Qual fluxo criaremos hoje?"
            className="flex-1 bg-transparent px-4 py-2.5 text-white text-sm focus:outline-none placeholder-gray-600"
          />
          <button onClick={handleSend} disabled={loading} className="bg-blue-600 text-white p-3 rounded-xl shadow-lg active:scale-90 transition-transform disabled:bg-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
