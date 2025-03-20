import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { importProvidersFrom } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';


import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

export const appConfig: ApplicationConfig = {
  providers: [
    importProvidersFrom(ReactiveFormsModule), // ✅ Enables Reactive Forms
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideFirebaseApp(() =>
      initializeApp({
        projectId: "vote-certify-5e2ee",
        appId: "1:1095004381185:web:c7385779245174fe7fa000",
        storageBucket: "vote-certify-5e2ee.firebasestorage.app",
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

