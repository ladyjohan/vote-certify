import { Component, OnInit } from '@angular/core';
import { Firestore, collection, getDocs, query, where, addDoc } from '@angular/fire/firestore';
import { Auth, User, onAuthStateChanged } from '@angular/fire/auth';
import { SupabaseService } from '../../../../services/supabase.service';
import { v4 as uuidv4 } from 'uuid';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

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

  // Fetch voter details from Firestore
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
        console.log("Fetched voter data:", userData); // ✅ Debugging log

        if (!userData['fullName'] || !userData['voterId'] || !userData['birthdate']) {
          console.error("⚠️ Missing voter details in Firestore!", userData);
          this.voterNotFound = true;
          return;
        }

        this.voterId = userData['voterId'];
        this.fullName = userData['fullName'];
        this.birthdate = userData['birthdate'];

      } else {
        console.warn("⚠️ No voter record found for email:", email);
        this.voterNotFound = true;
      }
    } catch (error) {
      console.error('🔥 Error fetching voter data:', error);
      alert('Error fetching voter details.');
    } finally {
      this.isLoadingVoter = false;
    }
  }

  // Handle file upload for Government ID and Selfie
  handleFileUpload(event: any, fieldName: 'govId' | 'selfie') {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must not exceed 5MB.');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only JPG and PNG images are allowed.');
      return;
    }

    this.requestForm.patchValue({ [fieldName]: file });
  }

  // Submit the request to Firestore
  async submitRequest() {
    if (this.requestForm.invalid || this.voterNotFound) {
      alert('Please fill in all fields correctly!');
      return;
    }

    if (!this.voterId || !this.fullName || !this.birthdate) {
      alert('Voter details not found. Please reload the page and try again.');
      return;
    }

    // Check if the user already has a pending request
    const hasPendingRequest = await this.checkForPendingRequest();
    if (hasPendingRequest) {
      alert('You already have a pending request. Please wait until it is processed before submitting a new one.');
      return;
    }

    this.isSubmitting = true;
    const { purpose, govId, selfie } = this.requestForm.value;

    try {
      if (!govId || !selfie) {
        alert('Please upload both Government ID and Selfie images.');
        this.isSubmitting = false;
        return;
      }

      // Generate unique filenames for the images
      const govIdFileName = `${this.voterId}-${uuidv4()}.${govId.name.split('.').pop()}`;
      const selfieFileName = `${this.voterId}-${uuidv4()}.${selfie.name.split('.').pop()}`;

      console.log('Uploading files to Supabase...');

      // Upload files to Supabase (inside votecertify-uploads bucket)
      const govIdUpload = await this.supabaseService.uploadFile('gov_ids', govIdFileName, govId);
      const selfieUpload = await this.supabaseService.uploadFile('selfies', selfieFileName, selfie);

      if (!govIdUpload || !selfieUpload) {
        throw new Error('File upload failed.');
      }

      console.log('Files uploaded successfully!');

      // Ensure data is correctly passed to Firestore
      const requestData = {
        voterId: this.voterId,   // Fetched from Firestore
        fullName: this.fullName, // Fetched from Firestore
        birthdate: this.birthdate, // Fetched from Firestore
        purpose,
        govIdUrl: `gov_ids/${govIdFileName}`,
        selfieUrl: `selfies/${selfieFileName}`,
        status: 'Pending',
        submittedAt: new Date()
      };

      console.log('Submitting request to Firestore with data: ', requestData);

      // Store request data in Firestore
      await addDoc(collection(this.firestore, 'requests'), requestData);

      alert('Request submitted successfully!');

      // Reset form while keeping voter details
      this.requestForm.reset({
        purpose: '',
        govId: null,
        selfie: null
      });
    } catch (error: any) {  // Casting 'error' to 'any' to avoid TypeScript error
      console.error('Error submitting request:', error);
      alert('Error submitting request: ' + error.message); // Include detailed error message in alert
    } finally {
      this.isSubmitting = false;
    }
  }

  // Function to check if there is already a pending request
  async checkForPendingRequest() {
    const requestsRef = collection(this.firestore, 'requests');
    const q = query(requestsRef, where('voterId', '==', this.voterId), where('status', '==', 'Pending'));

    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty; // Returns true if there is a pending request
  }
}
