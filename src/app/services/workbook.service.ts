import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import firebase from 'firebase/compat/app';
import { AuthenticationService } from './authentication.service';
import { map, switchMap } from 'rxjs/operators';
import { combineLatest, Observable, of } from 'rxjs';
import {
  CoinLedgerEntry,
  HeroProfile,
  WorkbookResponseOptions,
} from '../models/workbook.interface';

@Injectable({
  providedIn: 'root',
})
export class WorkbookService {
  constructor(
    private afs: AngularFirestore,
    private auth: AuthenticationService,
    private router: Router,
    private injector: Injector
  ) {}

  get(workbookId) {
    return runInInjectionContext(this.injector, () => {
      return this.afs
        .collection<any>('workbooks')
        .doc(workbookId)
        .snapshotChanges()
        .pipe(
          map((doc: any) => {
            return { id: doc.payload.id, ...doc.payload.data() };
          })
        );
    });
  }

  getUserQuestionResponses() {
    return this.auth.user$.pipe(
      switchMap((user) => {
        return runInInjectionContext(this.injector, () => {
          return this.afs
            .collection('workbooks', (ref) => ref.where('uid', '==', user.uid))
            .snapshotChanges()
            .pipe(
              map((actions) => {
                return actions.map((a) => {
                  const data: Object = a.payload.doc.data();
                  const id = a.payload.doc.id;
                  return data;
                });
              })
            );
        });
      })
    );
  }

  getUserWorkbook() {
    return runInInjectionContext(this.injector, () => {
      return this.afs
        .collection('workbooks', (ref) =>
          ref.where('uid', '==', JSON.parse(localStorage.getItem('user'))?.uid)
        )
        .valueChanges({ idField: 'id' });
    });
  }

  async create() {
    const data = {
      uid: JSON.parse(localStorage.getItem('user'))?.uid,
      createdAt: Date.now(),
      count: 0,
      responses: [],
      coinBalance: 0,
      coinHistory: [],
      heroProfile: {
        heroName: '',
        alias: '',
        auraColor: '#5b21b6',
        originStory: '',
        signaturePower: '',
        secondaryPowers: [],
        unlockedUpgrades: [],
        motto: '',
        updatedAt: Date.now(),
      } as HeroProfile,
    };

    return runInInjectionContext(this.injector, () => {
      return this.afs.collection('workbooks').add(data);
    });
  }

  async saveQuestionResponses(
    workbookId: string,
    content: any,
    postId?: string,
    options: WorkbookResponseOptions = {}
  ) {
    const { uid } = await this.auth.getUser();

    const data = {
      uid,
      content,
      createdAt: Date.now(),
      postId,
      chapterId: options?.chapterId ?? null,
      qualityScore: options?.qualityScore ?? null,
      validationFeedback: options?.validationFeedback ?? '',
      coinsAwarded: options?.coinsAwarded ?? 0,
    };

    if (!uid) {
      return;
    }

    return runInInjectionContext(this.injector, () => {
      const ref = this.afs.collection('workbooks').doc(workbookId);
      const updates: Record<string, any> = {
        responses: firebase.firestore.FieldValue.arrayUnion(data),
        newContent: true,
      };

      if (options?.coinsAwarded && options.coinsAwarded > 0) {
        const ledgerEntry: CoinLedgerEntry = {
          amount: options.coinsAwarded,
          reason: options.coinReason ?? 'Chapter milestone',
          type: 'earn',
          timestamp: Date.now(),
          chapterId: options?.chapterId ?? null,
          postId: postId ?? null,
        };

        updates.coinBalance = firebase.firestore.FieldValue.increment(
          options.coinsAwarded
        );
        updates.coinHistory = firebase.firestore.FieldValue.arrayUnion(
          ledgerEntry
        );
      }

      return ref.update(updates);
    });
  }

  async markVideoCompletion(
    workbookId: string | null,
    postId: string,
    chapterId?: string | null
  ) {
    if (!workbookId || !postId) {
      return;
    }

    const { uid } = await this.auth.getUser();
    if (!uid) {
      return;
    }

    const data = {
      uid,
      content: { videoCompleted: true },
      createdAt: Date.now(),
      postId,
      chapterId: chapterId ?? null,
      qualityScore: 8,
      validationFeedback: 'Video milestone completed',
      coinsAwarded: 0,
    };

    return runInInjectionContext(this.injector, () => {
      const ref = this.afs.collection('workbooks').doc(workbookId);
      return ref.update({
        responses: firebase.firestore.FieldValue.arrayUnion(data),
        newContent: true,
      });
    });
  }

  updateHeroProfile(workbookId: string, heroProfile: HeroProfile) {
    return runInInjectionContext(this.injector, () => {
      return this.afs
        .collection('workbooks')
        .doc(workbookId)
        .update({
          heroProfile: {
            ...heroProfile,
            updatedAt: Date.now(),
          },
        });
    });
  }

  spendCoins(
    workbookId: string,
    amount: number,
    reason: string,
    metadata: Partial<CoinLedgerEntry> = {}
  ) {
    const cost = Math.abs(amount);
    if (!cost) {
      return Promise.resolve();
    }

    return runInInjectionContext(this.injector, () => {
      const ref = this.afs.collection('workbooks').doc(workbookId);
      const entry: CoinLedgerEntry = {
        amount: -cost,
        reason,
        type: 'spend',
        timestamp: Date.now(),
        chapterId: metadata.chapterId ?? null,
        postId: metadata.postId ?? null,
        upgradeId: metadata.upgradeId ?? null,
      };

      return ref.update({
        coinBalance: firebase.firestore.FieldValue.increment(-cost),
        coinHistory: firebase.firestore.FieldValue.arrayUnion(entry),
      });
    });
  }

  joinUsers(workbook$: Observable<any>) {
    let workbook;
    const joinKeys = {};

    return workbook$.pipe(
      switchMap((c) => {
        workbook = c;
        const uids = Array.from(new Set(c.responses.map((v) => v.uid)));

        const userDocs = uids.map((u) =>
          runInInjectionContext(this.injector, () => {
            return this.afs.doc(`users/${u}`).valueChanges();
          })
        );

        return userDocs.length ? combineLatest(userDocs) : of([]);
      }),
      map((arr) => {
        arr.forEach((v) => (joinKeys[(<any>v).uid] = v));
        workbook.responses = workbook.responses.map((v) => {
          return { ...v, user: joinKeys[v.uid] };
        });

        return workbook;
      })
    );
  }
}
