
import { MY_API_KEYS } from '../api_keys_list';

/**
 * Gerenciador de Chaves de API (Load Balancer / Rotation)
 * Otimizado para ambientes de produção (Vercel) e desenvolvimento local.
 */

type KeyListener = (status: string) => void;

class KeyManager {
  private keys: string[] = [];
  private currentIndex: number = 0;
  private failedKeys: Set<string> = new Set();
  private listeners: KeyListener[] = [];

  constructor() {
    this.loadKeys();
  }

  private loadKeys() {
    // 1. Prioridade para chaves do ambiente (Vercel Build Environment)
    // Usamos split para permitir múltiplas chaves separadas por vírgula em uma única variável
    let envKeys: string[] = [];
    try {
      const rawEnv = process.env.API_KEY || "";
      if (rawEnv && rawEnv !== "undefined" && rawEnv !== "null") {
        envKeys = rawEnv.split(/[\s,]+/).filter(k => k.length > 20 && k.startsWith('AIza'));
      }
    } catch (e) {
      console.warn("[KeyManager] Falha ao ler chaves do ambiente.");
    }

    // 2. Chaves do arquivo físico local
    const fileKeys = Array.isArray(MY_API_KEYS) 
      ? MY_API_KEYS.filter(k => k && k.length > 20 && k.startsWith('AIza')) 
      : [];
    
    // 3. Mescla e remove duplicatas
    this.keys = Array.from(new Set([...envKeys, ...fileKeys]));
    
    if (this.keys.length === 0) {
      console.error("[KeyManager] Nenhuma chave de API válida encontrada!");
    } else {
      console.log(`[KeyManager] Pool carregado com ${this.keys.length} chaves.`);
    }
    this.notify();
  }

  public subscribe(listener: KeyListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.getStatus()));
  }

  public getActiveKey(): string {
    if (this.keys.length === 0) return '';
    
    // Tenta encontrar a próxima chave saudável
    let attempts = 0;
    while (this.failedKeys.has(this.keys[this.currentIndex]) && attempts < this.keys.length) {
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
      attempts++;
    }
    
    return this.keys[this.currentIndex] || '';
  }

  /**
   * Marca a chave atual como falha e tenta rotacionar.
   * Retorna true se ainda houver chaves saudáveis no pool.
   */
  public markCurrentKeyAsFailed(): boolean {
    const keyToMark = this.keys[this.currentIndex];
    if (keyToMark) {
      this.failedKeys.add(keyToMark);
      console.error(`[KeyManager] Chave #${this.currentIndex + 1} marcada como INVÁLIDA ou ESGOTADA.`);
    }

    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    this.notify();
    
    return this.failedKeys.size < this.keys.length;
  }

  public getStatus() {
    return JSON.stringify({
        total: this.keys.length,
        failed: this.failedKeys.size,
        current: this.currentIndex,
        healthy: Math.max(0, this.keys.length - this.failedKeys.size)
    });
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public reset() {
    this.failedKeys.clear();
    this.currentIndex = 0;
    this.notify();
  }

  public getAllKeysStatus() {
      return this.keys.map((key, index) => ({
          index,
          id: key.substring(0, 10) + "...",
          isFailed: this.failedKeys.has(key),
          isActive: index === this.currentIndex
      }));
  }
}

export const keyManager = new KeyManager();
