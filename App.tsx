
import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  MiniMap,
  Panel,
  MarkerType,
} from 'reactflow';
import type { Connection, Edge, Node } from 'reactflow';
import CustomNode from './components/CustomNode';
import AIChat from './components/AIChat';
import LogPanel from './components/LogPanel';
import FilePanel from './components/FilePanel';
import SettingsModal from './components/SettingsModal';
import ProjectLibraryModal from './components/ProjectLibraryModal'; 
import NodeConfigPanel from './components/NodeConfigPanel';
import KeyStatusPanel from './components/KeyStatusPanel';
import { INITIAL_NODES, INITIAL_EDGES, APP_NAME } from './constants';
import { FlowEngine } from './services/flowEngine';
import { storageService } from './services/storageService'; 
import { FlowSchema, LogEntry, NodeStatus, GeneratedFile, FlowNode, SavedProject, NodeType } from './types';

const nodeTypes = {
  custom: CustomNode,
  httpRequest: CustomNode,
  webhook: CustomNode,
  delay: CustomNode,
  ifCondition: CustomNode,
  logger: CustomNode,
  discord: CustomNode,
  telegram: CustomNode,
  fileSave: CustomNode,
  start: CustomNode
};

const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: true,
  style: { strokeWidth: 2, stroke: '#63b3ed' },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#63b3ed',
  },
};

const AUTOSAVE_KEY = 'flow_architect_autosave_v1';

