// src/app/pages/interventions/interventions.page.ts

import { Component, OnInit } from '@angular/core';
import { InterventionsService } from 'src/app/services/interventions.service';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Intervention } from 'src/app/models/intervention.interface';

import { WorkbookService } from 'src/app/services/workbook.service';
import { ChaptersService } from 'src/app/services/chapters.service';
import { PostsService } from 'src/app/services/posts.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-interventions',
  templateUrl: './interventions.page.html',
  styleUrls: ['./interventions.page.scss'],
  standalone: false,
})
export class InterventionsPage implements OnInit {
  interventions$: Observable<Intervention[]> | undefined;
  
  // Progress stats — INTERVENTION level (how many interventions fully completed)
  totalInterventions = 0;
  completedInterventions = 0;
  progressPercentage = 0;
  nextChapterId: string | null = null;
  userWorkbook: any = null;
  private interventionsArr: any[] = [];
  private allChapters: any[] = [];

  constructor(
    private interventionsService: InterventionsService,
    private workbookService: WorkbookService,
    private chaptersService: ChaptersService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const currentUid = JSON.parse(localStorage.getItem('user') || 'null')?.uid;

    // 1. Fetch interventions list (respecting per-user visibility)
    this.interventions$ = this.interventionsService.getInterventions().pipe(
      map((docs) =>
        docs
          .map((doc: any) => {
            const data = doc.payload.doc.data();
            const id = doc.payload.doc.id;
            return { id, ...data };
          })
          .filter((intervention: any) => this.canView(intervention, currentUid))
      ),
      tap((list) => {
        this.interventionsArr = list;
        this.calculateProgress();
      })
    );

    // 2. Fetch all chapters (used to group by intervention)
    this.chaptersService.getChapters().subscribe(chapters => {
      this.allChapters = chapters.map(c => ({ id: c.payload.doc.id, ...c.payload.doc.data() as any }));
      this.calculateProgress();
    });

    // 3. Fetch user workbook to count completions
    this.workbookService.getUserWorkbook().subscribe((workbooks: any) => {
      if (workbooks && workbooks.length > 0) {
        this.userWorkbook = workbooks[0];
        this.calculateProgress();
      }
    });
  }

  private canView(intervention: any, uid: string | undefined): boolean {
    // Restricted interventions are only visible to the selected testers.
    // Anything without a visibility field stays visible to everyone (legacy).
    if (intervention?.visibility !== 'restricted') {
      return true;
    }
    const allowed = Array.isArray(intervention?.allowedUserIds)
      ? intervention.allowedUserIds
      : [];
    return !!uid && allowed.includes(uid);
  }

  calculateProgress() {
    const completedIds = new Set(
      this.userWorkbook?.responses?.map((r: any) => r.chapterId) || []
    );

    // An intervention counts as completed when all of its chapters are done.
    if (this.interventionsArr.length && this.allChapters.length) {
      this.totalInterventions = this.interventionsArr.length;
      this.completedInterventions = this.interventionsArr.filter((intv) => {
        const chs = this.allChapters.filter((c) => c.interventionId === intv.id);
        return chs.length > 0 && chs.every((c) => completedIds.has(c.id));
      }).length;
      this.progressPercentage = Math.round(
        (this.completedInterventions / (this.totalInterventions || 1)) * 100
      );
    }

    // Find the next incomplete chapter for the Continue action
    if (this.allChapters.length) {
      const next = this.allChapters.find((c) => !completedIds.has(c.id));
      this.nextChapterId = next ? next.id : null;
    }
  }

  getInterventionDescription(name: string) {
    if (!name) return 'Explore our therapeutic interventions.';
    const n = name.toLowerCase();
    if (n.includes('adolescent') || n.includes('young')) {
      return 'Building resilience and navigating the complexities of early adulthood.';
    } else if (n.includes('parent') || n.includes('caregiver')) {
      return 'Support strategies and emotional tools for the modern family dynamic.';
    } else if (n.includes('reflection')) {
      return 'Deep-dive exercises designed to reconnect you with your internal peace.';
    } else if (n.includes('skill') || n.includes('building')) {
      return 'Practical cognitive tools to help manage anxiety and build mental resilience.';
    }
    return 'Work through guided practices designed to support and empower your wellbeing journey.';
  }

  getIconClass(name: string): string {
    if (!name) return 'skills';
    const n = name.toLowerCase();
    if (n.includes('adolescent') || n.includes('young')) return 'adolescents';
    if (n.includes('parent') || n.includes('caregiver')) return 'parents';
    if (n.includes('reflection')) return 'self-care';
    return 'skills';
  }

  getIconName(name: string): string {
    if (!name) return 'school';
    const n = name.toLowerCase();
    if (n.includes('adolescent') || n.includes('young')) return 'diversity_3';
    if (n.includes('parent') || n.includes('caregiver')) return 'family_restroom';
    if (n.includes('reflection')) return 'favorite';
    return 'school';
  }

  continueIntervention() {
    if (this.nextChapterId) {
      // Navigate to the next pending chapter's posts list
      this.router.navigate(['/posts', this.nextChapterId]);
    } else if (this.userWorkbook?.responses?.length > 0) {
      // If none next, go back to the workbook summary
      this.router.navigate(['/my-work-book']);
    } else {
      // Fallback: stay on interventions
      console.log('No next chapter found.');
    }
  }
}
