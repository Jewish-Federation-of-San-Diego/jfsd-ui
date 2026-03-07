import type { ThemeConfig } from 'antd';

/**
 * JFSD Design Tokens — mapped to Ant Design's Seed token layer.
 * Change these values and every component inherits automatically.
 * Reference: projects/templates/brand-guidelines.md
 */
export const jfsdTheme: ThemeConfig = {
  token: {
    // Brand colors
    colorPrimary: '#27277c',       // Navy — primary actions, headers, links
    colorInfo: '#27277c',          // Info states match primary
    colorSuccess: '#236B4A',       // Green — positive indicators
    colorWarning: '#d98000',       // Gold — accent, warnings, highlights
    colorError: '#eb6136',         // Orange — errors, negative variance

    // Typography
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
    fontSizeHeading1: 30,
    fontSizeHeading2: 24,
    fontSizeHeading3: 20,
    fontSizeHeading4: 16,

    // Shape
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,

    // Spacing
    padding: 16,
    paddingLG: 24,
    paddingSM: 12,
    paddingXS: 8,

    // Layout
    colorBgContainer: '#FFFFFF',
    colorBgLayout: '#F5F5F7',
    colorBgElevated: '#FFFFFF',
    colorBorderSecondary: '#E8E8ED',
  },
  components: {
    // Table — finance-grade density
    Table: {
      headerBg: '#F5F5F7',
      headerColor: '#1B365D',
      headerSortActiveBg: '#E8E8ED',
      rowHoverBg: '#FAFAFA',
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
    },
    // Cards — dashboard widgets
    Card: {
      headerFontSize: 16,
      paddingLG: 20,
    },
    // Statistic — KPI callouts
    Statistic: {
      titleFontSize: 13,
      contentFontSize: 28,
    },
    // Layout
    Layout: {
      siderBg: '#1B365D',
      headerBg: '#FFFFFF',
      bodyBg: '#F5F5F7',
    },
    Menu: {
      darkItemBg: '#1B365D',
      darkSubMenuItemBg: '#152B4D',
      darkItemSelectedBg: '#4DA3FF',
    },
  },
};

/**
 * JFSD color palette for charts (Carbon Charts / Ant Charts).
 * Ordered for visual distinction in multi-series charts.
 */
export const jfsdChartColors = [
  '#1c88ed',  // Development blue
  '#236B4A',  // Forest green
  '#d98000',  // Gold
  '#eb6136',  // Orange
  '#942494',  // Marketing purple
  '#009191',  // Analytics teal
  '#27277c',  // Navy
];

/**
 * Traffic light status colors (McKinsey convention)
 */
export const statusColors = {
  good: '#236B4A',
  warning: '#d98000',
  critical: '#eb6136',
  neutral: '#8c8c8c',
} as const;

/**
 * Dashboard color palette — single source of truth.
 * Import this instead of re-declaring const NAVY/GOLD/etc in each dashboard.
 */
export const NAVY = '#27277c';
export const GOLD = '#d98000';
export const SUCCESS = '#236B4A';
export const ERROR = '#eb6136';
export const WARNING = '#d98000';
export const MUTED = '#8c8c8c';

export const DEVELOPMENT = '#1c88ed';
export const FINANCE = '#236B4A';
export const ANALYTICS = '#009191';
export const OPERATIONS = '#594fa3';
export const MARKETING = '#942494';
