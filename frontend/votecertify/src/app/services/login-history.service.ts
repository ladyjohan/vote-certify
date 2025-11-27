import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Firestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  collectionData,
  QueryConstraint,
  limit,
  startAfter,
  DocumentSnapshot,
  updateDoc,
  onSnapshot,
} from '@angular/fire/firestore';

export interface LoginHistoryRecord {
  id?: string;
  userEmail: string;
  userName: string;
  role: 'admin' | 'staff';
  loginTimestamp: Timestamp | Date;
  logoutTimestamp?: Timestamp | Date | null;
  deviceInfo: string;
  browserInfo: string;
  ipAddress?: string;
  status: 'online' | 'logged_out';
}

@Injectable({
  providedIn: 'root',
})
export class LoginHistoryService {
  private firestore: Firestore = inject(Firestore);
  private injector: Injector = inject(Injector);

  /**
   * Log a login event
   */
  async logLogin(
    userEmail: string,
    userName: string,
    role: 'admin' | 'staff'
  ): Promise<void> {
    try {
      const deviceInfo = this.getDeviceInfo();
      const browserInfo = this.getBrowserInfo();

      const loginRecord: any = {
        userEmail,
        userName,
        role,
        loginTimestamp: Timestamp.now(),
        deviceInfo,
        browserInfo,
        status: 'online',
      };
      // Don't set logoutTimestamp - let it be undefined until logout
      
      const loginHistoryRef = collection(this.firestore, 'login_history');
      const docRef = await addDoc(loginHistoryRef, loginRecord);
      console.log('✅ Login event recorded. ID:', docRef.id, 'Browser:', browserInfo);
      return;
    } catch (error: any) {
      console.error('❌ Error logging login event:', error.message);
      return;
    }
  }

