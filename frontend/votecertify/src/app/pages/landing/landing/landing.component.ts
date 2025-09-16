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
  dropdownOpen = false;
  showModal = false;
  videoSrc = 'assets/videos/votecertify_process.mp4';

subtitles = {
  en: [
    { start: 7, end: 10, text: "How to Request Your Voter’s Certificate Online" },
    { start: 11, end: 15, text: "Step 1: Register and log in to the system." },
    { start: 17, end: 22, text: "Step 2: Fill out the request form and attach your IDs for verification." },
    { start: 24, end: 28, text: "Step 3: Submit your request and wait for approval." },
    { start: 30, end: 36, text: "Step 4: Once your request is approved, you will receive an email with your pickup date for your voter’s certificate." },
    { start: 38, end: 43, text: "Step 5: Claim your voter’s certificate and pay the fee at the COMELEC office." },
    { start: 44, end: 49, text: "Congratulations! You now have your voter’s certificate." }
  ],
  tl: [
    { start: 7, end: 10, text: "Paano Mag-request ng Iyong Voter’s Certificate Online" },
    { start: 11, end: 15, text: "Hakbang 1: Magrehistro at mag-login sa sistema." },
    { start: 17, end: 22, text: "Hakbang 2: Punan ang request form at ilakip ang iyong mga ID para sa beripikasyon." },
    { start: 24, end: 28, text: "Hakbang 3: Isumite ang iyong request at maghintay ng pag-apruba." },
    { start: 30, end: 36, text: "Hakbang 4: Kapag naaprubahan ang iyong request, makakatanggap ka ng email na may petsa ng pag-kuha ng iyong voter’s certificate." },
    { start: 38, end: 43, text: "Hakbang 5: Kunin ang iyong voter’s certificate at magbayad sa opisina ng COMELEC." },
    { start: 44, end: 49, text: "Binabati kita! Mayroon ka nang voter’s certificate." }
  ]
};

subtitleLang: 'en' | 'tl' | 'off' = 'en';
currentSubtitle = '';


  constructor(private router: Router) {}

  goToLogin() {
    this.showModal = false;
    this.router.navigate(['/login']);
  }

  goToRegister() {
    this.showModal = false;
    this.router.navigate(['/register']);
  }

  onVideoTimeUpdate(event: Event) {
    const video = event.target as HTMLVideoElement;
    const time = video.currentTime;
    if (this.subtitleLang === 'off') {
      this.currentSubtitle = '';
      return;
    }
    const subs = this.subtitles[this.subtitleLang];
    const found = subs.find(s => time >= s.start && time < s.end);
    this.currentSubtitle = found ? found.text : '';
  }

  setSubtitleLang(lang: 'en' | 'tl' | 'off') {
    this.subtitleLang = lang;
    if (lang === 'off') {
      this.currentSubtitle = '';
    }
  }
}
