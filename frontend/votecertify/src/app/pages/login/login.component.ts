import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';
import { Auth, signInWithEmailAndPassword, signOut } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage: string = '';
  loading = false;

  // ✅ Use AngularFire's DI (Dependency Injection)
  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private toastr: ToastrService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  // ✅ Update Firestore Status After Email Verification
  async updateStaffStatus(userId: string) {
    try {
      const userDocRef = doc(this.firestore, 'users', userId);
      await setDoc(userDocRef, { status: 'verified' }, { merge: true }); // ✅ Merge fields safely
      console.log('✅ Staff status updated to "verified" in Firestore.');
    } catch (error) {
      console.error('❌ Error updating staff status:', error);
    }
  }

  async login() {
    if (this.loginForm.invalid) {
      this.toastr.error('Please enter a valid email and password.', 'Login Failed');
      return;
    }
  
    this.errorMessage = '';
    this.loading = true;
    const { email, password } = this.loginForm.value;
  
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;
  
      // ✅ Reload user data to get the latest email verification status
      await user.reload();
  
      // ✅ Fetch user data from Firestore
      const userDocRef = doc(this.firestore, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
  
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const userRole = userData['role'];
        let userStatus = userData['status']; // Firestore status
  
        console.log(`🔍 Firestore User Status: ${userStatus}`);
  
        if (userRole === 'admin') {
          console.log('✅ Admin detected. Skipping email verification check.');
        } else if (userRole === 'staff' || userRole === 'voter') {
          // ✅ If Firestore status is still "pending" but email is verified, update it
          if (user.emailVerified && userStatus !== 'verified') {
            console.log('⏳ Updating Firestore status to "verified"...');
            await setDoc(userDocRef, { status: 'verified' }, { merge: true });
            userStatus = 'verified';
          }
  
          // ✅ Block login if Firestore status is still "pending"
          if (userStatus !== 'verified') {
            this.toastr.warning('Please verify your email before logging in.', 'Email Not Verified');
            await signOut(this.auth);
            return;
          }
        }
  
        this.toastr.success('Welcome back!', 'Login Successful');
  
        // ✅ Redirect user based on role
        if (userRole === 'admin') {
          this.router.navigate(['/admin/dashboard']);
        } else if (userRole === 'staff') {
          this.router.navigate(['/staff/dashboard']);
        } else if (userRole === 'voter') {
          this.router.navigate(['/voter/dashboard']);
        } else {
          this.toastr.error('Unauthorized role.', 'Login Failed');
          await signOut(this.auth);
        }
      } else {
        this.toastr.error('User record not found.', 'Login Failed');
        await signOut(this.auth);
      }
    } catch (error: any) {
      console.error('Login Error:', error);
  
      if (error.code === 'auth/user-not-found') {
        this.errorMessage = 'No account found with this email.';
      } else if (error.code === 'auth/wrong-password') {
        this.errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        this.errorMessage = 'Invalid email format.';
      } else {
        this.errorMessage = 'Login failed. Please check your credentials.';
      }
  
      this.toastr.error(this.errorMessage, 'Login Failed');
    } finally {
      this.loading = false;
    }
  }  
}