  /**
   * Log a logout event by updating the most recent login record
   * Uses onSnapshot (real-time listener) instead of getDocs to avoid composite index requirement
   */
  async logLogout(userEmail: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔐 logLogout: Starting for', userEmail);
        
        const loginHistoryRef = collection(this.firestore, 'login_history');
        
        // Simple query: just filter by userEmail, no orderBy needed with onSnapshot
        const userQuery = query(
          loginHistoryRef,
          where('userEmail', '==', userEmail)
        );

        console.log('🔐 logLogout: Setting up listener');
        
        // Use onSnapshot to get real-time updates - this doesn't require a composite index
        const unsubscribe = onSnapshot(
          userQuery,
          (snapshot) => {
            console.log('🔐 logLogout: Listener fired, received', snapshot.docs.length, 'documents');
            
            // Find the most recent online session
            let onlineDoc: any = null;
            let mostRecentTime = 0;
            
            snapshot.docs.forEach((doc: any) => {
              const data = doc.data();
              if (data['status'] === 'online') {
                const timestamp = data['loginTimestamp'];
                const timeMs = timestamp?.toDate?.()?.getTime?.() || timestamp?.seconds * 1000 || 0;
                
                if (timeMs > mostRecentTime) {
                  mostRecentTime = timeMs;
                  onlineDoc = doc;
                }
              }
            });
            
            if (onlineDoc) {
              console.log('🔐 logLogout: Found online document ID:', onlineDoc.id);
              
              const logoutTime = Timestamp.now();
              console.log('🔐 logLogout: Created timestamp:', logoutTime.toDate());
              
              const updateData: any = {
                logoutTimestamp: logoutTime,
                status: 'logged_out',
              };
              
              console.log('🔐 logLogout: Updating with:', updateData);
              updateDoc(onlineDoc.ref, updateData)
                .then(() => {
                  console.log('✅ Logout event recorded. Email:', userEmail, 'Document:', onlineDoc.id);
                  unsubscribe(); // Stop listening
                  resolve();
                })
                .catch((error) => {
                  console.error('❌ Error updating document:', error.message);
                  unsubscribe();
                  reject(error);
                });
            } else {
              console.warn('⚠️ No active session found for:', userEmail);
              unsubscribe();
              resolve(); // Resolve even if no session found (not an error)
            }
          },
          (error) => {
            console.error('❌ Error in logLogout listener:', error.message);
            reject(error);
          }
        );
      } catch (error: any) {
        console.error('❌ Error setting up logLogout:', error.message);
        reject(error);
      }
    });
  }

  /**
   * Get all login history records with real-time updates (Observable)
   * This uses Firestore's real-time listener instead of polling
   * Only ONE listener is created, so minimal database reads
   */
  getLoginHistoryRealtime(pageSize: number = 50): Observable<LoginHistoryRecord[]> {
    const loginHistoryRef = collection(this.firestore, 'login_history');
    const q = query(
      loginHistoryRef,
      orderBy('loginTimestamp', 'desc'),
      limit(pageSize)
    );

    // collectionData() creates a single listener that auto-updates
    // No polling, no excessive reads - just one listener
    // Map the data to ensure timestamps are properly converted
    return collectionData(q, { idField: 'id' }).pipe(
      map((docs: any[]) => {
        return docs.map((doc) => {
          // Ensure timestamp fields are properly formatted
          return {
            ...doc,
            loginTimestamp: doc.loginTimestamp,
            logoutTimestamp: doc.logoutTimestamp || null,
          } as LoginHistoryRecord;
        });
      })
    ) as Observable<LoginHistoryRecord[]>;
  }

  /**
   * Get all login history records with pagination (one-time read)
   */
  async getLoginHistory(pageSize: number = 50): Promise<LoginHistoryRecord[]> {
    try {
      console.log('🔍 Fetching login history from Firestore...');
      const loginHistoryRef = collection(this.firestore, 'login_history');
      const q = query(
        loginHistoryRef,
        orderBy('loginTimestamp', 'desc'),
        limit(pageSize)
      );

      const snapshot = await getDocs(q);
      console.log('✅ Snapshot received. Document count:', snapshot.docs.length);
      
      const records = snapshot.docs.map((doc) => {
        const data = doc.data();
        console.log('📄 Document:', doc.id, data);
        return {
          id: doc.id,
          ...data,
        } as LoginHistoryRecord;
      });
      
      console.log('📊 Final records array:', records);
      return records;
    } catch (error) {
      console.error('❌ Error fetching login history:', error);
      return [];
    }
  }

  /**
   * Get login history for a specific user
   */
  async getUserLoginHistory(
    userEmail: string,
    pageSize: number = 50
  ): Promise<LoginHistoryRecord[]> {
    try {
      const loginHistoryRef = collection(this.firestore, 'login_history');
      const q = query(
        loginHistoryRef,
        where('userEmail', '==', userEmail),
        orderBy('loginTimestamp', 'desc'),
        limit(pageSize)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as LoginHistoryRecord));
    } catch (error) {
      console.error('Error fetching user login history:', error);
      return [];
    }
  }

  /**
   * Get login history for a specific role
   */
  async getRoleLoginHistory(
    role: 'admin' | 'staff',
    pageSize: number = 50
  ): Promise<LoginHistoryRecord[]> {
    try {
      const loginHistoryRef = collection(this.firestore, 'login_history');
      const q = query(
        loginHistoryRef,
        where('role', '==', role),
        orderBy('loginTimestamp', 'desc'),
        limit(pageSize)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as LoginHistoryRecord));
    } catch (error) {
      console.error('Error fetching role login history:', error);
      return [];
    }
  }

  /**
   * Get device information
   */
  private getDeviceInfo(): string {
    const userAgent = navigator.userAgent;
    if (/mobile/i.test(userAgent)) return 'Mobile';
    if (/tablet/i.test(userAgent)) return 'Tablet';
    return 'Desktop';
  }

  /**
   * Get browser information
   * Order matters - check specific browsers before generic ones
   */
  private getBrowserInfo(): string {
    const userAgent = navigator.userAgent;

    // Check Brave before Chrome (Brave contains Chrome in user agent)
    if (userAgent.indexOf('Brave') > -1) return 'Brave';
    // Brave also has navigator.brave API
    if ((navigator as any).brave?.isBrave) return 'Brave';
    
    // Check Edge before Chrome (some Edge versions contain Chrome)
    if (userAgent.indexOf('Edg') > -1) return 'Edge';
    // Check Firefox
    if (userAgent.indexOf('Firefox') > -1) return 'Firefox';
    // Check Opera/OPR before Safari (Opera might contain Safari)
    if (userAgent.indexOf('Opera') > -1 || userAgent.indexOf('OPR') > -1) return 'Opera';
    // Check Chrome (after Brave, Edge, Firefox, Opera)
    if (userAgent.indexOf('Chrome') > -1) return 'Chrome';
    // Check Safari last (generic)
    if (userAgent.indexOf('Safari') > -1) return 'Safari';

    return 'Unknown';
  }
}
