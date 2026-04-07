import { Component, OnInit } from '@angular/core';
import { WorkbookService } from 'src/app/services/workbook.service';
import { ChaptersService } from 'src/app/services/chapters.service';
import { InterventionsService } from 'src/app/services/interventions.service';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-my-work-book',
  templateUrl: './my-work-book.page.html',
  styleUrls: ['./my-work-book.page.scss'],
  standalone: false
})
export class MyWorkBookPage implements OnInit {
  public workbook: any[] = [];
  public progressPercentage = 0;
  public completedModulesCount = 0;
  public totalChaptersCount = 0;
  public nextInterventionId: string | null = null;
  private readonly MIN_MEANINGFUL_SCORE = 5;

  constructor(
    private workbookService: WorkbookService,
    private chaptersService: ChaptersService,
    private interventionsService: InterventionsService,
    private router: Router
  ) {}

  async ngOnInit() {
    // 1. Fetch total curriculum size
    this.chaptersService.getChapters().subscribe(chapters => {
       const mapped = chapters.map((e: any) => e.payload.doc.id);
       this.totalChaptersCount = mapped.length;
       this.calculateProgress();
    });

    // 2. Listen for workbook responses
    this.workbookService.getUserQuestionResponses().subscribe((res: any) => {
      this.workbook = res[0]?.responses ?? [];
      this.calculateProgress();
    });
  }

  private calculateProgress() {
    if (!this.totalChaptersCount) return;
    
    // Count meaningful reflections
    this.completedModulesCount = this.workbook.filter((response: any) => {
      if (typeof response?.qualityScore === 'number') return response.qualityScore >= this.MIN_MEANINGFUL_SCORE;
      return !!response?.content;
    }).length;

    this.progressPercentage = Math.round((this.completedModulesCount / this.totalChaptersCount) * 100);
  }

  public async continueJourney() {
    // Logic: Find the first intervention with incomplete chapters
    const interventions = await firstValueFrom(this.interventionsService.getInterventions());
    const mappedInts = interventions.map((e: any) => ({ id: e.payload.doc.id, ...e.payload.doc.data() }));

    for (const int of mappedInts) {
       const chapters = await firstValueFrom(this.chaptersService.getChaptersByInterventionId(int.id));
       const mappedChapters = chapters.map((e: any) => e.payload.doc.id);
       
       // Check if all these chapter IDs are in workbook
       const completedInThisInt = mappedChapters.filter(id => 
          this.workbook.some(r => r.chapterId === id)
       ).length;

       if (completedInThisInt < mappedChapters.length) {
          this.router.navigate(['/chapters', int.id]);
          return;
       }
    }
    
    // Default to the first one if all done (or none found)
    if (mappedInts.length) this.router.navigate(['/chapters', mappedInts[0].id]);
  }
}
