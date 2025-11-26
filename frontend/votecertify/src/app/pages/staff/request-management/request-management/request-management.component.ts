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
  declineReasons = [
    'Not Registered',
    'Deactivated',
    'Multiple Registration Record',
    'Record Not Found',
    'Incomplete Voter Information',
    'Pending Registration',
    'Transferred to Another City/Municipality',
    'Under Investigation',
    'With Legal Case Hold',
    'Disqualified'
  ];

  // Daily approval limit tracking
  approvalsToday: number = 0;
  dailyApprovalLimit: number = 10;

  // Time slots (30-minute intervals from 9:00 AM to 2:30 PM, 1 person per slot, excluding 12:00 PM - 1:00 PM)
  timeSlots = [
    { label: '9:00 AM - 9:30 AM', value: '09:00-09:30', capacity: 1 },
    { label: '9:30 AM - 10:00 AM', value: '09:30-10:00', capacity: 1 },
    { label: '10:00 AM - 10:30 AM', value: '10:00-10:30', capacity: 1 },
    { label: '10:30 AM - 11:00 AM', value: '10:30-11:00', capacity: 1 },
    { label: '11:00 AM - 11:30 AM', value: '11:00-11:30', capacity: 1 },
    { label: '11:30 AM - 12:00 PM', value: '11:30-12:00', capacity: 1 },
    { label: '1:00 PM - 1:30 PM', value: '13:00-13:30', capacity: 1 },
    { label: '1:30 PM - 2:00 PM', value: '13:30-14:00', capacity: 1 },
    { label: '2:00 PM - 2:30 PM', value: '14:00-14:30', capacity: 1 },
    { label: '2:30 PM - 3:00 PM', value: '14:30-15:00', capacity: 1 }
  ];

  constructor(
    private firestore: Firestore,
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  ngOnInit() {
    this.getPendingRequests();
    this.loadTodayApprovalsCount();
    this.searchControl.valueChanges.pipe(debounceTime(300)).subscribe(text => {
      const term = (text || '').toString().toLowerCase();
      this.filteredPendingRequests = this.pendingRequests.filter(r =>
        (r.fullName || '').toString().toLowerCase().includes(term) ||
        (r.birthdate || '').toString().toLowerCase().includes(term)
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
    // Check daily limit
    if (this.approvalsToday >= this.dailyApprovalLimit) {
      Swal.fire('Approval Limit Reached', `You can only approve ${this.dailyApprovalLimit} requests per day. Remaining: 0`, 'warning');
      return;
    }

    const { value: formValues } = await Swal.fire({
      title: 'Approve Certificate Request',
      html: `
        <div style="text-align: left; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 100%; box-sizing: border-box;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 24px; position: relative; overflow: hidden;">
            <div style="position: absolute; top: 0; right: 0; opacity: 0.1; font-size: 80px; line-height: 1;">✓</div>
            <div style="position: relative; z-index: 1;">
              <p style="margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9;">Daily Quota</p>
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="flex: 1;">
                  <div style="font-size: 28px; font-weight: 800; line-height: 1;">${this.dailyApprovalLimit - this.approvalsToday}</div>
                  <div style="font-size: 12px; opacity: 0.85; margin-top: 4px;">Remaining</div>
                </div>
                <div style="font-size: 24px; opacity: 0.6;">/</div>
                <div style="text-align: right;">
                  <div style="font-size: 20px; font-weight: 700;">${this.dailyApprovalLimit}</div>
                  <div style="font-size: 12px; opacity: 0.85; margin-top: 4px;">Total</div>
                </div>
              </div>
              <div style="margin-top: 12px; height: 6px; background: rgba(255,255,255,0.2); border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; width: ${((this.dailyApprovalLimit - this.approvalsToday) / this.dailyApprovalLimit * 100)}%; background: #4CAF50; transition: width 0.3s ease;"></div>
              </div>
            </div>
          </div>

          <div style="margin-bottom: 20px; box-sizing: border-box;">
            <label for="pickupDate" style="display: block; margin-bottom: 8px; font-weight: 600; color: #333; font-size: 14px;">Select Pickup Date</label>
            <input type="date" id="pickupDate" class="swal2-input modern-input" style="width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; margin: 0;">
            <small style="color: #666; display: block; margin-top: 5px; font-size: 12px;">Date must be today or later</small>
          </div>

          <div style="margin-bottom: 0; box-sizing: border-box;">
            <label for="timeSlot" style="display: block; margin-bottom: 8px; font-weight: 600; color: #333; font-size: 14px;">Select Time Slot</label>
            <select id="timeSlot" class="swal2-input modern-input" style="width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; margin: 0; -webkit-appearance: none; -moz-appearance: none; appearance: none; background-image: url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3e%3cpolyline points=%226 9 12 15 18 9%3e%3c/polyline%3e%3c/svg%3e'); background-repeat: no-repeat; background-position: right 10px center; background-size: 20px; padding-right: 36px;">
              <option value="">-- Choose a time slot --</option>
              ${this.timeSlots.map(slot => `<option value="${slot.value}">${slot.label} (${this.getSlotAvailability(slot.value)} available)</option>`).join('')}
            </select>
            <small style="color: #666; display: block; margin-top: 5px; font-size: 12px;">Each slot accepts up to 5 claimants</small>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Approve',
      confirmButtonColor: '#4CAF50',
      cancelButtonText: 'Cancel',
      customClass: {
        container: 'modern-swal-container',
        popup: 'modern-swal-popup',
        title: 'modern-swal-title',
        htmlContainer: 'modern-swal-html'
      },
      didOpen: () => {
        const pickupDateInput = document.getElementById('pickupDate') as HTMLInputElement;
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const minDate = `${year}-${month}-${day}`;
        pickupDateInput.min = minDate;
      },
      preConfirm: async () => {
        const pickupDate = (document.getElementById('pickupDate') as HTMLInputElement).value;
        const timeSlot = (document.getElementById('timeSlot') as HTMLSelectElement).value;

        if (!pickupDate || !timeSlot) {
          Swal.showValidationMessage('Please select both a pickup date and time slot');
          return null;
        }

        // Check if date is in the past (string comparison works for YYYY-MM-DD format)
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayString = `${year}-${month}-${day}`;

        if (pickupDate < todayString) {
          Swal.showValidationMessage('Cannot select a past date');
          return null;
        }

        // Check slot availability for the selected date
        const available = await this.getSlotCapacityForDate(pickupDate, timeSlot);
        if (available <= 0) {
          Swal.showValidationMessage(`Time slot ${this.getTimeSlotLabel(timeSlot)} is full for this date`);
          return null;
        }

        return { pickupDate, timeSlot };
      }
    });

    if (formValues) {
      try {
        const requestRef = doc(this.firestore, 'requests', request.id);
        await updateDoc(requestRef, {
          status: 'Approved',
          pickupDate: formValues.pickupDate,
          claimTimeSlot: formValues.timeSlot
        });

        // Increment daily count
        this.approvalsToday++;

        // Send Email after approval
        await this.sendApprovalEmail(request, formValues.pickupDate, formValues.timeSlot);

        this.pendingRequests = this.pendingRequests.filter(r => r.id !== request.id);
        this.filteredPendingRequests = this.filteredPendingRequests.filter(r => r.id !== request.id);
        this.setupPagination();
        this.closeDetails();

        Swal.fire('Approved!', `${request.fullName}'s request has been approved. Remaining approvals: ${this.dailyApprovalLimit - this.approvalsToday}`, 'success');
      } catch (error) {
        console.error('Error approving request:', error);
        Swal.fire('Error', 'Failed to approve request.', 'error');
      }
    }
  }

  async loadTodayApprovalsCount() {
    const today = new Date().toISOString().split('T')[0];
    const requestsRef = collection(this.firestore, 'requests');
    const approvedQuery = query(
      requestsRef,
      where('status', '==', 'Approved')
    );
    const snapshot = await getDocs(approvedQuery);

    // Count approvals made today
    this.approvalsToday = snapshot.docs.filter(doc => {
      const data = doc.data();
      const pickupDate = data['pickupDate'];
      return pickupDate === today;
    }).length;
  }

  getSlotAvailability(timeSlot: string): number {
    const slot = this.timeSlots.find(s => s.value === timeSlot);
    if (!slot) return 0;
    return slot.capacity;
  }

  async getSlotCapacityForDate(pickupDate: string, timeSlot: string): Promise<number> {
    const requestsRef = collection(this.firestore, 'requests');
    const slotQuery = query(
      requestsRef,
      where('pickupDate', '==', pickupDate),
      where('claimTimeSlot', '==', timeSlot),
      where('status', 'in', ['Approved', 'Ready for Pickup'])
    );
    const snapshot = await getDocs(slotQuery);
    const slot = this.timeSlots.find(s => s.value === timeSlot);
    const capacity = slot ? slot.capacity : 5;
    return capacity - snapshot.size;
  }

  getTimeSlotLabel(timeSlotValue: string): string {
    const slot = this.timeSlots.find(s => s.value === timeSlotValue);
    return slot ? slot.label : timeSlotValue;
  }

  async declineRequest(request: any) {
    const { value: remarks } = await Swal.fire({
      title: 'Decline Certificate Request',
      html: `
        <div style="text-align: left; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 100%; box-sizing: border-box;">
          <div style="background: linear-gradient(135deg, #f44336 0%, #e53935 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 24px; position: relative; overflow: hidden;">
            <div style="position: absolute; top: 0; right: 0; opacity: 0.1; font-size: 80px; line-height: 1;">✕</div>
            <div style="position: relative; z-index: 1;">
              <p style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9;">Reason for Decline</p>
              <p style="margin: 0; font-size: 14px; opacity: 0.95;">Please select a valid reason for declining this request</p>
            </div>
          </div>
          
          <div style="margin-bottom: 0; box-sizing: border-box;">
            <label for="declineReason" style="display: block; margin-bottom: 8px; font-weight: 600; color: #333; font-size: 14px;">Select Reason</label>
            <select id="declineReason" class="swal2-input modern-input" style="width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; margin: 0; -webkit-appearance: none; -moz-appearance: none; appearance: none; background-image: url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3e%3cpolyline points=%226 9 12 15 18 9%3e%3c/polyline%3e%3c/svg%3e'); background-repeat: no-repeat; background-position: right 10px center; background-size: 20px; padding-right: 36px;">
              <option value="">-- Select a decline reason --</option>
              ${this.declineReasons.map(reason => `<option value="${reason}">${reason}</option>`).join('')}
            </select>
            <small style="color: #666; display: block; margin-top: 5px; font-size: 12px;">This will be sent to the voter</small>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Decline',
      confirmButtonColor: '#f44336',
      cancelButtonText: 'Cancel',
      customClass: {
        container: 'modern-swal-container',
        popup: 'modern-swal-popup',
        title: 'modern-swal-title',
        htmlContainer: 'modern-swal-html'
      },
      preConfirm: () => {
        const declineReason = (document.getElementById('declineReason') as HTMLSelectElement).value;
        if (!declineReason) {
          Swal.showValidationMessage('Please select a reason for declining');
          return null;
        }
        return declineReason;
      }
    });

    if (remarks) {
      const requestRef = doc(this.firestore, 'requests', request.id);
      await updateDoc(requestRef, {
        status: 'Declined',
        remarks: remarks
      });

      // Send Email after decline
      await this.sendDeclineEmail(request, remarks);

      this.pendingRequests = this.pendingRequests.filter(r => r.id !== request.id);
      this.filteredPendingRequests = this.filteredPendingRequests.filter(r => r.id !== request.id);
      this.setupPagination();
      this.closeDetails();

      Swal.fire('Declined!', `${request.fullName}'s request has been declined.`, 'error');
    }
  }

  async sendApprovalEmail(request: any, pickupDate: string, timeSlot: string) {
    const slotLabel = this.timeSlots.find(s => s.value === timeSlot)?.label || timeSlot;
    const templateParams = {
      name: request.fullName,
      pickup_date: pickupDate,
      claim_time: slotLabel,
      copies_requested: request.copiesRequested,
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
