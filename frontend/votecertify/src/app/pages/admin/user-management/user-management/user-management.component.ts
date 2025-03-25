import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { getAuth, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { Firestore, doc, setDoc, collection, getDocs, getDoc, deleteDoc } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';

// Define a User interface
interface User {
  id: string;
  email: string;
  role: string;
  name: string;
  dob: string;  // Date of birth
  voterId: string;
}

@Component({
  selector: 'app-admin-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class AdminUserManagementComponent implements OnInit {
  staffEmail: string = '';
  staffPassword: string = '';
  users: User[] = [];  // Store users
  filteredUsers: User[] = [];  // Filtered users based on search query
  searchQuery: string = '';  // Search query string
  isAdmin = false;

  constructor(private firestore: Firestore) {}

  async ngOnInit() {
    await this.checkAdminRole();
    await this.loadUsers();
  }

  // Method to check if the current user is an admin
  async checkAdminRole() {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      const userDocRef = doc(this.firestore, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);  // Use getDoc for a single document

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data() as User;
        if (userData.role === 'admin') {
          this.isAdmin = true;
        } else {
          window.alert('Unauthorized access!');
          window.location.href = '/';
        }
      }
    } else {
      window.alert('You are not logged in!');
      window.location.href = '/';
    }
  }

  // Method to add a new staff member
  async addStaff() {
    if (!this.isAdmin) return; // Prevent non-admins from adding staff

    const auth = getAuth();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, this.staffEmail, this.staffPassword);
      const userId = userCredential.user.uid;

      // Add user to Firestore with "staff" role
      const userDocRef = doc(this.firestore, 'users', userId);
      await setDoc(userDocRef, {
        email: this.staffEmail,
        role: 'staff',
        name: 'New Staff',  // Placeholder for name (can be updated later)
        dob: '01/01/2000',  // Placeholder for date of birth
        voterId: '0000-000000-0000'  // Placeholder for voter ID
      });

      console.log('✅ Staff account created:', this.staffEmail);
      this.staffEmail = '';
      this.staffPassword = '';
      await this.loadUsers(); // Refresh the user list
    } catch (error) {
      console.error('❌ Error adding staff:', error);
      window.alert('Error creating staff account. Please try again.');
    }
  }

  // Method to load users from Firestore
  async loadUsers() {
    const usersCollectionRef = collection(this.firestore, 'users');
    const querySnapshot = await getDocs(usersCollectionRef);  // Corrected to getDocs

    this.users = querySnapshot.docs.map(doc => {  // Added correct typing
      return {
        id: doc.id,
        ...doc.data()
      } as User;
    });

    this.filteredUsers = this.users;
  }

  // Method to delete a user
  async deleteUser(userId: string) {
    try {
      await deleteDoc(doc(this.firestore, 'users', userId));
      console.log('✅ User removed');
      this.loadUsers(); // Refresh the user list
    } catch (error) {
      console.error('❌ Error deleting user:', error);
    }
  }

  // Filter users based on search query
  filterUsers() {
    if (this.searchQuery === '') {
      this.filteredUsers = this.users;
    } else {
      this.filteredUsers = this.users.filter(user =>
        user.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        user.voterId.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
    }
  }
}
