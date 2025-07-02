import * as functions from 'firebase-functions';
const admin = require('firebase-admin');
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
