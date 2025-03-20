import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  registerForm: FormGroup;
  errorMessage = '';

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.registerForm = this.fb.group({
      fullName: ['', [Validators.required]],
      voterId: ['', [Validators.required, Validators.pattern(/^\d{4}-\d{6}-\d{4}$/)]], // Format: 1234-567890-1234
      birthdate: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  async register() {
    if (this.registerForm.invalid) {
      this.errorMessage = 'Please fill out all fields correctly.';
      return;
    }

    this.errorMessage = '';

    const { fullName, voterId, birthdate, email, password } = this.registerForm.value;
    try {
      await this.authService.register(fullName, voterId, birthdate, email, password);
      alert('Registration successful! Please check your email for verification.');
      this.router.navigate(['/login']);
    } catch (error: any) {
      this.errorMessage = error.message || 'Registration failed. Please try again.';
      console.error('Registration error:', error);
    }
  }
}
