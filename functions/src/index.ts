/* eslint-disable import/no-unresolved */
import * as functions from 'firebase-functions/v1';
const admin = require('firebase-admin');
const fetch = require('node-fetch');
admin.initializeApp();

async function sendMulticastCompat(message: any) {
  const messaging = admin.messaging();
  if (typeof messaging.sendEachForMulticast === 'function') {
    return messaging.sendEachForMulticast(message);
  }
  if (typeof messaging.sendMulticast === 'function') {
    return messaging.sendMulticast(message);
  }
  throw new Error('Firebase Admin messaging multicast API is unavailable.');
}

exports.processSignUp = functions.auth.user().onCreate(async (user) => {
  // Only provision real (email-bearing) client accounts.
  if (!user.email) {
    return;
  }

  const db = admin.firestore();
  const now = Date.now();

  // 1) Custom claim so the account is recognised as a client. Previously this
  //    was gated on `user.emailVerified`, which is always false at onCreate for
  //    email/password sign-ups, so the claim was never actually set.
  try {
    await admin.auth().setCustomUserClaims(user.uid, { client: true });
  } catch (error: any) {
    console.warn('Unable to set custom claims for new user', error);
  }

  // 2) Provision the user's data atomically, server-side.
  //    This used to run on the client after sign-up, where a dropped
  //    connection or a closed app could leave an account with no workbook —
  //    and the workbook was written with `uid: undefined` because the client
  //    read the uid from localStorage before it had been set. Running it here
  //    guarantees every account is complete. Deterministic doc ids keep this
  //    idempotent if the platform retries the trigger. displayName + consent
  //    stay client-owned (SetUserData), so we deliberately don't touch them.
  const batch = db.batch();

  batch.set(
    db.collection('users').doc(user.uid),
    {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      photoURL: user.photoURL || null,
      role: 'client',
      createdAt: now,
    },
    { merge: true }
  );

  batch.set(db.collection('workbooks').doc(user.uid), {
    uid: user.uid,
    createdAt: now,
    count: 0,
    responses: [],
    coinBalance: 0,
    coinHistory: [],
    heroProfile: {
      heroName: '',
      alias: '',
      auraColor: '#5b21b6',
      originStory: '',
      signaturePower: '',
      secondaryPowers: [],
      unlockedUpgrades: [],
      motto: '',
      updatedAt: now,
    },
  });

  batch.set(db.collection('chats').doc(user.uid), {
    uid: user.uid,
    uids: [user.uid],
    recipientName: 'Private Chat',
    createdAt: now,
    count: 0,
    messages: [],
    type: 'private',
  });

  try {
    await batch.commit();
  } catch (error: any) {
    // Re-throw so the platform retries provisioning rather than silently
    // leaving a half-created account.
    console.error('Failed to provision new user data', error);
    throw error;
  }
});

