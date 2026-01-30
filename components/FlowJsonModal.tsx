
import React, { useState, useEffect, useRef } from 'react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const content = event.target?.result as string;
            // Valida JSON básico
            JSON.parse(content);
            setJsonContent(content);
            setError(null);
        } catch (err) {
            setError("Arquivo inválido: Não é um JSON válido.");
        }
    };
    reader.readAsText(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
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
          <button onClick={onClose} className="p-2 text-gray-