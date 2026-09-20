import { describe, expect, it } from "vitest";
import { gameLaunchUrl } from "./game-launch";

describe("abertura do jogo", () => {
  it.each([["normal", "com.dts.freefireth"], ["max", "com.dts.freefiremax"]] as const)("Android %s usa o pacote escolhido e retorna ao painel, sem loja", (game, pkg) => {
    const url = gameLaunchUrl(game, "Android Chrome", "https://app.example/painel?key=private#fragment")!;
    expect(url).toContain(`package=${pkg};`);
    const fallback = decodeURIComponent(url.match(/S.browser_fallback_url=([^;]+)/)![1]);
    expect(fallback).toBe(`https://app.example/painel?game_fallback=${game}`);
    expect(url).not.toMatch(/market:|play.google|private|fragment|scheme=android-app/);
  });
  it("mantém abertura iOS e não inventa abertura em desktop", () => {
    expect(gameLaunchUrl("normal", "iPhone", "https://app.example")).toBe("freefire://");
    expect(gameLaunchUrl("max", "Windows", "https://app.example")).toBeNull();
  });
});
