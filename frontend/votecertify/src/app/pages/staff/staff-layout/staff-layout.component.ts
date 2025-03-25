import { Component } from '@angular/core';
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
export class StaffLayoutComponent { }
