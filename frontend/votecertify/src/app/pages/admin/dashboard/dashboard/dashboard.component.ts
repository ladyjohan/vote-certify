import { Component, OnInit } from '@angular/core';
import { Firestore, collection, getDocs, query, where, Timestamp } from '@angular/fire/firestore';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import jsPDF from 'jspdf';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Title, Tooltip, Legend, Filler);

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  totalStaff = 0;
  totalProcessed = 0;
  todaysRequests = 0;
  totalVoterAccounts = 0;

  chart: any = null;
  chartTitle = '';
  analyticsTotals = { total: 0, approved: 0, pending: 0, declined: 0 };

  selectedRange: 'thisMonth' | 'thisWeek' | 'thisYear' = 'thisMonth';
  months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  selectedMonth: number;
  selectedYear: number;

  constructor(private firestore: Firestore) {
    const now = new Date();
    this.selectedMonth = now.getMonth();
    this.selectedYear = now.getFullYear();
  }

  async ngOnInit() {
    await this.getStaffStats();
    await this.getProcessedCertificatesStats();
    await this.getTodaysRequests();
    await this.getTotalVoterAccounts();
    await this.loadAnalyticsForRange(this.selectedRange); // initialize chart
  }

  // ------------------ DATA FETCH ------------------
  async getStaffStats() {
    const usersRef = collection(this.firestore, 'users');
    const staffQuery = query(usersRef, where('role', '==', 'staff'));
    const staffSnapshot = await getDocs(staffQuery);
    this.totalStaff = staffSnapshot.size;
  }

  async getProcessedCertificatesStats() {
    const requestsRef = collection(this.firestore, 'requests');
    const processedQuery = query(requestsRef, where('status', '==', 'Completed'));
    const processedSnapshot = await getDocs(processedQuery);
    this.totalProcessed = processedSnapshot.size;
  }

  async getTodaysRequests() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const requestsRef = collection(this.firestore, 'requests');
    const q = query(
      requestsRef,
      where('submittedAt', '>=', Timestamp.fromDate(start)),
      where('submittedAt', '<', Timestamp.fromDate(end))
    );
    const snap = await getDocs(q);
    this.todaysRequests = snap.size;
  }

  async getTotalVoterAccounts() {
    const usersRef = collection(this.firestore, 'users');
    const voterQ = query(usersRef, where('role', '==', 'voter'));
    const snap = await getDocs(voterQ);
    this.totalVoterAccounts = snap.size;
  }

  // ------------------ HELPERS ------------------
  formatDayShort(d: Date) {
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
  }

  formatDateShort(d: Date) {
    return d.toLocaleDateString();
  }

  // ------------------ UI CHART ------------------
  onRangeChange() {
    this.loadAnalyticsForRange(this.selectedRange);
  }

  async loadAnalyticsForRange(range: 'thisWeek' | 'thisMonth' | 'thisYear') {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (range === 'thisWeek') {
      const day = now.getDay();
      const mondayOffset = (day === 0) ? -6 : 1 - day;
      startDate = new Date(now);
      startDate.setDate(now.getDate() + mondayOffset);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 7);
      this.chartTitle = `Requests This Week (${this.formatDateShort(startDate)} - ${this.formatDateShort(new Date(endDate.getTime() - 1))})`;
    } else if (range === 'thisYear') {
      startDate = new Date(this.selectedYear, 0, 1);
      endDate = new Date(this.selectedYear + 1, 0, 1);
      this.chartTitle = `Requests for Year ${this.selectedYear}`;
    } else {
      startDate = new Date(this.selectedYear, this.selectedMonth, 1);
      endDate = new Date(this.selectedYear, this.selectedMonth + 1, 1);
      this.chartTitle = `Requests for ${this.months[this.selectedMonth]} ${this.selectedYear}`;
    }

    const requestsRef = collection(this.firestore, 'requests');
    const q = query(
      requestsRef,
      where('submittedAt', '>=', Timestamp.fromDate(startDate)),
      where('submittedAt', '<', Timestamp.fromDate(endDate))
    );
    const snap = await getDocs(q);

    const statusCounts = { approved: 0, pending: 0, declined: 0 };
    const timestamps: Date[] = [];

    snap.forEach(d => {
      const data: any = d.data();
      const sa = data['submittedAt'];
      const dt = sa?.toDate ? sa.toDate() : new Date(sa);
      timestamps.push(dt);
      const st = (data['status'] || '').toLowerCase();
      if (st.includes('approved') || st.includes('completed')) statusCounts.approved++;
      else if (st.includes('decline') || st.includes('rejected')) statusCounts.declined++;
      else statusCounts.pending++;
    });

    // update totals for UI
    this.analyticsTotals.total = snap.size;
    this.analyticsTotals.approved = statusCounts.approved;
    this.analyticsTotals.pending = statusCounts.pending;
    this.analyticsTotals.declined = statusCounts.declined;

    // build labels & series for chart
    let labels: string[] = [];
    let seriesTotal: number[] = [];

    if (range === 'thisYear') {
      labels = this.months;
      seriesTotal = new Array(12).fill(0);
      timestamps.forEach(dt => seriesTotal[dt.getMonth()]++);
    } else if (range === 'thisWeek') {
      labels = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        return this.formatDayShort(d);
      });
      seriesTotal = new Array(7).fill(0);
      timestamps.forEach(dt => {
        const diff = Math.floor((dt.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diff >= 0 && diff < 7) seriesTotal[diff]++;
      });
    } else {
      const daysInMonth = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      labels = Array.from({ length: daysInMonth }, (_, i) => `Day ${i + 1}`);
      seriesTotal = new Array(daysInMonth).fill(0);
      timestamps.forEach(dt => seriesTotal[dt.getDate() - 1]++);
    }

    this.renderChart(labels, seriesTotal);

    // also return image for PDF
    const chartImg = await this.renderChartImage(labels, seriesTotal, this.chartTitle);
    return { chartImg, totals: this.analyticsTotals, chartTitle: this.chartTitle };
  }

  renderChart(labels: string[], dataSet: number[]) {
    const ctx = document.getElementById('requestsChart') as HTMLCanvasElement;
    if (!ctx) return;

    if (this.chart) this.chart.destroy();

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Total Requests',
          data: dataSet,
          fill: true,
          tension: 0.35,
          backgroundColor: 'rgba(0,102,255,0.15)',
          borderColor: '#0043C8',
          borderWidth: 2,
          pointRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  async renderChartImage(labels: string[], dataSet: number[], title: string): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 300;
    const tempChart = new Chart(canvas.getContext('2d')!, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Total Requests',
          data: dataSet,
          fill: true,
          tension: 0.35,
          backgroundColor: 'rgba(0,102,255,0.15)',
          borderColor: '#0043C8',
          borderWidth: 2,
          pointRadius: 2
        }]
      },
      options: {
        plugins: { title: { display: true, text: title, font: { size: 14 } }, legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
    await new Promise(res => setTimeout(res, 300)); // allow chart render
    const img = tempChart.toBase64Image();
    tempChart.destroy();
    return img;
  }

  generateInsightText(totals: any): string {
    if (totals.total === 0) return 'No requests found in this period.';
    const approvedPct = Math.round((totals.approved / totals.total) * 100);
    const declinedPct = Math.round((totals.declined / totals.total) * 100);
    const pendingPct = Math.round((totals.pending / totals.total) * 100);
    return `In this period, ${totals.total} requests were recorded. ${approvedPct}% approved, ${declinedPct}% declined, and ${pendingPct}% pending.`;
  }

  // ------------------ PDF ------------------
  async downloadReport() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    let y = 60;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('VoteCertify Admin Analytics Report', pageWidth / 2, y, { align: 'center' });
    y += 20;
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, y, { align: 'center' });
    y += 25;
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 25;

    // --- SUMMARY CARDS ---
    doc.setFontSize(13);
    doc.text('Summary Overview', margin, y);
    y += 15;
    const cardHeight = 55;
    const cardWidth = (pageWidth - margin * 2 - 20) / 2;
    const cardData = [
      { title: 'COMELEC Staff', value: this.totalStaff },
      { title: 'Processed Certificates', value: this.totalProcessed },
      { title: "Today's Requests", value: this.todaysRequests },
      { title: 'Registered Voters', value: this.totalVoterAccounts }
    ];

    for (let i = 0; i < cardData.length; i++) {
      const x = margin + (i % 2) * (cardWidth + 20);
      const yPos = y + Math.floor(i / 2) * (cardHeight + 15);
      doc.setDrawColor(180);
      doc.setFillColor(245, 247, 255);
      doc.roundedRect(x, yPos, cardWidth, cardHeight, 8, 8, 'F');
      doc.setTextColor(50);
      doc.setFontSize(11);
      doc.text(cardData[i].title, x + 15, yPos + 22);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(`${cardData[i].value}`, x + 15, yPos + 45);
    }
    y += cardHeight * 2 + 50;

    // --- ANALYTICS FOR MULTIPLE RANGES ---
    const ranges: ('thisWeek' | 'thisMonth' | 'thisYear')[] = ['thisWeek', 'thisMonth', 'thisYear'];

    for (const range of ranges) {
      const { chartImg, totals, chartTitle } = await this.loadAnalyticsForRange(range);

      doc.addPage();
      y = 60;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(chartTitle, margin, y);
      y += 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text(`Total: ${totals.total} | Approved: ${totals.approved} | Pending: ${totals.pending} | Declined: ${totals.declined}`, margin, y);
      y += 20;

      if (chartImg) {
        const imgWidth = pageWidth - margin * 2;
        const imgHeight = imgWidth * 0.45;
        doc.addImage(chartImg, 'PNG', margin, y, imgWidth, imgHeight);
        y += imgHeight + 20;
      }

      const insight = this.generateInsightText(totals);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text(insight, margin, y, { maxWidth: pageWidth - margin * 2, lineHeightFactor: 1.5 });
    }

    // --- FOOTER ---
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.text(`VoteCertify • Generated ${new Date().toLocaleDateString()}`, margin, doc.internal.pageSize.getHeight() - 25);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 50, doc.internal.pageSize.getHeight() - 25);
    }

    doc.save(`VoteCertify_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  }
}
