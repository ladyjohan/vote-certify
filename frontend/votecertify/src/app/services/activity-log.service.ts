import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  Timestamp,
  collectionData,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ActivityLog {
  id?: string;
  userEmail: string;
  userName: string;
  role: string;
  action: string;
  description: string;
  targetId?: string;
  targetName?: string;
  timestamp: Timestamp | Date;
}

@Injectable({
  providedIn: 'root',
})
export class ActivityLogService {
  private firestore: Firestore = inject(Firestore);

  /**
   * Log an activity
   */
  async logActivity(log: Omit<ActivityLog, 'timestamp' | 'id'>): Promise<void> {
    try {
      const activityRef = collection(this.firestore, 'activity_logs');
      await addDoc(activityRef, {
        ...log,
        timestamp: Timestamp.now(),
      });
      console.log('✅ Activity logged:', log.action);
    } catch (error) {
      console.error('❌ Error logging activity:', error);
    }
  }

  /**
   * Get all activity logs in real-time
   */
  getActivityLogsRealtime(pageSize: number = 50): Observable<ActivityLog[]> {
    const activityRef = collection(this.firestore, 'activity_logs');
    const q = query(activityRef, orderBy('timestamp', 'desc'), limit(pageSize));

    return collectionData(q, { idField: 'id' }).pipe(
      map((docs: any[]) => {
        return docs.map((doc) => ({
          ...doc,
          timestamp: doc.timestamp,
        })) as ActivityLog[];
      })
    );
  }
}
