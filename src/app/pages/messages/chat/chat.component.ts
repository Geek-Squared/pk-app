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
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { FileStorageService } from 'src/app/services/file-storage.service';
import { UtilitiesService } from 'src/app/services/utilities.service';
import { BackButtonComponent } from 'src/app/components/back-button/back-button.component';
import { ModalController } from '@ionic/angular';
import { UserSelectionComponent } from '../user-selection/user-selection.component';
import { ReactionPickerComponent } from 'src/app/components/reaction-picker/reaction-picker.component';
import { VoiceNoteComponent } from 'src/app/components/voice-note/voice-note.component';
import { EmojiPickerComponent } from 'src/app/components/emoji-picker/emoji-picker.component';
import { TitleService } from 'src/app/services/title.service';
import { GroupDetailsComponent } from './group-details/group-details.component';

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
  private recipientPresenceUid: string | null = null;
  private recipientUid: string | null = null;
  private recipientProfileSub: Subscription | null = null;
  public isCounsellor = false;
  // Only counsellors and administrators may add members to a group.
  public canManageGroupMembers = false;
  public pendingForMe = false;
  public sessionBannerText: string | null = null;

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

  public async openGroupDetails(): Promise<void> {
    if (this.chat?.type !== 'group') return;
    const currentUid =
      this.currentUser?.uid || JSON.parse(localStorage.getItem('user'))?.uid || null;

    const modal = await this.modalController.create({
      component: GroupDetailsComponent,
      componentProps: { chat: this.chat, chatId: this.chat?.id || null, currentUid },
      breakpoints: [0, 0.6, 0.9],
      initialBreakpoint: 0.9,
      cssClass: 'group-details-modal',
    });

    await modal.present();
  }

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

  async presentChatOptions() {
    if (!this.chat?.id) {
      return;
    }

    const isGroup = this.chat?.type === 'group';
    const buttons: any[] = [];

    const currentUid =
      this.currentUser?.uid || JSON.parse(localStorage.getItem('user'))?.uid;

    // Only counsellors/administrators can add members to a group.
    if (isGroup && this.canManageGroupMembers) {
      buttons.push({
        text: 'Add members',
        icon: 'person-add-outline',
        handler: async () => {
          try {
            await this.addMember();
          } catch (err) {
            console.error('Add members failed:', err);
          }
        },
      });
    }

    if (!isGroup && currentUid && this.recipientUid) {
      const me: any = await new Promise((resolve) => {
        this.usersService
          .getUserById(currentUid)
          .pipe(take(1))
          .subscribe((u) => resolve(u || null));
      });

      const blockedUids: string[] = Array.isArray(me?.blockedUids)
        ? me.blockedUids
        : [];
      const isBlocked = blockedUids.includes(this.recipientUid);

      if (isBlocked) {
        buttons.push({
          text: 'Unblock user',
          icon: 'checkmark-circle-outline',
          handler: async () => {
            this.utilsService.presentLoading('Unblocking user...');
            try {
              await this.usersService.unblockUser(currentUid, this.recipientUid!);
              this.utilsService.dismissLoader();
              this.utilsService.presentToast('User unblocked');
            } catch (err) {
              console.error('Unblock user failed:', err);
              this.utilsService.dismissLoader();
              this.utilsService.presentToast('Failed to unblock user');
            }
          },
        });
      } else {
        buttons.push({
          text: 'Block user',
          role: 'destructive',
          icon: 'ban-outline',
          handler: async () => {
            this.utilsService.presentLoading('Blocking user...');
            try {
              await this.usersService.blockUser(currentUid, this.recipientUid!);
              this.utilsService.dismissLoader();
              this.utilsService.presentToast('User blocked');
            } catch (err) {
              console.error('Block user failed:', err);
              this.utilsService.dismissLoader();
              this.utilsService.presentToast('Failed to block user');
            }
          },
        });
      }
    }

    const isGroupCreator =
      !!currentUid &&
      (this.chat?.createdBy === currentUid ||
        this.chat?.uid === currentUid ||
        this.chat?.ownerUid === currentUid ||
        (Array.isArray(this.chat?.members) &&
          this.chat.members.length &&
          this.chat.members[0]?.uid === currentUid));

    if (!isGroup) {
      buttons.push({
        text: 'Delete chat',
        role: 'destructive',
        icon: 'trash-outline',
        handler: async () => {
          this.utilsService.presentLoading('Deleting...');
          try {
            await this.cs.deleteChat(this.chat.id);
            this.utilsService.dismissLoader();
            window.history.back();
          } catch (err) {
            console.error('Delete chat failed:', err);
            this.utilsService.dismissLoader();
            this.utilsService.presentToast('Failed to delete');
          }
        },
      });
    } else if (isGroupCreator) {
      buttons.push({
        text: 'Delete group',
        role: 'destructive',
        icon: 'trash-outline',
        handler: async () => {
          this.utilsService.presentLoading('Deleting...');
          try {
            await this.cs.deleteChat(this.chat.id);
            this.utilsService.dismissLoader();
            window.history.back();
          } catch (err) {
            console.error('Delete group failed:', err);
            this.utilsService.dismissLoader();
            this.utilsService.presentToast('Failed to delete');
          }
        },
      });
    }

    buttons.push({
      text: 'Cancel',
      role: 'cancel',
      icon: 'close-outline',
    });

    const sheet = await this.actionSheetCtrl.create({
      header: 'Options',
      buttons,
    });

    await sheet.present();
  }

  async presentAttachmentOptions() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Attach',
      buttons: [
        {
          text: 'Camera',
          icon: 'camera-outline',
          handler: () => {
            // Return false to keep sheet open while async runs
            setTimeout(() => this.takePhoto(), 100);
            return false;
          }
        },
        {
          text: 'Photo / Video from Gallery',
          icon: 'image-outline',
          handler: () => {
            const fileInput = document.getElementById('chat-file-input') as HTMLInputElement;
            fileInput.accept = 'image/*,video/*';
            fileInput.click();
          }
        },
        {
          text: 'File',
          icon: 'document-outline',
          handler: () => {
            const fileInput = document.getElementById('chat-file-input') as HTMLInputElement;
            fileInput.accept = 'application/pdf,.doc,.docx,.xls,.xlsx,.txt';
            fileInput.click();
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

  async takePhoto() {
    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
      });

      if (!photo.base64String) return;

      this.utilsService.presentLoading('Uploading photo...');
      const mimeType = `image/${photo.format || 'jpeg'}`;
      const url = await this.fileStorageService.uploadBase64(photo.base64String, mimeType);
      await this.sendMediaMessage(url, 'image');
      this.utilsService.dismissLoader();
    } catch (err: any) {
      this.utilsService.dismissLoader();
      if (err?.message !== 'User cancelled photos app') {
        console.error('Camera error:', err);
        this.utilsService.presentToast('Camera error. Please try again.');
      }
    }
  }

  private async sendMediaMessage(url: string, type: 'image' | 'video' | 'file') {
    const user = await this.auth.getUser();
    if (this.chat.type === 'group') {
      const groupMembers = this.filterGroupMembers([], this.chat);
      await this.cs.sendMessage(this.chat.id, url, user.uid, groupMembers, type);
    } else {
      const recipient = this.chat.uids ? this.chat.uids.find((u) => u !== user.uid) : this.chat.uid;
      await this.cs.sendMessage(this.chat.id, url, recipient, null, type);
    }
    this.scrollBottom();
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
    // Defense in depth: never allow non-counsellor/admin to add group members.
    if (!this.canManageGroupMembers) {
      this.utilsService.presentToast('Only counsellors and administrators can add members.');
      return;
    }

    const modal = await this.modalController.create({
      component: UserSelectionComponent,
      componentProps: { isGroup: false } // We use private mode to pick ONE person to add
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data && data.user) {
      const newUser = data.user;
      const newUid: string | null =
        typeof newUser?.uid === 'string'
          ? newUser.uid
          : typeof newUser?.id === 'string'
            ? newUser.id
            : null;

      if (!newUid) {
        this.utilsService.presentToast('Could not add member (missing user id)');
        return;
      }
      
      // Update the group in Firestore
      const chatId = this.chat.id;
      const memberObj = {
        uid: newUid,
        displayName: newUser.displayName || newUser.email || 'Member',
        photoURL: newUser.photoURL || ''
      };

      this.utilsService.presentLoading('Adding member...');
      try {
        await this.cs.updateGroupMembers(chatId, newUid, memberObj);
        this.utilsService.dismissLoader();
        this.utilsService.presentToast(`${memberObj.displayName} added to group`);
      } catch (err) {
        console.error('Add member failed:', err);
        this.utilsService.dismissLoader();
        this.utilsService.presentToast('Failed to add member');
      }
    }
  }

  ngOnInit() {
    this.auth.user$.pipe(takeUntil(this.destroyed$)).subscribe(user => {
      this.currentUser = user;
      const role =
        typeof user?.role === 'string'
          ? user.role
          : typeof user?.role?.name === 'string'
            ? user.role.name
            : '';
      const roleLower = `${role || ''}`.toLowerCase();
      this.isCounsellor = roleLower === 'counsellor';
      this.canManageGroupMembers =
        roleLower === 'counsellor' || roleLower === 'administrator';
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
          this.recipientUid = this.resolveRecipientUid(res);
          this.bindRecipientProfile(this.recipientUid, res);
          this.watchRecipientPresence(res);
          this.titleService.setTitle(this.chat?.recipientName || this.chat?.displayName || 'Chat');
          this.pendingForMe =
            this.isCounsellor === true &&
            `${res?.status || res?.request?.status || ''}`.toLowerCase() === 'pending' &&
            (res?.request?.counsellorUid ? res.request.counsellorUid === this.currentUser?.uid : true);

          this.sessionBannerText = this.buildSessionBannerText(res);
          this.utilsService.dismissLoader();
        },
        (err) => {
          console.error('DEBUG: Chat join error:', err);
          this.utilsService.dismissLoader();
        }
      );

    this.scrollBottom();

    // Request mic permission proactively so Android doesn't ask on first record tap
    this.requestMicPermission();
  }

  private buildSessionBannerText(chat: any): string | null {
    const req = chat?.request || null;
    if (!req || !this.currentUser?.uid) return null;

    const status = `${chat?.status || req?.status || ''}`.toLowerCase();
    const me = this.currentUser.uid;

    const isMeCounsellor = req?.counsellorUid === me;
    const isMeRequester = req?.requesterUid === me;

    const counsellorName = req?.counsellorName || 'Counsellor';
    const requesterName = req?.requesterName || 'User';

    if (status === 'pending') {
      if (isMeCounsellor) return `New request from ${requesterName}.`;
      if (isMeRequester) return `Request sent to ${counsellorName}.`;
      return 'Counselling request pending.';
    }

    if (status === 'active') {
      if (isMeCounsellor) return `You are now chatting with ${requesterName}.`;
      if (isMeRequester) return `You are now chatting with ${counsellorName}.`;
      return 'Counselling session started.';
    }

    return null;
  }

  public async acceptRequest(): Promise<void> {
    if (!this.chat?.id || !this.currentUser?.uid) return;
    this.utilsService.presentLoading('Accepting...');
    try {
      await this.cs.acceptCounsellorRequest(this.chat.id, this.currentUser.uid);
      this.utilsService.dismissLoader();
      this.pendingForMe = false;
      this.utilsService.presentToast('Session accepted');
    } catch (err) {
      console.error('Accept request failed:', err);
      this.utilsService.dismissLoader();
      this.utilsService.presentToast('Failed to accept');
    }
  }

  public async declineRequest(): Promise<void> {
    if (!this.chat?.id || !this.currentUser?.uid) return;
    this.utilsService.presentLoading('Declining...');
    try {
      await this.cs.declineCounsellorRequest(this.chat.id, this.currentUser.uid);
      this.utilsService.dismissLoader();
      this.pendingForMe = false;
      window.history.back();
    } catch (err) {
      console.error('Decline request failed:', err);
      this.utilsService.dismissLoader();
      this.utilsService.presentToast('Failed to decline');
    }
  }

  private bindRecipientProfile(recipientUid: string | null, chat: any): void {
    try {
      if (!recipientUid || chat?.type === 'group') return;

      // Ensure we don't accumulate subscriptions if the view is reused.
      this.recipientProfileSub?.unsubscribe();
      this.recipientProfileSub = this.usersService
        .getUserById(recipientUid)
        .pipe(takeUntil(this.destroyed$))
        .subscribe((u: any) => {
          if (!u) return;
          const name = u?.displayName || u?.email || null;
          const photo = u?.photoURL || u?.photoUrl || null;
          const online = u?.isOnline === true;

          // Update the header fields to reflect the *other* participant.
          if (name) {
            this.chat.recipientName = name;
          }
          this.chat.recipientPhoto = photo;
          this.chat.recipientOnline = online;

          this.titleService.setTitle(name || this.chat?.displayName || 'Chat');

          // Session banner depends on names; recompute once we have profile info.
          this.sessionBannerText = this.buildSessionBannerText(this.chat);
        });
    } catch (err) {
      // Non-fatal: header will fall back to whatever is in the chat doc.
      console.warn('bindRecipientProfile failed:', err);
    }
  }

  private resolveRecipientUid(chat: any): string | null {
    if (!chat || chat?.type === 'group') {
      return null;
    }
    const currentUid =
      this.currentUser?.uid || JSON.parse(localStorage.getItem('user'))?.uid;
    const recipientUid = chat?.uids?.find((uid: string) => uid !== currentUid);
    return recipientUid || null;
  }

  private async requestMicPermission() {
    try {
      const { value } = await VoiceRecorder.hasAudioRecordingPermission();
      if (!value) {
        await VoiceRecorder.requestAudioRecordingPermission();
      }
    } catch (e) {
      // Not available on web/desktop — safely ignore
    }
  }

  ionViewWillEnter() {
    this.scrollBottom();
  }

  ngAfterViewInit(): void {
    // Gesture controller removed — recording is now tap-to-toggle via toggleRecording()
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

  private watchRecipientPresence(chat: any): void {
    const currentUid =
      this.currentUser?.uid || JSON.parse(localStorage.getItem('user'))?.uid;
    if (!chat || chat?.type === 'group' || !currentUid) {
      return;
    }

    const recipientUid = chat.uids?.find((uid) => uid !== currentUid);
    if (!recipientUid || recipientUid === this.recipientPresenceUid) {
      return;
    }

    this.recipientPresenceUid = recipientUid;
    this.usersSubscription.unsubscribe();
    this.usersSubscription = this.usersService
      .getUserById(recipientUid)
      .subscribe((user: any) => {
        this.chat = {
          ...this.chat,
          recipientOnline: user?.isOnline === true,
        };
      });
  }

  ngOnDestroy() {
    this.recipientProfileSub?.unsubscribe();
    this.usersSubscription.unsubscribe();
    this.updateChatUnread();
    this.destroyed$.next(true);
    this.destroyed$.complete();
  }

  private recordingInterval: any;

  // Tap once to start, tap again to stop & send
  async toggleRecording() {
    if (this.recording) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

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

    // Determine message type from MIME
    let msgType: 'image' | 'video' | 'file' = 'file';
    if (file.type.startsWith('image/')) msgType = 'image';
    else if (file.type.startsWith('video/')) msgType = 'video';

    const loadingMsg = msgType === 'video' ? 'Uploading video...'
                     : msgType === 'image' ? 'Uploading image...'
                     : 'Uploading file...';

    this.utilsService.presentLoading(loadingMsg);
    try {
      const url = await this.fileStorageService.uploadFile(file);
      await this.sendMediaMessage(url, msgType);
      this.utilsService.dismissLoader();
      (event.target as HTMLInputElement).value = '';
    } catch (error: any) {
      console.error('Upload error:', error);
      this.utilsService.dismissLoader();
      this.utilsService.presentToast(`Upload failed: ${error?.message || 'Check Firebase Storage rules'}`);
    }
  }
}
