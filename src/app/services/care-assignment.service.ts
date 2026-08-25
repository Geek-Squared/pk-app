import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { CareAssignment, CareAssignmentSource } from 'src/app/models/care-assignment.interface';

/**
 * Composes and reads a member's package of care.
 *
 * The package is whatever the member selected during onboarding — there is no
 * rules engine and nothing infers it. It is stored rather than derived because
 * a staff override has to be able to disagree with the member's own selection.
 */
@Injectable({ providedIn: 'root' })
export class CareAssignmentService {
  constructor(private afs: AngularFirestore, private injector: Injector) {}

  getAssignment(uid: string): Observable<CareAssignment | null> {
    return runInInjectionContext(this.injector, () =>
      this.afs
        .doc<CareAssignment>(`careAssignments/${uid}`)
        .valueChanges()
        .pipe(map((d) => d ?? null))
    );
  }

  /** Programme default, applied when a member selects nothing. */
  private defaultInterventionIds(): Promise<string[]> {
    return runInInjectionContext(this.injector, () =>
      this.afs
        .doc<any>('config/onboarding')
        .valueChanges()
        .pipe(
          take(1),
          map((c) => (Array.isArray(c?.defaultInterventionIds) ? c.defaultInterventionIds : []))
        )
        .toPromise()
    ).then((ids) => ids ?? []);
  }

  /**
   * Build the package from the member's own selections. An empty selection
   * takes the programme default rather than leaving the member with nothing.
   */
  async composeFromSelections(uid: string, selected: string[]): Promise<CareAssignment> {
    const ids = selected?.length ? selected : await this.defaultInterventionIds();
    const source: CareAssignmentSource = selected?.length ? 'self_selection' : 'default';
    await this.archiveCurrent(uid);

    const now = firebase.firestore.FieldValue.serverTimestamp();
    const assignment: any = {
      uid,
      interventionIds: ids,
      source,
      overriddenBy: null,
      overrideReason: null,
      effectiveAt: now,
      updatedAt: now,
    };
    await runInInjectionContext(this.injector, () =>
      this.afs.doc(`careAssignments/${uid}`).set(assignment, { merge: true })
    );
    return assignment as CareAssignment;
  }

  /** Copy the current assignment to history before it is overwritten. */
  private async archiveCurrent(uid: string): Promise<void> {
    const current = await runInInjectionContext(this.injector, () =>
      this.afs.doc<CareAssignment>(`careAssignments/${uid}`).valueChanges().pipe(take(1)).toPromise()
    );
    if (!current) return;
    await runInInjectionContext(this.injector, () =>
      this.afs.collection(`careAssignments/${uid}/history`).add({
        ...current,
        supersededAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
    );
  }

  /**
   * What the member may see: their package, plus anything they have already
   * started. Deselecting something you had begun must not make your own
   * progress unreachable.
   */
  visibleInterventionIds(uid: string): Observable<string[]> {
    const pkg$ = this.getAssignment(uid).pipe(map((a) => a?.interventionIds ?? []));
    const inProgress$ = runInInjectionContext(this.injector, () =>
      this.afs
        .collection<any>('workbooks', (ref) => ref.where('uid', '==', uid))
        .valueChanges()
        .pipe(
          map((books) => {
            const ids = new Set<string>();
            books?.forEach((b) =>
              (b?.responses ?? []).forEach((r: any) => {
                if (r?.interventionId) ids.add(r.interventionId);
              })
            );
            return Array.from(ids);
          })
        )
    );

    return combineLatest([pkg$, inProgress$]).pipe(
      map(([pkg, started]) => Array.from(new Set([...pkg, ...started])))
    );
  }

  /** Does this member predate onboarding? Used to offer them a skip. */
  hasExistingProgress(uid: string): Observable<boolean> {
    return runInInjectionContext(this.injector, () =>
      this.afs
        .collection<any>('workbooks', (ref) => ref.where('uid', '==', uid).limit(1))
        .valueChanges()
        .pipe(map((w) => (w?.length ?? 0) > 0))
    );
  }

  /** Staff placement that may disagree with the member's own selection. */
  async applyStaffOverride(
    uid: string,
    interventionIds: string[],
    staffUid: string,
    reason: string
  ): Promise<void> {
    await this.archiveCurrent(uid);
    const now = firebase.firestore.FieldValue.serverTimestamp();
    await runInInjectionContext(this.injector, () =>
      this.afs.doc(`careAssignments/${uid}`).set(
        {
          uid,
          interventionIds,
          source: 'staff_override' as CareAssignmentSource,
          overriddenBy: staffUid,
          overrideReason: reason,
          effectiveAt: now,
          updatedAt: now,
        },
        { merge: true }
      )
    );
  }
}