const App = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  const [currentProject, setCurrentProject] = useState<{id: string, name: string} | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // NAVEGAÇÃO MOBILE-FIRST
  const [activeView, setActiveView] = useState<'flow' | 'chat' | 'terminal'>('flow');
  const [terminalTab, setTerminalTab] = useState<'logs' | 'files'>('logs');
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false); 
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.nodes) {
          setNodes(parsed.nodes);
          setEdges(parsed.edges || []);
          setFiles(parsed.files || []);
          if (parsed.currentProject) setCurrentProject(parsed.currentProject);
        }
      } catch (e) {}
    }
    setIsLoaded(true);
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (!isLoaded) return;
    const timeoutId = setTimeout(() => {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ nodes, edges, files, currentProject }));
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [nodes, edges, files, isLoaded, currentProject]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, ...defaultEdgeOptions }, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const handleUpdateNodeConfig = useCallback((nodeId: string, newConfig: any) => {
    setNodes((nds) => 
      nds.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, config: newConfig } } : node)
    );
  }, [setNodes]);

  const handleAddNode = (type: NodeType, label: string) => {
    const id = `${type}-${Date.now()}`;
    const newNode: FlowNode = {
      id,
      type: 'custom',
      position: { x: 100, y: 100 },
      data: { label, type, status: NodeStatus.IDLE, config: {} }
    };
    setNodes((nds) => nds.concat(newNode));
    setIsAddMenuOpen(false);
    setSelectedNodeId(id);
  };

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNodeId(null);
  }, [setNodes, setEdges]);

  const handleRunFlow = useCallback(async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    setLogs([]); 
    setActiveView('terminal');
    setTerminalTab('logs');
    setNodes((nds) => nds.map(n => ({ ...n, data: { ...n.data, status: NodeStatus.IDLE } })));

    const engine = new FlowEngine(
      nodes, edges, setNodes, 
      (log) => setLogs(prev => [...prev, log]),
      (file) => setFiles(prev => [file, ...prev])
    );

    await engine.run();
    setIsExecuting(false);
  }, [nodes, edges, isExecuting, setNodes]);

  const handleLoadProject = (project: SavedProject) => {
    setNodes(project.nodes.map(n => ({ ...n, type: 'custom' })));
    setEdges(project.edges.map(e => ({ ...e, ...defaultEdgeOptions })));
    setFiles(project.files || []);
    setCurrentProject({ id: project.id, name: project.name });
    setIsDirty(false);
    setActiveView('flow');
  };

  return (
    <ReactFlowProvider>
      <div className="flex h-[100dvh] w-screen overflow-hidden flex-col bg-gray-950 text-white select-none">
        
        {/* HEADER RESPONSIVO */}
        <header className="h-14 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-4 shrink-0 z-[60]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-bold text-lg shadow-lg">F</div>
            <div className="flex flex-col">
                <h1 className="font-bold text-sm tracking-tight leading-none">{APP_NAME}</h1>
                <span className="text-[9px] text-gray-500 font-mono mt-1">{currentProject?.name || 'Novo Fluxo'}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <KeyStatusPanel />
             
             {/* MENU DE AÇÕES MOBILE */}
             <div className="relative">
                <button 
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="p-2 bg-gray-800 rounded-lg text-gray-400 hover:text-white border border-gray-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                </button>

                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-[100] py-2 animate-fade-in-up overflow-hidden">
                    <button onClick={() => { setIsLibraryOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-700 flex items-center gap-3 border-b border-gray-700/50">
                       <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                       Biblioteca
                    </button>
                    <button onClick={() => { setIsSettingsOpen(true); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-700 flex items-center gap-3">
                       <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                       Configurações
                    </button>
                  </div>
                )}
             </div>

             <button 
                onClick={handleRunFlow} 
                disabled={isExecuting}
                className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all shadow-lg ${isExecuting ? 'bg-gray-700 animate-pulse' : 'bg-green-600 hover:bg-green-700 active:scale-95'}`}
             >
                {isExecuting ? <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div> : <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 001.664l-3-2z"/></svg>}
             </button>
          </div>
        </header>

        {/* MAIN CONTENT AREA - ADAPTÁVEL */}
        <main className="flex-1 relative overflow-hidden flex flex-col md:flex-row">
          
          {/* VIEW 1: FLOW EDITOR */}
          <div className={`absolute inset-0 md:relative md:flex-1 transition-transform duration-300 ${activeView === 'flow' ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`} ref={reactFlowWrapper}>
            <ReactFlow 
                nodes={nodes} edges={edges} 
                onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={onNodeClick} 
                onPaneClick={() => setSelectedNodeId(null)} nodeTypes={nodeTypes} defaultEdgeOptions={defaultEdgeOptions}
                fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.1} maxZoom={2.5} proOptions={{ hideAttribution: true }}
            >
              <Background color="#4a5568" gap={20} size={1} />
              
              <Panel position="bottom-right" className="mb-4">
                 <button 
                  onClick={() => setIsAddMenuOpen(!isAddMenuOpen)} 
                  className="bg-blue-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform border-4 border-gray-950"
                 >
                    {isAddMenuOpen ? <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> : <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
                 </button>
                 
                 {isAddMenuOpen && (
                    <div className="absolute bottom-16 right-0 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-mobile-sheet z-50">
                        {[
                          {type: NodeType.START, label: 'Início', color: 'bg-green-500'},
                          {type: NodeType.HTTP_REQUEST, label: 'HTTP Request', color: 'bg-blue-500'},
                          {type: NodeType.IF_CONDITION, label: 'Condição IF', color: 'bg-yellow-500'},
                          {type: NodeType.FILE_SAVE, label: 'Salvar Arquivo', color: 'bg-indigo-500'},
                        ].map(item => (
                            <button key={item.type} onClick={() => handleAddNode(item.type, item.label)} className="w-full px-4 py-3 text-left text-sm hover:bg-gray-700 flex items-center gap-3 border-b border-gray-700/30 last:border-0 transition-colors">
                                <span className={`w-3 h-3 rounded-full ${item.color}`}></span> {item.label}
                            </button>
                        ))}
                    </div>
                 )}
              </Panel>

              <Controls position="top-right" className="!bg-gray-800 !border-gray-700 !fill-white" showInteractive={false} />
            </ReactFlow>
          </div>

          {/* VIEW 2: AI CHAT (Overlay no Mobile) */}
          <div className={`absolute inset-0 md:relative md:w-96 md:border-l md:border-gray-700 z-40 transition-transform duration-300 ${activeView === 'chat' ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
            <AIChat onImportFlow={(fd) => { handleLoadProject({ ...fd, id: 'temp', name: 'Fluxo IA', createdAt: Date.now(), updatedAt: Date.now(), files: [] }); setActiveView('flow'); }} isMobile={true} logs={logs} nodes={nodes} edges={edges} />
          </div>

          {/* VIEW 3: TERMINAL / LOGS (Overlay no Mobile) */}
          <div className={`absolute inset-0 md:hidden z-[45] bg-gray-950 flex flex-col transition-transform duration-300 ${activeView === 'terminal' ? 'translate-x-0' : 'translate-x-full'}`}>
             <div className="flex bg-gray-900 border-b border-gray-700 p-1 m-2 rounded-lg">
                <button onClick={() => setTerminalTab('logs')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors ${terminalTab === 'logs' ? 'bg-gray-700 text-blue-400' : 'text-gray-500'}`}>Logs</button>
                <button onClick={() => setTerminalTab('files')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors ${terminalTab === 'files' ? 'bg-gray-700 text-green-400' : 'text-gray-500'}`}>Arquivos ({files.length})</button>
             </div>
             <div className="flex-1 overflow-hidden">
                {terminalTab === 'logs' ? <LogPanel logs={logs} /> : <FilePanel files={files} />}
             </div>
          </div>
        </main>

        {/* BOTTOM NAVIGATION - MOBILE ONLY */}
        <nav className="h-16 bg-gray-900 border-t border-gray-700 flex items-center justify-around px-2 shrink-0 z-[60] md:hidden">
          <button onClick={() => setActiveView('flow')} className={`flex flex-col items-center gap-1 transition-colors ${activeView === 'flow' ? 'text-blue-500' : 'text-gray-500'}`}>
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
             <span className="text-[10px] font-bold">Fluxo</span>
          </button>
          <button onClick={() => setActiveView('chat')} className={`flex flex-col items-center gap-1 transition-colors ${activeView === 'chat' ? 'text-blue-500' : 'text-gray-500'}`}>
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
             <span className="text-[10px] font-bold">IA Chat</span>
          </button>
          <button onClick={() => setActiveView('terminal')} className={`flex flex-col items-center gap-1 transition-colors ${activeView === 'terminal' ? 'text-blue-500' : 'text-gray-500'}`}>
             <div className="relative">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {logs.some(l => l.level === 'ERROR') && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>}
             </div>
             <span className="text-[10px] font-bold">Execução</span>
          </button>
        </nav>

        {/* SIDEBAR LOGS PARA DESKTOP */}
        <div className="hidden md:flex h-40 bg-gray-900 border-t border-gray-700 overflow-hidden">
             <div className="w-48 border-r border-gray-700 flex flex-col p-2 gap-2">
                <button onClick={() => setTerminalTab('logs')} className={`text-left px-3 py-2 text-[11px] font-bold rounded transition-colors ${terminalTab === 'logs' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>TERMINAL</button>
                <button onClick={() => setTerminalTab('files')} className={`text-left px-3 py-2 text-[11px] font-bold rounded transition-colors ${terminalTab === 'files' ? 'bg-green-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>ARQUIVOS ({files.length})</button>
             </div>
             <div className="flex-1 overflow-hidden">
                {terminalTab === 'logs' ? <LogPanel logs={logs} /> : <FilePanel files={files} />}
             </div>
        </div>

        <NodeConfigPanel node={selectedNode} isOpen={!!selectedNode} onClose={() => setSelectedNodeId(null)} onUpdate={handleUpdateNodeConfig} onDelete={handleDeleteNode} onDuplicate={() => {}} />
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        <ProjectLibraryModal isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onLoadProject={handleLoadProject} currentNodesCount={nodes.length} activeProjectId={currentProject?.id} />
      </div>
    </ReactFlowProvider>
  );
};

export default App;
