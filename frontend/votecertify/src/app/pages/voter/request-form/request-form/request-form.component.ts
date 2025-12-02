import { Component, OnInit } from '@angular/core';
import { Firestore, collection, getDocs, query, where, addDoc } from '@angular/fire/firestore';
import { Auth, User, onAuthStateChanged } from '@angular/fire/auth';
import { SupabaseService } from '../../../../services/supabase.service';
import { ChatService } from '../../../../services/chat.service';
import { v4 as uuidv4 } from 'uuid';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2/dist/sweetalert2.js';

@Component({
  selector: 'app-request-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './request-form.component.html',
  styleUrls: ['./request-form.component.scss']
})
export class RequestFormComponent implements OnInit {
  requestForm: FormGroup;
  isSubmitting: boolean = false;
  isLoadingVoter: boolean = false;
  voterNotFound: boolean = false;
  currentUser: User | null = null;
  fullName: string = '';
  birthdate: string = '';
  hasPendingRequest: boolean = false;  // Flag to track if the user has a pending or approved request
  hasApprovedRequest: boolean = false;  // Flag to track if the user has an approved but not completed request
  isInCooldown: boolean = false;  // Flag to track if user is in 3-month cooldown
  daysRemaining: number = 0;  // Days until user can request again
  lastCompletedDate: Date | null = null;  // Date when last request was completed

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private supabaseService: SupabaseService,
    private fb: FormBuilder,
    private chatService: ChatService
  ) {
    this.requestForm = this.fb.group({
      purpose: ['', Validators.required],
      govId: [null, Validators.required],
      selfie: [null, Validators.required]
    });
  }

  ngOnInit() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.currentUser = user;
        await this.fetchVoterDetails(user.email);
        await this.checkForPendingOrApprovedRequest(); // Check if the user has a pending or approved request
        await this.checkRequestCooldown(); // Check if user is in 3-month cooldown
      }
    });
  }

  async fetchVoterDetails(email: string | null) {
    if (!email) return;

    this.isLoadingVoter = true;
    this.voterNotFound = false;

    try {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();

        if (!userData['fullName'] || !userData['birthdate']) {
          this.voterNotFound = true;
          return;
        }

        this.fullName = userData['fullName'];
        this.birthdate = userData['birthdate'];
      } else {
        this.voterNotFound = true;
      }
    } catch (error) {
      console.error('Error fetching voter data:', error);
      Swal.fire('Error', 'Error fetching voter details.', 'error');
    } finally {
      this.isLoadingVoter = false;
    }
  }

  handleFileUpload(event: any, fieldName: 'govId' | 'selfie') {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      Swal.fire('File too large', 'File size must not exceed 5MB.', 'warning');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      Swal.fire('Invalid file type', 'Only JPG and PNG images are allowed.', 'warning');
      return;
    }

    this.requestForm.patchValue({ [fieldName]: file });
  }

  async submitRequest() {
    if (this.requestForm.invalid || this.voterNotFound || this.hasPendingRequest || this.hasApprovedRequest || this.isInCooldown) {
      if (this.hasPendingRequest) {
        Swal.fire('Pending Request', 'You already have a pending request. Please wait for it to be processed before submitting a new one.', 'warning');
      } else if (this.hasApprovedRequest) {
        Swal.fire('Approved Request', 'You still haven\'t claimed your voter certificate at the office. Please claim it before requesting a new one.', 'warning');
      } else if (this.isInCooldown) {
        Swal.fire('Request Cooldown', `You may request again after ${this.daysRemaining} day${this.daysRemaining !== 1 ? 's' : ''}. You can only submit one request every 3 months.`, 'warning');
      } else {
        Swal.fire('Incomplete Form', 'Please fill in all fields correctly.', 'warning');
      }
      return;
    }

    if (!this.fullName || !this.birthdate) {
      Swal.fire('Missing Voter Info', 'Please reload the page and try again.', 'warning');
      return;
    }

    const confirm = await Swal.fire({
      title: 'Confirm Submission',
      text: 'Are you sure you want to submit this request?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, submit it!',
      cancelButtonText: 'Cancel'
    });

    if (!confirm.isConfirmed) return;

    this.isSubmitting = true;
    const { purpose, govId, selfie } = this.requestForm.value;

    try {
      if (!govId || !selfie) {
        Swal.fire('Missing Files', 'Please upload both Government ID and Selfie.', 'warning');
        this.isSubmitting = false;
        return;
      }

      const govIdFileName = `${this.currentUser?.uid}-${uuidv4()}.${govId.name.split('.').pop()}`;
      const selfieFileName = `${this.currentUser?.uid}-${uuidv4()}.${selfie.name.split('.').pop()}`;

      const govIdUpload = await this.supabaseService.uploadFile('gov_ids', govIdFileName, govId);
      const selfieUpload = await this.supabaseService.uploadFile('selfies', selfieFileName, selfie);

      if (!govIdUpload || !selfieUpload) {
        throw new Error('File upload failed.');
      }

      const requestData = {
        fullName: this.fullName,
        birthdate: this.birthdate,
        purpose,
        copiesRequested: 1,
        govIdUrl: `gov_ids/${govIdFileName}`,
        selfieUrl: `selfies/${selfieFileName}`,
        email: this.currentUser?.email,
        status: 'Pending',
        submittedAt: new Date()
      };

      const docRef = await addDoc(collection(this.firestore, 'requests'), requestData);

      // Seed chat with staff greeting so voter immediately sees guidance
      await this.chatService.sendMessage(
        docRef.id,
        'staff',
        'staff-automated',
        'Good day! Before we proceed with your request, I need to verify your identity. May I ask you to confirm some basic information?'
      );

      await Swal.fire('Success', 'Request submitted successfully!', 'success');

      // Reset form completely including file inputs
      this.requestForm.reset({
        purpose: '',
        govId: null,
        selfie: null
      });

      // Clear file input elements - use setTimeout to ensure DOM is updated
      setTimeout(() => {
        const govIdInput = document.getElementById('govId') as HTMLInputElement;
        const selfieInput = document.getElementById('selfie') as HTMLInputElement;
        if (govIdInput) {
          govIdInput.value = '';
        }
        if (selfieInput) {
          selfieInput.value = '';
        }
      }, 0);
    } catch (error: any) {
      console.error('Error submitting request:', error);
      Swal.fire('Submission Failed', error.message, 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  async checkForPendingOrApprovedRequest() {
    const requestsRef = collection(this.firestore, 'requests');

    // Check for pending requests
    const pendingQuery = query(requestsRef, where('email', '==', this.currentUser?.email), where('status', '==', 'Pending'));
    const pendingSnapshot = await getDocs(pendingQuery);
    this.hasPendingRequest = !pendingSnapshot.empty;

    // Check for approved (but not completed) requests
    const approvedQuery = query(requestsRef, where('email', '==', this.currentUser?.email), where('status', '==', 'Approved'));
    const approvedSnapshot = await getDocs(approvedQuery);
    this.hasApprovedRequest = !approvedSnapshot.empty;
  }

  async checkRequestCooldown() {
    try {
      const requestsRef = collection(this.firestore, 'requests');
      
      // Check for completed requests (status = 'Completed', 'Claimed', or 'Ready for Pickup')
      // These statuses indicate the user has received or is ready to receive their certificate
      const completedQuery = query(
        requestsRef, 
        where('email', '==', this.currentUser?.email), 
        where('status', 'in', ['Completed', 'Claimed', 'Ready for Pickup'])
      );
      const completedSnapshot = await getDocs(completedQuery);

      if (completedSnapshot.empty) {
        // No completed requests, no cooldown
        this.isInCooldown = false;
        this.daysRemaining = 0;
        console.log('✅ No completed requests found - no cooldown');
        return;
      }

      // Get the most recent completed request
      let mostRecentDate: Date | null = null;
      let mostRecentStatus = '';
      
      completedSnapshot.forEach((doc) => {
        const data = doc.data();
        const completedAt = data['completedAt'] || data['claimedAt'] || data['approvedAt'] || data['pickupDate'] || data['submittedAt'];
        
        if (completedAt) {
          let dateObj: Date;
          
          // Handle both Firestore Timestamp and Date objects
          if (completedAt.toDate) {
            dateObj = completedAt.toDate();
          } else if (completedAt instanceof Date) {
            dateObj = completedAt;
          } else if (typeof completedAt === 'string') {
            dateObj = new Date(completedAt);
          } else {
            dateObj = new Date(completedAt);
          }

          if (!mostRecentDate || dateObj > mostRecentDate) {
            mostRecentDate = dateObj;
            mostRecentStatus = data['status'];
          }
        }
      });

      if (!mostRecentDate) {
        this.isInCooldown = false;
        this.daysRemaining = 0;
        console.log('✅ No completed date found - no cooldown');
        return;
      }

      this.lastCompletedDate = mostRecentDate;
      console.log(`📅 Most recent completed request: ${mostRecentStatus} on ${mostRecentDate}`);

      // Calculate days until next request is allowed (3 months = 90 days)
      const COOLDOWN_DAYS = 90;
      const nextRequestDate = new Date(mostRecentDate);
      nextRequestDate.setDate(nextRequestDate.getDate() + COOLDOWN_DAYS);

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset to start of day for accurate comparison
      
      const timeRemaining = nextRequestDate.getTime() - today.getTime();
      const daysLeft = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));

      if (daysLeft > 0) {
        this.isInCooldown = true;
        this.daysRemaining = daysLeft;
        console.log(`📅 User is in cooldown. Days remaining: ${this.daysRemaining}`);
      } else {
        this.isInCooldown = false;
        this.daysRemaining = 0;
        console.log('✅ Cooldown period has ended');
      }
    } catch (error) {
      console.error('Error checking request cooldown:', error);
    }
  }
}
