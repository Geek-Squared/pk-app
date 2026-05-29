import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { AngularFirestore } from '@angular/fire/compat/firestore';

export type AiChatAuthor = 'user' | 'assistant';

export interface AiChatMessage {
  role: AiChatAuthor;
  content: string;
  createdAt: number;
  crisis?: boolean;
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

        return {
          role: 'assistant' as const,
          content: assistantMessage,
          createdAt: Date.now(),
          crisis: response?.crisis === true,
        };
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
