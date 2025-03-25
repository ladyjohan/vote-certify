import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, FormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage = '';
  loading = false; // ✅ Added to disable button when logging in

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  async login() {
    if (this.loginForm.invalid) {
      this.errorMessage = 'Please enter a valid email and password.';
      return;
    }

    this.errorMessage = '';
    this.loading = true; // ✅ Disable login button while processing

    const { email, password } = this.loginForm.value;
    try {
      await this.authService.login(email, password); // ✅ AuthService already handles redirection
      alert('Login successful!');
    } catch (error: any) {
      this.errorMessage = error.message || 'Login failed. Please try again.';
      console.error('Login error:', error);
    } finally {
      this.loading = false; // ✅ Re-enable login button
    }
  }
}
