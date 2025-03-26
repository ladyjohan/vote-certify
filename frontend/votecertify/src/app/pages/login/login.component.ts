import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router, RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule], // ✅ Added RouterModule for navigation
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage: string = '';
  loading = false; // ✅ Prevents multiple submissions

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastr: ToastrService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  async login() {
    if (this.loginForm.invalid) {
      this.errorMessage = 'Please enter a valid email and password.';
      this.toastr.error(this.errorMessage, 'Login Failed');
      return;
    }

    this.errorMessage = '';
    this.loading = true;
    const { email, password } = this.loginForm.value;

    try {
      await this.authService.login(email, password);
      this.toastr.success('Welcome back!', 'Login Successful');
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      console.error('Login Error:', error); // Log full error for debugging

      // ✅ Customize error messages
      if (error.code === 'auth/user-not-found') {
        this.errorMessage = 'No account found with this email.';
      } else if (error.code === 'auth/wrong-password') {
        this.errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        this.errorMessage = 'Invalid email format. Please check your email.';
      } else {
        this.errorMessage = 'Login failed. Please check your credentials.';
      }

      this.toastr.error(this.errorMessage, 'Login Failed');
    } finally {
      this.loading = false;
    }
  }
}
