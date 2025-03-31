import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { importProvidersFrom } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

// Firebase Imports
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

// ngx-toastr & Animations
import { provideToastr } from 'ngx-toastr';
import { provideAnimations } from '@angular/platform-browser/animations';

// App Routes
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // Required for animations & Toastr
    provideAnimations(),
    provideToastr(), // Enables Toast Notifications

    // Enables Reactive Forms globally
    importProvidersFrom(ReactiveFormsModule),

    // Optimizes Zone.js change detection
    provideZoneChangeDetection({ eventCoalescing: true }),

    // Router Configuration
    provideRouter(routes, withComponentInputBinding()),

    // Firebase Configuration
    provideFirebaseApp(() =>
      initializeApp({
        projectId: "vote-certify-5e2ee",
        appId: "1:1095004381185:web:c7385779245174fe7fa000",
        storageBucket: "vote-certify-5e2ee.appspot.com",
        apiKey: "AIzaSyBHBUZMwQAZxfz4XM-iu6c6E-jKF6bq9T8",
        authDomain: "vote-certify-5e2ee.firebaseapp.com",
        messagingSenderId: "1095004381185",
        measurementId: "G-SCV0ZHHFZT",
      })
    ),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
  ],
};
