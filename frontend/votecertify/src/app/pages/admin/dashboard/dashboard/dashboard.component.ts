import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { getAuth, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class AdminDashboardComponent implements OnInit {
  isAdmin = false;

  constructor(private router: Router, private firestore: Firestore) {}

  ngOnInit() {
    const auth = getAuth();
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(this.firestore, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        // ✅ Type the Firestore document data properly
        const userData = userDocSnap.data() as { role?: string } | undefined;

        if (userData?.role === 'admin') {
          this.isAdmin = true;
        } else {
          this.router.navigate(['/']); // Redirect if not admin
        }
      } else {
        this.router.navigate(['/login']); // Redirect if not logged in
      }
    });
  }
}
