import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { HeroProfile } from '../models/workbook.interface';
import { AngularFireFunctions } from '@angular/fire/compat/functions';

@Injectable({
  providedIn: 'root',
})
export class AvatarService {
  private readonly apiUrl = 'https://api.openai.com/v1/images/generations';

  constructor(private fns: AngularFireFunctions) {}

  /**
   * Generates a hero avatar using the secure Backend Proxy (Phase 1).
   * This completely avoids exposing the OpenAI API key to the client.
   */
  generateHeroAvatar(profile: HeroProfile): Observable<string> {
    const callable = this.fns.httpsCallable('generateHeroAvatar');
    return from(callable({ profile })).pipe(
      map((response: any) => {
        if (!response?.image) {
          throw new Error('Avatar generation failed at backend');
        }
        return response.image;
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
