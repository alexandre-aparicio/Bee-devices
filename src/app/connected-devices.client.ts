import { Injectable } from "@angular/core";

export type ConnectorPermission = { pluginId: string; key: string; module: string; resource: string; action: string; label: string };

export type DeviceProfile = {
  id: string;
  name: string;
  deviceType: string;
  platform: string;
  status: string;
  grantedCapabilities: string[];
  lastSeenAt?: string | null;
};

type PairResult = {
  deviceId: string;
  pairingSecret: string;
  status: "pending";
  approvalExpiresAt: string;
  availablePermissions?: ConnectorPermission[];
  requestedPermissions?: string[];
};

type PairStatus = {
  status: "pending" | "active" | "suspended" | "revoked" | "unlinked" | "expired";
  deviceId: string;
  grantedCapabilities: string[];
  grantedPermissions?: string[];
  availablePermissions?: ConnectorPermission[];
};

type DeviceMeResult = { device: DeviceProfile; availablePermissions?: ConnectorPermission[] };

@Injectable({ providedIn: "root" })
export class ConnectedDevicesClient {
  readonly defaultBaseUrl = "https://beecore.beeprojects.net/api";
  private baseUrl = this.defaultBaseUrl;
  private credential = "";
  private deviceId = "";

  status: "unpaired" | "pending" | "active" = "unpaired";
  device: DeviceProfile | null = null;
  capabilities: string[] = [];
  permissions: ConnectorPermission[] = [];

