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

  generateSummaryCards() {
    return {
      total: this.filteredRequests.length,
      approved: this.filteredRequests.filter(r => (r.status || '').toLowerCase() === 'approved').length,
      pending: this.filteredRequests.filter(r => (r.status || '').toLowerCase() === 'pending').length,
      declined: this.filteredRequests.filter(r => ['declined','rejected'].includes((r.status || '').toLowerCase())).length,
      completed: this.filteredRequests.filter(r => (r.status || '').toLowerCase() === 'completed').length
    };
  }

  generateCardInsightText(cards: any) {
    return `In total, ${cards.total} requests were recorded: ${cards.approved} approved, ${cards.declined} declined, ${cards.pending} pending, and ${cards.completed} completed.`;
  }

async exportPDF() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  // Load logos
  const loadLogo = async (url: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const leftLogo = await loadLogo('assets/logo2.png');
  const rightLogo = await loadLogo('assets/comelec_logo.png');

  const drawHeader = (yStart = 30) => {
    const logoSize = 50;
    if (leftLogo) doc.addImage(leftLogo, 'PNG', margin, yStart, logoSize, logoSize);
    if (rightLogo) doc.addImage(rightLogo, 'PNG', pageWidth - margin - logoSize, yStart, logoSize, logoSize);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, yStart, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    const headerLines = ['Republic of the Philippines', 'COMMISSION ON ELECTIONS', 'Olongapo City'];
    let yText = yStart + 20;
    headerLines.forEach(line => {
      doc.text(line, pageWidth / 2, yText, { align: 'center' });
      yText += 14;
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    yText += 5;
    doc.text('VoteCertify: Admin Request Overview', pageWidth / 2, yText, { align: 'center' });

    return yText + 40;
  };

  // Summary cards with light color coding
  let y = await drawHeader();
  const cards = this.generateSummaryCards();
  const cardWidth = (pageWidth - margin * 2 - 16) / 2;
  const cardHeight = 66;
  const cardColorMap = {
    total: { r: 245, g: 247, b: 255 },
    approved: { r: 245, g: 247, b: 255 },
    pending: { r: 245, g: 247, b: 255 },
    declined: { r: 245, g: 247, b: 255 },
    completed: {r: 245, g: 247, b: 255 }
  };
  const cardTitles = [
    { t: 'Total Requests', v: cards.total, key: 'total' },
    { t: 'Approved Requests', v: cards.approved, key: 'approved' },
    { t: 'Pending Requests', v: cards.pending, key: 'pending' },
    { t: 'Declined Requests', v: cards.declined, key: 'declined' },
    { t: 'Completed Requests', v: cards.completed, key: 'completed' }
  ];

  doc.setFontSize(12);
  for (let i = 0; i < cardTitles.length; i++) {
    const x = margin + (i % 2) * (cardWidth + 16);
    const yPos = y + Math.floor(i / 2) * (cardHeight + 12);
    const color = cardColorMap[cardTitles[i].key as keyof typeof cardColorMap];
    doc.setFillColor(color.r, color.g, color.b);
    doc.roundedRect(x, yPos, cardWidth, cardHeight, 8, 8, 'F');
    doc.setTextColor(30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(cardTitles[i].t, x + 12, yPos + 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(String(cardTitles[i].v), x + 12, yPos + 46);
  }
  y += Math.ceil(cardTitles.length / 2) * (cardHeight + 12) + 20;

  // Insights text
  const cardInsightText = this.generateCardInsightText(cards);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(cardInsightText, margin, y, { maxWidth: pageWidth - margin * 2, lineHeightFactor: 1.4 });
  y += 40;

  // Tables by status with numbering
  const statuses: { key: string; title: string }[] = [
    { key: 'pending', title: 'Pending Requests' },
    { key: 'approved', title: 'Approved Requests' },
    { key: 'declined', title: 'Declined Requests' },
    { key: 'completed', title: 'Completed Requests' }
  ];
const tableHeaderColorMap = {
  pending: { r: 220, g: 235, b: 255},
  approved: { r: 220, g: 235, b: 255 },
  declined: { r: 220, g: 235, b: 255 },
  completed: { r: 220, g: 235, b: 255 }
};

let pageIndex = 1;
for (const status of statuses) {
  const reqs = this.filteredRequests.filter(r => {
    const st = (r.status || '').toLowerCase();
    if (status.key === 'declined') return ['declined','rejected'].includes(st);
    return st === status.key;
  });

  if (!reqs.length) continue;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(status.title, margin, y);
  y += 12;

  const columns = ['#', 'Voter Name', 'Submitted Date', 'Pickup Date', 'Processing Time'];
  const rows = reqs.map((r, idx) => [
    idx + 1,
    r.fullName || 'N/A',
    this.formatDate(r.submittedAt),
    this.formatDateString(r.pickupDate),
    this.getProcessingTime(r)
  ]);

  const headerColor = tableHeaderColorMap[status.key as keyof typeof tableHeaderColorMap];

  autoTable(doc, {
    startY: y,
    head: [columns],
    body: rows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9 },
    headStyles: { fillColor: [headerColor.r, headerColor.g, headerColor.b], textColor: 30 },
    didDrawPage: (data) => {
      if (data.cursor) y = data.cursor.y + 20;
      // Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`VoteCertify • Generated ${new Date().toLocaleDateString()}`, margin, pageHeight - 30);
      doc.text(`Page ${pageIndex}`, pageWidth - margin - 40, pageHeight - 30);
    }
  });

  if (y > pageHeight - 100) {
    doc.addPage();
    y = await drawHeader();
    pageIndex++;
  }
}

  doc.save(`VoteCertify_Requests_${new Date().toISOString().slice(0,10)}.pdf`);
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
