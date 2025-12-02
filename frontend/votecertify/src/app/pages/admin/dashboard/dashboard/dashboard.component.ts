import { Component, OnInit, NgZone } from '@angular/core';
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
import { AppAnalyticsService, AnalyticsOverview } from '../../../../services/app-analytics.service';
import { Observable } from 'rxjs';

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

  analytics$: Observable<AnalyticsOverview>;

  chart: any = null;
  chartTitle = '';
  analyticsTotals = { total: 0, approved: 0, pending: 0, declined: 0 };

  selectedRange: 'thisMonth' | 'thisWeek' | 'thisYear' = 'thisMonth';
  months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  selectedMonth: number;
  selectedYear: number;
  selectedMonthYear: string; // Format: "YYYY-MM"
  availableMonths: { value: string; label: string }[] = [];

  constructor(private firestore: Firestore, private analyticsService: AppAnalyticsService, private ngZone: NgZone) {
    const now = new Date();
    this.selectedMonth = now.getMonth();
    this.selectedYear = now.getFullYear();
    // Initialize selectedMonthYear in YYYY-MM format
    this.selectedMonthYear = `${this.selectedYear}-${String(this.selectedMonth + 1).padStart(2, '0')}`;
    // Subscribe to real-time analytics updates
    this.analytics$ = this.analyticsService.getAnalytics();
    this.populateAvailableMonths();
  }

  /**
   * Populate available months (last 12 months + current month)
   */
  populateAvailableMonths() {
    this.availableMonths = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const value = `${year}-${String(month + 1).padStart(2, '0')}`;
      const label = `${this.months[month]} ${year}`;
      this.availableMonths.push({ value, label });
    }
  }

  async ngOnInit() {
    try {
      await this.getStaffStats();
      await this.getProcessedCertificatesStats();
      await this.getTodaysRequests();
      await this.getTotalVoterAccounts();
      await this.loadAnalyticsForRange(this.selectedRange);
      
      // Refresh analytics on page load
      this.analyticsService.refreshAnalytics();
    } catch (error) {
      console.error('Dashboard initialization error:', error);
    }
  }

  /**
   * Calculate bar height for mini chart visualization (0-100%)
   */
  getBarHeight(visits: number): number {
    // This will be calculated based on max visits in the week
    return visits * 10; // Adjust multiplier based on expected visit counts
  }

  async getStaffStats() {
    try {
      const usersRef = collection(this.firestore, 'users');
      const staffQuery = query(usersRef, where('role', '==', 'staff'));
      const staffSnapshot = await getDocs(staffQuery);
      this.ngZone.run(() => {
        this.totalStaff = staffSnapshot.size;
      });
    } catch (error) {
      console.warn('Error fetching staff stats:', error);
    }
  }

  async getProcessedCertificatesStats() {
    try {
      const requestsRef = collection(this.firestore, 'requests');
      const processedQuery = query(requestsRef, where('status', '==', 'Completed'));
      const processedSnapshot = await getDocs(processedQuery);
      this.ngZone.run(() => {
        this.totalProcessed = processedSnapshot.size;
      });
    } catch (error) {
      console.warn('Error fetching processed certificates:', error);
    }
  }

  async getTodaysRequests() {
    try {
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
      this.ngZone.run(() => {
        this.todaysRequests = snap.size;
      });
    } catch (error) {
      console.warn('Error fetching today requests:', error);
    }
  }

  async getTotalVoterAccounts() {
    try {
      const usersRef = collection(this.firestore, 'users');
      const voterQ = query(usersRef, where('role', '==', 'voter'));
      const snap = await getDocs(voterQ);
      this.ngZone.run(() => {
        this.totalVoterAccounts = snap.size;
      });
    } catch (error) {
      console.warn('Error fetching voter accounts:', error);
    }
  }

  formatDayShort(d: Date) {
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
  }

  formatDateShort(d: Date) {
    return d.toLocaleDateString();
  }

  onRangeChange() {
    this.loadAnalyticsForRange(this.selectedRange);
  }

  /**
   * Handle month selection change
   */
  onMonthChange() {
    if (this.selectedMonthYear) {
      const [year, month] = this.selectedMonthYear.split('-');
      this.selectedYear = parseInt(year, 10);
      this.selectedMonth = parseInt(month, 10) - 1;
      this.loadAnalyticsForRange('thisMonth');
    }
  }

  async loadAnalyticsForRange(range: 'thisWeek' | 'thisMonth' | 'thisYear') {
    try {
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

      this.analyticsTotals.total = snap.size;
      this.analyticsTotals.approved = statusCounts.approved;
      this.analyticsTotals.pending = statusCounts.pending;
      this.analyticsTotals.declined = statusCounts.declined;

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

      this.ngZone.run(() => {
        this.renderChart(labels, seriesTotal);
      });
    } catch (error) {
      console.warn('Error loading analytics for range:', error);
    }
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
          backgroundColor: 'rgba(0,102,255,0.12)',
          borderColor: '#0043C8',
          borderWidth: 2,
          pointRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }

  generateCardInsights(): string {
  return `
  The system currently has ${this.totalStaff} COMELEC staff managing requests.
  So far, ${this.totalProcessed} certificates have been processed.
  Today, ${this.todaysRequests} requests have been submitted.
  There are ${this.totalVoterAccounts} registered voter accounts in the system.
    `;
  }


  generateInsightText(totals: any): string {
    if (totals.total === 0) return 'No requests found in this period.';
    const approvedPct = Math.round((totals.approved / totals.total) * 100);
    const declinedPct = Math.round((totals.declined / totals.total) * 100);
    const pendingPct = Math.round((totals.pending / totals.total) * 100);
    return `In this period, ${totals.total} requests were recorded. ${approvedPct}% approved, ${declinedPct}% declined, and ${pendingPct}% pending.`;
  }

  async downloadReport() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  const loadLogo = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Failed to load logo:', err);
    return null;
  }
};

