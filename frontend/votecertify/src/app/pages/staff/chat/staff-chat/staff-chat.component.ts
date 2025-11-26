import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { Subscription } from 'rxjs';
import { ChatMessage, ChatRequest, ChatService } from '../../../../services/chat.service';

@Component({
  selector: 'app-staff-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './staff-chat.component.html',
  styleUrls: ['./staff-chat.component.scss']
})
export class StaffChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer?: ElementRef<HTMLDivElement>;

  requests: ChatRequest[] = [];
  messages: ChatMessage[] = [];
  activeRequests: ChatRequest[] = [];
  archivedRequests: ChatRequest[] = [];
  filteredActiveRequests: ChatRequest[] = [];
  filteredArchivedRequests: ChatRequest[] = [];
  searchTerm = '';
  selectedRequest?: ChatRequest;
  messageText = '';
  isSending = false;
  isLoadingRequests = true;
  isLoadingMessages = false;
  errorMessage = '';
  showArchived = false;
  private user: User | null = null;
  private messagesSub?: Subscription;
  private requestsSub?: Subscription;
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
        this.errorMessage = 'Sign in as staff to view chats.';
        this.requests = [];
        return;
      }

      this.user = user;
      this.loadRequests();
    });

    this.route.paramMap.subscribe((params) => {
      const requestId = params.get('requestId');
      if (requestId) {
        this.trySelectRequest(requestId);
      }
    });
  }

  ngOnDestroy(): void {
    this.messagesSub?.unsubscribe();
    this.requestsSub?.unsubscribe();
  }

  private loadRequests(): void {
    this.requestsSub = this.chatService.listenToAllRequests().subscribe({
      next: (requests) => {
        this.requests = requests.filter((request) => !this.isExcluded(request));
        this.partitionRequests();
        this.applyFilter();
        this.isLoadingRequests = false;

        const routeRequestId = this.route.snapshot.paramMap.get('requestId');
        if (routeRequestId) {
          this.trySelectRequest(routeRequestId, false);
        } else {
          this.selectFirstAvailable(false);
        }
      },
      error: (error) => {
        console.error('Error loading requests', error);
        this.errorMessage = 'Could not load requests.';
        this.isLoadingRequests = false;
      }
    });
  }

  applyFilter(): void {
    const term = this.searchTerm.toLowerCase();
    const filterFn = (request: ChatRequest) => {
      const name = (request.fullName || '').toLowerCase();
      const voterId = (request.voterId || '').toLowerCase();
      return name.includes(term) || voterId.includes(term);
    };

    this.filteredActiveRequests = this.activeRequests.filter(filterFn);
    this.filteredArchivedRequests = this.archivedRequests.filter(filterFn);

    if (this.selectedRequest) {
      const stillVisible =
        this.filteredActiveRequests.some((req) => req.id === this.selectedRequest?.id) ||
        this.filteredArchivedRequests.some((req) => req.id === this.selectedRequest?.id);
      if (!stillVisible) {
        this.selectFirstAvailable();
      }
    }
  }

  selectRequest(request: ChatRequest): void {
    this.trySelectRequest(request.id);
    this.router.navigate(['/staff/chat', request.id]);
  }

  private trySelectRequest(requestId: string, navigate: boolean = true): void {
    const request = this.findRequestById(requestId);
    if (!request) {
      if (!this.isLoadingRequests) {
        this.errorMessage = 'Request not found.';
      }
      return;
    }

    this.errorMessage = '';
    this.selectedRequest = request;
    if (navigate) {
      this.router.navigate(['/staff/chat', requestId]);
    }

    this.listenToMessages(requestId);
  }

  private listenToMessages(requestId: string): void {
    this.messagesSub?.unsubscribe();
    this.isLoadingMessages = true;

    this.messagesSub = this.chatService.listenToMessages(requestId).subscribe({
      next: (messages) => {
        this.messages = messages;
        this.isLoadingMessages = false;
        setTimeout(() => this.scrollToBottom(), 75);
      },
      error: (error) => {
        console.error('Error loading messages', error);
        this.errorMessage = 'Cannot load chat messages.';
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
      await this.chatService.sendMessage(this.selectedRequest.id, 'staff', this.user.uid, trimmed);
      this.messageText = '';
      setTimeout(() => this.scrollToBottom(), 50);
    } catch (error) {
      console.error('Error sending message', error);
      this.errorMessage = 'Failed to send message.';
    } finally {
      this.isSending = false;
    }
  }

  private scrollToBottom(): void {
    if (!this.messagesContainer) {
      return;
    }

    const el = this.messagesContainer.nativeElement;
    el.scrollTop = el.scrollHeight;
  }

  isUnread(requestId: string): boolean {
    return false;
  }

  toggleArchived(): void {
    this.showArchived = !this.showArchived;
  }

  private partitionRequests(): void {
    this.activeRequests = this.requests.filter((request) => !this.isArchived(request));
    this.archivedRequests = this.requests.filter((request) => this.isArchived(request));
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

  private selectFirstAvailable(navigate: boolean = true): void {
    const next = this.filteredActiveRequests[0] || this.filteredArchivedRequests[0];
    if (next) {
      this.trySelectRequest(next.id, navigate);
    } else {
      this.selectedRequest = undefined;
      this.messages = [];
    }
  }

}

