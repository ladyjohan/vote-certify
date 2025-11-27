/**
 * INTEGRATION GUIDE: Login History Service
 * 
 * This file shows how to integrate the LoginHistoryService into your
 * authentication flow to automatically log login and logout events.
 */

// ============================================================
// STEP 1: Update your Auth Service (auth.service.ts)
// ============================================================

/*
Import the LoginHistoryService in your auth.service.ts:

import { LoginHistoryService } from './login-history.service';

Then inject it in the constructor:

constructor(
  private auth: Auth,
  private firestore: Firestore,
  private loginHistoryService: LoginHistoryService  // Add this
) {}

*/

// ============================================================
// STEP 2: Log Login Events
// ============================================================

/*
In your login method, after successful authentication, add:

Example in auth.service.ts:

async login(email: string, password: string): Promise<void> {
  try {
    const result = await signInWithEmailAndPassword(this.auth, email, password);
    const user = result.user;

    // Fetch user details from Firestore
    const userDoc = await getDoc(doc(this.firestore, 'users', user.uid));
    const userData = userDoc.data();

    // LOG LOGIN EVENT
    await this.loginHistoryService.logLogin(
      user.email || '',
      userData?.['fullName'] || 'Unknown',
      userData?.['role'] || 'staff'
    );

    console.log('Login successful');
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

*/

// ============================================================
// STEP 3: Log Logout Events
// ============================================================

/*
In your logout method, add:

Example in auth.service.ts:

async logout(): Promise<void> {
  try {
    const user = this.auth.currentUser;
    
    // LOG LOGOUT EVENT (before signing out)
    if (user?.email) {
      await this.loginHistoryService.logLogout(user.email);
    }

    // Then sign out
    await signOut(this.auth);
    console.log('Logout successful');
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
}

*/

// ============================================================
// STEP 4: Handle Session Timeout (Optional but Recommended)
// ============================================================

/*
You can also log logout events on session timeout:

In your app.component.ts or a global auth interceptor:

ngOnInit() {
  // Listen for auth state changes
  onAuthStateChanged(this.auth, async (user) => {
    if (!user) {
      // User is signed out - could be due to logout or session timeout
      const lastUser = sessionStorage.getItem('lastAuthUser');
      if (lastUser) {
        await this.loginHistoryService.logLogout(lastUser);
        sessionStorage.removeItem('lastAuthUser');
      }
    } else {
      // User is signed in - store their email for logout tracking
      sessionStorage.setItem('lastAuthUser', user.email || '');
    }
  });
}

*/

// ============================================================
// FIRESTORE RULES
// ============================================================

/*
Make sure your Firestore rules allow logging in this collection.
Add this to your firestore.rules:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow only authenticated staff/admins to read login history
    match /login_history/{document=**} {
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'staff'];
      allow write: if request.auth != null;
    }
  }
}

*/

// ============================================================
// EXAMPLE: Complete Auth Service Integration
// ============================================================

/*

import { Injectable } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendEmailVerification
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp
} from '@angular/fire/firestore';
import { LoginHistoryService } from './login-history.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private loginHistoryService: LoginHistoryService
  ) {}

  // LOGIN METHOD
  async login(email: string, password: string): Promise<void> {
    try {
      const result = await signInWithEmailAndPassword(this.auth, email, password);
      const user = result.user;

      // Get user details
      const userDoc = await getDoc(doc(this.firestore, 'users', user.uid));
      const userData = userDoc.data();

      // LOG LOGIN EVENT
      await this.loginHistoryService.logLogin(
        user.email || '',
        userData?.['fullName'] || 'Unknown User',
        userData?.['role'] || 'staff'
      );

      console.log('✅ Login successful and logged');
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  }

  // LOGOUT METHOD
  async logout(): Promise<void> {
    try {
      const user = this.auth.currentUser;
      
      // LOG LOGOUT EVENT
      if (user?.email) {
        await this.loginHistoryService.logLogout(user.email);
      }

      // Sign out from Firebase
      await signOut(this.auth);
      console.log('✅ Logout successful and logged');
    } catch (error) {
      console.error('❌ Logout error:', error);
      throw error;
    }
  }
}

*/

// ============================================================
// TESTING THE INTEGRATION
// ============================================================

/*
To test if login/logout events are being logged:

1. Open your Firestore Database
2. Navigate to the 'login_history' collection
3. You should see documents being created when users login/logout
4. Each document should have:
   - userEmail
   - userFullName
   - role
   - loginTimestamp
   - logoutTimestamp (null if still online)
   - deviceInfo
   - browserInfo
   - status ('online' or 'logged_out')

*/
