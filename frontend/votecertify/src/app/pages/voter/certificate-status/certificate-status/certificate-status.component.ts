import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Firestore, collection, doc, getDoc, query, where, orderBy, limit, getDocs } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';

@Component({
  selector: 'app-certificate-status',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './certificate-status.component.html',
  styleUrls: ['./certificate-status.component.scss']
})
export class CertificateStatusComponent implements OnInit {
  request: any = null;

  constructor(private firestore: Firestore, private auth: Auth) {}

  ngOnInit(): void {
    this.auth.onAuthStateChanged(async (user) => {
      if (user) {
        // Get voter's profile using UID
        const userRef = doc(this.firestore, 'users', user.uid); // or 'voters', based on your DB
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const voterData = userSnap.data();
          const voterId = voterData['voterId']; // make sure this field exists

          // Query request using voterId
          const requestsRef = collection(this.firestore, 'requests');
          const q = query(
            requestsRef,
            where('voterId', '==', voterId),
            limit(1)
          );

          const querySnapshot = await getDocs(q);
          this.request = querySnapshot.docs[0]?.data();
        } else {
          console.warn('User profile not found.');
        }
      }
    });
  }

  formatDate(timestamp: any): string {
    const date = timestamp?.toDate?.();
    return date ? date.toLocaleString() : 'N/A';
  }
}
