import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonicModule, ModalController } from '@ionic/angular';
import { take } from 'rxjs/operators';
import { UPost } from 'src/app/models/post.interface';
import { BackButtonComponent } from 'src/app/components/back-button/back-button.component';
import { QuestionsService } from 'src/app/services/questions.service';
import { WorkbookService } from 'src/app/services/workbook.service';
import { UtilitiesService } from 'src/app/services/utilities.service';
import { addIcons } from 'ionicons';
import { close, arrowForwardOutline } from 'ionicons/icons';

@Component({
  selector: 'app-post-details',
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, BackButtonComponent],
  templateUrl: './post-details.component.html',
  styleUrls: ['./post-details.component.scss'],
})
export class PostDetailsComponent implements OnInit {
  @Input() story: UPost;
  public workBook = [];
  private readonly MIN_MEANINGFUL_SCORE = 5;
  public hasQuestions = true;
  private isRecordingVideoCompletion = false;

  constructor(
    public modalController: ModalController,
    private workbookService: WorkbookService,
    private questionsService: QuestionsService,
    private utilsService: UtilitiesService
  ) {
    addIcons({ close, arrowForwardOutline });
  }

  ngOnInit() {
    this.workbookService.getUserWorkbook().subscribe((data) => {
      this.workBook = data;
    });

    this.loadQuestionState();
  }

  dismiss(value?) {
    this.modalController.dismiss({
      dismissed: true,
      data: value,
    });
  }

  checkProgress() {
    const postId = this.getStoryId();
    const entry = this.workBook[0]?.responses?.find(
      (element) => element?.postId === postId
    );
    return entry && this.isMeaningfulResponse(entry);
  }

  openVideo(): void {
    const url = this.resolveVideoUrl();
    if (!url) {
      this.utilsService?.presentToast?.('Video link is unavailable for this post.');
      return;
    }

    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }

    this.recordVideoCompletion();
  }

  private recordVideoCompletion(): void {
    if (this.hasQuestions || this.checkProgress() || this.isRecordingVideoCompletion) {
      return;
    }

    const workbookId = localStorage.getItem('userWorkbookId');
    const postId = this.getStoryId();
    if (!workbookId || !postId) {
      return;
    }

    this.isRecordingVideoCompletion = true;
    const completionPromise = this.workbookService.markVideoCompletion(
      workbookId,
      postId,
      this.story?.chapterId ?? null
    );

    if (!completionPromise) {
      this.isRecordingVideoCompletion = false;
      return;
    }

    completionPromise
      .catch(() => undefined)
      .finally(() => {
        this.isRecordingVideoCompletion = false;
      });
  }

  private loadQuestionState(): void {
    const postId = this.getStoryId();
    if (!postId) {
      this.hasQuestions = false;
      return;
    }

    this.questionsService
      .getQuestionsByPostId(postId)
      .pipe(take(1))
      .subscribe(
        (snapshot) => {
          this.hasQuestions = (snapshot?.length ?? 0) > 0;
        },
        () => {
          this.hasQuestions = true;
        }
      );
  }

  private getStoryId(): string | undefined {
    return this.story?.postId ?? this.story?.id;
  }

  private resolveVideoUrl(): string | null {
    const raw = this.story?.videoUrl?.trim();
    if (!raw) {
      return null;
    }

    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }

    return `https://${raw}`;
  }

  private isMeaningfulResponse(response: any): boolean {
    if (!response) {
      return false;
    }

    if (typeof response?.qualityScore === 'number') {
      return response.qualityScore >= this.MIN_MEANINGFUL_SCORE;
    }

    const serialized = JSON.stringify(response?.content ?? '')
      .replace(/[\n\r]/g, ' ')
      .trim()
      .toLowerCase();

    if (!serialized) {
      return false;
    }

    const banned = ['x', 'n/a', 'na', 'none', 'nil'];
    return !banned.includes(serialized);
  }
}
