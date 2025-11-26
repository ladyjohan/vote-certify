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
  serverTimestamp
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export type ChatSender = 'voter' | 'staff';

export interface ChatMessage {
  id?: string;
  sender: ChatSender;
  senderId: string;
  message: string;
  timestamp?: any;
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
      timestamp: serverTimestamp()
    });
  }
}

