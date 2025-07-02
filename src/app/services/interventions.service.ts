// src/app/services/interventions.service.ts
import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Intervention } from 'src/app/models/intervention.interface';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class InterventionsService {
  constructor(private firestore: AngularFirestore, private injector: Injector) {}

  getInterventions(): Observable<any[]> {
    return runInInjectionContext(this.injector, () => {
      return this.firestore.collection('interventions', ref => ref.orderBy('order')).snapshotChanges();
    });
  }

  getInterventionById(interventionId: string): Observable<Intervention> {
    return runInInjectionContext(this.injector, () => {
      return this.firestore.doc(`interventions/${interventionId}`).valueChanges({ idField: 'id' }) as Observable<Intervention>;
    });
  }

  getInterventionsByInterventionId(interventionId: string): Observable<any[]> {
    return runInInjectionContext(this.injector, () => {
      return this.firestore.collection('interventions', ref => 
        ref.where('interventionId', '==', interventionId).orderBy('order')
      ).snapshotChanges();
    });
  }
}
