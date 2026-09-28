#!/usr/bin/env node
// ---------------------------------------------------------------------------
// TUCASA TIA Mbeya — live Firebase integration diagnostics
//
//   npm run check:firebase
//
// Optional signed-in checks (uses a real account; nothing is written):
//   PowerShell:  $env:TEST_EMAIL="you@example.com"; $env:TEST_PASSWORD="..."; npm run check:firebase
//   bash:        TEST_EMAIL=you@example.com TEST_PASSWORD=... npm run check:firebase
//
// Read-only: this script never creates users or writes documents.
// ---------------------------------------------------------------------------

import { loadEnv } from 'vite';

const mode = process.argv.includes('--production') ? 'production' : 'development';
const env = loadEnv(mode, process.cwd(), 'VITE_');

const cfg = {
  apiKey: env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: env.VITE_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: env.VITE_FIREBASE_APP_ID?.trim()
};

// Mimic the browser so API keys restricted to HTTP referrers still validate.
const REFERER = 'http://localhost:5173/';

let failures = 0;
let warnings = 0;

const color = (code) => (text) => (process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text);
const green = color(32);
const red = color(31);
const yellow = color(33);
const bold = color(1);
const dim = color(2);

const pass = (msg) => console.log(`  ${green('✔')} ${msg}`);
const fail = (msg, fix) => {
  failures += 1;
  console.log(`  ${red('✖')} ${msg}`);
  if (fix) console.log(`    ${dim('→ ' + fix)}`);
};
const warn = (msg, fix) => {
  warnings += 1;
  console.log(`  ${yellow('⚠')} ${msg}`);
  if (fix) console.log(`    ${dim('→ ' + fix)}`);
};
const section = (title) => console.log(`\n${bold(title)}`);

async function request(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: { Referer: REFERER, 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { ok: res.ok, status: res.status, body };
  } catch (error) {
    return { ok: false, status: 0, body: null, networkError: error };
  }
}

const errorMessage = (res) => {
  const body = Array.isArray(res.body) ? res.body[0] : res.body;
  return body?.error?.message || body?.error?.status || `HTTP ${res.status}`;
};

const firestoreBase = () =>
  `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents`;

function runQuery(structuredQuery, idToken) {
  return request(`${firestoreBase()}:runQuery?key=${cfg.apiKey}`, {
    method: 'POST',
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
    body: JSON.stringify({ structuredQuery })
  });
}

const arrayContainsQuery = (tag) => ({
  from: [{ collectionId: 'announcements' }],
  where: {
    fieldFilter: {
      field: { fieldPath: 'visibleTo' },
      op: 'ARRAY_CONTAINS',
      value: { stringValue: tag }
    }
  },
  limit: 20
});

const countDocs = (res) => (Array.isArray(res.body) ? res.body.filter((row) => row.document).length : 0);

