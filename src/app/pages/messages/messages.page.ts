import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { BehaviorSubject, combineLatest, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { GestureController, IonicModule, ModalController } from '@ionic/angular';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { ChatService } from 'src/app/services/chat.service';
import { UsersService } from 'src/app/services/users.service';
import { RouterModule } from '@angular/router';
import { BackButtonComponent } from 'src/app/components/back-button/back-button.component';
import { UserSelectionComponent } from './user-selection/user-selection.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.page.html',
  styleUrls: ['./messages.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, BackButtonComponent, FormsModule]
})
export class MessagesPage implements OnInit {
  searchTerm$ = new BehaviorSubject<string>('');
  displayView: string = 'chats';
  
  userChats$: Observable<any>;
  groupChats$: Observable<any>;
  
  filteredChats$: Observable<any>;
  filteredGroups$: Observable<any>;

  constructor(
    public auth: AuthenticationService,
    public cs: ChatService,
    public gestureCtrl: GestureController,
    private usersService: UsersService,
    private modalController: ModalController
  ) {}

  ngOnInit() {
    this.auth.user$.subscribe(user => console.log('Current User Messages:', user));
    
    this.userChats$ = this.cs.getUserChats();
    this.groupChats$ = this.cs.getGroupChats();

    this.filteredChats$ = combineLatest([this.userChats$, this.searchTerm$]).pipe(
      map(([chats, term]) => this.filterChatList(chats, term))
    );

    this.filteredGroups$ = combineLatest([this.groupChats$, this.searchTerm$]).pipe(
      map(([groups, term]) => this.filterGroupList(groups, term))
    );
  }

  filterChatList(chats: any[], term: string) {
    if (!chats) return [];
    if (!term) return chats;
    return chats.filter(c => 
      c.recipientName?.toLowerCase().includes(term.toLowerCase())
    );
  }

  filterGroupList(groups: any[], term: string) {
    if (!groups) return [];
    if (!term) return groups;
    return groups.filter(g => 
      g.displayName?.toLowerCase().includes(term.toLowerCase())
    );
  }

  onSearchChange(event: any) {
    this.searchTerm$.next(event.target.value);
  }

  setView(view: string) {
    this.displayView = view;
  }

  async showUserSelection(isGroup: boolean = false) {
    const modal = await this.modalController.create({
      component: UserSelectionComponent,
      componentProps: { isGroup }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data) {
      if (data.mode === 'group') {
        this.cs.createGroup(data.name, data.members);
      } else {
        this.cs.create(data.user);
      }
    }
  }

  startNewChat(user: any) {
    this.cs.create(user);
  }

  change(event) {
    const value = event?.detail?.value;
    if (value) {
      this.displayView = value;
    }
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
