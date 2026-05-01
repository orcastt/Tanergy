/**
 * TANVAS Design Tokens — Cal.com Style
 *
 * 核心理念：单色克制，灰度调色板，阴影即边框。
 * Cal Sans 做标题（紧凑有力），Inter 做正文（稳如磐石）。
 *
 * 视觉红线 — AI 不得违反：
 * ❌ 不用 CSS border 做节点边框 — 用 ring shadow
 * ❌ 不用 Cal Sans 做正文 — 它是 display font
 * ❌ Cal Sans 24px 以下不用 +0.2px letter-spacing 会挤
 * ❌ 不引入品牌色 — 灰度调色板，颜色仅用于端口和状态
 * ❌ 不用 >5% 透明度的漫射阴影 — Cal.com 阴影克制
 * ❌ 不用渐变 — 完全扁平
 * ❌ 不用装饰性插图或抽象图形
 */

// ============================================
// 字体
// ============================================

export const fonts = {
  display: "'Cal Sans', 'Cal Sans Fallback', sans-serif",
  displayUI: "'Cal Sans UI Variable Light', sans-serif",
  displayUIMedium: "'Cal Sans UI Medium', sans-serif",
  body: "'Inter', 'Inter Placeholder', sans-serif",
  mono: "'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
} as const

// ============================================
// 颜色 — 灰度主导
// ============================================

export const colors = {
  charcoal: '#242424',
  midnight: '#111111',
  black: '#000000',
  midGray: '#898989',
  pureWhite: '#ffffff',
  lightGray: '#f5f5f5',
  linkBlue: '#0099ff',
  focusRing: 'rgba(59, 130, 246, 0.5)',

  status: {
    selected: '#6366F1',
    selectedLight: '#818CF8',
    running: '#3B82F6',
    success: '#22C55E',
    error: '#EF4444',
  },

  port: {
    prompt: '#8B5CF6',
    image: '#22C55E',
    text: '#3B82F6',
    video: '#F97316',
    searchResult: '#EF4444',
    structured: '#EAB308',
    audio: '#9CA3AF',
  },

  shadowRing: 'rgba(34, 42, 53, 0.08)',
  shadowRingMedium: 'rgba(34, 42, 53, 0.10)',
  shadowContact: 'rgba(19, 19, 22, 0.7)',
  shadowDiffused: 'rgba(34, 42, 53, 0.05)',
} as const

// ============================================
// 阴影 — Cal.com 11 级
// ============================================

export const shadows = {
  none: 'none',
  inset: 'rgba(0, 0, 0, 0.16) 0px 1px 1.9px 0px inset',
  card: `rgba(19, 19, 22, 0.7) 0px 1px 5px -4px, rgba(34, 42, 53, 0.08) 0px 0px 0px 1px, rgba(34, 42, 53, 0.05) 0px 4px 8px`,
  cardAlt: `rgba(36, 36, 36, 0.7) 0px 1px 5px -4px, rgba(36, 36, 36, 0.05) 0px 4px 8px`,
  buttonHighlight: 'rgba(255, 255, 255, 0.15) 0px 2px 0px inset',
  ambient: 'rgba(34, 42, 53, 0.05) 0px 4px 8px',

  node: `rgba(19, 19, 22, 0.7) 0px 1px 5px -4px, rgba(34, 42, 53, 0.08) 0px 0px 0px 1px, rgba(34, 42, 53, 0.05) 0px 4px 8px`,
  nodeHover: `rgba(19, 19, 22, 0.7) 0px 1px 5px -4px, rgba(34, 42, 53, 0.08) 0px 0px 0px 1px, rgba(34, 42, 53, 0.08) 0px 6px 12px`,
  nodeSelected: `0px 0px 0px 2px #6366F1, rgba(34, 42, 53, 0.05) 0px 4px 8px`,
  nodeRunning: `0px 0px 0px 2px #3B82F6, rgba(59, 130, 246, 0.08) 0px 4px 12px`,
  nodeSuccess: `0px 0px 0px 2px #22C55E, rgba(34, 197, 94, 0.05) 0px 4px 8px`,
  nodeError: `0px 0px 0px 2px #EF4444, rgba(239, 68, 68, 0.08) 0px 4px 12px`,
  panel: `rgba(19, 19, 22, 0.7) 0px 1px 5px -4px, rgba(34, 42, 53, 0.08) 0px 0px 0px 1px, rgba(34, 42, 53, 0.08) 0px 8px 24px`,
  modal: `rgba(19, 19, 22, 0.7) 0px 1px 5px -4px, rgba(34, 42, 53, 0.10) 0px 0px 0px 1px, rgba(34, 42, 53, 0.12) 0px 16px 48px`,

  darkNode: `rgba(0, 0, 0, 0.8) 0px 1px 5px -4px, rgba(255, 255, 255, 0.04) 0px 0px 0px 1px, rgba(0, 0, 0, 0.2) 0px 4px 8px`,
  darkNodeHover: `rgba(0, 0, 0, 0.8) 0px 1px 5px -4px, rgba(255, 255, 255, 0.06) 0px 0px 0px 1px, rgba(0, 0, 0, 0.3) 0px 6px 12px`,
} as const

