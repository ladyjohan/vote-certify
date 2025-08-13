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
    const uid = this.route.snapshot.queryParamMap.get('uid');

    if (!oobCode || !uid) {
      this.isVerified = false;
      this.loading = false;
      this.message = '❌ Invalid verification link.';
      return;
    }

    try {
      // Apply the verification code to verify email in Firebase Auth
      await applyActionCode(this.auth, oobCode);

      // Reload current user to refresh emailVerified flag
      const user = this.auth.currentUser;
      if (user) {
        await user.reload();
      }

      if (user?.emailVerified) {
        // Now update Firestore user status to verified
        await this.authService.verifyEmail(uid);

        this.isVerified = true;
        this.message = '✅ Your email has been successfully verified! You may now log in.';
      } else {
        this.isVerified = false;
        this.message = '❌ Email not verified yet. Please check your email and try again.';
      }
    } catch (error) {
      console.error('❌ Error verifying email:', error);
      this.isVerified = false;
      this.message = '❌ Verification failed or link expired. Please try again or contact support.';
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
