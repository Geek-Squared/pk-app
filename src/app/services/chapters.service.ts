import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Chapter } from '../models/chapter.interface';

@Injectable({
  providedIn: 'root',
})
export class ChaptersService {
  constructor(private firestore: AngularFirestore, private injector: Injector) {}

  createChapter(chapter: Chapter) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore.collection('chapters').add(chapter);
    });
  }

  deleteChapter(chapterId: string) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore.collection('chapters').doc(chapterId).delete();
    });
  }

  getChapterById(chapterId: string) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection('chapters')
        .doc<Chapter>(chapterId)
        .valueChanges();
    });
  }

  getChapters() {
    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection<Chapter>('chapters', (ref) => ref.orderBy('order'))
        .snapshotChanges();
    });
  }

  searchChapters(searchValue: string) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection(`chapters`, (ref) =>
          ref
            .orderBy('order')
            .startAt(searchValue.toLowerCase())
            .endAt(searchValue.toLowerCase() + '\uf8ff')
            .limit(10)
        )
        .snapshotChanges();
    });
  }

  getChaptersByInterventionId(interventionId: string) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection<any>('chapters', (ref) =>
          ref.where('interventionId', '==', interventionId)
        )
        .snapshotChanges();
    });
  }
}
