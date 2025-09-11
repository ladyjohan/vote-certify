import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { getAuth, createUserWithEmailAndPassword, initializeAuth, browserLocalPersistence, browserPopupRedirectResolver } from '@angular/fire/auth';
import { FirebaseApp, provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { environment } from '../../../../../environments/environment'; // Adjust this path based on your setup
import { Firestore, doc, setDoc, collection, getDocs, getDoc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import emailjs from 'emailjs-com';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';

// Define User Interface
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

@Component({
  selector: 'app-admin-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
})
export class AdminUserManagementComponent implements OnInit {
  staffName: string = '';
  staffEmail: string = '';
  staffPassword: string = '';
  selectedRole: string = 'staff';
  users: User[] = [];
  filteredUsers: User[] = [];
  searchQuery: string = '';
  isAdmin = false;
  currentUserId: string = ''; // 🆕 Add currentUserId
  nameError: string = '';

  private EMAIL_JS_SERVICE_ID = 'service_rrb00wy';
  private EMAIL_JS_TEMPLATE_ID = 'template_8j29e0p';
  private EMAIL_JS_PUBLIC_KEY = 'VrHsZ86VVPD_U6TsA';

  constructor(private firestore: Firestore, private toastr: ToastrService) {}

  async ngOnInit() {
    await this.checkAdminRole();
    await this.loadUsers();
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      this.currentUserId = user.uid; // 🆕 Save logged-in Admin's UID
    }
  }

  async checkAdminRole() {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      const userDocRef = doc(this.firestore, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data() as User;
        if (userData.role === 'admin') {
          this.isAdmin = true;
        } else {
          this.toastr.error('Unauthorized access!');
          window.location.href = '/';
        }
      }
    } else {
      this.toastr.error('You are not logged in!');
      window.location.href = '/';
    }
  }

  async updateStaffStatus(userId: string) {
    const auth = getAuth();
    const user = auth.currentUser;

    if (user && user.emailVerified) {
      try {
        const userDocRef = doc(this.firestore, 'users', userId);
        await updateDoc(userDocRef, { status: 'verified' });
        console.log('✅ Staff status updated to "verified" in Firestore.');
      } catch (error) {
        console.error('❌ Error updating staff status:', error);
      }
    }
  }

  validateName(name: string): boolean {
    if (/\d/.test(name)) {
      this.nameError = 'Name cannot contain numbers';
      return false;
    }
    if (!/^[a-zA-Z\s]+$/.test(name)) {
      this.nameError = 'Name can only contain letters and spaces';
      return false;
    }
    this.nameError = '';
    return true;
  }

  async addStaff() {
    if (!this.isAdmin) return;

    if (this.selectedRole === 'staff' && !this.validateName(this.staffName)) {
      this.toastr.error(this.nameError);
      return;
    }

    const password = this.selectedRole === 'staff' ? '123456' : this.staffPassword;

    try {
      const secondaryApp = initializeApp(environment.firebaseConfig, 'Secondary');
      const secondaryAuth = initializeAuth(secondaryApp, {
        persistence: browserLocalPersistence,
        popupRedirectResolver: browserPopupRedirectResolver,
      });

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, this.staffEmail, password);
      const user = userCredential.user;
      const uid = user.uid;

      await secondaryAuth.signOut();

      const userStatus = this.selectedRole === 'admin' ? 'verified' : 'pending';
      const userName = this.selectedRole === 'admin' ? 'Admin' : this.staffName;

      await setDoc(doc(this.firestore, 'users', uid), {
        email: this.staffEmail,
        role: this.selectedRole,
        status: userStatus,
        name: userName,
      });

      if (this.selectedRole === 'staff') {
        // Send Firebase verification email (official link with oobCode)
        if (user) {
          await import('firebase/auth').then(async (firebaseAuth) => {
            await firebaseAuth.sendEmailVerification(user);
          });
        }
        // Send password notification via EmailJS (no verification link)
        await this.sendPasswordEmail(this.staffEmail, password);
      }

      this.toastr.success(`${this.selectedRole} account created successfully.`);
      this.staffEmail = '';
      this.staffPassword = '';
      this.staffName = '';
      await this.loadUsers();
    } catch (error) {
      this.toastr.error('Error creating staff/admin account.');
      console.error('❌ Error:', error);
    }
  }

  private async sendPasswordEmail(email: string, password: string) {
    const emailParams = {
      email: email,
      user_password: password
    };

    try {
      await emailjs.send(
        this.EMAIL_JS_SERVICE_ID,
        this.EMAIL_JS_TEMPLATE_ID,
        emailParams,
        this.EMAIL_JS_PUBLIC_KEY
      );

      console.log('✅ Password Email sent successfully to:', email);
    } catch (error) {
      console.error('❌ Error sending password email:', error);
    }
  }

  async loadUsers() {
    const usersCollectionRef = collection(this.firestore, 'users');
    const querySnapshot = await getDocs(usersCollectionRef);

    this.users = querySnapshot.docs
      .map(doc => {
        const data = doc.data() as User;
        return {
          id: doc.id,
          name: data.name || '',
          email: data.email,
          role: data.role,
          status: data.status
        };
      })
      .filter(user => user.role === 'admin' || user.role === 'staff');

    this.filteredUsers = this.users;
  }

  // Disable an account with SweetAlert2
async disableAccount(userId: string) {
  const user = this.users.find(u => u.id === userId);
  if (!user) return;

  if (user.status === 'pending') {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'This pending account will be permanently deleted!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(this.firestore, 'users', userId));
        this.toastr.success('Account deleted successfully.');
        await this.loadUsers();
      } catch (error) {
        console.error('Error deleting account:', error);
        this.toastr.error('Failed to delete account.');
      }
    }
  } else {
    const newStatus = user.status === 'disabled' ? 'verified' : 'disabled';
    const action = newStatus === 'disabled' ? 'disable' : 'enable';

    const result = await Swal.fire({
      title: `Are you sure you want to ${action} this account?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `Yes, ${action} it!`,
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        await updateDoc(doc(this.firestore, 'users', userId), { status: newStatus });
        this.toastr.success(`Account ${action}d successfully.`);
        await this.loadUsers();
      } catch (error) {
        console.error(`Error updating account status:`, error);
        this.toastr.error('Failed to update account status.');
      }
    }
  }
}
}
