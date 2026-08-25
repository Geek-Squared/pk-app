import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { UPost } from 'src/app/models/post.interface';
import { PostsService } from 'src/app/services/posts.service';
import { UtilitiesService } from 'src/app/services/utilities.service';
import { WorkbookService } from 'src/app/services/workbook.service';
import { PostDetailsComponent } from './post-details/post-details.component';

@Component({
  selector: 'app-posts',
  templateUrl: './posts.page.html',
  styleUrls: ['./posts.page.scss'],
  standalone: false
})
export class PostsPage implements OnInit {
  public selectedPost: UPost;
  public posts: UPost[];
  public workBook;
  private readonly MIN_MEANINGFUL_SCORE = 5;

  // Peekay deep-links to the exact story it drew on: /posts/:chapterId?post=:postId
  private deepLinkPostId: string | null = null;
  private deepLinkHandled = false;
  private workbookLoaded = false;

  constructor(
    private postsService: PostsService,
    private route: ActivatedRoute,
    public modalController: ModalController,
    private workbookService: WorkbookService,
    private utilsService: UtilitiesService
  ) {}

  ngOnInit(): void {
    this.utilsService.presentLoading();
    this.deepLinkPostId = this.route.snapshot.queryParamMap.get('post');
    this.workbookService.getUserWorkbook().subscribe((data) => {
      this.workBook = data;
      this.workbookLoaded = true;
      this.openDeepLinkedStory();
    });
    this.postsService
      .getPostsByChapterId(this.route.snapshot.paramMap.get('chapterId'))
      .subscribe(
        (data) => {
          this.posts = data.map((e: any) => {
            return {
              postId: e.payload.doc.id,
              ...e.payload.doc.data(),
            };
          });
          this.posts = this.posts.sort((a, b) => (a.order > b.order ? 1 : -1));
          this.utilsService.dismissLoader();
          this.openDeepLinkedStory();
        },
        () => {
          this.utilsService.dismissLoader();
        }
      );
  }

  /**
   * Opens the story Peekay cited, once both the story list and the workbook are
   * in (the lock check reads workbook progress). Respects the same sequential
   * lock as tapping the list, so a citation cannot skip the programme order.
   */
  private async openDeepLinkedStory(): Promise<void> {
    if (this.deepLinkHandled || !this.deepLinkPostId) {
      return;
    }
    if (!this.posts?.length || !this.workbookLoaded) {
      return;
    }

    this.deepLinkHandled = true;

    const index = this.posts.findIndex(
      (post) => post.postId === this.deepLinkPostId
    );
    if (index === -1) {
      return;
    }

    if (!this.isStoryUnlocked(index)) {
      this.utilsService.presentToast(
        'Please complete the previous story to unlock this one.'
      );
      return;
    }

    await this.presentModal(this.posts[index]);
  }

  async presentModal(post: UPost) {
    const modal = await this.modalController.create({
      component: PostDetailsComponent,
      componentProps: { story: post },
      breakpoints: [0, 0.94, 1],
      initialBreakpoint: 0.94,
      handle: true,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
  }

  // Handle story click with lock validation
  handleStoryClick(post: UPost, index: number) {
    if (this.isStoryUnlocked(index)) {
      this.presentModal(post);
    } else {
      this.utilsService.presentToast('Please complete the previous story to unlock this one.');
    }
  }

  checkProgress(postId: string) {
    const responses = this.workBook?.[0]?.responses ?? [];
    const entry = Object.values(responses).find(
      (element: any) => element?.postId === postId
    );

    return entry && this.isMeaningfulResponse(entry) ? entry : null;
  }

  // Check if a story is unlocked (can be accessed)
  isStoryUnlocked(index: number): boolean {
    // First story is always unlocked
    if (index === 0) {
      return true;
    }

    // Check if all previous stories are completed
    for (let i = 0; i < index; i++) {
      const previousPost = this.posts[i];
      if (!this.checkProgress(previousPost?.postId)) {
        return false; // Previous story not completed
      }
    }

    return true; // All previous stories completed
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

  // Get appropriate icon based on story status
  getStoryIcon(postId: string, index: number): string {
    if (this.checkProgress(postId)) {
      return 'folder-open'; // Completed story
    } else if (this.isStoryUnlocked(index)) {
      return 'folder-open'; // Available story
    } else {
      return 'folder'; // Locked story
    }
  }

  // Get appropriate icon color based on story status
  getStoryIconColor(postId: string, index: number): string {
    if (this.checkProgress(postId)) {
      return 'success'; // Completed story - green
    } else if (this.isStoryUnlocked(index)) {
      return 'primary'; // Available story - blue
    } else {
      return 'medium'; // Locked story - gray
    }
  }
}
