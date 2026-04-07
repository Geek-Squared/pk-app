import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { AngularFireFunctions } from '@angular/fire/compat/functions';

export type AiChatAuthor = 'system' | 'user' | 'assistant';

export interface AiChatMessage {
  role: AiChatAuthor;
  content: string;
  createdAt: number;
}

@Injectable({
  providedIn: 'root',
})
export class AiChatService {
  constructor(private fns: AngularFireFunctions) {}

  /**
   * Securely sends messages to the 'peekayChat' backend proxy.
   * This removes the API key from the frontend and enforces PII scrubbing + Guardrails.
   */
  sendMessage(history: AiChatMessage[]): Observable<AiChatMessage> {
    const callable = this.fns.httpsCallable('peekayChat');
    const body = {
      messages: history.map(({ role, content }) => ({ role, content })),
    };

    return from(callable(body)).pipe(
      map((response: any) => {
        const assistantMessage =
          response?.choices?.[0]?.message?.content?.trim() ??
          "I'm having trouble responding right now.";

        return {
          role: 'assistant' as const,
          content: assistantMessage,
          createdAt: Date.now(),
        };
      })
    );
  }
}

