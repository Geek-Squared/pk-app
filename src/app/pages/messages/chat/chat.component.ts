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
import { IonicModule, GestureController, ActionSheetController, PopoverController } from '@ionic/angular';
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
import { ReactionPickerComponent } from 'src/app/components/reaction-picker/reaction-picker.component';
import { VoiceNoteComponent } from 'src/app/components/voice-note/voice-note.component';
import { EmojiPickerComponent } from 'src/app/components/emoji-picker/emoji-picker.component';
import { TitleService } from 'src/app/services/title.service';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, BackButtonComponent, VoiceNoteComponent, EmojiPickerComponent, ReactionPickerComponent]
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
    private modalController: ModalController,
    private titleService: TitleService,
    private actionSheetCtrl: ActionSheetController,
    private popoverCtrl: PopoverController
  ) {}

  async openReactionPicker(event: any, msg: any) {
    if (!this.selectedChat?.id || !msg) return;

    const popover = await this.popoverCtrl.create({
      component: ReactionPickerComponent,
      event: event,
      translucent: true,
      cssClass: 'reaction-popover',
      side: 'top',
      alignment: 'center'
    });

    await popover.present();

    // Haptic feedback for "opening"
    await Haptics.impact({ style: ImpactStyle.Light });

    const { data } = await popover.onDidDismiss();
    if (data) {
      await this.cs.reactToMessage(this.selectedChat.id, msg, data, this.currentUser.uid);
      // Haptic feedback for "reacting"
      await Haptics.impact({ style: ImpactStyle.Medium });
    }
  }

  getReactionGroups(reactions: any[]) {
    if (!reactions || !reactions.length) return [];
    
    const groups: any = {};
    reactions.forEach(r => {
      groups[r.emoji] = (groups[r.emoji] || 0) + 1;
    });
    
    return Object.keys(groups).map(emoji => ({
      emoji,
      count: groups[emoji]
    }));
  }

  async openEmojiPicker(event: any) {
    const modal = await this.modalController.create({
      component: EmojiPickerComponent,
      breakpoints: [0, 0.4],
      initialBreakpoint: 0.4,
      cssClass: 'emoji-modal',
      handle: true
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    if (data) {
      this.newMsg = (this.newMsg || '') + data;
    }
  }

  async presentMessageOptions(event: any, msg: any) {
    // Only allow deletion of own messages for now
    if (msg.uid !== this.currentUser?.uid) return;

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Message Options',
      buttons: [
        {
          text: 'Delete Message',
          role: 'destructive',
          icon: 'trash-outline',
          handler: () => {
            this.deleteOneMessage(msg);
          }
        },
        {
          text: 'Cancel',
          role: 'cancel',
          icon: 'close-outline'
        }
      ]
    });

    await actionSheet.present();
  }

  async presentAttachmentOptions() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Attach',
      buttons: [
        {
          text: 'Image',
          icon: 'image-outline',
          handler: () => {
            this.triggerFileSelect();
          }
        },
        {
          text: 'Video',
          icon: 'videocam-outline',
          handler: () => {
            this.utilsService.presentToast('Video uploads coming soon');
          }
        },
        {
          text: 'Cancel',
          role: 'cancel',
          icon: 'close'
        }
      ]
    });

    await actionSheet.present();
  }

  async deleteOneMessage(msg: any) {
    this.utilsService.presentLoading('Deleting message...');
    try {
      await this.cs.deleteMessage(this.chat.id, msg);
      this.utilsService.dismissLoader();
      this.utilsService.presentToast('Message deleted');
    } catch (err) {
      console.error('Delete error:', err);
      this.utilsService.dismissLoader();
      this.utilsService.presentToast('Failed to delete message');
    }
  }

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
          this.titleService.setTitle(this.chat?.recipientName || this.chat?.displayName || 'Chat');
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

  async submit(chat: any) {
    const trimmedMsg = this.newMsg?.trim();
    if (!trimmedMsg && !this.newRecording) {
      return;
    }

    if (chat?.type === 'group') {
      await this.handleGroupChatSubmit(chat, trimmedMsg);
    } else {
      await this.handleDirectChatSubmit(chat, trimmedMsg);
    }
  }

  async handleGroupChatSubmit(chat: any, content: string) {
    this.usersService.getUsers().pipe(take(1)).subscribe(async (res: any) => {
      const users = this.mapUsers(res);
      const groupMembers = this.filterGroupMembers(users, chat);

      await this.sendMessageToGroup(chat, groupMembers, content);
      this.resetMessage();
      this.scrollBottom();
      this.updateChat(chat);
    });
  }

  async handleDirectChatSubmit(chat: any, content: string) {
    await this.sendMessageToDirectChat(chat, content);
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

  private recordingInterval: any;

  async startRecording() {
    if (this.recording) return;

    const { value } = await VoiceRecorder.hasAudioRecordingPermission();
    if (!value) {
      const result = await VoiceRecorder.requestAudioRecordingPermission();
      if (!result.value) {
        this.utilsService.presentToast('Microphone permission is required to record voice notes.');
        return;
      }
    }

    this.recording = true;
    this.duration = 0;
    this.durationDisplay = '0:00';
    
    Haptics.impact({ style: ImpactStyle.Medium });

    VoiceRecorder.startRecording()
      .then(() => {
        this.recordingInterval = setInterval(() => {
          this.calculateDuration();
        }, 1000);
      })
      .catch(err => {
        this.recording = false;
        console.error('Recording error', err);
      });
  }

  async stopRecording() {
    if (!this.recording) return;

    this.recording = false;
    clearInterval(this.recordingInterval);
    
    Haptics.impact({ style: ImpactStyle.Light });

    try {
      const res: RecordingData = await VoiceRecorder.stopRecording();
      if (res.value && res.value.recordDataBase64) {
        if (this.duration < 1) {
          // Message too short
          return;
        }
        
        this.utilsService.presentLoading('Sending voice note...');
        const downloadUrl = await this.fileStorageService.pushFileToStorage(
          res.value.recordDataBase64, 
          `voice_${new Date().getTime().toString()}`
        );
        this.newRecording = downloadUrl;
        await this.submit(this.chat);
        this.utilsService.dismissLoader();
      }
    } catch (err) {
      console.error('Error stopping recording', err);
      this.utilsService.dismissLoader();
    } finally {
      this.duration = 0;
      this.durationDisplay = '';
    }
  }

  async cancelRecording() {
    if (!this.recording) return;
    
    this.recording = false;
    clearInterval(this.recordingInterval);
    Haptics.notification({ type: ImpactStyle.Medium as any });
    
    try {
      await VoiceRecorder.stopRecording();
      this.duration = 0;
      this.durationDisplay = '';
      this.newRecording = null;
    } catch (err) {
      console.error('Error cancelling recording', err);
    }
  }

  calculateDuration() {
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
