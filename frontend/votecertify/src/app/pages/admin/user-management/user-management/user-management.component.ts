import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { getAuth, createUserWithEmailAndPassword, deleteUser, initializeAuth, browserLocalPersistence, browserPopupRedirectResolver } from '@angular/fire/auth';
import { FirebaseApp, provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { environment } from '../../../../../environments/environment'; // Adjust this path based on your setup
import { Firestore, doc, setDoc, collection, getDocs, getDoc, updateDoc, deleteDoc } from '@angular/fire/firestore'; // Add deleteDoc import
import { FormsModule } from '@angular/forms';
import emailjs from 'emailjs-com';
import { ToastrService } from 'ngx-toastr';

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
  imports: [CommonModule, FormsModule],
})
export class AdminUserManagementComponent implements OnInit {
  staffName: string = '';
  staffEmail: string = '';
  staffPassword: string = '';
  selectedRole: string = 'staff'; // Default role
  users: User[] = [];
  filteredUsers: User[] = [];
  searchQuery: string = '';
  isAdmin = false;

  private EMAIL_JS_SERVICE_ID = 'service_rrb00wy';
  private EMAIL_JS_TEMPLATE_ID = 'template_8j29e0p';
  private EMAIL_JS_PUBLIC_KEY = 'VrHsZ86VVPD_U6TsA';

  constructor(private firestore: Firestore, private toastr: ToastrService) {}

  async ngOnInit() {
    await this.checkAdminRole();
    await this.loadUsers();
  }

  // Check if logged-in user is an Admin
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
        await updateDoc(userDocRef, { status: 'verified' }); // ✅ Update status
        console.log('✅ Staff status updated to "verified" in Firestore.');
      } catch (error) {
        console.error('❌ Error updating staff status:', error);
      }
    }
  }

  // Add a new Staff or Admin
  async addStaff() {
    if (!this.isAdmin) return;
  
    const password = this.selectedRole === 'staff' ? '123456' : this.staffPassword;
  
    try {
      // ✅ 1. Create secondary app instance to preserve admin session
      const secondaryApp = initializeApp(environment.firebaseConfig, 'Secondary');
      const secondaryAuth = initializeAuth(secondaryApp, {
        persistence: browserLocalPersistence,
        popupRedirectResolver: browserPopupRedirectResolver,
      });
  
      // ✅ 2. Create the user on the secondary auth instance
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, this.staffEmail, password);
      const user = userCredential.user;
      const uid = user.uid;
  
      // ✅ 3. Sign out the secondary auth instance immediately
      await secondaryAuth.signOut();
  
      // ✅ 4. Save user to Firestore
      const userStatus = this.selectedRole === 'admin' ? 'verified' : 'pending';
      const userName = this.selectedRole === 'admin' ? 'Admin' : this.staffName;
  
      await setDoc(doc(this.firestore, 'users', uid), {
        email: this.staffEmail,
        role: this.selectedRole,
        status: userStatus,
        name: userName,
      });
  
      // ✅ 5. Send email if staff
      if (this.selectedRole === 'staff') {
        const verificationLink = `http://localhost:4200/verify-email?uid=${uid}`;
        await this.sendVerificationAndPasswordEmail(this.staffEmail, password, verificationLink);
      }
  
      this.toastr.success(`${this.selectedRole} account created successfully.`);
      this.staffEmail = '';
      this.staffPassword = '';
      await this.loadUsers();
    } catch (error) {
      this.toastr.error('Error creating staff/admin account.');
      console.error('❌ Error:', error);
    }
  }  

  //Send verification email with password
  private async sendVerificationAndPasswordEmail(email: string, password: string, verificationLink: string) {
    const emailParams = {
      email: email,
      user_password: password,
      verification_link: verificationLink
    };

    try {
      await emailjs.send(
        this.EMAIL_JS_SERVICE_ID,
        this.EMAIL_JS_TEMPLATE_ID,
        emailParams,
        this.EMAIL_JS_PUBLIC_KEY
      );

      console.log('✅ Verification & Password Email sent successfully to:', email);
    } catch (error) {
      console.error('❌ Error sending email:', error);
    }
  }

  // Load Admin and Staff users from Firestore
  async loadUsers() {
    const usersCollectionRef = collection(this.firestore, 'users');
    const querySnapshot = await getDocs(usersCollectionRef);

    this.users = querySnapshot.docs
    .map(doc => {
      const data = doc.data() as User;
      return {
        id: doc.id,
        name: data.name || '', // Ensure name is included
        email: data.email,
        role: data.role,
        status: data.status
      };
    })
      .filter(user => user.role === 'admin' || user.role === 'staff'); // Only show Admin & Staff

    this.filteredUsers = this.users;
  }

  // Disable an account
  async disableAccount(userId: string) {
    const confirmDisable = confirm("Are you sure you want to disable this account?");
    if (!confirmDisable) return;

    try {
      const userDocRef = doc(this.firestore, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        this.toastr.error('User does not exist.');
        return;
      }

      const userData = userDocSnap.data() as { name?: string };
      await updateDoc(userDocRef, { status: 'disabled' });
      this.toastr.warning('Account disabled successfully.');
      await this.loadUsers();
    } catch (error) {
      this.toastr.error('Error disabling account.');
      console.error('❌ Error:', error);
    }
  }

  // Enable a disabled account
  async enableAccount(userId: string) {
    const confirmEnable = confirm("Are you sure you want to enable this account?");
    if (!confirmEnable) return;

    try {
      const userDocRef = doc(this.firestore, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        this.toastr.error('User does not exist.');
        return;
      }

      await updateDoc(userDocRef, { status: 'verified' });
      this.toastr.success('Account enabled successfully.');
      await this.loadUsers();
    } catch (error) {
      this.toastr.error('Error enabling account.');
      console.error('❌ Error:', error);
    }
  }


  async deleteAccount(userId: string) {
    const confirmDelete = confirm("Are you sure you want to delete this account?");
    if (!confirmDelete) return;

    try {
      // Get the user document reference from Firestore
      const userDocRef = doc(this.firestore, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        this.toastr.error('User does not exist.');
        return;
      }

      // Delete the user document from Firestore
      await deleteDoc(userDocRef);

      this.toastr.success('Account deleted successfully.');

      // Update the frontend by removing the deleted user from the users array
      this.users = this.users.filter(user => user.id !== userId);
      this.filteredUsers = this.filteredUsers.filter(user => user.id !== userId);

    } catch (error) {
      this.toastr.error('Error deleting account.');
      console.error('❌ Error:', error);
    }
  }
}
