import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Firestore, collection, getDocs, query, orderBy, doc, getDoc } from '@angular/fire/firestore';
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
      const requestsRef = collection(this.firestore, 'requests');
      // Try to get all requests and filter by email on the client side to handle both old and new requests
      const qAll = query(
        requestsRef,
        orderBy('submittedAt', 'desc')
      );
      const allSnapshot = await getDocs(qAll);
      
      // Filter by user email on client side
      const userEmail = user.email?.toLowerCase();
      const filteredDocs = allSnapshot.docs.filter(doc => {
        const docData = doc.data();
        return docData['email']?.toLowerCase() === userEmail;
      });

      this.allRequests = filteredDocs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

      // Get the latest request
      if (filteredDocs.length > 0) {
        this.currentRequest = { id: filteredDocs[0].id, ...filteredDocs[0].data() };
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
