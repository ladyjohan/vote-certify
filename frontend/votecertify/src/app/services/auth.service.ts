import { Injectable, inject, NgZone } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  User
} from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private router = inject(Router);
  private zone = inject(NgZone);

  /** ✅ Register a new voter & send verification email */
  async register(fullName: string, voterId: string, birthdate: string, email: string, password: string) {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);

      await sendEmailVerification(userCredential.user); // Send email verification

      await setDoc(doc(this.firestore, 'users', userCredential.user.uid), {
        fullName,
        voterId,
        birthdate,
        email,
        role: 'voter',
        status: 'pending' // Pending until verified
      });

      return userCredential;
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error.message || 'Registration failed. Please try again.');
    }
  }

  /** ✅ Log in user (only if email is verified) */
  async login(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);

      if (!userCredential.user.emailVerified) {
        await signOut(this.auth); // Log them out immediately
        throw new Error('Please verify your email before logging in.');
      }

      const userRole = await this.getUserRole(userCredential.user.uid);

      if (!userRole) {
        throw new Error('User role not found. Contact support.');
      }

      // Redirect based on role
      if (userRole === 'admin') {
        this.router.navigate(['/admin-dashboard']);
      } else if (userRole === 'staff') {
        this.router.navigate(['/staff-dashboard']);
      } else {
        this.router.navigate(['/voter-dashboard']);
      }

      return userCredential;
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Invalid email or password.');
    }
  }

    /** ✅ Check if user is authenticated */
  isUserLoggedIn(): Promise<boolean> {
    return new Promise((resolve) => {
      onAuthStateChanged(this.auth, (user) => {
        resolve(!!user);
      });
    });
  }

  /** ✅ Log out user & redirect to login page */
  async logout() {
    try {
      await signOut(this.auth);
      this.router.navigate(['/login']);
    } catch (error: any) {
      console.error('Logout error:', error);
    }
  }

  /** ✅ Get the currently logged-in user */
getCurrentUser(): Promise<User | null> {
  return new Promise((resolve, reject) => {
    this.zone.runOutsideAngular(() => {
      onAuthStateChanged(this.auth, (user) => {
        this.zone.run(() => {
          resolve(user);
        });
      }, reject);
    });
  });
}


/** ✅ Fetch user role from Firestore */
async getUserRole(uid: string): Promise<string | null> {
  return this.zone.runOutsideAngular(async () => {
    try {
      const userRef = doc(this.firestore, 'users', uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        return this.zone.run(() => userSnap.data()['role']); // Return user role
      }
      return null;
    } catch (error: any) {
      console.error('Error fetching user role:', error);
      return null;
    }
  });
}
}
