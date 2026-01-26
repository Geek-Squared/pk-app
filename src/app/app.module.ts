// src/app/app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BottomNavComponent } from './components/bottom-nav/bottom-nav.component';
import { fadeAnimation } from './utils/nav-animation';

import { environment } from 'src/environments/environment';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';

// ✅ Modular Firebase imports
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFirestoreModule, SETTINGS as FIRESTORE_SETTINGS } from '@angular/fire/compat/firestore';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import {
  AngularFireAnalyticsModule,
  ScreenTrackingService,
} from '@angular/fire/compat/analytics';
import {
  AngularFirePerformanceModule,
  PerformanceMonitoringService,
} from '@angular/fire/compat/performance';


@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot({
      navAnimation: fadeAnimation,
    }),
    AppRoutingModule,
    CommonModule,
    HttpClientModule,
    // ✅ Use AngularFire compat modules for NgModule-based setup
    AngularFireModule.initializeApp(environment.firebaseConfig),
    AngularFirestoreModule,
    AngularFireAuthModule,
    AngularFireAnalyticsModule,
    AngularFirePerformanceModule,
    BottomNavComponent,
  ],
  providers: [
    StatusBar,
    SplashScreen,
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    PerformanceMonitoringService,
    ScreenTrackingService,
    { 
      provide: FIRESTORE_SETTINGS, 
      useValue: { 
        ignoreUndefinedProperties: true
      } 
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
