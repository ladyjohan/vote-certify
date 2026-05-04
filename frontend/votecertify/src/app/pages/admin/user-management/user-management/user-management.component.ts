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
  birthdate?: string;
  fullName?: string;
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
  voters: User[] = [];
  filteredVoters: User[] = [];
  searchQuery: string = '';
  activeTab: 'users' | 'voters' = 'users';
  isAdmin = false;
  currentUserId: string = '';
  nameError: string = '';

  // Sorting & Filtering
  currentSortField: string = 'name';
  currentSortDirection: 'asc' | 'desc' = 'asc';
  currentStatusFilter: string = 'all';

  // Pagination
  itemsPerPage: number = 10;
  pageSizeOptions = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  
  userCurrentPage: number = 1;
  userTotalPages: number = 1;
  
  voterCurrentPage: number = 1;
  voterTotalPages: number = 1;

  pages: number[] = [];

  // Edit Modal
  showEditModal = false;
  showAddModal = false;
  editingUser: User | null = null;
  isSaving = false;

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

  openAddModal() {
    this.showAddModal = true;
    this.staffEmail = '';
    this.staffName = '';
    this.staffPassword = '';
    this.selectedRole = 'staff';
  }

  closeAddModal() {
    this.showAddModal = false;
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
      this.closeAddModal();
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

    const allUsers = querySnapshot.docs.map(doc => {
      const data = doc.data() as User;
      return {
        id: doc.id,
        name: data.name || data.fullName || '',
        email: data.email,
        role: data.role,
        status: data.status,
        birthdate: data.birthdate || '-',
      };
    });

    // Categorize users
    this.users = allUsers.filter(user => user.role === 'admin' || user.role === 'staff');
    this.voters = allUsers.filter(user => user.role === 'voter');

    this.applyFilters();
  }

  switchTab(tab: 'users' | 'voters') {
    this.activeTab = tab;
    this.searchQuery = '';
    this.applyFilters();
  }

  applyFilters() {
    const query = this.searchQuery.toLowerCase().trim();

    // Filter Users (Staff/Admin)
    this.filteredUsers = this.users.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(query) ||
                            user.email.toLowerCase().includes(query) ||
                            user.role.toLowerCase().includes(query);
      const matchesStatus = this.currentStatusFilter === 'all' || user.status === this.currentStatusFilter;
      return matchesSearch && matchesStatus;
    });
    this.sortList(this.filteredUsers);
    this.userTotalPages = Math.max(1, Math.ceil(this.filteredUsers.length / this.itemsPerPage));
    if (this.userCurrentPage > this.userTotalPages) this.userCurrentPage = 1;

    // Filter Voters
    this.filteredVoters = this.voters.filter(voter => {
      const matchesSearch = voter.name.toLowerCase().includes(query) ||
                            voter.email.toLowerCase().includes(query) ||
                            voter.status.toLowerCase().includes(query);
      const matchesStatus = this.currentStatusFilter === 'all' || voter.status === this.currentStatusFilter;
      return matchesSearch && matchesStatus;
    });
    this.sortList(this.filteredVoters);
    this.voterTotalPages = Math.max(1, Math.ceil(this.filteredVoters.length / this.itemsPerPage));
    if (this.voterCurrentPage > this.voterTotalPages) this.voterCurrentPage = 1;
  }

  sortList(list: User[]) {
    list.sort((a, b) => {
      let valueA = (a as any)[this.currentSortField] || '';
      let valueB = (b as any)[this.currentSortField] || '';

      if (typeof valueA === 'string') valueA = valueA.toLowerCase();
      if (typeof valueB === 'string') valueB = valueB.toLowerCase();

      if (valueA < valueB) return this.currentSortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return this.currentSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  onSortFieldChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.currentSortField = target.value;
    this.applyFilters();
  }

  onSortDirectionChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.currentSortDirection = target.value as 'asc' | 'desc';
    this.applyFilters();
  }

  onStatusFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.currentStatusFilter = target.value;
    this.applyFilters();
  }

  get paginatedUsers(): User[] {
    const start = (this.userCurrentPage - 1) * this.itemsPerPage;
    return this.filteredUsers.slice(start, start + this.itemsPerPage);
  }

  get paginatedVoters(): User[] {
    const start = (this.voterCurrentPage - 1) * this.itemsPerPage;
    return this.filteredVoters.slice(start, start + this.itemsPerPage);
  }

  get currentPage(): number {
    return this.activeTab === 'users' ? this.userCurrentPage : this.voterCurrentPage;
  }

  get totalPages(): number {
    return this.activeTab === 'users' ? this.userTotalPages : this.voterTotalPages;
  }

  // Pagination methods
  setupPagination() {
    // This method is now replaced by applyFilters and getters
  }

  updatePaginatedUsers() {
    // This method is now replaced by getters
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    if (this.activeTab === 'users') this.userCurrentPage = page;
    else this.voterCurrentPage = page;
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      if (this.activeTab === 'users') this.userCurrentPage++;
      else this.voterCurrentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      if (this.activeTab === 'users') this.userCurrentPage--;
      else this.voterCurrentPage--;
    }
  }

  onPageSizeChange() {
    this.userCurrentPage = 1;
    this.voterCurrentPage = 1;
    this.applyFilters();
  }

  get rangeStart() {
    const count = this.activeTab === 'users' ? this.filteredUsers.length : this.filteredVoters.length;
    return count === 0 ? 0 : (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  get rangeEnd() {
    const count = this.activeTab === 'users' ? this.filteredUsers.length : this.filteredVoters.length;
    return Math.min(this.currentPage * this.itemsPerPage, count);
  }

  get visiblePages(): number[] {
    const total = this.totalPages;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: number[] = [];
    const cur = this.currentPage;
    pages.push(1);
    if (cur > 3) pages.push(-1);
    for (let p = Math.max(2, cur - 1); p <= Math.min(total - 1, cur + 1); p++) pages.push(p);
    if (cur < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  }

  searchUsers() {
    this.applyFilters();
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

  // Edit Staff/Admin details (Now using custom modal)
  editUser(user: User) {
    // Create a shallow copy to avoid direct binding until saved
    this.editingUser = { ...user };
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.editingUser = null;
  }

  async saveUserChanges() {
    if (!this.editingUser) return;

    if (!this.editingUser.name || !this.editingUser.email) {
      this.toastr.error('All fields are required.');
      return;
    }

    if (!/^[a-zA-Z\s.]+$/.test(this.editingUser.name)) {
      this.toastr.error('Name can only contain letters, spaces, and periods.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.editingUser.email)) {
      this.toastr.error('Please enter a valid email address.');
      return;
    }

    this.isSaving = true;
    try {
      const userDocRef = doc(this.firestore, 'users', this.editingUser.id);
      await updateDoc(userDocRef, {
        name: this.editingUser.name,
        email: this.editingUser.email,
        role: this.editingUser.role
      });
      
      this.toastr.success('Account updated successfully.');
      await this.loadUsers();
      this.closeEditModal();
    } catch (error) {
      console.error('Error updating account:', error);
      this.toastr.error('An error occurred while updating the account.');
    } finally {
      this.isSaving = false;
    }
  }
}
