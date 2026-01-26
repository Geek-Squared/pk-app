import * as functions from 'firebase-functions';
const admin = require('firebase-admin');
const fetch = require('node-fetch');
admin.initializeApp();

exports.processSignUp = functions.auth.user().onCreate((user) => {
  if (user.email && user.emailVerified) {
    const customClaims = {
      client: true,
    };
    return admin
      .auth()
      .setCustomUserClaims(user.uid, customClaims)
      .catch((error: any) => {});
  }
});

exports.generateHeroAvatar = functions
  .runWith({ memory: '1GB', timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be signed in to generate an avatar.'
      );
    }

    const apiKey = functions.config().openai?.key;
    if (!apiKey) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'OpenAI API key is not configured.'
      );
    }

    const profile = data?.profile;
    if (!profile?.heroName || !profile?.originStory) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Hero name and origin story are required.'
      );
    }

    const prompt = buildHeroPrompt(profile);
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        size: '512x512',
        response_format: 'b64_json',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new functions.https.HttpsError(
        'internal',
        'Avatar generation failed.',
        text
      );
    }

    const result = await response.json();
    const b64 = result?.data?.[0]?.b64_json;
    if (!b64) {
      throw new functions.https.HttpsError(
        'internal',
        'OpenAI did not return an image.'
      );
    }

    return { image: `data:image/png;base64,${b64}` };
  });

function buildHeroPrompt(profile: any): string {
  const powers =
    profile?.secondaryPowers?.length
      ? `Secondary powers: ${profile.secondaryPowers.join(', ')}.`
      : '';

  const motto = profile?.motto ? `Hero motto: "${profile.motto}".` : '';

  return [
    'Create a vibrant, empowering illustration of a young superhero.',
    `Hero name: ${profile.heroName}. Alias: ${profile.alias || 'unknown'}.`,
    `Signature power: ${profile.signaturePower || 'energy shield'}.`,
    powers,
    `Aura color theme: ${profile.auraColor || 'violet'}.`,
    'Style: modern comic art, inclusive, friendly, high energy, no weapons, focus on positivity.',
    motto,
  ]
    .filter(Boolean)
    .join(' ');
}
