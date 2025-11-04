import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Firestore, collection, getDocs, query, where, Timestamp } from '@angular/fire/firestore';
import { Chart, PieController, ArcElement, Tooltip, Legend, BarController, CategoryScale, LinearScale, BarElement, Title, Filler } from 'chart.js';
import { CommonModule } from '@angular/common';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Inject } from '@angular/core';

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

  constructor(@Inject(Firestore) private firestore: Firestore) {}  // Inject Firestore correctly here

  ngOnInit(): void {
    Chart.register(PieController, ArcElement, Tooltip, Legend, BarController, CategoryScale, LinearScale, BarElement, Title, Filler, ChartDataLabels);
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

    // Modern color palette
    const modernColors = {
      pending: '#FFA726',      // Orange - For Approval
      approved: '#42A5F5',     // Blue - Approved  
      declined: '#EF5350',     // Red - Declined
      completed: '#66BB6A'     // Green - Completed
    };

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
            modernColors.pending,
            modernColors.approved,
            modernColors.declined,
            modernColors.completed
          ],
          borderColor: '#ffffff',
          borderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              font: {
                size: 12,
                weight: 'bold'
              },
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: {
              size: 14,
              weight: 'bold'
            },
            bodyFont: {
              size: 13
            },
            callbacks: {
              label: (context) => {
                const value = context.raw as number;
                const percentage = total ? ((value / total) * 100).toFixed(1) : '0';
                return `${context.label}: ${value} requests (${percentage}%)`;
              }
            }
          },
          datalabels: {
            color: '#fff',
            font: {
              weight: 'bold',
              size: 13
            },
            formatter: (value, context) => {
              if (value === 0) return '';
              const percentage = total ? ((value / total) * 100).toFixed(1) : '0';
              return value > 0 ? `${percentage}%` : '';
            },
            textStrokeColor: 'rgba(0, 0, 0, 0.3)',
            textStrokeWidth: 1
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
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    // Calculate actual days in current month
    const daysInMonth = endOfMonth.getDate();

    const monthQuery = query(
      requestsRef,
      where('submittedAt', '>=', Timestamp.fromDate(startOfMonth)),
      where('submittedAt', '<=', Timestamp.fromDate(endOfMonth))
    );

    const monthSnapshot = await getDocs(monthQuery);
    const requestCounts = Array(daysInMonth).fill(0);

    monthSnapshot.forEach(doc => {
      const data = doc.data();
      const submittedAt = data['submittedAt'];
      let dt: Date;
      
      if (submittedAt?.toDate) {
        dt = submittedAt.toDate();
      } else if (submittedAt instanceof Date) {
        dt = submittedAt;
      } else if (submittedAt) {
        dt = new Date(submittedAt);
      } else {
        return;
      }

      if (dt instanceof Date && !isNaN(dt.getTime())) {
        const dayIndex = dt.getDate() - 1;
        if (dayIndex >= 0 && dayIndex < daysInMonth) {
          requestCounts[dayIndex]++;
        }
      }
    });

    setTimeout(() => {
      this.createBarChart(requestCounts, daysInMonth);
    }, 0);
  }

  createBarChart(requestCounts: number[], daysInMonth: number): void {
    const ctx = this.requestsChartCanvas?.nativeElement;
    if (!ctx) return;

    if (this.barChart) {
      this.barChart.destroy();
    }

    const maxValue = Math.max(...requestCounts, 0);
    const yAxisMax = maxValue === 0 ? 5 : Math.max(5, Math.ceil(maxValue * 1.2));
    const totalRequests = requestCounts.reduce((a, b) => a + b, 0);

    // Generate labels for actual days in month
    const labels = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return day % 5 === 0 || day === 1 || day === daysInMonth ? `${day}` : '';
    });

    // Modern gradient color
    const gradient = ctx.getContext('2d')?.createLinearGradient(0, 0, 0, 400);
    if (gradient) {
      gradient.addColorStop(0, '#6366F1');
      gradient.addColorStop(1, '#8B5CF6');
    }

    this.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Array.from({ length: daysInMonth }, (_, i) => i + 1),
        datasets: [{
          label: 'Requests',
          data: requestCounts,
          backgroundColor: gradient || '#6366F1',
          borderColor: '#4F46E5',
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
          hoverBackgroundColor: '#4F46E5',
          hoverBorderColor: '#4338CA'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: {
              size: 14,
              weight: 'bold'
            },
            bodyFont: {
              size: 13
            },
            callbacks: {
              title: (context) => {
                return `Day ${context[0].label}`;
              },
              label: (context) => {
                const value = context.parsed.y;
                return `${value} ${value === 1 ? 'request' : 'requests'}`;
              },
              footer: () => {
                return `Total: ${totalRequests} requests this month`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Day of Month',
              font: {
                size: 13,
                weight: 'bold'
              },
              color: '#64748B'
            },
            grid: {
              display: false
            },
            ticks: {
              maxRotation: 0,
              minRotation: 0,
              font: {
                size: 11
              },
              color: '#64748B',
              callback: function(value, index) {
                // Show label for every 5th day or first/last day
                const day = index + 1;
                if (day % 5 === 0 || day === 1 || day === daysInMonth) {
                  return day.toString();
                }
                return '';
              }
            }
          },
          y: {
            beginAtZero: true,
            min: 0,
            max: yAxisMax,
            title: {
              display: true,
              text: 'Number of Requests',
              font: {
                size: 13,
                weight: 'bold'
              },
              color: '#64748B'
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.1)'
            },
            ticks: {
              stepSize: 1,
              precision: 0,
              font: {
                size: 11
              },
              color: '#64748B',
              callback: function(value) {
                return Number.isInteger(value) ? value.toString() : '';
              }
            }
          }
        }
      }
    });
  }
}
