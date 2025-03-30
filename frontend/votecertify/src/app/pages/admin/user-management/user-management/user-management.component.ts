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

    const auth = getAuth();
    const password = this.selectedRole === 'staff' ? '123456' : this.staffPassword;

    try {
      // Create staff/admin account in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, this.staffEmail, password);
      const user = userCredential.user;
      const uid = user.uid;
      const verificationLink = `http://localhost:4200/verify-email?uid=${uid}`;

      // Set status based on role
      const userStatus = this.selectedRole === 'admin' ? 'verified' : 'pending';

      // Save staff/admin details in Firestore
      await setDoc(doc(this.firestore, 'users', uid), {
        email: this.staffEmail,
        role: this.selectedRole,
        status: userStatus // Admin = "verified", Staff = "pending"
      });

      // Send verification email only for Staff
      if (this.selectedRole === 'staff') {
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
      .map(doc => ({ id: doc.id, ...doc.data() } as User))
      .filter(user => user.role === 'admin' || user.role === 'staff'); // Only show Admin & Staff

    this.filteredUsers = this.users;
  }

  //Disable an unverified account

  async disableAccount(userId: string) {
    const confirmDisable = confirm("Are you sure you want to disable this account?");
    if (!confirmDisable) return;

    try {
      const userDocRef = doc(this.firestore, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        this.toastr.error('User does not exist.');
        console.error('❌ Error: User document not found in Firestore.');
        return;
      }

      await updateDoc(userDocRef, { status: 'disabled' });
      this.toastr.warning('Account disabled successfully.');
      await this.loadUsers();
    } catch (error) {
      this.toastr.error('Error disabling account.');
      console.error('❌ Error:', error);
    }
  }

}
