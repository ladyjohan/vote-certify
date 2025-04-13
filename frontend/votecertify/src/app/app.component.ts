import { Component, OnInit, inject, NgZone } from '@angular/core';
import { AuthService } from './services/auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';

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

  userLoggedIn = false; // Track user login status
  userRole: string | null = null;
  showSidenav = true; // Controls whether the sidenav is visible

  async ngOnInit() {
    try {
      const user = await this.authService.getCurrentUser();

      if (user) {
        const role = await this.authService.getUserRole(user.uid);

        if (role) {
          this.userLoggedIn = true;
          this.userRole = role;

          const currentRoute = this.router.url;

          // ✅ Stop any redirection if on verify-email
          if (currentRoute.startsWith('/verify-email')) {
            return;
          }

          // ✅ ONLY redirect if email is verified
          if (user.emailVerified) {
            if (role === 'voter' && currentRoute !== '/voter/dashboard') {
              this.router.navigate(['/voter/dashboard']);
            } else if (role === 'staff' && currentRoute !== '/staff/dashboard') {
              this.router.navigate(['/staff/dashboard']);
            } else if (role === 'admin' && currentRoute !== '/admin/dashboard') {
              this.router.navigate(['/admin/dashboard']);
            }
          } else {
            // 🚫 Email not verified — stay on verification page
            this.router.navigate(['/verify-email']);
          }
        } else {
          this.router.navigate(['/login']);
        }
      } else {
        this.router.navigate(['/login']);
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
      this.router.navigate(['/login']);
    }

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const excludedRoutes = ['/login', '/register', '/verify-email'];
      this.showSidenav = !excludedRoutes.includes(event.url);
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
