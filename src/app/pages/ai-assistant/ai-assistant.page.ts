import { Component, OnDestroy, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { IonContent, IonTextarea } from '@ionic/angular';
import { Subscription } from 'rxjs';
import {
  AiChatMessage,
  AiChatService,
} from 'src/app/services/ai-chat.service';

@Component({
  selector: 'app-ai-assistant',
  templateUrl: './ai-assistant.page.html',
  styleUrls: ['./ai-assistant.page.scss'],
  standalone: false,
})
export class AiAssistantPage implements OnDestroy {
  @ViewChild(IonContent) content?: IonContent;
  @ViewChild('composer') composer?: IonTextarea;

  messages: AiChatMessage[] = [
    {
      role: 'assistant',
      content:
        "Hi, I'm your Positive Konnections wellbeing assistant. Ask me anything about coping strategies, support resources, or navigating daily life - we will work through it together.",
      createdAt: Date.now(),
    },
  ];

  readonly suggestions: string[] = [
    'I need help managing my medication routine.',
    'How can I deal with days when my mood is really low?',
    'Suggest a simple self-care activity I can try today.',
  ];

  pending = false;
  errorMessage?: string;

  readonly form = this.fb.group({
    prompt: ['', [Validators.required]],
  });

  private readonly systemPrompt: AiChatMessage = {
    role: 'system',
    content:
      'You are Positive Konnections, an empathetic peer support assistant that helps users living with or affected by HIV. Offer practical mental health tips, coping skills, and resource suggestions in short, encouraging messages. Keep answers under 8 sentences, avoid medical or legal advice, and remind users to reach out to their care provider for urgent issues.',
    createdAt: Date.now(),
  };

  private activeRequest?: Subscription;

  constructor(
    private readonly fb: FormBuilder,
    private readonly aiChatService: AiChatService
  ) {}

  ngOnDestroy(): void {
    this.activeRequest?.unsubscribe();
  }

  useSuggestion(prompt: string): void {
    if (this.pending) {
      return;
    }
    this.form.patchValue({ prompt });
    this.focusComposer();
  }

  sendMessage(): void {
    if (this.pending) {
      return;
    }

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
    this.form.reset();
    this.errorMessage = undefined;
    this.pending = true;

    this.scrollToBottom();

    const conversation: AiChatMessage[] = [
      this.systemPrompt,
      ...this.messages,
    ];

    this.activeRequest?.unsubscribe();
    this.activeRequest = this.aiChatService.sendMessage(conversation).subscribe({
      next: (assistantMessage) => {
        this.messages = [...this.messages, assistantMessage];
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

  private focusComposer(): void {
    this.composer?.setFocus();
  }
}
