// ─── Апп доторх хөтөч илрүүлэх ────────────────────────────────────────────────
// Messenger, Facebook, Instagram, Viber зэрэг апп-ын доторх хөтчид Google
// аюулгүй байдлын үүднээс нэвтрэхийг хориглодог (403 disallowed_useragent).
// Холбоосыг чатаар илгээхэд ихэвчлэн ийм хөтчөөр нээгддэг тул хэрэглэгчид
// "жинхэнэ хөтчөөр нээ" гэж урьдчилан хэлнэ.

export type InAppBrowser = { app: string; android: boolean } | null;

// Дараалал чухал: Messenger-ийн user-agent нь Facebook-ийн тэмдгүүдийг ч агуулдаг
const APPS: [RegExp, string][] = [
  [/Orca-Android|MessengerForiOS|MessengerLite/i, "Messenger"],
  [/FBAN|FBAV|FB_IAB|FBIOS/i, "Facebook"],
  [/Instagram/i, "Instagram"],
  [/Viber/i, "Viber"],
  [/Line\//, "LINE"],
  [/KAKAOTALK/i, "KakaoTalk"],
  [/MicroMessenger/i, "WeChat"],
  [/TikTok|musical_ly|BytedanceWebview/i, "TikTok"],
  [/Snapchat/i, "Snapchat"],
  [/Telegram/i, "Telegram"],
];

export function detectInAppBrowser(userAgent: string): InAppBrowser {
  const android = /Android/i.test(userAgent);
  for (const [pattern, app] of APPS) {
    if (pattern.test(userAgent)) return { app, android };
  }
  // Ерөнхий WebView: Android "; wv)", iOS дээр Safari гэсэн тэмдэггүй WebKit
  if (android && /; wv\)/.test(userAgent)) return { app: "апп", android };
  if (/(iPhone|iPad|iPod)/.test(userAgent) && /AppleWebKit/.test(userAgent) && !/Safari\//.test(userAgent)) {
    return { app: "апп", android: false };
  }
  return null;
}

// Android дээр Chrome-оор шууд нээх intent холбоос
export function chromeIntentUrl(href: string): string | null {
  try {
    const url = new URL(href);
    return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.replace(":", "")};package=com.android.chrome;end`;
  } catch {
    return null;
  }
}
