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
import { ToastrService } from 'ngx-toastr';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private router: Router = inject(Router);
  private zone: NgZone = inject(NgZone);
  private toastr: ToastrService = inject(ToastrService);
  private user: User | null = null;

  // EmailJS Configuration
  private EMAIL_JS_SERVICE_ID = 'service_rrb00wy';
  private EMAIL_JS_TEMPLATE_ID = 'template_vos13me';
  private EMAIL_JS_PUBLIC_KEY = 'VrHsZ86VVPD_U6TsA';

  constructor() {
    this.initializeAuthState();
  }

  /** Initialize Auth State */
  private async initializeAuthState() {
    try {
      await setPersistence(this.auth, browserSessionPersistence);

      onAuthStateChanged(this.auth, async (user) => {
        this.zone.run(async () => {
          if (user) {
            console.log('✅ User authenticated:', user.email);
            this.user = user;
            const userRole = await this.getUserRole(user.uid);
            console.log('🔄 User role:', userRole);
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

  /** Register & Send Verification + Password via EmailJS */
  async register(fullName: string, voterId: string, birthdate: string, email: string, password: string) {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      const uid = userCredential.user.uid;
      const verificationLink = `https://vote-certify-5e2ee.web.app/verify-email?email=${email}&uid=${uid}`;

      await setDoc(doc(this.firestore, 'users', uid), {
        fullName,
        voterId,
        birthdate,
        email,
        role: 'voter',
        status: 'pending', // Pending until email verification
      });

      console.log('✅ User registered successfully. Sending verification link & password...');
      await this.sendVerificationAndPasswordEmail(fullName, email, password, verificationLink);

      // Immediately log the user out silently after registration (no navigation)
      await this.logout(false);
      this.user = null;

      return userCredential;
    } catch (error: any) {
      console.error('❌ Registration Error:', error.message || error);
      throw error;
    }
  }

  /** Send Verification Link & Password via EmailJS */
  private async sendVerificationAndPasswordEmail(name: string, email: string, password: string, verificationLink: string) {
    const emailParams = {
      name,
      email,
      user_password: password,
      verification_link: verificationLink,
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

  /** Login user & ensure session persists */
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

      // Skip email verification for Admin
      if (userRole !== 'admin') {
        await user.reload(); // Ensure latest verification status

        if (!user.emailVerified) {
          this.toastr.warning('Please verify your email before logging in.');
          await this.logout();
          return;
        }

        const userSnap = await getDoc(doc(this.firestore, 'users', user.uid));
        if (!userSnap.exists() || userSnap.data()['status'] !== 'verified') {
          this.toastr.warning('Your account verification is pending.');
          await this.logout();
          return;
        }
      }

      this.redirectUser(userRole);
      return userCredential;
    } catch (error: any) {
      console.error('❌ Login Error:', error.message || error);
      throw error;
    }
  }

  /** Redirect user based on role */
  private redirectUser(role: string) {
    const roleRoutes: { [key: string]: string } = {
      admin: '/admin/dashboard',
      staff: '/staff/dashboard',
      voter: '/voter/request-form',
    };
    const route = roleRoutes[role];
    if (route) {
      this.zone.run(() => this.router.navigate([route]));
    } else {
      this.router.navigate(['/login']);
    }
  }

  /** Check if user is logged in */
  async isUserLoggedIn(): Promise<boolean> {
    return !!this.user;
  }

  /** Get current user */
  async getCurrentUser(): Promise<User | null> {
    return new Promise((resolve) => {
      onAuthStateChanged(this.auth, (user) => {
        this.zone.run(() => {
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

  /** Fetch user role from Firestore */
  async getUserRole(uid: string): Promise<string | null> {
    try {
      const userSnap = await getDoc(doc(this.firestore, 'users', uid));
      return userSnap.exists() ? (userSnap.data()['role'] as string) : null;
    } catch (error) {
      console.error('❌ Error fetching user role:', error);
      return null;
    }
  }

  /** Verify Email in Firestore */
  async verifyEmail(uid: string) {
    try {
      await updateDoc(doc(this.firestore, 'users', uid), { status: 'verified' });
      console.log('✅ Email verified in Firestore.');
    } catch (error) {
      console.error('❌ Error verifying email:', error);
    }
  }

  /** Log out user */
  async logout(redirect: boolean = true) {
    try {
      await signOut(this.auth);
      this.user = null;
      localStorage.clear();
      sessionStorage.clear();
      if (redirect) {
        this.router.navigate(['/login']);
      }
    } catch (error: any) {
      console.error('❌ Logout Error:', error);
    }
  }
}
