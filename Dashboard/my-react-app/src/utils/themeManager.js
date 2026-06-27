const themePresets = {
  retail: { accent: '#4f46e5', accentDark: '#3730a3', sidebar: '#0f172a', sidebarSoft: '#1e293b', surface: '#ffffff' },
  wholesale: { accent: '#7c3aed', accentDark: '#5b21b6', sidebar: '#111827', sidebarSoft: '#1f2937', surface: '#ffffff' },
  gst: { accent: '#2563eb', accentDark: '#1d4ed8', sidebar: '#0f172a', sidebarSoft: '#1e293b', surface: '#ffffff' },
  restaurant: { accent: '#ea580c', accentDark: '#c2410c', sidebar: '#231f20', sidebarSoft: '#2d2829', surface: '#fffaf3' },
  minimal: { accent: '#334155', accentDark: '#0f172a', sidebar: '#1e293b', sidebarSoft: '#334155', surface: '#ffffff' },
};

export const getThemePresets = () => themePresets;

export const getStoredThemeId = () => localStorage.getItem('erpTheme') || 'retail';

export const applyTheme = (themeId = 'retail') => {
  const theme = themePresets[themeId] || themePresets.retail;
  const root = document.documentElement;
  root.style.setProperty('--brand-red', theme.accent);
  root.style.setProperty('--brand-red-dark', theme.accentDark);
  root.style.setProperty('--brand-sidebar', theme.sidebar);
  root.style.setProperty('--brand-sidebar-soft', theme.sidebarSoft);
  root.style.setProperty('--brand-surface', theme.surface);
  localStorage.setItem('erpTheme', themeId);
  window.dispatchEvent(new CustomEvent('erp:theme-changed', { detail: { themeId } }));
};

export const applyStoredTheme = () => applyTheme(getStoredThemeId());