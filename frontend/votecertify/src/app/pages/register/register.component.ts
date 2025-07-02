import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Firestore, collection, query, where, getDocs, Timestamp } from '@angular/fire/firestore';

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

  private firestore: Firestore = inject(Firestore);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastr: ToastrService
  ) {
    this.registerForm = this.fb.group({
      fullName: ['', [Validators.required]],
      precinctId: ['', [Validators.required, Validators.pattern(/^[0-9]{4}[A-Z]$/)]],
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

    const { fullName, precinctId, birthdate, email, password } = this.registerForm.value;

    try {
      await this.authService.register(fullName, precinctId, birthdate, email, password);

      this.toastr.success('Registration successful! Please check your email for verification.', 'Success');
      this.router.navigate(['/login']);
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
