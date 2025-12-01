import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, getDocs, updateDoc, Timestamp } from '@angular/fire/firestore';

/**
 * Service to handle logout via beacon when user closes tab
 * This makes a direct Firestore update when page is unloading
 */
@Injectable({ providedIn: 'root' })
export class LogoutBeaconService {
  private firestore: Firestore = inject(Firestore);

  /**
   * Synchronously log out user via Firestore
   * Called from beforeunload event handler
   */
  logoutSync(userEmail: string): void {
    // Try to perform sync Firestore update via fetch
    const logoutData = {
      userEmail: userEmail,
      action: 'logout'
    };

    // Use sendBeacon to ensure request completes even on tab close
    const blob = new Blob([JSON.stringify(logoutData)], { type: 'application/json' });
    
    // Send to a hypothetical endpoint (if backend exists)
    navigator.sendBeacon('/api/logout', blob);
    
    console.log('📤 Logout beacon sent for:', userEmail);
  }

  /**
   * Alternative: Direct sync logout call
   * This will be called from beforeunload
   */
  async logoutDirect(userEmail: string): Promise<void> {
    try {
      const loginHistoryRef = collection(this.firestore, 'login_history');
      
      // Query for the most recent online session
      const q = query(
        loginHistoryRef,
        where('userEmail', '==', userEmail),
        where('status', '==', 'online')
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.docs.length > 0) {
        // Get the most recent online record
        const doc = snapshot.docs[snapshot.docs.length - 1];
        
        // Update to logged out
        await updateDoc(doc.ref, {
          status: 'logged_out',
          logoutTimestamp: Timestamp.now()
        });
        
        console.log('✅ User logged out:', userEmail);
      }
    } catch (error) {
      console.error('Error in logout direct:', error);
    }
  }
}
