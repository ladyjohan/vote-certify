

import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Timestamp } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterModule, FormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  registerForm: FormGroup;
  errorMessage = '';
  showTerms = false;
  showDataPrivacy = false;
  showPassword = false;
  passwordChecklistVisible = false;
  passwordStrength: 'weak' | 'medium' | 'strong' = 'weak';
  checklist = {
    lowerUpper: false,
    number: false,
    special: false,
    length: false
  };

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  /**
   * Sanitize the full name field on input (removes digits and disallowed characters).
   * This handles pasted content and composition results.
   */
  sanitizeFullName(event: Event) {
    const input = event.target as HTMLInputElement;
  // allow letters (including accented), spaces and dot (for middle initial); hyphen removed
  const sanitized = input.value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ \.]+/g, '');
    if (sanitized !== input.value) {
      // update form control without emitting valueChanges to avoid cycles
      this.registerForm.get('fullName')?.setValue(sanitized, { emitEvent: false });
    }
  }

  /**
   * Prevent typing disallowed characters. Control keys are allowed.
   */
  allowFullNameKeydown(event: KeyboardEvent) {
    const key = event.key;
    // allow control keys and navigation
    if (key.length > 1) {
      return;
    }
  // allow letters (including accented), spaces and dot — apostrophe and hyphen disallowed
  const allowed = /^[A-Za-zÀ-ÖØ-öø-ÿ \.]$/;
    if (!allowed.test(key)) {
      event.preventDefault();
    }
  }

  onPasswordInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.checklist.lowerUpper = /[a-z]/.test(value) && /[A-Z]/.test(value);
    this.checklist.number = /[0-9]/.test(value);
    this.checklist.special = /[^A-Za-z0-9]/.test(value);
    this.checklist.length = value.length >= 8;
    // Password strength logic
    const passed = Object.values(this.checklist).filter(Boolean).length;
    if (passed === 4) {
      this.passwordStrength = 'strong';
    } else if (passed >= 2) {
      this.passwordStrength = 'medium';
    } else {
      this.passwordStrength = 'weak';
    }
  }

  showPasswordChecklist() {
    this.passwordChecklistVisible = true;
  }

  hidePasswordChecklist() {
    this.passwordChecklistVisible = false;
  }
  showTermsModal(event: Event) {
    event.preventDefault();
    this.showTerms = true;
  }

  closeTermsModal() {
    this.showTerms = false;
  }

  showDataPrivacyModal(event: Event) {
    event.preventDefault();
    this.showDataPrivacy = true;
  }

  closeDataPrivacyModal() {
    this.showDataPrivacy = false;
  }

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private toastr: ToastrService
  ) {
    this.registerForm = this.fb.group({
      fullName: ['', [Validators.required]],
      birthdate: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      agreedToTerms: [false, [Validators.requiredTrue]],
      agreedToDataPrivacy: [false, [Validators.requiredTrue]]
    });
  }

  async register() {
    if (!this.registerForm.get('agreedToTerms')?.value) {
      this.toastr.error('You must agree to the Terms and Conditions and Privacy Policy before registering.', 'Registration Failed');
      return;
    }
    if (!this.registerForm.get('agreedToDataPrivacy')?.value) {
      this.toastr.error('You must agree to the Data Privacy Act of 2012 before registering.', 'Registration Failed');
      return;
    }
    if (this.registerForm.invalid) {
      this.toastr.error('Please fill out all fields correctly.', 'Registration Failed');
      return;
    }
    if (!this.checklist.lowerUpper || !this.checklist.number || !this.checklist.length) {
      this.toastr.error('Your password does not meet all requirements.', 'Registration Failed');
      return;
    }

    this.errorMessage = '';
    const { fullName, birthdate, email, password } = this.registerForm.value;

    try {
      // Convert birthdate to Firestore Timestamp (for future use if needed)
      const selectedDate = new Date(birthdate);
      selectedDate.setHours(0, 0, 0, 0);
      const birthdateTimestamp = Timestamp.fromDate(selectedDate);

      // Call AuthService to handle registration
      await this.authService.register(fullName, birthdate, email, password);

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

      let errorMsg = 'Registration failed. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMsg = 'This email is already registered.';
      } else if (error.code === 'auth/weak-password') {
        errorMsg = 'Password must be at least 6 characters.';
      }
      this.toastr.error(errorMsg, 'Registration Failed');
    }
  }

  agreeToTerms() {
    this.registerForm.get('agreedToTerms')?.setValue(true);
    this.showTerms = false;
  }

  agreeToDataPrivacy() {
    this.registerForm.get('agreedToDataPrivacy')?.setValue(true);
    this.showDataPrivacy = false;
  }
}
