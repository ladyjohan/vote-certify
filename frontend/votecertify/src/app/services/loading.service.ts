import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private messageSubject = new BehaviorSubject<string>('Loading...');
  
  /** Observable to track loading state */
  loading$ = this.loadingSubject.asObservable();
  
  /** Observable to track current loading message */
  message$ = this.messageSubject.asObservable();
  
  private startTime: number = 0;
  private readonly MIN_DISPLAY_TIME = 500; // Minimum display time in ms

  /**
   * Shows the loading overlay with an optional message
   * @param message The message to display (e.g., "Signing in...")
   */
  show(message: string = 'Loading...') {
    this.messageSubject.next(message);
    this.loadingSubject.next(true);
    this.startTime = Date.now();
  }

  /**
   * Hides the loading overlay, ensuring it has been displayed for at least MIN_DISPLAY_TIME
   */
  async hide() {
    const elapsedTime = Date.now() - this.startTime;
    const remainingTime = Math.max(0, this.MIN_DISPLAY_TIME - elapsedTime);
    
    if (remainingTime > 0) {
      await new Promise(resolve => setTimeout(resolve, remainingTime));
    }
    
    this.loadingSubject.next(false);
  }
}
