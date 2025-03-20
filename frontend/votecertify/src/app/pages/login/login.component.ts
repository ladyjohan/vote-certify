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

    const { email, password } = this.loginForm.value;
    try {
      const userCredential = await this.authService.login(email, password);
      const user = userCredential.user;

      if (!user.emailVerified) {
        await this.authService.logout();
        this.errorMessage = 'Please verify your email before logging in.';
        return;
      }

      // Ensure role is fetched properly
      const role = await this.authService.getUserRole(user.uid);
      if (!role) {
        throw new Error('User role not found.');
      }

      alert('Login successful!');

      // Redirect based on role
      switch (role) {
        case 'voter':
          this.router.navigate(['/voter-dashboard']);
          break;
        case 'staff':
          this.router.navigate(['/staff-dashboard']);
          break;
        case 'admin':
          this.router.navigate(['/admin-dashboard']);
          break;
        default:
          this.router.navigate(['/']);
      }

    } catch (error: any) {
      this.errorMessage = 'Invalid credentials. Please try again.';
      console.error('Login error:', error);
    }
  }
}
