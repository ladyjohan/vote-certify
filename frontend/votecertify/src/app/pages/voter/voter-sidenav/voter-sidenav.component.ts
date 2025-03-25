import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { RouterModule } from '@angular/router';
import { getAuth, signOut } from '@angular/fire/auth';

@Component({
  selector: 'app-voter-sidenav',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule, MatListModule], // ✅ Fixed imports
  templateUrl: './voter-sidenav.component.html',
  styleUrls: ['./voter-sidenav.component.scss']
})
export class VoterSidenavComponent {
  constructor(private router: Router) {}

  voterNavLinks = [
    { label: 'Dashboard', icon: 'dashboard', route: '/voter/dashboard' },
    { label: 'Request Form', icon: 'post_add', route: '/voter/request-form' },
    { label: 'Certificate Status', icon: 'assignment', route: '/voter/certificate-status' }
  ];

  logout() {
    const auth = getAuth();
    signOut(auth)
      .then(() => {
        console.log('✅ Voter logged out');
        this.router.navigate(['/login']);
      })
      .catch(error => console.error('❌ Logout error:', error));
  }
}
