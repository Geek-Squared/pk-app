import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { QuestionsService } from 'src/app/services/questions.service';
import { UtilitiesService } from 'src/app/services/utilities.service';
import { WorkbookService } from 'src/app/services/workbook.service';
import { AiValidationService, ValidationResult } from 'src/app/services/ai-validation.service';

@Component({
  selector: 'app-questions',
  templateUrl: './questions.page.html',
  styleUrls: ['./questions.page.scss'],
  standalone: false
})
export class QuestionsPage implements OnInit {
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

  constructor(
    private questionsService: QuestionsService,
    private route: ActivatedRoute,
    private workbookService: WorkbookService,
    private router: Router,
    private utilsService: UtilitiesService,
    private aiValidationService: AiValidationService
  ) {}

  ngOnInit() {
    this.utilsService.presentLoading();
    this.workbookService.getUserWorkbook().subscribe((data) => {
      this.workBook = data;
    });
    this.questionsService
      .getQuestionsByPostId(this.route.snapshot.paramMap.get('postId'))
      .subscribe((data) => {
        this.questions = data
          .map((e: any) => {
            return {
              id: e.payload.doc.id,
              ...e.payload.doc.data(),
            };
          })
          .sort((a, b) => (a.order > b.order ? 1 : -1));

        this.pager.count = this.questions.length;
        this.utilsService.dismissLoader();
      });
  }

  get filteredQuestions() {
    return this.questions
      ? this.questions.slice(
          this.pager.index,
          this.pager.index + this.pager.size
        )
      : [];
  }

  async goTo(index: number, questionId?: string) {
    // Only validate when moving forward (index > current index)
    if (index > this.pager.index) {
      const currentQuestion = this.filteredQuestions[0];
      const isValid = await this.validateResponseWithAI(currentQuestion);
      
      if (!isValid) {
        return; // Validation failed, don't proceed forward
      }
    }
    
    if (questionId) this.saveAnswerSheet(questionId);
    if (index >= 0 && index < this.pager.count) {
      this.pager.index = index;
    }
    if (this.questionAnswers.some((item) => item?.questionId === questionId)) {
      this.questionResponse = this.questionAnswers.find(
        (item) => item?.questionId === questionId
      )?.response;
    }
  }

  private saveAnswerSheet(question) {
    const removeIndex = this.questionAnswers
      .map(function (item) {
        return item.questionId;
      })
      .indexOf(question.id);

    if (this.questionAnswers.some((item) => item?.questionId === question.id))
      this.questionAnswers.splice(removeIndex, 1);

    this.questionAnswers = [
      ...[
        {
          questionUid: question.id,
          response: this.questionResponse,
          questionNarrative: question.narrative,
          postId: this.route.snapshot.paramMap.get('postId'),
        },
      ],
      ...this.questionAnswers,
    ];
    this.questionResponse = null;
  }

  public checkPosition() {
    return this.pager.index + 1 == this.pager.count;
  }

  async saveQuestionResponses(question) {
    // Validate final question with AI before completing
    const isValid = await this.validateResponseWithAI(question);
    
    if (!isValid) {
      return; // Validation failed, don't complete
    }

    this.saveAnswerSheet(question);
    const obj = Object.assign({
      ...this.questionAnswers.map((item) => ({
        response: item.response,
        questionNarrative: item.questionNarrative,
        postId: item.postId,
      })),
    });

    if (this.checkProgress(this.route.snapshot.paramMap.get('postId'))) {
      this.utilsService.presentToast(
        'You have already answered these questions'
      );
      this.router.navigate(['']);
      return;
    } else {
      this.utilsService.presentToast(
        'Please wait while we save your questions.'
      );
      this.workbookService
        .saveQuestionResponses(
          localStorage.getItem('userWorkbookId'),
          obj,
          this.route.snapshot.paramMap.get('postId')
        )
        .then(() => {
          this.utilsService.dismissLoader();
          this.router.navigate(['/my-work-book']);
        })
        .catch((err) => {
          this.utilsService.dismissLoader();
          this.utilsService.presentToast(
            err?.error?.message ? err?.error?.message : 'An error has occurred'
          );
        });
    }
  }

  checkProgress(postId: string) {
    return (this.workBook[0]?.responses).some(
      (element: any) => element?.postId === postId
    );
  }

  // Validation method: Check if current question has valid text (basic check)
  isCurrentQuestionValid(): boolean {
    return this.questionResponse && this.questionResponse.trim().length > 0;
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
      this.utilsService.presentToast('Please enter your response before proceeding.');
      return false;
    }

    // Show loading indicator
    this.isValidating = true;
    this.validationFeedback = 'Checking response quality...';

    try {
      console.log('Starting AI validation for response:', this.questionResponse);
      
      // Use AI validation service
      const result = await this.aiValidationService.validateResponse(
        question?.narrative || 'Reflection question',
        this.questionResponse,
        'Story about resilience and strength in HIV journey'
      ).toPromise();

      console.log('AI validation result received:', result);

      // Check if this is an OpenAI API response or enhanced validation response
      if (result && (result as any).choices && (result as any).choices[0]) {
        // This is an OpenAI API response, parse it
        console.log('Parsing OpenAI API response');
        this.lastValidationResult = this.aiValidationService.parseOpenAIResponse(result);
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
          feedback: 'Response accepted (validation format issue)'
        };
      }
      
      console.log('Final validation result:', this.lastValidationResult);
      
      this.isValidating = false;

      // Check if response is valid
      if (this.lastValidationResult.is_valid && this.lastValidationResult.score >= 5) {
        this.validationFeedback = this.lastValidationResult.feedback;
        if (this.lastValidationResult.score >= 8) {
          this.utilsService.presentToast('Great reflection! Thank you for sharing your thoughts.');
        }
        return true;
      } else {
        // Response needs improvement
        this.validationFeedback = this.lastValidationResult.feedback;
        if (this.lastValidationResult.suggestions) {
          this.validationFeedback += '. ' + this.lastValidationResult.suggestions;
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
        error: error.error
      });
      this.isValidating = false;
      
      // Fallback to basic validation if AI fails
      this.validationFeedback = 'AI validation unavailable, using basic check.';
      const basicResult = this.aiValidationService.basicValidation(this.questionResponse);
      
      if (!basicResult.valid) {
        this.utilsService.presentToast(basicResult.reason || 'Please provide a more thoughtful response.');
        return false;
      }
      
      return true; // Accept if basic validation passes and AI is unavailable
    }
  }
}
