import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SurveyTimepoint } from 'src/app/models/intervention.interface';

export interface DueSurvey {
  surveyId: string;
  interventionId: string;
  timepoint: SurveyTimepoint;
}

/**
 * Baseline / midline / endline measurement for interventions.
 *
 * Timepoints are derived from chapter completion, which the workbook already
 * records — no separate scheduling state to drift out of sync:
 *
 *   baseline  no chapters of this intervention completed yet
 *   midline   at least half completed, but not all
 *   endline   every chapter completed
 *
 * The point of three timepoints is to measure change, which means the same
 * instrument is usually administered at all three. That is why a response is
 * scoped by intervention AND timepoint: SurveyService.hasResponded() asks only
 * "has this person ever answered this survey", so it would report the endline
 * as already done the moment the baseline was submitted.
 */
@Injectable({ providedIn: 'root' })
export class InterventionSurveysService {
  constructor(private afs: AngularFirestore, private injector: Injector) {}

  /** Which timepoint an intervention is currently at, or null if not started. */
  timepointFor(completedChapters: number, totalChapters: number): SurveyTimepoint | null {
    if (totalChapters <= 0) {
      return null;
    }
    if (completedChapters === 0) {
      return 'baseline';
    }
    if (completedChapters >= totalChapters) {
      return 'endline';
    }
    return completedChapters / totalChapters >= 0.5 ? 'midline' : null;
  }

  /**
   * Surveys the member still owes for an intervention, at its current
   * timepoint. Empty when nothing is due — including when they are between
   * timepoints, or have already answered.
   */
  dueSurveys(uid: string, interventionId: string): Observable<DueSurvey[]> {
    const intervention$ = runInInjectionContext(this.injector, () =>
      this.afs.doc<any>(`interventions/${interventionId}`).valueChanges()
    );
    const chapters$ = runInInjectionContext(this.injector, () =>
      this.afs
        .collection<any>('chapters', (ref) => ref.where('interventionId', '==', interventionId))
        .valueChanges({ idField: 'id' })
    );
    const workbook$ = runInInjectionContext(this.injector, () =>
      this.afs
        .collection<any>('workbooks', (ref) => ref.where('uid', '==', uid))
        .valueChanges()
    );

    return combineLatest([intervention$, chapters$, workbook$]).pipe(
      switchMap(([intervention, chapters, workbooks]) => {
        const configured = intervention?.surveys;
        if (!configured || !chapters?.length) {
          return of([] as DueSurvey[]);
        }

        const done = new Set<string>();
        (workbooks ?? []).forEach((w: any) =>
          (w?.responses ?? []).forEach((r: any) => r?.chapterId && done.add(r.chapterId))
        );
        const completed = chapters.filter((c: any) => done.has(c.id)).length;

        const timepoint = this.timepointFor(completed, chapters.length);
        if (!timepoint) {
          return of([] as DueSurvey[]);
        }

        const surveyIds: string[] = configured[timepoint] ?? [];
        if (!surveyIds.length) {
          return of([] as DueSurvey[]);
        }

        // Deliverable, and not yet answered for THIS intervention and point.
        return combineLatest(
          surveyIds.map((surveyId) =>
            combineLatest([
              this.isDeliverable(surveyId),
              this.hasResponded(surveyId, uid, interventionId, timepoint),
            ]).pipe(
              map(([deliverable, answered]) =>
                deliverable && !answered
                  ? { surveyId, interventionId, timepoint }
                  : null
              )
            )
          )
        ).pipe(map((rows) => rows.filter((r): r is DueSurvey => r !== null)));
      })
    );
  }

  /**
   * A survey reaches a member only once the admin has activated it AND it has
   * questions. Attaching an instrument to a timepoint is a scheduling decision;
   * activation is the editorial one. Without this check a half-written draft
   * would be pushed at people the moment it was attached.
   */
  private isDeliverable(surveyId: string): Observable<boolean> {
    return runInInjectionContext(this.injector, () =>
      this.afs
        .doc<any>(`surveys/${surveyId}`)
        .valueChanges()
        .pipe(
          map((survey: any) => {
            if (!survey?.active) {
              return false;
            }
            const schema = survey?.schema;
            const questions =
              schema?.elements?.length ||
              schema?.pages?.reduce(
                (n: number, p: any) => n + (p?.elements?.length || 0),
                0
              ) ||
              0;
            return questions > 0;
          })
        )
    );
  }

  /**
   * Every survey id administered through an intervention timepoint.
   *
   * The general Surveys tab must exclude these. They are delivered at the right
   * moment by dueSurveys(), and an ad-hoc answer from that flat list would be
   * saved with no interventionId or timepoint — unattributable, and comparable
   * with nothing.
   */
  attachedSurveyIds(): Observable<Set<string>> {
    return runInInjectionContext(this.injector, () =>
      this.afs
        .collection<any>('interventions')
        .valueChanges()
        .pipe(
          map((interventions: any[]) => {
            const ids = new Set<string>();
            const points: SurveyTimepoint[] = ['baseline', 'midline', 'endline'];
            (interventions ?? []).forEach((intervention) => {
              points.forEach((point) => {
                (intervention?.surveys?.[point] ?? []).forEach((id: string) => {
                  if (id) {
                    ids.add(id);
                  }
                });
              });
            });
            return ids;
          })
        )
    );
  }

  /**
   * Scoped by intervention and timepoint, unlike SurveyService.hasResponded().
   * Without the scope, answering an instrument at baseline would mark it done
   * for the endline too and there would be nothing to compare.
   */
  hasResponded(
    surveyId: string,
    uid: string,
    interventionId: string,
    timepoint: SurveyTimepoint
  ): Observable<boolean> {
    return runInInjectionContext(this.injector, () =>
      this.afs
        .collection(`surveys/${surveyId}/responses`, (ref) =>
          ref
            .where('uid', '==', uid)
            .where('interventionId', '==', interventionId)
            .where('timepoint', '==', timepoint)
            .limit(1)
        )
        .valueChanges()
        .pipe(map((rows: any[]) => rows.length > 0))
    );
  }

  /** Records a response, stamped with the scope that makes it comparable. */
  async saveResponse(
    surveyId: string,
    uid: string,
    interventionId: string,
    timepoint: SurveyTimepoint,
    answers: any
  ): Promise<void> {
    await runInInjectionContext(this.injector, () =>
      this.afs.collection(`surveys/${surveyId}/responses`).add({
        ...answers,
        uid,
        interventionId,
        timepoint,
        submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
    );
  }
}
