// Creates real users in the Firebase Auth emulator and returns their ID tokens.
const EMU = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;
const PROJECT = process.env.FIREBASE_PROJECT_ID;

export async function emulatorUp() {
  try { const r = await fetch(`${EMU}/`); return r.ok; } catch { return false; }
}

export async function clearUsers() {
  await fetch(`${EMU}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

export async function signUp(email, password = 'Secure123!') {
  const r = await fetch(`${EMU}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  return { token: j.idToken, uid: j.localId };
}

export const validProfile = {
  displayName: 'Ankita Kestwal',
  category: 'student',
  education: { level: 'undergraduate', board: '', institution: 'SVVV Indore', course: 'B.Tech Data Science', semester: '3' },
  interests: ['DBMS', 'Cloud Computing'],
  learningLevel: 'intermediate',
};
