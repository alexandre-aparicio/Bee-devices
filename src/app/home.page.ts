import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonButton, IonContent, IonIcon, IonSpinner, IonText, IonToolbar, IonHeader, IonTitle,
  IonCard, IonCardContent, IonBadge
} from '@ionic/angular/standalone';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';
import { ConnectedDevicesApiService } from './connected-devices-api.service';
import { SecureCredentialStore } from './secure-credential.store';

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
      <main class="page-shell" [class.is-minimal]="state === 'connected'">
        <ng-container *ngIf="state === 'connected'; else notConnected">
          <section class="connected-state">
            <div class="connected-mark"><ion-icon name="checkmark"></ion-icon></div>
            <div class="eyebrow"><span class="pulse-dot is-green"></span> BEE CORE</div>
            <h1>Dispositivo<br><em>vinculado.</em></h1>
            <p>Este dispositivo está autorizado y vinculado correctamente a tu espacio de trabajo.</p>
            <ion-badge color="success">AUTORIZADO</ion-badge>
          </section>
        </ng-container>

        <ng-template #notConnected>
          <section class="intro" *ngIf="state !== 'pending'">
            <div class="eyebrow"><span class="pulse-dot"></span> DEVICE COMPANION</div>
            <h1>Tu dispositivo.<br><em>Conectado.</em></h1>
            <p>Vincula este móvil con tu espacio de trabajo Bee Projects de forma segura.</p>
          </section>

          <section class="intro pending-intro" *ngIf="state === 'pending'">
            <div class="eyebrow"><span class="pulse-dot is-pending"></span> SOLICITUD ENVIADA</div>
            <h1>Esperando<br><em>aprobación.</em></h1>
            <p>Bee Core ha recibido la solicitud. Un administrador debe autorizar este dispositivo.</p>
          </section>

          <ion-card class="connection-card" *ngIf="state !== 'pending'">
            <ion-card-content>
              <div class="card-topline">
                <span class="eyebrow">ESTADO DEL DISPOSITIVO</span>
                <ion-badge [color]="state === 'error' ? 'danger' : 'medium'">{{ statusLabel }}</ion-badge>
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
              <ion-button expand="block" size="large" (click)="scanAndPair()" [disabled]="busy">
                <ion-spinner *ngIf="busy" name="crescent" slot="start"></ion-spinner>
                <ion-icon *ngIf="!busy" name="qr-code-outline" slot="start"></ion-icon>
                {{ actionLabel }}
              </ion-button>
              <ion-button *ngIf="state === 'error'" expand="block" fill="clear" color="medium" (click)="reset()">
                Volver a intentarlo
              </ion-button>
            </ion-card-content>
          </ion-card>

          <ion-card class="pending-card" *ngIf="state === 'pending'">
            <ion-card-content>
              <div class="pending-icon"><ion-spinner name="crescent"></ion-spinner></div>
              <h2>Vinculación pendiente</h2>
              <p class="status-copy">La solicitud está registrada y estamos comprobando si el administrador ya la ha aprobado. No cierres el proceso: puedes salir de la app y volver más tarde.</p>
              <div class="pending-meta" *ngIf="deviceId">ID de dispositivo <strong>{{ deviceId }}</strong></div>
              <ion-badge color="warning">PENDIENTE DE APROBACIÓN</ion-badge>
            </ion-card-content>
          </ion-card>

          <div class="steps" *ngIf="state !== 'pending'">
            <div class="step" [class.done]="state === 'connected'">
              <span>01</span><div><strong>Escanea el QR</strong><small>Lee el código desde Bee Core.</small></div>
            </div>
            <div class="step" [class.done]="state === 'connected'">
              <span>02</span><div><strong>Solicita vinculación</strong><small>Bee Core registra este dispositivo.</small></div>
            </div>
            <div class="step">
              <span>03</span><div><strong>Aprueba el acceso</strong><small>Un administrador debe autorizarlo.</small></div>
            </div>
          </div>
        </ng-template>

        <div class="error-note" *ngIf="errorMessage">{{ errorMessage }}</div>
        <footer *ngIf="state !== 'connected'">Conexión protegida · Bee Core</footer>
      </main>
    </ion-content>
  `,
  styleUrls: ['./home.page.scss']
})
export class HomePage implements OnInit, OnDestroy {
  state: ViewState = 'ready';
  busy = false;
  errorMessage = '';
  deviceId = '';
  private deviceCredential = '';
  private pollHandle?: ReturnType<typeof setTimeout>;
  private restoring = false;
  private readonly deviceName = 'Bee Devices · Android';

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible' && this.deviceCredential && !this.busy) {
      void this.refreshStoredConnection();
    }
  };

  constructor(
    private readonly api: ConnectedDevicesApiService,
    private readonly credentialStore: SecureCredentialStore
  ) {}

  ngOnInit(): void {
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    void this.restoreConnection();
  }

  get menuActionLabel(): string {
    if (this.state === 'pending') return 'Cancelar solicitud';
    if (this.state === 'connected') return 'Desvincular dispositivo';
    return 'Vincular dispositivo';
  }

  async handleMenuAction(): Promise<void> {
    if (this.state === 'connected' || this.state === 'pending') {
      await this.confirmUnlink();
      return;
    }
    await this.scanAndPair();
  }

  private async confirmUnlink(): Promise<void> {
    if (!this.deviceId || this.busy) return;
    const pending = this.state === 'pending';
    const alert = document.createElement('ion-alert');
    alert.header = pending ? 'Cancelar solicitud' : 'Desvincular dispositivo';
    alert.message = pending
      ? 'Se cancelará la solicitud pendiente y este móvil dejará de estar vinculado.'
      : 'Este móvil perderá el acceso a Bee Core. Para volver a utilizarlo tendrás que escanear un nuevo QR y solicitar autorización.';
    alert.buttons = [
      { text: 'Mantener', role: 'cancel' },
      { text: pending ? 'Cancelar solicitud' : 'Desvincular', role: 'destructive', handler: () => { void this.unlinkDevice(); } }
    ];
    document.body.appendChild(alert);
    await alert.present();
  }

  private async unlinkDevice(): Promise<void> {
    if (!this.deviceId || !this.deviceCredential || this.busy) return;
    this.busy = true;
    this.errorMessage = '';
    try {
      await this.api.unlink(this.deviceId, this.deviceCredential);
      this.stopPolling();
      await this.clearStoredCredential();
      this.deviceId = '';
      this.state = 'ready';
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'No se pudo cancelar la solicitud o desvincular el dispositivo. La credencial se conserva.';
    } finally {
      this.busy = false;
    }
  }

  get statusLabel(): string {
    return ({ ready: 'SIN VINCULAR', scanning: 'ESCANEANDO', pairing: 'CONECTANDO',
      pending: 'PENDIENTE', connected: 'CONECTADO', error: 'ERROR' } as Record<ViewState, string>)[this.state];
  }
  get heading(): string {
    return this.state === 'connected' ? '¡Todo listo!' : this.state === 'pending' ? 'Esperando aprobación'
      : this.state === 'error' ? 'No se pudo vincular' : 'Vincula tu dispositivo';
  }
  get description(): string {
    if (this.state === 'connected') return 'Este móvil ya está autorizado por Bee Core. La vinculación se conserva aunque cierres la app o reinicies el teléfono.';
    if (this.state === 'pending') return 'Confirma la solicitud desde Connected Devices en Bee Core. Comprobaremos automáticamente el estado.';
    if (this.state === 'error') return 'Revisa el código QR y la conexión e inténtalo de nuevo.';
    return 'Abre Connected Devices en Bee Core y escanea el código QR temporal que aparece en pantalla.';
  }
  get actionLabel(): string {
    return this.state === 'connected' ? 'Dispositivo autorizado' : this.state === 'pending' ? 'Esperando autorización…'
      : this.state === 'pairing' ? 'Vinculando…' : this.state === 'scanning' ? 'Abriendo cámara…' : 'Vincular dispositivo';
  }

  private async restoreConnection(): Promise<void> {
    if (this.restoring) return;
    this.restoring = true;
    try {
      const credential = await this.credentialStore.get();
      if (!credential) {
        this.state = 'ready';
        return;
      }
      this.deviceCredential = credential;
      await this.refreshStoredConnection();
    } catch {
      await this.clearStoredCredential();
      this.state = 'ready';
      this.errorMessage = 'No se pudo recuperar la vinculación guardada. Escanea un nuevo QR para vincular este móvil.';
    } finally {
      this.restoring = false;
    }
  }

  private async refreshStoredConnection(): Promise<void> {
    if (!this.deviceCredential || this.busy) return;
    this.busy = true;
    try {
      const result = await this.api.pairingStatus(this.deviceCredential);
      this.deviceId = result.deviceId;
      this.errorMessage = '';
      if (result.status === 'active') {
        this.state = 'connected';
        this.stopPolling();
      } else if (result.status === 'pending') {
        this.state = 'pending';
        this.startApprovalPolling();
      } else {
        await this.clearStoredCredential();
        this.state = 'ready';
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo comprobar la vinculación.';
      if (message.includes('401') || message.includes('403') || message.includes('404') ||
          /expired|revoked|inactive|not active|invalid/i.test(message)) {
        await this.clearStoredCredential();
        this.state = 'ready';
        this.errorMessage = 'La vinculación ya no está activa. Escanea un nuevo QR para volver a vincular este móvil.';
      } else {
        this.state = this.deviceCredential ? 'pending' : 'ready';
        this.errorMessage = 'No hay conexión con Bee Core. Conservamos la vinculación y volveremos a comprobarla cuando recuperes Internet.';
        if (this.deviceCredential) this.startApprovalPolling();
      }
    } finally {
      this.busy = false;
    }
  }

  async scanAndPair(): Promise<void> {
    if (this.busy || this.state === 'pending' || this.state === 'connected') return;
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
      this.deviceCredential = pairing.pairingSecret;
      await this.credentialStore.save(pairing.pairingSecret);
      this.state = 'pending';
      this.startApprovalPolling();
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

  private startApprovalPolling(): void {
    this.stopPolling();
    const poll = async (): Promise<void> => {
      if (!this.deviceCredential) return;
      try {
        const result = await this.api.pairingStatus(this.deviceCredential);
        this.deviceId = result.deviceId;
        if (result.status === 'active') {
          this.state = 'connected';
          this.errorMessage = '';
          this.stopPolling();
          return;
        }
        if (result.status === 'pending') {
          this.state = 'pending';
          this.pollHandle = setTimeout(() => void poll(), 5000);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (/401|403|404|expired|revoked|inactive|invalid/i.test(message)) {
          await this.clearStoredCredential();
          this.state = 'ready';
          this.errorMessage = 'La solicitud ha caducado o ha sido revocada. Genera un nuevo QR en Bee Core.';
          this.stopPolling();
          return;
        }
        this.errorMessage = 'Sin conexión con Bee Core. La credencial permanece guardada; reintentaremos automáticamente.';
        this.pollHandle = setTimeout(() => void poll(), 10000);
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
      this.errorMessage = error instanceof Error ? error.message : 'No se pudo comprobar la conexión.';
    } finally {
      this.busy = false;
    }
  }

  async reset(): Promise<void> {
    this.stopPolling();
    await this.clearStoredCredential();
    this.deviceId = '';
    this.errorMessage = '';
    this.state = 'ready';
  }

  private async clearStoredCredential(): Promise<void> {
    this.deviceCredential = '';
    try { await this.credentialStore.clear(); } catch { /* Local data is already considered unusable. */ }
  }

  private stopPolling(): void {
    if (this.pollHandle) clearTimeout(this.pollHandle);
    this.pollHandle = undefined;
  }

  private fail(message: string): void {
    this.busy = false;
    this.errorMessage = message;
    this.state = 'error';
    if (!this.deviceCredential) this.stopPolling();
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.stopPolling();
  }
}
