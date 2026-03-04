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

function extractWebTokens(data: any): string[] {
  const tokens: string[] = [];
  const webTokens = data?.webFcmTokens || data?.fcmTokens || [];
  if (Array.isArray(webTokens)) {
    webTokens.forEach((token: string) => token && tokens.push(token));
  } else if (webTokens && typeof webTokens === 'object') {
    Object.keys(webTokens).forEach((token) => tokens.push(token));
  }
  return tokens;
}

async function getUserTokensByUids(uids: string[]): Promise<string[]> {
  if (!uids.length) {
    return [];
  }

  const refs = uids.map((uid) => admin.firestore().collection('users').doc(uid));
  const docs = await admin.firestore().getAll(...refs);
  const tokens: string[] = [];
  docs.forEach((doc: any) => {
    if (!doc.exists) {
      return;
    }
    tokens.push(...extractWebTokens(doc.data() || {}));
  });

  return Array.from(new Set(tokens));
}

async function getAllUsersForNotifications(): Promise<{
  uids: string[];
  tokens: string[];
}> {
  const snap = await admin.firestore().collection('users').get();
  const uids: string[] = [];
  const tokens: string[] = [];
  snap.forEach((doc: any) => {
    uids.push(doc.id);
    tokens.push(...extractWebTokens(doc.data() || {}));
  });

  return { uids, tokens: Array.from(new Set(tokens)) };
}

async function writeUserNotifications(
  uids: string[],
  payload: Record<string, any>
): Promise<void> {
  if (!uids.length) {
    return;
  }

  const chunkSize = 400;
  for (let i = 0; i < uids.length; i += chunkSize) {
    const batch = admin.firestore().batch();
    const chunk = uids.slice(i, i + chunkSize);
    chunk.forEach((uid) => {
      const ref = admin
        .firestore()
        .collection('users')
        .doc(uid)
        .collection('notifications')
        .doc();
      batch.set(ref, payload);
    });
    await batch.commit();
  }
}

