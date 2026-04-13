import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Observable, finalize, lastValueFrom } from 'rxjs';

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

  async uploadFile(file: File): Promise<string> {
    const ext = file.name.split('.').pop() || 'bin';
    const filePath = `uploads/${Date.now()}.${ext}`;
    const storageRef = this.storage.ref(filePath);
    await storageRef.put(file);
    return lastValueFrom(storageRef.getDownloadURL());
  }

  async uploadBase64(base64Data: string, mimeType: string): Promise<string> {
    const ext = mimeType.split('/')[1] || 'jpg';
    const filePath = `uploads/${Date.now()}.${ext}`;
    const storageRef = this.storage.ref(filePath);
    await storageRef.putString(base64Data, 'base64', { contentType: mimeType });
    return lastValueFrom(storageRef.getDownloadURL());
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
