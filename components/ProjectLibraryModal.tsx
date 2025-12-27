import React, { useEffect, useState } from 'react';
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
    if (window.confirm('Tem certeza que deseja excluir este projeto?')) {
      storageService.deleteProject(id);
      loadProjects();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
          <div className="flex items-center gap-2">
             <div className="bg-purple-600 p-1.5 rounded text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
             </div>
             <h2 className="text-lg font-bold text-white">Minha Biblioteca de Projetos</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 bg-gray-900">
          
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500 border-2 border-dashed border-gray-800 rounded-lg">
               <svg className="w-12 h-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
               <p>Nenhum projeto salvo encontrado.</p>
               <p className="text-xs mt-1">Clique em "Salvar" no topo da tela para guardar seu fluxo atual.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((proj) => (
                <div 
                    key={proj.id} 
                    onClick={() => { onLoadProject(proj); onClose(); }}
                    className="group bg-gray-800 border border-gray-700 hover:border-blue-500 rounded-lg p-4 cursor-pointer transition-all hover:shadow-lg hover:bg-gray-800/80 relative flex flex-col justify-between"
                >
                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-white text-sm truncate pr-6" title={proj.name}>{proj.name}</h3>
                            <span className="text-[10px] bg-gray-700 px-2 py-0.5 rounded text-gray-300 whitespace-nowrap">
                                {proj.nodes.length} Nodes
                            </span>
                        </div>
                        
                        <div className="text-[10px] text-gray-500 flex flex-col gap-0.5 mb-3">
                            <span>Criado: {new Date(proj.createdAt).toLocaleDateString()}</span>
                            <span>Atualizado: {new Date(proj.updatedAt).toLocaleTimeString()}</span>
                        </div>

                        {/* Listagem de Arquivos Salvos dentro do Projeto */}
                        {proj.files && proj.files.length > 0 ? (
                            <div className="bg-gray-900/50 p-2 rounded border border-gray-700/50 mt-2">
                                <span className="text-[9px] font-bold text-green-400 uppercase tracking-wider mb-1 block">Arquivos Gerados ({proj.files.length}):</span>
                                <ul className="space-y-1">
                                    {proj.files.slice(0, 3).map(f => (
                                        <li key={f.id} className="text-[10px] text-gray-300 flex items-center gap-1">
                                            <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            <span className="truncate max-w-[150px]">{f.name}</span>
                                        </li>
                                    ))}
                                    {proj.files.length > 3 && (
                                        <li className="text-[9px] text-gray-500 italic">+ {proj.files.length - 3} outros...</li>
                                    )}
                                </ul>
                            </div>
                        ) : (
                            <div className="mt-2 text-[10px] text-gray-600 italic">Sem arquivos anexados.</div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-2 right-2">
                        <button 
                            onClick={(e) => handleDelete(proj.id, e)}
                            className="p-1.5 bg-red-900/50 hover:bg-red-900 text-red-200 rounded transition-colors"
                            title="Excluir Projeto"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700 bg-gray-800 flex justify-between items-center">
          <span className="text-xs text-gray-500">
             {currentNodesCount > 0 ? '⚠️ Carregar um projeto substituirá o fluxo atual.' : ''}
          </span>
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

export default ProjectLibraryModal;