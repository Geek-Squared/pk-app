import { Component, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { IonContent, IonTextarea } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AiChatMessage, AiChatService } from 'src/app/services/ai-chat.service';

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
        "Hi, I'm Peekay — your Positive Konnections companion. I can walk you back to workbook chapters, guide a breathing pause, or just listen whenever you need to vent. What would you like support with?",
      createdAt: Date.now(),
    },
  ];

  readonly suggestions: string[] = [
    'Remind me which workbook chapter covers resilience.',
    'Walk me through a two-minute breathing exercise.',
    'Give me a prompt to rewrite my story as a superhero.',
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
      description: 'Ask Peekay to brainstorm powers for your hero.',
      type: 'prompt',
      value: 'Help me design a new power for my Chapter 10 superhero.',
    },
    {
      icon: 'leaf-outline',
      title: 'Calming Pause',
      description: 'Receive a breathing or grounding practice.',
      type: 'prompt',
      value: 'Please guide me through a calming breathing exercise.',
    },
    {
      icon: 'heart-outline',
      title: 'Vent Space',
      description: 'Share what’s heavy — Peekay listens without judgment.',
      type: 'prompt',
      value: 'I need a safe space to vent about how I am feeling right now.',
    },
  ];

  pending = false;
  errorMessage?: string;

  readonly form = this.fb.group({
    prompt: ['', [Validators.required]],
  });

  private readonly systemPrompt: AiChatMessage = {
    role: 'system',
    content:
      'You are Peekay, the Positive Konnections wellbeing guide. Offer compassionate, peer-style support to young people navigating HIV-related journeys. Redirect them to relevant workbook chapters when asked, suggest short calming exercises, and encourage self-empowerment through superhero metaphors. Keep replies under 8 sentences, avoid medical/diagnostic claims, and gently remind users to contact their care provider or emergency services for urgent needs.',
    createdAt: Date.now(),
  };

  private activeRequest?: Subscription;

  constructor(
    private readonly fb: FormBuilder,
    private readonly aiChatService: AiChatService,
    private readonly router: Router
  ) {}

  ngOnDestroy(): void {
    this.activeRequest?.unsubscribe();
  }

  handleSupportAction(action: {
    type: 'prompt' | 'route';
    value: string;
  }): void {
    if (action.type === 'route') {
      this.router.navigateByUrl(action.value);
      return;
    }

    this.useSuggestion(action.value);
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

    const conversation: AiChatMessage[] = [this.systemPrompt, ...this.messages];

    this.activeRequest?.unsubscribe();
    this.activeRequest = this.aiChatService
      .sendMessage(conversation)
      .subscribe({
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
