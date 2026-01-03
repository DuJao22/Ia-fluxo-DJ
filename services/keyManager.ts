
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
    // 1. Chaves do arquivo físico
    const fileKeys = Array.isArray(MY_API_KEYS) 
      ? MY_API_KEYS.filter(k => k && typeof k === 'string' && k.length > 30 && !k.includes('SUA_CHAVE')) 
      : [];
    
    // 2. Chave do ambiente (Vercel) - Cuidado com "undefined" como string
    let envValue = process.env.API_KEY || '';
    if (envValue === "undefined" || envValue === "null") envValue = "";

    const envKeys = envValue.split(/[\s,]+/)
      .map(k => k.trim())
      .filter(k => k && k.length > 30 && k.startsWith("AIza"));
    
    // 3. Mescla e remove duplicatas, garantindo que só temos chaves que parecem válidas
    this.keys = Array.from(new Set([...fileKeys, ...envKeys]));
    
    console.log(`[KeyManager] Pool inicializado com ${this.keys.length} chaves potenciais.`);
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
    // Tenta encontrar uma chave que não falhou
    while (this.failedKeys.has(this.keys[this.currentIndex]) && attempts < this.keys.length) {
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
      attempts++;
    }
    
    // Se todas falharam, resetamos para não travar o app, mas avisamos
    if (attempts >= this.keys.length && this.keys.length > 0) {
        console.error("[KeyManager] CRÍTICO: Todas as chaves falharam. Tentando novamente do zero.");
        this.failedKeys.clear();
        this.currentIndex = 0;
    }
    
    return this.keys[this.currentIndex];
  }

  /**
   * Marca a chave atual como falha e move o ponteiro para a próxima
   */
  public markCurrentKeyAsFailed(): boolean {
    if (this.keys.length === 0) return false;
    
    const failedKey = this.keys[this.currentIndex];
    if (!failedKey) return false;

    this.failedKeys.add(failedKey);
    console.error(`[KeyManager] Chave #${this.currentIndex + 1} bloqueada por erro da API.`);
    
    // Move para a próxima imediatamente
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    this.notify();
    
    // Retorna true se ainda houver alguma chave que não falhou
    return this.failedKeys.size < this.keys.length;
  }

  public getStatus() {
    return JSON.stringify({
        total: this.keys.length,
        failed: this.failedKeys.size,
        current: this.currentIndex,
        healthy: this.keys.length - this.failedKeys.size
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