async function assertAdmin(context: functions.https.CallableContext) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in.'
    );
  }

  const userRef = admin.firestore().collection('users').doc(context.auth.uid);
  const userDoc = await userRef.get();
  const role = userDoc.exists ? userDoc.data()?.role : null;

  if (role === 'Administrator') {
    return;
  }

  {
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

    const responses = Array.isArray(after.responses)
      ? after.responses
      : after.responses && typeof after.responses === 'object'
      ? Object.values(after.responses)
      : [];
    if (!responses.length) {
      return null;
    }

    const completedPostIds = new Set<string>();
    const completedByChapter = new Map<string, Set<string>>();
    for (const response of responses) {
      const postId = response?.postId;
      if (!postId) {
        continue;
      }
      if (isMeaningfulResponse(response)) {
        completedPostIds.add(postId);
        const chapterId = response?.chapterId;
        if (chapterId) {
          const set = completedByChapter.get(chapterId) ?? new Set<string>();
          set.add(postId);
          completedByChapter.set(chapterId, set);
        }
      }
    }

    if (!completedPostIds.size) {
      return null;
    }

    const postsSnap = await admin.firestore().collection('posts').get();
    const totalPosts = postsSnap.size;
    if (!totalPosts) {
      return null;
    }

    const completedAt = admin.firestore.Timestamp.now();
    const completedBy = after.uid || null;
    const workbookId = context.params.workbookId;
    const updates: Record<string, any> = {};

    const postsByChapter = new Map<string, Set<string>>();
    postsSnap.forEach((doc: any) => {
      const data = doc.data() || {};
      const chapterId = data.chapterId;
      if (!chapterId) {
        return;
      }
      const set = postsByChapter.get(chapterId) ?? new Set<string>();
      set.add(doc.id);
      postsByChapter.set(chapterId, set);
    });

    const completedChapters = after.completedChapters || {};
    const newlyCompletedChapterIds: string[] = [];
    completedByChapter.forEach((completedSet, chapterId) => {
      const totalSet = postsByChapter.get(chapterId);
      if (!totalSet || completedSet.size < totalSet.size) {
        return;
      }

      if (completedChapters?.[chapterId]) {
        return;
      }

      newlyCompletedChapterIds.push(chapterId);
      updates[`completedChapters.${chapterId}`] = completedAt;
    });

    const workbookAlreadyCompleted = Boolean(before.completedAt || after.completedAt);
    const hasCompletedWorkbook =
      !workbookAlreadyCompleted && completedPostIds.size >= totalPosts;
    if (hasCompletedWorkbook) {
      updates.completedAt = completedAt;
      updates.completed = true;
      updates.completedBy = completedBy;
      updates.completedPostCount = completedPostIds.size;
      updates.totalPostCount = totalPosts;
    }

    if (Object.keys(updates).length) {
      await change.after.ref.update(updates);
    }

    let displayName: string | null = null;
    if (completedBy) {
      const userDoc = await admin
        .firestore()
        .collection('users')
        .doc(completedBy)
        .get();
      displayName = userDoc.exists ? userDoc.data()?.displayName || null : null;
    }

    const uniqueTokens = await getAdminTokens();

    if (newlyCompletedChapterIds.length) {
      const chapterRefs = newlyCompletedChapterIds.map((id) =>
        admin.firestore().collection('chapters').doc(id)
      );
      const chapterDocs = chapterRefs.length
        ? await admin.firestore().getAll(...chapterRefs)
        : [];
      const chapterTitles = new Map<string, string>();
      chapterDocs.forEach((doc: any) => {
        chapterTitles.set(doc.id, doc.data()?.title || 'Chapter');
      });

      const chapterNotifications = [];
      for (const chapterId of newlyCompletedChapterIds) {
        const chapterTitle = chapterTitles.get(chapterId) || 'Chapter';
        const message = displayName
          ? `${displayName} completed ${chapterTitle}.`
          : `A user completed ${chapterTitle}.`;

        const chapterNotificationRef = await admin
          .firestore()
          .collection('adminNotifications')
          .add({
            type: 'chapter_completed',
            userId: completedBy,
            workbookId,
            chapterId,
            title: 'Chapter completed',
            message,
            createdAt: completedAt,
            readBy: {},
          });

        chapterNotifications.push({
          chapterId,
          message,
          notificationId: chapterNotificationRef.id,
        });
      }

      if (uniqueTokens.length) {
        await Promise.all(
          chapterNotifications.map((item) =>
            admin.messaging().sendMulticast({
              tokens: uniqueTokens,
              notification: {
                title: 'Chapter completed',
                body: item.message,
              },
              data: {
                type: 'chapter_completed',
                workbookId,
                userId: completedBy ?? '',
                chapterId: item.chapterId,
                notificationId: item.notificationId,
              },
            })
          )
        );
      }
    }

    if (!hasCompletedWorkbook) {
      return null;
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

exports.sendUserBroadcastNotification = functions.https.onCall(
  async (data, context) => {
    await assertAdmin(context);

    const title =
      typeof data?.title === 'string' && data.title.trim()
        ? data.title.trim()
        : 'Positive Konnections';
    const body =
      typeof data?.body === 'string' && data.body.trim()
        ? data.body.trim()
        : 'You have a new update.';
    const url =
      typeof data?.url === 'string' && data.url.trim()
        ? data.url.trim()
        : '';

    const createdAt = admin.firestore.Timestamp.now();
    const { tokens, uids } = await getAllUsersForNotifications();
    await writeUserNotifications(uids, {
      type: 'broadcast',
      title,
      body,
      createdAt,
      read: false,
      data: {
        url,
      },
    });

    if (!tokens.length) {
      return { sent: 0 };
    }

    const result = await admin.messaging().sendMulticast({
      tokens,
      notification: {
        title,
        body,
      },
      data: {
        type: 'broadcast',
        url,
      },
    });

    return {
      sent: result.successCount,
      failed: result.failureCount,
    };
  }
);

exports.onChatMessageCreated = functions.firestore
  .document('chats/{chatId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};

    const beforeMessages = Array.isArray(before.messages) ? before.messages : [];
    const afterMessages = Array.isArray(after.messages) ? after.messages : [];

    if (afterMessages.length <= beforeMessages.length) {
      return null;
    }

    const latest = afterMessages[afterMessages.length - 1];
    if (!latest) {
      return null;
    }

    const senderUid = latest?.uid;
    const recipientUids = new Set<string>();

    if (Array.isArray(after.members)) {
      after.members.forEach((uid: string) => uid && recipientUids.add(uid));
    }

    if (after.hasRead && typeof after.hasRead === 'object') {
      Object.keys(after.hasRead).forEach((uid) => recipientUids.add(uid));
    }

    if (after.uid) {
      recipientUids.add(after.uid);
    }

    if (senderUid) {
      recipientUids.delete(senderUid);
    }

    if (!recipientUids.size) {
      return null;
    }

    const tokens = await getUserTokensByUids(Array.from(recipientUids));
    if (!tokens.length) {
      return null;
    }

    const title =
      after?.type === 'group'
        ? after?.displayName || 'Group message'
        : 'New message';
    const body =
      latest?.type === 'audio'
        ? 'Sent a voice note.'
        : latest?.content || 'New message received.';

    const createdAt = admin.firestore.Timestamp.now();
    await writeUserNotifications(Array.from(recipientUids), {
      type: 'chat_message',
      title,
      body,
      createdAt,
      read: false,
      data: {
        landing_page: 'messages/chat',
        chatId: context.params.chatId,
      },
    });

    return admin.messaging().sendMulticast({
      tokens,
      notification: {
        title,
        body,
      },
      data: {
        type: 'chat_message',
        landing_page: 'messages/chat',
        chatId: context.params.chatId,
      },
    });
  });
