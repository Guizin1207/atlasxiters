export function detectDevice(): string {
  if (typeof navigator === "undefined") return "Desconhecido";
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod/i.test(ua) || (/mac/i.test(platform) && navigator.maxTouchPoints > 1)) return "iOS";
  if (/windows phone/i.test(ua)) return "Windows";
  if (/cros/i.test(ua)) return "Linux";
  if (/windows/i.test(ua) || /win/i.test(platform)) return "Windows";
  if (/macintosh|mac os x/i.test(ua)) return "Mac";
  if (/linux/i.test(ua)) return "Linux";
  return "Desconhecido";
}
