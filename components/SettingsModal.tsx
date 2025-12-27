import React, { useState, useEffect } from 'react';
import { CREATOR_CREDIT } from '../constants';
import { storageService } from '../services/storageService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeyPresent: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, apiKeyPresent }) => {
  const [userApiKey, setUserApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  useEffect(() => {
    if (isOpen) {
      const stored = storageService.getApiKey();
      if (stored) setUserApiKey(stored);
    }
  }, [isOpen]);

  const handleSaveKey = () => {
    if (userApiKey.trim()) {
      storageService.saveApiKey(userApiKey.trim());
    } else {
      storageService.removeApiKey();
    }
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const hasActiveKey = apiKeyPresent || !!userApiKey;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Configurações
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          
          {/* API Key Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
                 <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Google Gemini API</h3>
                 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${hasActiveKey ? 'bg-green-900 text-green-200 border-green-700' : 'bg-red-900 text-red-200 border-red-700'}`}>
                  {hasActiveKey ? 'CONECTADO' : 'DESCONECTADO'}
                </span>
            </div>

            <div className={`p-4 rounded-lg border bg-gray-950 border-gray-700`}>
              <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                      Chave de API Personalizada
                  </label>
                  <div className="relative flex items-center">
                    <input 
                        type={showKey ? "text" : "password"}
                        value={userApiKey}
                        onChange={(e) => setUserApiKey(e.target.value)}
                        placeholder="Cole sua AI Studio Key aqui..."
                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none pr-10 font-mono"
                    />
                    <button 
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2 text-gray-500 hover:text-white"
                    >
                        {showKey ? (
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        ) : (
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        )}
                    </button>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                       <span className="text-[10px] text-gray-500">
                          {userApiKey ? 'Chave local ativa' : apiKeyPresent ? 'Usando variável de ambiente' : 'Nenhuma chave configurada'}
                       </span>
                       <button 
                            onClick={handleSaveKey}
                            className={`text-xs px-3 py-1 rounded font-medium transition-colors ${saveStatus === 'saved' ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                       >
                           {saveStatus === 'saved' ? 'Salvo!' : 'Salvar Chave'}
                       </button>
                  </div>
              </div>
              
              <div className="pt-3 border-t border-gray-800">
                <p className="text-[10px] text-gray-400 leading-relaxed">
                   <strong>Nota:</strong> A chave é salva apenas no armazenamento local do seu navegador. Ela sobrescreve a variável de ambiente se estiver preenchida.
                </p>
              </div>
            </div>
          </div>

          {/* System Info */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Sobre o Sistema</h3>
            <div className="bg-gray-800/50 rounded-lg p-4 text-xs text-gray-400 space-y-2 border border-gray-700/50">
              <div className="flex justify-between">
                <span>Versão</span>
                <span className="text-gray-200">1.3.0 (Persistência)</span>
              </div>
              <div className="flex justify-between">
                <span>Engine</span>
                <span className="text-gray-200">React Flow + Gemini 3 Flash</span>
              </div>
              <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                <span>Developer</span>
                <span className="text-gray-200">João Layon</span>
              </div>
            </div>
          </div>

        </div>

        <div className="p-4 border-t border-gray-700 bg-gray-800 flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;