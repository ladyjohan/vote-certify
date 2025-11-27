import { Injectable } from '@angular/core';
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

  constructor(private firestore: Firestore) {
    this.initializeTracking();
    this.loadAnalytics();
  }

  /**
   * Initialize tracking: Record visit on app load
   */
  private initializeTracking(): void {
    this.trackVisit();
    // Optionally track periodically (e.g., every 5 minutes) to catch session returns
    setInterval(() => this.trackVisit(), 5 * 60 * 1000);
  }

  /**
   * Track a user visit using efficient counter pattern
   * Uses device ID hash to deduplicate users per day
   */
  private async trackVisit(): Promise<void> {
    try {
      const today = this.getTodayDateString();
      const deviceId = this.getOrCreateDeviceId();
      const hashedDeviceId = await this.hashDeviceId(deviceId);

      const dailyDocRef = doc(this.firestore, `analytics/daily/${today}`);

      // Check if this user already visited today
      const dailySnap = await getDoc(dailyDocRef);
      const dailyData = dailySnap.data() as any || {};

      const userVisitedToday = dailyData.uniqueUserIds?.includes(hashedDeviceId) || false;

      // Update visit counter
      await updateDoc(dailyDocRef, {
        date: Timestamp.now(),
        totalVisits: (dailyData.totalVisits || 0) + 1,
        ...(userVisitedToday ? {} : { uniqueUsers: (dailyData.uniqueUsers || 0) + 1 }),
      }).catch(() => {
        // If document doesn't exist, create it
        return setDoc(dailyDocRef, {
          date: Timestamp.now(),
          totalVisits: 1,
          uniqueUsers: 1,
          uniqueUserIds: [hashedDeviceId]
        });
      });

      // Add user to unique users list (for tracking unique visitors)
      if (!userVisitedToday) {
        const uniqueUserIds = dailyData.uniqueUserIds || [];
        await updateDoc(dailyDocRef, {
          uniqueUserIds: [...uniqueUserIds, hashedDeviceId]
        }).catch(() => {
          // Ignore errors if document doesn't exist yet
        });
      }
    } catch (error) {
      console.error('Error tracking visit:', error);
    }
  }

  /**
   * Load analytics data for dashboard
   * Fetches last 7 days of data for trending
   */
  async loadAnalytics(): Promise<void> {
    try {
      const weeklyData: { date: string; visits: number; uniqueUsers: number }[] = [];
      let totalVisits = 0;
      let totalUniqueUsers = 0;

      // Fetch last 7 days of analytics
      for (let i = 6; i >= 0; i--) {
        const date = this.getDateString(i);
        const dailyDocRef = doc(this.firestore, `analytics/daily/${date}`);
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
      }

      const overview: AnalyticsOverview = {
        totalVisits,
        uniqueUsers: totalUniqueUsers,
        weeklyTrend: weeklyData
      };

      this.analyticsSubject.next(overview);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
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
