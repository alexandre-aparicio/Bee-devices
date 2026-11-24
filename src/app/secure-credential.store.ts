import { Injectable } from '@angular/core';
import { registerPlugin } from '@capacitor/core';

interface SecureCredentialPlugin {
  save(options: { credential: string }): Promise<void>;
  get(): Promise<{ credential: string | null }>;
  clear(): Promise<void>;
}

const SecureCredential = registerPlugin<SecureCredentialPlugin>('SecureCredential');

@Injectable({ providedIn: 'root' })
export class SecureCredentialStore {
  async save(credential: string): Promise<void> {
    if (!credential || credential.length < 40) throw new Error('La credencial del dispositivo no es válida.');
    await SecureCredential.save({ credential });
  }

  async get(): Promise<string | null> {
    const result = await SecureCredential.get();
    return result?.credential || null;
  }

  async clear(): Promise<void> {
    await SecureCredential.clear();
  }
}
