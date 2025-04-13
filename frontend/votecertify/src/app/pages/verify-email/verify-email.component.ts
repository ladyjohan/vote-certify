import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.scss']
})
export class VerifyEmailComponent implements OnInit {
  isVerified: boolean | null = null;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    const uid = this.route.snapshot.queryParamMap.get('uid');

    if (uid) {
      this.authService.verifyEmail(uid)
        .then(() => {
          console.log('✅ Email verified successfully.');
          this.isVerified = true;
        })
        .catch((error) => {
          console.error('❌ Error verifying email:', error);
          this.isVerified = false;
        });
    } else {
      this.isVerified = false;
    }
  }
}
