import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UPost } from 'src/app/models/post.interface';
import { PostsService } from 'src/app/services/posts.service';
import { UtilitiesService } from 'src/app/services/utilities.service';

@Component({
  selector: 'app-posts',
  templateUrl: './posts.component.html',
  styleUrls: ['./posts.component.scss'],
  standalone: false
})
export class PostsComponent implements OnInit {
  public selectedPost: any;
  public posts: any[];

  constructor(
    private postsService: PostsService,
    private route: ActivatedRoute,
    private utilsService: UtilitiesService
  ) {}

  ngOnInit(): void {
    this.utilsService.presentLoading();
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
        (err) => {
          this.utilsService.dismissLoader();
        }
      );
  }
}
