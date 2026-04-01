import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { BehaviorSubject, Observable, combineLatest, map } from 'rxjs';
import { UsersService } from 'src/app/services/users.service';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-user-selection',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule],
  template: `
    <ion-header>
      <ion-toolbar color="light">
        <ion-title>{{ isGroup ? 'Assemble Your Team' : 'Start Private Chat' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()" color="primary">Close</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Group Details -->
      <div class="group-settings" *ngIf="isGroup">
        <div class="input-card">
          <ion-label>GROUP NAME</ion-label>
          <ion-item lines="none" class="name-input">
            <ion-input
              [(ngModel)]="groupName"
              placeholder="e.g. Dream Team"
              clearInput
            ></ion-input>
          </ion-item>
        </div>
      </div>

      <div class="search-container">
        <ion-searchbar
          animated="true"
          placeholder="Search by name or email"
          (ionInput)="handleSearch($event)"
          mode="ios"
        ></ion-searchbar>
      </div>

      <ion-list lines="none">
        <ion-item 
          *ngFor="let user of filteredUsers$ | async" 
          button 
          (click)="onUserClick(user)" 
          class="user-item"
          [class.selected]="isSelected(user)"
        >
          <div class="avatar-shell" slot="start">
             <img *ngIf="user.photoURL" [src]="user.photoURL" />
             <div class="initials" *ngIf="!user.photoURL">{{ getInitials(user.displayName) }}</div>
          </div>
          <ion-label>
            <h2 style="font-weight: 600;">{{ user.displayName || 'Unnamed User' }}</h2>
            <p style="font-size: 0.85rem; opacity: 0.7;">{{ user.email || 'No email' }}</p>
          </ion-label>
          
          <!-- State Indicator -->
          <ion-checkbox 
            slot="end" 
            *ngIf="isGroup" 
            [checked]="isSelected(user)"
            (ionChange)="toggleUser($event, user)"
            (click)="$event.stopPropagation()"
          ></ion-checkbox>
          <ion-icon 
            name="chevron-forward-outline" 
            slot="end" 
            *ngIf="!isGroup"
            style="font-size: 1.1rem; opacity: 0.3;"
          ></ion-icon>
        </ion-item>
      </ion-list>
      
      <div *ngIf="(filteredUsers$ | async)?.length === 0" class="ion-text-center ion-padding empty-state">
        <ion-icon name="search-outline" style="font-size: 3rem; opacity: 0.2;"></ion-icon>
        <p style="opacity: 0.5; margin-top: 0.5rem;">No matches found for your search.</p>
      </div>
    </ion-content>

    <ion-footer *ngIf="isGroup" class="ion-no-border">
      <ion-toolbar class="footer-toolbar">
        <div class="selected-count" *ngIf="selectedUsers.length > 0">
          {{ selectedUsers.length }} members selected
        </div>
        <ion-button 
          expand="block" 
          class="create-btn" 
          (click)="createGroup()"
          [disabled]="!groupName || selectedUsers.length === 0"
        >
          CREATE GROUP
        </ion-button>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: [`
    ion-content { --background: #f8fafc; }
    .group-settings { margin-bottom: 2rem; }
    .input-card {
      background: white;
      padding: 1rem;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
      
      ion-label {
        font-size: 0.7rem;
        font-weight: 800;
        color: #64748b;
        letter-spacing: 0.05em;
        margin-bottom: 0.5rem;
        display: block;
      }
    }
    .name-input {
      --background: #f1f5f9;
      --border-radius: 12px;
      margin-top: 0.5rem;
      font-weight: 600;
    }
    .search-container {
      margin-bottom: 1rem;
      ion-searchbar { --box-shadow: none; --background: white; }
    }
    .user-item {
      margin-bottom: 0.75rem;
      --border-radius: 16px;
      --background: white;
      &.selected { --background: #f0f9ff; border: 1px solid #bae6fd; }
    }
    .avatar-shell {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      .initials { font-weight: 700; color: #0369a1; }
    }
    .footer-toolbar {
      padding: 1rem 1rem 1.5rem;
      --background: #fff;
      border-top: 1px solid #e2e8f0;
    }
    .create-btn {
      --border-radius: 12px;
      --background: #0284c7;
      --background-hover: #0369a1;
      height: 52px;
      font-weight: 700;
      margin: 0;
      font-size: 0.95rem;
      letter-spacing: 0.025em;
    }
    .selected-count {
      text-align: center;
      font-size: 0.75rem;
      font-weight: 800;
      color: #0369a1;
      margin-bottom: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  `]
})
export class UserSelectionComponent implements OnInit {
  isGroup: boolean = false;
  groupName: string = '';
  selectedUsers: any[] = [];
  
  users$: Observable<any>;
  filteredUsers$: Observable<any>;
  private searchSubject = new BehaviorSubject<string>('');

  constructor(
    private modalController: ModalController,
    private usersService: UsersService,
    private auth: AuthenticationService
  ) {}

  ngOnInit() {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    
    this.users$ = this.usersService.getUsers().pipe(
      map(actions => actions.map(a => {
        const data: any = a.payload.doc.data();
        const id = a.payload.doc.id;
        return { id, ...data };
      })),
      // Filter out current user from selection
      map(users => users.filter(u => u.uid !== currentUser?.uid))
    );

    this.filteredUsers$ = combineLatest([this.users$, this.searchSubject]).pipe(
      map(([users, searchTerm]) => {
        if (!searchTerm) return users;
        const term = searchTerm.toLowerCase();
        return users.filter(user => 
          user.displayName?.toLowerCase().includes(term) || 
          user.email?.toLowerCase().includes(term)
        );
      })
    );
  }

  handleSearch(event: any) {
    const value = event.detail.value;
    this.searchSubject.next(value || '');
  }

  getInitials(name: string) {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  }

  dismiss() {
    this.modalController.dismiss();
  }

  onUserClick(user: any) {
    if (this.isGroup) {
      this.toggleUserSelection(user);
    } else {
      this.modalController.dismiss({ user, mode: 'private' });
    }
  }

  isSelected(user: any) {
    return this.selectedUsers.some(u => u.uid === user.uid);
  }

  toggleUser(event: any, user: any) {
    this.toggleUserSelection(user);
  }

  toggleUserSelection(user: any) {
    const index = this.selectedUsers.findIndex(u => u.uid === user.uid);
    if (index > -1) {
      this.selectedUsers.splice(index, 1);
    } else {
      this.selectedUsers.push(user);
    }
  }

  createGroup() {
    if (this.groupName && this.selectedUsers.length > 0) {
      this.modalController.dismiss({ 
        name: this.groupName, 
        members: this.selectedUsers,
        mode: 'group' 
      });
    }
  }
}
