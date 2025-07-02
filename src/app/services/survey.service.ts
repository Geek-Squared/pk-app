import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class SurveyService {
  constructor(private firestore: AngularFirestore, private injector: Injector) {}

  getActiveSurveys() {
    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection<any>('surveys', (ref) => ref.where('active', '==', true))
        .snapshotChanges();
    });
  }

  getSurvey(surveyId: string) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection('surveys')
        .doc<any>(surveyId)
        .snapshotChanges()
        .pipe(
          map((doc: any) => {
            return { id: doc.payload.id, ...doc.payload.data() };
          })
        );
    });
  }

  saveSurveyResponse(surveyId: string, response: any) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection('surveys')
        .doc(surveyId)
        .collection('responses')
        .add(response)
        .then((res) => {});
    });
  }
}
