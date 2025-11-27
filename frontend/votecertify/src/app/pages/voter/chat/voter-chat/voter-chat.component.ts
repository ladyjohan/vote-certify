import { Component, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { Subscription, Subject, takeUntil } from 'rxjs';
import { ChatMessage, ChatRequest, ChatService, PaginatedMessages } from '../../../../services/chat.service';
import { DocumentSnapshot, Unsubscribe } from '@angular/fire/firestore';

@Component({
  selector: 'app-voter-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './voter-chat.component.html',
  styleUrls: ['./voter-chat.component.scss']
})
export class VoterChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer?: ElementRef<HTMLDivElement>;

  requests: ChatRequest[] = [];
  activeRequests: ChatRequest[] = [];
  archivedRequests: ChatRequest[] = [];
  messages: ChatMessage[] = [];
  selectedRequest?: ChatRequest;
  messageText = '';
  isSending = false;
  isLoadingRequests = true;
  isLoadingMessages = false;
  isLoadingMore = false;
  errorMessage = '';
  showArchived = false;
  hasMoreMessages = false;
  isViewingOlderMessages = false;  // Track if user is viewing older messages

  private user: User | null = null;
  private destroy$ = new Subject<void>();
  private messagesSub?: Subscription;
  private messagesUnsubscribe?: Unsubscribe;
  private readonly archivedStatuses = new Set(['approved', 'completed']);
  private readonly excludedStatuses = new Set(['declined', 'rejected']);

  // Pagination variables
  private lastVisibleDoc: DocumentSnapshot<any> | null = null;
  private readonly PAGE_SIZE = 5;  // Show 5 current messages, load older with "Load More"

  constructor(
    private auth: Auth,
    private chatService: ChatService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    onAuthStateChanged(this.auth, (user) => {
      if (!user) {
        this.errorMessage = 'Please sign in to access chat.';
        this.requests = [];
        return;
      }

      this.user = user;
      this.loadRequests(user.email || '');
    });

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const requestId = params.get('requestId');
      if (requestId) {
        this.trySelectRequest(requestId);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.messagesSub?.unsubscribe();
    // IMPORTANT: Unsubscribe from Firestore real-time listener to prevent memory leaks
    if (this.messagesUnsubscribe) {
      this.messagesUnsubscribe();
    }
  }

  private loadRequests(email: string): void {
    if (!email) {
      this.errorMessage = 'Missing email on user account.';
      this.isLoadingRequests = false;
      return;
    }

    this.chatService
      .listenToVoterRequests(email)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (requests) => {
          const visibleRequests = requests.filter((request) => !this.isExcluded(request));
          this.partitionRequests(visibleRequests);
          this.requests = [...this.activeRequests, ...this.archivedRequests];
          this.isLoadingRequests = false;

          // If a route param exists, ensure selection stays in sync.
          const routeRequestId = this.route.snapshot.paramMap.get('requestId');
          if (routeRequestId) {
            this.trySelectRequest(routeRequestId, false);
          } else {
            this.selectFirstRequest(false);
          }
        },
        error: (err) => {
          console.error('Error loading voter requests', err);
          this.errorMessage = 'Unable to load your requests.';
          this.isLoadingRequests = false;
        }
      });
  }

  selectRequest(request: ChatRequest): void {
    this.trySelectRequest(request.id, false);
  }

  private trySelectRequest(requestId: string, navigate: boolean = true): void {
    const request = this.findRequestById(requestId);

    if (!request) {
      if (!this.isLoadingRequests) {
        this.errorMessage = 'Request not found or inaccessible.';
      }
      return;
    }

    this.errorMessage = '';
    this.selectedRequest = request;
    if (navigate) {
      this.router.navigate(['/voter/chat', requestId]);
    }

    this.listenToMessages(requestId);
    this.markMessagesAsRead(requestId);
    this.refreshUnreadBadge();
  }

  private refreshUnreadBadge(): void {
    if (this.user?.email) {
      this.chatService.refreshUnreadCount(this.user.email, 'voter').catch((error) => {
        console.error('Error refreshing unread count:', error);
      });
    }
  }

  private selectFirstRequest(navigate: boolean = true): void {
    const next = this.activeRequests[0] || this.archivedRequests[0];
    if (!next) {
      this.selectedRequest = undefined;
      this.messages = [];
      return;
    }

    this.trySelectRequest(next.id, navigate);
  }

  private listenToMessages(requestId: string): void {
    this.isLoadingMessages = true;
    this.lastVisibleDoc = null;
    this.hasMoreMessages = false;
    this.messages = [];

    // Unsubscribe from previous listener before setting up new one
    if (this.messagesUnsubscribe) {
      this.messagesUnsubscribe();
    }

    // Step 1: Load only the latest 6 messages (initial load)
    this.chatService
      .loadLatestMessages(requestId, this.PAGE_SIZE)
      .then((result: PaginatedMessages) => {
        this.messages = result.messages;
        this.lastVisibleDoc = result.lastVisible;
        this.hasMoreMessages = result.hasMore;
        console.log('Initial load - Messages:', result.messages.length, 'HasMore:', result.hasMore);
        this.isLoadingMessages = false;
        setTimeout(() => this.scrollToBottom(), 100);

        // Step 2: Set up real-time listener ONLY for latest messages
        this.setupRealtimeListener(requestId);
      })
      .catch((err) => {
        console.error('Error loading messages', err);
        this.errorMessage = 'Unable to load chat messages.';
        this.isLoadingMessages = false;
      });
  }

  /**
   * Set up a real-time listener that only observes the latest 5 messages (current conversation).
   * When a new message is sent, it updates automatically.
   * When "Load More" is clicked, older messages are loaded separately.
   * IMPORTANT: Do NOT interfere with pagination state when older messages are loaded.
   */
  private setupRealtimeListener(requestId: string): void {
    this.messagesUnsubscribe = this.chatService.listenToLatestMessagesRealtime(
      requestId,
      (latestMessages) => {
        // If we're still viewing only the latest messages (haven't loaded older ones)
        if (!this.isViewingOlderMessages) {
          // Update the list with latest messages
          this.messages = latestMessages;
          // Check if there are more messages beyond what we loaded
          this.hasMoreMessages = latestMessages.length >= this.PAGE_SIZE;
          console.log('🔄 Real-time update (latest messages only):', this.messages.length, 'hasMoreMessages:', this.hasMoreMessages);
        } else {
          // When viewing older messages, don't update the display at all
          // User needs to click "Jump to Latest" to see the newest messages
          console.log('🔄 Real-time update received but user is viewing older messages - suppressed');
        }
        setTimeout(() => this.scrollToBottom(), 50);
      },
      (error) => {
        console.error('Error in real-time listener', error);
      },
      this.PAGE_SIZE
    );
  }

  /**
   * Load older messages using cursor-based pagination.
   * Shows only 5 past messages at a time (replaced, not appended).
   */
  async loadMoreMessages(): Promise<void> {
    if (!this.selectedRequest?.id) {
      console.warn('No selected request');
      return;
    }

    if (!this.lastVisibleDoc) {
      console.warn('No cursor document available for pagination');
      return;
    }

    if (this.isLoadingMore) {
      console.warn('Already loading more messages');
      return;
    }

    this.isLoadingMore = true;
    try {
      console.log('🔄 Loading more messages with cursor:', this.lastVisibleDoc.id);
      const result = await this.chatService.loadMoreMessages(
        this.selectedRequest.id,
        this.lastVisibleDoc,
        this.PAGE_SIZE
      );

      console.log('✅ Loaded messages:', result.messages.length, 'Has more:', result.hasMore);

      // Replace messages with only the loaded older messages (don't prepend to current)
      if (result.messages.length > 0) {
        this.messages = result.messages;  // Show only these 5 past messages
        this.lastVisibleDoc = result.lastVisible;
        this.hasMoreMessages = result.hasMore;
        this.isViewingOlderMessages = true;  // Mark that we're viewing older messages
        console.log('📊 Updated pagination state - cursor:', this.lastVisibleDoc?.id, 'hasMoreMessages:', this.hasMoreMessages);

        // Scroll to top to show the loaded older messages
        setTimeout(() => {
          if (this.messagesContainer) {
            const nativeEl = this.messagesContainer.nativeElement;
            nativeEl.scrollTop = 0;
          }
        }, 50);
      } else {
        console.log('❌ No more messages to load');
        this.hasMoreMessages = false;
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
      this.errorMessage = 'Failed to load older messages.';
    } finally {
      this.isLoadingMore = false;
    }
  }

  /**
   * Jump back to the latest messages when viewing older conversations.
   */
  async jumpToLatest(): Promise<void> {
    if (!this.selectedRequest?.id) {
      return;
    }

    try {
      console.log('📌 Jumping to latest messages...');
      const result = await this.chatService.loadLatestMessages(this.selectedRequest.id, this.PAGE_SIZE);
      this.messages = result.messages;
      this.lastVisibleDoc = result.lastVisible;
      this.hasMoreMessages = result.hasMore;
      this.isViewingOlderMessages = false;
      console.log('✅ Jumped to latest - Messages:', result.messages.length);
      setTimeout(() => this.scrollToBottom(), 100);
    } catch (error) {
      console.error('Error jumping to latest messages:', error);
      this.errorMessage = 'Failed to jump to latest messages.';
    }
  }

  async sendMessage(): Promise<void> {
    if (!this.selectedRequest?.id || !this.user || this.isSending) {
      return;
    }

    const trimmed = this.messageText.trim();
    if (!trimmed) {
      return;
    }

    this.isSending = true;
    try {
      await this.chatService.sendMessage(this.selectedRequest.id, 'voter', this.user.uid, trimmed);
      this.messageText = '';
      setTimeout(() => this.scrollToBottom(), 50);
    } catch (error) {
      console.error('Error sending message', error);
      this.errorMessage = 'Failed to send message.';
    } finally {
      this.isSending = false;
    }
  }

  getSenderLabel(message: ChatMessage): string {
    return message.sender === 'voter' ? 'You' : 'Staff';
  }

  isChatEnded(): boolean {
    if (!this.selectedRequest) {
      return false;
    }
    const status = (this.selectedRequest.status || '').toLowerCase();
    return status === 'completed' || status === 'approved';
  }

  handleEnterKey(event: any): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  async markMessagesAsRead(requestId: string): Promise<void> {
    try {
      await this.chatService.markMessagesAsRead(requestId, 'voter');
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  private scrollToBottom(): void {
    if (!this.messagesContainer) {
      return;
    }

    try {
      const nativeEl = this.messagesContainer.nativeElement;
      nativeEl.scrollTop = nativeEl.scrollHeight;
    } catch (error) {
      console.warn('Scroll failed', error);
    }
  }

  private partitionRequests(requests: ChatRequest[]): void {
    this.activeRequests = requests.filter((request) => !this.isArchived(request));
    this.archivedRequests = requests.filter((request) => this.isArchived(request));
  }

  private isArchived(request: ChatRequest): boolean {
    const status = (request.status || '').toLowerCase();
    return this.archivedStatuses.has(status);
  }

  private isExcluded(request: ChatRequest): boolean {
    const status = (request.status || '').toLowerCase();
    return this.excludedStatuses.has(status);
  }

  private findRequestById(requestId: string): ChatRequest | undefined {
    return (
      this.activeRequests.find((req) => req.id === requestId) ||
      this.archivedRequests.find((req) => req.id === requestId)
    );
  }

  toggleArchived(): void {
    this.showArchived = !this.showArchived;

    // When toggling, check if current selection is still valid for the current view
    if (this.selectedRequest) {
      const isSelectedArchived = this.isArchived(this.selectedRequest);

      // If showing archived but selected is active (or vice versa), clear it
      if ((this.showArchived && !isSelectedArchived) || (!this.showArchived && isSelectedArchived)) {
        this.selectedRequest = undefined;
        this.messages = [];
        if (this.messagesUnsubscribe) {
          this.messagesUnsubscribe();
        }
      }
      // Otherwise, keep the selection - it's valid for the current view
    }
  }
}

