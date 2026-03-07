import type { CSSProperties } from "react";
import { ANALYTICS, DEVELOPMENT, ERROR, GOLD, MARKETING, NAVY, SUCCESS } from "../theme/jfsdTheme";

export const PLOTLY_COLORS = [DEVELOPMENT, SUCCESS, GOLD, ERROR, MARKETING, ANALYTICS, NAVY] as const;

export const PLOTLY_BASE_LAYOUT = {
  paper_bgcolor: "transparent",
  plot_bgcolor: "transparent",
  font: { family: "Inter, system-ui, sans-serif" },
  margin: { l: 40, r: 20, t: 40, b: 40 },
} as const;

export const DASHBOARD_CARD_STYLE: CSSProperties = {
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
};
