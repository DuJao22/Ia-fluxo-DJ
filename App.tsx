import React, { useCallback, useState, useEffect, useRef } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  Connection,
  Edge,
  useNodesState,
  useEdgesState,
  Node,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import CustomNode from './components/CustomNode';
import AIChat from './components/AIChat';
import LogPanel from './components/LogPanel';
import FilePanel from './components/FilePanel';
import SettingsModal from './components/SettingsModal';
import ProjectLibraryModal from './components/ProjectLibraryModal'; 
import NodeConfigPanel from './components/NodeConfigPanel';
import { INITIAL_NODES, INITIAL_EDGES, APP_NAME, CREATOR_CREDIT } from './constants';
import { FlowEngine } from './services/flowEngine';
import { storageService } from './services/storageService'; 
import { FlowSchema, LogEntry, NodeStatus, GeneratedFile, FlowNode, SavedProject, NodeType } from './types';

// Custom node types registry
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

const AUTOSAVE_KEY = 'flow_architect_autosave_v1';

const App = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  // Inicializa com as conexões padrão do fluxo de exemplo
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Selection State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // UI State
  const [activeTab, setActiveTab] = useState<'editor' | 'chat'>('editor');
  const [bottomPanelTab, setBottomPanelTab] = useState<'logs' | 'files'>('logs');
  const [isLogOpen, setIsLogOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false); 
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [lastSaveTime, setLastSaveTime] = useState<string>('');
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false); // New state for Add Menu

  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ----------------------------------------------------
  // AUTO-LOAD & AUTO-SAVE
  // ----------------------------------------------------
  useEffect(() => {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Só carrega o autosave se tiver nodes válidos, senão usa o INITIAL_NODES (Demo)
        if (parsed.nodes && parsed.nodes.length > 0 && parsed.edges) {
          setNodes(parsed.nodes);
          setEdges(parsed.edges);
          if (parsed.files && Array.isArray(parsed.files)) {
            setFiles(parsed.files);
          }
          setLogs([{
            id: 'system-load',
            timestamp: new Date().toISOString(),
            nodeId: 'system',
            nodeLabel: 'System',
            level: 'INFO',
            message: 'Fluxo anterior restaurado.'
          }]);
        }
      } catch (e) {
        console.error("Erro ao carregar autosave", e);
      }
    }
    setIsLoaded(true);
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (!isLoaded) return;
    const timeoutId = setTimeout(() => {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ nodes, edges, files }));
      setLastSaveTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [nodes, edges, files, isLoaded]);

  // ----------------------------------------------------
  // NODE OPERATIONS (Manual Editing)
  // ----------------------------------------------------

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const handleUpdateNodeConfig = useCallback((nodeId: string, newConfig: any) => {
    setNodes((nds) => 
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...node.data, config: newConfig }
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  const handleAddNode = (type: NodeType, label: string) => {
    const id = `${type}-${Date.now()}`;
    const newNode: FlowNode = {
      id,
      type: 'custom',
      position: { x: 250 + (Math.random() * 50), y: 100 + (Math.random() * 50) },
      data: {
        label,
        type,
        status: NodeStatus.IDLE,
        config: {}
      }
    };
    setNodes((nds) => nds.concat(newNode));
    setIsAddMenuOpen(false);
    setSelectedNodeId(id);
    
    setLogs(prev => [...prev, {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        nodeId: 'system',
        nodeLabel: 'System',
        level: 'INFO',
        message: `Node "${label}" adicionado manualmente.`
    }]);
  };

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNodeId(null);
  }, [setNodes, setEdges]);

  const handleDuplicateNode = useCallback((nodeId: string) => {
    const nodeToClone = nodes.find(n => n.id === nodeId);
    if (!nodeToClone) return;

    const newId = `${nodeToClone.data.type}-${Date.now()}`;
    const newNode: FlowNode = {
      ...nodeToClone,
      id: newId,
      position: { x: nodeToClone.position.x + 20, y: nodeToClone.position.y + 20 },
      data: {
        ...nodeToClone.data,
        label: `${nodeToClone.data.label} (Copy)`,
        status: NodeStatus.IDLE
      },
      selected: true
    };
    
    setNodes((nds) => nds.concat(newNode));
    setSelectedNodeId(newId);
  }, [nodes, setNodes]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) as FlowNode || null;

  // ----------------------------------------------------
  // PROJECT MANAGEMENT
  // ----------------------------------------------------

  const handleSaveProject = useCallback(() => {
    const name = window.prompt("Nome do Projeto:", `Projeto ${new Date().toLocaleTimeString()}`);
    if (name) {
      storageService.saveProject(name, nodes, edges, files);
      alert("Projeto salvo com sucesso na biblioteca! (Incluindo arquivos gerados)");
    }
  }, [nodes, edges, files]);

  const handleLoadProject = useCallback((project: SavedProject) => {
    setNodes(project.nodes.map(n => ({...n, data: {...n.data, status: NodeStatus.IDLE}})));
    setEdges(project.edges);
    setFiles(project.files || []);
    setLogs([{
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        nodeId: 'system',
        nodeLabel: 'System',
        level: 'INFO',
        message: `Projeto "${project.name}" carregado com sucesso.`
    }]);
    if (project.files && project.files.length > 0) {
        setBottomPanelTab('files');
        setIsLogOpen(true);
    }
  }, [setNodes, setEdges]);

  const handleImportFlow = useCallback((flowData: FlowSchema) => {
    // Force ID regeneration if needed or handle existing layout
    const newNodes: Node[] = flowData.nodes.map((n: any) => {
      const nodeType = n.data?.type || n.type || 'custom';
      // Fallback para posição se a IA mandar 0,0
      const posX = n.position?.x || Math.random() * 400;
      const posY = n.position?.y || Math.random() * 400;
      
      return {
        id: n.id,
        type: 'custom', // Força 'custom' para usar nosso componente visual
        position: { x: posX, y: posY },
        data: { 
          ...n.data, 
          label: n.data?.label || n.type || 'Node Importado',
          type: nodeType,
          status: NodeStatus.IDLE 
        }
      };
    });

    const newEdges: Edge[] = flowData.edges.map((e: any) => ({
      id: e.id || `e-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      animated: true,
      style: { stroke: '#63b3ed' }
    }));

    setNodes(newNodes);
    setEdges(newEdges);
    setFiles([]); // Limpa arquivos do projeto anterior
    
    setLogs(prev => [
      ...prev, 
      { 
        id: Date.now().toString(), 
        timestamp: new Date().toISOString(), 
        level: 'SUCCESS', 
        message: 'Fluxo gerado por IA importado com sucesso. IDs e Posições normalizados.',
        nodeId: 'system',
        nodeLabel: 'System'
      }
    ]);

    if (isMobile) {
      setActiveTab('editor');
    }
  }, [setNodes, setEdges, isMobile]);

  const handleRunFlow = useCallback(async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    setLogs([]); 
    setIsLogOpen(true);
    setBottomPanelTab('logs');
    setNodes((nds) => nds.map(n => ({ ...n, data: { ...n.data, status: NodeStatus.IDLE } })));

    const engine = new FlowEngine(
      nodes, 
      edges, 
      setNodes, 
      (log: LogEntry) => setLogs(prev => [...prev, log]),
      (file: GeneratedFile) => setFiles(prev => [file, ...prev])
    );

    await engine.run();
    setIsExecuting(false);
  }, [nodes, edges, isExecuting, setNodes]);

  return (
    <ReactFlowProvider>
      <div className="flex h-[100dvh] w-screen overflow-hidden flex-col bg-gray-950 text-white">
        {/* HEADER */}
        <header className="h-14 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-4 shrink-0 z-50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-md"></div>
            <h1 className="font-bold text-lg tracking-tight hidden sm:block">{APP_NAME}</h1>
            <h1 className="font-bold text-lg tracking-tight sm:hidden">Flow AI</h1>
            {lastSaveTime && (
                <span className="text-[10px] text-gray-500 hidden md:block ml-2 bg-gray-800 px-2 py-0.5 rounded">
                    Salvo às {lastSaveTime}
                </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex md:hidden bg-gray-800 rounded-lg p-1 mr-2">
                <button 
                  onClick={() => setActiveTab('editor')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${activeTab === 'editor' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}
                >
                  Editor
                </button>
                <button 
                  onClick={() => setActiveTab('chat')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${activeTab === 'chat' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                >
                  IA Chat
                </button>
             </div>

             <button
                onClick={handleSaveProject}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-blue-300 text-xs font-medium rounded border border-gray-700 transition-colors"
                title="Salvar como Projeto Permanente"
             >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                Salvar
             </button>

             <button
                onClick={() => setIsLibraryOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-purple-300 text-xs font-medium rounded border border-gray-700 transition-colors"
                title="Abrir Biblioteca"
             >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                Projetos
             </button>

             <button
               onClick={() => setIsSettingsOpen(true)}
               className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
               title="Configurações"
             >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
             </button>
             
             <button 
               onClick={handleRunFlow}
               disabled={isExecuting}
               className={`${isExecuting ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white px-3 sm:px-6 py-1.5 rounded-md font-medium text-xs sm:text-sm transition-all flex items-center gap-2 shadow-lg shadow-green-900/20`}
             >
               {isExecuting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span className="hidden sm:inline">Executando...</span>
                  </>
               ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                    <span className="hidden sm:inline">Executar</span>
                    <span className="sm:hidden">Run</span>
                  </>
               )}
             </button>
          </div>
        </header>

        {/* MAIN WORKSPACE */}
        <div className="flex-1 flex overflow-hidden relative">
          
          <div className={`flex-1 relative bg-gray-900 h-full w-full ${isMobile && activeTab === 'chat' ? 'hidden' : 'block'}`} ref={reactFlowWrapper}>
            
            {/* MANUAL ADD NODE TOOLBAR */}
            <div className="absolute top-4 left-4 z-20 flex gap-2">
                 <div className="relative">
                    <button 
                        onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg transition-transform hover:scale-105 flex items-center justify-center w-10 h-10"
                        title="Adicionar Node Manualmente"
                    >
                        {isAddMenuOpen ? (
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        ) : (
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        )}
                    </button>
                    
                    {isAddMenuOpen && (
                        <div className="absolute top-12 left-0 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden animate-fade-in-up flex flex-col">
                            <div className="p-2 bg-gray-900 border-b border-gray-700 text-[10px] font-bold text-gray-400 uppercase">
                                Adicionar Node
                            </div>
                            <button onClick={() => handleAddNode(NodeType.START, 'Start Trigger')} className="px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span> Start / Gatilho
                            </button>
                            <button onClick={() => handleAddNode(NodeType.HTTP_REQUEST, 'HTTP Request')} className="px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span> HTTP Request
                            </button>
                            <button onClick={() => handleAddNode(NodeType.IF_CONDITION, 'Condicional IF')} className="px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Condição IF
                            </button>
                            <button onClick={() => handleAddNode(NodeType.DELAY, 'Delay Timer')} className="px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-500"></span> Delay / Timer
                            </button>
                            <button onClick={() => handleAddNode(NodeType.FILE_SAVE, 'Salvar Arquivo')} className="px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Salvar Arquivo
                            </button>
                            <button onClick={() => handleAddNode(NodeType.LOGGER, 'Logger')} className="px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-gray-500"></span> Logger (Debug)
                            </button>
                        </div>
                    )}
                 </div>
            </div>

            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick} 
              onPaneClick={() => setSelectedNodeId(null)}
              nodeTypes={nodeTypes}
              fitView
              proOptions={{ hideAttribution: true }}
              minZoom={0.5}
            >
              <Background color="#4a5568" gap={16} />
              <Controls className="bg-gray-800 border-gray-600 fill-white text-white" showInteractive={false} />
            </ReactFlow>
            
            <div className="absolute bottom-4 left-4 text-[10px] text-gray-500 opacity-50 pointer-events-none z-10">
              {CREATOR_CREDIT}
            </div>

            <NodeConfigPanel 
                node={selectedNode}
                isOpen={!!selectedNode}
                onClose={() => setSelectedNodeId(null)}
                onUpdate={handleUpdateNodeConfig}
                onDelete={handleDeleteNode}
                onDuplicate={handleDuplicateNode}
            />
          </div>

          <div className={`
            ${isMobile ? 'absolute inset-0 z-30 bg-gray-900' : 'relative w-96 border-l border-gray-700'}
            ${isMobile && activeTab === 'editor' ? 'hidden' : 'flex'}
            flex-col transition-all duration-300 ease-in-out
          `}>
             <AIChat 
                onImportFlow={handleImportFlow} 
                onCloseMobile={() => setActiveTab('editor')}
                isMobile={isMobile}
                logs={logs}
                nodes={nodes}
                edges={edges}
             />
          </div>
        </div>

        <div className={`${isLogOpen ? 'h-52' : 'h-9'} transition-all duration-300 shrink-0 z-50 flex flex-col bg-gray-950 border-t border-gray-700`}>
          <div className="flex items-center justify-between px-4 py-0 bg-gray-900 border-b border-gray-700 h-9 shrink-0">
            <div className="flex items-center h-full">
                <button 
                    onClick={() => { setIsLogOpen(true); setBottomPanelTab('logs'); }}
                    className={`h-full px-4 text-xs font-bold border-r border-gray-700 flex items-center gap-2 hover:bg-gray-800 transition-colors ${bottomPanelTab === 'logs' && isLogOpen ? 'text-blue-400 bg-gray-800' : 'text-gray-400'}`}
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Terminal
                    <span className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full text-[9px]">{logs.length}</span>
                </button>
                <button 
                    onClick={() => { setIsLogOpen(true); setBottomPanelTab('files'); }}
                    className={`h-full px-4 text-xs font-bold border-r border-gray-700 flex items-center gap-2 hover:bg-gray-800 transition-colors ${bottomPanelTab === 'files' && isLogOpen ? 'text-green-400 bg-gray-800' : 'text-gray-400'}`}
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Arquivos do Projeto
                    {files.length > 0 && <span className="bg-green-900 text-green-300 px-1.5 py-0.5 rounded-full text-[9px]">{files.length}</span>}
                </button>
            </div>
            
            <button onClick={() => setIsLogOpen(!isLogOpen)} className="text-gray-500 hover:text-white">
                <svg className={`w-4 h-4 transform transition-transform ${isLogOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>

          {isLogOpen && (
            <div className="flex-1 overflow-hidden relative">
                <div className={`absolute inset-0 ${bottomPanelTab === 'logs' ? 'block' : 'hidden'}`}>
                    <LogPanel logs={logs} isOpen={true} />
                </div>
                <div className={`absolute inset-0 ${bottomPanelTab === 'files' ? 'block' : 'hidden'}`}>
                    <FilePanel files={files} isOpen={true} />
                </div>
            </div>
          )}
        </div>

        <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)} 
            apiKeyPresent={!!process.env.API_KEY}
        />

        <ProjectLibraryModal
            isOpen={isLibraryOpen}
            onClose={() => setIsLibraryOpen(false)}
            onLoadProject={handleLoadProject}
            currentNodesCount={nodes.length}
        />
      </div>
    </ReactFlowProvider>
  );
};

export default App;