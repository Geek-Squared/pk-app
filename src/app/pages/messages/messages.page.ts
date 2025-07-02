import {
  AfterViewInit,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { ChatService } from 'src/app/services/chat.service';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { RecordingData, VoiceRecorder } from 'capacitor-voice-recorder';
import { GestureController } from '@ionic/angular';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
// const { PushNotifications } = Plugins;

@Component({
  selector: 'app-messages',
  templateUrl: './messages.page.html',
  styleUrls: ['./messages.page.scss'],
  standalone: false
})
export class MessagesPage implements OnInit {
  userChats$: Observable<any>;
  isGroupChats: boolean;
  displayView = 'chats';
  public groupChats$;
  badgeColor: any;

  constructor(
    public auth: AuthenticationService,
    public cs: ChatService,
    public gestureCtrl: GestureController
  ) {}

  ngOnInit() {
    this.userChats$ = this.cs.getUserChats();
    this.groupChats$ = this.cs.getGroupChats();
  }

  change(event) {
    this.displayView = event?.target?.value;
  }

  getTotalUnread(chat) {
    const userUid = JSON.parse(localStorage.getItem('user'))?.uid;
    const hasReadCount = chat?.hasRead?.[userUid];
    const totalMessages = chat?.messages?.length;

    if (chat?.hasRead && hasReadCount) {
      const unreadCount = totalMessages - hasReadCount;
      if (unreadCount > 0) {
        return unreadCount;
      } else {
        return 0;
      }
    } else {
      return totalMessages;
    }
  }

  createChat() {
    this.cs.create();
  }

  updateChatUnread(chat) {
    return this.cs.updateChat(chat, chat.messages?.length).then();
  }

  // vn:
  /*   calculateDuration() {
    if (!this.recording) {
      this.duration = 0;
      this.durationDisplay = '';
      return;
    }

    this.duration += 1;
    const minutes = Math.floor(this.duration / 60);
    const seconds = (this.duration % 60).toString().padStart(2, '0');
    this.durationDisplay = `${minutes}:${seconds}`;

    setTimeout(() => {
      this.calculateDuration();
    }, 1000);
  }

  async loadFiles() {
    Filesystem.readdir({
      path: '',
      directory: Directory.Data,
    }).then((result) => {
      
      this.storedFileNames = result.files;
    });
  }

  startRecording() {
    if (this.recording) {
      return;
    }
    this.recording = true;
    VoiceRecorder.startRecording();
  }

  stopRecording() {
    if (!this.recording) {
      return;
    }
    VoiceRecorder.stopRecording().then(async (result: RecordingData) => {
      this.recording = false;

      if (result.value && result.value.recordDataBase64) {
        const recordData = result.value.recordDataBase64;
        
        const fileName = new Date().getTime() + '.wav';
        await Filesystem.writeFile({
          path: fileName,
          directory: Directory.Data,
          data: recordData,
        });
        this.loadFiles();
      }
    });
  }

  async playFile(fileName) {
    const audioFile = await Filesystem.readFile({
      path: fileName,
      directory: Directory.Data,
    });
    
    const base64Sound = audioFile.data;

    const audioRef = new Audio(`data:audio/aac;base64,${base64Sound}`);
    audioRef.oncanplaythrough = () => audioRef.play();
    audioRef.load();
  }

  async deleteRecording(fileName) {
    await Filesystem.deleteFile({
      directory: Directory.Data,
      path: fileName,
    });
    this.loadFiles();
    this.stopRecording();
  } */
  // end vn
}
