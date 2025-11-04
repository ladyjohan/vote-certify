import { Component, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { debounceTime } from 'rxjs/operators';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-admin-request-overview',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  providers: [DatePipe],
  templateUrl: './request-overview.component.html',
  styleUrls: ['./request-overview.component.scss']
})
export class AdminRequestOverviewComponent implements OnInit {
  firestore = inject(Firestore);
  datePipe = inject(DatePipe);

  allRequests: any[] = [];
  filteredRequests: any[] = [];
  pagedRequests: any[] = [];
  searchControl = new FormControl('');
  currentSortField: string = 'submittedAt';
  currentSortDirection: 'asc' | 'desc' = 'asc';
  currentStatusFilter: string = 'all';

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  pages: number[] = [];

  ngOnInit() {
    this.setPageSizeByScreen();
    this.loadRequests();

    this.searchControl.valueChanges.pipe(debounceTime(300)).subscribe(() => {
      this.applyFilters();
    });
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.setPageSizeByScreen();
    this.applyFilters();
  }

  setPageSizeByScreen() {
    this.pageSize = window.innerWidth < 768 ? 5 : 10;
  }

  async loadRequests() {
    const requestsRef = collection(this.firestore, 'requests');
    const snapshot = await getDocs(requestsRef);

    this.allRequests = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        submittedAt: data['submittedAt']?.toDate?.() || null,
        pickupDate: data['pickupDate'] || null
      };
    });

    this.applyFilters();
  }

  applyFilters() {
    const term = (this.searchControl.value || '').toLowerCase();

    this.filteredRequests = this.allRequests.filter(req => {
      const matchesSearch = this.searchInFields(req, term);
      const matchesStatus = this.currentStatusFilter === 'all' ||
        (req.status || '').toLowerCase() === this.currentStatusFilter;
      return matchesSearch && matchesStatus;
    });

    this.sortRequests();
    this.setupPagination();
  }

  searchInFields(request: any, term: string): boolean {
    return (
      (request.fullName?.toLowerCase().includes(term) || '') ||
      (request.voterId?.toLowerCase().includes(term) || '') ||
      (request.status?.toLowerCase().includes(term) || '') ||
      (request.submittedAt && this.formatDate(request.submittedAt).toLowerCase().includes(term)) ||
      (request.pickupDate && this.formatDateString(request.pickupDate).toLowerCase().includes(term))
    );
  }

  sortRequests() {
    this.filteredRequests.sort((a, b) => {
      let valueA = a[this.currentSortField];
      let valueB = b[this.currentSortField];

      if (this.currentSortField === 'submittedAt' || this.currentSortField === 'pickupDate') {
        valueA = valueA ? new Date(valueA).getTime() : 0;
        valueB = valueB ? new Date(valueB).getTime() : 0;
      } else {
        valueA = (valueA || '').toString().toLowerCase();
        valueB = (valueB || '').toString().toLowerCase();
      }

      if (valueA < valueB) return this.currentSortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return this.currentSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  onSortFieldChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.currentSortField = target.value;
    this.sortRequests();
    this.setupPagination();
  }

  onSortDirectionChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.currentSortDirection = target.value as 'asc' | 'desc';
    this.sortRequests();
    this.setupPagination();
  }

  onStatusFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.currentStatusFilter = target.value;
    this.applyFilters();
  }

  getProcessingTime(request: any): string {
    if (request.submittedAt && request.pickupDate) {
      const pickupDate = new Date(request.pickupDate);
      if (!isNaN(pickupDate.getTime())) {
        const diff = Math.ceil(
          (pickupDate.getTime() - request.submittedAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        return `${diff} day(s)`;
      }
    }
    return 'N/A';
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

  exportPDF() {
    const doc = new jsPDF();
    const columns = ['Voter Name', 'Status', 'Submitted Date', 'Pickup Date', 'Processing Time'];
    const rows = this.filteredRequests.map(req => [
      req.fullName || 'N/A',
      req.status || 'N/A',
      this.formatDate(req.submittedAt),
      this.formatDateString(req.pickupDate),
      this.getProcessingTime(req)
    ]);

    doc.text('Voter Request Overview Report', 14, 15);
    autoTable(doc, { startY: 20, head: [columns], body: rows });
    doc.save('Voter_Request_Overview_Report.pdf');
  }

  formatDate(date: Date | null): string {
    return date ? this.datePipe.transform(date, 'MM/dd/yyyy') ?? 'N/A' : 'N/A';
  }

  formatDateString(dateStr: string | null): string {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? 'N/A' : this.formatDate(date);
  }

  /* ================= Pagination Methods ================= */
  setupPagination() {
    this.totalPages = Math.ceil(this.filteredRequests.length / this.pageSize);
    this.currentPage = Math.min(this.currentPage, this.totalPages) || 1;

    this.pages = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    this.updatePagedRequests();
  }

  updatePagedRequests() {
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedRequests = this.filteredRequests.slice(start, start + this.pageSize);
  }

  goToPage(page: number) {
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
}
