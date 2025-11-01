

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
    // allow letters (including accented), spaces and hyphens (no apostrophes)
    const sanitized = input.value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ \-]+/g, '');
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
    // allow letters (including accented), spaces and hyphens — apostrophe disallowed
    const allowed = /^[A-Za-zÀ-ÖØ-öø-ÿ \-]$/;
    if (!allowed.test(key)) {
      event.preventDefault();
    }
  }

  /**
   * Sanitize the voterId input to allow only letters and numbers (remove other characters).
   */
  sanitizeVoterId(event: Event) {
    const input = event.target as HTMLInputElement;
    // remove non-alphanumeric characters
    let sanitized = input.value.replace(/[^A-Za-z0-9]+/g, '');
    // convert to uppercase so it matches the pattern (e.g., 123A)
    const upper = sanitized.toUpperCase();
    if (upper !== input.value) {
      // preserve caret position
      const start = input.selectionStart ?? upper.length;
      const end = input.selectionEnd ?? upper.length;
      input.value = upper;
      // set form control value without emitting change events
      this.registerForm.get('voterId')?.setValue(upper, { emitEvent: false });
      // restore caret (clamp to length)
      const len = upper.length;
      const newStart = Math.min(start, len);
      const newEnd = Math.min(end, len);
      try {
        input.setSelectionRange(newStart, newEnd);
      } catch (e) {
        // ignore if unable to set selection
      }
    }
  }

  /**
   * Prevent typing non-alphanumeric characters in the voterId field.
   */
  allowVoterIdKeydown(event: KeyboardEvent) {
    const key = event.key;
    // allow control / navigation keys (length>1 covers keys like Backspace, Tab, Enter, Arrow keys)
    if (key.length > 1) {
      return;
    }
    const allowed = /^[A-Za-z0-9]$/;
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
      agreedToTerms: [false, [Validators.requiredTrue]]
    });
  }

  async register() {
    if (!this.registerForm.get('agreedToTerms')?.value) {
      this.toastr.error('You must agree to the Terms and Conditions before registering.', 'Registration Failed');
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
}
