/**
 * Gerador de sensibilidade (estilo IA) — base Free Fire 2026.
 * Determinístico: mesmos dados de entrada = mesmo resultado.
 */

export type SensiStyle = "precisao" | "equilibrado" | "agressivo";

export type SensiInput = {
  device: string; // modelo do aparelho
  dpi: number; // dpi do aparelho (mobile: 300-600)
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
  notas: string[];
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
    `${input.device.trim().toLowerCase()}|${input.dpi}|${input.fingers}|${input.style}|ff2026`
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
    notas: [],
  };

  res.notas = [
    input.style === "precisao"
      ? "Perfil focado em headshot parado: puxe a mira devagar em rajadas curtas."
      : input.style === "agressivo"
      ? "Perfil de rush: giros rápidos, ideal para combate próximo com SMG."
      : "Perfil equilibrado: bom para média distância e movimentação constante.",
    `Use ${input.fingers} dedos com o botão de tiro próximo do polegar direito.`,
    `Ajuste o DPI do aparelho para ~${res.dpiRecomendado} e mantenha o modo de desempenho ligado.`,
    "Teste no treinamento por 10 minutos antes de entrar em ranqueada.",
  ];

  return res;
}
