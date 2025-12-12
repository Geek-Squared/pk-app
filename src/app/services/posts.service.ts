import { Injectable, Injector, runInInjectionContext } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { UPost } from '../models/post.interface';

@Injectable({
  providedIn: 'root',
})
export class PostsService {
  constructor(private firestore: AngularFirestore, private injector: Injector) {}

  createPost(post: UPost) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore.collection('posts').add(post);
    });
  }

  deletePost(postId: string) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore.collection('posts').doc(postId).delete();
    });
  }

  getPostById(postId: string) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection<UPost>('posts')
        .doc(postId)
        .valueChanges({ idField: 'postId' });
    });
  }

  getPosts() {
    return runInInjectionContext(this.injector, () => {
      return this.firestore.collection('posts').snapshotChanges();
    });
  }

  getPostsByChapterId(chapterId: string) {
    return runInInjectionContext(this.injector, () => {
      return this.firestore
        .collection<any>('posts', (ref) =>
          ref.where('chapterId', '==', chapterId)
        )
        .snapshotChanges();
    });
  }
}
