
import React, { useState, useEffect } from 'react';
import { FlowNode, FlowEdge } from '../types';

interface FlowJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: FlowNode[];
  edges: FlowEdge[];
  onImport: (nodes: FlowNode[], edges: FlowEdge[]) => void;
}

const FlowJsonModal: React.FC<FlowJsonModalProps> = ({ isOpen, onClose, nodes, edges, onImport }) => {
  const [jsonContent, setJsonContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Limpa dados internos do ReactFlow para exportação limpa
      const cleanNodes = nodes.map(({ ...n }) => n);
      const cleanEdges = edges.map(({ ...e }) => e);
      setJsonContent(JSON.stringify({ nodes: cleanNodes, edges: cleanEdges }, null, 2));
      setError(null);
      setCopySuccess(false);
    }
  }, [isOpen, nodes, edges]);

  const handleApply = () => {
    try {
      const parsed = JSON.parse(jsonContent);
      if (!Array.isArray(parsed.nodes)) throw new Error("Formato inválido: 'nodes' deve ser um array.");
      
      onImport(parsed.nodes, parsed.edges || []);
      onClose();
    } catch (e: any) {
      setError(e.message || "Erro de sintaxe JSON");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonContent);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-700 bg-gray-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
             <div className="bg-indigo-600 p-2 rounded-lg text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
             </div>
             <div>
                 <h2 className="text-sm md:text-lg font-bold text-white">Editor de Fluxo JSON</h2>
                 <p className="text-[10px] text-gray-400 font-mono uppercase">Edite a estrutura ou baixe o arquivo</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-2 bg-gray-950 border-b border-gray-800 flex gap-2 overflow-x-auto shrink-0">
            <button onClick={handleCopy} className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs font-bold transition-all border border-gray-700">
                {copySuccess ? <span className="text-green-400">Copiado!</span> : <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                    Copiar
                </>}
            </button>
            <button onClick={handleDownload} className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-blue-400 rounded text-xs font-bold transition-all border border-gray-700">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Baixar .json
            </button>
        </div>

        {/* Editor Area */}
        <div className="flex-1 relative bg-[#0d1117]">
            <textarea 
                value={jsonContent}
                onChange={(e) => { setJsonContent(e.target.value); setError(null); }}
                className="absolute inset-0 w-full h-full bg-transparent text-xs font-mono text-green-400 p-4 resize-none outline-none leading-relaxed"
                spellCheck={false}
            />
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-800 border-t border-gray-700 flex justify-between items-center shrink-0 pb-[max(16px,env(safe-area-inset-bottom))]">
             <div className="text-red-400 text-xs font-bold px-2">
                 {error && <span className="flex items-center gap-1">⚠️ {error}</span>}
             </div>
             <div className="flex gap-3">
                 <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-xs font-bold">Cancelar</button>
                 <button 
                    onClick={handleApply}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-900/40 active:scale-95 transition-all"
                 >
                    Aplicar Alterações
                 </button>
             </div>
        </div>
      </div>
    </div>
  );
};

export default FlowJsonModal;
