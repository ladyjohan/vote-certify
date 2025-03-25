import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { RouterModule } from '@angular/router';
import { getAuth, signOut } from '@angular/fire/auth';

@Component({
  selector: 'app-staff-sidenav',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule, MatListModule], // ✅ Added necessary modules
  templateUrl: './staff-sidenav.component.html',
  styleUrls: ['./staff-sidenav.component.scss']
})
export class StaffSidenavComponent {
  constructor(private router: Router) {}

  staffNavLinks = [
    { label: 'Dashboard', icon: 'dashboard', route: '/staff/dashboard' },
    { label: 'Request Management', icon: 'manage_search', route: '/staff/request-management' },
    { label: 'Status Overview', icon: 'assessment', route: '/staff/status-overview' }
  ];

  logout() {
    const auth = getAuth();
    signOut(auth)
      .then(() => {
        console.log('✅ Staff logged out');
        this.router.navigate(['/login']);
      })
      .catch(error => console.error('❌ Logout error:', error));
  }
}
