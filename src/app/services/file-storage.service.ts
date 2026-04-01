import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Observable, finalize } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FileStorageService {
  private basePath = '/uploads';

  constructor(
    private db: AngularFireDatabase,
    private storage: AngularFireStorage
  ) {}

  pushFileToStorage(dataUrl: string, fileName: string) {
    const storageRef = this.storage.ref('uploads/voice-recordings' + fileName);

    return storageRef
      .putString(dataUrl, 'base64', { contentType: 'audio/mpeg' })
      .then((snapshot) => {
        return snapshot.ref.getDownloadURL();
      });
  }

  async uploadImage(file: File) {
    const filePath = `uploads/images/${Date.now()}_${file.name}`;
    const storageRef = this.storage.ref(filePath);
    const uploadTask = this.storage.upload(filePath, file);

    return new Promise<string>((resolve, reject) => {
      uploadTask.snapshotChanges().pipe(
        finalize(() => {
          storageRef.getDownloadURL().subscribe({
            next: (url) => resolve(url),
            error: (err) => reject(err)
          });
        })
      ).subscribe();
    });
  }

  getUrl(): Observable<any> {
    const storageRef = this.storage.ref('uploads');
    return storageRef.getDownloadURL();
  }

  async uploadFile(file: File) {
    const filePath = `uploads/${Date.now()}_${file.name}`;
    const storageRef = this.storage.ref(filePath);
    const uploadTask = this.storage.upload(filePath, file);

    return new Promise<string>((resolve, reject) => {
      uploadTask.snapshotChanges().pipe(
        finalize(() => {
          storageRef.getDownloadURL().subscribe({
            next: (url) => resolve(url),
            error: (err) => reject(err)
          });
        })
      ).subscribe();
    });
  }
}

export class FileUpload {
  key: string;
  name: string;
  url: string;
  file: File;

  constructor(file: File) {
    this.file = file;
  }
}
