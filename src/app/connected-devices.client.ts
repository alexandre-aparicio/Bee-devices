import { Injectable } from "@angular/core";

export type DeviceCapability = {
  contractVersion: 1;
  id: string;
  label: string;
  description: string;
  group: string;
  order: number;
  operations: string[];
};

type PairResult = { deviceId: string; pairingSecret: string; status: "pending"; approvalExpiresAt: string };
type PairStatus = { status: "pending" | "active"; deviceId: string; grantedCapabilities: string[]; capabilities?: DeviceCapability[] };

@Injectable({ providedIn: "root" })
export class ConnectedDevicesClient {
  private baseUrl = "https://beecore.beeprojects.net/api";
  private pairingSecret = "";
  private deviceCredential = "";
  private deviceId = "";
  capabilities: DeviceCapability[] = [];
  status: "unpaired" | "pending" | "active" = "unpaired";

  setBaseUrl(value: string): void {
    this.baseUrl = value.trim().replace(/\/+$/, "");
  }

  private async request<T>(path: string, options: { method?: string; body?: unknown; credential?: string; pairingSecret?: string } = {}): Promise<T> {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.credential) headers.Authorization = "Bearer " + options.credential;
    if (options.pairingSecret) headers["x-device-pairing-secret"] = options.pairingSecret;
    const response = await fetch(this.baseUrl + path, {
      method: options.method ?? "GET",
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error ?? "Bee Core request failed (" + response.status + ").") as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    return result as T;
  }

  async pair(qrPayload: string, deviceName: string): Promise<void> {
    const parsed = new URL(qrPayload);
    if (parsed.protocol !== "bee-device:" || parsed.hostname !== "pair") throw new Error("El QR no es un código de emparejamiento Bee.");
    const token = parsed.searchParams.get("token");
    if (!token) throw new Error("El QR no contiene el token de emparejamiento.");
    const result = await this.request<PairResult>("/connected-devices/pair", {
      method: "POST",
      body: { token, name: deviceName, deviceType: "companion", platform: "android", appVersion: "0.1.0" }
    });
    this.deviceId = result.deviceId;
    this.pairingSecret = result.pairingSecret;
    this.status = "pending";
  }

  async waitForApproval(onStatus: (status: string) => void): Promise<void> {
    if (!this.pairingSecret) throw new Error("No hay una solicitud de emparejamiento pendiente.");
    const deadline = Date.now() + 15 * 60_000;
    while (this.status === "pending" && Date.now() < deadline) {
      const result = await this.request<PairStatus>("/connected-devices/pairing-status", { pairingSecret: this.pairingSecret });
      onStatus(result.status);
      if (result.status === "active") {
        this.deviceCredential = this.pairingSecret;
        this.pairingSecret = "";
        this.status = "active";
        await this.refreshCapabilities();
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
    if (this.status === "pending") throw new Error("La solicitud de emparejamiento ha caducado.");
  }

  async refreshCapabilities(): Promise<DeviceCapability[]> {
    if (!this.deviceCredential) return [];
    try {
      const result = await this.request<{ capabilities: DeviceCapability[] }>("/connected-devices/device/capabilities", { credential: this.deviceCredential });
      this.capabilities = result.capabilities ?? [];
      return this.capabilities;
    } catch (error) {
      if ((error as { status?: number })?.status === 401 || (error as { status?: number })?.status === 403) this.clear();
      throw error;
    }
  }

  hasCapability(id: string): boolean {
    return this.status === "active" && this.capabilities.some(item => item.id === id);
  }

  async clockIn(): Promise<unknown> {
    this.requireCapability("time-tracking.clock-in");
    return this.request("/time-tracking-connected/device/clock-in", {
      method: "POST", credential: this.deviceCredential, body: { operationId: crypto.randomUUID() }
    });
  }

  async clockOut(): Promise<unknown> {
    this.requireCapability("time-tracking.clock-out");
    return this.request("/time-tracking-connected/device/clock-out", {
      method: "POST", credential: this.deviceCredential, body: { operationId: crypto.randomUUID() }
    });
  }

  async readTimeRecords(): Promise<unknown> {
    this.requireCapability("time-tracking.records.read");
    return this.request("/time-tracking-connected/device/sessions", { credential: this.deviceCredential });
  }

  async unlink(): Promise<void> {
    if (!this.deviceCredential || !this.deviceId) return;
    await this.request("/connected-devices/device/unlink", {
      method: "POST", pairingSecret: this.deviceCredential, body: { deviceId: this.deviceId }
    });
    this.clear();
  }

  clear(): void {
    this.pairingSecret = "";
    this.deviceCredential = "";
    this.deviceId = "";
    this.capabilities = [];
    this.status = "unpaired";
  }

  private requireCapability(id: string): void {
    if (!this.hasCapability(id)) throw new Error("Esta acción no está concedida a este dispositivo.");
  }
}
