
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
    const fileKeys = Array.isArray(MY_API_KEYS) ? MY_API_KEYS.filter(k => k && k.length > 5 && !k.includes('SUA_CHAVE')) : [];
    const envValue = process.env.API_KEY || '';
    const envKeys = envValue.split(/[\s,]+/).map(k => k.trim()).filter(k => k && k.length > 5);
    
    this.keys = Array.from(new Set([...fileKeys, ...envKeys]));
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
    while (this.failedKeys.has(this.keys[this.currentIndex]) && attempts < this.keys.length) {
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
      attempts++;
    }
    
    if (attempts >= this.keys.length && this.keys.length > 0) {
        this.failedKeys.clear();
        this.currentIndex = 0;
    }
    
    return this.keys[this.currentIndex];
  }

  public markCurrentKeyAsFailed(): boolean {
    if (this.keys.length === 0) return false;
    
    const failedKey = this.keys[this.currentIndex];
    this.failedKeys.add(failedKey);
    
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    this.notify();
    return true;
  }

  public getStatus() {
    return JSON.stringify({
        total: this.keys.length,
        failed: Array.from(this.failedKeys).length,
        current: this.currentIndex,
        healthy: this.keys.length - this.failedKeys.size
    });
  }

  // Add the missing getCurrentIndex method used in geminiService
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
