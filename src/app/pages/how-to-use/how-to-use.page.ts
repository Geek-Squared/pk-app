import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  sparkles,
  flash,
  book,
  chatbubbles,
  calendar,
  heartCircle,
} from 'ionicons/icons';

interface HowToSlide {
  icon: string;
  title: string;
  body: string;
}

export const HOW_TO_SEEN_KEY = 'pkHowToSeen';

@Component({
  selector: 'app-how-to-use',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './how-to-use.page.html',
  styleUrls: ['./how-to-use.page.scss'],
})
export class HowToUsePage {
  @ViewChild('track') track?: ElementRef<HTMLDivElement>;

  current = 0;

  readonly slides: HowToSlide[] = [
    {
      icon: 'heart-circle',
      title: 'Welcome to Positive Konnections',
      body: 'A private, supportive space for your mental wellbeing. Here’s a quick tour of what you can do.',
    },
    {
      icon: 'flash',
      title: 'Start Interventions',
      body: 'Work through guided interventions — short, practical techniques for stress, anxiety, low mood and more. Begin or continue a session right from Home.',
    },
    {
      icon: 'book',
      title: 'Your Workbook',
      body: 'Reflect on each chapter, answer story questions and track your progress. Your reflections are saved privately and help unlock the next steps.',
    },
    {
      icon: 'chatbubbles',
      title: 'Messages & Counsellors',
      body: 'Connect with your care team, join community spaces, or request a counsellor whenever you need to talk to someone.',
    },
    {
      icon: 'sparkles',
      title: 'Meet Peekay',
      body: 'Peekay is your AI support guide — available any time for grounding, reflection and a listening ear. If things feel heavy, it can connect you to a counsellor.',
    },
    {
      icon: 'calendar',
      title: 'Bookings & Referrals',
      body: 'Schedule sessions, manage appointments, and find trusted resources and referrals when you need extra support.',
    },
  ];

  constructor(private navCtrl: NavController) {
    addIcons({ sparkles, flash, book, chatbubbles, calendar, heartCircle });
  }

  get isLast(): boolean {
    return this.current >= this.slides.length - 1;
  }

  onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (el.clientWidth > 0) {
      this.current = Math.round(el.scrollLeft / el.clientWidth);
    }
  }

  goTo(index: number): void {
    const el = this.track?.nativeElement;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * index, behavior: 'smooth' });
    this.current = index;
  }

  next(): void {
    if (this.isLast) {
      this.finish();
    } else {
      this.goTo(this.current + 1);
    }
  }

  finish(): void {
    try {
      localStorage.setItem(HOW_TO_SEEN_KEY, 'true');
    } catch {
      // ignore storage errors
    }
    this.navCtrl.navigateRoot('/home');
  }
}
