import { Component, OnInit } from '@angular/core';
import { Firestore, collection, getDocs, query, where } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-staff-dashboard',
  standalone: true,  // Keep using standalone component
  imports: [CommonModule],  // Only import CommonModule here since NgChartsModule is not used anymore
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class StaffDashboardComponent implements OnInit {
  // Card stats
  forApproval: number = 0;
  onProcess: number = 0;
  totalProcessed: number = 0;

  constructor(private firestore: Firestore) {}

  ngOnInit() {
    this.getRequestsStats();
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
  }
}
