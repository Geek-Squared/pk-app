import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { IonicModule, ModalController } from '@ionic/angular';
import { take } from 'rxjs/operators';
import { UPost } from 'src/app/models/post.interface';
import { QuestionsService } from 'src/app/services/questions.service';
import { WorkbookService } from 'src/app/services/workbook.service';
import { UtilitiesService } from 'src/app/services/utilities.service';
import { addIcons } from 'ionicons';
import { close, arrowForwardOutline, play, pause, imageOutline } from 'ionicons/icons';

type VideoKind = 'youtube' | 'file' | 'external' | 'none';

@Component({
  selector: 'app-post-details',
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule],
  templateUrl: './post-details.component.html',
  styleUrls: ['./post-details.component.scss'],
})
export class PostDetailsComponent implements OnInit {
  @Input() story: UPost;
  @ViewChild('audioEl') audioRef?: ElementRef<HTMLAudioElement>;

  public workBook = [];
  private readonly MIN_MEANINGFUL_SCORE = 5;
  public hasQuestions = true;
  private isRecordingVideoCompletion = false;

  // Video playback
  public videoKind: VideoKind = 'none';
  public videoEmbedUrl: SafeResourceUrl | null = null;
  public directVideoUrl: string | null = null;
  public playingVideo = false;

  // Audio playback (custom player)
  public audioPlaying = false;
  public audioCurrent = '0:00';
  public audioDuration = '0:00';
  public readonly waveBars = [40, 70, 100, 55, 80, 35, 65, 100, 50, 75, 45, 90, 60, 30];

  constructor(
    public modalController: ModalController,
    private workbookService: WorkbookService,
    private questionsService: QuestionsService,
    private utilsService: UtilitiesService,
    private sanitizer: DomSanitizer,
    private router: Router
  ) {
    addIcons({ close, arrowForwardOutline, play, pause, imageOutline });
  }

  ngOnInit() {
    this.workbookService.getUserWorkbook().subscribe((data) => {
      this.workBook = data;
    });

    // setupVideo first so hasVideo is known before questions resolve.
    this.setupVideo();
    this.loadQuestionState();
  }

  get hasVideo(): boolean {
    return this.videoKind !== 'none';
  }

  dismiss(value?) {
    return this.modalController.dismiss({
      dismissed: true,
      data: value,
    });
  }

  async goToQuestions(): Promise<void> {
    if (!this.hasQuestions) return;
    await this.dismiss();
    this.router.navigate(['/questions', this.getStoryId()]);
  }

  checkProgress() {
    const postId = this.getStoryId();
    const entry = this.workBook[0]?.responses?.find(
      (element) => element?.postId === postId
    );
    return entry && this.isMeaningfulResponse(entry);
  }

  // ---- Video ----

  private setupVideo(): void {
    const url = this.resolveVideoUrl();
    if (!url) {
      this.videoKind = 'none';
      return;
    }

    const ytId = this.extractYouTubeId(url);
    if (ytId) {
      this.videoKind = 'youtube';
      this.videoEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`
      );
      return;
    }

    if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url)) {
      this.videoKind = 'file';
      this.directVideoUrl = url;
      return;
    }

    // Some other host (Vimeo page, etc.) — open in the browser as a fallback.
    this.videoKind = 'external';
  }

  playVideo(): void {
    if (this.videoKind === 'youtube' || this.videoKind === 'file') {
      this.playingVideo = true;
      this.recordVideoCompletion();
      return;
    }
    if (this.videoKind === 'external') {
      this.openVideo();
      return;
    }
    this.utilsService?.presentToast?.('Video link is unavailable for this post.');
  }

  /** External fallback — opens the video URL outside the styled player. */
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

  private extractYouTubeId(url: string): string | null {
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
    );
    return match ? match[1] : null;
  }

  // ---- Audio ----

  toggleAudio(): void {
    const audio = this.audioRef?.nativeElement;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => undefined);
      this.audioPlaying = true;
    } else {
      audio.pause();
      this.audioPlaying = false;
    }
  }

  onAudioTime(): void {
    const audio = this.audioRef?.nativeElement;
    if (audio) this.audioCurrent = this.formatTime(audio.currentTime);
  }

  onAudioMeta(): void {
    const audio = this.audioRef?.nativeElement;
    if (audio) this.audioDuration = this.formatTime(audio.duration);
  }

  onAudioEnded(): void {
    this.audioPlaying = false;
    this.audioCurrent = '0:00';
  }

  private formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ---- Existing logic (unchanged) ----

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
          this.autoCompleteIfNoInteraction();
        },
        () => {
          this.hasQuestions = true;
        }
      );
  }

  /**
   * A post with neither questions nor a video has no completion path, which
   * would permanently lock the next story/chapter. Mark such posts complete
   * on open so progression isn't dead-ended.
   */
  private autoCompleteIfNoInteraction(): void {
    if (!this.hasQuestions && !this.hasVideo) {
      this.recordVideoCompletion();
    }
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
