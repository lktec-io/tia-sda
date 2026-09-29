// Structured console output for Firestore listener failures, so a "permission-denied"
// can be traced to the exact query and account that triggered it.
export function logFirestoreError(context, error, details = {}) {
  console.error(`[Firestore] ${context} failed`, {
    code: error?.code ?? 'unknown',
    message: error?.message ?? String(error),
    ...details
  });

  if (error?.code === 'permission-denied') {
    console.warn(
      `[Firestore] ${context}: the DEPLOYED security rules rejected this query. ` +
        'If this account has role "leader" in users/{uid}, deploy the latest firestore.rules ' +
        '(npm run deploy:rules) — older rule versions also required a status field.'
    );
  }
}
