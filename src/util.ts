export function hexToRgba(hex: string, alpha = 1): string {
  if (hex.startsWith("#")) hex = hex.slice(1);
  const [r, g, b] = hex.match(/.{2}/g)!.map((x) => parseInt(x, 16).toString());

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
