import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { RouterModule } from '@angular/router';
import { getAuth, signOut, User } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-staff-sidenav',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule, MatListModule],
  templateUrl: './staff-sidenav.component.html',
  styleUrls: ['./staff-sidenav.component.scss']
})
export class StaffSidenavComponent implements OnInit {
  displayName: string = 'Staff'; // Default name

  constructor(private router: Router, private firestore: Firestore) {}

  ngOnInit() {
    const auth = getAuth();
    auth.onAuthStateChanged(async (user: User | null) => {
      if (user) {
        // Fetch name from Firestore
        const userDocRef = doc(this.firestore, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          this.displayName = userData['name'] || 'Staff';
        }
      }
    });
  }

  staffNavLinks = [
    { label: 'Dashboard', icon: 'dashboard', route: '/staff/dashboard' },
    { label: 'Request Management', icon: 'manage_search', route: '/staff/request-management' },
    { label: 'Status Overview', icon: 'assessment', route: '/staff/status-overview' },
    { label: 'User Settings', icon: 'person', route: '/staff/staff-profile' }
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
