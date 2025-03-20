import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router'; // ✅ Import provideRouter
import { AppComponent } from './app/app.component';
import { firebaseProviders } from './firebase-config';
import { routes } from './app/app.routes'; // ✅ Import routes

bootstrapApplication(AppComponent, {
  providers: [
    ...firebaseProviders,
    provideRouter(routes), // ✅ Fix: Add router support
  ],
}).catch((err) => console.error("🔥 Firebase error:", err));
