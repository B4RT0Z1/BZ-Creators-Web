export const CONSENT_KEY = "bz_cookie_choice_v1";
export const CONSENT_EVENT = "bz-cookie-preferences";
export const CONSENT_MAX_AGE = 183 * 24 * 60 * 60 * 1000;
export type CookieChoice = "accepted" | "rejected";
type ConsentWindow = Window & { dataLayer?: unknown[] };

export function readCookieChoice(): CookieChoice | null {
  try {
    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null");
    if (!stored || !["accepted", "rejected"].includes(stored.choice) || !Number.isFinite(stored.at) || stored.at > Date.now()) return null;
    const expiration = new Date(stored.at); expiration.setUTCMonth(expiration.getUTCMonth() + 6);
    if (Date.now() >= expiration.getTime()) return null;
    return stored.choice;
  } catch { return null; }
}

export function saveCookieChoice(choice: CookieChoice) {
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice, at: Date.now() })); } catch { /* Respect the choice for this visit even if persistence is unavailable. */ }
}

export function loadOptionalTags() {
  if (document.getElementById("bz-optional-gtm")) return;
  const target = window as ConsentWindow;
  target.dataLayer = target.dataLayer || [];
  target.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.id = "bz-optional-gtm";
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtm.js?id=GTM-NZJTZ9JT";
  document.head.appendChild(script);
}

export function openCookiePreferences() {
  window.dispatchEvent(new Event(CONSENT_EVENT));
}
