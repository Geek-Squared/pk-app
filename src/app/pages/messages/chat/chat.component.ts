import {
  AfterViewChecked,
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, Subscription, takeUntil } from 'rxjs';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { ChatService } from 'src/app/services/chat.service';
import { UsersService } from 'src/app/services/users.service';
import { VoiceRecorder, RecordingData } from 'capacitor-voice-recorder';
import { GestureController } from '@ionic/angular';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { FileStorageService } from 'src/app/services/file-storage.service';
import { UtilitiesService } from 'src/app/services/utilities.service';
@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('content') private content: any;
  @ViewChild('recordBtn', { read: ElementRef }) recordBtn: ElementRef;
  chat: any;
  newMsg: string;
  newRecording: string;
  private usersSubscription = new Subscription();
  recording = false;
  duration = 0;
  durationDisplay = '';
  selectedChat: any;
  destroyed$ = new Subject();

  constructor(
    public cs: ChatService,
    private route: ActivatedRoute,
    public auth: AuthenticationService,
    public usersService: UsersService,
    private gestureCtrl: GestureController,
    private fileStorageService: FileStorageService,
    private utilsService: UtilitiesService
  ) {}

  ngOnInit() {
    VoiceRecorder.requestAudioRecordingPermission();
    const chatId = this.route.snapshot.paramMap.get('chatId');
    const source$ = this.cs.get(chatId);
    this.utilsService.presentLoading();
    this.cs
      .joinUsers(source$)
      .pipe(takeUntil(this.destroyed$))
      .subscribe(
        (res) => {
          this.chat = res;
          this.utilsService.dismissLoader();
        },
        () => {
          this.utilsService.dismissLoader();
        }
      );

    this.scrollBottom();
  }

  ionViewWillEnter() {
    this.scrollBottom();
  }

  ngAfterViewInit(): void {
    this.stopRecording();

    const longPress = this.gestureCtrl.create(
      {
        el: this.recordBtn?.nativeElement,
        gestureName: 'long-press',
        threshold: 0,
        onStart: (t: any) => {
          Haptics.impact({ style: ImpactStyle.Light });
          this.startRecording();
          this.calculateDuration();
        },
        onEnd: () => {
          Haptics.impact({ style: ImpactStyle.Light });
          this.stopRecording();
        },
      },
      true
    );

    longPress.enable();
  }

  submit(chat: { type: string; }) {
    if (!(this.newMsg || this.newRecording)) {
      return alert('You need to enter something');
    }
  
    if (chat?.type === 'group') {
      this.handleGroupChatSubmit(chat);
    } else {
      this.handleDirectChatSubmit(chat);
    }
  }
  
  handleGroupChatSubmit(chat) {
    this.usersSubscription = this.usersService.getUsers().subscribe((res) => {
      const users = this.mapUsers(res);
      const groupMembers = this.filterGroupMembers(users, chat);
  
      this.sendMessageToGroup(chat, groupMembers);
      this.resetMessage();
      this.scrollBottom();
      this.updateChat(chat);
    });
  }
  
  handleDirectChatSubmit(chat: { type: string; }) {
    this.sendMessageToDirectChat(chat);
    this.resetMessage();
    this.scrollBottom();
    this.updateChat(chat);
  }
  
  mapUsers(res: any[]) {
    return res.map((e: any) => ({
      id: e.payload.doc.id,
      ...e.payload.doc.data(),
    }));
  }
  
  filterGroupMembers(users: any[], chat: { hasRead: { hasOwnProperty: (arg0: any) => any; }; }) {
    return users.filter((element) => chat?.hasRead?.hasOwnProperty(element?.uid));
  }
  
  sendMessageToGroup(chat: { id: string; uid: string; }, groupMembers: any[]) {
    if (this.newMsg !== '') {
      this.cs.sendMessage(chat.id, this.newMsg, chat?.uid, groupMembers);
    }
  
    if (this.newRecording) {
      this.cs.sendMessage(chat.id, this.newRecording, chat?.uid, groupMembers, 'audio');
    }
  }
  
  sendMessageToDirectChat(chat: { type?: string; id?: any; uid?: any; }) {
    if (this.newRecording) {
      this.cs.sendMessage(chat.id, this.newRecording, chat?.uid, null, 'audio');
    } else {
      this.cs.sendMessage(chat.id, this.newMsg, chat?.uid);
    }
  }
  
  resetMessage() {
    this.newMsg = '';
    this.newRecording = null;
  }
  
  updateChat(chat) {
    this.cs.updateChat(this.chat, this.chat.messages?.length + 1).then();
  }

  trackByCreated(i, msg) {
    return msg.createdAt;
  }

  getInitials(name: string) {
    return name ? name.substring(0, 1).toLocaleUpperCase() : 'O';
  }

  private scrollBottom() {
    setTimeout(() => {
      if (this.content.scrollToBottom) {
        this.content.scrollToBottom(400);
      }
    }, 1000);
  }

  public isDifferentDay(messageIndex: number): boolean {
    if (messageIndex === 0) return true;

    const d1 = new Date(this.chat?.messages[messageIndex - 1]?.createdAt);
    const d2 = new Date(this.chat?.messages[messageIndex]?.createdAt);

    return (
      d1.getFullYear() !== d2.getFullYear() ||
      d1.getMonth() !== d2.getMonth() ||
      d1.getDate() !== d2.getDate()
    );
  }

  public getMessageDate(messageIndex: number): string {
    const wholeDate = new Date(
      this.chat[messageIndex]?.createdAt
    ).toDateString();

    return wholeDate.slice(0, wholeDate.length - 5);
  }

  ngOnDestroy() {
    this.usersSubscription.unsubscribe();
    this.updateChatUnread();
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }

  startRecording() {
    this.recording = true;
    VoiceRecorder.startRecording();
  }

  stopRecording() {
    if (!this.recording) return;
    this.recording = false;
    VoiceRecorder.stopRecording().then((res: RecordingData) => {
      if (res.value && res.value.recordDataBase64) {
        this.newRecording = res.value.recordDataBase64;
        this.fileStorageService
          .pushFileToStorage(this.newRecording, new Date().getTime().toString())
          .then((res) => {
            this.newRecording = res;
            return this.submit(this.chat);
          });
      }
    });
  }

  calculateDuration() {
    if (!this.recording) {
      this.duration = 0;
      this.durationDisplay = '';
      return;
    }

    this.duration += 1;
    const minutes = Math.floor(this.duration / 60);
    const seconds = Math.floor(this.duration % 60)
      .toString()
      .padStart(2, '0');
    this.durationDisplay = `${minutes}:${seconds}`;
  }

  updateChatUnread() {
    if (this.chat)
      return this.cs.updateChat(this.chat, this.chat.messages?.length).then();
  }
}
