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
  selector: 'app-voter-sidenav',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule, MatListModule],
  templateUrl: './voter-sidenav.component.html',
  styleUrls: ['./voter-sidenav.component.scss']
})
export class VoterSidenavComponent implements OnInit, OnDestroy {
  displayName: string = 'Voter';
  unreadCount: number = 0;
  private unreadSub?: Subscription;

  constructor(
    private router: Router,
    private firestore: Firestore,
    private chatService: ChatService
  ) {}

  ngOnInit() {
    const auth = getAuth();
    const user = auth.currentUser;

    if (user) {
      this.fetchVoterFullName(user.uid);
      this.initializeUnreadListener(user.email || '');
    } else {
      auth.onAuthStateChanged((user: User | null) => {
        if (user) {
          this.fetchVoterFullName(user.uid);
          this.initializeUnreadListener(user.email || '');
        }
      });
    }
  }

  ngOnDestroy() {
    this.unreadSub?.unsubscribe();
  }

  private initializeUnreadListener(email: string) {
    this.unreadSub = this.chatService.listenToUnreadCount(email, 'voter').subscribe((count) => {
      this.unreadCount = count;
    });

    // Also refresh every 3 seconds to catch new requests/messages
    setInterval(() => {
      this.chatService.refreshUnreadCount(email, 'voter').then(() => {
        // Count will be updated via the subject
      });
    }, 3000);
  }

  async fetchVoterFullName(uid: string) {
    try {
      const userDocRef = doc(this.firestore, 'users', uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        this.displayName = userDocSnap.data()['fullName'] || 'Voter';
      } else {
        console.warn('❌ No user data found in Firestore');
      }
    } catch (error) {
      console.error('❌ Error fetching voter full name:', error);
    }
  }

  voterNavLinks = [
    { label: 'Dashboard', icon: 'dashboard', route: '/voter/dashboard' },
    { label: 'Request Form', icon: 'post_add', route: '/voter/request-form' },
    { label: 'Certificate Status', icon: 'assignment', route: '/voter/certificate-status' },
    { label: 'Chat', icon: 'chat', route: '/voter/chat' },
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
          console.log('✅ Voter logged out');
          this.router.navigate(['/login']);
        })
        .catch(error => console.error('❌ Logout error:', error));
    }
  }
}
