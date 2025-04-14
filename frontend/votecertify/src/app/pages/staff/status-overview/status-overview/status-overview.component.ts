import { Component, OnInit } from '@angular/core';
import { Firestore, collection, getDocs, doc, updateDoc } from '@angular/fire/firestore';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { debounceTime } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-status-overview',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './status-overview.component.html',
  styleUrls: ['./status-overview.component.scss']
})
export class StatusOverviewComponent implements OnInit {
  allRequests: any[] = [];
  filteredRequests: any[] = [];
  searchControl = new FormControl('');

  constructor(private firestore: Firestore) {}

  async ngOnInit() {
    await this.loadRequests();

    this.searchControl.valueChanges.pipe(debounceTime(300)).subscribe(searchText => {
      const term = (searchText || '').toLowerCase();
      this.filteredRequests = this.allRequests.filter(req =>
        req.fullName?.toLowerCase().includes(term) ||
        req.voterId?.toLowerCase().includes(term)
      );
    });
  }

  async loadRequests() {
    const requestsRef = collection(this.firestore, 'requests');
    const snapshot = await getDocs(requestsRef);

    this.allRequests = snapshot.docs.map(doc => {
      const data = doc.data();

      return {
        id: doc.id,
        ...data,
        pickupDate: data['pickupDate'] || null // treat as string
      };
    });

    this.filteredRequests = [...this.allRequests];
  }

  async markAsCompleted(request: any) {
    const confirm = await Swal.fire({
      title: 'Mark as Completed?',
      text: `Confirm that ${request.fullName}'s certificate has been claimed.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, mark it',
      cancelButtonText: 'Cancel'
    });

    if (!confirm.isConfirmed) return;

    try {
      const requestRef = doc(this.firestore, 'requests', request.id);
      await updateDoc(requestRef, { status: 'Completed' });

      request.status = 'Completed'; // update local state for instant UI reflection
      Swal.fire('Success', 'Request marked as completed!', 'success');
    } catch (error) {
      console.error('Error updating request:', error);
      Swal.fire('Error', 'Failed to mark as completed.', 'error');
    }
  }
}
