// src/app/services/interventions.service.ts
import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Intervention } from 'src/app/models/intervention.interface';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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

  /**
   * The pills shown at onboarding. Programme-configured, so which interventions
   * appear can change without an app release. Ordered by onboardingOrder, then
   * order, with the audience matching the member's stated age first.
   */
  getSelectableInterventions(age?: number): Observable<Intervention[]> {
    return runInInjectionContext(this.injector, () =>
      this.firestore
        .collection<any>('interventions')
        .valueChanges({ idField: 'id' })
        .pipe(
          map((list) => {
            const selectable = (list ?? []).filter(
              (i: any) => i?.selectableAtOnboarding === true
            );
            const adolescent = typeof age === 'number' && age < 18;
            return selectable.sort((a: any, b: any) => {
              // Age-appropriate first, then the configured order.
              const rank = (i: any) => {
                const aud = i?.audience ?? 'all';
                if (adolescent) return aud === 'adolescent' ? 0 : aud === 'all' ? 1 : 2;
                return aud === 'adult' ? 0 : aud === 'all' ? 1 : 2;
              };
              const byAudience = rank(a) - rank(b);
              if (byAudience !== 0) return byAudience;
              return (a.onboardingOrder ?? a.order ?? 0) - (b.onboardingOrder ?? b.order ?? 0);
            }) as Intervention[];
          })
        )
    );
  }

  getInterventionsByInterventionId(interventionId: string): Observable<any[]> {
    return runInInjectionContext(this.injector, () => {
      return this.firestore.collection('interventions', ref => 
        ref.where('interventionId', '==', interventionId).orderBy('order')
      ).snapshotChanges();
    });
  }
}
