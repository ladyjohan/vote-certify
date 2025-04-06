import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  getAuth,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User
} from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-staff-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './staff-profile.component.html',
  styleUrls: ['./staff-profile.component.scss']
})
export class StaffProfileComponent implements OnInit {
  displayName = 'Loading...';
  email = 'Loading...';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  passwordStrength = '';
  passwordStrengthColor = 'black';

  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  loading = false;

  constructor(private firestore: Firestore, private toastr: ToastrService) {}

  ngOnInit() {
    const auth = getAuth();
    auth.onAuthStateChanged(async (user: User | null) => {
      if (user) {
        this.email = user.email || 'No email found';
        const userDocRef = doc(this.firestore, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          this.displayName = userDocSnap.data()['name'] || 'No name found';
        }
      }
    });
  }

  toggleVisibility(field: 'current' | 'new' | 'confirm') {
    if (field === 'current') this.showCurrentPassword = !this.showCurrentPassword;
    if (field === 'new') this.showNewPassword = !this.showNewPassword;
    if (field === 'confirm') this.showConfirmPassword = !this.showConfirmPassword;
  }

  checkPasswordStrength() {
    const length = this.newPassword.length;
    const hasUpper = /[A-Z]/.test(this.newPassword);
    const hasNumber = /\d/.test(this.newPassword);
    const hasSpecial = /[@$!%*?&#]/.test(this.newPassword);

    if (length >= 12 && hasUpper && hasNumber && hasSpecial) {
      this.passwordStrength = 'Strong';
      this.passwordStrengthColor = 'green';
    } else if (length >= 8 && (hasUpper || hasNumber)) {
      this.passwordStrength = 'Medium';
      this.passwordStrengthColor = 'orange';
    } else {
      this.passwordStrength = 'Weak';
      this.passwordStrengthColor = 'red';
    }
  }

  confirmChangePassword() {
    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.toastr.error('All fields are required.');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.toastr.error('New password and confirmation do not match.');
      return;
    }

    if (this.passwordStrength === 'Weak') {
      this.toastr.error('Please choose a stronger password.');
      return;
    }

    Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to change your password?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, change it',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#4CAF50',
      cancelButtonColor: '#d33',
    }).then((result) => {
      if (result.isConfirmed) {
        this.changePassword();
      }
    });
  }

  async changePassword() {
    this.loading = true;
    const auth = getAuth();
    const user = auth.currentUser;

    if (user) {
      try {
        const credential = EmailAuthProvider.credential(user.email!, this.currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, this.newPassword);

        Swal.fire('Success!', 'Your password has been updated.', 'success');
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.passwordStrength = '';
      } catch (error) {
        this.toastr.error('Error changing password.');
        console.error('❌ Error:', error);
      } finally {
        this.loading = false;
      }
    } else {
      this.toastr.error('No authenticated user.');
      this.loading = false;
    }
  }
}
