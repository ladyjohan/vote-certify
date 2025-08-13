import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Timestamp } from '@angular/fire/firestore';

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

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private toastr: ToastrService
  ) {
    this.registerForm = this.fb.group({
      fullName: ['', [Validators.required]],
      voterId: ['', [Validators.required, Validators.pattern(/^[0-9]{3}[A-Z]{1}$/)]],
      birthdate: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  async register() {
    if (this.registerForm.invalid) {
      this.toastr.error('Please fill out all fields correctly.', 'Registration Failed');
      return;
    }

    this.errorMessage = '';
    const { fullName, voterId, birthdate, email, password } = this.registerForm.value;

    try {
      // Convert birthdate to Firestore Timestamp (for future use if needed)
      const selectedDate = new Date(birthdate);
      selectedDate.setHours(0, 0, 0, 0);
      const birthdateTimestamp = Timestamp.fromDate(selectedDate);

      // Call AuthService to handle registration
      await this.authService.register(fullName, voterId, birthdate, email, password);

      // Show success toast
      this.toastr.success(
        'Registration successful! Please check your email for the verification link.',
        'Success'
      );

      // Logout silently to clear auth state but DO NOT redirect
      await this.authService.logout(false);

      // Reset form after successful registration
      this.registerForm.reset();
    } catch (error: any) {
      console.error('Registration error:', error);

      if (error.code === 'auth/email-already-in-use') {
        this.errorMessage = 'This email is already registered.';
      } else if (error.code === 'auth/weak-password') {
        this.errorMessage = 'Password must be at least 6 characters.';
      } else {
        this.errorMessage = 'Registration failed. Please try again.';
      }

      this.toastr.error(this.errorMessage, 'Registration Failed');
    }
  }
}
