import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-voice-note',
  templateUrl: './voice-note.component.html',
  styleUrls: ['./voice-note.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class VoiceNoteComponent implements OnInit, OnDestroy {
  @Input() url: string;
  @Input() isSender: boolean = false;
  
  audio: HTMLAudioElement;
  isPlaying: boolean = false;
  progress: number = 0;
  duration: string = '0:00';
  currentTime: string = '0:00';

  constructor() {}

  ngOnInit() {
    if (this.url) {
      this.audio = new Audio(this.url);
      
      this.audio.onloadedmetadata = () => {
        this.duration = this.formatTime(this.audio.duration);
      };

      this.audio.ontimeupdate = () => {
        this.progress = (this.audio.currentTime / this.audio.duration) * 100;
        this.currentTime = this.formatTime(this.audio.currentTime);
      };

      this.audio.onended = () => {
        this.isPlaying = false;
        this.progress = 0;
        this.currentTime = '0:00';
      };
      
      this.audio.onpause = () => {
        this.isPlaying = false;
      };
      
      this.audio.onplay = () => {
        this.isPlaying = true;
      };
    }
  }

  togglePlay() {
    if (!this.audio) return;
    
    if (this.isPlaying) {
      this.audio.pause();
    } else {
      this.audio.play().catch(err => console.error('Error playing audio:', err));
    }
  }

  private formatTime(seconds: number): string {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  ngOnDestroy() {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
  }
}
