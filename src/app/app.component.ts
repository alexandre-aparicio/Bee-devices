import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonicModule } from "@ionic/angular";
import { BarcodeFormat, BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";
import { App } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { ConnectedDevicesClient } from "./connected-devices.client";

@Component({
  selector: "bee-root",
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  template: `
    <ion-app>
      <ion-header>
        <ion-toolbar color="primary">
          <ion-title>Bee Devices</ion-title>
          <ion-buttons slot="end"><ion-button (click)="refresh()" [disabled]="busy || client.status !== 'active'">Actualizar</ion-button></ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="ion-padding">
        <ion-card>
          <ion-card-header>
            <ion-card-title>Conectar dispositivo</ion-card-title>
            <ion-card-subtitle>Emparejamiento permanente de Bee Core</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <ion-item>
              <ion-label position="stacked">Servidor Bee Core</ion-label>
              <ion-input [(ngModel)]="apiUrl" (ionChange)="setServer()" placeholder="https://beecore.beeprojects.net/api"></ion-input>
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Nombre del dispositivo</ion-label>
              <ion-input [(ngModel)]="deviceName" placeholder="Mi dispositivo Android"></ion-input>
            </ion-item>
            <ion-button expand="block" (click)="scanAndPair()" [disabled]="busy || client.status !== 'unpaired'">
              <ion-icon name="qr-code-outline" slot="start"></ion-icon>
              Escanear QR y emparejar
            </ion-button>
            <p class="muted">El emparejamiento está siempre disponible, aunque no haya extensiones instaladas.</p>
            <ion-chip [color]="client.status === 'active' ? 'success' : client.status === 'pending' ? 'warning' : 'medium'">
              {{client.status === 'active' ? 'Emparejado' : client.status === 'pending' ? 'Esperando aprobación' : 'Sin emparejar'}}
            </ion-chip>
          </ion-card-content>
        </ion-card>

        <ion-card *ngIf="client.status === 'active'">
          <ion-card-header>
            <ion-card-title>Permisos concedidos</ion-card-title>
            <ion-card-subtitle>Capacidades autorizadas por la empresa para este dispositivo</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <p *ngIf="!client.capabilities.length" class="muted">El dispositivo está emparejado, pero todavía no tiene permisos concedidos.</p>
            <div class="capability-badges" *ngIf="client.capabilities.length">
              <ion-chip color="success" *ngFor="let capability of client.capabilities">
                <ion-icon name="checkmark-circle" slot="start"></ion-icon>
                <ion-label>{{capability.label}}</ion-label>
              </ion-chip>
            </div>
          </ion-card-content>
        </ion-card>

        <ion-text color="danger" *ngIf="error"><p role="alert">{{error}}</p></ion-text>
        <ion-text color="success" *ngIf="message"><p role="status">{{message}}</p></ion-text>
      </ion-content>
    </ion-app>
  `,
  styles: [`
    ion-content { --background: #f5f7fb; }
    ion-card { border-radius: 18px; box-shadow: 0 8px 28px rgba(20,30,60,.06); }
    .muted { color: #64748b; font-size: .9rem; }
    .capability-badges { display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 0 12px; }
    .capability-badges ion-chip { margin: 0; }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  apiUrl = "https://beecore.beeprojects.net/api";
  deviceName = "Bee Android";
  busy = false;
  error = "";
  message = "";
  private appStateListener?: PluginListenerHandle;
  private destroyed = false;

  constructor(readonly client: ConnectedDevicesClient) {}

  ngOnInit(): void {
    void App.addListener("appStateChange", ({ isActive }) => {
      if (isActive && this.client.status === "active") void this.refresh();
    }).then(listener => {
      if (this.destroyed) void listener.remove();
      else this.appStateListener = listener;
    });
  }

  ngOnDestroy(): void { this.destroyed = true; void this.appStateListener?.remove(); }

  setServer(): void { this.client.setBaseUrl(this.apiUrl); }

  async scanAndPair(): Promise<void> {
    this.busy = true; this.error = ""; this.message = "";
    try {
      const permission = await BarcodeScanner.requestPermissions();
      if (permission.camera !== "granted") throw new Error("Se necesita permiso de cámara para escanear el QR.");
      const scan = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
      const qr = scan.barcodes[0]?.rawValue;
      if (!qr) throw new Error("No se ha detectado ningún código QR.");
      await this.client.pair(qr, this.deviceName);
      this.message = "Solicitud enviada. Esperando aprobación de la empresa…";
      await this.client.waitForApproval(status => {
        this.message = status === "active" ? "Dispositivo aprobado. Consultando permisos…" : "Esperando aprobación…";
      });
      this.message = "Dispositivo emparejado. Permisos actualizados.";
    } catch (error) {
      if (this.client.status === "pending") this.client.clear();
      this.error = error instanceof Error ? error.message : "No se pudo completar el emparejamiento.";
    } finally { this.busy = false; }
  }

  async refresh(): Promise<void> {
    this.error = "";
    try { await this.client.refreshCapabilities(); this.message = "Permisos actualizados."; }
    catch (error) { this.error = error instanceof Error ? error.message : "No se pudieron actualizar los permisos."; }
  }
}
