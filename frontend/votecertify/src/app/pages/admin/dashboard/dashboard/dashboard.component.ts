import { Component, OnInit } from '@angular/core';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
import { Chart, BarController, CategoryScale, BarElement, Title, Tooltip, Legend, LinearScale } from 'chart.js';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  // Card stats
  totalStaff: number = 0;
  totalProcessed: number = 0;
  chart: any;

  constructor(private firestore: Firestore) {}

  ngOnInit() {
    this.getStaffStats();
    this.getProcessedCertificatesStats();
    this.getRequestsThisMonth();
    Chart.register(BarController, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
  }

// Fetch total number of COMELEC staff (users with role 'staff')
async getStaffStats() {
  const usersRef = collection(this.firestore, 'users');
  const staffQuery = query(usersRef, where('role', '==', 'staff'));
  const staffSnapshot = await getDocs(staffQuery);
  this.totalStaff = staffSnapshot.size;
}

  // Fetch total processed certificates
  async getProcessedCertificatesStats() {
    const requestsRef = collection(this.firestore, 'requests');
    const processedQuery = query(requestsRef, where('status', '==', 'Completed'));
    const processedSnapshot = await getDocs(processedQuery);
    this.totalProcessed = processedSnapshot.size;
  }

  // Fetch the total requests this month for the bar graph
  async getRequestsThisMonth() {
    const requestsRef = collection(this.firestore, 'requests');
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthQuery = query(
      requestsRef,
      where('submittedAt', '>=', new Date(currentYear, currentMonth, 1)),
      where('submittedAt', '<', new Date(currentYear, currentMonth + 1, 0))
    );
    const monthSnapshot = await getDocs(monthQuery);

    const requestCounts = Array(31).fill(0);

    monthSnapshot.forEach(doc => {
      const request = doc.data();
      const submittedAt = request['submittedAt'].toDate();
      const day = submittedAt.getDate() - 1;
      requestCounts[day]++;
    });

    this.createChart(requestCounts);
  }

  createChart(requestCounts: number[]): void {
    const ctx = document.getElementById('requestsChart') as HTMLCanvasElement;

    if (ctx) {
      if (this.chart) {
        this.chart.destroy();
      }

      const maxValue = Math.max(...requestCounts) || 50;

      this.chart = new Chart(ctx, {
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
              type: 'category',
              labels: Array.from({ length: 31 }, (_, i) => `Day ${i + 1}`)
            },
            y: {
              beginAtZero: true,
              min: 0,
              max: maxValue + 10,
              ticks: {
                stepSize: 10,
                callback: function(tickValue: string | number) {
                  return tickValue;
                }
              }
            }
          }
        }
      });
    }
  }
}
