import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Firestore, collection, getDocs, query, where, orderBy, limit, doc, getDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';

@Component({
  selector: 'app-dashboard-video',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})

export class VoterDashboardComponent implements OnInit {
  displayName: string = '';
  currentDateTime: string = '';
  currentRequest: any = null;
  allRequests: any[] = [];
  private intervalId: any;

  constructor(private firestore: Firestore, private auth: Auth) {}

  ngOnInit() {
    this.displayName = localStorage.getItem('displayName') || '';
    this.updateDateTime();
    this.intervalId = setInterval(() => this.updateDateTime(), 1000);
    this.fetchCurrentRequest();
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  updateDateTime() {
    const now = new Date();
    this.currentDateTime = now.toLocaleString();
  }

  // fetchCurrentStatus removed
  async fetchCurrentRequest() {
    this.auth.onAuthStateChanged(async (user: any) => {
      if (!user) {
        this.currentRequest = null;
        this.allRequests = [];
        return;
      }
      const userRef = doc(this.firestore, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        this.currentRequest = null;
        this.allRequests = [];
        return;
      }
      const voterId = userSnap.data()['voterId'];
      const requestsRef = collection(this.firestore, 'requests');
      // Get all requests for timeline
      const qAll = query(
        requestsRef,
        where('voterId', '==', voterId),
        orderBy('submittedAt', 'desc')
      );
      const allSnapshot = await getDocs(qAll);
      this.allRequests = allSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

      // Get latest request for status card
      const q = query(
        requestsRef,
        where('voterId', '==', voterId),
        orderBy('submittedAt', 'desc'),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        this.currentRequest = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
      } else {
        this.currentRequest = null;
      }
    });
  }

  filteredRequests() {
    // Optionally filter or just return all requests
    return this.allRequests;
  }

  formatDate(date: any): string {
    if (!date) return 'N/A';
    // Firestore Timestamp object
    if (typeof date.toDate === 'function') {
      return date.toDate().toLocaleString();
    }
    // JS Date
    if (date instanceof Date) {
      return date.toLocaleString();
    }
    // ISO string or other
    return new Date(date).toLocaleString();
  }
}
