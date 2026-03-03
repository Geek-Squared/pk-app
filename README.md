# Web Notifications Plan (Workbook Completion -> Admins)

Goal: When a user completes a workbook in the mobile/web app, notify admins in the admin web app using Firebase Cloud Messaging (web) and keep a Firestore notification record for in-app admin history.

## Architecture (high level)
1. User completes a workbook in the app (`pk-app-latest`).
2. The app writes/updates a Firestore document marking the workbook as `completed` with a timestamp.
3. A Firebase Cloud Function triggers on that Firestore change, creates an admin notification record, and sends an FCM push to all admin devices.
4. The admin web app (`pk-admin-v3`) receives the web push (browser notification) and can also render the notification list from Firestore.

## Data Model (proposed)
- `workbookCompletions/{completionId}`
  - `userId`
  - `workbookId`
  - `status` (`completed`)
  - `completedAt` (server timestamp)
  - `completedBy` (user id)
  - `title` (optional, workbook title)

- `adminNotifications/{notificationId}`
  - `type` (`workbook_completed`)
  - `userId`
  - `workbookId`
  - `title`
  - `message`
  - `createdAt` (server timestamp)
  - `readBy` (map of admin uid -> timestamp, optional)

- `adminUsers/{adminUid}`
  - `fcmTokens` (array or subcollection of tokens)
  - `role` (`admin`)

## Cloud Function (single source of truth)
Location: Use one Firebase Functions codebase (either `pk-app-latest/functions` or `pk-admin-v3/functions`) to avoid duplicates.

Trigger:
- `onWrite` or `onUpdate` for `workbookCompletions/{completionId}`.
- Only fire when `status` changes to `completed` and was not previously `completed`.

Actions:
- Create `adminNotifications` document.
- Fetch admin FCM tokens (from `adminUsers` collection or `admins` topic).
- Send FCM notification using Admin SDK.
- Guard against duplicates by checking previous status.

## Admin Web Notifications (pk-admin-v3)
1. Add Firebase Messaging (web) with a VAPID public key.
2. Register `firebase-messaging-sw.js` in `src/` (or `src/assets` and copy to root on build).
3. On admin login, request notification permission and call `getToken()`.
4. Store the token under `adminUsers/{adminUid}`.
5. Handle foreground messages and show UI toast/snackbar + add to Firestore list if needed.

## App Side (pk-app-latest)
1. When a user completes a workbook, write/update `workbookCompletions/{completionId}` with `status: completed` and `completedAt`.
2. Do not send FCM from the client. Only use the Cloud Function.

## Security Rules (Firestone)
- Users can only write their own `workbookCompletions`.
- Only admins can read `adminNotifications`.
- Only the authenticated admin can write their own FCM token in `adminUsers/{adminUid}`.

## Deployment Steps
1. Add messaging config and VAPID key in `pk-admin-v3` environment files.
2. Add the service worker file and register it in the admin app bootstrap.
3. Implement token storage for admins and an admin role check.
4. Implement Cloud Function and deploy (`firebase deploy --only functions`).
5. Verify notifications on Chrome (must be HTTPS or localhost).

## Testing Checklist
1. Complete a workbook in the app and confirm `workbookCompletions` write.
2. Verify Cloud Function logs for trigger and FCM send.
3. Confirm admin token stored in Firestore.
4. Receive web notification in admin app (foreground and background).
5. Verify `adminNotifications` entry is created and visible in admin UI.

Notes
- Web push requires HTTPS and user permission.
- Use a single functions codebase tied to the Firebase project to avoid double triggers.
- Consider topic-based targeting (e.g., `admins`) if all admin devices should always receive notifications.
