import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { LoadingService } from '../../../services/loading.service';

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loading-overlay.component.html',
  styleUrls: ['./loading-overlay.component.scss'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class LoadingOverlayComponent {
  loadingService = inject(LoadingService);
}

