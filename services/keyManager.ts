
import { MY_API_KEYS } from '../api_keys_list';

/**
 * Gerenciador de Chaves de API (Load Balancer / Rotation)
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
    // 1. Chaves do ambiente (Vercel)
    let envKeys: string[] = [];
    try {
      const rawEnv = process.env.API_KEY || "";
      if (rawEnv && rawEnv !== "undefined" && rawEnv !== "null") {
        envKeys = rawEnv.split(/[\s,]+/).map(k => k.trim()).filter(k => k.length > 20 && k.startsWith('AIza'));
      }
    } catch (e) {}

    // 2. Chaves do arquivo físico
    const fileKeys = Array.isArray(MY_API_KEYS) 
      ? MY_API_KEYS.map(k => k.trim()).filter(k => k && k.length > 20 && k.startsWith('AIza')) 
      : [];
    
    // 3. Mescla e remove duplicatas
    this.keys = Array.from(new Set([...envKeys, ...fileKeys]));
    
    // Fallback para console caso não haja chaves
    if (this.keys.length === 0) {
      console.error("[KeyManager] CRÍTICO: Nenhuma chave API detectada!");
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
    
    let attempts = 0;
    // Pula chaves que já falharam
    while (this.failedKeys.has(this.keys[this.currentIndex]) && attempts < this.keys.length) {
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
      attempts++;
    }
    
    // Se todas falharam, retornamos a última mas o sistema já terá emitido erro
    return this.keys[this.currentIndex] || '';
  }

  public markCurrentKeyAsFailed(): boolean {
    if (this.keys.length === 0) return false;
    
    const keyToMark = this.keys[this.currentIndex];
    this.failedKeys.add(keyToMark);
    
    console.error(`[KeyManager] Chave #${this.currentIndex + 1} marcada como INVÁLIDA/BLOQUEADA.`);
    
    // Avança para a próxima
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    this.notify();
    
    // Retorna true se ainda houver chaves não testadas ou que não falharam
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
          id: key.substring(0, 8) + "...",
          isFailed: this.failedKeys.has(key),
          isActive: index === this.currentIndex
      }));
  }
}

export const keyManager = new KeyManager();
