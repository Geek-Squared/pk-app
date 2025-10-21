import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface ValidationResult {
  score: number;
  is_valid: boolean;
  feedback: string;
  suggestions?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiValidationService {
  private openaiApiUrl = 'https://api.openai.com/v1/chat/completions';
  
  constructor(private http: HttpClient) { }

  // Basic pre-validation checks (free/fast)
  basicValidation(response: string): { valid: boolean; reason?: string } {
    // Check minimum length
    if (response.trim().length < 10) {
      return { valid: false, reason: 'Response too short. Please provide more detail.' };
    }

    // Check for obvious gaming patterns - be more specific to avoid medical context false positives
    const gamingPatterns = ['xyz', 'asdf', 'qwerty', 'abc123', 'test123', 'testing123'];
    const lowerResponse = response.toLowerCase();
    
    // Check for exact gaming patterns, but exclude medical contexts
    for (const pattern of gamingPatterns) {
      if (lowerResponse.includes(pattern)) {
        return { valid: false, reason: 'Please provide a genuine response about your thoughts and feelings.' };
      }
    }
    
    // Check for single word "test" only if it's the entire response or clearly gaming
    if (lowerResponse.trim() === 'test' || 
        lowerResponse.match(/^test\s*$/) || 
        lowerResponse.match(/^\s*test\s+test\s*$/) ||
        lowerResponse.match(/^test\s*123/) ||
        lowerResponse.match(/^123\s*test/)) {
      return { valid: false, reason: 'Please provide a genuine response about your thoughts and feelings.' };
    }

    // Check for repetitive text
    const words = response.trim().split(/\s+/);
    if (words.length >= 3) {
      const firstWord = words[0].toLowerCase();
      const repetitiveCount = words.filter(word => word.toLowerCase() === firstWord).length;
      if (repetitiveCount >= words.length * 0.7) {
        return { valid: false, reason: 'Please avoid repetitive text and share your genuine thoughts.' };
      }
    }

    return { valid: true };
  }

  // Enhanced basic validation (smarter than basic, simpler than AI)
  enhancedBasicValidation(response: string, question?: string): ValidationResult {
    const cleanResponse = response.trim().toLowerCase();
    const words = response.trim().split(/\s+/);
    const questionLower = question ? question.toLowerCase() : '';
    
    console.log('Enhanced validation - Response:', response);
    console.log('Enhanced validation - Question:', question);
    
    // Check for very short responses
    if (words.length < 5) {
      const questionContext = this.getQuestionContext(questionLower);
      return {
        score: 3,
        is_valid: false,
        feedback: `Please provide a more detailed response ${questionContext.instruction}.`,
        suggestions: questionContext.suggestion
      };
    }

    // Check for completely irrelevant responses - be careful not to flag legitimate therapeutic content
    const irrelevantWords = ['ice cream', 'icecream', 'pizza', 'burger', 'sandwich', 'weather forecast', 'sunny day', 'video game', 'funny meme', 'lol', 'haha', 'driving license', 'shopping mall', 'vacation trip', 'holiday party'];
    const hasIrrelevantContent = irrelevantWords.some(word => cleanResponse.includes(word));
    
    console.log('Checking for irrelevant content in:', cleanResponse);
    console.log('Found irrelevant content:', hasIrrelevantContent);
    
    if (hasIrrelevantContent) {
      const questionContext = this.getQuestionContext(questionLower);
      console.log('REJECTING for irrelevant content');
      return {
        score: 2,
        is_valid: false,
        feedback: `This response doesn't seem related to ${questionContext.aspect}. Please provide a thoughtful reflection.`,
        suggestions: questionContext.suggestion
      };
    }

    // Additional check: responses that are too generic/vague for therapeutic context
    const vageResponses = ['i like it', 'it was good', 'it was nice', 'it was okay', 'fine', 'whatever', 'i dont know', 'nothing', 'no comment'];
    const isVague = vageResponses.some(phrase => cleanResponse.includes(phrase));
    
    if (isVague) {
      const questionContext = this.getQuestionContext(questionLower);
      console.log('REJECTING for vague response');
      return {
        score: 3,
        is_valid: false,
        feedback: `Please provide a more specific response ${questionContext.instruction}.`,
        suggestions: questionContext.suggestion
      };
    }
    
    // Question-specific keyword analysis
    const questionType = this.identifyQuestionType(questionLower);
    const relevantKeywords = this.getRelevantKeywords(questionType);
    
    // Check for therapeutic/emotional keywords
    const therapeuticWords = ['feel', 'think', 'experience', 'journey', 'strength', 'challenge', 'growth', 'learn', 'realize', 'understand', 'relate', 'connect', 'emotion', 'difficult', 'overcome', 'resilient', 'hope', 'healing', 'support', 'struggle', 'proud', 'grateful'];
    const personalWords = ['i', 'my', 'me', 'myself', 'personal', 'own'];
    
    let therapeuticCount = 0;
    let personalCount = 0;
    let relevantCount = 0;
    
    words.forEach(word => {
      const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
      if (therapeuticWords.includes(cleanWord)) therapeuticCount++;
      if (personalWords.includes(cleanWord)) personalCount++;
      if (relevantKeywords.includes(cleanWord)) relevantCount++;
    });
    
    // Score based on content quality
    let score = 5; // baseline
    
    // Bonus for question relevance
    if (relevantCount >= 1) score += 2;
    if (relevantCount >= 3) score += 1;
    
    // Bonus for therapeutic language
    if (therapeuticCount >= 2) score += 1;
    if (therapeuticCount >= 4) score += 1;
    
    // Bonus for personal reflection
    if (personalCount >= 2) score += 1;
    if (personalCount >= 4) score += 1;
    
    // Bonus for length (shows effort)
    if (words.length >= 15) score += 1;
    if (words.length >= 25) score += 1;
    
    // Cap at 10
    score = Math.min(score, 10);
    
    console.log('Enhanced validation scoring:');
    console.log('- Relevant keywords found:', relevantCount);
    console.log('- Therapeutic words found:', therapeuticCount);
    console.log('- Personal words found:', personalCount);
    console.log('- Word count:', words.length);
    console.log('- Final score:', score);
    
    // Generate question-specific feedback
    const questionContext = this.getQuestionContext(questionLower);
    let feedback = '';
    let suggestions = '';
    
    if (score >= 8) {
      feedback = `Excellent reflection that addresses ${questionContext.aspect} with personal insight!`;
    } else if (score >= 6) {
      feedback = `Good response showing some reflection on ${questionContext.aspect}.`;
      if (relevantCount < 2) {
        suggestions = `Consider elaborating more specifically on ${questionContext.focus}.`;
      }
    } else {
      feedback = `Please provide a more thoughtful reflection on ${questionContext.aspect}.`;
      suggestions = questionContext.suggestion;
    }
    
    const result = {
      score: score,
      is_valid: score >= 5,
      feedback: feedback,
      suggestions: suggestions
    };
    
    console.log('Enhanced validation result:', result);
    return result;
  }

  // Identify the type of question being asked
  private identifyQuestionType(question: string): string {
    if (question.includes('feel') || question.includes('emotion')) return 'feelings';
    if (question.includes('learn') || question.includes('lesson')) return 'learning';
    if (question.includes('relate') || question.includes('connect')) return 'connection';
    if (question.includes('challenge') || question.includes('difficult')) return 'challenges';
    if (question.includes('strength') || question.includes('resilient')) return 'strength';
    if (question.includes('think') || question.includes('opinion')) return 'thoughts';
    return 'general';
  }

  // Get relevant keywords based on question type
  private getRelevantKeywords(questionType: string): string[] {
    const keywordMap: { [key: string]: string[] } = {
      'feelings': ['feel', 'felt', 'emotion', 'emotional', 'sad', 'happy', 'angry', 'frustrated', 'hopeful', 'scared', 'worried', 'proud'],
      'learning': ['learn', 'learned', 'lesson', 'taught', 'realize', 'understand', 'discover', 'insight'],
      'connection': ['relate', 'connect', 'similar', 'like', 'same', 'identify', 'resonate', 'remind'],
      'challenges': ['challenge', 'difficult', 'hard', 'struggle', 'overcome', 'face', 'deal', 'cope'],
      'strength': ['strong', 'strength', 'resilient', 'brave', 'courage', 'overcome', 'endure', 'persist'],
      'thoughts': ['think', 'believe', 'opinion', 'view', 'perspective', 'consider', 'reflect'],
      'general': ['experience', 'journey', 'story', 'situation', 'life']
    };
    return keywordMap[questionType] || keywordMap['general'];
  }

  // Get context-specific guidance based on question
  private getQuestionContext(question: string): { aspect: string, instruction: string, focus: string, suggestion: string } {
    if (question.includes('feel') || question.includes('emotion')) {
      return {
        aspect: 'your emotional response',
        instruction: 'about your feelings',
        focus: 'what emotions this brought up for you',
        suggestion: 'Share what emotions or feelings this story brought up for you and why.'
      };
    }
    if (question.includes('learn') || question.includes('lesson')) {
      return {
        aspect: 'what you learned',
        instruction: 'about the lessons or insights',
        focus: 'what specific lessons or insights you gained',
        suggestion: 'Explain what specific lessons or insights you gained from this story.'
      };
    }
    if (question.includes('relate') || question.includes('connect')) {
      return {
        aspect: 'how you relate to the story',
        instruction: 'about your personal connection',
        focus: 'how this connects to your own experience',
        suggestion: 'Describe how this story connects to your own life experiences.'
      };
    }
    if (question.includes('challenge') || question.includes('difficult')) {
      return {
        aspect: 'challenges discussed',
        instruction: 'about the challenges',
        focus: 'how you relate to or have faced similar challenges',
        suggestion: 'Share how you relate to these challenges or similar ones you\'ve faced.'
      };
    }
    if (question.includes('strength') || question.includes('resilient')) {
      return {
        aspect: 'strength and resilience',
        instruction: 'about strength and resilience',
        focus: 'what strengths you see in yourself or the character',
        suggestion: 'Reflect on the strengths you see and how they relate to your own resilience.'
      };
    }
    
    return {
      aspect: 'the story',
      instruction: 'with your thoughts and reflections',
      focus: 'your personal thoughts and experiences',
      suggestion: 'Share your personal thoughts and how this relates to your own experience.'
    };
  }

  // OpenAI validation for deeper content analysis
  validateResponse(question: string, response: string, storyContext?: string): Observable<any> {
    const basicCheck = this.basicValidation(response);
    if (!basicCheck.valid) {
      return new Observable(observer => {
        observer.next({
          score: 2,
          is_valid: false,
          feedback: basicCheck.reason || 'Please provide a more thoughtful response.'
        });
        observer.complete();
      });
    }

    console.log('Attempting OpenAI validation...');
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${environment.openaiApiKey}`
    });

    const prompt = this.createValidationPrompt(question, response, storyContext);

    const body = {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a therapeutic content validator for an HIV support app called Positive Konnections. Users answer reflection questions after reading stories about resilience and strength. Your role is to assess if responses show genuine engagement vs. gaming the system.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 150,
      temperature: 0.3
    };

    console.log('OpenAI request body:', body);

    return this.http.post<any>(this.openaiApiUrl, body, { headers }).pipe(
      tap(response => console.log('Raw OpenAI HTTP response:', response)),
      catchError((error) => {
        console.error('OpenAI API call failed, falling back to enhanced validation:', error);
        // Fallback to enhanced validation if OpenAI fails
        return new Observable(observer => {
          const enhancedResult = this.enhancedBasicValidation(response, question);
          console.log('Using enhanced validation fallback:', enhancedResult);
          observer.next(enhancedResult);
          observer.complete();
        });
      })
    );
  }

  private createValidationPrompt(question: string, response: string, storyContext?: string): string {
    return `
You are a strict therapeutic content validator for an HIV support app. Users must provide relevant, thoughtful responses to reflection questions.

QUESTION ASKED: "${question}"
${storyContext ? `STORY CONTEXT: "${storyContext}"` : ''}
USER'S RESPONSE: "${response}"

CRITICAL: Check if the response relates to the question topic. For HIV/health questions, responses about medical experiences, emotional impacts, social challenges, treatment, disclosure, stigma, etc. are ALL HIGHLY RELEVANT.

EVALUATION CRITERIA:
1. RELEVANCE: Does the response address the question topic? For HIV questions, ANY discussion of HIV-related experiences is relevant.
2. CONTEXT: Is this appropriate for HIV/health/therapeutic context? Medical, emotional, social aspects are all valid.
3. EFFORT: Does it show genuine thought vs. gaming/trolling?
4. REFLECTION: Does it demonstrate personal insight related to the question?

EXAMPLES OF IRRELEVANT RESPONSES (Score 1-3):
- Question about HIV challenges → Answer about "I like ice cream" or "Nice weather today"
- Question about feelings → Answer about "My favorite movie" or "I went shopping"
- Completely off-topic responses with no connection to health, emotions, or life experiences

EXAMPLES OF HIGHLY RELEVANT RESPONSES (Score 7-10):
- HIV challenges question → ANY response about stigma, medication, disclosure, health worries, discrimination, emotional impact, treatment experiences, social isolation, financial burden, etc.
- HIV feelings question → ANY response about emotions related to diagnosis, living with HIV, fear, hope, strength, etc.
- Learning question → ANY response about personal growth, insights from HIV experience, coping strategies, etc.

IMPORTANT: For HIV-related questions, responses covering medical experiences, emotional impacts, social challenges, treatment, disclosure, stigma, isolation, financial aspects, or any life impact are HIGHLY RELEVANT and should score 7-10.

SCORING RULES:
1-2: Completely off-topic, trolling, or irrelevant (e.g., "I like ice cream" for HIV question)
3-4: Vague or minimal effort (e.g., "It was okay" or "I don't know")
5-6: Addresses the question with basic relevant content but lacks detail
7-8: Good response with multiple relevant points and personal insight
9-10: Excellent detailed response with multiple specific examples and deep reflection

IMPORTANT: For HIV-related therapeutic questions, detailed responses covering multiple aspects (stigma, treatment, emotions, social impact, etc.) should score 8-10. The example response about stigma, medication, disclosure, health worries, isolation, and financial challenges is a PERFECT 9-10 response.

Respond ONLY in this JSON format:
{
  "score": 2,
  "is_valid": false,
  "feedback": "Response does not address the question about [specific topic]. Please provide a relevant reflection.",
  "suggestions": "Please answer the specific question asked about [topic] with your personal thoughts or experiences."
}`;
  }

  // Handle HTTP errors
  private handleError = (error: HttpErrorResponse) => {
    console.error('OpenAI API Error:', error);
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      console.error('Client error:', error.error.message);
    } else {
      // Server-side error
      console.error(`Server error ${error.status}: ${error.message}`);
      console.error('Error body:', error.error);
    }
    
    return throwError(() => error);
  };

  // Parse OpenAI response
  parseOpenAIResponse(openaiResponse: any): ValidationResult {
    try {
      console.log('Full OpenAI response:', openaiResponse);
      
      // Check if response has the expected structure
      if (!openaiResponse || !openaiResponse.choices || !Array.isArray(openaiResponse.choices) || openaiResponse.choices.length === 0) {
        console.error('Invalid OpenAI response structure:', openaiResponse);
        throw new Error('Invalid response structure');
      }
      
      const choice = openaiResponse.choices[0];
      if (!choice || !choice.message || !choice.message.content) {
        console.error('Invalid choice structure:', choice);
        throw new Error('Invalid choice structure');
      }
      
      const content = choice.message.content;
      console.log('OpenAI content:', content);
      
      const parsed = JSON.parse(content);
      console.log('Parsed JSON:', parsed);
      
      return {
        score: parsed.score || 5,
        is_valid: parsed.is_valid !== false,
        feedback: parsed.feedback || 'Response received',
        suggestions: parsed.suggestions
      };
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
      console.error('Raw response:', openaiResponse);
      
      // Fallback to accepting the response if AI fails
      return {
        score: 6,
        is_valid: true,
        feedback: 'Response accepted (AI validation temporarily unavailable)'
      };
    }
  }
}