const leftLogo = await loadLogo('assets/logo2.png');
const rightLogo = await loadLogo('assets/comelec_logo.png');


const drawHeader = (yStart: number = 30) => {
  const logoSize = 50;

  // Logos
  if (leftLogo) doc.addImage(leftLogo, 'PNG', margin, yStart, logoSize, logoSize);
  if (rightLogo) doc.addImage(rightLogo, 'PNG', pageWidth - margin - logoSize, yStart, logoSize, logoSize);

  // Top-right timestamp
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, yStart, { align: 'right' });

  // Centered government text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const headerLines = ['Republic of the Philippines', 'COMMISSION ON ELECTIONS', 'Olongapo City'];
  let yText = yStart + 20;
  headerLines.forEach(line => {
    doc.text(line, pageWidth / 2, yText, { align: 'center' });
    yText += 14;
  });

  // Main report title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  yText += 5;
  doc.text('VoteCertify: Admin Analytics Report', pageWidth / 2, yText, { align: 'center' });

  return yText + 50; // starting Y for charts/cards
};


  // Page 1: Summary Cards
  await drawHeader();

  let y = 120;
  const cardWidth = (pageWidth - margin * 2 - 16) / 2;
  const cardHeight = 66;
  const cardColor = { r: 245, g: 247, b: 255 };
  const titles = [
    { t: 'COMELEC Staff', v: this.totalStaff },
    { t: 'Processed Certificates', v: this.totalProcessed },
    { t: "Today's Requests", v: this.todaysRequests },
    { t: 'Registered Voters', v: this.totalVoterAccounts }
  ];

  doc.setFontSize(12);
  for (let i = 0; i < titles.length; i++) {
    const x = margin + (i % 2) * (cardWidth + 16);
    const yPos = y + Math.floor(i / 2) * (cardHeight + 12);
    doc.setFillColor(cardColor.r, cardColor.g, cardColor.b);
    doc.roundedRect(x, yPos, cardWidth, cardHeight, 8, 8, 'F');
    doc.setTextColor(30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(titles[i].t, x + 12, yPos + 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(String(titles[i].v), x + 12, yPos + 46);
  }

  y += cardHeight * 2 + 36;
  doc.setDrawColor(220);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

// Card Insights
  const cardInsight = this.generateCardInsights();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(cardInsight, margin, y, { maxWidth: pageWidth - margin * 2, lineHeightFactor: 1.4 });
  y += 50; // spacing before charts

  doc.setFontSize(9);
  doc.text(`VoteCertify • Generated ${new Date().toLocaleDateString()}`, margin, pageHeight - 30);
  doc.text(`Page 1`, pageWidth - margin - 40, pageHeight - 30);

  // Generate chart only for the selected month
  const startDate = new Date(this.selectedYear, this.selectedMonth, 1);
  const endDate = new Date(this.selectedYear, this.selectedMonth + 1, 1);

  // Fetch requests for the selected month
  const requestsRef = collection(this.firestore, 'requests');
  const q = query(
    requestsRef,
    where('submittedAt', '>=', Timestamp.fromDate(startDate)),
    where('submittedAt', '<', Timestamp.fromDate(endDate))
  );
  const snap = await getDocs(q);

  // Calculate status counts and collect timestamps
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

  // Calculate chart data for the month
  const daysInMonth = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const labels = Array.from({ length: daysInMonth }, (_, i) => `Day ${i + 1}`);
  const seriesTotal = new Array(daysInMonth).fill(0);
  timestamps.forEach(dt => {
    const dayIndex = dt.getDate() - 1;
    if (dayIndex >= 0 && dayIndex < daysInMonth) seriesTotal[dayIndex]++;
  });

  // Calculate total requests from the chart data
  const totalRequests = seriesTotal.reduce((a, b) => a + b, 0);
  
  // Calculate max value for Y-axis
  const maxValue = Math.max(...seriesTotal, 0);
  const yAxisMax = maxValue === 0 ? 5 : Math.max(maxValue, 5);

  const chartCanvas = document.createElement('canvas');
  const displayWidth = 800;
  const displayHeight = 350;
  
  chartCanvas.width = displayWidth;
  chartCanvas.height = displayHeight;
  
  const chartData = seriesTotal.map(val => Number(val) || 0);
  
  const ctx = chartCanvas.getContext('2d');
  if (!ctx) {
    console.error('Failed to get canvas context');
  } else {
    const tempChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Requests',
          data: chartData,
          fill: true,
          backgroundColor: 'rgba(0,102,255,0.12)',
          borderColor: '#0043C8',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#0043C8',
          pointBorderColor: '#fff',
          pointBorderWidth: 1,
          tension: 0.35
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: {
          duration: 0
        },
        devicePixelRatio: 1,
        plugins: { 
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context: any) {
                return `Requests: ${context.parsed.y}`;
              }
            }
          }
        },
        scales: { 
          y: { 
            beginAtZero: true,
            min: 0,
            max: yAxisMax,
            ticks: { 
              stepSize: 1,
              precision: 0,
              callback: function(value: any) {
                const num = Number(value);
                return Number.isInteger(num) ? num.toString() : '';
              }
            },
            grid: {
              display: true
            }
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 0
            },
            grid: {
              display: true
            }
          }
        }
      }
    });

    // Wait for chart to render
    await new Promise(res => setTimeout(res, 500));
    const chartImg = tempChart.toBase64Image();
    tempChart.destroy();

    const imgWidth = pageWidth - margin * 2;
    const imgHeight = imgWidth * 0.45;

    // Add new page for the chart
    doc.addPage();
    await drawHeader();
    y = 110;

    // Chart title
    const chartTitle = `Certificate Requests for ${this.months[this.selectedMonth]} ${this.selectedYear}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(chartTitle, margin, y);
    y += 20;

    // Add chart image
    doc.addImage(chartImg, 'PNG', margin, y, imgWidth, imgHeight);
    y += imgHeight + 40;

    // Chart insights
    const chartInsight = this.generateInsightText({
      total: totalRequests,
      approved: statusCounts.approved,
      pending: statusCounts.pending,
      declined: statusCounts.declined
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(chartInsight, margin, y, { maxWidth: pageWidth - margin * 2, lineHeightFactor: 1.4 });

    // Page footer
    doc.setFontSize(9);
    doc.text(`VoteCertify • Generated ${new Date().toLocaleDateString()}`, margin, pageHeight - 30);
    doc.text(`Page 2`, pageWidth - margin - 40, pageHeight - 30);
  }

  // Save with month-specific filename
  doc.save(`VoteCertify_Report_${this.months[this.selectedMonth]}_${this.selectedYear}.pdf`);
}

}
