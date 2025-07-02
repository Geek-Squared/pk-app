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

  constructor(
    private postsService: PostsService,
    private route: ActivatedRoute,
    public modalController: ModalController,
    private workbookService: WorkbookService,
    private utilsService: UtilitiesService
  ) {}

  ngOnInit(): void {
    this.utilsService.presentLoading();
    this.workbookService.getUserWorkbook().subscribe((data) => {
      this.workBook = data;
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
        },
        () => {
          this.utilsService.dismissLoader();
        }
      );
  }

  async presentModal(post: UPost) {
    const modal = await this.modalController.create({
      component: PostDetailsComponent,
      componentProps: { story: post },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
  }

  checkProgress(postId: string) {
    return this.workBook
      ? Object?.values(this.workBook[0]?.responses).find(
          (element: any) => element?.postId === postId
        )
      : null;
  }
}
