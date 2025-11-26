import { Injectable } from '@angular/core';
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
  writeBatch
} from '@angular/fire/firestore';
import { Observable, BehaviorSubject, Subscription } from 'rxjs';

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
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private unreadCountSubject = new BehaviorSubject<number>(0);
  unreadCount$ = this.unreadCountSubject.asObservable();
  private currentUserEmail: string = '';

  constructor(private firestore: Firestore) {}

  listenToVoterRequests(email: string): Observable<ChatRequest[]> {
    const requestsRef = collection(this.firestore, 'requests');
    const requestsQuery = query(
      requestsRef,
      where('email', '==', email),
      orderBy('submittedAt', 'desc')
    );
    return collectionData(requestsQuery, { idField: 'id' }) as Observable<ChatRequest[]>;
  }

  listenToAllRequests(): Observable<ChatRequest[]> {
    const requestsRef = collection(this.firestore, 'requests');
    const requestsQuery = query(requestsRef, orderBy('submittedAt', 'desc'));
    return collectionData(requestsQuery, { idField: 'id' }) as Observable<ChatRequest[]>;
  }

  listenToRequest(requestId: string): Observable<ChatRequest | undefined> {
    const requestRef = doc(this.firestore, 'requests', requestId);
    return docData(requestRef, { idField: 'id' }) as Observable<ChatRequest | undefined>;
  }

  listenToMessages(requestId: string): Observable<ChatMessage[]> {
    const messagesRef = collection(this.firestore, 'chats', requestId, 'messages');
    const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
    return collectionData(messagesQuery, { idField: 'id' }) as Observable<ChatMessage[]>;
  }

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

    const messagesRef = collection(this.firestore, 'chats', requestId, 'messages');
    await addDoc(messagesRef, {
      sender,
      senderId,
      message: trimmed,
      timestamp: serverTimestamp(),
      readByVoter: sender === 'voter',
      readByStaff: sender === 'staff'
    });
  }

  async markMessagesAsRead(requestId: string, userType: 'voter' | 'staff'): Promise<void> {
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
  }

  listenToUnreadCount(email: string, userType: 'voter' | 'staff'): Observable<number> {
    const readField = userType === 'voter' ? 'readByVoter' : 'readByStaff';
    const senderType = userType === 'voter' ? 'staff' : 'voter';

    return new Observable((observer) => {
      const subscriptions: Subscription[] = [];
      let requestsList: any[] = [];
      const messageListeners: { [key: string]: Subscription } = {};

      const requestsRef = collection(this.firestore, 'requests');
      let requestsQuery;

      if (userType === 'voter') {
        requestsQuery = query(requestsRef, where('email', '==', email));
      } else {
        requestsQuery = query(requestsRef);
      }

      // Listen to requests - this will trigger whenever requests change (new request added)
      const requestsSub = collectionData(requestsQuery, { idField: 'id' }).subscribe((requests: any[]) => {
        requestsList = requests;
        
        // Clean up old message listeners for requests that no longer exist
        Object.keys(messageListeners).forEach((requestId) => {
          if (!requests.find(r => r.id === requestId)) {
            messageListeners[requestId].unsubscribe();
            delete messageListeners[requestId];
          }
        });

        if (requests.length === 0) {
          observer.next(0);
          this.unreadCountSubject.next(0);
          return;
        }

        // For each request, set up a listener for ALL messages from sender
        requests.forEach((req: any) => {
          // Skip if already listening
          if (messageListeners[req.id]) {
            return;
          }

          const messagesRef = collection(this.firestore, 'chats', req.id, 'messages');
          
          // Listen to ALL messages from sender (not filtered by readField)
          const messagesQuery = query(
            messagesRef,
            where('sender', '==', senderType)
          );

          // Listen to messages for this specific request
          const messageSub = collectionData(messagesQuery, { idField: 'id' }).subscribe((allMessages: any[]) => {
            // Recalculate total unread count across ALL requests
            let totalUnread = 0;

            const countPromises = requestsList.map((request: any) => {
              const msgRef = collection(this.firestore, 'chats', request.id, 'messages');
              const msgQuery = query(
                msgRef,
                where('sender', '==', senderType),
                where(readField, '==', false)
              );
              return getDocs(msgQuery).then((snapshot) => snapshot.size);
            });

            Promise.all(countPromises).then((counts) => {
              totalUnread = counts.reduce((sum, count) => sum + count, 0);
              observer.next(totalUnread);
              this.unreadCountSubject.next(totalUnread);
            });
          });

          messageListeners[req.id] = messageSub;
        });
      });

      subscriptions.push(requestsSub);

      return () => {
        subscriptions.forEach((sub) => sub.unsubscribe());
        Object.values(messageListeners).forEach((sub) => sub.unsubscribe());
      };
    });
  }

  private async getUnreadCount(email: string, userType: 'voter' | 'staff'): Promise<number> {
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
      const readField = userType === 'voter' ? 'readByVoter' : 'readByStaff';
      const senderType = userType === 'voter' ? 'staff' : 'voter';

      const unreadQuery = query(
        messagesRef,
        where('sender', '==', senderType),
        where(readField, '==', false)
      );

      const unreadDocs = await getDocs(unreadQuery);
      totalUnread += unreadDocs.size;
    }

    return totalUnread;
  }

  async refreshUnreadCount(email: string, userType: 'voter' | 'staff'): Promise<void> {
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
  }
}