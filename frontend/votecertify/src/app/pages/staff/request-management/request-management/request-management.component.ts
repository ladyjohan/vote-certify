import { Component, OnInit } from '@angular/core';
import { Firestore, collection, getDocs, query, where, doc, updateDoc, getDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import Swal from 'sweetalert2';
import { debounceTime } from 'rxjs/operators';
import { SupabaseService } from '../../../../services/supabase.service';
import emailjs from 'emailjs-com';
import { Router } from '@angular/router';


@Component({
  selector: 'app-request-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './request-management.component.html',
  styleUrls: ['./request-management.component.scss']
})
export class RequestManagementComponent implements OnInit {
  pendingRequests: any[] = [];
  filteredPendingRequests: any[] = [];
  // Pagination
  pageSize = 10;
  currentPage = 1;
  totalPages = 1;
  searchControl = new FormControl('');
  selectedRequest: any = null;
  isLoadingDetails = false;
  activeAttachment: { type: 'gov_id' | 'selfie', url: string } | null = null;

  constructor(
    private firestore: Firestore,
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  ngOnInit() {
    this.getPendingRequests();
    this.searchControl.valueChanges.pipe(debounceTime(300)).subscribe(text => {
      const term = (text || '').toString().toLowerCase();
      this.filteredPendingRequests = this.pendingRequests.filter(r =>
        (r.fullName || '').toString().toLowerCase().includes(term) ||
        (r.voterId || '').toString().toLowerCase().includes(term)
      );
      this.currentPage = 1;
      this.setupPagination();
    });
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
    // initialize filtered list and pagination
    this.filteredPendingRequests = [...this.pendingRequests];
    this.setupPagination();
  }

  setupPagination() {
    this.totalPages = Math.max(1, Math.ceil(this.filteredPendingRequests.length / this.pageSize));
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
  }

  get displayedRequests() {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredPendingRequests.slice(start, start + this.pageSize);
  }

  get pages() {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage() {
    if (this.currentPage > 1) this.currentPage--;
  }

  // pageSize is fixed to 10 per user's request; selector removed from template.

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

  openChat(requestId: string) {
    this.router.navigate(['/staff/chat', requestId]);
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

      //Send Email after approval
      await this.sendApprovalEmail(request, date);

    this.pendingRequests = this.pendingRequests.filter(r => r.id !== request.id);
    this.filteredPendingRequests = this.filteredPendingRequests.filter(r => r.id !== request.id);
    this.setupPagination();
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

      // Send Email after decline
      await this.sendDeclineEmail(request, remarks.trim());

      this.pendingRequests = this.pendingRequests.filter(r => r.id !== request.id);
      this.filteredPendingRequests = this.filteredPendingRequests.filter(r => r.id !== request.id);
      this.setupPagination();
      this.closeDetails();

      Swal.fire('Declined!', `${request.fullName}'s request has been declined.`, 'error');
    } else if (remarks !== undefined) {
      Swal.fire('Missing Remarks', 'Please enter a remark to decline.', 'warning');
    }
  }

  async sendApprovalEmail(request: any, pickupDate: string) {
    const templateParams = {
      name: request.fullName,
      pickup_date: pickupDate,
      copies_requested: request.copiesRequested,
      voter_id: request.voterId,
      email: request.email
    };

    // Use SECOND EmailJS Account credentials
    emailjs.init('c4wdO5d7b4OvOf5ae'); // Second account Public Key

    try {
      const result = await emailjs.send(
        'service_g5f5afj',  // your service id
        'template_gbdx50m', // your template id
        templateParams
      );
      console.log('Approval Email sent!', result.text);
    } catch (error) {
      console.error('Failed to send approval email:', error);
      Swal.fire('Error', 'Failed to send approval email.', 'error');
    }
  }

  async sendDeclineEmail(request: any, remarks: string) {
    const templateParams = {
      name: request.fullName,
      remarks: remarks,
      voter_id: request.voterId,
      email: request.email
    };

    // Use SECOND EmailJS Account credentials
    emailjs.init('c4wdO5d7b4OvOf5ae'); // Second account Public Key

    try {
      const result = await emailjs.send(
        'service_g5f5afj',  // your service id
        'template_njgg0lj', // Decline template id
        templateParams
      );
      console.log('Decline Email sent!', result.text);
    } catch (error) {
      console.error('Failed to send decline email:', error);
      Swal.fire('Error', 'Failed to send decline email.', 'error');
    }
  }
}
