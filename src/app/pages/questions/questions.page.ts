import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { QuestionsService } from 'src/app/services/questions.service';
import { UtilitiesService } from 'src/app/services/utilities.service';
import { WorkbookService } from 'src/app/services/workbook.service';
import {
  AiValidationService,
  ValidationResult,
} from 'src/app/services/ai-validation.service';
import { PostsService } from 'src/app/services/posts.service';
import { UPost } from 'src/app/models/post.interface';
import { WorkbookResponseOptions } from 'src/app/models/workbook.interface';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-questions',
  templateUrl: './questions.page.html',
  styleUrls: ['./questions.page.scss'],
  standalone: false,
})
export class QuestionsPage implements OnInit, OnDestroy {
  public pager = {
    index: 0,
    size: 1,
    count: 1,
  };
  public questions: any;
  public questionResponse: string;
  public questionAnswers = [];
  public workBook: any;
  public isValidating = false;
  public validationFeedback: string = '';
  public lastValidationResult: ValidationResult | null = null;
  public currentPost: UPost | null = null;
  private chapterPosts: UPost[] = [];
  private readonly MIN_MEANINGFUL_SCORE = 5;
  private readonly CHAPTER_COMPLETION_REWARD = 60;
  private readonly subscriptions = new Subscription();

  constructor(
    private questionsService: QuestionsService,
    private route: ActivatedRoute,
    private workbookService: WorkbookService,
    private router: Router,
    private utilsService: UtilitiesService,
    private aiValidationService: AiValidationService,
    private postsService: PostsService
  ) {}

  ngOnInit() {
    this.utilsService.presentLoading();
    const workbookSub = this.workbookService
      .getUserWorkbook()
      .subscribe((data) => {
        this.workBook = data;
        this.loadExistingAnswers();
      });
    this.subscriptions.add(workbookSub);

    const questionsSub = this.questionsService
      .getQuestionsByPostId(this.route.snapshot.paramMap.get('postId'))
      .subscribe((data) => {
        this.questions = data
          .map((e: any) => ({
            id: e.payload.doc.id,
            ...e.payload.doc.data(),
          }))
          .sort((a, b) => (a.order > b.order ? 1 : -1));

        this.pager.count = this.questions.length;
        this.utilsService.dismissLoader();
        this.loadExistingAnswers();
      });
    this.subscriptions.add(questionsSub);

    this.loadPostMetadata();
  }

  private loadExistingAnswers() {
    if (!this.workBook || !this.questions || this.questions.length === 0) {
      return;
    }
    
    // Only load if we haven't already started editing
    if (this.questionAnswers.length > 0 || this.questionResponse) {
      return;
    }

    const postId = this.route.snapshot.paramMap.get('postId');
    const existingEntry = this.workBook?.[0]?.responses?.find((element: any) => element?.postId === postId);
    

    if (existingEntry && existingEntry.content) {
      let contentArray = [];
      if (Array.isArray(existingEntry.content)) {
        contentArray = [...existingEntry.content];
      } else if (typeof existingEntry.content === 'object' && existingEntry.content !== null) {
        contentArray = Object.values(existingEntry.content);
      }
      
      this.questionAnswers = contentArray;
      
      const targetQuestion = this.questions[this.pager.index];
      const answer = this.questionAnswers.find(item => 
        (item?.questionUid && item.questionUid === targetQuestion?.id) || 
        (item?.questionNarrative === targetQuestion?.narrative)
      );
            
      this.questionResponse = answer ? answer.response : '';
    }
  }

  private loadPostMetadata(): void {
    const postId = this.route.snapshot.paramMap.get('postId');
    if (!postId) {
      return;
    }

    const postSub = this.postsService.getPostById(postId).subscribe((post) => {
      if (!post) {
        return;
      }
      this.currentPost = { ...post, postId };
      if (this.currentPost?.chapterId) {
        this.loadChapterPosts(this.currentPost.chapterId);
      }
    });

    this.subscriptions.add(postSub);
  }

