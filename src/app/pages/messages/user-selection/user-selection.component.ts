import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { BehaviorSubject, Observable, combineLatest, map } from 'rxjs';
import { UsersService } from 'src/app/services/users.service';
import { AuthenticationService } from 'src/app/services/authentication.service';

@Component({
  selector: 'app-user-selection',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
    <ion-header>
      <ion-toolbar color="light">
        <ion-title>Start Private Chat</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()" color="primary" style="font-weight: 600;">Close</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="search-container">
        <ion-searchbar
          animated="true"
          placeholder="Search by name or email"
          (ionInput)="handleSearch($event)"
          mode="ios"
        ></ion-searchbar>
      </div>

      <ion-list lines="none">
        <ion-item *ngFor="let user of filteredUsers$ | async" button (click)="selectUser(user)" class="user-item">
          <div class="avatar-shell" slot="start">
             <img *ngIf="user.photoURL" [src]="user.photoURL" />
             <div class="initials" *ngIf="!user.photoURL">{{ getInitials(user.displayName) }}</div>
          </div>
          <ion-label>
            <h2 style="font-weight: 600;">{{ user.displayName || 'Unnamed User' }}</h2>
            <p style="font-size: 0.85rem; opacity: 0.7;">{{ user.email || 'No email' }}</p>
          </ion-label>
          <ion-icon name="chevron-forward-outline" slot="end" style="font-size: 1.1rem; opacity: 0.3;"></ion-icon>
        </ion-item>
      </ion-list>
      <div *ngIf="(filteredUsers$ | async)?.length === 0" class="ion-text-center ion-padding empty-state">
        <ion-icon name="search-outline" style="font-size: 3rem; opacity: 0.2;"></ion-icon>
        <p style="opacity: 0.5; margin-top: 0.5rem;">No matches found for your search.</p>
      </div>
    </ion-content>
  `,
  styles: [`
    ion-content {
      --background: white;
    }
    .search-container {
      position: sticky;
      top: -16px;
      z-index: 100;
      background: white;
      margin: -16px -16px 16px;
      padding: 8px 8px 4px;
      border-bottom: 1px solid rgba(0,0,0,0.05);
    }
    .user-item {
      --padding-start: 8px;
      --padding-end: 8px;
      margin-bottom: 8px;
      --border-radius: 12px;
      --background: rgba(var(--ion-color-primary-rgb, 15, 99, 255), 0.03);
      --inner-padding-end: 8px;
    }
    .avatar-shell {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(var(--ion-color-primary-rgb, 15, 99, 255), 0.1);
      
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .initials {
        font-weight: 700;
        color: var(--ion-color-primary, #0f63ff);
        font-size: 1.1rem;
      }
    }
    .empty-state {
      margin-top: 4rem;
    }
    ion-searchbar {
      --box-shadow: none;
      --background: #f4f5f8;
      padding: 0;
    }
  `]
})
export class UserSelectionComponent implements OnInit {
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

  selectUser(user: any) {
    this.modalController.dismiss(user);
  }
}
