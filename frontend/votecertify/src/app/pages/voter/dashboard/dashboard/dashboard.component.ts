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
  isInCooldown: boolean = false;
  daysRemaining: number = 0;
  private intervalId: any;

  // Time slots (30-minute intervals from 9:00 AM to 2:30 PM, 1 person per slot, excluding 12:00 PM - 1:00 PM)
  timeSlots = [
    { label: '9:00 AM - 9:30 AM', value: '09:00-09:30', capacity: 1 },
    { label: '9:30 AM - 10:00 AM', value: '09:30-10:00', capacity: 1 },
    { label: '10:00 AM - 10:30 AM', value: '10:00-10:30', capacity: 1 },
    { label: '10:30 AM - 11:00 AM', value: '10:30-11:00', capacity: 1 },
    { label: '11:00 AM - 11:30 AM', value: '11:00-11:30', capacity: 1 },
    { label: '11:30 AM - 12:00 PM', value: '11:30-12:00', capacity: 1 },
    { label: '1:00 PM - 1:30 PM', value: '13:00-13:30', capacity: 1 },
    { label: '1:30 PM - 2:00 PM', value: '13:30-14:00', capacity: 1 },
    { label: '2:00 PM - 2:30 PM', value: '14:00-14:30', capacity: 1 },
    { label: '2:30 PM - 3:00 PM', value: '14:30-15:00', capacity: 1 }
  ];

  constructor(private firestore: Firestore, private auth: Auth) {}

  ngOnInit() {
    this.displayName = localStorage.getItem('displayName') || '';
    this.updateDateTime();
    this.intervalId = setInterval(() => this.updateDateTime(), 1000);
    this.fetchCurrentRequest();
    this.checkRequestCooldown();
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

  getTimeSlotLabel(timeSlotValue: string): string {
    const slot = this.timeSlots.find(s => s.value === timeSlotValue);
    return slot ? slot.label : timeSlotValue;
  }

  async checkRequestCooldown() {
    this.auth.onAuthStateChanged(async (user: any) => {
      if (!user) {
        this.isInCooldown = false;
        this.daysRemaining = 0;
        return;
      }

      try {
        const requestsRef = collection(this.firestore, 'requests');
        
        // Get all requests and filter client-side
        const allSnapshot = await getDocs(requestsRef);

        // Filter by user email and completed status
        const userEmail = user.email?.toLowerCase();
        const completedRequests = allSnapshot.docs
          .filter(doc => {
            const data = doc.data();
            return data['email']?.toLowerCase() === userEmail && 
                   ['Completed', 'Claimed', 'Ready for Pickup'].includes(data['status']);
          })
          .map(doc => doc.data());

        if (completedRequests.length === 0) {
          this.isInCooldown = false;
          this.daysRemaining = 0;
          return;
        }

        // Get the most recent completed request
        let mostRecentDate: Date | null = null;
        
        completedRequests.forEach((data: any) => {
          const completedAt = data['completedAt'] || data['claimedAt'] || data['approvedAt'] || data['pickupDate'] || data['submittedAt'];
          
          if (completedAt) {
            let dateObj: Date;
            
            if (completedAt.toDate) {
              dateObj = completedAt.toDate();
            } else if (completedAt instanceof Date) {
              dateObj = completedAt;
            } else if (typeof completedAt === 'string') {
              dateObj = new Date(completedAt);
            } else {
              dateObj = new Date(completedAt);
            }

            if (!mostRecentDate || dateObj > mostRecentDate) {
              mostRecentDate = dateObj;
            }
          }
        });

        if (!mostRecentDate) {
          this.isInCooldown = false;
          this.daysRemaining = 0;
          return;
        }

        // Calculate days until next request is allowed (3 months = 90 days)
        const COOLDOWN_DAYS = 90;
        const nextRequestDate = new Date(mostRecentDate);
        nextRequestDate.setDate(nextRequestDate.getDate() + COOLDOWN_DAYS);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const timeRemaining = nextRequestDate.getTime() - today.getTime();
        const daysLeft = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));

        if (daysLeft > 0) {
          this.isInCooldown = true;
          this.daysRemaining = daysLeft;
        } else {
          this.isInCooldown = false;
          this.daysRemaining = 0;
        }
      } catch (error) {
        console.error('Error checking request cooldown:', error);
      }
    });
  }
}
