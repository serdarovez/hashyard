/**
 * Where to land after signing in. Google sends people back to the home page,
 * so the page they were on is remembered before they leave (sessionStorage
 * survives the round trip in the same tab) and picked up once signed in.
 */
const KEY = 'hy-after-login';
const FRESH_MS = 15 * 60e3;

const read = () => {
  const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
  return saved && Date.now() - saved.at < FRESH_MS ? saved : null;
};

/** Remember a page to return to; with no page, the dashboard - unless one was just chosen. */
export function rememberReturn(to) {
  try {
    // e.g. "Log in" pressed on a machine page, then the button on the login page
    if (!to && read()) return;
    sessionStorage.setItem(KEY, JSON.stringify({ to: to || '#/dashboard', at: Date.now() }));
  } catch { /* storage blocked: they land on the home page instead */ }
}

/** The remembered page, if any from the last 15 minutes. Reading it clears it. */
export function takeReturn() {
  try {
    const saved = read();
    sessionStorage.removeItem(KEY);
    return saved ? saved.to : null;
  } catch {
    return null;
  }
}
