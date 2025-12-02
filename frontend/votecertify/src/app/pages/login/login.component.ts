import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

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
      console.log('🔐 Calling authService.login()...');
      // Use the auth service which handles login history logging
      await this.authService.login(email, password);
      this.toastr.success('Welcome back!', 'Login Successful');
      // Navigation is handled by authService.redirectUser()
    } catch (error: any) {
      console.error('Login Error:', error);

      // Check if error is a custom validation error (verification, profile check, etc.)
      if (error.message && error.message.includes('verification')) {
        this.errorMessage = error.message;
        this.toastr.warning(this.errorMessage, 'Verification Required');
      } else if (error.code === 'auth/user-not-found') {
        this.errorMessage = 'No account found with this email.';
        this.toastr.error(this.errorMessage, 'Login Failed');
      } else if (error.code === 'auth/wrong-password') {
        this.errorMessage = 'Incorrect password. Please try again.';
        this.toastr.error(this.errorMessage, 'Login Failed');
      } else if (error.code === 'auth/invalid-email') {
        this.errorMessage = 'Invalid email format.';
        this.toastr.error(this.errorMessage, 'Login Failed');
      } else if (error.message) {
        // Handle other custom errors from auth service
        this.errorMessage = error.message;
        this.toastr.error(this.errorMessage, 'Login Failed');
      } else {
        this.errorMessage = 'Login failed. Please check your credentials.';
        this.toastr.error(this.errorMessage, 'Login Failed');
      }
    } finally {
      this.loading = false;
    }
  }
}
