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
      voterId: ['', [Validators.required, Validators.pattern(/^\d{4}-\d{6}-\d{4}$/)]],
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

    const selectedDate = new Date(birthdate);
    selectedDate.setHours(0, 0, 0, 0);
    const birthdateTimestamp = Timestamp.fromDate(selectedDate);

    const voterPoolRef = collection(this.firestore, 'voter_pool');
    const q = query(voterPoolRef, where('fullName', '==', fullName), where('voterId', '==', voterId));

    try {
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        this.toastr.error('You are not an official voter. Registration denied.', 'Verification Failed');
        return;
      }

      let voterFound = false;

      querySnapshot.forEach((doc) => {
        const voterData = doc.data();
        const storedTimestamp: Timestamp = voterData['birthdate'];

        const storedDate = storedTimestamp.toDate();
        storedDate.setHours(0, 0, 0, 0);

        if (selectedDate.getTime() === storedDate.getTime()) {
          voterFound = true;
        }
      });

      if (!voterFound) {
        this.toastr.error('You are not an official voter. Registration denied.', 'Verification Failed');
        return;
      }

      await this.authService.register(fullName, voterId, birthdate, email, password);

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
