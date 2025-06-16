import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { RouterModule } from '@angular/router';
import { getAuth, signOut } from '@angular/fire/auth';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-sidenav',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule, MatListModule],
  templateUrl: './admin-sidenav.component.html',
  styleUrls: ['./admin-sidenav.component.scss']
})
export class AdminSidenavComponent {
  constructor(private router: Router) {}

  adminNavLinks = [
    { label: 'Dashboard', icon: 'dashboard', route: '/admin/dashboard' },
    { label: 'Request Overview', icon: 'visibility', route: '/admin/request-overview' },
    { label: 'User Management', icon: 'group', route: '/admin/user-management' }  // Updated route
  ];


  async logout() {
    const result = await Swal.fire({
      title: 'Logout Confirmation',
      text: 'Are you sure you want to logout?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, logout',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      const auth = getAuth();
      signOut(auth)
        .then(() => {
          console.log('✅ Admin logged out');
          this.router.navigate(['/login']);
        })
        .catch(error => console.error('❌ Logout error:', error));
    }
  }
}
