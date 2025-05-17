import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { StaffSidenavComponent } from '../staff-sidenav/staff-sidenav.component';

@Component({
  selector: 'app-staff-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, StaffSidenavComponent], // ✅ Import necessary components
  templateUrl: './staff-layout.component.html',
  styleUrls: ['./staff-layout.component.scss']
})
export class StaffLayoutComponent {
  isSidenavOpen = false;
  currentDateTime: string = '';

toggleSidenav() {
  this.isSidenavOpen = !this.isSidenavOpen;
}

ngOnInit(): void {
  this.updateDateTime();
  setInterval(() => this.updateDateTime(), 1000);
}

updateDateTime(): void {
  const now = new Date();
  this.currentDateTime = now.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}
}

