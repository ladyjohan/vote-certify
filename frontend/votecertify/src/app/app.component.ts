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
    // Set initial auth state - router outlet should render immediately
    this.isAuthChecked = false;
    
    // Handle router events first
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const excludedRoutes = ['/login', '/register', '/verify-email'];
      this.showSidenav = !excludedRoutes.includes(event.url);
    });
    
    // Use NgZone to ensure change detection runs for auth state
    // Don't block rendering - handle auth asynchronously
    onAuthStateChanged(this.auth, async (user) => {
      this.zone.run(() => {
        this.isAuthChecked = true;

        if (user) {
          // Handle auth state asynchronously without blocking render
          this.handleAuthenticatedUser(user).catch(err => {
            console.error('Error in handleAuthenticatedUser:', err);
            // Don't block UI on error
          });
        } else {
          this.userLoggedIn = false;
          this.userRole = null;
          // Only redirect to /login if not on landing/public pages
          const publicRoutes = ['/', '/login', '/register', '/verify-email'];
          if (!publicRoutes.includes(this.router.url)) {
            this.zone.run(() => {
              this.router.navigate(['/login']).catch(err => {
                console.error('Navigation error:', err);
              });
            });
          }
        }
      });
    });
  }

  private async handleAuthenticatedUser(user: any) {
    const currentRoute = this.router.url;
    
    try {
      const role = await this.authService.getUserRole(user.uid);

      if (role) {
        this.userLoggedIn = true;
        this.userRole = role;

        if (currentRoute.startsWith('/verify-email') || currentRoute === '/login') {
          if (currentRoute.startsWith('/verify-email') && !user.emailVerified) {
            await this.waitForEmailVerification(user);
          }

          if (user.emailVerified) {
            this.redirectBasedOnRole(role, currentRoute);
          }
          return;
        }

        if (user.emailVerified) {
          this.redirectBasedOnRole(role, currentRoute);
        } else {
          console.log('Email not verified yet. Please verify your email.');
        }
      } else {
        // Only redirect if not on public pages
        const publicRoutes = ['/', '/login', '/register'];
        if (!publicRoutes.includes(currentRoute)) {
          this.router.navigate(['/login']);
        }
      }
    } catch (error) {
      console.error('Error checking user role:', error);
      // Only redirect to /login if not on landing/public pages
      const publicRoutes = ['/', '/login', '/register'];
      if (!publicRoutes.includes(currentRoute)) {
        this.router.navigate(['/login']);
      }
    }
  }

  private redirectBasedOnRole(role: string, currentRoute: string) {
    this.zone.run(() => {
      if (role === 'voter' && !currentRoute.startsWith('/voter')) {
        this.router.navigate(['/voter/dashboard']);
      } else if (role === 'staff' && !currentRoute.startsWith('/staff')) {
        this.router.navigate(['/staff/dashboard']);
      } else if (role === 'admin' && !currentRoute.startsWith('/admin')) {
        this.router.navigate(['/admin/dashboard']);
      }
    });
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
