import { Component, OnInit } from '@angular/core';
import { Firestore, collection, getDocs, query, where, doc, updateDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { SupabaseService } from '../../../../services/supabase.service';

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
  isLoadingDetails = false;
  activeAttachment: { type: 'gov_id' | 'selfie', url: string } | null = null;

  constructor(
    private firestore: Firestore,
    private supabaseService: SupabaseService
  ) {}

  ngOnInit() {
    this.getPendingRequests();
  }

  // Fetch pending requests with the number of copies requested
  async getPendingRequests() {
    const requestsRef = collection(this.firestore, 'requests');
    const pendingQuery = query(requestsRef, where('status', '==', 'Pending'));
    const pendingSnapshot = await getDocs(pendingQuery);

    this.pendingRequests = pendingSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  openDetails(request: any) {
    this.selectedRequest = request;
  }

  // View Attachment (Gov ID or Selfie)
  async viewAttachment(type: 'gov_id' | 'selfie') {
    if (!this.selectedRequest) return;

    try {
      const urlPath = type === 'gov_id' ? this.selectedRequest.govIdUrl : this.selectedRequest.selfieUrl;
      const [folder, file] = urlPath.split('/') ?? [];

      if (!folder || !file) throw new Error('Invalid file path');

      const signedUrl = await this.supabaseService.getSignedFileUrl(folder as 'gov_ids' | 'selfies', file);
      this.activeAttachment = {
        type,
        url: signedUrl
      };
    } catch (error) {
      console.error('Error loading attachment:', error);
      Swal.fire('Error', 'Failed to load attachment.', 'error');
    }
  }

  closeAttachmentModal() {
    this.activeAttachment = null;  // Close the image preview modal
  }

  closeDetails() {
    this.selectedRequest = null;   // Close the request details modal
    this.activeAttachment = null; // Ensure the attachment modal is also closed
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

      Swal.fire('Approved!', `${request.fullName}'s request has been approved.`, 'success');
    }
  }

  async declineRequest(request: any) {
    const { value: remarks } = await Swal.fire({
      title: `Decline ${request.fullName}'s request?`,
      input: 'textarea',
      inputPlaceholder: 'Enter reason for declining...',
      inputAttributes: {

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

      Swal.fire('Declined!', `${request.fullName}'s request has been declined.`, 'error');
    } else if (remarks !== undefined) {
      Swal.fire('Missing Remarks', 'Please enter a remark to decline.', 'warning');
    }
  }
}
