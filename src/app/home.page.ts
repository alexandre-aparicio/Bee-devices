import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonButton, IonContent, IonIcon, IonSpinner, IonText, IonToolbar, IonHeader, IonTitle,
  IonCard, IonCardContent, IonBadge
} from '@ionic/angular/standalone';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';
import { ConnectedDevicesApiService, PairingResult } from './connected-devices-api.service';

type ViewState = 'ready' | 'scanning' | 'pairing' | 'pending' | 'connected' | 'error';

@Component({
  selector: 'bee-home',
  standalone: true,
  imports: [CommonModule, IonButton, IonContent, IonIcon, IonSpinner, IonText, IonToolbar,
    IonHeader, IonTitle, IonCard, IonCardContent, IonBadge],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <div class="toolbar-brand">
          <div class="brand-mark">B</div>
          <div><strong>bee<span>devices</span></strong><small> BEE PROJECTS</small></div>
        </div>
        <ion-badge slot="end" color="dark">ANDROID</ion-badge>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <main class="page-shell">
        <section class="intro">
          <div class="eyebrow"><span class="pulse-dot"></span> DEVICE COMPANION</div>
          <h1>Tu dispositivo.<br><em>Conectado.</em></h1>
          <p>Vincula este móvil con tu espacio de trabajo Bee Projects de forma segura.</p>
        </section>

        <ion-card class="connection-card">
          <ion-card-content>
            <div class="card-topline">
              <span class="eyebrow">ESTADO DEL DISPOSITIVO</span>
              <ion-badge [color]="state === 'connected' ? 'success' : state === 'error' ? 'danger' : 'medium'">
                {{ statusLabel }}
              </ion-badge>
            </div>

            <div class="scanner-visual" [class.is-active]="state === 'scanning'">
              <div class="scan-frame">
                <span class="corner tl"></span><span class="corner tr"></span>
                <span class="corner bl"></span><span class="corner br"></span>
                <div class="scan-glyph">⌗</div>
                <div class="scan-line" *ngIf="state === 'scanning'"></div>
              </div>
            </div>

            <h2>{{ heading }}</h2>
            <p class="status-copy">{{ description }}</p>

            <ion-button expand="block" size="large" (click)="scanAndPair()" [disabled]="busy || state === 'connected'">
              <ion-spinner *ngIf="busy" name="crescent" slot="start"></ion-spinner>
              <ion-icon *ngIf="!busy" name="qr-code-outline" slot="start"></ion-icon>
              {{ actionLabel }}
            </ion-button>

            <ion-button *ngIf="state === 'error'" expand="block" fill="clear" color="medium" (click)="reset()">
              Volver a intentarlo
            </ion-button>
            <ion-button *ngIf="state === 'connected'" expand="block" fill="outline" color="medium" (click)="sendHeartbeat()">
              Comprobar conexión
            </ion-button>
          </ion-card-content>
        </ion-card>

        <div class="steps">
          <div class="step" [class.done]="state === 'pending' || state === 'connected'">
            <span>01</span><div><strong>Escanea el QR</strong><small>Lee el código desde Bee Core.</small></div>
          </div>
          <div class="step" [class.done]="state === 'pending' || state === 'connected'">
            <span>02</span><div><strong>Solicita vinculación</strong><small>Bee Core registra este dispositivo.</small></div>
          </div>
          <div class="step" [class.done]="state === 'connected'">
            <span>03</span><div><strong>Aprueba el acceso</strong><small>Un administrador debe autorizarlo.</small></div>
          </div>
        </div>

        <div class="error-note" *ngIf="errorMessage">{{ errorMessage }}</div>
        <footer>Conexión protegida · Bee Core</footer>
      </main>
    </ion-content>
  `,
  styleUrls: ['./home.page.scss']
})
export class HomePage implements OnDestroy {
  state: ViewState = 'ready';
  busy = false;
  errorMessage = '';
  deviceId = '';
  private pairingSecret = '';
  private deviceCredential = '';
  private pollHandle?: ReturnType<typeof setTimeout>;
  private readonly deviceName = 'Bee Devices · Android';

  constructor(private readonly api: ConnectedDevicesApiService) {}

  get statusLabel(): string {
    return ({ ready: 'SIN VINCULAR', scanning: 'ESCANEANDO', pairing: 'CONECTANDO',
      pending: 'PENDIENTE', connected: 'CONECTADO', error: 'ERROR' } as Record<ViewState, string>)[this.state];
  }
  get heading(): string {
    return this.state === 'connected' ? '¡Todo listo!' : this.state === 'pending' ? 'Esperando aprobación'
      : this.state === 'error' ? 'No se pudo vincular' : 'Vincula tu dispositivo';
  }
  get description(): string {
    if (this.state === 'connected') return 'Este móvil ya está autorizado por Bee Core.';
    if (this.state === 'pending') return 'Confirma la solicitud desde Connected Devices en Bee Core. Esta pantalla se actualizará automáticamente.';
    if (this.state === 'error') return 'Revisa el código QR y la conexión e inténtalo de nuevo.';
    return 'Abre Connected Devices en Bee Core y escanea el código QR temporal que aparece en pantalla.';
  }
  get actionLabel(): string {
    return this.state === 'connected' ? 'Dispositivo autorizado' : this.state === 'pending' ? 'Esperando autorización…'
      : this.state === 'pairing' ? 'Vinculando…' : this.state === 'scanning' ? 'Abriendo cámara…' : 'Vincular dispositivo';
  }

  async scanAndPair(): Promise<void> {
    if (this.busy || this.state === 'pending') return;
    this.errorMessage = '';
    this.busy = true;
    this.state = 'scanning';
    try {
      if (!Capacitor.isNativePlatform()) {
        throw new Error('El lector QR está disponible al ejecutar Bee Devices en Android.');
      }
      const permission = await BarcodeScanner.requestPermissions();
      if (permission.camera !== 'granted') throw new Error('Necesitas permitir el acceso a la cámara para escanear el QR.');
      const result = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
      const raw = result.barcodes[0]?.rawValue;
      if (!raw) throw new Error('No se ha detectado ningún código QR.');
      const token = this.extractPairingToken(raw);
      this.state = 'pairing';
      const pairing = await this.api.pair(token, this.deviceName);
      this.deviceId = pairing.deviceId;
      this.pairingSecret = pairing.pairingSecret;
      this.state = 'pending';
      this.startApprovalPolling(pairing);
    } catch (error) {
      this.fail(error instanceof Error ? error.message : 'Error inesperado al vincular el dispositivo.');
    } finally {
      this.busy = false;
    }
  }

  private extractPairingToken(raw: string): string {
    let url: URL;
    try { url = new URL(raw); } catch { throw new Error('El QR no contiene un enlace de emparejamiento válido.'); }
    if (url.protocol !== 'bee-device:' || url.hostname !== 'pair') {
      throw new Error('Este QR no pertenece al proceso de vinculación de Bee Devices.');
    }
    const token = url.searchParams.get('token')?.trim() ?? '';
    if (token.length < 40 || token.length > 256) throw new Error('El código QR no contiene un token válido.');
    return token;
  }

  private startApprovalPolling(pairing: PairingResult): void {
    const expiresAt = new Date(pairing.approvalExpiresAt).getTime();
    const poll = async (): Promise<void> => {
      try {
        const result = await this.api.pairingStatus(this.pairingSecret);
        if (result.status === 'active') {
          this.deviceCredential = this.pairingSecret;
          this.pairingSecret = '';
          this.state = 'connected';
          return;
        }
        if (result.status === 'revoked' || result.status === 'suspended' || result.status === 'expired') {
          this.fail('La solicitud de vinculación ya no está activa.');
          return;
        }
        if (Date.now() >= expiresAt) {
          this.fail('La solicitud ha caducado. Genera un nuevo QR en Bee Core.');
          return;
        }
        this.pollHandle = setTimeout(() => void poll(), 3000);
      } catch (error) {
        this.fail(error instanceof Error ? error.message : 'No se pudo comprobar la autorización.');
      }
    };
    this.pollHandle = setTimeout(() => void poll(), 1500);
  }

  async sendHeartbeat(): Promise<void> {
    if (!this.deviceCredential) return;
    this.busy = true;
    try {
      await this.api.heartbeat(this.deviceCredential);
      this.errorMessage = '';
    } catch (error) {
      this.fail(error instanceof Error ? error.message : 'No se pudo comprobar la conexión.');
    } finally {
      this.busy = false;
    }
  }

  reset(): void {
    if (this.pollHandle) clearTimeout(this.pollHandle);
    this.pairingSecret = '';
    this.deviceCredential = '';
    this.deviceId = '';
    this.errorMessage = '';
    this.state = 'ready';
  }

  private fail(message: string): void {
    if (this.pollHandle) clearTimeout(this.pollHandle);
    this.busy = false;
    this.errorMessage = message;
    this.state = 'error';
  }

  ngOnDestroy(): void {
    if (this.pollHandle) clearTimeout(this.pollHandle);
    this.pairingSecret = '';
    this.deviceCredential = '';
  }
}
