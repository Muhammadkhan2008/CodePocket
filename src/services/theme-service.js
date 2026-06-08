// ==========================================
// THEME SERVICE - Full Theme System
// ==========================================
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from 'codemirror';

export const THEMES = {
  'catppuccin-mocha': {
    label: 'Catppuccin Mocha', type: 'dark',
    vars: { '--bg-base':'#11111b','--bg-editor':'#1e1e2e','--bg-panel':'#181825','--bg-hover':'#313244','--text-primary':'#cdd6f4','--text-secondary':'#a6adc8','--text-muted':'#6c7086','--accent':'#89b4fa','--accent-hover':'#b4befe','--border':'#313244' },
    cm: oneDark
  },
  'dracula': {
    label: 'Dracula', type: 'dark',
    vars: { '--bg-base':'#191a21','--bg-editor':'#282a36','--bg-panel':'#21222c','--bg-hover':'#44475a','--text-primary':'#f8f8f2','--text-secondary':'#6272a4','--text-muted':'#44475a','--accent':'#bd93f9','--accent-hover':'#ff79c6','--border':'#44475a' },
    cm: null
  },
  'monokai': {
    label: 'Monokai', type: 'dark',
    vars: { '--bg-base':'#1a1a1a','--bg-editor':'#272822','--bg-panel':'#1e1f1c','--bg-hover':'#3e3d32','--text-primary':'#f8f8f2','--text-secondary':'#75715e','--text-muted':'#49483e','--accent':'#a6e22e','--accent-hover':'#e6db74','--border':'#3e3d32' },
    cm: null
  },
  'github-dark': {
    label: 'GitHub Dark', type: 'dark',
    vars: { '--bg-base':'#0d1117','--bg-editor':'#161b22','--bg-panel':'#010409','--bg-hover':'#30363d','--text-primary':'#e6edf3','--text-secondary':'#8b949e','--text-muted':'#484f58','--accent':'#58a6ff','--accent-hover':'#79c0ff','--border':'#30363d' },
    cm: null
  },
  'solarized-dark': {
    label: 'Solarized Dark', type: 'dark',
    vars: { '--bg-base':'#002b36','--bg-editor':'#073642','--bg-panel':'#00212b','--bg-hover':'#586e75','--text-primary':'#839496','--text-secondary':'#657b83','--text-muted':'#586e75','--accent':'#268bd2','--accent-hover':'#2aa198','--border':'#073642' },
    cm: null
  },
  'nord': {
    label: 'Nord', type: 'dark',
    vars: { '--bg-base':'#242933','--bg-editor':'#2e3440','--bg-panel':'#1f2430','--bg-hover':'#434c5e','--text-primary':'#d8dee9','--text-secondary':'#81a1c1','--text-muted':'#4c566a','--accent':'#88c0d0','--accent-hover':'#8fbcbb','--border':'#3b4252' },
    cm: null
  },
  'light': {
    label: 'GitHub Light', type: 'light',
    vars: { '--bg-base':'#f6f8fa','--bg-editor':'#ffffff','--bg-panel':'#f0f2f4','--bg-hover':'#e1e4e8','--text-primary':'#24292e','--text-secondary':'#586069','--text-muted':'#959da5','--accent':'#0366d6','--accent-hover':'#045cc0','--border':'#e1e4e8' },
    cm: EditorView.theme({ '&': { backgroundColor: '#fff', color: '#24292e' } })
  },
  'high-contrast': {
    label: 'High Contrast', type: 'dark',
    vars: { '--bg-base':'#000000','--bg-editor':'#000000','--bg-panel':'#0a0a0a','--bg-hover':'#1a1a1a','--text-primary':'#ffffff','--text-secondary':'#cccccc','--text-muted':'#888888','--accent':'#ffcc00','--accent-hover':'#ffd700','--border':'#333333' },
    cm: null
  },
  'ayu-dark': {
    label: 'Ayu Dark', type: 'dark',
    vars: { '--bg-base':'#0a0e14','--bg-editor':'#0d1117','--bg-panel':'#0b0e14','--bg-hover':'#1a1f29','--text-primary':'#b3b1ad','--text-secondary':'#626a73','--text-muted':'#3d4148','--accent':'#e6b450','--accent-hover':'#ffb454','--border':'#1a1f29' },
    cm: null
  },
  'tokyo-night': {
    label: 'Tokyo Night', type: 'dark',
    vars: { '--bg-base':'#16161e','--bg-editor':'#1a1b26','--bg-panel':'#13131a','--bg-hover':'#292e42','--text-primary':'#c0caf5','--text-secondary':'#565f89','--text-muted':'#3b3f51','--accent':'#7aa2f7','--accent-hover':'#bb9af7','--border':'#292e42' },
    cm: null
  }
};

export const ThemeService = {
  current: 'catppuccin-mocha',
  cmCompartment: null,

  init(compartment) {
    this.cmCompartment = compartment;
    const saved = localStorage.getItem('cp_theme');
    if (saved && THEMES[saved]) this.apply(saved);
    return this;
  },

  apply(themeName, editorView = null) {
    const theme = THEMES[themeName];
    if (!theme) return { ok: false, error: `Theme "${themeName}" not found` };

    // Apply CSS vars
    const root = document.documentElement;
    for (const [key, val] of Object.entries(theme.vars)) {
      root.style.setProperty(key, val);
    }

    // Apply CodeMirror theme
    if (editorView && this.cmCompartment && theme.cm) {
      editorView.dispatch({ effects: this.cmCompartment.reconfigure(theme.cm) });
    }

    this.current = themeName;
    localStorage.setItem('cp_theme', themeName);
    return { ok: true, theme: theme.label };
  },

  getList() {
    return Object.entries(THEMES).map(([id, t]) => ({ id, label: t.label, type: t.type }));
  },

  applyCustom(vars, editorView = null) {
    const root = document.documentElement;
    for (const [key, val] of Object.entries(vars)) {
      root.style.setProperty(key, val);
    }
    localStorage.setItem('cp_custom_theme', JSON.stringify(vars));
    return { ok: true, message: 'Custom theme applied' };
  }
};