  private loadChapterPosts(chapterId: string): void {
    const chapterPostsSub = this.postsService
      .getPostsByChapterId(chapterId)
      .subscribe((data) => {
        this.chapterPosts = data
          .map((e: any) => ({
            postId: e.payload.doc.id,
            ...e.payload.doc.data(),
          }))
          .sort((a, b) => (a.order > b.order ? 1 : -1));
      });

    this.subscriptions.add(chapterPostsSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get filteredQuestions() {
    return this.questions
      ? this.questions.slice(
          this.pager.index,
          this.pager.index + this.pager.size
        )
      : [];
  }

  async goTo(index: number, currentQuestion?: any) {
    // Only validate when moving forward (index > current index)
    /*
    if (index > this.pager.index) {
      if (!currentQuestion) currentQuestion = this.filteredQuestions[0];
      const isValid = await this.validateResponseWithAI(currentQuestion);

      if (!isValid) {
        return; // Validation failed, don't proceed forward
      }
    }
    */

    if (currentQuestion) {
      this.saveAnswerSheet(currentQuestion);
    }
    
    // Progress the pager index
    if (index >= 0 && index < this.pager.count) {
      this.pager.index = index;
    }
    
    // Load existing response for the newly focused question if available
    const nextQuestion = this.questions[this.pager.index];
    const existingEntry = this.questionAnswers.find(
      (item) => item?.questionUid === nextQuestion?.id
    );
    
    this.questionResponse = existingEntry ? existingEntry.response : '';
    
    // Clear old validation states when switching questions
    this.validationFeedback = '';
    this.lastValidationResult = null;
  }

  private saveAnswerSheet(question) {
    if (!question || !question.id) return;

    const existingIndex = this.questionAnswers.findIndex(
      (item) => item.questionUid === question.id
    );

    if (existingIndex !== -1) {
      this.questionAnswers.splice(existingIndex, 1);
    }

    const entry = {
      questionUid: question.id,
      response: this.questionResponse || '',
      questionNarrative: question.narrative,
      postId: this.route.snapshot.paramMap.get('postId'),
      questionOrder: typeof question?.order === 'number' ? question.order : this.pager.index,
    };

    this.questionAnswers = [...this.questionAnswers, entry].sort((a, b) => {
      const aOrder = typeof a?.questionOrder === 'number' ? a.questionOrder : 0;
      const bOrder = typeof b?.questionOrder === 'number' ? b.questionOrder : 0;
      return aOrder - bOrder;
    });
  }

  public checkPosition() {
    return this.pager.index + 1 == this.pager.count;
  }

  async saveQuestionResponses(question) {
    /*
    const isValid = await this.validateResponseWithAI(question);
    if (!isValid) {
      return;
    }
    */

    this.saveAnswerSheet(question);
    const postId = this.route.snapshot.paramMap.get('postId');
    const obj = Object.assign({
      ...this.questionAnswers.map((item) => ({
        questionUid: item.questionUid,
        questionOrder: item.questionOrder,
        response: item.response,
        questionNarrative: item.questionNarrative,
        postId: item.postId,
      })),
    });

    // We allow resubmission to edit existing questions, so checkProgress restriction is removed.

    const metadata: WorkbookResponseOptions = {
      chapterId: this.currentPost?.chapterId ?? null,
      qualityScore: this.lastValidationResult?.score ?? null,
      validationFeedback: this.lastValidationResult?.feedback ?? '',
    };

    const reward = this.calculateChapterReward(postId);
    if (reward.coins > 0) {
      metadata.coinsAwarded = reward.coins;
      metadata.coinReason = reward.reason;
    }

    this.utilsService.presentToast('Please wait while we save your questions.');
    this.workbookService
      .saveQuestionResponses(
        localStorage.getItem('userWorkbookId'),
        obj,
        postId,
        metadata
      )
      .then(() => {
        this.utilsService.dismissLoader();
        if (reward.coins > 0) {
          this.utilsService.presentToast(
            `Chapter milestone unlocked! ${reward.coins} Peekay coins earned.`
          );
        }
        this.router.navigate(['/my-work-book']);
      })
      .catch((err) => {
        this.utilsService.dismissLoader();
        this.utilsService.presentToast(
          err?.error?.message ?? 'An error has occurred'
        );
      });
  }

  checkProgress(postId: string) {
    const entry = this.workBook?.[0]?.responses?.find(
      (element: any) => element?.postId === postId
    );
    return entry && this.isMeaningfulResponse(entry);
  }

  // Validation method: Check if current question has valid text (basic check)
  isCurrentQuestionValid(): boolean {
    return this.questionResponse && this.questionResponse.trim().length > 0;
  }

  private isMeaningfulResponse(response: any): boolean {
    if (!response) {
      return false;
    }

    if (typeof response?.qualityScore === 'number') {
      return response.qualityScore >= this.MIN_MEANINGFUL_SCORE;
    }

    const serialized = JSON.stringify(response?.content ?? '')
      .replace(/[\n\r]/g, ' ')
      .trim()
      .toLowerCase();

    if (!serialized) {
      return false;
    }

    const banned = ['x', 'n/a', 'na', 'none', 'nil'];
    return !banned.includes(serialized);
  }

  // Validation method: Check if all questions have been answered with valid text
  isAllQuestionsValid(): boolean {
    // Must have current question response
    if (!this.isCurrentQuestionValid()) {
      return false;
    }

    // Must have answered all questions (total questions = answered questions + current question)
    const totalQuestionsAnswered = this.questionAnswers.length + 1; // +1 for current question
    return totalQuestionsAnswered === this.questions.length;
  }

  // AI Validation method
  async validateResponseWithAI(question: any): Promise<boolean> {
    // First check basic validation
    if (!this.isCurrentQuestionValid()) {
      this.utilsService.presentToast(
        'Please enter your response before proceeding.'
      );
      return false;
    }

    // Show loading indicator
    this.isValidating = true;
    this.validationFeedback = 'Checking response quality...';

    try {
      console.log(
        'Starting AI validation for response:',
        this.questionResponse
      );

      // Use AI validation service
      const result = await this.aiValidationService
        .validateResponse(
          question?.narrative || 'Reflection question',
          this.questionResponse,
          'Story about resilience and strength in HIV journey'
        )
        .toPromise();

      console.log('AI validation result received:', result);

      // Check if this is an OpenAI API response or enhanced validation response
      if (result && (result as any).choices && (result as any).choices[0]) {
        // This is an OpenAI API response, parse it
        console.log('Parsing OpenAI API response');
        this.lastValidationResult =
          this.aiValidationService.parseOpenAIResponse(result);
      } else if (result && typeof (result as any).score === 'number') {
        // This is already a ValidationResult from enhanced validation
        console.log('Using enhanced validation result directly');
        this.lastValidationResult = result as ValidationResult;
      } else {
        // Unexpected format, use fallback
        console.log('Unexpected result format, using fallback');
        this.lastValidationResult = {
          score: 6,
          is_valid: true,
          feedback: 'Response accepted (validation format issue)',
        };
      }

      console.log('Final validation result:', this.lastValidationResult);

      this.isValidating = false;

      // Check if response is valid
      if (
        this.lastValidationResult.is_valid &&
        this.lastValidationResult.score >= 5
      ) {
        this.validationFeedback = this.lastValidationResult.feedback;
        if (this.lastValidationResult.score >= 8) {
          this.utilsService.presentToast(
            'Great reflection! Thank you for sharing your thoughts.'
          );
        }
        return true;
      } else {
        // Response needs improvement
        this.validationFeedback = this.lastValidationResult.feedback;
        if (this.lastValidationResult.suggestions) {
          this.validationFeedback +=
            '. ' + this.lastValidationResult.suggestions;
        }

        this.utilsService.presentToast(this.validationFeedback);
        return false;
      }
    } catch (error) {
      console.error('AI validation error in questions page:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        error: error.error,
      });
      this.isValidating = false;

      // Fallback to basic validation if AI fails
      this.validationFeedback = 'AI validation unavailable, using basic check.';
      const basicResult = this.aiValidationService.basicValidation(
        this.questionResponse
      );

      if (!basicResult.valid) {
        this.utilsService.presentToast(
          basicResult.reason || 'Please provide a more thoughtful response.'
        );
        return false;
      }

      return true; // Accept if basic validation passes and AI is unavailable
    }
  }

  private calculateChapterReward(postId?: string): {
    coins: number;
    reason: string;
  } {
    const responses = (this.workBook?.[0]?.responses ?? []) as any[];

    if (!this.currentPost?.chapterId) {
      return { coins: 0, reason: '' };
    }

    const chapterResponses = responses.filter(
      (response) =>
        response?.chapterId === this.currentPost?.chapterId &&
        this.isMeaningfulResponse(response)
    );

    const alreadyCompleted = chapterResponses.some(
      (response) => response?.postId === postId
    );

    if (alreadyCompleted) {
      return { coins: 0, reason: '' };
    }

    const totalPosts = this.chapterPosts?.length;

    if (!totalPosts || totalPosts === 0) {
      return {
        coins: this.CHAPTER_COMPLETION_REWARD,
        reason: 'Chapter milestone complete',
      };
    }

    const completionCountAfterSave = chapterResponses.length + 1;

    if (completionCountAfterSave >= totalPosts) {
      return {
        coins: this.CHAPTER_COMPLETION_REWARD,
        reason: 'Completed chapter reflection',
      };
    }

    return { coins: 0, reason: '' };
  }
}
