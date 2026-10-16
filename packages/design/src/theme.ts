export type Theme = string;

export type ThemeMode = 'dark' | 'light';

export interface ThemeDef {
  id: string;
  label: string;
  mode: ThemeMode;
  swatch: {
    bg: string;
    surface: string;
    text: string;
    accent: string;
    hues: string[];
  };
}

const STORAGE_KEY = 'agentry.theme';

const DARK_THEME: ThemeDef = {
  id: 'dark',
  label: 'Default Dark',
  mode: 'dark',
  swatch: {
    bg: '#0b0d10',
    surface: '#161a20',
    text: '#e6edf3',
    accent: '#4d9eff',
    hues: ['#4d9eff', '#bc8cff', '#f0883e', '#3fb950', '#f778ba'],
  },
};

export const THEMES: readonly ThemeDef[] = [
  DARK_THEME,
  {
    id: 'dracula',
    label: 'Dracula',
    mode: 'dark',
    swatch: {
      bg: '#282a36',
      surface: '#44475a',
      text: '#f8f8f2',
      accent: '#bd93f9',
      hues: ['#ff5555', '#ffb86c', '#50fa7b', '#8be9fd', '#ff79c6'],
    },
  },
  {
    id: 'nord',
    label: 'Nord',
    mode: 'dark',
    swatch: {
      bg: '#2e3440',
      surface: '#3b4252',
      text: '#eceff4',
      accent: '#88c0d0',
      hues: ['#bf616a', '#d08770', '#a3be8c', '#81a1c1', '#b48ead'],
    },
  },
  {
    id: 'solarized-dark',
    label: 'Solarized Dark',
    mode: 'dark',
    swatch: {
      bg: '#002b36',
      surface: '#073642',
      text: '#93a1a1',
      accent: '#268bd2',
      hues: ['#dc322f', '#cb4b16', '#859900', '#2aa198', '#6c71c4'],
    },
  },
  {
    id: 'gruvbox-dark',
    label: 'Gruvbox Dark',
    mode: 'dark',
    swatch: {
      bg: '#282828',
      surface: '#3c3836',
      text: '#ebdbb2',
      accent: '#fe8019',
      hues: ['#fb4934', '#fabd2f', '#b8bb26', '#83a598', '#d3869b'],
    },
  },
  {
    id: 'one-dark',
    label: 'One Dark',
    mode: 'dark',
    swatch: {
      bg: '#282c34',
      surface: '#3e4451',
      text: '#abb2bf',
      accent: '#61afef',
      hues: ['#e06c75', '#d19a66', '#98c379', '#56b6c2', '#c678dd'],
    },
  },
  {
    id: 'monokai',
    label: 'Monokai',
    mode: 'dark',
    swatch: {
      bg: '#2d2a2e',
      surface: '#3e3b37',
      text: '#fcfcfa',
      accent: '#78dce8',
      hues: ['#ff6188', '#fc9867', '#ffd866', '#a9dc76', '#ab9df2'],
    },
  },
  {
    id: 'tokyo-night',
    label: 'Tokyo Night',
    mode: 'dark',
    swatch: {
      bg: '#1a1b26',
      surface: '#24283b',
      text: '#c0caf5',
      accent: '#7aa2f7',
      hues: ['#f7768e', '#ff9e64', '#9ece6a', '#7dcfff', '#bb9af7'],
    },
  },
  {
    id: 'catppuccin-mocha',
    label: 'Catppuccin Mocha',
    mode: 'dark',
    swatch: {
      bg: '#1e1e2e',
      surface: '#313244',
      text: '#cdd6f4',
      accent: '#cba6f7',
      hues: ['#f38ba8', '#fab387', '#a6e3a1', '#89b4fa', '#f5c2e7'],
    },
  },
  {
    id: 'github-dark',
    label: 'GitHub Dark',
    mode: 'dark',
    swatch: {
      bg: '#0d1117',
      surface: '#161b22',
      text: '#c9d1d9',
      accent: '#58a6ff',
      hues: ['#f85149', '#db6d28', '#3fb950', '#56d4dd', '#bc8cff'],
    },
  },
  {
    id: 'light',
    label: 'Default Light',
    mode: 'light',
    swatch: {
      bg: '#eef1f4',
      surface: '#ffffff',
      text: '#1f2328',
      accent: '#0969da',
      hues: ['#cf222e', '#bc4c00', '#1a7f37', '#1b7c83', '#8250df'],
    },
  },
  {
    id: 'solarized-light',
    label: 'Solarized Light',
    mode: 'light',
    swatch: {
      bg: '#fdf6e3',
      surface: '#eee8d5',
      text: '#586e75',
      accent: '#268bd2',
      hues: ['#dc322f', '#cb4b16', '#859900', '#2aa198', '#6c71c4'],
    },
  },
  {
    id: 'gruvbox-light',
    label: 'Gruvbox Light',
    mode: 'light',
    swatch: {
      bg: '#fbf1c7',
      surface: '#ebdbb2',
      text: '#3c3836',
      accent: '#af3a03',
      hues: ['#9d0006', '#b57614', '#79740e', '#076678', '#8f3f71'],
    },
  },
  {
    id: 'catppuccin-latte',
    label: 'Catppuccin Latte',
    mode: 'light',
    swatch: {
      bg: '#eff1f5',
      surface: '#e6e9ef',
      text: '#4c4f69',
      accent: '#1e66f5',
      hues: ['#d20f39', '#fe640b', '#40a02b', '#179299', '#8839ef'],
    },
  },
  {
    id: 'github-light',
    label: 'GitHub Light',
    mode: 'light',
    swatch: {
      bg: '#f6f8fa',
      surface: '#ffffff',
      text: '#1f2328',
      accent: '#0969da',
      hues: ['#cf222e', '#bc4c00', '#1a7f37', '#1b7c83', '#8250df'],
    },
  },
];

const DEFAULT_THEME_ID = 'dark';

export function getThemeDef(id: string): ThemeDef {
  return THEMES.find((theme) => theme.id === id) ?? DARK_THEME;
}

export function getThemeMode(id: string): ThemeMode {
  return getThemeDef(id).mode;
}

export function getStoredTheme(): Theme | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && THEMES.some((theme) => theme.id === stored) ? stored : null;
}

export function applyTheme(theme: Theme): void {
  const def = getThemeDef(theme);
  document.documentElement.setAttribute('data-theme', def.id);
  document.documentElement.setAttribute('data-mode', def.mode);
}

function lastKeyForMode(mode: ThemeMode): string {
  return `${STORAGE_KEY}.last.${mode}`;
}

// Last theme the user picked in this mode; falls back to that mode's default.
export function getLastThemeForMode(mode: ThemeMode): Theme {
  const stored = localStorage.getItem(lastKeyForMode(mode));
  if (stored && THEMES.some((t) => t.id === stored && t.mode === mode)) return stored;
  return mode === 'dark' ? 'dark' : 'light';
}

// Sun/moon target: last-used theme of the OPPOSITE mode.
export function getToggledTheme(current: Theme): Theme {
  const targetMode: ThemeMode = getThemeMode(current) === 'dark' ? 'light' : 'dark';
  return getLastThemeForMode(targetMode);
}

export function setTheme(theme: Theme): void {
  applyTheme(theme);
  localStorage.setItem(STORAGE_KEY, theme);
  localStorage.setItem(lastKeyForMode(getThemeMode(theme)), theme);
}

export function initTheme(): Theme {
  const theme = getStoredTheme() ?? DEFAULT_THEME_ID;
  applyTheme(theme);
  return theme;
}
