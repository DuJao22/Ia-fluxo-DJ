import { SavedProject, FlowNode, FlowEdge, GeneratedFile } from '../types';

const STORAGE_KEY = 'flow_architect_projects_v1';
const API_KEY_STORAGE_KEY = 'flow_architect_user_api_key_v1';

export const storageService = {
  getProjects: (): SavedProject[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Erro ao ler projetos:", e);
      return [];
    }
  },

  saveProject: (name: string, nodes: FlowNode[], edges: FlowEdge[], files: GeneratedFile[]): SavedProject => {
    const projects = storageService.getProjects();
    
    const newProject: SavedProject = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nodes,
      edges,
      files
    };

    const updatedProjects = [newProject, ...projects];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProjects));
    return newProject;
  },

  deleteProject: (id: string): void => {
    const projects = storageService.getProjects();
    const filtered = projects.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },

  updateProject: (id: string, nodes: FlowNode[], edges: FlowEdge[], files: GeneratedFile[]): void => {
    const projects = storageService.getProjects();
    const index = projects.findIndex(p => p.id === id);
    
    if (index !== -1) {
      projects[index] = {
        ...projects[index],
        nodes,
        edges,
        files,
        updatedAt: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    }
  },

  // --- API KEY MANAGEMENT ---
  saveApiKey: (key: string): void => {
    localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
  },

  getApiKey: (): string | null => {
    return localStorage.getItem(API_KEY_STORAGE_KEY);
  },

  removeApiKey: (): void => {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  }
};