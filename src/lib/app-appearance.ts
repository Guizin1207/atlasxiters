export const APP_THEMES = [
  { id: "default", name: "Atlas padrão", symbol: "✦" },
  { id: "halloween", name: "Halloween", symbol: "🎃" },
  { id: "christmas", name: "Natal", symbol: "🎄" },
  { id: "independence", name: "Independência", symbol: "🇧🇷" },
  { id: "new-year", name: "Ano Novo", symbol: "🎆" },
  { id: "children", name: "Dia das Crianças", symbol: "🪁" },
  { id: "easter", name: "Páscoa", symbol: "🐰" },
  { id: "carnival", name: "Carnaval", symbol: "🎭" },
] as const;
export type AppTheme = (typeof APP_THEMES)[number]["id"];
export type AppAppearance = { theme: AppTheme; logo: string };
export const DEFAULT_APPEARANCE: AppAppearance = { theme: "default", logo: "" };
export function normalizeAppearance(value: unknown): AppAppearance {
  const raw = value as Partial<AppAppearance> | null;
  return {
    theme: APP_THEMES.some((t) => t.id === raw?.theme) ? raw?.theme ?? "default" : "default",
    logo: typeof raw?.logo === "string" && raw.logo.length <= 400000 && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(raw.logo) ? raw.logo : "",
  };
}
export async function prepareAppLogo(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
    throw new Error("Escolha uma imagem PNG, JPG ou WebP de até 5 MB.");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    const ratio = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível preparar a logo.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const logo = canvas.toDataURL("image/png");
    if (logo.length > 400000) throw new Error("Imagem muito detalhada. Escolha uma logo mais simples.");
    return logo;
  } finally { URL.revokeObjectURL(url); }
}