import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { getAuth, applyActionCode } from 'firebase/auth';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.scss']
})
export class VerifyEmailComponent implements OnInit {
  isVerified: boolean | null = null; // null = loading, true = success, false = fail
  loading = true;
  message = '';

  private auth = getAuth();

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    public router: Router
  ) {}

  async ngOnInit() {
    this.isVerified = null;
    this.loading = true;
    this.message = 'Verifying your email, please wait...';

    // The Firebase email verification code parameter
    const oobCode = this.route.snapshot.queryParamMap.get('oobCode');
    let uid = this.route.snapshot.queryParamMap.get('uid');

    if (!oobCode) {
      this.isVerified = false;
      this.loading = false;
      this.message = '❌ Invalid verification link - missing verification code.';
      console.error('❌ No oobCode provided');
      return;
    }

    try {
      console.log('🔍 Starting email verification process...');
      console.log('📍 oobCode:', oobCode.substring(0, 20) + '...');
      console.log('📍 uid from URL:', uid);

      // Apply the verification code to verify email in Firebase Auth
      console.log('⏳ Applying action code in Firebase Auth...');
      await applyActionCode(this.auth, oobCode);
      console.log('✅ Action code applied successfully');

      // Reload current user to refresh emailVerified flag
      const user = this.auth.currentUser;
      console.log('👤 Current user:', user?.email, '| UID:', user?.uid);
      
      if (user) {
        await user.reload();
        console.log('🔄 User reloaded. emailVerified:', user.emailVerified);
      }

      // If uid wasn't provided in URL, use the currently authenticated user's uid
      if (!uid && user) {
        uid = user.uid;
        console.log('ℹ️  UID not in URL, using current user UID:', uid);
      }

      if (!uid) {
        throw new Error('Cannot determine user ID for verification');
      }

      if (user?.emailVerified) {
        console.log('📝 Email is verified in Firebase Auth, updating Firestore...');
        // Now update Firestore user status to verified
        try {
          await this.authService.verifyEmail(uid);
          console.log('✅ Firestore status updated successfully');
          
          this.isVerified = true;
          this.message = '✅ Your email has been successfully verified! You may now log in.';
        } catch (firestoreError) {
          console.error('❌ Failed to update Firestore:', firestoreError);
          this.isVerified = false;
          this.message = '⚠️ Email verified but failed to update account. Please try logging in.';
        }
      } else {
        this.isVerified = false;
        this.message = '❌ Email not verified in Firebase. Please check your email and try again.';
        console.warn('⚠️ Firebase emailVerified flag is still false after applying action code');
      }
    } catch (error: any) {
      console.error('❌ Error verifying email:', error);
      
      // Provide specific error messages for common issues
      if (error.code === 'auth/expired-action-code') {
        this.message = '❌ Verification link has expired. Please request a new verification email.';
      } else if (error.code === 'auth/invalid-action-code') {
        this.message = '❌ Invalid verification link. Please check the link and try again.';
      } else if (error.message && error.message.includes('User document not found')) {
        this.message = '❌ User account not found. Please contact support.';
      } else {
        this.message = '❌ Verification failed. Please try again or contact support.';
      }
      
      this.isVerified = false;
    } finally {
      this.loading = false;
    }

    // Optional: auto-redirect after delay
    if (this.isVerified) {
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 5000);
    }
  }
}