  setBaseUrl(value: string): void {
    const parsed = new URL(value.trim());
    if (!["https:", "http:"].includes(parsed.protocol)) {
      throw new Error("La dirección del servidor debe usar HTTPS (o HTTP en desarrollo).");
    }
    if (parsed.protocol === "http:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
      throw new Error("Por seguridad, Bee Core debe conectarse mediante HTTPS.");
    }
    this.baseUrl = parsed.toString().replace(/\/+$/, "");
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown; credential?: string; pairingSecret?: string } = {}
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.credential) headers["Authorization"] = "Bearer " + options.credential;
    if (options.pairingSecret) headers["x-device-pairing-secret"] = options.pairingSecret;

    const method = options.method ?? "GET";
    const startedAt = Date.now();
    console.info("[BEE-HTTP]", new Date().toISOString(), "REQUEST START", {
      method,
      path,
      hasBody: options.body !== undefined,
      hasCredential: !!options.credential,
      hasPairingSecret: !!options.pairingSecret
    });

    let response: Response;
    try {
      response = await fetch(this.baseUrl + path, {
        method,
        headers,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
      });
    } catch (error) {
      console.error("[BEE-HTTP]", new Date().toISOString(), "NETWORK ERROR", {
        method, path, elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? { name: error.name, message: error.message } : String(error)
      });
      throw new Error("No se pudo conectar con Bee Core. Comprueba Internet y la dirección del servidor.");
    }

    console.info("[BEE-HTTP]", new Date().toISOString(), "RESPONSE RECEIVED", {
      method, path, status: response.status, ok: response.ok,
      elapsedMs: Date.now() - startedAt
    });

    const payload = await response.json().catch(error => {
      console.warn("[BEE-HTTP]", new Date().toISOString(), "RESPONSE JSON PARSE FAILED", {
        method, path, error: error instanceof Error ? error.message : String(error)
      });
      return {} as Record<string, unknown>;
    });
    if (!response.ok) {
      const message = typeof payload.error === "string"
        ? payload.error
        : "Bee Core respondió con el código " + response.status + ".";
      console.error("[BEE-HTTP]", new Date().toISOString(), "HTTP ERROR", {
        method, path, status: response.status, message
      });
      const error = new Error(message) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    console.info("[BEE-HTTP]", new Date().toISOString(), "REQUEST RESOLVED", {
      method, path, elapsedMs: Date.now() - startedAt
    });
    return payload as T;
  }

  async pair(qrPayload: string, deviceName: string): Promise<void> {
    console.info("[BEE-PAIR]", new Date().toISOString(), "CLIENT pair ENTER", {
      qrLength: qrPayload.length,
      deviceName
    });
    let parsed: URL;
    try {
      parsed = new URL(qrPayload);
    } catch {
      throw new Error("El contenido del QR no es una dirección de emparejamiento válida.");
    }
    if (parsed.protocol !== "bee-device:" || parsed.hostname !== "pair") {
      throw new Error("Este QR no pertenece al sistema de emparejamiento de Bee.");
    }
    const token = parsed.searchParams.get("token");
    if (!token) throw new Error("El QR no contiene el token de emparejamiento.");

    console.info("[BEE-PAIR]", new Date().toISOString(), "CLIENT QR VALIDATED", {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      hasToken: !!token
    });
    const result = await this.request<PairResult>("/connected-devices/pair", {
      method: "POST",
      body: {
        token,
        name: deviceName.trim() || "Bee Android",
        deviceType: "companion",
        platform: "android",
        appVersion: "1.0.0"
      }
    });

    this.deviceId = result.deviceId;
    this.credential = result.pairingSecret;
    this.status = "pending";
    this.device = null;
    this.capabilities = [];
    this.setPermissions(result.availablePermissions ?? []);
    console.info("[BEE-PAIR]", new Date().toISOString(), "CLIENT pair STATE UPDATED", {
      deviceId: this.deviceId,
      status: this.status
    });
  }

  async waitForApproval(onStatus: (status: "pending" | "active") => void): Promise<void> {
    console.info("[BEE-PAIR]", new Date().toISOString(), "CLIENT waitForApproval ENTER", {
      hasCredential: !!this.credential,
      status: this.status
    });
    if (!this.credential) throw new Error("No existe una solicitud de emparejamiento pendiente.");
    const deadline = Date.now() + 15 * 60_000;

    while (this.status === "pending" && Date.now() < deadline) {
      let result: PairStatus;
      try {
        result = await this.request<PairStatus>("/connected-devices/pairing-status", {
          pairingSecret: this.credential
        });
        this.setPermissions(result.availablePermissions ?? []);
      } catch (error) {
        const status = (error as { status?: number })?.status;
        if (status === 401 || status === 403 || status === 404) {
          this.clear();
          throw error;
        }
        onStatus("pending");
        await new Promise(resolve => setTimeout(resolve, 4000));
        continue;
      }

      if (result.status === "active") {
        this.status = "active";
        onStatus("active");
        await this.refreshDevice();
        return;
      }

      if (result.status !== "pending") {
        this.clear();
        throw new Error("Bee Core ha cerrado o revocado la solicitud de emparejamiento.");
      }

      onStatus("pending");
      await new Promise(resolve => setTimeout(resolve, 4000));
    }

    if (this.status === "pending") {
      this.clear();
      throw new Error("La solicitud ha superado los 15 minutos. Genera un nuevo QR en Bee Core.");
    }
  }

  async refreshDevice(): Promise<DeviceProfile> {
    if (!this.credential) throw new Error("El dispositivo no tiene una credencial activa.");
    try {
      const result = await this.request<DeviceMeResult>("/connected-devices/device/me", {
        credential: this.credential
      });
      if (!result.device || result.device.status !== "active") {
        this.clear();
        throw new Error("Bee Core ya no considera activo este dispositivo.");
      }
      this.device = result.device;
      this.deviceId = result.device.id;
      this.setPermissions(result.availablePermissions ?? []);
      this.capabilities = Array.isArray(result.device.grantedCapabilities)
        ? result.device.grantedCapabilities
        : [];
      this.status = "active";
      return result.device;
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 403 || status === 404) this.clear();
      throw error;
    }
  }

  async heartbeat(): Promise<void> {
    if (!this.credential || this.status !== "active") return;
    try {
      await this.request("/connected-devices/device/heartbeat", {
        method: "POST",
        credential: this.credential,
        body: {}
      });
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 403 || status === 404) this.clear();
      throw error;
    }
  }

  async unlink(): Promise<void> {
    if (!this.credential || !this.deviceId) return;
    await this.request("/connected-devices/device/unlink", {
      method: "POST",
      pairingSecret: this.credential,
      body: { deviceId: this.deviceId }
    });
    this.clear();
  }

  private setPermissions(permissions: ConnectorPermission[]): void {
    this.permissions = Array.isArray(permissions) ? permissions.filter(item => !!item?.key && !!item?.label) : [];
  }

  permissionLabel(key: string): string {
    return this.permissions.find(permission => permission.key === key)?.label ?? key;
  }

  clear(): void {
    this.credential = "";
    this.deviceId = "";
    this.device = null;
    this.capabilities = [];
    this.permissions = [];
    this.status = "unpaired";
  }
}
