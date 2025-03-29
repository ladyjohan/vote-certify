import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { getAuth, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { Firestore, doc, setDoc, collection, getDocs, getDoc, updateDoc } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import emailjs from 'emailjs-com';
import { ToastrService } from 'ngx-toastr';

// Define User Interface
interface User {
  id: string;
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
  staffEmail: string = '';
  staffPassword: string = '';
  selectedRole: string = 'staff'; // Default role
  users: User[] = [];
  filteredUsers: User[] = [];
  searchQuery: string = '';
  isAdmin = false;

  private EMAIL_JS_SERVICE_ID = 'service_rrb00wy';
  private EMAIL_JS_TEMPLATE_ID = 'template_vos13me';
  private EMAIL_JS_PUBLIC_KEY = 'VrHsZ86VVPD_U6TsA';

  constructor(private firestore: Firestore, private toastr: ToastrService) {}

  async ngOnInit() {
    await this.checkAdminRole();
    await this.loadUsers();
  }

  /**
   * Check if logged-in user is an Admin
   */
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

  /**
   * Add a new Staff or Admin
   */
  async addStaff() {
    if (!this.isAdmin) return;

    const auth = getAuth();
    const password = this.selectedRole === 'staff' ? '123456' : this.staffPassword;

    try {
      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, this.staffEmail, password);
      const userId = userCredential.user.uid;

      // Save user details in Firestore
      const userDocRef = doc(this.firestore, 'users', userId);
      await setDoc(userDocRef, {
        email: this.staffEmail,
        role: this.selectedRole,
        status: 'pending',
      });

      // Send verification email via EmailJS
      await this.sendVerificationEmail(this.staffEmail, password);

      this.toastr.success(`${this.selectedRole} account created & email sent.`);
      this.staffEmail = '';
      this.staffPassword = '';
      await this.loadUsers();
    } catch (error) {
      this.toastr.error('Error creating account.');
      console.error('❌ Error:', error);
    }
  }

  /**
   * Send verification email with password
   */
  async sendVerificationEmail(email: string, password: string) {
    const emailParams = {
      email: email,
      user_password: password,
      verification_link: `http://localhost:4200/verify-email?email=${email}`,
    };

    try {
      await emailjs.send(
        this.EMAIL_JS_SERVICE_ID,
        this.EMAIL_JS_TEMPLATE_ID,
        emailParams,
        this.EMAIL_JS_PUBLIC_KEY
      );
      console.log('✅ Email sent successfully');
    } catch (error) {
      console.error('❌ Email sending error:', error);
    }
  }

  /**
   * Load Admin and Staff users from Firestore
   */
  async loadUsers() {
    const usersCollectionRef = collection(this.firestore, 'users');
    const querySnapshot = await getDocs(usersCollectionRef);

    this.users = querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as User))
      .filter(user => user.role === 'admin' || user.role === 'staff'); // Only show Admin & Staff

    this.filteredUsers = this.users;
  }

  /**
   * Disable an unverified account
   */

  async disableAccount(userId: string) {
    const confirmDisable = confirm("Are you sure you want to disable this account?");
    if (!confirmDisable) return;

    try {
      await updateDoc(doc(this.firestore, 'users', userId), { status: 'disabled' });
      this.toastr.warning('Account disabled successfully.');
      await this.loadUsers();
    } catch (error) {
      this.toastr.error('Error disabling account.');
      console.error('❌ Error:', error);
    }
  }

  async resendVerificationEmail(user: User) {
    try {
      await this.sendVerificationEmail(user.email, "123456");
      this.toastr.info('Verification email resent.');
    } catch (error) {
      this.toastr.error('Error resending email.');
      console.error('❌ Error:', error);
    }
  }
}