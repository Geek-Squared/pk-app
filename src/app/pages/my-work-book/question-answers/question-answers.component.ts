import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { combineLatest, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Chapter } from 'src/app/models/chapter.interface';
import { UPost } from 'src/app/models/post.interface';
import { ChaptersService } from 'src/app/services/chapters.service';
import { PostsService } from 'src/app/services/posts.service';
import { UtilitiesService } from 'src/app/services/utilities.service';
import { WorkbookService } from 'src/app/services/workbook.service';
import { AlertController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-question-answers',
  templateUrl: './question-answers.component.html',
  styleUrls: ['./question-answers.component.scss'],
  standalone: false
})
export class QuestionAnswersComponent implements OnInit {
  public workbook = [];
  public workbookId: string | null = null;
  public questionAnswers;
  public selectedPostId: string | null = null;
  public selectedInterventionId: string | null = null;
  public selectedChapterId: string | null = null;
  private allowedPostIds = new Set<string>();
  private allowedChapterIds = new Set<string>();
  private filterReady = true;
  public sortAnswers = (a: any, b: any) => {
    const aOrder = typeof a?.value?.questionOrder === 'number'
      ? a.value.questionOrder
      : Number(a?.key);
    const bOrder = typeof b?.value?.questionOrder === 'number'
      ? b.value.questionOrder
      : Number(b?.key);

    if (!Number.isNaN(aOrder) && !Number.isNaN(bOrder)) {
      return aOrder - bOrder;
    }

    return `${a?.key}`.localeCompare(`${b?.key}`);
  };

  constructor(
    private workbookService: WorkbookService,
    private chaptersService: ChaptersService,
    private postsService: PostsService,
    public route: ActivatedRoute,
    private utilsService: UtilitiesService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.utilsService.presentLoading();
    this.selectedPostId = this.route.snapshot.paramMap.get('postId');
    this.selectedInterventionId = this.route.snapshot.paramMap.get('interventionId');
    this.selectedChapterId = this.route.snapshot.paramMap.get('chapterId');
    this.filterReady = !(this.selectedInterventionId || this.selectedChapterId);

    const workbook$ = this.workbookService.getUserQuestionResponses();

    const filter$ = this.selectedInterventionId
      ? combineLatest([
          this.chaptersService.getChapters().pipe(
            map((data) =>
              data.map((e: any) => ({
                id: e.payload.doc.id,
                ...e.payload.doc.data(),
              }))
            )
          ),
          this.postsService.getPosts().pipe(
            map((data) =>
              data.map((e: any) => ({
                postId: e.payload.doc.id,
                ...e.payload.doc.data(),
              }))
            )
          ),
        ]).pipe(
          map(([chapters, posts]) =>
            this.buildFilter(chapters, posts, this.selectedInterventionId, null)
          )
        )
      : this.selectedChapterId
        ? this.postsService.getPosts().pipe(
            map((data) =>
              data.map((e: any) => ({
                postId: e.payload.doc.id,
                ...e.payload.doc.data(),
              }))
            ),
            map((posts) =>
              this.buildFilter([], posts, null, this.selectedChapterId)
            )
          )
        : of({ chapterIds: new Set<string>(), postIds: new Set<string>() });

    combineLatest([workbook$, filter$]).subscribe(
      ([workbooks, filter]) => {
        this.allowedChapterIds = filter.chapterIds;
        this.allowedPostIds = filter.postIds;
        this.filterReady = true;
        
        if (workbooks && workbooks.length > 0) {
          this.workbookId = workbooks[0].id;
          this.workbook = this.applyWorkbookFilter(workbooks[0].responses);
        } else {
          this.workbook = [];
        }
        
        this.utilsService.dismissLoader();
      },
      () => {
        this.utilsService.dismissLoader();
      }
    );
  }

  async editResponse(itemIndex: number, elementKey: string, currentResponse: string) {
    const alert = await this.alertController.create({
      header: 'Edit Reflection',
      cssClass: 'workbook-edit-alert',
      inputs: [
        {
          name: 'response',
          type: 'textarea',
          value: currentResponse,
          placeholder: 'Type your reflection here...'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save Changes',
          handler: (data) => {
            if (this.workbookId) {
              this.workbookService.updateWorkbookResponse(this.workbookId, itemIndex, data.response, elementKey)
                .then(() => this.showToast('Reflection updated successfully'))
                .catch(() => this.showToast('Error updating reflection', 'danger'));
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async deleteResponse(itemIndex: number) {
    const alert = await this.alertController.create({
      header: 'Delete Reflection',
      message: 'Are you sure you want to remove this reflection from your workbook? This action cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            if (this.workbookId) {
              this.workbookService.deleteWorkbookResponse(this.workbookId, itemIndex)
                .then(() => this.showToast('Reflection removed'))
                .catch(() => this.showToast('Error deleting reflection', 'danger'));
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async showToast(message: string, color: string = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    toast.present();
  }

  getModuleBgColor(index: number) {
    const colors = ['#f04ecf', '#18c6d9', '#a855f7'];
    return colors[index % colors.length];
  }

  public shouldShowAnswer(item: any, element: any): boolean {
    if (!element?.value || !element.value?.response) {
      return false;
    }

    if (!this.filterReady) {
      return false;
    }

    if (this.selectedPostId) {
      return element.value.postId === this.selectedPostId;
    }

    if (this.selectedChapterId) {
      const postId = element.value.postId;
      if (postId && this.allowedPostIds.has(postId)) {
        return true;
      }

      const chapterId = item?.chapterId;
      if (chapterId && this.allowedChapterIds.has(chapterId)) {
        return true;
      }

      return false;
    }

    if (this.selectedInterventionId) {
      const postId = element.value.postId;
      if (postId && this.allowedPostIds.has(postId)) {
        return true;
      }

      const chapterId = item?.chapterId;
      if (chapterId && this.allowedChapterIds.has(chapterId)) {
        return true;
      }

      return false;
    }

    return true;
  }

  private applyWorkbookFilter(responses: any[]): any[] {
    if (!Array.isArray(responses)) {
      return [];
    }

    if (!this.selectedPostId && !this.selectedInterventionId && !this.selectedChapterId) {
      return responses;
    }

    return responses.filter((item) => this.itemHasVisibleAnswers(item));
  }

  private itemHasVisibleAnswers(item: any): boolean {
    if (!item?.content) {
      return false;
    }

    const values = Object.values(item.content);
    return values.some((value) =>
      this.shouldShowAnswer(item, { value })
    );
  }

  private buildFilter(
    chapters: Chapter[],
    posts: UPost[],
    interventionId: string | null,
    chapterId: string | null
  ): { chapterIds: Set<string>; postIds: Set<string> } {
    if (chapterId) {
      const chapterIds = new Set([chapterId]);
      const postIds = new Set(
        posts
          .filter((post) => post?.postId && post.chapterId === chapterId)
          .map((post) => post.postId as string)
      );
      return { chapterIds, postIds };
    }

    if (!interventionId) {
      return { chapterIds: new Set<string>(), postIds: new Set<string>() };
    }

    const chapterIds = new Set(
      chapters
        .filter((chapter) => chapter?.interventionId === interventionId)
        .map((chapter) => chapter.id)
    );

    const postIds = new Set(
      posts
        .filter((post) => post?.postId && chapterIds.has(post.chapterId))
        .map((post) => post.postId as string)
    );

    return { chapterIds, postIds };
  }
}
