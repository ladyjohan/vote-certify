import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config'; // ✅ Centralized providers & routing

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error("🔥 App Bootstrapping Error:", err));
