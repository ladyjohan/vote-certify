import { Component, OnInit, HostListener } from '@angular/core';
import { Firestore, collection, getDocs, doc, updateDoc } from '@angular/fire/firestore';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { debounceTime } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { Auth } from '@angular/fire/auth';

@Component({
  selector: 'app-status-overview',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './status-overview.component.html',
  styleUrls: ['./status-overview.component.scss']
})
export class StatusOverviewComponent implements OnInit {
  allRequests: any[] = [];
  filteredRequests: any[] = [];
  pagedRequests: any[] = [];
  searchControl = new FormControl('');
  currentStatusFilter: string = 'all'; // all, approved, completed
  currentSortField: string = 'pickupDate';
  currentSortDirection: 'asc' | 'desc' = 'desc';
  // Pagination
  pageSize = 10;
  currentPage = 1;
  totalPages = 1;
  pages: number[] = [];

  constructor(private firestore: Firestore, private auth: Auth) {}

  async ngOnInit() {
    this.setPageSizeForViewport();
    await this.loadRequests();

    this.searchControl.valueChanges.pipe(debounceTime(300)).subscribe(() => {
      this.applyFilters();
    });
  }

  async loadRequests() {
    const requestsRef = collection(this.firestore, 'requests');
    const snapshot = await getDocs(requestsRef);

    this.allRequests = snapshot.docs.map(doc => {
      const data = doc.data();

      return {
        id: doc.id,
        ...data,
        pickupDate: data['pickupDate'] || null,
        submittedAt: data['submittedAt']?.toDate?.() || null
      };
    });

    // Filter to show only Approved and Completed by default
    this.allRequests = this.allRequests.filter(req => {
      const status = (req.status || '').toLowerCase();
      return status === 'approved' || status === 'completed';
    });

    this.applyFilters();
  }

  applyFilters() {
    const term = (this.searchControl.value || '').toLowerCase();

    this.filteredRequests = this.allRequests.filter(req => {
      const matchesSearch = 
        (req.fullName?.toLowerCase().includes(term) || '') ||
        (req.birthdate?.toLowerCase().includes(term) || '');
      
      const matchesStatus = 
        this.currentStatusFilter === 'all' ||
        (req.status || '').toLowerCase() === this.currentStatusFilter;
      
      return matchesSearch && matchesStatus;
    });

    this.sortRequests();
    this.setupPagination();
  }

  sortRequests() {
    this.filteredRequests.sort((a, b) => {
      let valueA = a[this.currentSortField];
      let valueB = b[this.currentSortField];

      if (this.currentSortField === 'pickupDate' || this.currentSortField === 'submittedAt') {
        valueA = valueA ? new Date(valueA).getTime() : 0;
        valueB = valueB ? new Date(valueB).getTime() : 0;
      } else {
        valueA = (valueA || '').toString().toLowerCase();
        valueB = (valueB || '').toString().toLowerCase();
      }

      if (this.currentSortDirection === 'asc') {
        return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
      } else {
        return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
      }
    });
  }

  onStatusFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.currentStatusFilter = target.value;
    this.currentPage = 1;
    this.applyFilters();
  }

  onSortFieldChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.currentSortField = target.value;
    this.applyFilters();
  }

  onSortDirectionChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.currentSortDirection = target.value as 'asc' | 'desc';
    this.applyFilters();
  }

  setupPagination() {
    this.totalPages = Math.ceil(this.filteredRequests.length / this.pageSize) || 1;
    this.currentPage = Math.min(this.currentPage, this.totalPages) || 1;
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    this.pages = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    this.updatePagedRequests();
  }

  updatePagedRequests() {
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedRequests = this.filteredRequests.slice(start, start + this.pageSize);
  }

  // Adjust pageSize based on viewport width; mobile gets 5 per page
  setPageSizeForViewport() {
    try {
      const w = window.innerWidth || document.documentElement.clientWidth || 0;
      const desired = w <= 600 ? 5 : 10;
      if (this.pageSize !== desired) {
        this.pageSize = desired;
        this.currentPage = 1;
        this.setupPagination();
      }
    } catch (e) {
      // window might not be available in some environments (SSR) — ignore
    }
  }

  @HostListener('window:resize')
  onResize() {
    this.setPageSizeForViewport();
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePagedRequests();
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagedRequests();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagedRequests();
    }
  }

  getStatusClass(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'approved': return 'status-approved';
      case 'pending': return 'status-pending';
      case 'declined':
      case 'rejected': return 'status-declined';
      case 'completed': return 'status-completed';
      default: return 'status-default';
    }
  }

  async markAsCompleted(request: any) {
    const confirm = await Swal.fire({
      title: 'Mark as Completed?',
      text: `Confirm that ${request.fullName}'s certificate has been claimed.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, mark it',
      cancelButtonText: 'Cancel'
    });

    if (!confirm.isConfirmed) return;

    try {
      const staffEmail = this.auth.currentUser?.email || 'Unknown Staff';
      const requestRef = doc(this.firestore, 'requests', request.id);
      await updateDoc(requestRef, { 
        status: 'Completed',
        completedBy: staffEmail,
        completedAt: new Date()
      });

      // Update local state
      const index = this.allRequests.findIndex(r => r.id === request.id);
      if (index !== -1) {
        this.allRequests[index].status = 'Completed';
        this.allRequests[index].completedBy = staffEmail;
        this.allRequests[index].completedAt = new Date();
      }
      
      this.applyFilters();
      Swal.fire('Success', 'Request marked as completed!', 'success');
    } catch (error) {
      console.error('Error updating request:', error);
      Swal.fire('Error', 'Failed to mark as completed.', 'error');
    }
  }
}
