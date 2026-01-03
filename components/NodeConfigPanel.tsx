
import React, { useState, useEffect } from 'react';
import { FlowNode, NodeType } from '../types';

interface NodeConfigPanelProps {
  node: FlowNode | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (nodeId: string, newConfig: any) => void;
  onDelete: (nodeId: string) => void;
  onDuplicate: (nodeId: string) => void;
}

const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({ node, isOpen, onClose, onUpdate, onDelete }) => {
  const [config, setConfig] = useState<any>({});

  useEffect(() => {
    if (node) setConfig(node.data.config || {});
  }, [node]);

  if (!isOpen || !node) return null;

  const handleChange = (key: string, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onUpdate(node.id, newConfig);
  };

  return (
    <div className="fixed inset-0 z-[100] md:absolute md:inset-y-0 md:right-0 md:left-auto md:w-96 flex flex-col pointer-events-none">
      <div className="absolute inset-0 bg-black/40 md:hidden pointer-events-auto" onClick={onClose} />
      
      <div className="mt-auto md:mt-0 w-full md:h-full bg-gray-900 border-t md:border-t-0 md:border-l border-gray-800 pointer-events-auto shadow-2xl animate-mobile-up md:animate-none overflow-hidden flex flex-col rounded-t-3xl md:rounded-none">
        
        {/* DRAG HANDLE MOBILE */}
        <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto my-3 md:hidden" />

        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
             <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></div>
             <h3 className="font-black text-sm uppercase tracking-widest">{node.data.label}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-20 md:pb-6">
          {node.data.type === NodeType.HTTP_REQUEST && (
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Endpoint URL</label>
                <input 
                  type="text" value={config.url || ''} onChange={(e) => handleChange('url', e.target.value)}
                  placeholder="https://api.exemplo.com/v1"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl p-4 text-sm focus:border-blue-500 outline-none font-mono text-blue-300"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Método</label>
                <select 
                  value={config.method || 'GET'} onChange={(e) => handleChange('method', e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl p-4 text-sm focus:border-blue-500 outline-none"
                >
                  <option>GET</option>
                  <option>POST</option>
                  <option>PUT</option>
                  <option>DELETE</option>
                </select>
              </div>
            </div>
          )}

          {node.data.type === NodeType.IF_CONDITION && (
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-2">Condição JS</label>
              <textarea 
                value={config.condition || ''} onChange={(e) => handleChange('condition', e.target.value)}
                placeholder="input.price > 100"
                className="w-full h-32 bg-gray-950 border border-gray-800 rounded-xl p-4 text-sm font-mono text-yellow-500 outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div className="pt-4 border-t border-gray-800">
             <button 
              onClick={() => { if(confirm('Excluir este nó?')) { onDelete(node.id); onClose(); } }}
              className="w-full py-4 text-xs font-black uppercase tracking-widest text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-all"
             >
                Remover Nó
             </button>
          </div>
        </div>
        
        <div className="p-4 bg-gray-900 border-t border-gray-800 hidden md:block">
           <button onClick={onClose} className="w-full py-3 bg-blue-600 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/20 active:scale-95 transition-all">Salvar Alterações</button>
        </div>
      </div>
    </div>
  );
};

export default NodeConfigPanel;
