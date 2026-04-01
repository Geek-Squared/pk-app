import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { IonicModule, GestureController } from '@ionic/angular';
import { Subject, Subscription, take, takeUntil } from 'rxjs';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { ChatService } from 'src/app/services/chat.service';
import { UsersService } from 'src/app/services/users.service';
import { VoiceRecorder, RecordingData } from 'capacitor-voice-recorder';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { FileStorageService } from 'src/app/services/file-storage.service';
import { UtilitiesService } from 'src/app/services/utilities.service';
import { BackButtonComponent } from 'src/app/components/back-button/back-button.component';
import { ModalController } from '@ionic/angular';
import { UserSelectionComponent } from '../user-selection/user-selection.component';
import firebase from 'firebase/compat/app';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, BackButtonComponent]
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
  currentUser: any;

  constructor(
    public cs: ChatService,
    private route: ActivatedRoute,
    public auth: AuthenticationService,
    public usersService: UsersService,
    private gestureCtrl: GestureController,
    private fileStorageService: FileStorageService,
    private utilsService: UtilitiesService,
    private modalController: ModalController
  ) {}

  async addMember() {
    const modal = await this.modalController.create({
      component: UserSelectionComponent,
      componentProps: { isGroup: false } // We use private mode to pick ONE person to add
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data && data.user) {
      const newUser = data.user;
      
      // Update the group in Firestore
      const chatId = this.chat.id;
      const memberObj = {
        uid: newUser.uid,
        displayName: newUser.displayName || newUser.email,
        photoURL: newUser.photoURL || ''
      };

      await this.cs.updateGroupMembers(chatId, newUser.uid, memberObj);
      this.utilsService.presentToast(`${newUser.displayName} added to group`);
    }
  }

  ngOnInit() {
    this.auth.user$.pipe(takeUntil(this.destroyed$)).subscribe(user => {
      this.currentUser = user;
      console.log('Current User Chat:', user);
    });
    VoiceRecorder.requestAudioRecordingPermission();
    const chatId = this.route.snapshot.paramMap.get('chatId');
    const source$ = this.cs.get(chatId);
    this.utilsService.presentLoading();
    this.cs
      .joinUsers(source$)
      .pipe(takeUntil(this.destroyed$))
      .subscribe(
        (res) => {
          console.log('DEBUG: Chat data received:', res);
          if (res?.messages) {
            console.log('DEBUG: Last message object:', res.messages[res.messages.length - 1]);
          }
          this.chat = res;
          this.utilsService.dismissLoader();
        },
        (err) => {
          console.error('DEBUG: Chat join error:', err);
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

    if (this.recordBtn?.nativeElement) {
      const longPress = this.gestureCtrl.create(
        {
          el: this.recordBtn.nativeElement,
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
  }

  submit(chat: any) {
    const trimmedMsg = this.newMsg?.trim();
    if (!trimmedMsg && !this.newRecording) {
      return;
    }

    if (chat?.type === 'group') {
      this.handleGroupChatSubmit(chat, trimmedMsg);
    } else {
      this.handleDirectChatSubmit(chat, trimmedMsg);
    }
  }

  handleGroupChatSubmit(chat: any, content: string) {
    this.usersService.getUsers().pipe(take(1)).subscribe((res: any) => {
      const users = this.mapUsers(res);
      const groupMembers = this.filterGroupMembers(users, chat);

      this.sendMessageToGroup(chat, groupMembers, content);
      this.resetMessage();
      this.scrollBottom();
      this.updateChat(chat);
    });
  }

  handleDirectChatSubmit(chat: any, content: string) {
    this.sendMessageToDirectChat(chat, content);
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

  filterGroupMembers(users: any[], chat: any) {
    return users.filter((element) => chat?.hasRead?.hasOwnProperty(element?.uid));
  }

  sendMessageToGroup(chat: any, groupMembers: any[], content: string) {
    if (this.newRecording) {
      this.cs.sendMessage(chat.id, this.newRecording, chat?.uid, groupMembers, 'audio');
    } else {
      this.cs.sendMessage(chat.id, content, chat?.uid, groupMembers);
    }
  }

  async sendMessageToDirectChat(chat: any, content: string) {
    const user = await this.auth.getUser();
    const recipient = chat.uids ? chat.uids.find((u) => u !== user.uid) : chat.uid;
    
    if (this.newRecording) {
      this.cs.sendMessage(chat.id, this.newRecording, recipient, null, 'audio');
    } else {
      this.cs.sendMessage(chat.id, content, recipient);
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
      if (this.content && this.content.scrollToBottom) {
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

  triggerFileSelect() {
    const fileInput = document.getElementById('chat-file-input') as HTMLInputElement;
    fileInput.click();
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file || !this.chat) return;

    this.utilsService.presentLoading('Uploading image...');
    try {
      const url = await this.fileStorageService.uploadFile(file);
      const user = await this.auth.getUser();
      
      if (this.chat.type === 'group') {
        const groupMembers = this.filterGroupMembers([], this.chat); // simplify for now, the service handles the list
        await this.cs.sendMessage(this.chat.id, url, user.uid, groupMembers, 'image');
      } else {
        const recipient = this.chat.uids ? this.chat.uids.find((u) => u !== user.uid) : this.chat.uid;
        await this.cs.sendMessage(this.chat.id, url, recipient, null, 'image');
      }
      
      this.utilsService.dismissLoader();
    } catch (error) {
      console.error('Upload error:', error);
      this.utilsService.dismissLoader();
      this.utilsService.presentToast('Failed to upload image');
    }
  }
}
