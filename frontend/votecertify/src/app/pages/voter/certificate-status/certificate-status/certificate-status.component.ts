import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Firestore,
  collection,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  doc
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

      const userRef = doc(this.firestore, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) return;

      const voterId = userSnap.data()['voterId'];
      const requestsRef = collection(this.firestore, 'requests');
      const q = query(
        requestsRef,
        where('voterId', '==', voterId),
        orderBy('submittedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      this.requests = querySnapshot.docs.map(doc => ({
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
