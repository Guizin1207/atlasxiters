import { describe, expect, it } from "vitest";
import { extractYouTubeEmbedUrl } from "@/lib/about-panel";

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