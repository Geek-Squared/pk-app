import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { IonContent, IonTextarea } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AiChatMessage, AiChatService } from 'src/app/services/ai-chat.service';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { UtilitiesService } from 'src/app/services/utilities.service';

@Component({
  selector: 'app-ai-assistant',
  templateUrl: './ai-assistant.page.html',
  styleUrls: ['./ai-assistant.page.scss'],
  standalone: false,
})
export class AiAssistantPage implements OnInit, OnDestroy {
  @ViewChild(IonContent) content?: IonContent;
  @ViewChild('composer') composer?: IonTextarea;

  messages: AiChatMessage[] = [];

  readonly suggestions: string[] = [
    'Help me manage stress',
    'I feel anxious today',
    'Guide me through grounding',
  ];

  readonly supportActions: Array<{
    icon: string;
    title: string;
    description: string;
    type: 'prompt' | 'route';
    value: string;
  }> = [
    {
      icon: 'book-outline',
      title: 'Workbook Guidance',
      description: 'Jump back into your latest chapter reflections.',
      type: 'route',
      value: '/my-work-book/chapters',
    },
    {
      icon: 'sparkles-outline',
      title: 'Chapter 10 Boost',
      description: 'Turn a difficult feeling into a hero strength.',
      type: 'prompt',
      value: 'Help me turn a difficult feeling into a strength for my Chapter 10 superhero.',
    },
    {
      icon: 'leaf-outline',
      title: 'Calming Pause',
      description: 'Receive a breathing or grounding practice.',
      type: 'prompt',
      value: 'Please guide me through a calming grounding practice.',
    },
    {
      icon: 'heart-outline',
      title: 'Vent Space',
      description: "Share what's heavy — Peekay listens without judgment.",
      type: 'prompt',
      value: 'I need a safe space to vent about how I am feeling right now.',
    },
  ];

  pending = false;
  errorMessage?: string;

  readonly form = this.fb.group({
    prompt: ['', [Validators.required]],
  });

  private activeRequest?: Subscription;

  connectingToCounsellor = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly aiChatService: AiChatService,
    private readonly router: Router,
    public readonly authService: AuthenticationService,
    private readonly fns: AngularFireFunctions,
    private readonly utilitiesService: UtilitiesService,
    private readonly location: Location
  ) {}

  goBack(): void {
    this.location.back();
  }

  get userId(): string {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.uid || '';
  }

  get userName(): string {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.displayName?.split(' ')[0] || 'Hero';
  }

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  async ngOnInit(): Promise<void> {
    if (!this.userId) return;
    try {
      this.messages = await this.aiChatService.loadHistory(this.userId);
      this.scrollToBottom();
    } catch (err) {
      console.error('Failed to load Peekay history:', err);
    }
  }

  ngOnDestroy(): void {
    this.activeRequest?.unsubscribe();
  }

  handleSupportAction(action: { type: 'prompt' | 'route'; value: string }): void {
    if (action.type === 'route') {
      this.router.navigateByUrl(action.value);
      return;
    }
    this.useSuggestion(action.value);
  }

  useSuggestion(prompt: string): void {
    if (this.pending) return;
    this.form.patchValue({ prompt });
    this.focusComposer();
  }

  sendMessage(): void {
    if (this.pending) return;

    const rawValue = this.form.value.prompt ?? '';
    const trimmedValue = rawValue.trim();
    if (!trimmedValue) {
      this.form.patchValue({ prompt: '' });
      return;
    }

    const userMessage: AiChatMessage = {
      role: 'user',
      content: trimmedValue,
      createdAt: Date.now(),
    };

    this.messages = [...this.messages, userMessage];
    this.aiChatService.saveMessage(this.userId, userMessage);
    this.form.reset();
    this.errorMessage = undefined;
    this.pending = true;

    this.scrollToBottom();

    this.activeRequest?.unsubscribe();
    this.activeRequest = this.aiChatService
      .sendMessage(this.messages)
      .subscribe({
        next: (assistantMessage) => {
          this.messages = [...this.messages, assistantMessage];
          this.aiChatService.saveMessage(this.userId, assistantMessage);
          this.pending = false;
          this.scrollToBottom();
        },
        error: (error) => {
          this.errorMessage =
            error?.message ??
            'Something went wrong. Please try sending your message again.';
          this.pending = false;
        },
      });
  }

  async connectToCounsellor(): Promise<void> {
    if (this.connectingToCounsellor) return;
    this.connectingToCounsellor = true;
    try {
      const result: any = await this.fns.httpsCallable('requestCounsellorChat')({}).toPromise();
      if (result?.available && result?.chatId) {
        this.router.navigate(['/messages/chat', result.chatId]);
      } else {
        this.utilitiesService.presentToast('No counsellor is available right now. Please try again later.');
      }
    } catch {
      this.utilitiesService.presentToast('Unable to connect to a counsellor right now.');
    } finally {
      this.connectingToCounsellor = false;
    }
  }

  handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  get promptControl(): FormControl {
    return this.form.get('prompt') as FormControl;
  }

  get canSend(): boolean {
    const value = this.promptControl?.value ?? '';
    return !this.pending && value.trim().length > 0;
  }

  trackByTimestamp(_: number, message: AiChatMessage): number {
    return message.createdAt;
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() =>
      setTimeout(() => this.content?.scrollToBottom(300), 60)
    );
  }

  focusComposer(): void {
    this.composer?.setFocus();
  }
}
