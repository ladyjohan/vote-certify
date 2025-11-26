import { Component, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { Subscription, Subject, takeUntil } from 'rxjs';
import { ChatMessage, ChatRequest, ChatService } from '../../../../services/chat.service';

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
  errorMessage = '';
  showArchived = false;

  private user: User | null = null;
  private destroy$ = new Subject<void>();
  private messagesSub?: Subscription;
  private readonly archivedStatuses = new Set(['approved', 'completed']);
  private readonly excludedStatuses = new Set(['declined', 'rejected']);

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
    this.trySelectRequest(request.id);
    this.router.navigate(['/voter/chat', request.id]);
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
    this.messagesSub?.unsubscribe();

    this.messagesSub = this.chatService.listenToMessages(requestId).subscribe({
      next: (messages) => {
        this.messages = messages;
        this.isLoadingMessages = false;
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error: (err) => {
        console.error('Error loading messages', err);
        this.errorMessage = 'Unable to load chat messages.';
        this.isLoadingMessages = false;
      }
    });
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
    return status === 'completed';
  }

  private async markMessagesAsRead(requestId: string): Promise<void> {
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
  }
}

