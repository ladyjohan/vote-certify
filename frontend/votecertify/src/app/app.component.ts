import { Component, OnInit, inject, NgZone } from '@angular/core';
import { AuthService } from './services/auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';

// Add Firebase Auth imports
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

  // Inject Firebase Auth service
  private auth = getAuth();

  userLoggedIn = false; // Track user login status
  userRole: string | null = null;
  showSidenav = true; // Controls whether the sidenav is visible
  isAuthChecked = false; // Flag for knowing auth state

  ngOnInit() {
    // Use onAuthStateChanged to monitor auth state
    onAuthStateChanged(this.auth, async (user) => {
      this.isAuthChecked = true; // now we know the auth status

      if (user) {
        try {
          const role = await this.authService.getUserRole(user.uid);

          if (role) {
            this.userLoggedIn = true;
            this.userRole = role;

            const currentRoute = this.router.url;

            if (currentRoute.startsWith('/verify-email') || currentRoute === '/login') {
              // If on verify-email page, wait for email to be verified with polling
              if (currentRoute.startsWith('/verify-email') && !user.emailVerified) {
                await this.waitForEmailVerification(user);
              }

              // After waiting or if email already verified, redirect accordingly
              if (user.emailVerified) {
                this.redirectBasedOnRole(role, currentRoute);
              }
              return; // don’t redirect away from verify-email or login prematurely
            }

            if (user.emailVerified) {
              this.redirectBasedOnRole(role, currentRoute);
            } else {
              // Email not verified, redirect to verify-email page if not already there
              if (!currentRoute.startsWith('/verify-email')) {
                this.router.navigate(['/verify-email']);
              }
            }
          } else {
            this.router.navigate(['/login']);
          }
        } catch (error) {
          console.error('Error checking user role:', error);
          this.router.navigate(['/login']);
        }
      } else {
        this.userLoggedIn = false;
        this.userRole = null;
        this.router.navigate(['/login']);
      }
    });

    // Listen to router events to toggle sidenav visibility
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const excludedRoutes = ['/login', '/register', '/verify-email'];
      this.showSidenav = !excludedRoutes.includes(event.url);
    });
  }

  /** Redirect based on role and current route */
  private redirectBasedOnRole(role: string, currentRoute: string) {
    if (role === 'voter' && currentRoute !== '/voter/request-form') {
      this.router.navigate(['/voter/request-form']);
    } else if (role === 'staff' && currentRoute !== '/staff/dashboard') {
      this.router.navigate(['/staff/dashboard']);
    } else if (role === 'admin' && currentRoute !== '/admin/dashboard') {
      this.router.navigate(['/admin/dashboard']);
    }
  }

  /** Polls every 2 seconds for up to 20 seconds to check if email is verified */
  private waitForEmailVerification(user: User): Promise<void> {
    return new Promise((resolve) => {
      const maxAttempts = 10;
      let attempts = 0;

      const interval = setInterval(async () => {
        attempts++;

        // Reload user to get fresh emailVerified status
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

  /** ✅ Logout Function */
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
