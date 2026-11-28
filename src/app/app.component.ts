import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { BarcodeFormat, BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";
import { App } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { ConnectedDevicesClient } from "./connected-devices.client";

@Component({
  selector: "bee-root",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark"><span></span><span></span><span></span></div>
          <div class="brand-copy"><span>BEE PROJECTS</span><strong>Devices</strong></div>
        </div>
        <div class="connection-state" [class.connected]="client.status === 'active'" [class.waiting]="client.status === 'pending'">
          <i></i>{{ statusLabel }}
        </div>
      </header>

      <main class="content">
        <section class="welcome">
          <div class="welcome-copy">
            <div class="eyebrow"><span class="eyebrow-line"></span> COMPANION APP</div>
            <h1>Todo conectado.<br><em>Todo bajo control.</em></h1>
            <p>Vincula este dispositivo con tu espacio de trabajo Bee Core y accede solo a las funciones que tu empresa autorice.</p>
            <button class="primary-button" type="button" (click)="scanAndPair()" [disabled]="busy || client.status !== 'unpaired'">
              <span class="button-icon">⌗</span>
              {{ busy ? 'Conectando…' : 'Escanear código QR' }}
              <span class="button-arrow">↗</span>
            </button>
            <div class="secure-note"><span class="lock-icon">⌑</span> Conexión cifrada · Permisos gestionados por tu empresa</div>
          </div>
          <div class="hero-art" aria-hidden="true">
            <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
            <div class="device-card">
              <div class="device-top"><span class="device-speaker"></span><span class="device-camera"></span></div>
              <div class="device-screen">
                <div class="screen-logo"><span class="mini-bee">✳</span> bee</div>
                <div class="screen-status"><span></span> READY TO CONNECT</div>
                <div class="screen-qr"><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b></div>
                <div class="screen-caption">Your device<br>your workspace</div>
              </div>
              <div class="device-bottom"></div>
            </div>
            <div class="floating-dot dot-a"></div><div class="floating-dot dot-b"></div>
            <div class="floating-label"><span>✦</span> Secure pairing</div>
          </div>
        </section>

        <section class="workspace-grid">
          <article class="panel setup-panel">
            <div class="panel-heading">
              <div><span class="step-label">01 / CONFIGURACIÓN</span><h2>Prepara tu dispositivo</h2></div>
              <span class="panel-icon">⚙</span>
            </div>
            <label class="field-label" for="device-name">Nombre del dispositivo</label>
            <input id="device-name" class="text-field" [(ngModel)]="deviceName" maxlength="80" placeholder="Ej. Almacén · Terminal 01">
            <div class="field-help">Este nombre aparecerá en el panel de dispositivos de tu empresa.</div>
            <button class="settings-toggle" type="button" (click)="showSettings = !showSettings">
              <span>Servidor Bee Core</span><span>{{ showSettings ? '−' : '+' }}</span>
            </button>
            <div class="server-settings" *ngIf="showSettings">
              <label class="field-label" for="server-url">Dirección API</label>
              <input id="server-url" class="text-field" [(ngModel)]="apiUrl" (change)="saveServer()" autocomplete="url" spellcheck="false">
              <div class="field-help">Servidor predeterminado: beecore.beeprojects.net</div>
            </div>
            <div class="server-indicator"><span class="server-dot"></span><span>{{ serverLabel }}</span></div>
          </article>

          <article class="panel status-panel">
            <div class="panel-heading">
              <div><span class="step-label">02 / ESTADO</span><h2>Tu conexión</h2></div>
              <span class="panel-icon">⌁</span>
            </div>
            <div class="status-content" *ngIf="client.status === 'unpaired'">
              <div class="status-illustration idle"><span>⌁</span></div>
              <div><strong>Listo para vincular</strong><p>Escanea el QR que has generado en Bee Core para iniciar la conexión.</p></div>
            </div>
            <div class="status-content" *ngIf="client.status === 'pending'">
              <div class="status-illustration pending"><span>◷</span></div>
              <div><strong>Esperando aprobación</strong><p>Confirma la solicitud desde Bee Core. Esta pantalla se actualizará automáticamente.</p></div>
            </div>
            <div class="status-content" *ngIf="client.status === 'active'">
              <div class="status-illustration active"><span>✓</span></div>
              <div><strong>Dispositivo emparejado</strong><p>{{ client.device?.name || deviceName }} está conectado a Bee Core.</p></div>
            </div>
            <div class="status-actions" *ngIf="client.status === 'active'">
              <button class="secondary-button" type="button" (click)="refresh()" [disabled]="busy">Actualizar estado</button>
              <button class="text-button danger" type="button" (click)="unlink()" [disabled]="busy">Desvincular</button>
            </div>
          </article>
        </section>

        <section class="panel capabilities-panel" *ngIf="client.status === 'active'">
          <div class="panel-heading">
            <div><span class="step-label">03 / AUTORIZACIONES</span><h2>Permisos autorizados</h2></div>
            <span class="permission-count">{{ client.capabilities.length }} {{ client.capabilities.length === 1 ? 'permiso' : 'permisos' }}</span>
          </div>
          <p class="section-description">Estas son las capacidades que Bee Core ha autorizado expresamente para este dispositivo. No se pueden ampliar desde la aplicación.</p>
          <div class="capability-list" *ngIf="client.capabilities.length; else noCapabilities">
            <span class="capability-badge" *ngFor="let capability of client.capabilities"><span>✓</span>{{ capabilityLabel(capability) }}</span>
          </div>
          <ng-template #noCapabilities>
            <div class="empty-capabilities"><span>⌑</span><div><strong>Aún no hay permisos asignados</strong><p>El dispositivo está emparejado. Un administrador puede conceder capacidades desde Bee Core.</p></div></div>
          </ng-template>
          <div class="device-meta" *ngIf="client.device">
            <span>Dispositivo ID <code>{{ client.device.id }}</code></span>
            <span>Plataforma <strong>{{ client.device.platform || 'Android' }}</strong></span>
          </div>
        </section>

        <div class="feedback error-feedback" *ngIf="error" role="alert">
          <span>!</span><div><strong>No se pudo completar la operación</strong><p>{{ error }}</p></div>
          <button type="button" (click)="error = ''" aria-label="Cerrar">×</button>
        </div>
        <div class="feedback success-feedback" *ngIf="message" role="status">
          <span>✓</span><p>{{ message }}</p>
          <button type="button" (click)="message = ''" aria-label="Cerrar">×</button>
        </div>

        <footer class="footer">
          <div class="footer-brand"><span class="footer-bee">✳</span> BEE PROJECTS</div>
          <span>Un dispositivo. Los permisos justos. <b>© 2026</b></span>
        </footer>
      </main>
    </div>
  `,
  styles: [`
    :host { display:block; min-height:100vh; }
    .app-shell { min-height:100vh; }
    .topbar { height:78px; padding:0 clamp(22px,6vw,92px); display:flex; align-items:center; justify-content:space-between; background:#11142b; color:#fff; }
    .brand { display:flex; align-items:center; gap:12px; }
    .brand-mark { width:34px; height:34px; border-radius:11px; background:linear-gradient(145deg,#8b83ff,#5149e8); display:flex; align-items:center; justify-content:center; gap:2px; transform:rotate(-8deg); }
    .brand-mark span { width:4px; height:13px; border-radius:5px; background:#fff; display:block; }
    .brand-mark span:nth-child(2) { height:19px; }.brand-mark span:nth-child(3) { height:10px; }
    .brand-copy { display:flex; flex-direction:column; gap:1px; }.brand-copy span { font-size:9px; letter-spacing:2px; color:#9da1bd; font-weight:800; }.brand-copy strong { font-size:18px; letter-spacing:-.4px; }
    .connection-state { display:flex; align-items:center; gap:9px; border:1px solid #343853; border-radius:30px; padding:9px 14px; color:#c2c5d6; font-size:12px; font-weight:650; }
    .connection-state i { width:7px; height:7px; border-radius:50%; background:#969bb1; }
    .connection-state.connected i { background:#35d8b8; box-shadow:0 0 0 4px #35d8b822; }.connection-state.waiting i { background:#f4bd58; }
    .content { width:min(1120px, calc(100% - 44px)); margin:0 auto; }
    .welcome { margin:40px 0 26px; min-height:340px; border-radius:25px; padding:44px 54px; overflow:hidden; position:relative; background:linear-gradient(115deg,#22264b 0%,#292d59 53%,#514be0 100%); color:#fff; display:flex; align-items:center; }
    .welcome-copy { position:relative; z-index:2; width:60%; max-width:620px; }.eyebrow,.step-label { font-size:10px; letter-spacing:1.9px; font-weight:850; color:#aeb0ff; }.eyebrow { display:flex; align-items:center; gap:9px; }.eyebrow-line { display:inline-block; width:24px; height:2px; background:#42ddc7; }
    h1 { margin:19px 0 14px; font-size:clamp(34px,4.2vw,53px); line-height:1.08; letter-spacing:-2.3px; font-weight:780; }h1 em { font-style:normal; color:#8ee9dc; }
    .welcome-copy>p { max-width:480px; color:#c5c8df; font-size:14px; line-height:1.75; margin:0 0 23px; }
    .primary-button { height:51px; padding:0 18px; border:0; border-radius:13px; background:#fff; color:#292d63; font-weight:800; display:inline-flex; align-items:center; gap:12px; cursor:pointer; box-shadow:0 8px 22px #11142b33; transition:transform .18s,box-shadow .18s; }.primary-button:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 12px 25px #11142b44; }.primary-button:disabled { opacity:.55; cursor:not-allowed; }.button-icon { font-size:24px; line-height:0; color:#625bf6; }.button-arrow { font-size:18px; margin-left:7px; color:#625bf6; }
    .secure-note { margin-top:17px; color:#aeb3d0; font-size:10px; letter-spacing:.2px; }.lock-icon { color:#5ce0cb; margin-right:6px; font-size:15px; }
    .hero-art { position:absolute; width:390px; height:330px; right:22px; top:4px; }.orbit { position:absolute; border:1px solid #ffffff20; border-radius:50%; transform:rotate(-25deg); }.orbit-one { width:310px; height:180px; top:70px; left:45px; }.orbit-two { width:390px; height:240px; top:38px; left:6px; }
    .device-card { position:absolute; width:137px; height:248px; top:43px; left:142px; padding:8px; border-radius:24px; background:linear-gradient(130deg,#d9d9e7,#777b9e 30%,#222642 55%,#aeb1c8); transform:rotate(9deg); box-shadow:0 28px 50px #10132f80; }.device-top { height:13px; display:flex; justify-content:center; align-items:center; gap:6px; }.device-speaker { width:23px; height:3px; background:#272a42; border-radius:5px; }.device-camera { width:4px; height:4px; background:#292d4b; border-radius:50%; }.device-screen { height:207px; border-radius:16px; background:linear-gradient(160deg,#171a35,#252b55); padding:15px 10px; text-align:center; color:#fff; }.screen-logo { font-size:14px; font-weight:800; letter-spacing:.5px; }.mini-bee { color:#4ce0ca; margin-right:4px; }.screen-status { margin-top:15px; font-size:6px; letter-spacing:1px; color:#8de5d9; }.screen-status span { display:inline-block; width:4px; height:4px; border-radius:50%; background:#42d7bb; margin:0 4px 1px 0; }.screen-qr { margin:13px auto 10px; width:66px; height:66px; padding:7px; background:#fff; display:grid; grid-template-columns:repeat(3,1fr); gap:3px; border-radius:5px; }.screen-qr b { background:#282d51; border-radius:1px; }.screen-qr b:nth-child(2n),.screen-qr b:nth-child(5) { background:#fff; border:2px solid #282d51; }.screen-caption { font-size:8px; line-height:1.45; color:#b9c0df; }.device-bottom { height:5px; width:35px; margin:5px auto 0; background:#333750; border-radius:8px; }
    .floating-dot { position:absolute; border-radius:50%; background:#4be0c9; box-shadow:0 0 20px #4be0c955; }.dot-a { width:10px; height:10px; top:64px; right:68px; }.dot-b { width:6px; height:6px; bottom:54px; left:64px; background:#aaa4ff; }.floating-label { position:absolute; right:4px; bottom:47px; background:#fff; color:#3b3e72; border-radius:10px; padding:10px 13px; font-size:10px; font-weight:800; box-shadow:0 9px 25px #10132f44; }.floating-label span { color:#625bf6; margin-right:5px; }
    .workspace-grid { display:grid; grid-template-columns:1fr 1fr; gap:22px; }.panel { background:#fff; border:1px solid #eceef5; border-radius:19px; padding:25px 27px; box-shadow:0 5px 20px #25294b06; }.panel-heading { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:22px; }.step-label { color:#8a8fa8; font-size:9px; }.panel h2 { margin:7px 0 0; font-size:19px; letter-spacing:-.55px; color:#252943; }.panel-icon { width:35px; height:35px; border-radius:11px; background:#f0efff; color:#625bf6; display:grid; place-items:center; font-size:18px; }.field-label { display:block; font-size:11px; font-weight:800; color:#535a75; margin:0 0 8px; }.text-field { width:100%; height:45px; border:1px solid #e4e6f0; border-radius:10px; outline:none; padding:0 13px; color:#252943; background:#fbfbfe; font-size:13px; transition:border .15s,box-shadow .15s; }.text-field:focus { border-color:#7770fa; box-shadow:0 0 0 3px #625bf618; }.text-field::placeholder { color:#a5a9ba; }.field-help { margin-top:7px; color:#9398ad; font-size:10px; line-height:1.5; }.settings-toggle { margin-top:19px; width:100%; border:0; border-top:1px solid #eff0f5; padding:14px 0 8px; display:flex; justify-content:space-between; color:#515772; font-size:11px; font-weight:750; background:none; cursor:pointer; }.settings-toggle span:last-child { color:#625bf6; font-size:17px; }.server-settings { padding-top:10px; }.server-indicator { display:flex; align-items:center; gap:8px; margin-top:15px; color:#7e849d; font-size:10px; }.server-dot { width:6px; height:6px; border-radius:50%; background:#35c9a9; }
    .status-content { display:flex; gap:15px; align-items:center; min-height:116px; }.status-illustration { width:58px; height:58px; flex:0 0 58px; border-radius:17px; display:grid; place-items:center; font-size:27px; }.status-illustration.idle { color:#7770ed; background:#f0efff; }.status-illustration.pending { color:#c58b2a; background:#fff6e6; }.status-illustration.active { color:#1eaa8e; background:#e9fbf6; }.status-content strong { display:block; color:#303550; font-size:13px; }.status-content p { margin:6px 0 0; color:#858ba1; font-size:11px; line-height:1.6; }.status-actions { display:flex; align-items:center; gap:14px; border-top:1px solid #eff0f5; padding-top:15px; }.secondary-button { background:#f0efff; border:0; color:#5c55e9; padding:10px 13px; border-radius:9px; font-size:10px; font-weight:800; cursor:pointer; }.secondary-button:disabled,.text-button:disabled { opacity:.5; cursor:not-allowed; }.text-button { border:0; background:none; font-size:10px; font-weight:800; cursor:pointer; }.danger { color:#d35e70; }
    .capabilities-panel { margin-top:22px; }.capabilities-panel .panel-heading { margin-bottom:9px; }.permission-count { border-radius:20px; background:#eafaf6; color:#1c9b82; padding:7px 11px; font-size:10px; font-weight:850; }.section-description { color:#8389a0; font-size:11px; line-height:1.65; margin:0 0 17px; }.capability-list { display:flex; flex-wrap:wrap; gap:9px; }.capability-badge { display:inline-flex; align-items:center; gap:7px; border:1px solid #ccefe5; background:#effbf7; color:#237e6d; border-radius:999px; padding:9px 13px; font-size:11px; font-weight:800; }.capability-badge span { width:17px; height:17px; border-radius:50%; display:grid; place-items:center; background:#d6f5e9; color:#169a7e; font-size:10px; }.empty-capabilities { display:flex; align-items:center; gap:14px; padding:18px; border-radius:12px; background:#f8f8fc; }.empty-capabilities>span { width:38px; height:38px; flex:0 0 38px; display:grid; place-items:center; border-radius:12px; color:#7770ed; background:#eeedff; font-size:21px; }.empty-capabilities strong { color:#434963; font-size:11px; }.empty-capabilities p { margin:5px 0 0; color:#8b90a5; font-size:10px; line-height:1.5; }.device-meta { border-top:1px solid #eff0f5; padding-top:13px; margin-top:18px; display:flex; gap:22px; flex-wrap:wrap; color:#8c91a6; font-size:10px; }.device-meta code { color:#656b85; }.device-meta strong { color:#555b75; }
    .feedback { margin-top:17px; padding:13px 15px; border-radius:12px; display:flex; align-items:flex-start; gap:11px; }.feedback>span { width:21px; height:21px; flex:0 0 21px; display:grid; place-items:center; border-radius:50%; font-weight:900; font-size:12px; }.feedback>div { flex:1; }.feedback strong { font-size:11px; }.feedback p { margin:3px 0 0; font-size:11px; line-height:1.5; }.feedback button { border:0; background:none; font-size:19px; cursor:pointer; }.error-feedback { background:#fff0f1; color:#a93e50; }.error-feedback>span { background:#fbdde1; }.success-feedback { background:#eafaf5; color:#218b76; }.success-feedback>span { background:#d2f5e9; }.success-feedback p { flex:1; }
    .footer { margin:29px 0 20px; padding:18px 2px; border-top:1px solid #e7e9f1; display:flex; justify-content:space-between; gap:10px; color:#969bb0; font-size:10px; }.footer-brand { color:#626984; letter-spacing:1.5px; font-size:9px; font-weight:900; }.footer-bee { color:#625bf6; font-size:15px; margin-right:5px; }.footer b { color:#7b8199; font-weight:700; }
    @media (max-width:760px) { .topbar { height:68px; padding:0 20px; }.content { width:calc(100% - 28px); }.welcome { margin:17px 0 15px; min-height:0; padding:30px 24px 32px; border-radius:19px; }.welcome-copy { width:100%; }.welcome-copy>p { max-width:95%; font-size:12px; }.hero-art { opacity:.18; right:-142px; top:18px; transform:scale(.88); transform-origin:top right; }.welcome h1 { font-size:37px; }.secure-note { font-size:9px; }.workspace-grid { grid-template-columns:1fr; gap:13px; }.panel { padding:21px 20px; }.panel h2 { font-size:17px; }.capabilities-panel { margin-top:14px; }.capability-list { grid-template-columns:1fr; }.footer { margin-top:22px; flex-direction:column; }.connection-state { padding:8px 10px; font-size:10px; } }
    @media (prefers-reduced-motion: reduce) { *,*::before,*::after { scroll-behavior:auto!important; transition:none!important; animation:none!important; } }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  apiUrl = "";
  deviceName = "Bee Android";
  busy = false;
  error = "";
  message = "";
  showSettings = false;
  private appStateListener?: PluginListenerHandle;
  private destroyed = false;
  private approvalPolling = false;

  constructor(readonly client: ConnectedDevicesClient) {
    this.apiUrl = client.getBaseUrl();
  }

  get statusLabel(): string {
    if (this.client.status === "active") return "EMPAREJADO";
    if (this.client.status === "pending") return "Pendiente";
    return "Sin vincular";
  }

  get serverLabel(): string {
    try { return new URL(this.client.getBaseUrl()).host; }
    catch { return "Servidor no válido"; }
  }

  ngOnInit(): void {
    void this.restoreDeviceSession();
    void App.addListener("appStateChange", ({ isActive }) => {
      this.debugScan("APP STATE CHANGE", {
        isActive,
        busy: this.busy,
        status: this.client.status
      });
      if (isActive) void this.restoreDeviceSession();
    }).then(listener => {
      if (this.destroyed) void listener.remove();
      else this.appStateListener = listener;
    }).catch(() => undefined);
  }

  private async restoreDeviceSession(): Promise<void> {
    try {
      const status = await this.client.restoreSession();
      this.debugScan("SESSION RESTORED", { status });
      if (status === "pending" && !this.busy) void this.resumeApprovalPolling();
      if (status === "active") {
        await this.client.heartbeat();
        this.message = "Dispositivo emparejado. Estado y permisos recuperados desde Bee Core.";
      }
    } catch (error) {
      this.debugScan("SESSION RESTORE ERROR", this.safeError(error));
      this.error = error instanceof Error ? error.message : "No se pudo recuperar la sesión del dispositivo.";
    }
  }

  private async resumeApprovalPolling(): Promise<void> {
    if (this.approvalPolling || this.client.status !== "pending") return;
    this.approvalPolling = true;
    try {
      await this.client.waitForApproval(status => {
        this.debugScan("RESTORED APPROVAL STATUS", status);
        this.message = status === "active" ? "Dispositivo emparejado. Permisos autorizados recibidos." : "Solicitud pendiente de autorización en Bee Core.";
      });
      if (this.client.status === "active") this.message = "Dispositivo emparejado correctamente.";
    } catch (error) {
      this.error = error instanceof Error ? error.message : "No se pudo confirmar la autorización del dispositivo.";
    } finally { this.approvalPolling = false; }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    void this.appStateListener?.remove();
  }

  saveServer(): void {
    try {
      this.client.setBaseUrl(this.apiUrl);
      this.apiUrl = this.client.getBaseUrl();
      this.error = "";
      this.message = "Servidor actualizado.";
    } catch (error) {
      this.error = error instanceof Error ? error.message : "La dirección del servidor no es válida.";
    }
  }

  private safeError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        status: (error as Error & { status?: number }).status
      };
    }
    return { value: String(error) };
  }

  private debugScan(stage: string, detail?: unknown): void {
    console.info("[BEE-PAIR]", new Date().toISOString(), stage, detail ?? "");
  }

  async scanAndPair(): Promise<void> {
    this.busy = true;
    this.error = "";
    this.message = "";
    this.debugScan("01 scanAndPair ENTER", {
      baseUrl: this.apiUrl,
      deviceName: this.deviceName,
      status: this.client.status
    });

    try {
      this.client.setBaseUrl(this.apiUrl);
      this.debugScan("02 baseUrl configured", this.client.getBaseUrl());

      this.message = "Comprobando e iniciando el lector QR…";
      this.debugScan("03 isSupported START");
      const support = await BarcodeScanner.isSupported();
      this.debugScan("04 isSupported RESULT", support);
      if (!support.supported) throw new Error("Este dispositivo no dispone de un escáner compatible.");

      this.debugScan("05 moduleAvailable START");
      const module = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      this.debugScan("06 moduleAvailable RESULT", module);
      if (!module.available) {
        this.message = "El lector QR de Google no está instalado. Estamos solicitando su instalación…";
        this.debugScan("07 installModule START");
        await BarcodeScanner.installGoogleBarcodeScannerModule();
        this.debugScan("08 installModule RESOLVED");
        this.message = "Instalación del lector solicitada. Espera a que Google Play Services termine y vuelve a pulsar «Escanear código QR».";
        return;
      }

      this.message = "Abriendo la cámara…";
      this.debugScan("09 scan START");
      const scan = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
      this.debugScan("10 scan RESULT", {
        barcodeCount: scan.barcodes?.length ?? 0,
        hasRawValue: !!scan.barcodes?.[0]?.rawValue,
        rawValueLength: scan.barcodes?.[0]?.rawValue?.length ?? 0
      });

      const qr = scan.barcodes[0]?.rawValue;
      if (!qr) throw new Error("No se ha leído ningún código QR.");

      this.debugScan("11 pair START", { qrLength: qr.length, deviceName: this.deviceName });
      await this.client.pair(qr, this.deviceName);
      this.debugScan("12 pair RESOLVED", { status: this.client.status });

      this.message = "Solicitud enviada. Aprueba el dispositivo desde Bee Core.";
      this.debugScan("13 waitForApproval START");
      await this.client.waitForApproval(status => {
        this.debugScan("14 approval STATUS", status);
        this.message = status === "active"
          ? "Dispositivo aprobado. Cargando las capacidades autorizadas…"
          : "Solicitud pendiente. Esperando aprobación de la empresa…";
      });
      this.debugScan("15 waitForApproval RESOLVED");
      this.message = "Dispositivo vinculado correctamente.";
    } catch (error) {
      this.debugScan("ERROR scanAndPair", this.safeError(error));
      this.error = error instanceof Error ? error.message : "No se pudo completar el emparejamiento.";
    } finally {
      this.debugScan("16 FINALLY", { busyBeforeReset: this.busy, status: this.client.status });
      this.busy = false;
    }
  }

  async refresh(): Promise<void> {
    this.busy = true;
    this.error = "";
    try {
      await this.client.refreshDevice();
      await this.client.heartbeat();
      this.message = "Estado y permisos actualizados desde Bee Core.";
    } catch (error) {
      this.error = error instanceof Error ? error.message : "No se pudo actualizar el dispositivo.";
    } finally {
      this.busy = false;
    }
  }

  async unlink(): Promise<void> {
    if (!window.confirm("¿Quieres desvincular este dispositivo de Bee Core?")) return;
    this.busy = true;
    this.error = "";
    try {
      await this.client.unlink();
      this.message = "Dispositivo desvinculado. La credencial local se ha eliminado.";
    } catch (error) {
      this.error = error instanceof Error ? error.message : "No se pudo desvincular el dispositivo.";
    } finally {
      this.busy = false;
    }
  }

  capabilityLabel(id: string): string { return this.client.permissionLabel(id); }
}
