import { TestBed } from '@angular/core/testing';

import { AnswerQuestionsGuard } from './answer-questions.guard';

describe('AnswerQuestionsGuard', () => {
  let guard: AnswerQuestionsGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    guard = TestBed.inject(AnswerQuestionsGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
