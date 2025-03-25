import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { VoterSidenavComponent } from '../voter-sidenav/voter-sidenav.component';

@Component({
  selector: 'app-voter-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, VoterSidenavComponent], // ✅ Import necessary components
  templateUrl: './voter-layout.component.html',
  styleUrls: ['./voter-layout.component.scss']
})
export class VoterLayoutComponent { }
