import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  getAuth,
  createUserWithEmailAndPassword,
  initializeAuth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
} from '@angular/fire/auth';
import { FirebaseApp, provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { environment } from '../../../../../environments/environment';
import { Firestore, doc, setDoc, collection, getDocs, getDoc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import emailjs from 'emailjs-com';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';

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
  currentUserId: string = '';
  nameError: string = '';

  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 5;
  totalPages: number = 1;
  paginatedUsers: User[] = [];
  pages: number[] = [];

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
      this.currentUserId = user.uid;
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

  validateName(name: string): boolean {
    if (!/^[a-zA-Z\s.]+$/.test(name)) {
      this.nameError = 'Name can only contain letters, spaces, and periods (.)';
      return false;
    }
    this.nameError = '';
    return true;
  }

  sanitizeName(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    // Remove any characters that are not letters, spaces, or periods
    const sanitized = value.replace(/[^a-zA-Z\s.]/g, '');
    if (sanitized !== value) {
      input.value = sanitized;
      this.staffName = sanitized;
      this.nameError = '';
    }
  }

  allowNameKeydown(event: KeyboardEvent): void {
    const key = event.key;
    // Allow: letters, spaces, periods, backspace, delete, tab, arrow keys, etc.
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    
    // Allow if it's a control key
    if (allowedKeys.includes(key)) {
      return;
    }
    
    // Allow if it's a letter (a-z, A-Z), space, or period
    if (/^[a-zA-Z\s.]$/.test(key)) {
      return;
    }
    
    // Prevent all other keys
    event.preventDefault();
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

      // Send Firebase verification email (official link with oobCode)
      // Must be sent before signing out, and works with the user's auth instance
      if (user) {
        await import('firebase/auth').then(async (firebaseAuth) => {
          await firebaseAuth.sendEmailVerification(user);
        });
      }

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
        await this.sendPasswordEmail(this.staffEmail, password);
      }

      this.toastr.success(
        `${this.selectedRole} account created successfully. Please check your email for the verification link.`,
        'Success'
      );
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
      user_password: password,
    };

    try {
      await emailjs.send(this.EMAIL_JS_SERVICE_ID, this.EMAIL_JS_TEMPLATE_ID, emailParams, this.EMAIL_JS_PUBLIC_KEY);
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
          status: data.status,
        };
      })
      .filter(user => user.role === 'admin' || user.role === 'staff');

    this.filteredUsers = this.users;
    this.setupPagination();
  }

  // Pagination methods
  setupPagination() {
    this.totalPages = Math.ceil(this.filteredUsers.length / this.itemsPerPage) || 1;
    this.currentPage = Math.min(this.currentPage, this.totalPages) || 1;
    
    this.pages = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    this.updatePaginatedUsers();
  }

  updatePaginatedUsers() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedUsers = this.filteredUsers.slice(startIndex, endIndex);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePaginatedUsers();
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedUsers();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedUsers();
    }
  }

  searchUsers() {
    const query = this.searchQuery.toLowerCase();
    this.filteredUsers = this.users.filter(user =>
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query)
    );
    this.setupPagination();
  }

  // Disable / Enable account
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
        cancelButtonText: 'Cancel',
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
        cancelButtonText: 'Cancel',
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
