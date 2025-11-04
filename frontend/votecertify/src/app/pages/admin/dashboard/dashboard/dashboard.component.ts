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
    await this.loadAnalyticsForRange(this.selectedRange);
  }

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

  formatDayShort(d: Date) {
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
  }

  formatDateShort(d: Date) {
    return d.toLocaleDateString();
  }

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

    this.renderChart(labels, seriesTotal);
    return { labels, seriesTotal, totals: this.analyticsTotals };
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

  // Charts - continuous placement
  const ranges: ('thisWeek' | 'thisMonth' | 'thisYear')[] = ['thisWeek', 'thisMonth', 'thisYear'];
  let pageIndex = 2;
  y += 50; // spacing before charts

  for (const range of ranges) {
    // Calculate date range for this specific period
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
    } else if (range === 'thisYear') {
      startDate = new Date(this.selectedYear, 0, 1);
      endDate = new Date(this.selectedYear + 1, 0, 1);
    } else {
      startDate = new Date(this.selectedYear, this.selectedMonth, 1);
      endDate = new Date(this.selectedYear, this.selectedMonth + 1, 1);
    }

    // Fetch requests for this range
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

    // Calculate chart data (labels and seriesTotal) directly from the fetched data
    let labels: string[] = [];
    let seriesTotal: number[] = [];

    if (range === 'thisYear') {
      labels = this.months;
      seriesTotal = new Array(12).fill(0);
      timestamps.forEach(dt => {
        const monthIndex = dt.getMonth();
        if (monthIndex >= 0 && monthIndex < 12) seriesTotal[monthIndex]++;
      });
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
      // For month, calculate days in the month
      const daysInMonth = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      labels = Array.from({ length: daysInMonth }, (_, i) => `Day ${i + 1}`);
      seriesTotal = new Array(daysInMonth).fill(0);
      timestamps.forEach(dt => {
        const dayIndex = dt.getDate() - 1;
        if (dayIndex >= 0 && dayIndex < daysInMonth) seriesTotal[dayIndex]++;
      });
    }

    // Calculate total requests from the chart data
    const totalRequests = seriesTotal.reduce((a, b) => a + b, 0);
    
    // Calculate max value for Y-axis (round up to next integer, minimum 5)
    const maxValue = Math.max(...seriesTotal, 0);
    const yAxisMax = maxValue === 0 ? 5 : Math.max(maxValue, 5); // Use actual max or 5, whichever is higher

    // Debug: Log the data to verify it's correct
    console.log(`PDF Chart Data for ${range}:`, {
      labels,
      seriesTotal,
      maxValue,
      yAxisMax,
      totalRequests
    });

    const chartCanvas = document.createElement('canvas');
    const displayWidth = 800;
    const displayHeight = 350;
    
    // Set canvas size - Chart.js will handle the rendering
    chartCanvas.width = displayWidth;
    chartCanvas.height = displayHeight;
    
    // Ensure data is properly formatted as numbers
    const chartData = seriesTotal.map(val => Number(val) || 0);
    
    // Verify data before rendering
    console.log('Chart rendering with data:', {
      range,
      chartData,
      maxInData: Math.max(...chartData),
      yAxisMax,
      labels
    });
    
    const ctx = chartCanvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get canvas context');
      continue;
    }
    
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
          duration: 0 // Disable animation to ensure accurate rendering
        },
        devicePixelRatio: 1, // Force 1:1 pixel ratio for accurate rendering
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

    // Wait longer to ensure chart is fully rendered
    await new Promise(res => setTimeout(res, 500));
    const chartImg = tempChart.toBase64Image();
    tempChart.destroy();

    const imgWidth = pageWidth - margin * 2;
    const imgHeight = imgWidth * 0.45;

    // Check if there is enough space; otherwise, add page
    if (y + imgHeight + 60 > pageHeight - margin) {
      doc.addPage();
      await drawHeader();
      y = 110;
      doc.setFontSize(9);
      doc.text(`Page ${pageIndex}`, pageWidth - margin - 40, pageHeight - 30);
      pageIndex++;
    }

    // Determine chart title
    let chartTitle = '';

    if (range === 'thisMonth') chartTitle = `Requests for ${this.months[this.selectedMonth]} ${this.selectedYear}`;
    else if (range === 'thisWeek') {
      const day = now.getDay();
      const mondayOffset = (day === 0) ? -6 : 1 - day;
      const weekStart = new Date();
      weekStart.setDate(now.getDate() + mondayOffset);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      chartTitle = `Requests This Week (${this.formatDateShort(weekStart)} - ${this.formatDateShort(weekEnd)})`;
    } else if (range === 'thisYear') chartTitle = `Requests for Year ${this.selectedYear}`;

    // Add title above chart
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(chartTitle, margin, y);
    y += 20;


    doc.addImage(chartImg, 'PNG', margin, y, imgWidth, imgHeight);
    y += imgHeight + 40;

    // Use the accurate status counts calculated for this specific range
    const chartInsight = this.generateInsightText({
      total: totalRequests,
      approved: statusCounts.approved,
      pending: statusCounts.pending,
      declined: statusCounts.declined
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(chartInsight, margin, y, { maxWidth: pageWidth - margin * 2, lineHeightFactor: 1.4 });
    y += 40;
  }

  doc.save(`VoteCertify_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

}
