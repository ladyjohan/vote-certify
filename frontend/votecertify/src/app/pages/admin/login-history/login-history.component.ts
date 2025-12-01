import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoginHistoryService, LoginHistoryRecord } from '../../../services/login-history.service';
import { Subject, takeUntil, interval } from 'rxjs';

@Component({
  selector: 'app-login-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-history.component.html',
  styleUrls: ['./login-history.component.scss'],
})
export class LoginHistoryComponent implements OnInit, OnDestroy {
  loginHistory: LoginHistoryRecord[] = [];
  filteredHistory: LoginHistoryRecord[] = [];
  isLoading = false;
  searchTerm = '';
  filterRole: 'all' | 'admin' | 'staff' = 'all';

  // Pagination - changed to 5 items per page
  pageSize = 5;
  currentPage = 1;
  totalPages = 1;

  // For real-time duration updates
  currentTime = new Date();

  private destroy$ = new Subject<void>();

  constructor(private loginHistoryService: LoginHistoryService) {}

  ngOnInit(): void {
    // Subscribe to real-time updates
    this.loginHistoryService
      .getLoginHistoryRealtime(500)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (history) => {
          console.log('✅ Real-time update received. Records:', history.length);
          
          // Filter out any voter records - only show admin and staff
          const filtered = history.filter((record: any) => record.role === 'admin' || record.role === 'staff');
          console.log('🔐 After filtering voters. Records:', filtered.length);
          
          // Debug: Show logout timestamps for any logged-out users
          const loggedOut = filtered.filter(r => r.status === 'logged_out');
          if (loggedOut.length > 0) {
            console.log('📊 Logged out records found:', loggedOut.length);
            loggedOut.forEach(r => {
              console.log('  -', r.userEmail, 'logoutTimestamp:', r.logoutTimestamp, 'type:', typeof r.logoutTimestamp);
            });
          }
          
          this.loginHistory = filtered;
          this.applyFilters();
        },
        error: (error) => {
          console.error('❌ Error in real-time listener:', error);
        },
      });

    // Update current time every second for ongoing session durations
    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.currentTime = new Date();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  applyFilters(): void {
    let filtered = [...this.loginHistory];

    // Filter by search term
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (record) =>
          record.userName.toLowerCase().includes(term) ||
          record.userEmail.toLowerCase().includes(term)
      );
    }

    // Filter by role
    if (this.filterRole !== 'all') {
      filtered = filtered.filter((record) => record.role === this.filterRole);
    }

    this.filteredHistory = filtered;
    this.currentPage = 1;
    this.setupPagination();
  }

  setupPagination(): void {
    this.totalPages = Math.max(1, Math.ceil(this.filteredHistory.length / this.pageSize));
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
  }

  get displayedHistory(): LoginHistoryRecord[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredHistory.slice(start, start + this.pageSize);
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number): void {
    this.currentPage = page;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  formatTimestamp(timestamp: any): string {
    if (!timestamp || timestamp === null || timestamp === undefined) {
      return 'N/A';
    }
    
    let date: Date;
    
    // Handle Firestore Timestamp with toDate() method (most common)
    if (timestamp && typeof timestamp.toDate === 'function') {
      try {
        date = timestamp.toDate();
      } catch (e) {
        console.error('Error calling toDate():', e);
        return 'N/A';
      }
    }
    // Handle Date instance
    else if (timestamp instanceof Date) {
      date = timestamp;
    }
    // Handle Firestore Timestamp with seconds property (raw object)
    else if (typeof timestamp === 'object' && timestamp !== null && 'seconds' in timestamp) {
      const seconds = timestamp.seconds as number;
      date = new Date(seconds * 1000);
    }
    // Handle number (milliseconds since epoch)
    else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    }
    else {
      return 'N/A';
    }

    // Validate the date
    if (isNaN(date.getTime())) {
      return 'N/A';
    }

    // Format like login timestamp - simple and consistent
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }

  calculateSessionDuration(loginTime: any, logoutTime: any): string {
    let loginDate: Date;

    if (loginTime instanceof Date) {
      loginDate = loginTime;
    } else if (loginTime.toDate) {
      loginDate = loginTime.toDate();
    } else {
      return 'Invalid';
    }

    // If logout time exists, use it; otherwise use current time for ongoing sessions
    let endDate: Date;
    
    if (logoutTime) {
      if (logoutTime instanceof Date) {
        endDate = logoutTime;
      } else if (logoutTime.toDate) {
        endDate = logoutTime.toDate();
      } else {
        return 'Invalid';
      }
    } else {
      // For ongoing sessions, use current time (which updates every second)
      endDate = this.currentTime;
    }

    const diffMs = endDate.getTime() - loginDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;

    if (diffHours > 0) {
      return `${diffHours}h ${remainingMins}m`;
    } else if (diffMins > 0) {
      return `${diffMins}m`;
    } else {
      return '< 1m';
    }
  }

  getRoleIcon(role: 'admin' | 'staff'): string {
    return role === 'admin' ? 'admin_panel_settings' : 'person';
  }

  getStatusIcon(status: 'online' | 'logged_out'): string {
    return status === 'online' ? 'radio_button_checked' : 'radio_button_unchecked';
  }

  getStatusColor(status: 'online' | 'logged_out'): string {
    return status === 'online' ? '#10b981' : '#6b7280';
  }

  get totalOnline(): number {
    return this.filteredHistory.filter((record) => record.status === 'online').length;
  }

  get totalAdmins(): number {
    // Count unique admin users (by email)
    const uniqueAdmins = new Set(
      this.filteredHistory
        .filter((record) => record.role === 'admin')
        .map((record) => record.userEmail)
    );
    return uniqueAdmins.size;
  }

  get totalStaff(): number {
    // Count unique staff users (by email)
    const uniqueStaff = new Set(
      this.filteredHistory
        .filter((record) => record.role === 'staff')
        .map((record) => record.userEmail)
    );
    return uniqueStaff.size;
  }
}
