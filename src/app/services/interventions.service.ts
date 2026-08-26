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

  /**
   * A restricted intervention is visible only to the members named on it in the
   * admin. Anything without a `visibility` field stays visible to everyone,
   * which is every intervention created before the feature existed.
   *
   * Note this is a presentation rule, not access control: Firestore lets any
   * signed-in member read the intervention documents. It is fine for limiting a
   * pilot to named testers; it is not a confidentiality boundary.
   */
  canView(intervention: any, uid?: string | null): boolean {
    if (intervention?.visibility !== 'restricted') {
      return true;
    }
    return this.isExplicitlyAssigned(intervention, uid);
  }

  /**
   * Named on this member's allowlist — a deliberate act by programme staff,
   * typically to put a tester or a specific person on an intervention.
   *
   * This outranks the member's own package: staff put them here on purpose, so
   * it must not depend on them having also picked it during onboarding.
   */
  isExplicitlyAssigned(intervention: any, uid?: string | null): boolean {
    if (intervention?.visibility !== 'restricted') {
      return false;
    }
    const allowed = Array.isArray(intervention?.allowedUserIds)
      ? intervention.allowedUserIds
      : [];
    return !!uid && allowed.includes(uid);
  }

  private currentUid(): string | null {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null')?.uid ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Filtered here rather than at each call site: this is read by the
   * interventions list, the workbook, the workbook's chapter picker and
   * "continue journey", and a restriction honoured in only one of them is not a
   * restriction.
   */
  getInterventions(): Observable<any[]> {
    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection('interventions', (ref) => ref.orderBy('order'))
        .snapshotChanges()
        .pipe(
          map((actions: any[]) => {
            const uid = this.currentUid();
            return actions.filter((a: any) =>
              this.canView(a.payload.doc.data(), uid)
            );
          })
        );
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
            const uid = this.currentUid();
            const selectable = (list ?? []).filter(
              (i: any) => i?.selectableAtOnboarding === true && this.canView(i, uid)
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
