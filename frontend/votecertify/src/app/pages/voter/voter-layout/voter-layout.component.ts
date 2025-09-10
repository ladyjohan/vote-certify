import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { VoterSidenavComponent } from '../voter-sidenav/voter-sidenav.component';

@Component({
  selector: 'app-voter-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, VoterSidenavComponent],
  templateUrl: './voter-layout.component.html',
  styleUrls: ['./voter-layout.component.scss']
})
export class VoterLayoutComponent implements OnInit {
  isSidenavOpen = false;
  currentDateTime: string = '';
  showSidenav = true; // 👈 new flag

  constructor(private router: Router, private activatedRoute: ActivatedRoute) {}

  ngOnInit(): void {
    this.updateDateTime();
    setInterval(() => this.updateDateTime(), 1000);

    // check immediately
    this.updateSidenavVisibility();

    // update on route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.updateSidenavVisibility();
    });
  }

  toggleSidenav() {
    this.isSidenavOpen = !this.isSidenavOpen;
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

  private updateSidenavVisibility() {
    let current = this.activatedRoute;
    while (current.firstChild) {
      current = current.firstChild;
    }
    const hide = current.snapshot.data?.['hideSidenav'] === true;
    this.showSidenav = !hide;
  }
}
