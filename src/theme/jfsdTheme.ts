import type { ThemeConfig } from 'antd';

/**
 * JFSD Design Tokens — mapped to Ant Design's Seed token layer.
 * Change these values and every component inherits automatically.
 * Reference: projects/templates/brand-guidelines.md
 */
export const jfsdTheme: ThemeConfig = {
  token: {
    // Brand colors
    colorPrimary: '#1B365D',       // Navy — primary actions, headers, links
    colorInfo: '#1B365D',          // Info states match primary
    colorSuccess: '#3D8B37',       // Green — positive indicators
    colorWarning: '#C5A258',       // Gold — accent, warnings, highlights
    colorError: '#C4314B',         // Red — errors, negative variance

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
  '#1B365D',  // Navy (primary)
  '#C5A258',  // Gold (accent)
  '#3D8B37',  // Green (positive)
  '#C4314B',  // Red (negative)
  '#5B8DB8',  // Light blue
  '#8B6914',  // Dark gold
  '#7C9EB8',  // Steel blue
  '#E8D5A3',  // Light gold
  '#2D5F2D',  // Dark green
  '#9B4DCA',  // Purple (overflow)
];

/**
 * Traffic light status colors (McKinsey convention)
 */
export const statusColors = {
  good: '#3D8B37',
  warning: '#C5A258',
  critical: '#C4314B',
  neutral: '#8C8C8C',
} as const;

/**
 * Dashboard color palette — single source of truth.
 * Import this instead of re-declaring const NAVY/GOLD/etc in each dashboard.
 */
export const NAVY    = '#1B365D';
export const GOLD    = '#C5A258';
export const SUCCESS = '#3D8B37';
export const ERROR   = '#C4314B';
export const WARNING = '#D4880F';
export const MUTED   = '#8C8C8C';
