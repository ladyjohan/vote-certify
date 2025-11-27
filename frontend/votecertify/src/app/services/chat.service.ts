import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  orderBy,
  query,
  where,
  addDoc,
  serverTimestamp,
  updateDoc,
  getDocs,
  writeBatch,
  limit,
  startAfter,
  DocumentSnapshot,
  onSnapshot,
  Unsubscribe
} from '@angular/fire/firestore';
import { Observable, BehaviorSubject, Subscription, map } from 'rxjs';
import { shareReplay, switchMap, startWith } from 'rxjs/operators';

export type ChatSender = 'voter' | 'staff';

export interface ChatMessage {
  id?: string;
  sender: ChatSender;
  senderId: string;
  message: string;
  timestamp?: any;
  readByVoter?: boolean;
  readByStaff?: boolean;
}

export interface ChatRequest {
  id: string;
  fullName?: string;
  voterId?: string;
  status?: string;
  submittedAt?: any;
  email?: string;
  purpose?: string;
  copiesRequested?: number;
}

export interface PaginatedMessages {
  messages: ChatMessage[];
  lastVisible: DocumentSnapshot<any> | null;
  hasMore: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private firestore = inject(Firestore);
  private unreadCountSubject = new BehaviorSubject<number>(0);
  unreadCount$ = this.unreadCountSubject.asObservable();
  private readonly PAGE_SIZE = 6;

  /**
   * ==================== REQUEST QUERIES ====================
   * These use real-time listeners for efficient data syncing
   */

  listenToVoterRequests(email: string): Observable<ChatRequest[]> {
    const requestsRef = collection(this.firestore, 'requests');
    const requestsQuery = query(
      requestsRef,
      where('email', '==', email),
      orderBy('submittedAt', 'desc')
    );
    return collectionData(requestsQuery, { idField: 'id' }).pipe(
      map((data: any[]) => data as ChatRequest[]),
      shareReplay(1)
    );
  }

  listenToAllRequests(): Observable<ChatRequest[]> {
    const requestsRef = collection(this.firestore, 'requests');
    const requestsQuery = query(requestsRef, orderBy('submittedAt', 'desc'));
    return collectionData(requestsQuery, { idField: 'id' }).pipe(
      map((data: any[]) => data as ChatRequest[]),
      shareReplay(1)
    );
  }

  listenToRequest(requestId: string): Observable<ChatRequest | undefined> {
    const requestRef = doc(this.firestore, 'requests', requestId);
    return docData(requestRef, { idField: 'id' }).pipe(
      map((data: any) => data as ChatRequest | undefined),
      shareReplay(1)
    );
  }

  /**
   * ==================== MESSAGE PAGINATION ====================
   * Implements cursor-based pagination with only initial 6 messages
   */

