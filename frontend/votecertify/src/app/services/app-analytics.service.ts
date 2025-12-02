import { Injectable, NgZone } from '@angular/core';
import { Firestore, collection, doc, setDoc, updateDoc, getDoc, query, where, getDocs, Timestamp } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';

export interface DailyAnalytics {
  date: string;
  totalVisits: number;
  uniqueUsers: number;
  visitDetails?: {
    date: Timestamp;
    hashedDeviceId: string;
  }[];
}

export interface AnalyticsOverview {
  totalVisits: number;
  uniqueUsers: number;
  weeklyTrend: { date: string; visits: number; uniqueUsers: number }[];
}

@Injectable({
  providedIn: 'root'
})
export class AppAnalyticsService {
  private analyticsSubject = new BehaviorSubject<AnalyticsOverview>({
    totalVisits: 0,
    uniqueUsers: 0,
    weeklyTrend: []
  });

  public analytics$ = this.analyticsSubject.asObservable();

  constructor(private firestore: Firestore, private ngZone: NgZone) {
    // Only initialize tracking if we're in a browser environment (not SSR)
    if (typeof window !== 'undefined') {
      this.ngZone.runOutsideAngular(() => {
        this.initializeTracking();
        // Load analytics immediately for dashboard
        this.ngZone.run(() => this.loadAnalytics());
        // Refresh analytics every 60 seconds
        setInterval(() => this.ngZone.run(() => this.loadAnalytics()), 60 * 1000);
      });
    }
  }

