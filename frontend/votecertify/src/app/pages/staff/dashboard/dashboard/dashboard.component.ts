import { Component, OnInit } from '@angular/core';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
import { Chart, BarController, CategoryScale, BarElement, Title, Tooltip, Legend, LinearScale } from 'chart.js'; // Import necessary components
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-staff-dashboard',
  standalone: true,  // Ensure the component is standalone
  imports: [CommonModule],  // Only import CommonModule here
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class StaffDashboardComponent implements OnInit {
  // Card stats
  forApproval: number = 0;
  onProcess: number = 0;
  totalProcessed: number = 0;
  declinedRequests: number = 0;  // Declined requests counter
  chart: any;

  constructor(private firestore: Firestore) {}

  ngOnInit() {
    this.getRequestsStats();
    this.getRequestsThisMonth();
    Chart.register(BarController, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
  }

  // Fetch stats for requests
  async getRequestsStats() {
    const requestsRef = collection(this.firestore, 'requests');

    // For Approval: Requests where status is 'Pending'
    const forApprovalQuery = query(requestsRef, where('status', '==', 'Pending'));
    const forApprovalSnapshot = await getDocs(forApprovalQuery);
    this.forApproval = forApprovalSnapshot.size;

    // On Process: Requests where status is 'Approved'
    const onProcessQuery = query(requestsRef, where('status', '==', 'Approved'));
    const onProcessSnapshot = await getDocs(onProcessQuery);
    this.onProcess = onProcessSnapshot.size;

    // Total Processed: Requests where status is 'Completed'
    const totalProcessedQuery = query(requestsRef, where('status', '==', 'Completed'));
    const totalProcessedSnapshot = await getDocs(totalProcessedQuery);
    this.totalProcessed = totalProcessedSnapshot.size;

    // Declined Requests: Requests where status is 'Declined'
    const declinedRequestsQuery = query(requestsRef, where('status', '==', 'Declined'));
    const declinedRequestsSnapshot = await getDocs(declinedRequestsQuery);
    this.declinedRequests = declinedRequestsSnapshot.size;
  }

  // Fetch the total requests this month for the bar graph
  async getRequestsThisMonth() {
    const requestsRef = collection(this.firestore, 'requests');
    const currentMonth = new Date().getMonth(); // Get the current month (0-11)
    const currentYear = new Date().getFullYear();

    // Query for requests submitted this month
    const monthQuery = query(
      requestsRef,
      where('submittedAt', '>=', new Date(currentYear, currentMonth, 1)),
      where('submittedAt', '<', new Date(currentYear, currentMonth + 1, 0))
    );
    const monthSnapshot = await getDocs(monthQuery);

    // Prepare data for the bar chart
    const requestCounts = Array(31).fill(0); // For each day of the month (1-31)

    // Log data for debugging
    console.log(`Number of requests for this month: ${monthSnapshot.size}`);
    monthSnapshot.forEach(doc => {
      const request = doc.data();
      const submittedAt = request['submittedAt'].toDate();
      const day = submittedAt.getDate() - 1; // Days start from 1 in the calendar, so subtract 1 for zero-based index
      requestCounts[day]++;
    });

    // Ensure that the chart is rendered even if requestCounts is empty
    if (monthSnapshot.size === 0) {
      console.log('No data for the current month');
      requestCounts.fill(0);  // If no data, keep all days with value 0
    }

    console.log('Request counts: ', requestCounts);  // Log the request counts array

    // Initialize the chart with the data
    this.createChart(requestCounts);
  }

  // Create the chart
  createChart(requestCounts: number[]): void {
    const ctx = document.getElementById('requestsChart') as HTMLCanvasElement;

    // Initialize chart with data even if empty
    if (ctx) {
      if (this.chart) {
        // If chart already exists, destroy it before creating a new one
        this.chart.destroy();
      }

      const maxValue = Math.max(...requestCounts) || 50;  // Set a default max value to avoid errors if data is 0

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
              type: 'category', // Use category type for x-axis
              labels: Array.from({ length: 31 }, (_, i) => `Day ${i + 1}`) // Setting the x-axis labels as Days 1-31
            },
            y: {
              beginAtZero: true, // Set the y-axis to begin at zero
              min: 0, // Start from 0
              max: maxValue + 10, // Set max to be slightly higher than the highest value
              ticks: {
                stepSize: 10,  // Set the step size for y-axis labels
                callback: function(tickValue: string | number) {
                  return tickValue; // Show values as they are
                }
              }
            }
          }
        }
      });
    } else {
      console.error('Canvas element not found');
    }
  }
}
