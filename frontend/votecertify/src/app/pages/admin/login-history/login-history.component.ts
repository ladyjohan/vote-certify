import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoginHistoryService, LoginHistoryRecord } from '../../../services/login-history.service';
import { ActivityLogService, ActivityLog } from '../../../services/activity-log.service';
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
  activityLogs: ActivityLog[] = [];
  filteredActivityLogs: ActivityLog[] = [];

  activeTab: 'login' | 'activity' = 'login';
  isLoading = false;
  searchTerm = '';
  filterRole: 'all' | 'admin' | 'staff' = 'all';

  // Pagination
  pageSizeOptions = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  pageSize = 10;

  loginCurrentPage = 1;
  loginTotalPages = 1;

  activityCurrentPage = 1;
  activityTotalPages = 1;

  // For real-time duration updates
  currentTime = new Date();

  private destroy$ = new Subject<void>();

  constructor(
    private loginHistoryService: LoginHistoryService,
    private activityLogService: ActivityLogService
  ) { }

  ngOnInit(): void {
    // Subscribe to Login History real-time updates
    this.loginHistoryService
      .getLoginHistoryRealtime(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (history) => {
          this.loginHistory = history.filter((r: any) => r.role === 'admin' || r.role === 'staff');
          this.applyFilters();
        },
        error: (error) => console.error('❌ Login history error:', error),
      });

    // Subscribe to Activity Logs real-time updates
    this.activityLogService
      .getActivityLogsRealtime(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (logs) => {
          this.activityLogs = logs;
          this.applyFilters();
        },
        error: (error) => console.error('❌ Activity logs error:', error),
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

  switchTab(tab: 'login' | 'activity'): void {
    this.activeTab = tab;
    this.searchTerm = '';
    this.filterRole = 'all';
    this.loginCurrentPage = 1;
    this.activityCurrentPage = 1;
    this.applyFilters();
  }

  applyFilters(): void {
    const term = this.searchTerm.toLowerCase().trim();

    // Apply filters to Login History
    let filteredLogin = [...this.loginHistory];
    if (term) {
      filteredLogin = filteredLogin.filter(r =>
        r.userName.toLowerCase().includes(term) || r.userEmail.toLowerCase().includes(term)
      );
    }
    if (this.filterRole !== 'all') {
      filteredLogin = filteredLogin.filter(r => r.role === this.filterRole);
    }
    this.filteredHistory = filteredLogin;
    this.loginTotalPages = Math.max(1, Math.ceil(this.filteredHistory.length / this.pageSize));

    // Apply filters to Activity Logs
    let filteredActivity = [...this.activityLogs];
    if (term) {
      filteredActivity = filteredActivity.filter(r =>
        r.userName.toLowerCase().includes(term) ||
        r.userEmail.toLowerCase().includes(term) ||
        r.description.toLowerCase().includes(term) ||
        r.targetName?.toLowerCase().includes(term)
      );
    }
    if (this.filterRole !== 'all') {
      filteredActivity = filteredActivity.filter(r => r.role === this.filterRole);
    }
    this.filteredActivityLogs = filteredActivity;
    this.activityTotalPages = Math.max(1, Math.ceil(this.filteredActivityLogs.length / this.pageSize));
  }

  get displayedHistory(): LoginHistoryRecord[] {
    const start = (this.loginCurrentPage - 1) * this.pageSize;
    return this.filteredHistory.slice(start, start + this.pageSize);
  }

  get displayedActivity(): ActivityLog[] {
    const start = (this.activityCurrentPage - 1) * this.pageSize;
    return this.filteredActivityLogs.slice(start, start + this.pageSize);
  }

  get currentPage(): number {
    return this.activeTab === 'login' ? this.loginCurrentPage : this.activityCurrentPage;
  }

  get totalPages(): number {
    return this.activeTab === 'login' ? this.loginTotalPages : this.activityTotalPages;
  }

  onPageSizeChange(): void {
    this.loginCurrentPage = 1;
    this.activityCurrentPage = 1;
    this.applyFilters();
  }

  get rangeStart(): number {
    const count = this.activeTab === 'login' ? this.filteredHistory.length : this.filteredActivityLogs.length;
    return count === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get rangeEnd(): number {
    const count = this.activeTab === 'login' ? this.filteredHistory.length : this.filteredActivityLogs.length;
    return Math.min(this.currentPage * this.pageSize, count);
  }

  get totalFilteredCount(): number {
    return this.activeTab === 'login' ? this.filteredHistory.length : this.filteredActivityLogs.length;
  }

  get visiblePages(): number[] {
    const total = this.totalPages;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: number[] = [];
    const cur = this.currentPage;
    pages.push(1);
    if (cur > 3) pages.push(-1);
    for (let p = Math.max(2, cur - 1); p <= Math.min(total - 1, cur + 1); p++) pages.push(p);
    if (cur < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  }

  goToPage(page: number): void {
    if (this.activeTab === 'login') this.loginCurrentPage = page;
    else this.activityCurrentPage = page;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      if (this.activeTab === 'login') this.loginCurrentPage++;
      else this.activityCurrentPage++;
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      if (this.activeTab === 'login') this.loginCurrentPage--;
      else this.activityCurrentPage--;
    }
  }

  getActionIcon(action: string): string {
    switch (action) {
      case 'approve': return 'check_circle';
      case 'decline': return 'cancel';
      case 'complete': return 'verified';
      case 'release': return 'assignment_turned_in';
      default: return 'history';
    }
  }

  getActionColor(action: string): string {
    switch (action) {
      case 'approve': return '#10b981';
      case 'decline': return '#f44336';
      case 'complete': return '#6366f1';
      case 'release': return '#3b82f6';
      default: return '#64748b';
    }
  }

  formatTimestamp(timestamp: any): string {
    if (!timestamp || timestamp === null || timestamp === undefined) {
      return '-';
    }

    let date: Date;

    // Handle Firestore Timestamp with toDate() method (most common)
    if (timestamp && typeof timestamp.toDate === 'function') {
      try {
        date = timestamp.toDate();
      } catch (e) {
        console.error('Error calling toDate():', e);
        return '-';
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
      return '-';
    }

    // Validate the date
    if (isNaN(date.getTime())) {
      return '-';
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

  get todayLogins(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.filteredHistory.filter((record) => {
      let loginDate: Date;

      if (record.loginTimestamp instanceof Date) {
        loginDate = record.loginTimestamp;
      } else if (record.loginTimestamp?.toDate) {
        loginDate = record.loginTimestamp.toDate();
      } else if (typeof record.loginTimestamp === 'object' && 'seconds' in record.loginTimestamp) {
        loginDate = new Date((record.loginTimestamp as any).seconds * 1000);
      } else if (typeof record.loginTimestamp === 'number') {
        loginDate = new Date(record.loginTimestamp);
      } else {
        return false;
      }

      const recordDate = new Date(loginDate);
      recordDate.setHours(0, 0, 0, 0);

      return recordDate.getTime() === today.getTime();
    }).length;
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
