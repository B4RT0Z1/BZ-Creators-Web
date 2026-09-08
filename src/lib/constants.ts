export const WHATSAPP_NUMBER = "5492227611666";
export const OPEN_SOURCE_GITHUB_ACCOUNT = "opensource-bzcreators";
export const OPEN_SOURCE_GITHUB_URL = `https://github.com/${OPEN_SOURCE_GITHUB_ACCOUNT}`;

export const getWhatsAppUrl = (message: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

export const isOpenSourceHost = window.location.hostname.toLowerCase() === "opensource.bzcreators.com.ar";
export const mainSiteUrl = (path: string) => isOpenSourceHost ? `https://bzcreators.com.ar${path}` : path;
export const openSourceUrl = window.location.hostname.endsWith("bzcreators.com.ar")
  ? "https://opensource.bzcreators.com.ar" : "/opensource";
