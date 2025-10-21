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

    // Check for obvious gaming patterns
    const gamingPatterns = ['xyz', 'test', 'asdf', 'qwerty', '123'];
    const lowerResponse = response.toLowerCase();
    
    for (const pattern of gamingPatterns) {
      if (lowerResponse.includes(pattern)) {
        return { valid: false, reason: 'Please provide a genuine response about your thoughts and feelings.' };
      }
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

  // OpenAI validation for deeper content analysis
  validateResponse(question: string, response: string, storyContext?: string): Observable<ValidationResult> {
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

    return this.http.post<any>(this.openaiApiUrl, body, { headers }).pipe(
      tap(response => console.log('Raw OpenAI HTTP response:', response)),
      catchError(this.handleError)
    );
  }

  private createValidationPrompt(question: string, response: string, storyContext?: string): string {
    return `
Please analyze this therapeutic reflection response:

Question: "${question}"
${storyContext ? `Story Context: "${storyContext}"` : ''}
User Response: "${response}"

Assess if this response shows genuine engagement with the therapeutic question. Consider:
- Does it address the question meaningfully?
- Does it show personal reflection or insight?
- Is it appropriate for HIV support therapy context?
- Does it demonstrate effort vs. gaming the system?

Rate 1-10 where:
1-3: Gaming/meaningless (xyz, irrelevant, copy-paste)
4-6: Minimal but shows some genuine thought
7-10: Thoughtful reflection showing engagement

Respond ONLY in this JSON format:
{
  "score": 7,
  "is_valid": true,
  "feedback": "Response shows personal reflection",
  "suggestions": "Consider adding more detail about your feelings"
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