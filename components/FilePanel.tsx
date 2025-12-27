import React from 'react';
import { GeneratedFile } from '../types';

interface FilePanelProps {
  files: GeneratedFile[];
  isOpen?: boolean;
}

const FilePanel: React.FC<FilePanelProps> = ({ files, isOpen = true }) => {
  
  const downloadFile = (file: GeneratedFile) => {
    // IMPORTANTE: Adiciona o Byte Order Mark (BOM) \uFEFF para forçar UTF-8 no Excel/Windows
    const byteOrderMark = '\uFEFF';
    
    let mimeType = 'text/plain;charset=utf-8';
    if (file.extension === 'json') mimeType = 'application/json;charset=utf-8';
    if (file.extension === 'csv') mimeType = 'text/csv;charset=utf-8';

    const blob = new Blob([byteOrderMark, file.content], { type: mimeType });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="h-full bg-gray-950 flex flex-col font-mono text-xs w-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {files.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2">
            <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className="italic">Nenhum arquivo gerado neste projeto.</span>
          </div>
        )}
        
        {files.map((file) => (
          <div key={file.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 p-3 rounded-md hover:border-gray-700 transition-colors group">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-blue-400 font-bold uppercase text-[10px] border border-gray-700">
                    {file.extension}
                </div>
                <div className="flex flex-col">
                    <span className="text-gray-200 font-medium text-sm">{file.name}</span>
                    <span className="text-gray-500 text-[10px]">Gerado às {new Date(file.timestamp).toLocaleTimeString()} • UTF-8</span>
                </div>
             </div>
             
             <button 
                onClick={() => downloadFile(file)}
                className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 p-2 rounded transition-colors border border-gray-700"
                title="Baixar Arquivo (UTF-8)"
             >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
             </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FilePanel;