// ------------------------------------------------------------------ checks
async function checkEnv() {
  section(`1. Environment (${mode} → .env, .env.local, .env.${mode}, .env.${mode}.local)`);

  const names = {
    apiKey: 'VITE_FIREBASE_API_KEY',
    authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
    projectId: 'VITE_FIREBASE_PROJECT_ID',
    storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
    messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
    appId: 'VITE_FIREBASE_APP_ID'
  };

  const missing = Object.entries(names).filter(([key]) => !cfg[key]);
  if (missing.length) {
    missing.forEach(([, name]) => fail(`${name} is empty`, 'Copy it from Firebase Console → Project settings → Your apps → Config'));
    return false;
  }
  pass('All 6 VITE_FIREBASE_* variables are set');

  const quoted = Object.entries(cfg).filter(([, v]) => /^["']|["']$/.test(v));
  if (quoted.length) warn(`Values look quoted: ${quoted.map(([k]) => k).join(', ')}`, 'Remove the quotes in .env.local');

  if (/^AIza[0-9A-Za-z_-]{35}$/.test(cfg.apiKey)) pass('apiKey format looks valid');
  else warn('apiKey does not match the usual AIza… 39-character format');

  if (/^[a-z0-9-]{6,30}$/.test(cfg.projectId)) pass(`projectId "${cfg.projectId}"`);
  else warn(`projectId "${cfg.projectId}" looks unusual`);

  if (cfg.authDomain.startsWith(`${cfg.projectId}.`)) pass(`authDomain matches projectId`);
  else warn(`authDomain "${cfg.authDomain}" does not start with the projectId`, 'Fine for custom domains; otherwise re-copy the config');

  if (/^\d+$/.test(cfg.messagingSenderId)) pass('messagingSenderId is numeric');
  else fail('messagingSenderId should be numeric');

  const appIdMatch = cfg.appId.match(/^1:(\d+):web:[0-9a-f]+$/);
  if (!appIdMatch) fail('appId should look like 1:<senderId>:web:<hex>', 'Make sure you copied the WEB app config, not Android/iOS');
  else if (appIdMatch[1] !== cfg.messagingSenderId) fail('appId sender number does not match messagingSenderId', 'Both values must come from the same Firebase project');
  else pass('appId belongs to this project');

  return true;
}

async function checkAuth() {
  section('2. Firebase Authentication');

  const res = await request(
    `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=${cfg.apiKey}`
  );

  if (res.networkError) {
    fail(`Network error: ${res.networkError.message}`, 'Check your internet connection / proxy');
    return false;
  }
  if (!res.ok) {
    fail(`API key rejected: ${errorMessage(res)}`, 'Re-copy the apiKey, or relax its restrictions in Google Cloud Console → Credentials');
    return false;
  }

  pass('API key accepted by Firebase Auth');

  // getProjectConfig reports the numeric project NUMBER, which equals messagingSenderId.
  const reported = res.body?.projectId;
  if (reported) {
    const matches = /^\d+$/.test(reported) ? reported === cfg.messagingSenderId : reported === cfg.projectId;
    if (matches) pass(`API key belongs to this project (${reported})`);
    else fail(`API key belongs to a different project (${reported})`, 'Re-copy apiKey and messagingSenderId from the same Firebase web app');
  }

  const domains = res.body?.authorizedDomains || [];
  if (domains.includes('localhost')) pass('localhost is an authorized domain');
  else warn('localhost is not an authorized domain', 'Authentication → Settings → Authorized domains → add localhost');

  // Probe the email/password provider with a throwaway login (no account is created).
  const probe = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${cfg.apiKey}`, {
    method: 'POST',
    body: JSON.stringify({
      email: `diagnostic-probe-${Date.now()}@example.invalid`,
      password: 'not-a-real-password',
      returnSecureToken: true
    })
  });
  const code = errorMessage(probe);
  if (/PASSWORD_LOGIN_DISABLED|OPERATION_NOT_ALLOWED/.test(code)) {
    fail('Email/Password sign-in is disabled', 'Authentication → Sign-in method → enable Email/Password');
  } else if (/INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND|INVALID_PASSWORD|INVALID_EMAIL/.test(code)) {
    pass('Email/Password sign-in is enabled');
  } else {
    warn(`Could not confirm Email/Password provider (${code})`);
  }
  return true;
}

async function checkPublicFirestore() {
  section('3. Firestore (guest / public website)');

  const publicRes = await runQuery(arrayContainsQuery('reader'));

  if (publicRes.networkError) {
    fail(`Network error: ${publicRes.networkError.message}`);
    return false;
  }
  if (publicRes.status === 404 || /does not exist|NOT_FOUND/.test(errorMessage(publicRes))) {
    fail('Firestore database "(default)" does not exist', 'Firebase Console → Firestore Database → Create database');
    return false;
  }
  if (/SERVICE_DISABLED|has not been used|is disabled/i.test(errorMessage(publicRes))) {
    fail('Cloud Firestore API is not enabled for this project', 'Create the Firestore database in the Firebase Console');
    return false;
  }
  if (!publicRes.ok) {
    fail(`Public announcement query denied: ${errorMessage(publicRes)}`, 'Deploy the rules: npm run deploy:rules');
  } else {
    const n = countDocs(publicRes);
    pass(`Guests can read public announcements (${n} found)`);
    if (n === 0) warn('No announcements tagged "reader" yet', 'Publish one from /leader/publish with Readers ticked');
  }

  // A correctly locked database must refuse a guest listing everything.
  const openRes = await runQuery({ from: [{ collectionId: 'announcements' }], limit: 1 });
  if (openRes.ok) {
    fail('Guests can list ALL announcements — rules are too open (test mode?)', 'Deploy the hardened rules: npm run deploy:rules');
  } else {
    pass('Guests are blocked from members-only announcements');
  }

  const usersRes = await runQuery({ from: [{ collectionId: 'users' }], limit: 1 });
  if (usersRes.ok) fail('Guests can list the users collection — personal data is exposed!', 'Deploy the hardened rules immediately');
  else pass('Guests are blocked from the users registry');

  return true;
}

async function checkSignedIn() {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  section('4. Signed-in checks');
  if (!email || !password) {
    console.log(dim('  Skipped — set TEST_EMAIL and TEST_PASSWORD to test a real account.'));
    return;
  }

  const login = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${cfg.apiKey}`, {
    method: 'POST',
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  if (!login.ok) {
    fail(`Sign-in failed for ${email}: ${errorMessage(login)}`);
    return;
  }
  const { idToken, localId } = login.body;
  pass(`Signed in as ${email} (uid ${localId})`);

  const profileRes = await request(`${firestoreBase()}/users/${localId}?key=${cfg.apiKey}`, {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  if (profileRes.status === 404) {
    fail('No users/{uid} profile document exists for this account', 'Register through /register, or create the document in the console');
    return;
  }
  if (!profileRes.ok) {
    fail(`Cannot read own profile: ${errorMessage(profileRes)}`, 'Deploy the rules: npm run deploy:rules');
    return;
  }

  const fields = profileRes.body.fields || {};
  const role = fields.role?.stringValue;
  const status = fields.status?.stringValue;
  pass(`Profile readable → role "${role}"${status ? `, status "${status}"` : ''}`);

  if (role === 'leader') {
    const all = await runQuery({ from: [{ collectionId: 'announcements' }], limit: 20 }, idToken);
    if (all.ok) pass(`Leader can read all announcements (${countDocs(all)} found)`);
    else fail(`Leader announcement read denied: ${errorMessage(all)}`);

    const registry = await runQuery({ from: [{ collectionId: 'users' }], limit: 200 }, idToken);
    if (registry.ok) pass(`Leader can list the registry (${countDocs(registry)} users in first page)`);
    else fail(`Leader registry read denied: ${errorMessage(registry)}`);
  } else {
    const feed = await runQuery(arrayContainsQuery(role), idToken);
    if (feed.ok) pass(`${role} feed query allowed (${countDocs(feed)} announcements)`);
    else fail(`${role} feed query denied: ${errorMessage(feed)}`, 'Compare deployed rules with firestore.rules; run npm run test:rules');

    const registry = await runQuery({ from: [{ collectionId: 'users' }], limit: 1 }, idToken);
    if (registry.ok) fail('Non-leader can list the users registry!');
    else pass('Non-leader is blocked from the users registry');
  }
}

async function checkCloudinary() {
  section('5. Cloudinary (profile pictures)');
  const cloudName = env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
  const preset = env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();

  if (!cloudName || !preset) {
    warn('Cloudinary is not configured — registration works, but the photo upload is disabled',
      'Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in .env.local');
    return;
  }

  // Upload nothing: an empty POST reveals whether the cloud and preset exist without storing a file.
  const body = new FormData();
  body.append('upload_preset', preset);
  let res;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body });
  } catch (error) {
    fail(`Network error reaching Cloudinary: ${error.message}`);
    return;
  }
  const data = await res.json().catch(() => ({}));
  const msg = data?.error?.message || '';

  if (/Missing required parameter - file/i.test(msg)) {
    pass(`Cloud "${cloudName}" and unsigned preset "${preset}" are reachable`);
  } else if (/unknown api key|cloud_name|Invalid cloud_name/i.test(msg) || res.status === 404) {
    fail(`Cloud name "${cloudName}" was not found`, 'Copy the exact cloud name from the Cloudinary dashboard');
  } else if (/preset/i.test(msg)) {
    fail(`Upload preset "${preset}" is invalid or not UNSIGNED (${msg})`, 'Settings → Upload → Upload presets → set Signing mode to Unsigned');
  } else {
    warn(`Could not confirm the Cloudinary setup (${msg || `HTTP ${res.status}`})`);
  }
}

// -------------------------------------------------------------------- main
console.log(bold('\nTUCASA TIA Mbeya · Firebase diagnostics'));

const envOk = await checkEnv();
if (envOk) {
  const authOk = await checkAuth();
  if (authOk) {
    const dbOk = await checkPublicFirestore();
    if (dbOk) await checkSignedIn();
  }
}
await checkCloudinary();

console.log(
  `\n${failures ? red(`${failures} failed`) : green('0 failed')}, ${warnings ? yellow(`${warnings} warnings`) : '0 warnings'}\n`
);
process.exit(failures ? 1 : 0);
