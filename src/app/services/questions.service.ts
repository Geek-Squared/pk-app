import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';

@Injectable({
  providedIn: 'root',
})
export class QuestionsService {
  constructor(private firestore: AngularFirestore, private injector: Injector) {}

  createQuestion(question) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore.collection('questions').add(question);
    });
  }

  deleteQuestion(questionId: string) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore.collection('questions').doc(questionId).delete();
    });
  }

  updateQuestion(question) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection('questions')
        .doc(question.id)
        .set(question, { merge: true });
    });
  }

  getQuestionById(questionId: string) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection('questions')
        .doc(questionId)
        .valueChanges();
    });
  }

  getQuestions() {
    return runInInjectionContext(this.injector, () => {
      return this.firestore.collection('questions').snapshotChanges();
    });
  }

  getQuestionsByPostId(postId: string) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection<any>('questions', (ref) => ref.where('postId', '==', postId))
        .snapshotChanges();
    });
  }
}
