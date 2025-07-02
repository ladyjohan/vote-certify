import { Injectable, inject, NgZone } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User,
} from '@angular/fire/auth';

import {
  browserSessionPersistence,
  setPersistence,
  onAuthStateChanged,
} from 'firebase/auth';

import { Firestore, doc, setDoc, getDoc, updateDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import emailjs from 'emailjs-com';


@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth: Auth;
  private firestore: Firestore;
  private router: Router;
  private zone: NgZone;
  private user: User | null = null;

  // ✅ EmailJS Configuration
  private EMAIL_JS_SERVICE_ID = 'service_rrb00wy';
  private EMAIL_JS_TEMPLATE_ID = 'template_vos13me';
  private EMAIL_JS_PUBLIC_KEY = 'VrHsZ86VVPD_U6TsA';

  constructor() {
    this.auth = inject(Auth);
    this.firestore = inject(Firestore);
    this.router = inject(Router);
    this.zone = inject(NgZone);

    this.initializeAuthState();
  }

  /** ✅ Initialize Auth State */
  private async initializeAuthState() {
    try {
      await setPersistence(this.auth, browserSessionPersistence);

      onAuthStateChanged(this.auth, async (user) => {
        this.zone.run(async () => {  // ✅ Ensures Angular change detection is aware
          const currentUrl = this.router.url;

          if (user) {
            console.log('✅ User authenticated:', user.email);
            this.user = user;

            const userRole = await this.getUserRole(user.uid);
            console.log('🔄 User role:', userRole);

            if (currentUrl.startsWith('/verify-email') || currentUrl === '/login') return;

            if (!user.emailVerified) {
              this.router.navigate(['/verify-email']);
            }
          } else {
            console.warn('⚠️ No user found. Redirecting to login.');
            this.router.navigate(['/login']);
          }
        });
      });
    } catch (error) {
      console.error('❌ Error setting auth persistence:', error);
    }
  }

  /** ✅ Register & Send Verification + Password via EmailJS */
  async register(fullName: string, precinctId: string, birthdate: string, email: string, password: string) {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      const uid = userCredential.user.uid;
      const verificationLink = `https://vote-certify-5e2ee.web.app/verify-email?email=${email}&uid=${uid}`;


      await setDoc(doc(this.firestore, 'users', uid), {
        fullName,
        precinctId,
        birthdate,
        email,
        role: 'voter',
        status: 'pending' // Pending until email verification
      });

      console.log('✅ User registered successfully. Sending verification link & password...');
      await this.sendVerificationAndPasswordEmail(fullName, email, password, verificationLink);

      return userCredential;
    } catch (error: any) {
      console.error('❌ Registration Error:', error.message);
      throw new Error(error.message || 'Registration failed. Please try again.');
    }
  }

  /** ✅ Send Verification Link & Password via EmailJS */
  private async sendVerificationAndPasswordEmail(name: string, email: string, password: string, verificationLink: string) {
    const emailParams = {
      name: name,
      email: email,
      user_password: password,
      verification_link: verificationLink
    };

    try {
      await emailjs.send(
        this.EMAIL_JS_SERVICE_ID,
        this.EMAIL_JS_TEMPLATE_ID,
        emailParams,
        this.EMAIL_JS_PUBLIC_KEY
      );

      console.log('✅ Verification & Password Email sent successfully to:', email);
    } catch (error) {
      console.error('❌ Error sending email:', error);
    }
  }

  /** ✅ Login user & ensure session persists */
  async login(email: string, password: string) {
    try {
      await setPersistence(this.auth, browserSessionPersistence);

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

      // ✅ Skip email verification for Admin and Staff
      if (userRole === 'admin') {
        console.log('✅ Admin detected. Skipping email verification.');
      } else {
        await user.reload(); // Ensure latest verification status

        const userRef = doc(this.firestore, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (!user.emailVerified) {
          console.error('⚠️ Email not verified. Logging out.');
          await this.logout();
          throw new Error('Please verify your email before logging in.');
        }

        if (!userSnap.exists() || userSnap.data()['status'] !== 'verified') {
          console.error('⚠️ Account verification issue. Logging out.');
          await this.logout();
          throw new Error('Your account verification is pending. Please contact support.');
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
    voter: '/voter/request-form',
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
      this.zone.run(() => {  // Ensures Angular change detection is aware
        if (user) {
          this.user = user;
          resolve(user);
        } else {
          resolve(null);
        }
      });
    });
  });
}


/** ✅ Fetch user role from Firestore */
async getUserRole(uid: string): Promise<string | null> {
  try {
    // Ensure the Firebase API call runs inside Angular's zone
    return await this.zone.run(() => {
      const userRef = doc(this.firestore, 'users', uid);
      return getDoc(userRef).then((userSnap) => {
        if (userSnap.exists()) {
          return userSnap.data()['role'];
        }
        return null;
      });
    });
  } catch (error) {
    console.error('❌ Error fetching user role:', error);
    return null;
  }
}

/** ✅ Verify Email in Firestore */
async verifyEmail(uid: string) {
  try {
    this.zone.run(async () => {  // Ensures Angular change detection is aware
      const userRef = doc(this.firestore, 'users', uid);
      await updateDoc(userRef, { status: 'verified' });
      console.log('✅ Email verified in Firestore.');
    });
  } catch (error) {
    console.error('❌ Error verifying email:', error);
  }
}


  /** ✅ Log out user */
  async logout() {
    try {
      console.log('⚠️ Logging out user:', this.user?.email);
      await signOut(this.auth);

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
