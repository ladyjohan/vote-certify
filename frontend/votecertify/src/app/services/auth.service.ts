import { Injectable, inject, NgZone } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  User,
  setPersistence,
  browserLocalPersistence
} from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private router = inject(Router);
  private zone = inject(NgZone);
  private user: User | null = null;

  constructor() {
    this.initializeAuthState();
  }

  /** ✅ Initialize Auth State (Ensure session persists) */
  private async initializeAuthState() {
    try {
      await setPersistence(this.auth, browserLocalPersistence);

      onAuthStateChanged(this.auth, async (user) => {
        if (user) {
          console.log('✅ User authenticated:', user.email);
          this.user = user;
          const userRole = await this.getUserRole(user.uid);

          if (userRole) {
            console.log('🔄 User session valid. Keeping logged in.');
            return;
          }
        } else {
          console.warn('⚠️ No current user detected. Checking Firebase...');

          // 🔥 Force-check Firebase for current user (synchronous)
          setTimeout(async () => {
            const currentUser = this.auth.currentUser;
            if (currentUser) {
              console.log('✅ User found after delay:', currentUser.email);
              this.user = currentUser;
              return;
            }

            console.log('⚠️ Still no user detected. Redirecting to login.');
            this.router.navigate(['/login']);
          }, 2000);
        }
      });
    } catch (error) {
      console.error('❌ Error setting auth persistence:', error);
    }
  }

  /** ✅ Register a new voter & send verification email */
  async register(fullName: string, voterId: string, birthdate: string, email: string, password: string) {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      await sendEmailVerification(userCredential.user);

      await setDoc(doc(this.firestore, 'users', userCredential.user.uid), {
        fullName,
        voterId,
        birthdate,
        email,
        role: 'voter',
        status: 'pending' // Pending until email verification
      });

      return userCredential;
    } catch (error: any) {
      console.error('❌ Registration Error:', error.message);
      throw new Error(error.message || 'Registration failed. Please try again.');
    }
  }

  /** ✅ Login user & ensure session persists */
  async login(email: string, password: string) {
    try {
      // 🔥 Force set persistence to ensure session saving
      await setPersistence(this.auth, browserLocalPersistence);

      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;
      this.user = user;

      console.log('✅ User Logged In:', user.email, '| UID:', user.uid);

      const userRole = await this.getUserRole(user.uid);

      if (!userRole) {
        console.error('⚠️ User role not found. Logging out.');
        await this.logout();
        throw new Error('User role not found. Contact support.');
      }

      console.log('✅ User Role:', userRole);

      if (userRole === 'admin' || userRole === 'staff') {
        console.log('✅ Admin or Staff detected. Skipping email verification.');
      } else {
        if (!user.emailVerified) {
          console.error('⚠️ Email not verified. Logging out.');
          await this.logout();
          throw new Error('Please verify your email before logging in.');
        }
        console.log('✅ Voter verified. Proceeding to dashboard.');
      }

      this.redirectUser(userRole);
      return userCredential;
    } catch (error: any) {
      console.error('❌ Login Error:', error.message);
      throw new Error(error.message || 'Invalid email or password.');
    }
  }

  /** ✅ Redirect user based on role */
  private redirectUser(role: string) {
    const roleRoutes: { [key: string]: string } = {
      admin: '/admin/dashboard',
      staff: '/staff/dashboard',
      voter: '/voter/dashboard'
    };

    const route = roleRoutes[role];

    if (route) {
      console.log(`🔀 Redirecting to: ${route}`);
      this.zone.run(() => this.router.navigate([route]));
    } else {
      console.error('⚠️ Unknown role. Redirecting to login.');
      this.router.navigate(['/login']);
    }
  }

  /** ✅ Check if user is logged in */
  async isUserLoggedIn(): Promise<boolean> {
    return !!this.user;
  }

  /** ✅ Get the currently logged-in user */
  async getCurrentUser(): Promise<User | null> {
    return new Promise((resolve) => {
      onAuthStateChanged(this.auth, (user) => {
        if (user) {
          this.user = user; // ✅ Update only if a user exists
          resolve(user);
        } else {
          console.warn('⚠️ No current user detected, but not logging out immediately.');
          resolve(null);
        }
      });
    });
  }

  /** ✅ Fetch user role from Firestore (Retries up to 3 times) */
  async getUserRole(uid: string, retries = 3): Promise<string | null> {
    try {
      const userRef = doc(this.firestore, 'users', uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const role = userSnap.data()['role'];
        console.log('✅ Role Retrieved:', role);
        return role;
      }

      console.warn(`⚠️ No role found for UID: ${uid}. Retries left: ${retries}`);

      if (retries > 0) {
        return new Promise((resolve) => {
          setTimeout(async () => {
            resolve(await this.getUserRole(uid, retries - 1));
          }, 2000);
        });
      }

      console.error('❌ User role could not be retrieved after multiple attempts.');
      return null;
    } catch (error: any) {
      console.error('❌ Error fetching user role:', error);
      return null;
    }
  }

  /** ✅ Log out user */
  async logout() {
    try {
      console.log('⚠️ Logging out user:', this.user?.email);
      await signOut(this.auth);

      // 🔥 Ensure Firebase session is fully cleared
      this.user = null;
      localStorage.clear();
      sessionStorage.clear();

      console.log('✅ User Logged Out.');
      this.router.navigate(['/login']);
    } catch (error: any) {
      console.error('❌ Logout Error:', error);
    }
  }
}
