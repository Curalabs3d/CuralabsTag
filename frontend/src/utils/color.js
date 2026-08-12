// Calcula se um texto claro ou escuro deve ser usado sobre uma cor de fundo,
// usando luminância relativa (fórmula padrão sRGB). Garante legibilidade
// automática mesmo quando o tenant escolhe um fundo claro (ex: branco).
export function getContrastTextColor(hexBg) {
  if (!hexBg) return '#FFFFFF';
  const hex = hexBg.replace('#', '');
  if (hex.length !== 6) return '#FFFFFF';

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return '#FFFFFF';

  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.55 ? '#0A0A0A' : '#FFFFFF';
}
