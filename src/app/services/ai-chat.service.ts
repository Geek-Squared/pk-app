import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { AngularFirestore } from '@angular/fire/compat/firestore';

export type AiChatAuthor = 'user' | 'assistant';

export interface AiChatSource {
  // Present when we can deep-link to the exact workbook story.
  postId?: string;
  chapterId?: string;
  postTitle?: string;
  // Fallback target — also present on messages saved before story links existed.
  interventionId?: string;
  interventionName?: string;
}

export interface AiChatMessage {
  role: AiChatAuthor;
  content: string;
  createdAt: number;
  crisis?: boolean;
  sources?: AiChatSource[];
}

@Injectable({
  providedIn: 'root',
})
export class AiChatService {
  constructor(
    private fns: AngularFireFunctions,
    private firestore: AngularFirestore,
    private injector: Injector
  ) {}

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

        const sources: AiChatSource[] = Array.isArray(response?.sources)
          ? response.sources
              .filter(
                (s: any) => (s?.postId && s?.chapterId) || s?.interventionId
              )
              .map((s: any) => {
                // Firestore rejects undefined fields, so only set what we have.
                const source: AiChatSource = {};
                if (s.postId && s.chapterId) {
                  source.postId = s.postId;
                  source.chapterId = s.chapterId;
                  if (s.postTitle) source.postTitle = s.postTitle;
                }
                if (s.interventionId) {
                  source.interventionId = s.interventionId;
                  source.interventionName = s.interventionName || 'Intervention';
                }
                return source;
              })
          : [];

        const message: AiChatMessage = {
          role: 'assistant' as const,
          content: assistantMessage,
          createdAt: Date.now(),
          crisis: response?.crisis === true,
        };
        // Only attach when present — Firestore rejects undefined fields.
        if (sources.length) {
          message.sources = sources;
        }
        return message;
      })
    );
  }

  loadHistory(uid: string): Promise<AiChatMessage[]> {
    return runInInjectionContext(this.injector, () =>
      this.firestore
        .collection<AiChatMessage>(`users/${uid}/peekayChats`, ref =>
          ref.orderBy('createdAt', 'asc')
        )
        .get()
        .toPromise()
        .then(snap => snap?.docs.map(d => d.data()) ?? [])
    );
  }

  saveMessage(uid: string, message: AiChatMessage): void {
    runInInjectionContext(this.injector, () => {
      this.firestore
        .collection<AiChatMessage>(`users/${uid}/peekayChats`)
        .add(message)
        .catch(err => console.error('Failed to save Peekay message:', err));
    });
  }


}