  /**
   * Load the latest 6 messages for initial display.
   * Uses getDocs inside async function context (proper injection context)
   */
  async loadLatestMessages(
    requestId: string,
    pageSize: number = this.PAGE_SIZE
  ): Promise<PaginatedMessages> {
    try {
      const messagesRef = collection(this.firestore, 'chats', requestId, 'messages');
      const messagesQuery = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        limit(pageSize)
      );

      const snapshot = await getDocs(messagesQuery);
      const messages: ChatMessage[] = [];

      snapshot.forEach((doc) => {
        messages.push({ ...doc.data() as ChatMessage, id: doc.id });
      });

      // Reverse to show in ascending order (oldest to newest)
      messages.reverse();

      return {
        messages,
        lastVisible: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
        hasMore: snapshot.docs.length === pageSize
      };
    } catch (error) {
      console.error('Error loading latest messages:', error);
      throw error;
    }
  }

  /**
   * Load older messages before the given cursor document.
   * Uses getDocs inside async function context (proper injection context)
   */
  async loadMoreMessages(
    requestId: string,
    cursorDoc: DocumentSnapshot<any>,
    pageSize: number = this.PAGE_SIZE
  ): Promise<PaginatedMessages> {
    try {
      const messagesRef = collection(this.firestore, 'chats', requestId, 'messages');
      const messagesQuery = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        startAfter(cursorDoc),
        limit(pageSize)
      );

      const snapshot = await getDocs(messagesQuery);
      const messages: ChatMessage[] = [];

      snapshot.forEach((doc) => {
        messages.push({ ...doc.data() as ChatMessage, id: doc.id });
      });

      messages.reverse();

      return {
        messages,
        lastVisible: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
        hasMore: snapshot.docs.length === pageSize
      };
    } catch (error) {
      console.error('Error loading more messages:', error);
      throw error;
    }
  }

  /**
   * Set up a real-time listener ONLY for the latest messages.
   * Uses onSnapshot which works properly within Angular injection context.
   * Returns Unsubscribe function for cleanup.
   */
  listenToLatestMessagesRealtime(
    requestId: string,
    onUpdate: (messages: ChatMessage[]) => void,
    onError: (error: any) => void,
    pageSize: number = this.PAGE_SIZE
  ): Unsubscribe {
    const messagesRef = collection(this.firestore, 'chats', requestId, 'messages');
    const messagesQuery = query(
      messagesRef,
      orderBy('timestamp', 'desc'),
      limit(pageSize)
    );

    return onSnapshot(
      messagesQuery,
      (snapshot) => {
        const messages: ChatMessage[] = [];
        snapshot.forEach((doc) => {
          messages.push({ ...doc.data() as ChatMessage, id: doc.id });
        });
        messages.reverse();
        onUpdate(messages);
      },
      (error) => {
        console.error('Error in real-time listener:', error);
        onError(error);
      }
    );
  }

  /**
   * Observable wrapper around real-time listener with shareReplay
   * Prevents multiple subscriptions from creating duplicate listeners
   */
  listenToMessages(requestId: string): Observable<ChatMessage[]> {
    return new Observable<ChatMessage[]>((observer) => {
      const unsubscribe = this.listenToLatestMessagesRealtime(
        requestId,
        (messages) => observer.next(messages),
        (error) => observer.error(error),
        this.PAGE_SIZE
      );
      return () => unsubscribe();
    }).pipe(shareReplay(1));
  }

  /**
   * ==================== MESSAGE SENDING ====================
   */

  async sendMessage(
    requestId: string,
    sender: ChatSender,
    senderId: string,
    message: string
  ): Promise<void> {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    try {
      const messagesRef = collection(this.firestore, 'chats', requestId, 'messages');
      await addDoc(messagesRef, {
        sender,
        senderId,
        message: trimmed,
        timestamp: serverTimestamp(),
        readByVoter: sender === 'voter',
        readByStaff: sender === 'staff'
      });
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * ==================== READ STATUS ====================
   * Uses real-time listener instead of getDocs in callbacks
   */

  async markMessagesAsRead(requestId: string, userType: 'voter' | 'staff'): Promise<void> {
    try {
      const messagesRef = collection(this.firestore, 'chats', requestId, 'messages');
      const readField = userType === 'voter' ? 'readByVoter' : 'readByStaff';
      const senderType = userType === 'voter' ? 'staff' : 'voter';

      const unreadQuery = query(
        messagesRef,
        where('sender', '==', senderType),
        where(readField, '==', false)
      );
      const unreadDocs = await getDocs(unreadQuery);

      if (unreadDocs.empty) {
        return;
      }

      const batch = writeBatch(this.firestore);
      unreadDocs.forEach((doc) => {
        batch.update(doc.ref, { [readField]: true });
      });

      await batch.commit();
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  /**
   * ==================== UNREAD COUNT ====================
   * Completely rewritten to use real-time listeners instead of getDocs in callbacks
   * Uses map operator to combine request and message listeners
   */

  listenToUnreadCount(email: string, userType: 'voter' | 'staff'): Observable<number> {
    const readField = userType === 'voter' ? 'readByVoter' : 'readByStaff';
    const senderType = userType === 'voter' ? 'staff' : 'voter';

    const requestsRef = collection(this.firestore, 'requests');
    let requestsQuery;

    if (userType === 'voter') {
      requestsQuery = query(requestsRef, where('email', '==', email));
    } else {
      requestsQuery = query(requestsRef);
    }

    // Listen to requests and transform to unread counts
    return collectionData(requestsQuery, { idField: 'id' }).pipe(
      switchMap((requests: any[]) => {
        if (requests.length === 0) {
          return new Observable<number>((observer) => {
            observer.next(0);
            this.unreadCountSubject.next(0);
            observer.complete();
          });
        }

        // Create an observable for each request's unread count
        const unreadObservables = requests.map((request) => {
          const messagesRef = collection(this.firestore, 'chats', request.id, 'messages');
          const messagesQuery = query(
            messagesRef,
            where('sender', '==', senderType),
            where(readField, '==', false)
          );

          return collectionData(messagesQuery, { idField: 'id' }).pipe(
            map((messages) => messages.length),
            startWith(0)
          );
        });

        // Combine all unread observables and sum them
        if (unreadObservables.length === 0) {
          return new Observable<number>((observer) => {
            observer.next(0);
            observer.complete();
          });
        }

        return new Observable<number>((observer) => {
          const subscriptions: Subscription[] = [];
          const counts = new Array(unreadObservables.length).fill(0);

          unreadObservables.forEach((unreadObs, index) => {
            subscriptions.push(
              unreadObs.subscribe({
                next: (count) => {
                  counts[index] = count;
                  const total = counts.reduce((sum, c) => sum + c, 0);
                  observer.next(total);
                  this.unreadCountSubject.next(total);
                },
                error: (err) => {
                  console.error('Error in unread count listener:', err);
                  observer.error(err);
                }
              })
            );
          });

          return () => {
            subscriptions.forEach((sub) => sub.unsubscribe());
          };
        });
      }),
      shareReplay(1)
    );
  }

  /**
   * One-time refresh of unread count using async/await
   * Only call when needed (e.g., after marking as read)
   */
  async refreshUnreadCount(email: string, userType: 'voter' | 'staff'): Promise<void> {
    try {
      const readField = userType === 'voter' ? 'readByVoter' : 'readByStaff';
      const senderType = userType === 'voter' ? 'staff' : 'voter';

      const requestsRef = collection(this.firestore, 'requests');
      let requestsQuery;

      if (userType === 'voter') {
        requestsQuery = query(requestsRef, where('email', '==', email));
      } else {
        requestsQuery = query(requestsRef);
      }

      const requestDocs = await getDocs(requestsQuery);
      let totalUnread = 0;

      for (const reqDoc of requestDocs.docs) {
        const messagesRef = collection(this.firestore, 'chats', reqDoc.id, 'messages');
        const msgQuery = query(
          messagesRef,
          where('sender', '==', senderType),
          where(readField, '==', false)
        );
        const messageDocs = await getDocs(msgQuery);
        totalUnread += messageDocs.size;
      }

      this.unreadCountSubject.next(totalUnread);
    } catch (error) {
      console.error('Error refreshing unread count:', error);
    }
  }
}
