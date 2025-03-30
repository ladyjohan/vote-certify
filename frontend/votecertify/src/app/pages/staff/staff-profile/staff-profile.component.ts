import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider, User } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-staff-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './staff-profile.component.html',
  styleUrls: ['./staff-profile.component.scss']
})
export class StaffProfileComponent implements OnInit {
  displayName: string = 'Loading...';
  email: string = 'Loading...';
  newPassword: string = '';
  currentPassword: string = '';

  constructor(private firestore: Firestore, private toastr: ToastrService) {}

  ngOnInit() {
    const auth = getAuth();
    auth.onAuthStateChanged(async (user: User | null) => {
      if (user) {
        this.email = user.email || 'No email found';

        // Fetch display name from Firestore
        const userDocRef = doc(this.firestore, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          this.displayName = userDocSnap.data()['name'] || 'No name found';
        }
      }
    });
  }

  async changePassword() {
    const auth = getAuth();
    const user = auth.currentUser;

    if (user && this.currentPassword && this.newPassword) {
      try {
        const credential = EmailAuthProvider.credential(user.email!, this.currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, this.newPassword);

        this.toastr.success('Password changed successfully.');
        this.currentPassword = '';
        this.newPassword = '';
      } catch (error) {
        this.toastr.error('Error changing password.');
        console.error('❌ Error:', error);
      }
    } else {
      this.toastr.error('Please enter your current and new password.');
    }
  }
}
