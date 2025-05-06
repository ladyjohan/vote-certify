import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
import { Chart, PieController, ArcElement, Tooltip, Legend, BarController, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { CommonModule } from '@angular/common';
import ChartDataLabels from 'chartjs-plugin-datalabels';


@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class StaffDashboardComponent implements OnInit {
  forApproval = 0;
  onProcess = 0;
  totalProcessed = 0;
  declinedRequests = 0;

  @ViewChild('combinedPieChartCanvas') combinedPieChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('requestsChartCanvas') requestsChartCanvas!: ElementRef<HTMLCanvasElement>;

  combinedPieChart: Chart | undefined;
  barChart: Chart | undefined;

  constructor(private firestore: Firestore) {}

  ngOnInit(): void {
    Chart.register(PieController, ArcElement, Tooltip, Legend, BarController, CategoryScale, LinearScale, BarElement, Title, ChartDataLabels);
    this.loadDashboardData();
  }

  async loadDashboardData(): Promise<void> {
    await Promise.all([
      this.getRequestsStats(),
      this.getRequestsThisMonth()
    ]);
  }

  async getRequestsStats(): Promise<void> {
    const requestsRef = collection(this.firestore, 'requests');

    const statuses = [
      { field: 'Pending', setter: (count: number) => this.forApproval = count },
      { field: 'Approved', setter: (count: number) => this.onProcess = count },
      { field: 'Completed', setter: (count: number) => this.totalProcessed = count },
      { field: 'Declined', setter: (count: number) => this.declinedRequests = count }
    ];

    for (const status of statuses) {
      const q = query(requestsRef, where('status', '==', status.field));
      const snapshot = await getDocs(q);
      status.setter(snapshot.size);
    }

    setTimeout(() => {
      this.createCombinedPieChart();
    }, 0);
  }

  createCombinedPieChart(): void {
    const ctx = this.combinedPieChartCanvas?.nativeElement;
    if (!ctx) return;

    if (this.combinedPieChart) {
      this.combinedPieChart.destroy();
    }

    const total = this.forApproval + this.onProcess + this.declinedRequests + this.totalProcessed;

    this.combinedPieChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['For Approval', 'Approved', 'Declined', 'Completed'],
        datasets: [{
          data: [
            this.forApproval,
            this.onProcess,
            this.declinedRequests,
            this.totalProcessed
          ],
          backgroundColor: [
            '#FFD600', // For Approval
            '#00C853', // Approved
            '#D50000', // Declined
            '#003FCB'  // Completed
          ],
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom'
          },
          tooltip: {
            enabled: true,
            callbacks: {
              label: (context) => {
                const value = context.raw as number;
                const percentage = total ? ((value / total) * 100).toFixed(1) : '0';
                return `${context.label}: ${percentage}% (${value})`;
              }
            }
          },
          datalabels: {
            color: '#fff',
            font: {
              weight: 'bold',
              size: 14
            },
            formatter: (value, context) => {
              const percentage = total ? ((value / total) * 100).toFixed(1) : '0';
              return `${percentage}% (${value})`;
            }
          }
        }
      },
      plugins: [ChartDataLabels]
    });
  }

  async getRequestsThisMonth(): Promise<void> {
    const requestsRef = collection(this.firestore, 'requests');
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const monthQuery = query(
      requestsRef,
      where('submittedAt', '>=', startOfMonth),
      where('submittedAt', '<=', endOfMonth)
    );

    const monthSnapshot = await getDocs(monthQuery);
    const requestCounts = Array(31).fill(0);

    monthSnapshot.forEach(doc => {
      const data = doc.data();
      const submittedAt = data['submittedAt']?.toDate?.();
      if (submittedAt instanceof Date) {
        const dayIndex = submittedAt.getDate() - 1;
        requestCounts[dayIndex]++;
      }
    });

    setTimeout(() => {
      this.createBarChart(requestCounts);
    }, 0);
  }

  createBarChart(requestCounts: number[]): void {
    const ctx = this.requestsChartCanvas?.nativeElement;
    if (!ctx) return;

    if (this.barChart) {
      this.barChart.destroy();
    }

    const maxRequests = Math.max(...requestCounts, 10);

    this.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Array.from({ length: 31 }, (_, i) => `Day ${i + 1}`),
        datasets: [{
          label: 'Total Requests This Month',
          data: requestCounts,
          backgroundColor: '#003FCB',
          borderColor: '#001F6D',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Day of Month'
            }
          },
          y: {
            beginAtZero: true,
            min: 0,
            max: maxRequests + 10,
            ticks: {
              stepSize: 10
            }
          }
        }
      }
    });
  }
}
