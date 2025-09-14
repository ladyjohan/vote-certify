import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';
import { Auth, signInWithEmailAndPassword, signOut } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { AuthService } from '../../services/auth.service';  // Make sure path is correct

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  errorMessage: string = '';
  loading = false;
  showPassword = false;

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  private authService: AuthService = inject(AuthService);

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

  ngOnInit() {
    // Check for verification query param when component loads
    this.activatedRoute.queryParams.subscribe(async (params) => {
      const verifyUid = params['verifyUid'];
      if (verifyUid) {
        try {
          await this.authService.verifyEmail(verifyUid);
          this.toastr.success('✅ Email verification successful! You may now log in.');
          // Optional: Remove verifyUid from URL (simplify URL)
          this.router.navigate([], {
            replaceUrl: true,
            queryParams: {},
          });
        } catch (error) {
          this.toastr.error('❌ Email verification failed or link expired.');
        }
      }
    });
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

      await user.reload();

      const userDocRef = doc(this.firestore, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const userRole = userData['role'];
        let userStatus = userData['status'];

        console.log(`🔍 Firestore User Status: ${userStatus}`);

        if (userStatus === 'disabled') {
          this.toastr.error('Your account has been disabled. Please contact the administrator.', 'Access Denied');
          await signOut(this.auth);
          return;
        }

        if (userRole === 'admin') {
          console.log('✅ Admin detected. Skipping email verification check.');
        } else if (userRole === 'staff' || userRole === 'voter') {
          if (user.emailVerified && userStatus !== 'verified') {
            console.log('⏳ Updating Firestore status to "verified"...');
            await setDoc(userDocRef, { status: 'verified' }, { merge: true });
            userStatus = 'verified';
          }

          if (userStatus !== 'verified') {
            this.toastr.warning('Please verify your email before logging in.', 'Email Not Verified');
            await signOut(this.auth);
            return;
          }
        }

        this.toastr.success('Welcome back!', 'Login Successful');

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
