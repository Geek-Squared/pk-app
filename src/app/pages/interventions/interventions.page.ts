// src/app/pages/interventions/interventions.page.ts

import { Component, OnInit } from '@angular/core';
import { InterventionsService } from 'src/app/services/interventions.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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
  
  // Progress stats
  totalModules = 18; // Default fallback
  completedModules = 0;
  progressPercentage = 0;
  nextChapterId: string | null = null;
  userWorkbook: any = null;

  constructor(
    private interventionsService: InterventionsService,
    private workbookService: WorkbookService,
    private chaptersService: ChaptersService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // 1. Fetch interventions list
    this.interventions$ = this.interventionsService.getInterventions().pipe(
      map((docs) =>
        docs.map((doc: any) => {
          const data = doc.payload.doc.data();
          const id = doc.payload.doc.id;
          return { id, ...data };
        })
      )
    );

    // 2. Fetch all chapters to count total modules
    this.chaptersService.getChapters().subscribe(chapters => {
      const allChapters = chapters.map(c => ({ id: c.payload.doc.id, ...c.payload.doc.data() as any }));
      this.totalModules = allChapters.length || 18;
      this.calculateProgress(allChapters);
    });

    // 3. Fetch user workbook to count completions
    this.workbookService.getUserWorkbook().subscribe((workbooks: any) => {
      if (workbooks && workbooks.length > 0) {
        this.userWorkbook = workbooks[0];
        this.calculateProgress();
      }
    });
  }

  calculateProgress(allChapters?: any[]) {
    if (!this.userWorkbook) return;
    
    // Count unique completed chapters in workbook
    const completedIds = new Set(this.userWorkbook.responses?.map((r: any) => r.chapterId) || []);
    this.completedModules = completedIds.size;
    this.progressPercentage = Math.round((this.completedModules / (this.totalModules || 1)) * 100);

    // Find the next incomplete chapter
    if (allChapters) {
      const next = allChapters.find(c => !completedIds.has(c.id));
      if (next) this.nextChapterId = next.id;
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
