import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { qrCodeOutline } from 'ionicons/icons';

addIcons({ qrCodeOutline });

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  template: '<ion-app><ion-router-outlet /></ion-app>'
})
export class AppComponent {}
