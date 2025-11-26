import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Firestore,
  collection,
  getDocs,
  query,
  orderBy
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';

@Component({
  selector: 'app-certificate-status',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './certificate-status.component.html',
  styleUrls: ['./certificate-status.component.scss']
})
export class CertificateStatusComponent implements OnInit {
  requests: any[] = [];
  selectedStatus: string = '';
  sortOrder: 'asc' | 'desc' = 'desc';

  constructor(private firestore: Firestore, private auth: Auth) {}

  ngOnInit(): void {
    this.auth.onAuthStateChanged(async (user) => {
      if (!user) return;

      const requestsRef = collection(this.firestore, 'requests');
      // Get all requests and filter by email on client side
      const q = query(
        requestsRef,
        orderBy('submittedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const userEmail = user.email?.toLowerCase();
      
      // Filter by user email on client side to support both old and new requests
      this.requests = querySnapshot.docs
        .filter(doc => doc.data()['email']?.toLowerCase() === userEmail)
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
    });
  }

  filteredRequests(): any[] {
    let filtered = [...this.requests];

    if (this.selectedStatus) {
      filtered = filtered.filter(r => r.status === this.selectedStatus);
    }

    return filtered.sort((a, b) => {
      const dateA = a.submittedAt?.toDate?.()?.getTime?.() || 0;
      const dateB = b.submittedAt?.toDate?.()?.getTime?.() || 0;
      return this.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }

  formatDate(timestamp: any): string {
    const date = timestamp?.toDate?.();
    return date ? date.toLocaleString() : 'N/A';
  }
}
