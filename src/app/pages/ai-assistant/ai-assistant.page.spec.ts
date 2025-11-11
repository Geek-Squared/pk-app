import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { AiAssistantPage } from './ai-assistant.page';

describe('AiAssistantPage', () => {
  let component: AiAssistantPage;
  let fixture: ComponentFixture<AiAssistantPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AiAssistantPage],
      imports: [
        IonicModule.forRoot(),
        ReactiveFormsModule,
        HttpClientTestingModule,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AiAssistantPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

