import { Component, OnInit } from '@angular/core';
import { Firestore, collection, getDocs, query, where, doc, updateDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-request-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './request-management.component.html',
  styleUrls: ['./request-management.component.scss']
})
export class RequestManagementComponent implements OnInit {
  pendingRequests: any[] = [];
  selectedRequest: any = null;

  constructor(private firestore: Firestore) {}

  ngOnInit() {
    this.getPendingRequests();
  }

  async getPendingRequests() {
    const requestsRef = collection(this.firestore, 'requests');
    const pendingQuery = query(requestsRef, where('status', '==', 'Pending'));
    const pendingSnapshot = await getDocs(pendingQuery);

    this.pendingRequests = pendingSnapshot.docs.map(doc => {
      return { id: doc.id, ...doc.data() };
    });
  }

  openDetails(request: any) {
    this.selectedRequest = request;
  }

  closeDetails() {
    this.selectedRequest = null;
  }

  async approveRequest(request: any) {
    const { value: date } = await Swal.fire({
      title: 'Approve Request',
      text: 'Select a pickup date for the requester:',
      input: 'date',
      inputAttributes: {
        min: new Date().toISOString().split('T')[0]
      },
      showCancelButton: true,
      confirmButtonText: 'Approve',
      cancelButtonText: 'Cancel'
    });

    if (date) {
      const requestRef = doc(this.firestore, 'requests', request.id);
      await updateDoc(requestRef, {
        status: 'Approved',
        pickupDate: date
      });

      this.pendingRequests = this.pendingRequests.filter(r => r.id !== request.id);
      this.closeDetails();

      Swal.fire('Approved!', `${request.voterName}'s request has been approved.`, 'success');
    }
  }

  async declineRequest(request: any) {
    const { value: remarks } = await Swal.fire({
      title: `Decline ${request.voterName}'s request?`,
      input: 'textarea',
      inputLabel: 'Remarks',
      inputPlaceholder: 'Enter reason for declining...',
      inputAttributes: {
        'aria-label': 'Remarks'
      },
      showCancelButton: true,
      confirmButtonText: 'Decline',
      cancelButtonText: 'Cancel'
    });

    if (remarks && remarks.trim()) {
      const requestRef = doc(this.firestore, 'requests', request.id);
      await updateDoc(requestRef, {
        status: 'Declined',
        remarks: remarks.trim()
      });

      this.pendingRequests = this.pendingRequests.filter(r => r.id !== request.id);
      this.closeDetails();

      Swal.fire('Declined!', `${request.voterName}'s request has been declined.`, 'error');
    } else if (remarks !== undefined) {
      Swal.fire('Missing Remarks', 'Please enter a remark to decline.', 'warning');
    }
  }
}