exports.generateHeroAvatar = functions
  .runWith({ memory: '1GB', timeoutSeconds: 300, secrets: ['OPENAI_API_KEY'] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be signed in to generate an avatar.'
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
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
    const response = await fetch(
      'https://api.openai.com/v1/images/generations',
      {
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
      }
    );

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
  const powers = profile?.secondaryPowers?.length
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
  const roleAdminUsersSnap = await admin
    .firestore()
    .collection('users')
    .where('role', '==', 'Administrator')
    .get();
  const rolesAdminUsersSnap = await admin
    .firestore()
    .collection('users')
    .where('roles', 'array-contains', 'Administrator')
    .get();

  const docsById = new Map<string, any>();
  roleAdminUsersSnap.forEach((doc: any) => docsById.set(doc.id, doc));
  rolesAdminUsersSnap.forEach((doc: any) => docsById.set(doc.id, doc));
  const tokens: string[] = [];
  docsById.forEach((doc: any) => {
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

  // Native tokens stored by the mobile app (Capacitor PushNotifications).
  const nativeToken = data?.deviceId?.value ?? data?.deviceId ?? null;
  if (typeof nativeToken === 'string' && nativeToken.trim()) {
    tokens.push(nativeToken.trim());
  }

  return tokens;
}

async function getUserTokensByUids(uids: string[]): Promise<string[]> {
  if (!uids.length) {
    return [];
  }

  const refs = uids.map((uid) =>
    admin.firestore().collection('users').doc(uid)
  );
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

// One-off repair for accounts created before provisioning moved into
// processSignUp. The old client-side flow wrote workbooks with `uid: undefined`
// (it read the uid from localStorage before it was set), leaving accounts with
// no queryable workbook. This ensures every user has a workbook, a private
// chat, and a role. Admin-only. Safe to re-run: it only creates what's missing.
exports.backfillUserProvisioning = functions
  .runWith({ memory: '512MB', timeoutSeconds: 540 })
  .https.onCall(async (data: any, context: any) => {
    await assertAdmin(context);

    const db = admin.firestore();
    const usersSnap = await db.collection('users').get();

    let scanned = 0;
    let workbooksCreated = 0;
    let chatsCreated = 0;
    let usersUpdated = 0;

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const userData = userDoc.data() || {};
      const now = Date.now();
      scanned++;

      // Ensure a queryable workbook exists (orphaned uid:undefined docs don't
      // match this query, so a fresh one is created for the user).
      const wb = await db
        .collection('workbooks')
        .where('uid', '==', uid)
        .limit(1)
        .get();
      if (wb.empty) {
        await db.collection('workbooks').doc(uid).set(
          {
            uid,
            createdAt: now,
            count: 0,
            responses: [],
            coinBalance: 0,
            coinHistory: [],
            heroProfile: {
              heroName: '',
              alias: '',
              auraColor: '#5b21b6',
              originStory: '',
              signaturePower: '',
              secondaryPowers: [],
              unlockedUpgrades: [],
              motto: '',
              updatedAt: now,
            },
          },
          { merge: true }
        );
        workbooksCreated++;
      }

      // Ensure the user has at least one private chat.
      const chat = await db
        .collection('chats')
        .where('uids', 'array-contains', uid)
        .where('type', '==', 'private')
        .limit(1)
        .get();
      if (chat.empty) {
        await db.collection('chats').doc(uid).set(
          {
            uid,
            uids: [uid],
            recipientName: 'Private Chat',
            createdAt: now,
            count: 0,
            messages: [],
            type: 'private',
          },
          { merge: true }
        );
        chatsCreated++;
      }

      // Ensure a role is set.
      if (!userData.role) {
        await db
          .collection('users')
          .doc(uid)
          .set({ role: 'client' }, { merge: true });
        usersUpdated++;
      }
    }

    return { scanned, workbooksCreated, chatsCreated, usersUpdated };
  });

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

    const workbookAlreadyCompleted = Boolean(
      before.completedAt || after.completedAt
    );
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
            sendMulticastCompat({
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

    return sendMulticastCompat({
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

    const result = await sendMulticastCompat({
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
      typeof data?.url === 'string' && data.url.trim() ? data.url.trim() : '';

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

    const result = await sendMulticastCompat({
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

exports.requestCounsellorChat = functions.https.onCall(
  async (data, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be signed in.'
      );
    }

    const requesterUid = context.auth.uid;

    // Find an available counsellor.
    //
    // Notes:
    // - Firestore equality matching is case-sensitive.
    // - Some user docs may have role casing drift or even role objects (older migrations).
    // - "isOnline" can be stale if a client doesn't update cleanly; "lastSeenAt" is a safer fallback.
    const roleCandidates = ['Counsellor', 'counsellor', 'COUNSELLOR'];
    const nowMs = Date.now();
    const activeWindowMs = 5 * 60 * 1000; // 5 minutes

    // Prefer an index-friendly query first (role IN), then filter by availability in code.
    const counsellorsSnap = await admin
      .firestore()
      .collection('users')
      .where('role', 'in', roleCandidates)
      .limit(50)
      .get();

    const counsellors = counsellorsSnap.docs.map(
      (d: FirebaseFirestore.QueryDocumentSnapshot) => ({
        uid: d.id,
        ...(d.data() || {}),
      })
    ) as any[];

    const availableCounsellors = counsellors
      .filter((u) => {
        const roleLower =
          typeof u?.role === 'string'
            ? `${u.role}`.toLowerCase()
            : typeof u?.role?.name === 'string'
            ? `${u.role.name}`.toLowerCase()
            : '';
        if (roleLower !== 'counsellor') return false;

        const lastSeenAt =
          typeof u?.lastSeenAt === 'number'
            ? u.lastSeenAt
            : typeof u?.lastSeenAt?.toMillis === 'function'
            ? u.lastSeenAt.toMillis()
            : 0;

        const recentlyActive =
          lastSeenAt > 0 && nowMs - lastSeenAt <= activeWindowMs;
        return u?.isOnline === true || recentlyActive;
      })
      .sort((a, b) => {
        const aSeen =
          typeof a?.lastSeenAt === 'number'
            ? a.lastSeenAt
            : typeof a?.lastSeenAt?.toMillis === 'function'
            ? a.lastSeenAt.toMillis()
            : 0;
        const bSeen =
          typeof b?.lastSeenAt === 'number'
            ? b.lastSeenAt
            : typeof b?.lastSeenAt?.toMillis === 'function'
            ? b.lastSeenAt.toMillis()
            : 0;
        // Prefer explicit online first, then most recent activity.
        const aOnline = a?.isOnline === true ? 1 : 0;
        const bOnline = b?.isOnline === true ? 1 : 0;
        if (aOnline !== bOnline) return bOnline - aOnline;
        return bSeen - aSeen;
      });

    if (!availableCounsellors.length) {
      return { available: false };
    }

    const counsellor = availableCounsellors[0];
    const counsellorUid = counsellor.uid;

    // Continuity: if there's already a private chat between this requester and this counsellor,
    // reuse it instead of creating a fresh thread each time.
    //
    // We avoid composite-index-heavy queries by fetching a bounded set of the requester's private chats
    // and filtering in code.
    const existingChatsSnap = await admin
      .firestore()
      .collection('chats')
      .where('type', '==', 'private')
      .where('uids', 'array-contains', requesterUid)
      .limit(50)
      .get();

    const existingChats = existingChatsSnap.docs.map(
      (d: FirebaseFirestore.QueryDocumentSnapshot) => ({
        id: d.id,
        ...(d.data() || {}),
      })
    ) as any[];

    const matchingExisting = existingChats
      .filter((c) => Array.isArray(c?.uids) && c.uids.includes(counsellorUid))
      .sort((a, b) => {
        const aMsg =
          Array.isArray(a?.messages) && a.messages.length
            ? a.messages[a.messages.length - 1]?.createdAt
            : null;
        const bMsg =
          Array.isArray(b?.messages) && b.messages.length
            ? b.messages[b.messages.length - 1]?.createdAt
            : null;
        const aTs =
          typeof aMsg === 'number'
            ? aMsg
            : typeof a?.createdAt === 'number'
            ? a.createdAt
            : 0;
        const bTs =
          typeof bMsg === 'number'
            ? bMsg
            : typeof b?.createdAt === 'number'
            ? b.createdAt
            : 0;
        return bTs - aTs;
      });

    if (matchingExisting.length) {
      const chatId = matchingExisting[0].id;

      return { available: true, chatId, counsellorUid, reused: true };
    }

    const requesterDoc = await admin
      .firestore()
      .collection('users')
      .doc(requesterUid)
      .get();
    const requester = requesterDoc.exists ? requesterDoc.data() || {} : {};

    const chatRef = await admin
      .firestore()
      .collection('chats')
      .add({
        type: 'private',
        createdAt: admin.firestore.Timestamp.now(),
        status: 'pending',
        uids: [requesterUid, counsellorUid],
        uid: requesterUid,
        recipientName:
          counsellor?.displayName || counsellor?.email || 'Counsellor',
        recipientId: counsellorUid,
        messages: [],
        // Minimal metadata to help admin/support.
        request: {
          requestedAt: admin.firestore.Timestamp.now(),
          requesterUid,
          counsellorUid,
          requesterName: requester?.displayName || requester?.email || null,
          counsellorName:
            counsellor?.displayName || counsellor?.email || 'Counsellor',
          status: 'pending',
        },
      });


    return { available: true, chatId: chatRef.id, counsellorUid };
  }
);

exports.onChatMessageCreated = functions.firestore
  .document('chats/{chatId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};

    const beforeMessages = Array.isArray(before.messages)
      ? before.messages
      : [];
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

    // Primary source of truth: chat participants.
    if (Array.isArray(after.uids)) {
      after.uids.forEach((entry: any) => {
        if (typeof entry === 'string' && entry) {
          recipientUids.add(entry);
        } else if (
          entry &&
          typeof entry === 'object' &&
          typeof entry.uid === 'string'
        ) {
          recipientUids.add(entry.uid);
        }
      });
    }

    // Group chats may also keep a members array of objects.
    if (Array.isArray(after.members)) {
      after.members.forEach((m: any) => {
        if (typeof m === 'string' && m) {
          recipientUids.add(m);
        } else if (m && typeof m === 'object' && typeof m.uid === 'string') {
          recipientUids.add(m.uid);
        }
      });
    }

    if (after.hasRead && typeof after.hasRead === 'object') {
      Object.keys(after.hasRead).forEach((uid) => recipientUids.add(uid));
    }

    if (typeof after.uid === 'string' && after.uid) {
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

    const result = await sendMulticastCompat({
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
      android: {
        priority: 'high',
        notification: {
          channelId: 'pk_chat',
          sound: 'default',
        },
      },
    });

    return result;
  });

/**
 * Peekay Chat Entry Point (Phase 2 - GenKit RAG Flow)
 * Secure backend proxy for OpenAI with GenKit empathy guardrails and context memory.
 */
exports.peekayChat = functions
  .runWith({ memory: '1GB', timeoutSeconds: 300, secrets: ['OPENAI_API_KEY'] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be signed in.'
      );
    }

    try {
      const { runPeekayChat } = require('./ai');
      return await runPeekayChat({
        messages: data.messages,
        userId: context.auth.uid,
      });
    } catch (error: any) {
      console.error('Peekay Chat Error:', error);
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Peekay is resting.'
      );
    }
  });

async function deleteRefsInBatches(db: any, refs: any[]): Promise<void> {
  const chunkSize = 400;
  for (let i = 0; i < refs.length; i += chunkSize) {
    const batch = db.batch();
    refs.slice(i, i + chunkSize).forEach((ref: any) => batch.delete(ref));
    await batch.commit();
  }
}

/**
 * Right to erasure — cascade-delete a user's personal data when their auth
 * account is removed. The client (DeleteAccount) removes users/{uid} + the auth
 * account; this trigger cleans up everything else tied to the user.
 *
 * NOTE: Storage uploads are not namespaced by uid (paths like
 * `uploads/images/...`), so individual files cannot be located by uid here.
 * A per-user file registry would be needed to also purge Storage objects.
 */
exports.onUserDeleted = functions
  .runWith({ memory: '512MB', timeoutSeconds: 300 })
  .auth.user()
  .onDelete(async (user: any) => {
    const uid = user.uid;
    const db = admin.firestore();
    console.log(`[onUserDeleted] cascade-deleting data for ${uid}`);

    // 1. Peekay AI chat history (subcollection) + the user document itself.
    try {
      const peekaySnap = await db.collection(`users/${uid}/peekayChats`).get();
      await deleteRefsInBatches(db, peekaySnap.docs.map((d: any) => d.ref));
      await db.doc(`users/${uid}`).delete().catch(() => undefined);
    } catch (err) {
      console.error('[onUserDeleted] user doc / peekayChats', err);
    }

    // 2. Workbooks (reflections — sensitive data).
    try {
      const wbSnap = await db.collection('workbooks').where('uid', '==', uid).get();
      await deleteRefsInBatches(db, wbSnap.docs.map((d: any) => d.ref));
    } catch (err) {
      console.error('[onUserDeleted] workbooks', err);
    }

    // 3. Chats — delete private chats; remove membership + scrub the user's
    //    messages from group chats.
    try {
      const chatSnap = await db
        .collection('chats')
        .where('uids', 'array-contains', uid)
        .get();
      for (const doc of chatSnap.docs) {
        const data: any = doc.data() || {};
        if (data.type !== 'group') {
          await doc.ref.delete();
          continue;
        }
        const uids = (Array.isArray(data.uids) ? data.uids : []).filter(
          (u: string) => u !== uid
        );
        const members = (Array.isArray(data.members) ? data.members : []).filter(
          (m: any) => m?.uid !== uid
        );
        const messages = (Array.isArray(data.messages) ? data.messages : []).filter(
          (m: any) => m?.uid !== uid
        );
        const hasRead = { ...(data.hasRead || {}) };
        delete hasRead[uid];
        await doc.ref.update({ uids, members, messages, hasRead });
      }
    } catch (err) {
      console.error('[onUserDeleted] chats', err);
    }

    console.log(`[onUserDeleted] complete for ${uid}`);
    return null;
  });

interface PostIndexContext {
  text: string;
  interventionId: string | null;
  interventionName: string | null;
}

async function buildPostText(
  postId: string,
  postData: any
): Promise<PostIndexContext> {
  const parts: string[] = [];
  let interventionId: string | null = null;
  let interventionName: string | null = null;

  // Topical anchor: which intervention + chapter this post belongs to.
  // Embedding this makes a query like "suicide" or "depressed" match the
  // right intervention's posts even when the post body never uses that word.
  try {
    const chapterId = postData.chapterId;
    if (chapterId) {
      const chapterSnap = await admin
        .firestore()
        .collection('chapters')
        .doc(chapterId)
        .get();
      const chapterData: any = chapterSnap.data();
      interventionId = chapterData?.interventionId || null;
      if (interventionId) {
        const intvSnap = await admin
          .firestore()
          .collection('interventions')
          .doc(interventionId)
          .get();
        interventionName = intvSnap.data()?.name || null;
        if (interventionName) parts.push(`Intervention: ${interventionName}`);
      }
      if (chapterData?.title) parts.push(`Chapter: ${chapterData.title}`);
    }
  } catch (err) {
    console.warn(
      `buildPostText: could not resolve intervention/chapter for post ${postId}`,
      err
    );
  }

  if (postData.title) parts.push(`Topic: ${postData.title}`);
  if (postData.description) parts.push(postData.description);

  const questionsSnap = await admin
    .firestore()
    .collection('questions')
    .where('postId', '==', postId)
    .get();
  const narratives = questionsSnap.docs
    .map((d: any) => (d.data()?.narrative || '').trim())
    .filter(Boolean);
  if (narratives.length) {
    parts.push(`Reflection prompts (illustrative):\n${narratives.join('\n')}`);
  }

  return { text: parts.join('\n'), interventionId, interventionName };
}

/**
 * Intervention Post Indexer — keeps knowledge_index in sync with posts collection.
 * Handles create, update, and delete.
 */
exports.onPostWrite = functions
  .runWith({
    memory: '512MB',
    timeoutSeconds: 300,
    secrets: ['OPENAI_API_KEY'],
  })
  .firestore.document('posts/{postId}')
  .onWrite(async (change, context) => {
    const postId = context.params.postId;
    const docRef = admin
      .firestore()
      .collection('knowledge_index')
      .doc(`post_${postId}`);

    if (!change.after.exists) {
      await docRef.delete();
      return null;
    }

    const data = change.after.data();
    if (!data) return null;

    const { text, interventionId, interventionName } = await buildPostText(
      postId,
      data
    );
    if (!text.trim()) return null;

    const { getAi, openAI } = require('./ai');
    const ai = getAi();
    const embeddingResult = await ai.embed({
      embedder: openAI.embedder('text-embedding-3-small'),
      content: text,
    });

    await docRef.set({
      text,
      embedding: admin.firestore.FieldValue.vector(
        embeddingResult[0].embedding
      ),
      metadata: {
        postId,
        chapterId: data.chapterId || null,
        interventionId: interventionId || null,
        interventionName: interventionName || null,
        source: 'post',
        updatedAt: admin.firestore.Timestamp.now(),
      },
    });

    return null;
  });

/**
 * Backfill all existing posts into knowledge_index. Run once after deploy.
 * Admin-only callable.
 */
exports.indexAllPosts = functions
  .runWith({ memory: '1GB', timeoutSeconds: 540, secrets: ['OPENAI_API_KEY'] })
  .https.onCall(async (data, context) => {
    await assertAdmin(context);

    const postsSnap = await admin.firestore().collection('posts').get();
    const { getAi, openAI } = require('./ai');
    const ai = getAi();

    let indexed = 0;
    let skipped = 0;
    let failed = 0;

    for (const doc of postsSnap.docs) {
      const postId = doc.id;
      const postData = doc.data();
      if (!postData) {
        skipped++;
        continue;
      }

      try {
        const { text, interventionId, interventionName } = await buildPostText(
          postId,
          postData
        );
        if (!text.trim()) {
          skipped++;
          continue;
        }

        const embeddingResult = await ai.embed({
          embedder: openAI.embedder('text-embedding-3-small'),
          content: text,
        });

        await admin
          .firestore()
          .collection('knowledge_index')
          .doc(`post_${postId}`)
          .set({
            text,
            embedding: admin.firestore.FieldValue.vector(
              embeddingResult[0].embedding
            ),
            metadata: {
              postId,
              chapterId: postData.chapterId || null,
              interventionId: interventionId || null,
              interventionName: interventionName || null,
              source: 'post',
              updatedAt: admin.firestore.Timestamp.now(),
            },
          });

        indexed++;
      } catch (err) {
        console.error(`Failed to index post ${postId}:`, err);
        failed++;
      }
    }


    return { indexed, skipped, failed, total: postsSnap.size };
  });

/**
 * Therapeutic Content Validation (Phase 1)
 * Analyzes user reflection workbook responses for clinical relevance and effort.
 */
exports.validateAiResponse = functions
  .runWith({ memory: '1GB', timeoutSeconds: 300, secrets: ['OPENAI_API_KEY'] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Validation requires authentication.'
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'OpenAI configuration missing.'
      );
    }

    const { question, response, storyContext } = data;

    const systemPrompt =
      "You are a therapeutic content validator for Positive Konnections, an HIV support platform. Users provide reflections on their HERO's journey. Evaluate responses honestly and consistently.";

    const prompt = `EVALUATE THE FOLLOWING USER REFLECTION:

QUESTION: "${question}"
${storyContext ? `CONTEXT: "${storyContext}"` : ''}
USER RESPONSE: "${response}"

SCORING CRITERIA (1-10):
- RELEVANCE: Does the response address the question? For HIV/health questions, responses about medical experiences, emotions, stigma, treatment, disclosure, relationships, or social impact are all highly relevant (7-10).
- EFFORT: Does it show genuine thought (more than a few words, not vague filler)?
- REFLECTION: Does it demonstrate personal insight or self-awareness?

SCORE GUIDE:
1-2: Completely off-topic or trolling (e.g., unrelated topics with no connection to health, emotions, or life)
3-4: Vague or minimal effort (e.g., "It was okay", "I don't know", "fine")
5-6: Addresses the question with basic relevant content but lacks depth
7-8: Good response with personal insight and relevant detail
9-10: Excellent — multiple specific points, deep reflection, clear connection to personal experience

Respond ONLY in JSON:
{
  "score": number,
  "is_valid": boolean,
  "feedback": "string explaining the score",
  "suggestions": "how to improve if score < 6, otherwise empty string"
}`;

    const apiResponse = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
        }),
      }
    );

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error(
        'OpenAI validation API error:',
        apiResponse.status,
        errText
      );
      throw new functions.https.HttpsError(
        'unavailable',
        'Validation service temporarily unavailable.'
      );
    }

    try {
      const result = await apiResponse.json();
      return JSON.parse(result.choices[0].message.content);
    } catch (parseError) {
      console.error('Validation response parse error:', parseError);
      throw new functions.https.HttpsError(
        'internal',
        'Validation returned an unexpected response.'
      );
    }
  });
