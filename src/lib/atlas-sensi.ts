/**
 * Gerador de sensibilidade (estilo IA) — base Free Fire 2026.
 * Determinístico: mesmos dados de entrada = mesmo resultado.
 */

export type SensiStyle = "precisao" | "equilibrado" | "agressivo";

export type SensiInput = {
  device: string; // modelo do aparelho
  dpi: number; // dpi do aparelho (Android)
  refreshRate: 60 | 90 | 120;
  ram: "3-4" | "6-8" | "12+";
  deviceAge: 0 | 1 | 2 | 3;
  fingers: 2 | 3 | 4;
  style: SensiStyle;
};

export type SensiResult = {
  geral: number;
  pontoVermelho: number;
  mira2x: number;
  mira4x: number;
  miraAwm: number;
  olharLivre: number;
  dpiRecomendado: number;
  precisaoEstimada: number; // %
  resposta: string;
};

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const clamp = (n: number) => Math.max(20, Math.min(200, Math.round(n)));

const STYLE_BIAS: Record<SensiStyle, number> = {
  precisao: -12,
  equilibrado: 0,
  agressivo: 14,
};

export function generateSensi(input: SensiInput): SensiResult {
  const seed = hash(
    `${input.device.trim().toLowerCase()}|${input.dpi}|${input.fingers}|${input.style}|${input.refreshRate}|${input.ram}|${input.deviceAge}|ff2026`
  );
  const r = (i: number, spread: number) =>
    ((seed >> (i * 3)) % (spread * 2 + 1)) - spread;

  const bias = STYLE_BIAS[input.style];
  const dpiFactor = 480 / Math.max(180, Math.min(900, input.dpi));
  const fingerBonus = (input.fingers - 2) * 5;

  const base = {
    geral: 96,
    pontoVermelho: 92,
    mira2x: 85,
    mira4x: 72,
    miraAwm: 60,
    olharLivre: 70,
  };

  const res: SensiResult = {
    geral: clamp((base.geral + bias + fingerBonus + r(1, 8)) * dpiFactor),
    pontoVermelho: clamp((base.pontoVermelho + bias + fingerBonus + r(2, 8)) * dpiFactor),
    mira2x: clamp((base.mira2x + bias + r(3, 9)) * dpiFactor),
    mira4x: clamp((base.mira4x + bias + r(4, 9)) * dpiFactor),
    miraAwm: clamp((base.miraAwm + Math.round(bias / 2) + r(5, 10)) * dpiFactor),
    olharLivre: clamp((base.olharLivre + bias + r(6, 10)) * dpiFactor),
    dpiRecomendado: Math.round(Math.max(320, Math.min(720, input.dpi * 1.05))),
    precisaoEstimada: 88 + (seed % 9),
    resposta: input.style === "precisao"
      ? "Calibração focada em controle e microajuste."
      : input.style === "agressivo"
      ? "Calibração focada em resposta rápida no rush."
      : "Calibração equilibrada para controle e arrasto.",
  };

  return res;
}
