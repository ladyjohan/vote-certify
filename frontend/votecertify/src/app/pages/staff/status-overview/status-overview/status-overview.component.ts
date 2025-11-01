import { Component, OnInit, HostListener } from '@angular/core';
import { Firestore, collection, getDocs, doc, updateDoc } from '@angular/fire/firestore';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { debounceTime } from 'rxjs/operators';
import Swal from 'sweetalert2';

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
  searchControl = new FormControl('');
  // Pagination
  pageSize = 10;
  currentPage = 1;
  totalPages = 1;

  constructor(private firestore: Firestore) {}

  async ngOnInit() {
    await this.loadRequests();
    // choose page size based on current viewport (mobile: 5, desktop/tablet: 10)
    this.setPageSizeForViewport();

    this.searchControl.valueChanges.pipe(debounceTime(300)).subscribe(searchText => {
      const term = (searchText || '').toLowerCase();
      this.filteredRequests = this.allRequests.filter(req =>
        req.fullName?.toLowerCase().includes(term) ||
        req.voterId?.toLowerCase().includes(term)
      );
      // reset pagination when filter changes
      this.currentPage = 1;
      this.setupPagination();
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
        pickupDate: data['pickupDate'] || null // treat as string
      };
    });

    this.filteredRequests = [...this.allRequests];
    this.setupPagination();
  }

  setupPagination() {
    this.totalPages = Math.max(1, Math.ceil(this.filteredRequests.length / this.pageSize));
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
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

  get displayedRequests() {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredRequests.slice(start, start + this.pageSize);
  }

  get pages() {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage() {
    if (this.currentPage > 1) this.currentPage--;
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
      const requestRef = doc(this.firestore, 'requests', request.id);
      await updateDoc(requestRef, { status: 'Completed' });

      request.status = 'Completed'; // update local state for instant UI reflection
      Swal.fire('Success', 'Request marked as completed!', 'success');
    } catch (error) {
      console.error('Error updating request:', error);
      Swal.fire('Error', 'Failed to mark as completed.', 'error');
    }
  }
}
