import { Component, OnInit, inject } from '@angular/core';
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
  searchControl = new FormControl('');

  async ngOnInit() {
    await this.loadRequests();

    this.searchControl.valueChanges.pipe(debounceTime(300)).subscribe(searchText => {
      const term = (searchText || '').toLowerCase();
      this.filteredRequests = this.allRequests.filter(req => this.searchInFields(req, term));
    });
  }

  // 🔄 Load all requests from Firestore
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

    this.filteredRequests = [...this.allRequests];
  }

  // 🔍 Search logic (matches any relevant field)
  searchInFields(request: any, term: string): boolean {
    return (
      (request.fullName?.toLowerCase().includes(term) || '') ||
      (request.voterId?.toLowerCase().includes(term) || '') ||
      (request.status?.toLowerCase().includes(term) || '') ||
      (request.submittedAt && this.formatDate(request.submittedAt).toLowerCase().includes(term)) ||
      (request.pickupDate && this.formatDateString(request.pickupDate).toLowerCase().includes(term))
    );
  }

  // ⏱ Calculate processing time in days
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

  // 🏷️ Get status badge class
  getStatusClass(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'approved':
        return 'status-approved';
      case 'pending':
        return 'status-pending';
      case 'declined':
      case 'rejected':
        return 'status-declined';
      case 'completed':
        return 'status-completed';
      default:
        return 'status-default';
    }
  }

  // 📄 Export table data to PDF
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
    autoTable(doc, {
      startY: 20,
      head: [columns],
      body: rows
    });

    doc.save('Voter_Request_Overview_Report.pdf');
  }

  // 📆 Format Date object to string
  private formatDate(date: Date | null): string {
    return date ? this.datePipe.transform(date, 'MM/dd/yyyy') ?? 'N/A' : 'N/A';
  }

  // 📅 Format pickupDate string to readable date
  private formatDateString(dateStr: string | null): string {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? 'N/A' : this.formatDate(date);
  }
}
