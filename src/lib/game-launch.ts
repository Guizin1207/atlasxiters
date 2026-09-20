export type GameVariant = "normal" | "max";

export function gameLaunchUrl(game: GameVariant, userAgent: string, pageUrl: string): string | null {
  const scheme = game === "max" ? "freefiremax" : "freefire";
  if (/android/i.test(userAgent)) {
    const packageName = game === "max" ? "com.dts.freefiremax" : "com.dts.freefireth";
    const fallback = new URL(pageUrl);
    fallback.search = "";
    fallback.hash = "";
    fallback.searchParams.set("game_fallback", game);
    return `intent://#Intent;scheme=${scheme};package=${packageName};S.browser_fallback_url=${encodeURIComponent(fallback.href)};end`;
  }
  if (/iphone|ipad|ipod/i.test(userAgent)) return `${scheme}://`;
  return null;
}