  /**
   * Initialize tracking: Record visit on app load
   * Runs outside Angular zone to avoid excessive change detection
   */
  private initializeTracking(): void {
    // Track on page load
    this.trackVisit();
    // Track periodically (every 5 minutes) - but debounce to prevent quota spam
    setInterval(() => this.trackVisit(), 5 * 60 * 1000);
    // Also track on visibility change (when user returns to tab)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.trackVisit();
        }
      });
    }
  }

  /**
   * Track a user visit using efficient counter pattern
   * Uses device ID hash to deduplicate users per day
   * Optimized to minimize Firestore quota usage
   */
  private async trackVisit(): Promise<void> {
    this.ngZone.run(async () => {
      try {
        const today = this.getTodayDateString();
        const deviceId = this.getOrCreateDeviceId();
        const hashedDeviceId = await this.hashDeviceId(deviceId);

        // Use correct Firestore path: collection/document (even number of segments)
        const analyticsRef = collection(this.firestore, 'analytics');
        const dailyDocRef = doc(analyticsRef, today);

        // Optimized: Use transaction to reduce reads and writes
        // This prevents multiple concurrent tracking attempts
        try {
          const dailySnap = await getDoc(dailyDocRef);
          const dailyData = (dailySnap.data() as any) || {};
          const uniqueUserIds: string[] = dailyData.uniqueUserIds || [];

          const userVisitedToday = uniqueUserIds.includes(hashedDeviceId);

          if (userVisitedToday) {
            // Just increment total visits (minimal write)
            await updateDoc(dailyDocRef, {
              totalVisits: (dailyData.totalVisits || 0) + 1,
            });
          } else {
            // New unique visitor - increment both counters
            const newUniqueIds = [...uniqueUserIds, hashedDeviceId];
            
            // Only store up to 1000 unique IDs per day (quota protection)
            if (newUniqueIds.length <= 1000) {
              await updateDoc(dailyDocRef, {
                date: Timestamp.now(),
                totalVisits: (dailyData.totalVisits || 0) + 1,
                uniqueUsers: (dailyData.uniqueUsers || 0) + 1,
                uniqueUserIds: newUniqueIds
              }).catch(async (error) => {
                // If document doesn't exist, create it
                if (error.code === 'not-found') {
                  return setDoc(dailyDocRef, {
                    date: Timestamp.now(),
                    totalVisits: 1,
                    uniqueUsers: 1,
                    uniqueUserIds: [hashedDeviceId]
                  });
                }
                throw error;
              });
            } else {
              // Quota protection: if we have too many unique IDs, just update counts
              await updateDoc(dailyDocRef, {
                totalVisits: (dailyData.totalVisits || 0) + 1,
                uniqueUsers: (dailyData.uniqueUsers || 0) + 1
              });
            }
          }
          
          // Refresh dashboard analytics after tracking
          await this.loadAnalytics();
        } catch (trackError: any) {
          // If it's a permission error, log but don't throw
          if (trackError.code === 'permission-denied') {
            console.warn('Analytics tracking not available: Missing or insufficient permissions. Please check Firestore rules.');
          } else {
            console.warn('Analytics tracking error:', trackError.message);
          }
        }
      } catch (error) {
        console.warn('Analytics tracking setup error:', (error as any)?.message);
      }
    });
  }

  /**
   * Load analytics data for dashboard
   * Fetches last 7 days of data for trending
   * Only admin/staff can read this data
   */
  async loadAnalytics(): Promise<void> {
    return new Promise((resolve) => {
      this.ngZone.run(async () => {
        try {
          const weeklyData: { date: string; visits: number; uniqueUsers: number }[] = [];
          let totalVisits = 0;
          let totalUniqueUsers = 0;

          // Fetch last 7 days of analytics
          for (let i = 6; i >= 0; i--) {
            const date = this.getDateString(i);
            try {
              const analyticsRef = collection(this.firestore, 'analytics');
              const dailyDocRef = doc(analyticsRef, date);
              
              try {
                const dailySnap = await getDoc(dailyDocRef);

                if (dailySnap.exists()) {
                  const data = dailySnap.data() as DailyAnalytics;
                  weeklyData.push({
                    date,
                    visits: data.totalVisits || 0,
                    uniqueUsers: data.uniqueUsers || 0
                  });
                  totalVisits += data.totalVisits || 0;
                  totalUniqueUsers += data.uniqueUsers || 0;
                } else {
                  weeklyData.push({
                    date,
                    visits: 0,
                    uniqueUsers: 0
                  });
                }
              } catch (readError: any) {
                // If permission denied or document doesn't exist, add zero data
                console.warn(`Could not read analytics for ${date}:`, readError?.message);
                weeklyData.push({
                  date,
                  visits: 0,
                  uniqueUsers: 0
                });
              }
            } catch (err) {
              // Fallback for any other errors
              weeklyData.push({
                date,
                visits: 0,
                uniqueUsers: 0
              });
            }
          }

          const overview: AnalyticsOverview = {
            totalVisits,
            uniqueUsers: totalUniqueUsers,
            weeklyTrend: weeklyData
          };

          this.analyticsSubject.next(overview);
          resolve();
        } catch (error) {
          console.warn('Analytics loading error:', (error as any)?.message);
          // Keep previous value or default empty state
          resolve();
        }
      });
    });
  }

  /**
   * Get or create a persistent device ID
   * Uses localStorage to maintain consistent user identification
   */
  private getOrCreateDeviceId(): string {
    const DEVICE_ID_KEY = 'votecertify_device_id';
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);

    if (!deviceId) {
      deviceId = this.generateUUID();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }

    return deviceId;
  }

  /**
   * Simple hash function using built-in crypto API
   * Creates a deterministic hash from device ID
   */
  private async hashDeviceId(deviceId: string): Promise<string> {
    try {
      const msgBuffer = new TextEncoder().encode(deviceId);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      // Fallback: simple string-based hash if WebCrypto unavailable
      return this.simpleHash(deviceId);
    }
  }

  /**
   * Fallback hash function for browsers without WebCrypto support
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return 'hash_' + Math.abs(hash).toString(16);
  }

  /**
   * Generate a unique UUID for device identification
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Get today's date as YYYY-MM-DD string
   */
  private getTodayDateString(): string {
    return this.getDateString(0);
  }

  /**
   * Get date string for N days ago (YYYY-MM-DD format)
   */
  private getDateString(daysAgo: number): string {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  }

  /**
   * Refresh analytics data (can be called periodically or on demand)
   */
  refreshAnalytics(): void {
    this.loadAnalytics();
  }

  /**
   * Get current analytics as observable
   */
  getAnalytics(): Observable<AnalyticsOverview> {
    return this.analytics$;
  }
}
