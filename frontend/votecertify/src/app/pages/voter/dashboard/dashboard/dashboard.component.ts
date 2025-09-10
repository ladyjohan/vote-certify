import { Component, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard-video',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class VoterDashboardComponent {
  @ViewChild('videoPlayer', { static: true }) videoPlayer!: ElementRef<HTMLVideoElement>;

  videoSrc = 'assets/videos/votecertify_process.mp4';


  isPlaying = false;
  isMuted = false;
  errorMessage = '';

  playPause(): void {
    const v = this.videoPlayer.nativeElement;
    if (v.paused) {
      v.play().then(() => this.isPlaying = true).catch(err => {
        this.errorMessage = 'Unable to play video (autoplay blocked / file missing).';
        console.error(err);
      });
    } else {
      v.pause();
      this.isPlaying = false;
    }
  }

  muteToggle(): void {
    const v = this.videoPlayer.nativeElement;
    v.muted = !v.muted;
    this.isMuted = v.muted;
  }

  enterFullscreen(): void {
    const v = this.videoPlayer.nativeElement as any;
    if (v.requestFullscreen) v.requestFullscreen();
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); // iOS fallback
  }

  onLoadedMetadata(): void {
    this.errorMessage = '';
  }

  onError(): void {
    this.errorMessage = `Video failed to load. Check that "${this.videoSrc}" exists in src/assets/videos/`;
  }

  scrollToVideo() {
    const element = document.getElementById('video');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
