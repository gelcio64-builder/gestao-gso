// Paletas de cores profissionais para o GSO.
// Cada empresa escolhe uma; o sistema aplica via CSS variables.
// As cores semânticas (success/danger/warning/info) NÃO fazem parte da paleta —
// ficam fixas no app pra manter significado universal (verde=ok, vermelho=perigo).

export const PALETTES = [
  {
    id: 'gso-classic',
    nome: 'GSO Clássico',
    descricao: 'Azul-marinho identidade GSO',
    colors: {
      primary: '#0B1533',
      primaryHover: '#16224A',
      secondary: '#25376b',
      accent: '#1D4ED8',
      background: '#F3F4F6',
      surface: '#FFFFFF',
      text: '#0B1324',
      textMuted: '#6B7280',
    },
  },
  {
    id: 'azul-corporativo',
    nome: 'Azul Corporativo',
    descricao: 'Azul vibrante e moderno',
    colors: {
      primary: '#1E3A8A',
      primaryHover: '#1E40AF',
      secondary: '#2563EB',
      accent: '#3B82F6',
      background: '#F1F5F9',
      surface: '#FFFFFF',
      text: '#0F172A',
      textMuted: '#64748B',
    },
  },
  {
    id: 'verde-executivo',
    nome: 'Verde Executivo',
    descricao: 'Verde sóbrio e confiável',
    colors: {
      primary: '#064E3B',
      primaryHover: '#065F46',
      secondary: '#047857',
      accent: '#059669',
      background: '#F0FDF4',
      surface: '#FFFFFF',
      text: '#0B1F17',
      textMuted: '#5B7065',
    },
  },
  {
    id: 'grafite-premium',
    nome: 'Grafite Premium',
    descricao: 'Cinza-grafite elegante',
    colors: {
      primary: '#1F2937',
      primaryHover: '#111827',
      secondary: '#374151',
      accent: '#6B7280',
      background: '#F3F4F6',
      surface: '#FFFFFF',
      text: '#111827',
      textMuted: '#6B7280',
    },
  },
  {
    id: 'laranja-logistica',
    nome: 'Laranja Logística',
    descricao: 'Laranja energético e ativo',
    colors: {
      primary: '#7C2D12',
      primaryHover: '#9A3412',
      secondary: '#C2410C',
      accent: '#EA580C',
      background: '#FFF7ED',
      surface: '#FFFFFF',
      text: '#1C1917',
      textMuted: '#78716C',
    },
  },
  {
    id: 'vinho-elegante',
    nome: 'Vinho Elegante',
    descricao: 'Bordô sofisticado',
    colors: {
      primary: '#7A1730',
      primaryHover: '#8B1834',
      secondary: '#A32744',
      accent: '#BE185D',
      background: '#FDF2F4',
      surface: '#FFFFFF',
      text: '#1F1216',
      textMuted: '#7A6169',
    },
  },
];

export const DEFAULT_PALETTE_ID = 'gso-classic';

export function getPalette(id) {
  return PALETTES.find(p => p.id === id) || PALETTES[0];
}

// Aplica a paleta no :root como CSS variables.
// Chamado antes de renderizar a UI e ao trocar de tema.
export function applyPalette(id) {
  const p = getPalette(id);
  const root = document.documentElement;
  const c = p.colors;
  root.style.setProperty('--color-primary', c.primary);
  root.style.setProperty('--color-primary-hover', c.primaryHover);
  root.style.setProperty('--color-secondary', c.secondary);
  root.style.setProperty('--color-accent', c.accent);
  root.style.setProperty('--color-background', c.background);
  root.style.setProperty('--color-surface', c.surface);
  root.style.setProperty('--color-text', c.text);
  root.style.setProperty('--color-text-muted', c.textMuted);
  // rgba do primary pra sombras (extrai do hex)
  const rgb = hexToRgb(c.primary);
  if (rgb) root.style.setProperty('--color-primary-rgb', `${rgb.r},${rgb.g},${rgb.b}`);
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}
