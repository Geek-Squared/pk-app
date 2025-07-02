import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import firebase from 'firebase/compat/app';
import { AuthenticationService } from './authentication.service';
import { map, switchMap } from 'rxjs/operators';
import { combineLatest, Observable, of } from 'rxjs';

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
    };

    return runInInjectionContext(this.injector, () => {
      return this.afs.collection('workbooks').add(data);
    });
  }

  async saveQuestionResponses(workbookId, content, postId?: string) {
    const { uid } = await this.auth.getUser();

    const data = {
      uid,
      content,
      createdAt: Date.now(),
      postId: postId,
    };

    if (uid) {
      return runInInjectionContext(this.injector, () => {
        const ref = this.afs.collection('workbooks').doc(workbookId);
        return ref.update({
          responses: firebase.firestore.FieldValue.arrayUnion(data),
          newContent: true
        });
      });
    }
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
