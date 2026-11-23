import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type PairingStatus = {
  status: 'pending' | 'active' | 'suspended' | 'revoked' | 'expired';
  deviceId: string;
  grantedCapabilities: string[];
};

export type PairingResult = {
  deviceId: string;
  pairingSecret: string;
  status: 'pending';
  approvalExpiresAt: string;
};

@Injectable({ providedIn: 'root' })
export class ConnectedDevicesApiService {
  private readonly apiBase = 'https://beecore.beeprojects.net/api/connected-devices';

  constructor(private readonly http: HttpClient) {}

  async pair(token: string, deviceName: string): Promise<PairingResult> {
    return this.request<PairingResult>('/pair', {
      method: 'POST',
      body: {
        token,
        name: deviceName,
        deviceType: 'companion',
        platform: 'android',
        appVersion: '0.1.0'
      }
    });
  }

  async pairingStatus(pairingSecret: string): Promise<PairingStatus> {
    return this.request<PairingStatus>('/pairing-status', {
      method: 'GET',
      headers: new HttpHeaders({ 'x-device-pairing-secret': pairingSecret })
    });
  }

  async heartbeat(deviceCredential: string): Promise<void> {
    await this.request<{ success: boolean }>('/device/heartbeat', {
      method: 'POST',
      body: {},
      headers: new HttpHeaders({ Authorization: `Bearer ${deviceCredential}` })
    });
  }

  private async request<T>(path: string, options: {
    method: 'GET' | 'POST';
    body?: unknown;
    headers?: HttpHeaders;
  }): Promise<T> {
    try {
      return await firstValueFrom(this.http.request<T>(options.method, this.apiBase + path, {
        body: options.body,
        headers: options.headers
      }));
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const message = typeof error.error?.error === 'string' ? error.error.error : 'No se pudo conectar con Bee Core.';
        throw new Error(message);
      }
      throw error;
    }
  }
}
