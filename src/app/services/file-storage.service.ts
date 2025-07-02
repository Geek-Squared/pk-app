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

  getUrl(): Observable<any> {
    const storageRef = this.storage.ref('uploads');
    return storageRef.getDownloadURL();
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
