import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

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
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';

  constructor(private http: HttpClient) {}

  sendMessage(history: AiChatMessage[]): Observable<AiChatMessage> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.openaiApiKey}`,
    });

    const body = {
      model: 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 600,
      messages: history.map(({ role, content }) => ({ role, content })),
    };

    return this.http.post<any>(this.apiUrl, body, { headers }).pipe(
      map((response) => {
        const assistantMessage =
          response?.choices?.[0]?.message?.content?.trim() ??
          "I'm having trouble responding right now.";

        return {
          role: 'assistant' as const,
          content: assistantMessage,
          createdAt: Date.now(),
        };
      }),
      catchError((error) => {
        console.error('Failed to reach OpenAI chat endpoint', error);
        return throwError(
          () =>
            new Error(
              'We could not reach the assistant. Please try again in a moment.'
            )
        );
      })
    );
  }
}

