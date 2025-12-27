
import React, { useEffect, useState, useRef } from 'react';
import { SavedProject } from '../types';
import { storageService } from '../services/storageService';

interface ProjectLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadProject: (project: SavedProject) => void;
  currentNodesCount: number;
}

const ProjectLibraryModal: React.FC<ProjectLibraryModalProps> = ({ isOpen, onClose, onLoadProject, currentNodesCount }) => {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProjects = () => {
    setProjects(storageService.getProjects());
  };

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Tem certeza que deseja excluir este projeto permanentemente?')) {
      storageService.deleteProject(id);
      loadProjects();
    }
  };

  const handleExport = (proj: SavedProject, e: React.MouseEvent) => {
    e.stopPropagation();
    const blob = new Blob([JSON.stringify(proj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${proj.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.nodes && json.edges) {
          const name = json.name || `Importado-${Date.now()}`;
          storageService.saveProject(name, json.nodes, json.edges, json.files || []);
          loadProjects();
          alert(`Projeto "${name}" importado com sucesso para sua biblioteca!`);
        } else {
          alert("Arquivo inválido: Estrutura de fluxo incompleta.");
        }
      } catch (err) {
        alert("Erro ao ler o arquivo JSON.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
          <div className="flex items-center gap-2">
             <div className="bg-purple-600 p-2 rounded-lg text-white shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
             </div>
             <div>
                <h2 className="text-lg font-bold text-white leading-tight">Biblioteca de Projetos</h2>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">Armazenamento Local & Arquivos</p>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded shadow transition-colors flex items-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Importar JSON
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".json" className="hidden" />
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        
        {/* Projects List */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-900 custom-scrollbar">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-gray-500 border-2 border-dashed border-gray-800 rounded-xl space-y-4">
               <svg className="w-16 h-16 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
               <div className="text-center">
                   <p className="font-bold">Nenhum projeto salvo</p>
                   <p className="text-xs">Clique em "Salvar" no topo da tela para guardar seu fluxo atual.</p>
               </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((proj) => (
                <div 
                    key={proj.id} 
                    className="group bg-gray-800 border border-gray-700 hover:border-blue-500/50 rounded-xl p-4 transition-all hover:shadow-xl hover:bg-gray-800/80 flex flex-col h-full relative"
                >
                    <div className="flex-1 cursor-pointer" onClick={() => { onLoadProject(proj); onClose(); }}>
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-white text-sm truncate pr-2 group-hover:text-blue-400 transition-colors" title={proj.name}>{proj.name}</h3>
                            <span className="text-[9px] bg-blue-900/50 border border-blue-500/30 px-2 py-0.5 rounded-full text-blue-200 font-bold whitespace-nowrap">
                                {proj.nodes.length} NODES
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-4 border-b border-gray-700/50 pb-2">
                            <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> {new Date(proj.createdAt).toLocaleDateString()}</span>
                            <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> {new Date(proj.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>

                        {proj.files && proj.files.length > 0 && (
                            <div className="bg-gray-900/40 p-2 rounded-lg mb-2">
                                <div className="text-[9px] font-bold text-green-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    Arquivos salvos ({proj.files.length})
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between items-center mt-auto pt-3 border-t border-gray-700/50">
                        <button 
                             onClick={() => { onLoadProject(proj); onClose(); }}
                             className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest flex items-center gap-1"
                        >
                            CARREGAR PROJETO
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </button>

                        <div className="flex gap-2">
                            <button 
                                onClick={(e) => handleExport(proj, e)}
                                className="p-1.5 bg-gray-700 hover:bg-gray-600 text-blue-300 rounded-md transition-all active:scale-95 border border-gray-600"
                                title="Exportar para arquivo JSON"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            </button>
                            <button 
                                onClick={(e) => handleDelete(proj.id, e)}
                                className="p-1.5 bg-red-900/30 hover:bg-red-900/60 text-red-400 rounded-md transition-all active:scale-95 border border-red-900/20"
                                title="Excluir Permanentemente"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-800 flex justify-between items-center">
          <p className="text-[10px] text-gray-500 italic max-w-[200px]">
             {currentNodesCount > 0 ? '⚠️ Ao carregar, o fluxo atual será substituído. Salve-o antes se necessário.' : 'A biblioteca salva projetos localmente neste navegador.'}
          </p>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs font-bold transition-colors border border-gray-600"
          >
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectLibraryModal;
