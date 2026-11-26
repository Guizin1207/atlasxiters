import { describe, expect, it } from "vitest";
import { extractYouTubeEmbedUrl, getGrantedFeedbackCoins, isValidAdminFeedbackReply } from "@/lib/about-panel";

describe("extractYouTubeEmbedUrl", () => {
  it("converte link watch padrão do YouTube para embed", () => {
    expect(extractYouTubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ"
    );
  });

  it("converte link curto youtu.be e shorts para embed", () => {
    expect(extractYouTubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ?t=10")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ"
    );
    expect(extractYouTubeEmbedUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ"
    );
  });

  it("rejeita links que não são do YouTube ou IDs inválidos", () => {
    expect(extractYouTubeEmbedUrl("https://vimeo.com/123456789")).toBeNull();
    expect(extractYouTubeEmbedUrl("https://www.youtube.com/watch?v=curto")).toBeNull();
    expect(extractYouTubeEmbedUrl("javascript:alert(1)")).toBeNull();
    expect(extractYouTubeEmbedUrl("")).toBeNull();
  });
});

describe("prêmio e respostas do feedback", () => {
  it("concede exatamente 25 Atlas Coins no primeiro feedback premiado do dia", () => {
    expect(getGrantedFeedbackCoins({ rewarded: true, reward_coins: 25 })).toBe(25);
  });

  it("não concede coins novamente quando o prêmio diário já foi recebido", () => {
    expect(getGrantedFeedbackCoins({ rewarded: false, reward_coins: 0 })).toBe(0);
    expect(getGrantedFeedbackCoins({ rewarded: false, reward_coins: 25 })).toBe(0);
  });

  it("aceita respostas do ADM entre 2 e 1000 caracteres", () => {
    expect(isValidAdminFeedbackReply("Oi")).toBe(true);
    expect(isValidAdminFeedbackReply("a".repeat(1000))).toBe(true);
    expect(isValidAdminFeedbackReply(" a ")).toBe(false);
    expect(isValidAdminFeedbackReply("a".repeat(1001))).toBe(false);
  });
});