import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { RouterModule } from '@angular/router';
import { getAuth, signOut, User } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import Swal from 'sweetalert2';
import { ChatService } from '../../../services/chat.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-staff-sidenav',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule, MatListModule],
  templateUrl: './staff-sidenav.component.html',
  styleUrls: ['./staff-sidenav.component.scss']
})
export class StaffSidenavComponent implements OnInit, OnDestroy {
  displayName: string = 'Staff';
  unreadCount: number = 0;
  private unreadSub?: Subscription;

  constructor(
    private router: Router,
    private firestore: Firestore,
    private chatService: ChatService
  ) {}

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

        // Initialize unread listener with user's email
        this.initializeUnreadListener(user.email || '');
      }
    });
  }

  ngOnDestroy() {
    this.unreadSub?.unsubscribe();
  }

  private initializeUnreadListener(email: string) {
    this.unreadSub = this.chatService.listenToUnreadCount(email, 'staff').subscribe((count) => {
      this.unreadCount = count;
    });

    // Also refresh every 3 seconds to catch new requests/messages
    setInterval(() => {
      this.chatService.refreshUnreadCount(email, 'staff').then(() => {
        // Count will be updated via the subject
      });
    }, 3000);
  }

  staffNavLinks = [
    { label: 'Dashboard', icon: 'dashboard', route: '/staff/dashboard' },
    { label: 'Request Management', icon: 'manage_search', route: '/staff/request-management' },
    { label: 'Status Overview', icon: 'assessment', route: '/staff/status-overview' },
    { label: 'Chat', icon: 'chat', route: '/staff/chat' },
    { label: 'User Settings', icon: 'person', route: '/staff/staff-profile' }
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
      cancelButtonText: 'Cancel',
      customClass: {
        container: 'logout-swal-top'
      }
    });

    if (result.isConfirmed) {
      const auth = getAuth();
      signOut(auth)
        .then(() => {
          console.log('✅ Staff logged out');
          this.router.navigate(['/login']);
        })
        .catch(error => console.error('❌ Logout error:', error));
    }
  }
}
