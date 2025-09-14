import { Component, OnInit, inject, NgZone } from '@angular/core';
import { AuthService } from './services/auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';

// Firebase Auth imports
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'VoteCertify';
  private authService = inject(AuthService);
  private router = inject(Router);
  private zone = inject(NgZone);

  private auth = getAuth();

  userLoggedIn = false;
  userRole: string | null = null;
  showSidenav = true;
  isAuthChecked = false;

  ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      this.isAuthChecked = true;

      if (user) {
        try {
          const role = await this.authService.getUserRole(user.uid);

          if (role) {
            this.userLoggedIn = true;
            this.userRole = role;

            const currentRoute = this.router.url;

            if (currentRoute.startsWith('/verify-email') || currentRoute === '/login') {
              if (currentRoute.startsWith('/verify-email') && !user.emailVerified) {
                await this.waitForEmailVerification(user);
              }

              if (user.emailVerified) {
                this.redirectBasedOnRole(role, currentRoute);
              }
              return; // Prevent premature redirect
            }

            if (user.emailVerified) {
              this.redirectBasedOnRole(role, currentRoute);
            } else {
              // Email not verified — do NOT redirect to /verify-email automatically
              console.log('Email not verified yet. Please verify your email.');
              // You can show a notification here instead if you want
            }
          } else {
            this.router.navigate(['/login']);
          }
        } catch (error) {
          console.error('Error checking user role:', error);
          // Only redirect to /login if not on landing page
          if (this.router.url !== '/' && this.router.url !== '') {
            this.router.navigate(['/login']);
          }
        }
      } else {
        this.userLoggedIn = false;
        this.userRole = null;
        // Only redirect to /login if not on landing page
        if (this.router.url !== '/' && this.router.url !== '') {
          this.router.navigate(['/login']);
        }
      }
    });

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const excludedRoutes = ['/login', '/register', '/verify-email'];
      this.showSidenav = !excludedRoutes.includes(event.url);
    });
  }

  private redirectBasedOnRole(role: string, currentRoute: string) {
    if (role === 'voter' && currentRoute !== '/voter/dashboard') {
      this.router.navigate(['/voter/dashboard']);
    } else if (role === 'staff' && currentRoute !== '/staff/dashboard') {
      this.router.navigate(['/staff/dashboard']);
    } else if (role === 'admin' && currentRoute !== '/admin/dashboard') {
      this.router.navigate(['/admin/dashboard']);
    }
  }

  private waitForEmailVerification(user: User): Promise<void> {
    return new Promise((resolve) => {
      const maxAttempts = 10;
      let attempts = 0;

      const interval = setInterval(async () => {
        attempts++;

        await user.reload();

        if (user.emailVerified) {
          clearInterval(interval);
          this.zone.run(() => {
            resolve();
          });
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          resolve();
        }
      }, 2000);
    });
  }

  async logout() {
    try {
      await this.authService.logout();
      this.userLoggedIn = false;
      this.userRole = null;
      localStorage.clear();
      sessionStorage.clear();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }
}
