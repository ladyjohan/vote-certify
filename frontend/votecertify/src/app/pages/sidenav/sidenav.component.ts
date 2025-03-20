import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './sidenav.component.html',
  styleUrls: ['./sidenav.component.scss']
})
export class SidenavComponent {
  @Input() userRole: string | null = null; // Passed from app.component.ts

  constructor(private authService: AuthService, private router: Router) {}

  /** ✅ Logout Function */
  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}
