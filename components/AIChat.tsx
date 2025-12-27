import React, { useState, useRef, useEffect } from 'react';
import { generateFlowFromPrompt } from '../services/geminiService';
import { AIMessage, FlowSchema, LogEntry, FlowNode, FlowEdge } from '../types';
import { CREATOR_CREDIT } from '../constants';

interface AIChatProps {
  onImportFlow: (flowData: FlowSchema) => void;
  onCloseMobile?: () => void;
  isMobile?: boolean;
  logs: LogEntry[];         // Recebe logs do App
  nodes: FlowNode[];        // Recebe nodes atuais
  edges: FlowEdge[];        // Recebe edges atuais
}

const AIChat: React.FC<AIChatProps> = ({ onImportFlow, onCloseMobile, isMobile, logs, nodes, edges }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AIMessage[]>([
    { 
      role: 'system', 
      content: `Bem-vindo ao Flow Architect AI. Posso criar fluxos novos ou analisar os logs de erro para consertar seu fluxo atual.`, 
      timestamp: Date.now() 
    }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: AIMessage = { role: 'user', content: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Envia o contexto (logs e fluxo) junto com o prompt para a IA ser capaz de "debugar"
    const context = {
        logs,
        currentNodes: nodes,
        currentEdges: edges
    };

    const { text, flowData } = await generateFlowFromPrompt(input, context);

    const aiMsg: AIMessage = { 
      role: 'ai', 
      content: text, 
      timestamp: Date.now(),
      flowData 
    };

    setMessages(prev => [...prev, aiMsg]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 w-full">
      <div className="p-4 border-b border-gray-700 bg-gray-800 flex justify-between items-center">
        <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
            🤖 AI Architect
            <span className="text-xs bg-blue-600 px-2 py-0.5 rounded text-white">DEBUGGER</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">{CREATOR_CREDIT}</p>
        </div>
        
        {isMobile && (
            <button 
                onClick={onCloseMobile}
                className="p-2 text-gray-400 hover:text-white bg-gray-700 rounded-full"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[90%] rounded-lg p-3 text-sm ${
              msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'
            }`}>
              {msg.role === 'ai' ? (
                 <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>').replace(/```json/g, '').replace(/```/g, '') }} />
              ) : (
                msg.content
              )}
            </div>
            
            {msg.flowData && (
              <button 
                onClick={() => onImportFlow(msg.flowData!)}
                className="mt-2 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded flex items-center gap-2 transition-colors w-full justify-center shadow-lg border border-green-500"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                IMPORTAR FLUXO (CORRIGIDO)
              </button>
            )}
            <span className="text-[10px] text-gray-500 mt-1">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
        {loading && (
          <div className="flex items-start">
             <div className="bg-gray-700 rounded-lg p-3 text-sm text-gray-400 animate-pulse flex items-center gap-2">
               <svg className="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
               Analisando logs e desenhando fluxo...
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-gray-800 border-t border-gray-700 safe-area-bottom">
        {logs.some(l => l.level === 'ERROR') && (
            <div className="mb-2 px-2 py-1 bg-red-900/30 border border-red-900/50 rounded text-[10px] text-red-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                Erros detectados nos logs. A IA analisará automaticamente.
            </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={logs.length > 0 ? "Ex: Corrija o erro 404..." : "Descreva o fluxo..."}
            className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
          />
          <button 
            onClick={handleSend}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChat;