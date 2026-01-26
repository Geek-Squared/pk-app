import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HeroProfile } from '../models/workbook.interface';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AvatarService {
  private readonly apiUrl = 'https://api.openai.com/v1/images/generations';

  constructor(private http: HttpClient) {}

  generateHeroAvatar(profile: HeroProfile): Observable<string> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.openaiApiKey}`,
    });

    const body = {
      model: 'gpt-image-1',
      prompt: this.buildPrompt(profile),
      size: '512x512',
      response_format: 'b64_json',
    };

    return this.http.post<any>(this.apiUrl, body, { headers }).pipe(
      map((response) => {
        const b64 = response?.data?.[0]?.b64_json;
        if (!b64) {
          throw new Error('Avatar generation failed');
        }
        return `data:image/png;base64,${b64}`;
      })
    );
  }

  private buildPrompt(profile: HeroProfile): string {
    const powers =
      profile.secondaryPowers?.length > 0
        ? `Secondary powers: ${profile.secondaryPowers.join(', ')}.`
        : '';

    const motto = profile.motto ? `Hero motto: "${profile.motto}".` : '';

    return [
      'Create a vibrant comic-style illustration of a young superhero. Inclusive, hopeful, no weapons.',
      `Hero name: ${profile.heroName}. Alias: ${profile.alias || 'unknown'}.`,
      `Signature power: ${profile.signaturePower || 'energy aura'}.`,
      `Aura color emphasis: ${profile.auraColor}.`,
      powers,
      motto,
    ]
      .filter(Boolean)
      .join(' ');
  }
}
