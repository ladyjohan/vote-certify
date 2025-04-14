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
  selector: 'app-voter-sidenav',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule, MatListModule],
  templateUrl: './voter-sidenav.component.html',
  styleUrls: ['./voter-sidenav.component.scss']
})
export class VoterSidenavComponent implements OnInit {
  displayName: string = 'Voter'; // Default name

  constructor(private router: Router, private firestore: Firestore) {}

  ngOnInit() {
    const auth = getAuth();
    const user = auth.currentUser;

    if (user) {
      this.fetchVoterFullName(user.uid);
    } else {
      auth.onAuthStateChanged((user: User | null) => {
        if (user) {
          this.fetchVoterFullName(user.uid);
        }
      });
    }
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
    { label: 'Request Form', icon: 'post_add', route: '/voter/request-form' },
    { label: 'Certificate Status', icon: 'assignment', route: '/voter/certificate-status' },
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
