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
      .catch((error: any) => {
        console.warn('Unable to set custom claims for new user', error);
      });
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

function isMeaningfulResponse(response: any): boolean {
  if (!response) {
    return false;
  }

  if (typeof response?.qualityScore === 'number') {
    return response.qualityScore >= 5;
  }

  if (response?.content?.videoCompleted === true) {
    return true;
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

async function getAdminTokens(): Promise<string[]> {
  const adminUsersSnap = await admin
    .firestore()
    .collection('users')
    .where('role', '==', 'Administrator')
    .get();

  const tokens: string[] = [];
  adminUsersSnap.forEach((doc: any) => {
    const data = doc.data() || {};
    const userTokens = data.webFcmTokens || data.fcmTokens || [];
    if (Array.isArray(userTokens)) {
      userTokens.forEach((token: string) => token && tokens.push(token));
    } else if (userTokens && typeof userTokens === 'object') {
      Object.keys(userTokens).forEach((token) => tokens.push(token));
    }
  });

  return Array.from(new Set(tokens));
}

async function assertAdmin(context: functions.https.CallableContext) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in.'
    );
  }

  const userDoc = await admin
    .firestore()
    .collection('users')
    .doc(context.auth.uid)
    .get();

  const role = userDoc.exists ? userDoc.data()?.role : null;
  if (role !== 'Administrator') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Admin access required.'
    );
  }
}

exports.onWorkbookCompletion = functions.firestore
  .document('workbooks/{workbookId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};

    if (before.completedAt || after.completedAt) {
      return null;
    }

    const responses = Array.isArray(after.responses) ? after.responses : [];
    if (!responses.length) {
      return null;
    }

    const completedPostIds = new Set<string>();
    for (const response of responses) {
      const postId = response?.postId;
      if (!postId) {
        continue;
      }
      if (isMeaningfulResponse(response)) {
        completedPostIds.add(postId);
      }
    }

    if (!completedPostIds.size) {
      return null;
    }

    const postsSnap = await admin.firestore().collection('posts').get();
    const totalPosts = postsSnap.size;
    if (!totalPosts || completedPostIds.size < totalPosts) {
      return null;
    }

    const completedAt = admin.firestore.Timestamp.now();
    const completedBy = after.uid || null;
    const workbookId = context.params.workbookId;

    await change.after.ref.update({
      completedAt,
      completed: true,
      completedBy,
      completedPostCount: completedPostIds.size,
      totalPostCount: totalPosts,
    });

    let displayName: string | null = null;
    if (completedBy) {
      const userDoc = await admin
        .firestore()
        .collection('users')
        .doc(completedBy)
        .get();
      displayName = userDoc.exists ? userDoc.data()?.displayName || null : null;
    }

    const notificationMessage = displayName
      ? `${displayName} completed a workbook.`
      : 'A user completed a workbook.';

    const notificationRef = await admin
      .firestore()
      .collection('adminNotifications')
      .add({
        type: 'workbook_completed',
        userId: completedBy,
        workbookId,
        title: 'Workbook completed',
        message: notificationMessage,
        createdAt: completedAt,
        readBy: {},
      });

    const uniqueTokens = await getAdminTokens();
    if (!uniqueTokens.length) {
      return null;
    }

    return admin.messaging().sendMulticast({
      tokens: uniqueTokens,
      notification: {
        title: 'Workbook completed',
        body: notificationMessage,
      },
      data: {
        type: 'workbook_completed',
        workbookId,
        userId: completedBy ?? '',
        notificationId: notificationRef.id,
      },
    });
  });

exports.sendAdminTestNotification = functions.https.onCall(
  async (data, context) => {
    await assertAdmin(context);

    const message =
      typeof data?.message === 'string' && data.message.trim()
        ? data.message.trim()
        : 'Test notification from the admin console.';

    const createdAt = admin.firestore.Timestamp.now();
    const notificationRef = await admin
      .firestore()
      .collection('adminNotifications')
      .add({
        type: 'test_notification',
        userId: context.auth?.uid || null,
        workbookId: null,
        title: 'Test notification',
        message,
        createdAt,
        readBy: {},
      });

    const tokens = await getAdminTokens();
    if (!tokens.length) {
      return { sent: 0, notificationId: notificationRef.id };
    }

    const result = await admin.messaging().sendMulticast({
      tokens,
      notification: {
        title: 'Test notification',
        body: message,
      },
      data: {
        type: 'test_notification',
        notificationId: notificationRef.id,
      },
    });

    return {
      sent: result.successCount,
      failed: result.failureCount,
      notificationId: notificationRef.id,
    };
  }
);
