import { Component, OnInit } from '@angular/core';
import { Firestore, collection, getDocs, query, where, addDoc } from '@angular/fire/firestore';
import { Auth, User, onAuthStateChanged } from '@angular/fire/auth';
import { SupabaseService } from '../../../../services/supabase.service';
import { v4 as uuidv4 } from 'uuid';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';

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
  voterId: string = '';
  fullName: string = '';
  birthdate: string = '';

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private supabaseService: SupabaseService,
    private fb: FormBuilder
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

        if (!userData['fullName'] || !userData['voterId'] || !userData['birthdate']) {
          this.voterNotFound = true;
          return;
        }

        this.voterId = userData['voterId'];
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
    if (this.requestForm.invalid || this.voterNotFound) {
      Swal.fire('Incomplete Form', 'Please fill in all fields correctly.', 'warning');
      return;
    }

    if (!this.voterId || !this.fullName || !this.birthdate) {
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

      const govIdFileName = `${this.voterId}-${uuidv4()}.${govId.name.split('.').pop()}`;
      const selfieFileName = `${this.voterId}-${uuidv4()}.${selfie.name.split('.').pop()}`;

      const govIdUpload = await this.supabaseService.uploadFile('gov_ids', govIdFileName, govId);
      const selfieUpload = await this.supabaseService.uploadFile('selfies', selfieFileName, selfie);

      if (!govIdUpload || !selfieUpload) {
        throw new Error('File upload failed.');
      }

      const requestData = {
        voterId: this.voterId,
        fullName: this.fullName,
        birthdate: this.birthdate,
        purpose,
        govIdUrl: `gov_ids/${govIdFileName}`,
        selfieUrl: `selfies/${selfieFileName}`,
        status: 'Pending',
        submittedAt: new Date()
      };

      await addDoc(collection(this.firestore, 'requests'), requestData);

      await Swal.fire('Success', 'Request submitted successfully!', 'success');

      this.requestForm.reset({
        purpose: '',
        govId: null,
        selfie: null
      });
    } catch (error: any) {
      console.error('Error submitting request:', error);
      Swal.fire('Submission Failed', error.message, 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  async checkForPendingRequest() {
    const requestsRef = collection(this.firestore, 'requests');
    const q = query(requestsRef, where('voterId', '==', this.voterId), where('status', '==', 'Pending'));

    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  }
}