// ============================================
// 排版
// ============================================

export const typography = {
  displayHero: { fontFamily: fonts.display, fontSize: '4rem', fontWeight: 600, lineHeight: 1.10, letterSpacing: '0px' },
  displaySection: { fontFamily: fonts.display, fontSize: '3rem', fontWeight: 600, lineHeight: 1.10, letterSpacing: '0px' },
  displayFeature: { fontFamily: fonts.display, fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.30, letterSpacing: '0px' },
  displaySubheading: { fontFamily: fonts.display, fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.20, letterSpacing: '+0.2px' },
  nodeTitle: { fontFamily: fonts.display, fontSize: '1rem', fontWeight: 600, lineHeight: 1.10, letterSpacing: '0px' },
  bodyLight: { fontFamily: fonts.displayUI, fontSize: '1.13rem', fontWeight: 300, lineHeight: 1.30, letterSpacing: '-0.2px' },
  bodyLightStandard: { fontFamily: fonts.displayUI, fontSize: '1rem', fontWeight: 300, lineHeight: 1.50, letterSpacing: '-0.2px' },
  uiLabel: { fontFamily: fonts.body, fontSize: '1rem', fontWeight: 600, lineHeight: 1.00, letterSpacing: '0px' },
  bodyStandard: { fontFamily: fonts.body, fontSize: '1rem', fontWeight: 400, lineHeight: 1.50, letterSpacing: '0px' },
  caption: { fontFamily: fonts.body, fontSize: '0.88rem', fontWeight: 500, lineHeight: 1.14, letterSpacing: '0px' },
  micro: { fontFamily: fonts.body, fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.00, letterSpacing: '0px' },
  nodeBody: { fontFamily: fonts.body, fontSize: '0.88rem', fontWeight: 400, lineHeight: 1.50, letterSpacing: '0px' },
  nodeLabel: { fontFamily: fonts.body, fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.00, letterSpacing: '0px' },
  code: { fontFamily: fonts.mono, fontSize: '0.88rem', fontWeight: 600, lineHeight: 1.00, letterSpacing: '0px' },
} as const

// ============================================
// 间距 / 圆角 / 尺寸 / 动画
// ============================================

export const spacing = {
  0: '0', px: '1px', 0_5: '2px', 0_75: '3px', 1: '4px', 1_5: '6px',
  2: '8px', 3: '12px', 4: '16px', 5: '20px', 6: '24px', 7: '28px',
  10: '40px', 12: '48px', 20: '80px', 24: '96px',
} as const

export const radii = {
  minimal: '2px', small: '4px', button: '6px', standard: '8px',
  comfortable: '12px', card: '16px', special: '29px', large: '100px',
  xl: '1000px', pill: '9999px',
} as const

export const sizes = {
  gridSize: 20,
  nodePrompt: { width: 240, minHeight: 120 },
  nodeChat: { width: 260, minHeight: 140 },
  nodeSearch: { width: 260, minHeight: 120 },
  nodeOptimize: { width: 240, minHeight: 120 },
  nodeAnalysis: { width: 240, minHeight: 120 },
  nodeImage: { width: 300, minHeight: 360 },
  nodePreview: { width: 360, minHeight: 300 },
  portSize: 12, portSizeHover: 16, portBorderWidth: 2,
  leftToolbarWidth: 48, topbarHeight: 56, bottomBarHeight: 40, rightPanelWidth: 340,
} as const

export const animations = {
  nodeAppear: 300, edgeDraw: 200, skillWorkflow: 1500,
  nodeSuccessBorder: 2000, toast: 3000, pulseRunning: '2s',
} as const

export const buttonPresets = {
  primaryDark: { bg: '#242424', text: '#ffffff', radius: radii.button, padding: '10px 20px', shadow: shadows.card, hoverOpacity: 0.7 },
  ghost: { bg: '#ffffff', text: '#242424', radius: radii.button, padding: '10px 20px', shadow: shadows.card },
  pill: { bg: '#242424', text: '#ffffff', radius: radii.pill, padding: '8px 16px', shadow: shadows.card, hoverOpacity: 0.7 },
  run: { bg: '#242424', text: '#ffffff', radius: radii.pill, padding: '6px 14px', shadow: shadows.card, hoverOpacity: 0.7 },
} as const
