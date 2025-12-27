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
      } catch (e) {
          // Keep typing
      }
  };

  const renderFields = () => {
    if (showAdvanced) {
        return (
            <div className="animate-fade-in">
                 <div className="p-2 bg-yellow-900/20 border border-yellow-900/50 rounded mb-2">
                    <p className="text-[10px] text-yellow-300">
                        ⚠️ Modo Avançado: Edite o JSON de configuração diretamente. Isso te dá 100% de controle sobre o nó.
                    </p>
                </div>
                <textarea 
                    className="w-full h-64 bg-gray-950 border border-gray-700 rounded p-2 text-xs font-mono text-green-400 outline-none resize-none"
                    value={JSON.stringify(config, null, 2)}
                    onChange={(e) => handleRawJsonChange(e.target.value)}
                />
            </div>
        )
    }

    switch (node.data.type) {
      case NodeType.HTTP_REQUEST:
        return (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Método HTTP</label>
              <select 
                value={config.method || 'GET'} 
                onChange={(e) => handleChange('method', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none transition-colors"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">URL da API</label>
              <input 
                type="text" 
                value={config.url || ''} 
                onChange={(e) => handleChange('url', e.target.value)}
                placeholder="https://api.exemplo.com/v1/recurso"
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none font-mono transition-colors"
              />
            </div>

            <div className="flex gap-2">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-400 mb-1">Timeout (ms)</label>
                    <input 
                        type="number" 
                        value={config.timeout || 45000} 
                        onChange={(e) => handleChange('timeout', parseInt(e.target.value))}
                        placeholder="45000"
                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none transition-colors"
                    />
                </div>
            </div>

            <div>
               <label className="block text-xs font-bold text-gray-400 mb-1">Headers (JSON)</label>
               <textarea
                  value={typeof config.headers === 'object' ? JSON.stringify(config.headers, null, 2) : config.headers || '{\n  "Content-Type": "application/json"\n}'}
                  onChange={(e) => handleChange('headers', e.target.value)}
                  className="w-full h-20 bg-gray-900 border border-gray-700 rounded p-2 text-xs text-green-300 focus:border-blue-500 outline-none font-mono resize-y"
                  placeholder='{ "Authorization": "Bearer..." }'
               />
            </div>

            {(config.method === 'POST' || config.method === 'PUT' || config.method === 'PATCH') && (
                <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">Body / Payload (JSON)</label>
                    <textarea
                        value={typeof config.body === 'object' ? JSON.stringify(config.body, null, 2) : config.body || '{}'}
                        onChange={(e) => handleChange('body', e.target.value)}
                        className="w-full h-32 bg-gray-900 border border-gray-700 rounded p-2 text-xs text-yellow-300 focus:border-blue-500 outline-none font-mono resize-y"
                        placeholder='{ "nome": "valor" }'
                    />
                </div>
            )}
          </div>
        );

      case NodeType.DELAY:
        return (
          <div className="animate-fade-in">
            <label className="block text-xs font-bold text-gray-400 mb-1">Tempo de Espera (ms)</label>
            <div className="flex items-center gap-2">
                <input 
                type="number" 
                value={config.ms || 1000} 
                onChange={(e) => handleChange('ms', parseInt(e.target.value))}
                className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none"
                />
                <span className="text-xs text-gray-500 font-mono">ms</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-2">1000ms = 1 segundo</p>
          </div>
        );

      case NodeType.FILE_SAVE:
        return (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Nome do Arquivo</label>
              <input 
                type="text" 
                value={config.fileName || ''} 
                onChange={(e) => handleChange('fileName', e.target.value)}
                placeholder="exemplo.txt"
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">Formato de Saída</label>
              <select 
                value={config.fileFormat || 'txt'} 
                onChange={(e) => handleChange('fileFormat', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none"
              >
                <option value="txt">Texto Puro (TXT)</option>
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
            </div>
            <div className="p-2 bg-blue-900/20 border border-blue-900/50 rounded">
                <p className="text-[10px] text-blue-300">
                    ℹ️ Este node pegará o resultado do node anterior e salvará na aba "Arquivos do Projeto".
                </p>
            </div>
          </div>
        );

      case NodeType.IF_CONDITION:
        return (
          <div className="animate-fade-in">
            <label className="block text-xs font-bold text-gray-400 mb-1">Expressão Condicional (JS)</label>
            <input 
              type="text" 
              value={config.condition || ''} 
              onChange={(e) => handleChange('condition', e.target.value)}
              placeholder="input.value > 10"
              className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none font-mono"
            />
            <p className="text-[10px] text-gray-500 mt-2">
                Use Javascript simples. Ex: <code>valor &gt; 100</code> ou <code>moeda === 'BRL'</code>
            </p>
          </div>
        );
        
      case NodeType.WEBHOOK:
         return (
             <div className="space-y-4 animate-fade-in">
                <div className="p-2 bg-purple-900/20 border border-purple-900/50 rounded">
                    <p className="text-[10px] text-purple-300">
                        ℹ️ Este é um gatilho manual. Em produção, isso geraria uma URL única.
                    </p>
                </div>
             </div>
         );

      default:
        return (
          <div className="text-gray-500 text-sm italic p-4 text-center border border-dashed border-gray-700 rounded">
            Nenhuma configuração específica. Use o modo avançado para editar.
          </div>
        );
    }
  };

  return (
    <div className="absolute top-0 right-0 h-full w-full md:w-80 bg-gray-800 border-l border-gray-700 shadow-2xl z-20 flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-850">
        <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${node.data.status === 'RUNNING' ? 'bg-blue-500' : 'bg-gray-500'} shadow-[0_0_8px_rgba(59,130,246,0.5)]`}></div>
            <div className="flex flex-col">
                <h3 className="font-bold text-white text-sm leading-tight">{node.data.label}</h3>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">{node.data.type}</span>
            </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-700 rounded">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="mb-6">
            <div className="flex items-center justify-between mb-4 border-b border-gray-700 pb-2">
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Parâmetros</h4>
                <div className="flex items-center gap-2">
                     <label className="text-[9px] text-gray-500 cursor-pointer flex items-center gap-1">
                        <input type="checkbox" checked={showAdvanced} onChange={(e) => setShowAdvanced(e.target.checked)} className="rounded bg-gray-700 border-gray-600"/>
                        Modo Avançado
                     </label>
                </div>
            </div>
            {renderFields()}
        </div>
        
        <div className="bg-gray-900 rounded p-3 border border-gray-800">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2">Node ID (Referência)</h4>
            <code className="block text-[10px] text-gray-400 font-mono bg-black/30 p-1.5 rounded select-all cursor-pointer hover:text-white transition-colors">
                {node.id}
            </code>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700 bg-gray-850 space-y-2">
        <button 
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-xs uppercase tracking-wide transition-all transform active:scale-95 shadow-lg shadow-blue-900/20"
        >
            Salvar e Fechar
        </button>

        <div className="flex gap-2">
             <button 
                onClick={() => onDuplicate(node.id)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded text-xs flex items-center justify-center gap-1 transition-colors"
             >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                Duplicar
             </button>
             <button 
                onClick={() => {
                    if (window.confirm("Excluir este node permanentemente?")) {
                        onDelete(node.id);
                        onClose();
                    }
                }}
                className="flex-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-200 border border-red-900/50 font-medium py-2 px-4 rounded text-xs flex items-center justify-center gap-1 transition-colors"
             >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Excluir
             </button>
        </div>
      </div>
    </div>
  );
};

export default NodeConfigPanel;