
import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
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
  style: { strokeWidth: 3, stroke: '#3b82f6' },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
};

const AUTOSAVE_KEY = 'flow_architect_autosave_v2';

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

  // MOBILE STATE
  const [activeTab, setActiveTab] = useState<'flow' | 'chat' | 'terminal'>('flow');
  const [terminalSubTab, setTerminalSubTab] = useState<'logs' | 'files'>('logs');
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false); 
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

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
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const timeoutId = setTimeout(() => {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ nodes, edges, files, currentProject }));
    }, 1500);
    return () => clearTimeout(timeoutId);
  }, [nodes, edges, files, isLoaded, currentProject]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, ...defaultEdgeOptions }, eds)),
    [setEdges]
  );

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

  const handleRunFlow = useCallback(async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    setLogs([]); 
    setActiveTab('terminal');
    setTerminalSubTab('logs');
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
    setActiveTab('flow');
  };

  return (
    <ReactFlowProvider>
      <div className="flex h-[100dvh] w-screen overflow-hidden flex-col bg-gray-950 text-white select-none pb-[env(safe-area-inset-bottom)]">
        
        {/* HEADER - COMPACTO NO MOBILE */}
        <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 shrink-0 z-[60] shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold shadow-lg shadow-blue-900/20">F</div>
            <div className="flex flex-col">
                <h1 className="font-black text-xs tracking-tighter uppercase leading-none">{APP_NAME}</h1>
                <span className="text-[9px] text-gray-500 font-mono mt-0.5 truncate max-w-[100px]">{currentProject?.name || 'Projeto Local'}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <KeyStatusPanel />
             <button 
                onClick={() => setIsLibraryOpen(true)}
                className="p-2 bg-gray-800 rounded-lg text-gray-400 hover:text-white border border-gray-700 md:flex hidden"
                title="Biblioteca"
             >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
             </button>
             <button 
                onClick={handleRunFlow} 
                disabled={isExecuting}
                className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all ${isExecuting ? 'bg-blue-900/50 animate-pulse' : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/40 active:scale-90'}`}
             >
                {isExecuting ? <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div> : <svg className="w-5 h-5 fill-white" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 001.664l-3-2z"/></svg>}
             </button>
          </div>
        </header>

        {/* ÁREA PRINCIPAL - LAYOUT ADAPTÁVEL */}
        <main className="flex-1 relative flex flex-col md:flex-row overflow-hidden bg-gray-950">
          
          {/* ABA 1: EDITOR DE FLUXO */}
          <div className={`flex-1 relative h-full transition-all duration-300 ${activeTab === 'flow' ? 'opacity-100' : 'hidden md:block opacity-0 md:opacity-100'}`}>
            <ReactFlow 
                nodes={nodes} edges={edges} 
                onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} 
                onNodeClick={(_, node) => { setSelectedNodeId(node.id); setActiveTab('flow'); }}
                onPaneClick={() => setSelectedNodeId(null)} nodeTypes={nodeTypes} defaultEdgeOptions={defaultEdgeOptions}
                fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.1} maxZoom={2} proOptions={{ hideAttribution: true }}
            >
              <Background color="#1e293b" gap={25} size={1} />
              
              <Panel position="bottom-right" className="mb-20 md:mb-4">
                 <button 
                  onClick={() => setIsAddMenuOpen(!isAddMenuOpen)} 
                  className="bg-blue-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform border-4 border-gray-950"
                 >
                    {isAddMenuOpen ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}
                 </button>
                 
                 {isAddMenuOpen && (
                    <div className="absolute bottom-16 right-0 w-48 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-mobile-up z-50 p-1">
                        {[
                          {type: NodeType.START, label: 'Gatilho Manual', color: 'bg-green-500'},
                          {type: NodeType.HTTP_REQUEST, label: 'HTTP / API', color: 'bg-blue-500'},
                          {type: NodeType.IF_CONDITION, label: 'Logica IF', color: 'bg-yellow-500'},
                          {type: NodeType.FILE_SAVE, label: 'Arquivo', color: 'bg-indigo-500'},
                        ].map(item => (
                            <button key={item.type} onClick={() => handleAddNode(item.type, item.label)} className="w-full px-4 py-3 text-left text-xs hover:bg-gray-800 flex items-center gap-3 rounded-lg transition-colors font-bold text-gray-300">
                                <span className={`w-2.5 h-2.5 rounded-full ${item.color}`}></span> {item.label}
                            </button>
                        ))}
                    </div>
                 )}
              </Panel>

              <Controls position="top-left" className="!bg-gray-900 !border-gray-800 !fill-white hidden md:flex" />
            </ReactFlow>
          </div>

          {/* ABA 2: CHAT IA (SIDEBAR NO DESKTOP, FULL NO MOBILE) */}
          <div className={`h-full border-gray-800 md:border-l md:w-[380px] shrink-0 bg-gray-950 transition-all duration-300 ${activeTab === 'chat' ? 'fixed inset-0 z-50 pt-14 pb-16 md:static md:p-0' : 'hidden md:block'}`}>
            <AIChat onImportFlow={handleLoadProject} logs={logs} nodes={nodes} edges={edges} />
          </div>

          {/* ABA 3: TERMINAL (MOBILE ONLY OVERLAY) */}
          <div className={`h-full bg-gray-950 transition-all duration-300 ${activeTab === 'terminal' ? 'fixed inset-0 z-50 pt-14 pb-16 md:hidden' : 'hidden'}`}>
             <div className="flex bg-gray-900 p-1 mx-4 mt-4 rounded-xl border border-gray-800">
                <button onClick={() => setTerminalSubTab('logs')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${terminalSubTab === 'logs' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500'}`}>Logs</button>
                <button onClick={() => setTerminalSubTab('files')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${terminalSubTab === 'files' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500'}`}>Arquivos ({files.length})</button>
             </div>
             <div className="flex-1 h-[calc(100%-80px)] overflow-hidden p-4">
                {terminalSubTab === 'logs' ? <LogPanel logs={logs} /> : <FilePanel files={files} />}
             </div>
          </div>
        </main>

        {/* BOTTOM NAV - MOBILE FIRST */}
        <nav className="h-16 bg-gray-900 border-t border-gray-800 flex items-center justify-around px-2 shrink-0 z-[60] md:hidden">
          <button onClick={() => setActiveTab('flow')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'flow' ? 'text-blue-500 scale-110' : 'text-gray-500'}`}>
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
             <span className="text-[9px] font-black uppercase tracking-tighter">Fluxo</span>
          </button>
          <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'chat' ? 'text-blue-500 scale-110' : 'text-gray-500'}`}>
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
             <span className="text-[9px] font-black uppercase tracking-tighter">IA Chat</span>
          </button>
          <button onClick={() => setActiveTab('terminal')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'terminal' ? 'text-blue-500 scale-110' : 'text-gray-500'}`}>
             <div className="relative">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {logs.some(l => l.level === 'ERROR') && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-gray-900"></span>}
             </div>
             <span className="text-[9px] font-black uppercase tracking-tighter">Terminal</span>
          </button>
          <button onClick={() => setIsLibraryOpen(true)} className="flex flex-col items-center gap-1 text-gray-500">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
             <span className="text-[9px] font-black uppercase tracking-tighter">Menu</span>
          </button>
        </nav>

        {/* TERMINAL DESKTOP */}
        <div className="hidden md:flex h-48 bg-gray-900 border-t border-gray-800">
             <div className="w-44 border-r border-gray-800 flex flex-col p-2 gap-2 bg-gray-950/50">
                <button onClick={() => setTerminalSubTab('logs')} className={`text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${terminalSubTab === 'logs' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>CONSOLE</button>
                <button onClick={() => setTerminalSubTab('files')} className={`text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${terminalSubTab === 'files' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>ARQUIVOS ({files.length})</button>
             </div>
             <div className="flex-1 overflow-hidden">
                {terminalSubTab === 'logs' ? <LogPanel logs={logs} /> : <FilePanel files={files} />}
             </div>
        </div>

        <NodeConfigPanel node={selectedNode} isOpen={!!selectedNode} onClose={() => setSelectedNodeId(null)} onUpdate={(id, cfg) => setNodes(nds => nds.map(n => n.id === id ? {...n, data: {...n.data, config: cfg}} : n))} onDelete={id => setNodes(nds => nds.filter(n => n.id !== id))} onDuplicate={() => {}} />
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        <ProjectLibraryModal isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} onLoadProject={handleLoadProject} currentNodesCount={nodes.length} activeProjectId={currentProject?.id} />
      </div>
    </ReactFlowProvider>
  );
};

export default App;
