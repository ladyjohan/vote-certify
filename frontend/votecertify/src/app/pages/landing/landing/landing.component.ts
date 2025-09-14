import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent {
  showModal = false;
  videoSrc = 'assets/videos/votecertify_process.mp4';
  constructor(private router: Router) {}

  goToLogin() {
    this.showModal = false;
    this.router.navigate(['/login']);
  }

  goToRegister() {
    this.showModal = false;
    this.router.navigate(['/register']);
  }
}
