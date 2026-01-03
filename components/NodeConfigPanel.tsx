
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

const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({ node, isOpen, onClose, onUpdate, onDelete, onDuplicate }) => {
  const [config, setConfig] = useState<any>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (node) {
      setConfig(node.data.config || {});
    }
  }, [node]);

  if (!isOpen || !node) return null;

  const handleChange = (key: string, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onUpdate(node.id, newConfig);
  };
  
  const handleRawJsonChange = (jsonStr: string) => {
      try {
          const parsed = JSON.parse(jsonStr);
          setConfig(parsed);
          onUpdate(node.id, parsed);
      } catch (e) {}
  };

  const renderFields = () => {
    if (showAdvanced) {
        return (
            <textarea 
                className="w-full h-64 bg-gray-950 border border-gray-700 rounded p-2 text-xs font-mono text-green-400 outline-none resize-none"
                value={JSON.stringify(config, null, 2)}
                onChange={(e) => handleRawJsonChange(e.target.value)}
            />
        )
    }

    switch (node.data.type) {
      case NodeType.HTTP_REQUEST:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Método</label>
              <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                {['GET', 'POST', 'PUT', 'DELETE'].map(m => (
                    <button key={m} onClick={() => handleChange('method', m)} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${config.method === m ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>{m}</button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">URL Endpoint</label>
              <input 
                type="text" value={config.url || ''} onChange={(e) => handleChange('url', e.target.value)}
                placeholder="https://api..."
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none font-mono"
              />
            </div>

            <div>
               <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Payload / Headers</label>
               <textarea
                  value={typeof config.body === 'object' ? JSON.stringify(config.body, null, 2) : config.body || ''}
                  onChange={(e) => handleChange('body', e.target.value)}
                  className="w-full h-32 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-yellow-300 outline-none font-mono resize-none"
                  placeholder='{ "JSON": "aqui" }'
               />
            </div>
          </div>
        );

      case NodeType.IF_CONDITION:
        return (
          <div className="space-y-4">
            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Javascript Condition</label>
            <textarea 
              value={config.condition || ''} onChange={(e) => handleChange('condition', e.target.value)}
              placeholder="input.price > 100"
              className="w-full h-24 bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none font-mono"
            />
          </div>
        );

      default:
        return <div className="text-gray-500 text-xs italic text-center p-8">Configurações específicas não disponíveis para este nó.</div>;
    }
  };

  return (
    <div className="fixed inset-0 md:absolute md:inset-y-0 md:right-0 md:left-auto md:w-96 bg-gray-900 md:border-l border-gray-700 z-[100] flex flex-col animate-mobile-sheet md:animate-none">
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-850 shrink-0">
        <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse"></div>
            <h3 className="font-bold text-white text-sm">{node.data.label}</h3>
        </div>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Configuração</span>
            <label className="text-[10px] text-gray-500 flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showAdvanced} onChange={(e) => setShowAdvanced(e.target.checked)} className="rounded" />
                Modo JSON
            </label>
        </div>
        {renderFields()}
      </div>

      <div className="p-6 border-t border-gray-800 bg-gray-900/50 flex flex-col gap-3">
        <button onClick={onClose} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl text-sm shadow-xl active:scale-95 transition-transform">CONCLUÍDO</button>
        <button 
          onClick={() => { if(confirm('Excluir nó?')) { onDelete(node.id); onClose(); } }}
          className="w-full bg-red-900/20 text-red-500 border border-red-900/30 font-bold py-3 rounded-xl text-[11px] active:scale-95"
        >
          REMOVER NÓ
        </button>
      </div>
    </div>
  );
};

export default NodeConfigPanel;
