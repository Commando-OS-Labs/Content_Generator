// Commando360.ai Ad Generator — Figma Plugin
// Generates ad variations and creates branded template frames
// across multiple content types and layout styles.

figma.showUI(__html__, { width: 480, height: 760 });

// ── Types ──────────────────────────────────────────────────────

interface CopyVariation {
  [key: string]: string | undefined;
}

interface GenerateMessage {
  type: "generate";
  variations: CopyVariation[];
  qrImages?: { [url: string]: number[] };
  columns: number;
  gap: number;
}

interface CancelMessage {
  type: "cancel";
}

interface CreateTemplatesMessage {
  type: "create-templates";
  platforms: string[];
  contentTypes: string[];
  brandFrame: boolean;
  themes: string[];
  bgPattern: string; // "none"|"topography"|"hexagonal"|"circuit"|"ripples"|"crosshatch"|"dots"|"grid"|"diagonal"|"custom"|illustration keys
  bgDensity: string; // "light"|"medium"|"dense"
  qrImage?: number[];
  logoImage?: number[];
  fullLogoImage?: number[];
  patternImage?: number[];
  patternSvgStr?: string; // raw SVG string for illustration patterns
}

interface CreateBlogMessage {
  type: "create-blog";
  blogTemplates: string[];
  themes: string[];
  bgPattern: string;
  bgDensity: string;
  title?: string;
  author?: string;
  sectionCount: number;
  logoImage?: number[];
  fullLogoImage?: number[];
}

interface CreateMockupsMessage {
  type: "create-mockups";
  layouts: string[];
  deviceColor: string;
  themes: string[];
  platforms: string[];
  postDeviceFocus: string[]; // "phone" | "desktop" | "dual"
  desktopStyle: string; // "macbook" | "browser" | "windows-browser"
  logoImage?: number[];
  fullLogoImage?: number[];
}

interface CreateBrochureMessage {
  type: "create-brochure";
  layouts: string[];
  themes: string[];
  resolution: string;
}

type PluginMessage =
  | GenerateMessage
  | CancelMessage
  | CreateTemplatesMessage
  | CreateBlogMessage
  | CreateMockupsMessage
  | CreateBrochureMessage;

// ── Brand Constants ────────────────────────────────────────────

// Fixed brand colors (never change with theme)
const FIXED_WHITE: RGB = { r: 1, g: 1, b: 1 };
const FIXED_BLACK: RGB = { r: 0, g: 0, b: 0 };

// Theme-dependent colors (mutated by applyTheme)
const C: Record<string, RGB> = {
  bg: { r: 0.031, g: 0.035, b: 0.039 },
  card: { r: 0.067, g: 0.067, b: 0.078 },
  red: { r: 0.863, g: 0.137, b: 0.137 },
  darkRed: { r: 0.45, g: 0.08, b: 0.08 },
  white: { r: 1, g: 1, b: 1 }, // primary text: white in dark, near-black in light
  gray: { r: 0.7, g: 0.7, b: 0.7 },
  dim: { r: 0.4, g: 0.4, b: 0.4 },
  faint: { r: 0.2, g: 0.2, b: 0.2 },
  footerBg: { r: 0.055, g: 0.055, b: 0.063 },
};

function applyTheme(dark: boolean): void {
  if (dark) {
    C.bg = { r: 0.031, g: 0.035, b: 0.039 };
    C.card = { r: 0.067, g: 0.067, b: 0.078 };
    C.white = { r: 1, g: 1, b: 1 };
    C.gray = { r: 0.7, g: 0.7, b: 0.7 };
    C.dim = { r: 0.4, g: 0.4, b: 0.4 };
    C.faint = { r: 0.2, g: 0.2, b: 0.2 };
    C.darkRed = { r: 0.45, g: 0.08, b: 0.08 };
    C.footerBg = { r: 0.055, g: 0.055, b: 0.063 };
  } else {
    C.bg = { r: 0.965, g: 0.969, b: 0.976 };
    C.card = { r: 1, g: 1, b: 1 };
    C.white = { r: 0.08, g: 0.08, b: 0.1 };
    C.gray = { r: 0.33, g: 0.34, b: 0.37 };
    C.dim = { r: 0.5, g: 0.51, b: 0.54 };
    C.faint = { r: 0.82, g: 0.83, b: 0.85 };
    C.darkRed = { r: 0.75, g: 0.1, b: 0.1 };
    C.footerBg = { r: 0.93, g: 0.94, b: 0.95 };
  }
}

// Global state (set once before template creation, like theme)
let brandLogo: Image | null = null; // full wordmark (white on transparent)
let circleLogo: Image | null = null; // circle C icon
var activeBgPattern: string = "none";
var activeBgDensity: string = "medium";
var customPatternImage: Image | null = null;
var activePatternSvgStr: string = "";

// Blog-specific globals
var activeBlogTitle: string = "";
var activeBlogAuthor: string = "";
var activeBlogSections: number = 3;

const INTER_BOLD: FontName = { family: "Inter", style: "Bold" };
const INTER_SEMI: FontName = { family: "Inter", style: "Semi Bold" };
const INTER_MED: FontName = { family: "Inter", style: "Medium" };
const INTER_REG: FontName = { family: "Inter", style: "Regular" };

// Display fonts for headlines (Google Fonts, available in Figma by default)
// Best brands use 1-2 display fonts max: Bebas for bold impact, Jakarta for modern premium
const BEBAS: FontName = { family: "Bebas Neue", style: "Regular" };
const JAKARTA_XBOLD: FontName = {
  family: "Plus Jakarta Sans",
  style: "ExtraBold",
};

const DISPLAY_FONTS: FontName[] = [BEBAS, JAKARTA_XBOLD];

// Font fallback system — tracks which fonts loaded successfully
var loadedFonts: Set<string> = new Set();

function fontKey(f: FontName): string {
  return f.family + "::" + f.style;
}

function resolveFont(target: FontName): FontName {
  if (loadedFonts.has(fontKey(target))) return target;
  return INTER_BOLD;
}

// ── Text Effect System ───────────────────────────────────────
type TextEffectKey = "clean" | "lifted" | "glow" | "gradientFill" | "outline";

function getTextEffects(
  key: TextEffectKey,
  fontSize: number,
): {
  effects: Effect[];
  fills?: Paint[];
  strokes?: Paint[];
  strokeWeight?: number;
  strokeAlign?: string;
} {
  var blurScale = Math.max(1, fontSize / 40);
  switch (key) {
    case "lifted":
      return {
        effects: [
          {
            type: "DROP_SHADOW",
            color: { r: 0, g: 0, b: 0, a: 0.2 },
            offset: { x: 0, y: Math.round(4 * blurScale) },
            radius: Math.round(12 * blurScale),
            spread: 0,
            visible: true,
            blendMode: "NORMAL",
          } as DropShadowEffect,
        ],
      };
    case "glow":
      return {
        effects: [
          {
            type: "DROP_SHADOW",
            color: { r: 0.86, g: 0.14, b: 0.14, a: 0.25 },
            offset: { x: 0, y: 0 },
            radius: Math.round(30 * blurScale),
            spread: 0,
            visible: true,
            blendMode: "NORMAL",
          } as DropShadowEffect,
        ],
      };
    case "gradientFill": {
      var isDark = C.bg.r < 0.5;
      var startColor = isDark
        ? { r: 1, g: 1, b: 1, a: 1 }
        : { r: 0.08, g: 0.08, b: 0.1, a: 1 };
      return {
        effects: [],
        fills: [
          {
            type: "GRADIENT_LINEAR",
            gradientTransform: [
              [1, 0, 0],
              [0, 1, 0],
            ],
            gradientStops: [
              { position: 0, color: startColor },
              { position: 1, color: { r: 0.86, g: 0.14, b: 0.14, a: 1 } },
            ],
          } as GradientPaint,
        ],
      };
    }
    case "outline": {
      var dark = C.bg.r < 0.5;
      var strokeClr = dark
        ? { r: 1, g: 1, b: 1 }
        : { r: 0.08, g: 0.08, b: 0.1 };
      return {
        effects: [],
        fills: [solid(C.bg, 0) as SolidPaint],
        strokes: [
          {
            type: "SOLID",
            color: strokeClr,
            opacity: 0.9,
            visible: true,
          } as SolidPaint,
        ],
        strokeWeight: Math.max(1, Math.round(fontSize * 0.025)),
        strokeAlign: "OUTSIDE",
      };
    }
    default:
      return { effects: [] };
  }
}

function applyTextEffect(node: TextNode, key: TextEffectKey): void {
  if (key === "clean") return;
  var cfg = getTextEffects(key, node.fontSize as number);
  if (cfg.effects.length > 0) node.effects = cfg.effects;
  if (cfg.fills) node.fills = cfg.fills;
  if (cfg.strokes) {
    node.strokes = cfg.strokes;
    if (cfg.strokeWeight !== undefined) node.strokeWeight = cfg.strokeWeight;
    if (cfg.strokeAlign)
      node.strokeAlign = cfg.strokeAlign as "CENTER" | "INSIDE" | "OUTSIDE";
  }
}

// ── Accent Decorations ───────────────────────────────────────
function addAccentDots(
  parent: FrameNode,
  count: number,
  size: number,
  x: number,
  y: number,
  gap: number,
  vertical?: boolean,
): void {
  for (var i = 0; i < count; i++) {
    var dx = vertical ? 0 : i * (size + gap);
    var dy = vertical ? i * (size + gap) : 0;
    addEllipse(
      parent,
      "accent-dot-" + i,
      size,
      size,
      x + dx,
      y + dy,
      solid(C.red, 0.3 + i * 0.15),
    );
  }
}

function addDiagonalLine(
  parent: FrameNode,
  count: number,
  length: number,
  x: number,
  y: number,
  gap: number,
): void {
  for (var i = 0; i < count; i++) {
    var r = addRect(
      parent,
      "accent-line-" + i,
      length,
      1,
      x + i * gap,
      y + i * gap,
      solid(C.red, 0.15 + i * 0.08),
    );
    r.rotation = -45;
  }
}

// Social media SVG icon paths (viewBox 0 0 24 24) — from Simple Icons / landing page
const SVG_LINKEDIN =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";
const SVG_YOUTUBE =
  "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z";
const SVG_INSTAGRAM =
  "M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 1 0 0-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 1 1-2.882 0 1.441 1.441 0 0 1 2.882 0z";
const SVG_X =
  "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z";

interface PlatformDef {
  w: number;
  h: number;
  label: string;
}

const PLATFORMS: Record<string, PlatformDef> = {
  linkedin: { w: 1200, h: 627, label: "LinkedIn" },
  instagram: { w: 1080, h: 1080, label: "Instagram" },
  "ig-story": { w: 1080, h: 1920, label: "IG Story" },
  twitter: { w: 1200, h: 675, label: "X-Twitter" },
  facebook: { w: 1200, h: 628, label: "Facebook" },
  "gdn-rect": { w: 300, h: 250, label: "GDN 300x250" },
  "gdn-leader": { w: 728, h: 90, label: "GDN 728x90" },
};

// ── Utilities ──────────────────────────────────────────────────

function solid(color: RGB, opacity?: number): SolidPaint {
  const o = opacity !== undefined ? opacity : 1;
  return { type: "SOLID", color, opacity: o };
}

function collectFonts(
  frame: FrameNode | ComponentNode | InstanceNode,
): FontName[] {
  const textNodes = frame.findAllWithCriteria({
    types: ["TEXT"],
  }) as TextNode[];
  const fontSet = new Map<string, FontName>();
  for (const node of textNodes) {
    if (node.fontName === figma.mixed) {
      for (const f of node.getRangeAllFontNames(0, node.characters.length)) {
        fontSet.set(`${f.family}::${f.style}`, f);
      }
    } else {
      const f = node.fontName as FontName;
      fontSet.set(`${f.family}::${f.style}`, f);
    }
  }
  return Array.from(fontSet.values());
}

function findTextByName(
  frame: FrameNode | ComponentNode | InstanceNode,
  name: string,
): TextNode | null {
  const lower = name.toLowerCase();
  const nodes = frame.findAllWithCriteria({
    types: ["TEXT"],
  }) as TextNode[];
  return nodes.find((n) => n.name.toLowerCase() === lower) || null;
}

async function setText(node: TextNode, text: string): Promise<void> {
  if (node.fontName === figma.mixed) {
    const fonts = node.getRangeAllFontNames(0, node.characters.length);
    await Promise.all(fonts.map((f) => figma.loadFontAsync(f)));
  } else {
    await figma.loadFontAsync(node.fontName as FontName);
  }
  node.characters = text;
}

// ── Template Primitives ────────────────────────────────────────

function addText(
  parent: FrameNode,
  name: string,
  text: string,
  font: FontName,
  size: number,
  color: RGB,
  x: number,
  y: number,
  opts?: {
    maxWidth?: number;
    lineHeight?: number;
    letterSpacing?: number;
    opacity?: number;
    align?: "LEFT" | "CENTER" | "RIGHT";
    effect?: TextEffectKey;
  },
): TextNode {
  const t = figma.createText();
  t.fontName = font;
  t.fontSize = size;
  const op = opts && opts.opacity !== undefined ? opts.opacity : 1;
  t.fills = [solid(color, op)];
  if (opts && opts.lineHeight)
    t.lineHeight = { value: opts.lineHeight, unit: "PERCENT" };
  if (opts && opts.letterSpacing)
    t.letterSpacing = { value: opts.letterSpacing, unit: "PERCENT" };
  t.characters = text;
  t.name = name;
  if (opts && opts.maxWidth) {
    t.resize(opts.maxWidth, t.height);
    t.textAutoResize = "HEIGHT";
  }
  if (opts && opts.align) t.textAlignHorizontal = opts.align;
  t.x = x;
  t.y = y;
  parent.appendChild(t);
  if (opts && opts.effect) applyTextEffect(t, opts.effect);
  return t;
}

function addRect(
  parent: FrameNode,
  name: string,
  w: number,
  h: number,
  x: number,
  y: number,
  fill: Paint,
  radius?: number,
): RectangleNode {
  const r = figma.createRectangle();
  r.name = name;
  r.resize(w, h);
  r.x = x;
  r.y = y;
  r.fills = [fill];
  if (radius) r.cornerRadius = radius;
  parent.appendChild(r);
  return r;
}

// ── Background Graphic Patterns ─────────────────────────────
// ── SVG Background Pattern Generators ─────────────────────────
// Each generator returns a complete SVG string that gets rendered via
// figma.createNodeFromSvg() → flatten → position → recolor.

function getDensityValue(
  density: string,
  light: number,
  medium: number,
  dense: number,
): number {
  if (density === "light") return light;
  if (density === "dense") return dense;
  return medium;
}

function getPatternColor(): string {
  var dark = C.bg.r < 0.5;
  return dark ? "#DC2323" : "#DC2323";
}

function generateTopographySvg(w: number, h: number, density: string): string {
  var count = getDensityValue(density, 8, 14, 22);
  var color = getPatternColor();
  var sw = Math.max(1.5, Math.round(Math.min(w, h) * 0.002));
  var paths = "";
  // Seeded pseudo-random for deterministic patterns
  var seed = 42;
  function rand(): number {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  for (var i = 0; i < count; i++) {
    var yBase = Math.round(
      (h / (count + 1)) * (i + 1) + (rand() - 0.5) * h * 0.08,
    );
    var pts = 10;
    var d = "M 0 " + yBase;
    for (var p = 1; p <= pts; p++) {
      var px = Math.round((w / pts) * p);
      var py = yBase + Math.round((rand() - 0.5) * h * 0.12);
      var cpx = Math.round((w / pts) * (p - 0.5));
      var cpy = yBase + Math.round((rand() - 0.5) * h * 0.15);
      d += " Q " + cpx + " " + cpy + " " + px + " " + py;
    }
    var lineOp = (0.12 - (i / count) * 0.05).toFixed(3);
    paths +=
      '<path d="' +
      d +
      '" fill="none" stroke="' +
      color +
      '" stroke-width="' +
      sw +
      '" opacity="' +
      lineOp +
      '"/>';
  }
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    w +
    '" height="' +
    h +
    '">' +
    paths +
    "</svg>"
  );
}

function generateHexGridSvg(w: number, h: number, density: string): string {
  var cellSize = getDensityValue(density, 80, 50, 30);
  var color = getPatternColor();
  var sw = Math.max(1.5, Math.round(cellSize * 0.03));
  var paths = "";
  var hexH = cellSize * Math.sqrt(3);
  var cols = Math.ceil(w / (cellSize * 1.5)) + 2;
  var rows = Math.ceil(h / hexH) + 2;

  for (var row = -1; row < rows; row++) {
    for (var col = -1; col < cols; col++) {
      var cx = col * cellSize * 1.5;
      var cy = row * hexH + (col % 2 === 0 ? 0 : hexH * 0.5);
      var d = "";
      for (var a = 0; a < 6; a++) {
        var angle = (Math.PI / 180) * (60 * a - 30);
        var hx = cx + cellSize * 0.5 * Math.cos(angle);
        var hy = cy + cellSize * 0.5 * Math.sin(angle);
        d += (a === 0 ? "M " : "L ") + Math.round(hx) + " " + Math.round(hy);
      }
      d += " Z";
      paths +=
        '<path d="' +
        d +
        '" fill="none" stroke="' +
        color +
        '" stroke-width="' +
        sw +
        '" opacity="0.1"/>';
    }
  }
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    w +
    '" height="' +
    h +
    '">' +
    paths +
    "</svg>"
  );
}

function generateCircuitSvg(w: number, h: number, density: string): string {
  var gridStep = getDensityValue(density, 100, 60, 40);
  var color = getPatternColor();
  var sw = Math.max(2, Math.round(Math.min(w, h) * 0.003));
  var paths = "";
  var seed = 137;
  function rand(): number {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  // Grid-snapped nodes
  var cols = Math.floor(w / gridStep);
  var rows = Math.floor(h / gridStep);
  var nodeR = Math.max(3, Math.round(gridStep * 0.08));
  var bigR = Math.max(5, Math.round(gridStep * 0.14));

  // Create grid of potential nodes, activate ~40%
  var activeNodes: Array<[number, number]> = [];
  for (var gy = 1; gy < rows; gy++) {
    for (var gx = 1; gx < cols; gx++) {
      if (rand() < 0.4) {
        activeNodes.push([gx * gridStep, gy * gridStep]);
      }
    }
  }

  // Draw traces between nearby nodes (orthogonal L-shaped connections)
  for (var i = 0; i < activeNodes.length; i++) {
    var ax = activeNodes[i][0];
    var ay = activeNodes[i][1];
    // Connect to 1-2 nearest neighbors
    var connections = 0;
    for (var j = i + 1; j < activeNodes.length && connections < 2; j++) {
      var bx = activeNodes[j][0];
      var by = activeNodes[j][1];
      var dist = Math.abs(bx - ax) + Math.abs(by - ay);
      if (dist <= gridStep * 3 && rand() < 0.5) {
        // L-shaped trace: horizontal then vertical
        if (rand() > 0.5) {
          paths +=
            '<path d="M ' +
            ax +
            " " +
            ay +
            " L " +
            bx +
            " " +
            ay +
            " L " +
            bx +
            " " +
            by +
            '" fill="none" stroke="' +
            color +
            '" stroke-width="' +
            sw +
            '" opacity="0.12" stroke-linecap="round" stroke-linejoin="round"/>';
        } else {
          paths +=
            '<path d="M ' +
            ax +
            " " +
            ay +
            " L " +
            ax +
            " " +
            by +
            " L " +
            bx +
            " " +
            by +
            '" fill="none" stroke="' +
            color +
            '" stroke-width="' +
            sw +
            '" opacity="0.12" stroke-linecap="round" stroke-linejoin="round"/>';
        }
        connections++;
      }
    }
  }

  // Draw nodes — mix of circles and squares (IC pads)
  for (var k = 0; k < activeNodes.length; k++) {
    var nx = activeNodes[k][0];
    var ny = activeNodes[k][1];
    if (rand() > 0.7) {
      // Larger IC pad (square with rounded corners)
      var padS = bigR * 2;
      paths +=
        '<rect x="' +
        (nx - bigR) +
        '" y="' +
        (ny - bigR) +
        '" width="' +
        padS +
        '" height="' +
        padS +
        '" rx="2" fill="' +
        color +
        '" opacity="0.1"/>';
      paths +=
        '<rect x="' +
        (nx - bigR + 2) +
        '" y="' +
        (ny - bigR + 2) +
        '" width="' +
        (padS - 4) +
        '" height="' +
        (padS - 4) +
        '" rx="1" fill="' +
        color +
        '" opacity="0.1"/>';
    } else {
      // Standard node (circle with inner dot)
      paths +=
        '<circle cx="' +
        nx +
        '" cy="' +
        ny +
        '" r="' +
        nodeR +
        '" fill="' +
        color +
        '" opacity="0.15"/>';
      paths +=
        '<circle cx="' +
        nx +
        '" cy="' +
        ny +
        '" r="' +
        Math.max(1, Math.round(nodeR * 0.4)) +
        '" fill="' +
        color +
        '" opacity="0.25"/>';
    }
  }

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    w +
    '" height="' +
    h +
    '">' +
    paths +
    "</svg>"
  );
}

function generateRipplesSvg(w: number, h: number, density: string): string {
  var ringCount = getDensityValue(density, 4, 7, 12);
  var color = getPatternColor();
  var sw = Math.max(2, Math.round(Math.min(w, h) * 0.003));
  var paths = "";
  // Offset center for artistic asymmetry
  var cx = Math.round(w * 0.7);
  var cy = Math.round(h * 0.6);
  var maxR = Math.max(w, h) * 0.9;

  for (var i = 1; i <= ringCount; i++) {
    var r = Math.round((maxR / ringCount) * i);
    var op = 0.15 - (i / ringCount) * 0.08;
    paths +=
      '<circle cx="' +
      cx +
      '" cy="' +
      cy +
      '" r="' +
      r +
      '" fill="none" stroke="' +
      color +
      '" stroke-width="' +
      sw +
      '" opacity="' +
      Math.max(0.03, op).toFixed(3) +
      '"/>';
  }

  // Small focal dot at center
  paths +=
    '<circle cx="' +
    cx +
    '" cy="' +
    cy +
    '" r="' +
    Math.round(sw * 3) +
    '" fill="' +
    color +
    '" opacity="0.15"/>';
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    w +
    '" height="' +
    h +
    '">' +
    paths +
    "</svg>"
  );
}

function generateCrossHatchSvg(w: number, h: number, density: string): string {
  var count = getDensityValue(density, 10, 18, 30);
  var color = getPatternColor();
  var sw = Math.max(1, Math.round(Math.min(w, h) * 0.001));
  var paths = "";
  var gap = Math.round((Math.max(w, h) * 1.5) / count);

  // Diagonal lines (top-left to bottom-right)
  for (var i = -count; i <= count * 2; i++) {
    var x1 = i * gap;
    var y1 = 0;
    var x2 = x1 - h;
    var y2 = h;
    paths +=
      '<line x1="' +
      x1 +
      '" y1="' +
      y1 +
      '" x2="' +
      x2 +
      '" y2="' +
      y2 +
      '" stroke="' +
      color +
      '" stroke-width="' +
      sw +
      '" opacity="0.1"/>';
  }
  // Crossing diagonal lines (top-right to bottom-left)
  for (var j = -count; j <= count * 2; j++) {
    var x3 = j * gap;
    var y3 = 0;
    var x4 = x3 + h;
    var y4 = h;
    paths +=
      '<line x1="' +
      x3 +
      '" y1="' +
      y3 +
      '" x2="' +
      x4 +
      '" y2="' +
      y4 +
      '" stroke="' +
      color +
      '" stroke-width="' +
      sw +
      '" opacity="0.1"/>';
  }
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    w +
    '" height="' +
    h +
    '">' +
    paths +
    "</svg>"
  );
}

function generateDotsSvg(w: number, h: number, density: string): string {
  var gridSize = getDensityValue(density, 8, 14, 22);
  var color = getPatternColor();
  var dotR = Math.max(2, Math.round(Math.min(w, h) * 0.005));
  var paths = "";
  var gapX = Math.round(w / (gridSize + 1));
  var gapY = Math.round(h / (gridSize + 1));

  for (var r = 1; r <= gridSize; r++) {
    for (var c = 1; c <= gridSize; c++) {
      var dx = c * gapX;
      var dy = r * gapY;
      if (dx > 0 && dx < w && dy > 0 && dy < h) {
        paths +=
          '<circle cx="' +
          dx +
          '" cy="' +
          dy +
          '" r="' +
          dotR +
          '" fill="' +
          color +
          '" opacity="0.12"/>';
      }
    }
  }
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    w +
    '" height="' +
    h +
    '">' +
    paths +
    "</svg>"
  );
}

function generateGridSvg(w: number, h: number, density: string): string {
  var count = getDensityValue(density, 4, 8, 14);
  var color = getPatternColor();
  var sw = Math.max(1, Math.round(Math.min(w, h) * 0.001));
  var paths = "";
  var gap = Math.round(Math.min(w, h) / (count + 1));

  for (var i = 1; i <= count; i++) {
    if (i * gap < w) {
      paths +=
        '<line x1="' +
        i * gap +
        '" y1="0" x2="' +
        i * gap +
        '" y2="' +
        h +
        '" stroke="' +
        color +
        '" stroke-width="' +
        sw +
        '" opacity="0.1"/>';
    }
    if (i * gap < h) {
      paths +=
        '<line x1="0" y1="' +
        i * gap +
        '" x2="' +
        w +
        '" y2="' +
        i * gap +
        '" stroke="' +
        color +
        '" stroke-width="' +
        sw +
        '" opacity="0.1"/>';
    }
  }
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    w +
    '" height="' +
    h +
    '">' +
    paths +
    "</svg>"
  );
}

function generateDiagonalSvg(w: number, h: number, density: string): string {
  var count = getDensityValue(density, 8, 16, 28);
  var color = getPatternColor();
  var sw = Math.max(1, Math.round(Math.min(w, h) * 0.0012));
  var paths = "";
  var gap = Math.round((Math.max(w, h) * 1.5) / count);

  for (var i = -count; i <= count * 2; i++) {
    var x1 = i * gap;
    var y1 = 0;
    var x2 = x1 - h;
    var y2 = h;
    paths +=
      '<line x1="' +
      x1 +
      '" y1="' +
      y1 +
      '" x2="' +
      x2 +
      '" y2="' +
      y2 +
      '" stroke="' +
      color +
      '" stroke-width="' +
      sw +
      '" opacity="0.1"/>';
  }
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    w +
    '" height="' +
    h +
    '">' +
    paths +
    "</svg>"
  );
}

// ── Hero Patterns (from heropatterns.com, CC-BY-4.0 Steve Schoger) ──
// Each entry: [tileWidth, tileHeight, innerSvgContent]
// Inner SVG uses FILLCOLOR / FILLOPACITY placeholders

var HERO_CIRCUIT_BOARD: [number, number, string] = [
  304,
  304,
  "<path fill='FILLCOLOR' fill-opacity='FILLOPACITY' d='M44.1 224a5 5 0 1 1 0 2H0v-2h44.1zm160 48a5 5 0 1 1 0 2H82v-2h122.1zm57.8-46a5 5 0 1 1 0-2H304v2h-42.1zm0 16a5 5 0 1 1 0-2H304v2h-42.1zm6.2-114a5 5 0 1 1 0 2h-86.2a5 5 0 1 1 0-2h86.2zm-256-48a5 5 0 1 1 0 2H0v-2h12.1zm185.8 34a5 5 0 1 1 0-2h86.2a5 5 0 1 1 0 2h-86.2zM258 12.1a5 5 0 1 1-2 0V0h2v12.1zm-64 208a5 5 0 1 1-2 0v-54.2a5 5 0 1 1 2 0v54.2zm48-198.2V80h62v2h-64V21.9a5 5 0 1 1 2 0zm16 16V64h46v2h-48V37.9a5 5 0 1 1 2 0zm-128 96V208h16v12.1a5 5 0 1 1-2 0V210h-16v-76.1a5 5 0 1 1 2 0zm-5.9-21.9a5 5 0 1 1 0 2H114v48H85.9a5 5 0 1 1 0-2H112v-48h12.1zm-6.2 130a5 5 0 1 1 0-2H176v-74.1a5 5 0 1 1 2 0V242h-60.1zm-16-64a5 5 0 1 1 0-2H114v48h10.1a5 5 0 1 1 0 2H112v-48h-10.1zM66 284.1a5 5 0 1 1-2 0V274H50v30h-2v-32h18v12.1zM236.1 176a5 5 0 1 1 0 2H226v94h48v32h-2v-30h-48v-98h12.1zm25.8-30a5 5 0 1 1 0-2H274v44.1a5 5 0 1 1-2 0V146h-10.1zm-64 96a5 5 0 1 1 0-2H208v-80h16v-14h-42.1a5 5 0 1 1 0-2H226v18h-16v80h-12.1zm86.2-210a5 5 0 1 1 0 2H272V0h2v32h10.1zM98 101.9V146H53.9a5 5 0 1 1 0-2H96v-42.1a5 5 0 1 1 2 0zM53.9 34a5 5 0 1 1 0-2H80V0h2v34H53.9zm60.1 3.9V66H82v64H69.9a5 5 0 1 1 0-2H80V64h32V37.9a5 5 0 1 1 2 0zM101.9 82a5 5 0 1 1 0-2H128V37.9a5 5 0 1 1 2 0V82h-28.1zm16-64a5 5 0 1 1 0-2H146v44.1a5 5 0 1 1-2 0V18h-26.1zm102.2 270a5 5 0 1 1 0 2H98v14h-2v-16h124.1zM242 149.9V160h16v34h-16v62h48v48h-2v-46h-48v-66h16v-30h-16v-12.1a5 5 0 1 1 2 0zM53.9 18a5 5 0 1 1 0-2H64V2H48V0h18v18H53.9zm112 32a5 5 0 1 1 0-2H192V0h50v2h-48v48h-28.1zm-48-48a5 5 0 0 1-9.8-2h2.07a3 3 0 1 0 5.66 0H178v34h-18V21.9a5 5 0 1 1 2 0V32h14V2h-58.1zm0 96a5 5 0 1 1 0-2H137l32-32h39V21.9a5 5 0 1 1 2 0V66h-40.17l-32 32H117.9zm28.1 90.1a5 5 0 1 1-2 0v-76.51L175.59 80H224V21.9a5 5 0 1 1 2 0V82h-49.59L146 112.41v75.69zm16 32a5 5 0 1 1-2 0v-99.51L184.59 96H300.1a5 5 0 0 1 3.9-3.9v2.07a3 3 0 0 0 0 5.66v2.07a5 5 0 0 1-3.9-3.9H185.41L162 121.41v98.69zm-144-64a5 5 0 1 1-2 0v-3.51l48-48V48h32V0h2v50H66v55.41l-48 48v2.69zM50 53.9v43.51l-48 48V208h26.1a5 5 0 1 1 0 2H0v-65.41l48-48V53.9a5 5 0 1 1 2 0zm-16 16V89.41l-34 34v-2.82l32-32V69.9a5 5 0 1 1 2 0zM12.1 32a5 5 0 1 1 0 2H9.41L0 43.41V40.6L8.59 32h3.51zm265.8 18a5 5 0 1 1 0-2h18.69l7.41-7.41v2.82L297.41 50H277.9zm-16 160a5 5 0 1 1 0-2H288v-71.41l16-16v2.82l-14 14V210h-28.1zm-208 32a5 5 0 1 1 0-2H64v-22.59L40.59 194H21.9a5 5 0 1 1 0-2H41.41L66 216.59V242H53.9zm150.2 14a5 5 0 1 1 0 2H96v-56.6L56.6 162H37.9a5 5 0 1 1 0-2h19.5L98 200.6V256h106.1zm-150.2 2a5 5 0 1 1 0-2H80v-46.59L48.59 178H21.9a5 5 0 1 1 0-2H49.41L82 208.59V258H53.9zM34 39.8v1.61L9.41 66H0v-2h8.59L32 40.59V0h2v39.8zM2 300.1a5 5 0 0 1 3.9 3.9H3.83A3 3 0 0 0 0 302.17V256h18v48h-2v-46H2v42.1zM34 241v63h-2v-62H0v-2h34v1zM17 18H0v-2h16V0h2v18h-1zm273-2h14v2h-16V0h2v16zm-32 273v15h-2v-14h-14v14h-2v-16h18v1zM0 92.1A5.02 5.02 0 0 1 6 97a5 5 0 0 1-6 4.9v-2.07a3 3 0 1 0 0-5.66V92.1zM80 272h2v32h-2v-32zm37.9 32h-2.07a3 3 0 0 0-5.66 0h-2.07a5 5 0 0 1 9.8 0zM5.9 0A5.02 5.02 0 0 1 0 5.9V3.83A3 3 0 0 0 3.83 0H5.9zm294.2 0h2.07A3 3 0 0 0 304 3.83V5.9a5 5 0 0 1-3.9-5.9zm3.9 300.1v2.07a3 3 0 0 0-1.83 1.83h-2.07a5 5 0 0 1 3.9-3.9zM97 100a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-48 32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32 48a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16-64a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 96a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-144a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-96 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm96 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16-64a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-32 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM49 36a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-32 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM33 68a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-48a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 240a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16-64a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm80-176a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32 48a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm112 176a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 180a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0-32a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 84a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm32 64a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm16-16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'></path>",
];

var HERO_OVERLAPPING_HEX: [number, number, string] = [
  50,
  40,
  "<g fill-rule='evenodd'><g fill='FILLCOLOR' fill-opacity='FILLOPACITY'><path d='M40 10L36.67 0h-2.11l3.33 10H20l-2.28 6.84L12.11 0H10l6.67 20H10l-2.28 6.84L2.11 10 5.44 0h-2.1L0 10l6.67 20-3.34 10h2.11l2.28-6.84L10 40h20l2.28-6.84L34.56 40h2.1l-3.33-10H40l2.28-6.84L47.89 40H50l-6.67-20L50 0h-2.1l-5.62 16.84L40 10zm1.23 10l-2.28-6.84L34 28h4.56l2.67-8zm-10.67 8l-2-6h-9.12l2 6h9.12zm-12.84-4.84L12.77 38h15.79l2.67-8H20l-2.28-6.84zM18.77 20H30l2.28 6.84L37.23 12H21.44l-2.67 8zm-7.33 2H16l-4.95 14.84L8.77 30l2.67-8z' /></g></g>",
];

var HERO_FLIPPED_DIAMONDS: [number, number, string] = [
  16,
  20,
  "<g fill='FILLCOLOR' fill-opacity='FILLOPACITY' fill-rule='evenodd'><path d='M8 0v20L0 10M16 0v10L8 0M16 10v10H8'/></g>",
];

var HERO_ENDLESS_CLOUDS: [number, number, string] = [
  56,
  28,
  "<path fill='FILLCOLOR' fill-opacity='FILLOPACITY' d='M56 26v2h-7.75c2.3-1.27 4.94-2 7.75-2zm-26 2a2 2 0 1 0-4 0h-4.09A25.98 25.98 0 0 0 0 16v-2c.67 0 1.34.02 2 .07V14a2 2 0 0 0-2-2v-2a4 4 0 0 1 3.98 3.6 28.09 28.09 0 0 1 2.8-3.86A8 8 0 0 0 0 6V4a9.99 9.99 0 0 1 8.17 4.23c.94-.95 1.96-1.83 3.03-2.63A13.98 13.98 0 0 0 0 0h7.75c2 1.1 3.73 2.63 5.1 4.45 1.12-.72 2.3-1.37 3.53-1.93A20.1 20.1 0 0 0 14.28 0h2.7c.45.56.88 1.14 1.29 1.74 1.3-.48 2.63-.87 4-1.15-.11-.2-.23-.4-.36-.59H26v.07a28.4 28.4 0 0 1 4 0V0h4.09l-.37.59c1.38.28 2.72.67 4.01 1.15.4-.6.84-1.18 1.3-1.74h2.69a20.1 20.1 0 0 0-2.1 2.52c1.23.56 2.41 1.2 3.54 1.93A16.08 16.08 0 0 1 48.25 0H56c-4.58 0-8.65 2.2-11.2 5.6 1.07.8 2.09 1.68 3.03 2.63A9.99 9.99 0 0 1 56 4v2a8 8 0 0 0-6.77 3.74c1.03 1.2 1.97 2.5 2.79 3.86A4 4 0 0 1 56 10v2a2 2 0 0 0-2 2.07 28.4 28.4 0 0 1 2-.07v2c-9.2 0-17.3 4.78-21.91 12H30zM7.75 28H0v-2c2.81 0 5.46.73 7.75 2zM56 20v2c-5.6 0-10.65 2.3-14.28 6h-2.7c4.04-4.89 10.15-8 16.98-8zm-39.03 8h-2.69C10.65 24.3 5.6 22 0 22v-2c6.83 0 12.94 3.11 16.97 8zm15.01-.4a28.09 28.09 0 0 1 2.8-3.86 8 8 0 0 0-13.55 0c1.03 1.2 1.97 2.5 2.79 3.86a4 4 0 0 1 7.96 0zm14.29-11.86c1.3-.48 2.63-.87 4-1.15a25.99 25.99 0 0 0-44.55 0c1.38.28 2.72.67 4.01 1.15a21.98 21.98 0 0 1 36.54 0zm-5.43 2.71c1.13-.72 2.3-1.37 3.54-1.93a19.98 19.98 0 0 0-32.76 0c1.23.56 2.41 1.2 3.54 1.93a15.98 15.98 0 0 1 25.68 0zm-4.67 3.78c.94-.95 1.96-1.83 3.03-2.63a13.98 13.98 0 0 0-22.4 0c1.07.8 2.09 1.68 3.03 2.63a9.99 9.99 0 0 1 16.34 0z'></path>",
];

var HERO_MORPHING_DIAMONDS: [number, number, string] = [
  60,
  60,
  "<path d='M54.627 0l.83.828-1.415 1.415L51.8 0h2.827zM5.373 0l-.83.828L5.96 2.243 8.2 0H5.374zM48.97 0l3.657 3.657-1.414 1.414L46.143 0h2.828zM11.03 0L7.372 3.657 8.787 5.07 13.857 0H11.03zm32.284 0L49.8 6.485 48.384 7.9l-7.9-7.9h2.83zM16.686 0L10.2 6.485 11.616 7.9l7.9-7.9h-2.83zm20.97 0l9.315 9.314-1.414 1.414L34.828 0h2.83zM22.344 0L13.03 9.314l1.414 1.414L25.172 0h-2.83zM32 0l12.142 12.142-1.414 1.414L30 .828 17.272 13.556l-1.414-1.414L28 0h4zM.284 0l28 28-1.414 1.414L0 2.544V0h.284zM0 5.373l25.456 25.455-1.414 1.415L0 8.2V5.374zm0 5.656l22.627 22.627-1.414 1.414L0 13.86v-2.83zm0 5.656l19.8 19.8-1.415 1.413L0 19.514v-2.83zm0 5.657l16.97 16.97-1.414 1.415L0 25.172v-2.83zM0 28l14.142 14.142-1.414 1.414L0 30.828V28zm0 5.657L11.314 44.97 9.9 46.386l-9.9-9.9v-2.828zm0 5.657L8.485 47.8 7.07 49.212 0 42.143v-2.83zm0 5.657l5.657 5.657-1.414 1.415L0 47.8v-2.83zm0 5.657l2.828 2.83-1.414 1.413L0 53.456v-2.83zM54.627 60L30 35.373 5.373 60H8.2L30 38.2 51.8 60h2.827zm-5.656 0L30 41.03 11.03 60h2.828L30 43.858 46.142 60h2.83zm-5.656 0L30 46.686 16.686 60h2.83L30 49.515 40.485 60h2.83zm-5.657 0L30 52.343 22.343 60h2.83L30 55.172 34.828 60h2.83zM32 60l-2-2-2 2h4zM59.716 0l-28 28 1.414 1.414L60 2.544V0h-.284zM60 5.373L34.544 30.828l1.414 1.415L60 8.2V5.374zm0 5.656L37.373 33.656l1.414 1.414L60 13.86v-2.83zm0 5.656l-19.8 19.8 1.415 1.413L60 19.514v-2.83zm0 5.657l-16.97 16.97 1.414 1.415L60 25.172v-2.83zM60 28L45.858 42.142l1.414 1.414L60 30.828V28zm0 5.657L48.686 44.97l1.415 1.415 9.9-9.9v-2.828zm0 5.657L51.515 47.8l1.414 1.413 7.07-7.07v-2.83zm0 5.657l-5.657 5.657 1.414 1.415L60 47.8v-2.83zm0 5.657l-2.828 2.83 1.414 1.413L60 53.456v-2.83zM39.9 16.385l1.414-1.414L30 3.658 18.686 14.97l1.415 1.415 9.9-9.9 9.9 9.9zm-2.83 2.828l1.415-1.414L30 9.313 21.515 17.8l1.414 1.413 7.07-7.07 7.07 7.07zm-2.827 2.83l1.414-1.416L30 14.97l-5.657 5.657 1.414 1.415L30 17.8l4.243 4.242zm-2.83 2.827l1.415-1.414L30 20.626l-2.828 2.83 1.414 1.414L30 23.456l1.414 1.414zM56.87 59.414L58.284 58 30 29.716 1.716 58l1.414 1.414L30 32.544l26.87 26.87z' fill='FILLCOLOR' fill-opacity='FILLOPACITY' fill-rule='evenodd'/>",
];

var HERO_SIGNAL: [number, number, string] = [
  84,
  48,
  "<path d='M0 0h12v6H0V0zm28 8h12v6H28V8zm14-8h12v6H42V0zm14 0h12v6H56V0zm0 8h12v6H56V8zM42 8h12v6H42V8zm0 16h12v6H42v-6zm14-8h12v6H56v-6zm14 0h12v6H70v-6zm0-16h12v6H70V0zM28 32h12v6H28v-6zM14 16h12v6H14v-6zM0 24h12v6H0v-6zm0 8h12v6H0v-6zm14 0h12v6H14v-6zm14 8h12v6H28v-6zm-14 0h12v6H14v-6zm28 0h12v6H42v-6zm14-8h12v6H56v-6zm0-8h12v6H56v-6zm14 8h12v6H70v-6zm0 8h12v6H70v-6zM14 24h12v6H14v-6zm14-8h12v6H28v-6zM14 8h12v6H14V8zM0 8h12v6H0V8z' fill='FILLCOLOR' fill-opacity='FILLOPACITY' fill-rule='evenodd'/>",
];

var HERO_CONNECTIONS: [number, number, string] = [
  36,
  36,
  "<path d='M36 0H0v36h36V0zM15.126 2H2v13.126c.367.094.714.24 1.032.428L15.554 3.032c-.188-.318-.334-.665-.428-1.032zM18 4.874V18H4.874c-.094-.367-.24-.714-.428-1.032L16.968 4.446c.318.188.665.334 1.032.428zM22.874 2h11.712L20 16.586V4.874c1.406-.362 2.512-1.468 2.874-2.874zm10.252 18H20v13.126c.367.094.714.24 1.032.428l12.522-12.522c-.188-.318-.334-.665-.428-1.032zM36 22.874V36H22.874c-.094-.367-.24-.714-.428-1.032l12.522-12.522c.318.188.665.334 1.032.428zm0-7.748V3.414L21.414 18h11.712c.362-1.406 1.468-2.512 2.874-2.874zm-18 18V21.414L3.414 36h11.712c.362-1.406 1.468-2.512 2.874-2.874zM4.874 20h11.712L2 34.586V22.874c1.406-.362 2.512-1.468 2.874-2.874z' fill='FILLCOLOR' fill-opacity='FILLOPACITY' fill-rule='evenodd'/>",
];

var HERO_ARCHITECT: [number, number, string] = [
  100,
  199,
  "<g fill='FILLCOLOR' fill-opacity='FILLOPACITY'><path d='M0 199V0h1v1.99L100 199h-1.12L1 4.22V199H0zM100 2h-.12l-1-2H100v2z'></path></g>",
];

// Generates a tiled Hero Pattern SVG filling the given dimensions
// Uses manual <g transform> tiling (Figma does not support SVG <pattern>)
function generateHeroPatternSvg(
  w: number,
  h: number,
  tile: [number, number, string],
  density: string,
): string {
  var tW = tile[0];
  var tH = tile[1];
  var inner = tile[2];
  var color = getPatternColor();
  var opVal = getDensityValue(density, 0.06, 0.1, 0.16);
  // Replace placeholders
  var filledInner = inner
    .split("FILLCOLOR")
    .join(color)
    .split("FILLOPACITY")
    .join(String(opVal));
  // Build tiled SVG by repeating inner content at each grid position
  var svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='" +
    w +
    "' height='" +
    h +
    "'>";
  var cols = Math.ceil(w / tW) + 1;
  var rows = Math.ceil(h / tH) + 1;
  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < cols; col++) {
      svg +=
        "<g transform='translate(" +
        col * tW +
        "," +
        row * tH +
        ")'>" +
        filledInner +
        "</g>";
    }
  }
  svg += "</svg>";
  return svg;
}

// Generates a premium dotted globe with continents and connection arcs
function generateGlobeSvg(w: number, h: number, density: string): string {
  var color = getPatternColor();
  var opBase = getDensityValue(density, 0.08, 0.12, 0.18);
  // Globe positioned at bottom-right, oversized (1.8x frame)
  var globeR = Math.round(Math.max(w, h) * 0.9);
  var cx = Math.round(w * 0.85);
  var cy = Math.round(h * 0.85);
  var svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='" +
    w +
    "' height='" +
    h +
    "'>";
  // Outer circle
  svg +=
    "<circle cx='" +
    cx +
    "' cy='" +
    cy +
    "' r='" +
    globeR +
    "' fill='none' stroke='" +
    color +
    "' stroke-width='1.5' opacity='" +
    (opBase * 0.8).toFixed(3) +
    "'/>";
  // Latitude lines (ellipses)
  var latCount = getDensityValue(density, 5, 8, 12);
  for (var i = 1; i < latCount; i++) {
    var frac = i / latCount;
    var yOff = Math.round(globeR * Math.cos(frac * Math.PI) * -1);
    var ry = Math.round(globeR * Math.sin(frac * Math.PI) * 0.3);
    var fade = (opBase * (0.4 + 0.6 * Math.sin(frac * Math.PI))).toFixed(3);
    svg +=
      "<ellipse cx='" +
      cx +
      "' cy='" +
      (cy + yOff) +
      "' rx='" +
      globeR +
      "' ry='" +
      Math.max(ry, 4) +
      "' fill='none' stroke='" +
      color +
      "' stroke-width='1' opacity='" +
      fade +
      "'/>";
  }
  // Longitude lines (rotated ellipses)
  var lonCount = getDensityValue(density, 6, 10, 16);
  for (var j = 0; j < lonCount; j++) {
    var angle = (j / lonCount) * 180;
    var lonOp = (opBase * 0.7).toFixed(3);
    svg +=
      "<ellipse cx='" +
      cx +
      "' cy='" +
      cy +
      "' rx='" +
      Math.round(globeR * 0.35) +
      "' ry='" +
      globeR +
      "' fill='none' stroke='" +
      color +
      "' stroke-width='1' opacity='" +
      lonOp +
      "' transform='rotate(" +
      angle +
      " " +
      cx +
      " " +
      cy +
      ")'/>";
  }
  // Dotted continents - clusters of dots approximating landmasses
  var seed = 137;
  function rand(): number {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  }
  // Place dots on sphere surface using lat/lon, project to 2D
  var dotCount = getDensityValue(density, 60, 120, 200);
  var dotR = Math.max(2, Math.round(globeR * 0.008));
  // Continent-like clusters: define cluster centers (in lat/lon radians)
  var clusters = [
    { lat: 0.8, lon: 0.0, spread: 0.4, weight: 0.25 }, // Europe
    { lat: 0.6, lon: -0.3, spread: 0.5, weight: 0.2 }, // Africa
    { lat: 0.85, lon: -1.5, spread: 0.5, weight: 0.3 }, // N America
    { lat: 0.3, lon: -1.2, spread: 0.35, weight: 0.15 }, // S America
    { lat: 0.7, lon: 1.2, spread: 0.6, weight: 0.3 }, // Asia
    { lat: -0.5, lon: 2.0, spread: 0.35, weight: 0.1 }, // Australia
  ];
  for (var d = 0; d < dotCount; d++) {
    // Pick a cluster weighted by probability
    var r1 = rand();
    var cumW = 0;
    var cl = clusters[0];
    for (var ci = 0; ci < clusters.length; ci++) {
      cumW += clusters[ci].weight;
      if (r1 < cumW) {
        cl = clusters[ci];
        break;
      }
    }
    // Generate point near cluster center with gaussian-ish spread
    var lat = cl.lat + (rand() - 0.5) * cl.spread * 2;
    var lon = cl.lon + (rand() - 0.5) * cl.spread * 2;
    // Spherical to 2D projection (orthographic)
    var px = cx + Math.round(globeR * Math.cos(lat) * Math.sin(lon));
    var py = cy - Math.round(globeR * Math.sin(lat));
    // Only show dots on visible hemisphere (front-facing)
    var cosAngle = Math.cos(lat) * Math.cos(lon);
    if (cosAngle > -0.1) {
      var dotOp = (opBase * (0.5 + cosAngle * 0.8)).toFixed(3);
      svg +=
        "<circle cx='" +
        px +
        "' cy='" +
        py +
        "' r='" +
        dotR +
        "' fill='" +
        color +
        "' opacity='" +
        dotOp +
        "'/>";
    }
  }
  // Connection arcs between random dot pairs
  var arcCount = getDensityValue(density, 3, 6, 10);
  for (var a = 0; a < arcCount; a++) {
    var aLat1 = (rand() - 0.3) * 1.6;
    var aLon1 = (rand() - 0.5) * 2.5;
    var aLat2 = (rand() - 0.3) * 1.6;
    var aLon2 = (rand() - 0.5) * 2.5;
    var ax1 = cx + Math.round(globeR * Math.cos(aLat1) * Math.sin(aLon1));
    var ay1 = cy - Math.round(globeR * Math.sin(aLat1));
    var ax2 = cx + Math.round(globeR * Math.cos(aLat2) * Math.sin(aLon2));
    var ay2 = cy - Math.round(globeR * Math.sin(aLat2));
    var amx = Math.round((ax1 + ax2) / 2);
    var amy = Math.round((ay1 + ay2) / 2 - globeR * 0.15);
    svg +=
      "<path d='M" +
      ax1 +
      " " +
      ay1 +
      " Q " +
      amx +
      " " +
      amy +
      " " +
      ax2 +
      " " +
      ay2 +
      "' fill='none' stroke='" +
      color +
      "' stroke-width='1' opacity='" +
      (opBase * 0.5).toFixed(3) +
      "'/>";
    // Glow dots at endpoints
    svg +=
      "<circle cx='" +
      ax1 +
      "' cy='" +
      ay1 +
      "' r='" +
      (dotR + 1) +
      "' fill='" +
      color +
      "' opacity='" +
      (opBase * 0.8).toFixed(3) +
      "'/>";
    svg +=
      "<circle cx='" +
      ax2 +
      "' cy='" +
      ay2 +
      "' r='" +
      (dotR + 1) +
      "' fill='" +
      color +
      "' opacity='" +
      (opBase * 0.8).toFixed(3) +
      "'/>";
  }
  svg += "</svg>";
  return svg;
}

// Renders an SVG pattern string into a Figma frame, positioned at (0,0) filling the parent.
// Does NOT flatten — preserves individual stroke/fill properties on each SVG element.
function renderSvgPattern(
  parent: FrameNode,
  name: string,
  svgStr: string,
  w: number,
  h: number,
): void {
  try {
    var node = figma.createNodeFromSvg(svgStr);
    node.name = name;
    node.x = 0;
    node.y = 0;
    // SVG is already generated at correct w/h so no resize needed
    parent.appendChild(node);
  } catch (err) {
    // Pattern rendering failed — skip silently
  }
}

// Renders a custom uploaded image as a pattern overlay
function renderCustomPattern(parent: FrameNode, w: number, h: number): void {
  if (!customPatternImage) return;
  var dark = C.bg.r < 0.5;
  var r = figma.createRectangle();
  r.name = "custom-pattern";
  r.resize(w, h);
  r.x = 0;
  r.y = 0;
  r.fills = [
    { type: "IMAGE", imageHash: customPatternImage.hash, scaleMode: "FILL" },
  ];
  r.opacity = dark ? 0.3 : 0.15;
  parent.appendChild(r);
}

// Renders an illustration SVG (non-tiled) as an overlay, scaled to fit with opacity
function renderIllustrationOverlay(
  parent: FrameNode,
  name: string,
  svgStr: string,
  w: number,
  h: number,
  density: string,
): void {
  if (!svgStr) return;
  try {
    var node = figma.createNodeFromSvg(svgStr);
    node.name = name;
    // Scale to cover the frame while maintaining aspect ratio
    var origW = node.width;
    var origH = node.height;
    if (origW <= 0 || origH <= 0) {
      node.remove();
      return;
    }
    var scale = Math.max(w / origW, h / origH);
    node.resize(origW * scale, origH * scale);
    // Center in frame
    node.x = Math.round((w - origW * scale) / 2);
    node.y = Math.round((h - origH * scale) / 2);
    var dark = C.bg.r < 0.5;
    node.opacity = getDensityValue(
      density,
      dark ? 0.12 : 0.06,
      dark ? 0.2 : 0.1,
      dark ? 0.3 : 0.16,
    );
    parent.appendChild(node);
  } catch (err) {
    // Illustration rendering failed — skip silently
  }
}

function addPremiumBg(
  parent: FrameNode,
  w: number,
  h: number,
  variant?: number,
): void {
  const dark = C.bg.r < 0.5;
  const v = variant || 0;

  // Vary blob positions per variant for visual diversity
  const offsets: Array<[number, number, number, number]> = [
    [0.05, -0.35, -0.45, -0.25], // default
    [-0.1, -0.2, 0.1, -0.4], // flipped
    [0.15, -0.15, -0.3, -0.1], // shifted
    [0.0, -0.45, -0.5, -0.15], // wide spread
    [-0.2, -0.3, 0.2, -0.35], // diagonal
    [0.1, -0.1, -0.35, -0.3], // centered
  ];
  const [tx1, ty1, tx2, ty2] = offsets[v % offsets.length];

  // Layer 1: Warm red/crimson radial blob
  const g1 = figma.createRectangle();
  g1.name = "grad-warm";
  g1.resize(w, h);
  g1.x = 0;
  g1.y = 0;
  g1.fills = [
    {
      type: "GRADIENT_RADIAL",
      gradientTransform: [
        [1.4, 0, tx1],
        [0, 1.4, ty1],
      ],
      gradientStops: dark
        ? [
            { position: 0, color: { r: 0.86, g: 0.14, b: 0.14, a: 0.08 } },
            { position: 0.5, color: { r: 0.55, g: 0.08, b: 0.1, a: 0.04 } },
            { position: 1, color: { r: 0.2, g: 0.04, b: 0.04, a: 0 } },
          ]
        : [
            { position: 0, color: { r: 0.92, g: 0.3, b: 0.25, a: 0.06 } },
            { position: 0.5, color: { r: 0.95, g: 0.5, b: 0.45, a: 0.025 } },
            { position: 1, color: { r: 0.98, g: 0.75, b: 0.7, a: 0 } },
          ],
    },
  ];
  parent.appendChild(g1);

  // Layer 2: Cool blue-slate radial blob (depth contrast)
  const g2 = figma.createRectangle();
  g2.name = "grad-cool";
  g2.resize(w, h);
  g2.x = 0;
  g2.y = 0;
  g2.fills = [
    {
      type: "GRADIENT_RADIAL",
      gradientTransform: [
        [1.6, 0, tx2],
        [0, 1.6, ty2],
      ],
      gradientStops: dark
        ? [
            { position: 0, color: { r: 0.1, g: 0.12, b: 0.24, a: 0.07 } },
            { position: 0.5, color: { r: 0.07, g: 0.08, b: 0.16, a: 0.03 } },
            { position: 1, color: { r: 0.03, g: 0.03, b: 0.07, a: 0 } },
          ]
        : [
            { position: 0, color: { r: 0.55, g: 0.58, b: 0.78, a: 0.045 } },
            { position: 0.5, color: { r: 0.7, g: 0.72, b: 0.86, a: 0.02 } },
            { position: 1, color: { r: 0.88, g: 0.88, b: 0.94, a: 0 } },
          ],
    },
  ];
  parent.appendChild(g2);

  // Layer 3: Subtle diagonal light sweep for premium depth
  const g3 = figma.createRectangle();
  g3.name = "grad-sweep";
  g3.resize(w, h);
  g3.x = 0;
  g3.y = 0;
  g3.fills = [
    {
      type: "GRADIENT_LINEAR",
      gradientTransform: [
        [0.7, 0.7, -0.1],
        [-0.7, 0.7, 0.5],
      ],
      gradientStops: dark
        ? [
            { position: 0, color: { r: 1, g: 1, b: 1, a: 0.012 } },
            { position: 0.4, color: { r: 1, g: 1, b: 1, a: 0 } },
            { position: 0.6, color: { r: 1, g: 1, b: 1, a: 0 } },
            { position: 1, color: { r: 1, g: 1, b: 1, a: 0.008 } },
          ]
        : [
            { position: 0, color: { r: 0, g: 0, b: 0, a: 0.008 } },
            { position: 0.4, color: { r: 0, g: 0, b: 0, a: 0 } },
            { position: 0.6, color: { r: 0, g: 0, b: 0, a: 0 } },
            { position: 1, color: { r: 0, g: 0, b: 0, a: 0.006 } },
          ],
    },
  ];
  parent.appendChild(g3);

  // Apply optional background pattern if designer selected one
  if (activeBgPattern !== "none") {
    applyBgPattern(parent, w, h, activeBgPattern);
  }
}

// Apply optional background pattern (designer's choice via UI)
function applyBgPattern(
  parent: FrameNode,
  w: number,
  h: number,
  pattern: string,
): void {
  var density = activeBgDensity || "medium";
  var svgStr: string = "";

  switch (pattern) {
    case "topography":
      svgStr = generateTopographySvg(w, h, density);
      break;
    case "hexagonal":
      svgStr = generateHexGridSvg(w, h, density);
      break;
    case "circuit":
      svgStr = generateCircuitSvg(w, h, density);
      break;
    case "ripples":
      svgStr = generateRipplesSvg(w, h, density);
      break;
    case "crosshatch":
      svgStr = generateCrossHatchSvg(w, h, density);
      break;
    case "dots":
      svgStr = generateDotsSvg(w, h, density);
      break;
    case "grid":
      svgStr = generateGridSvg(w, h, density);
      break;
    case "diagonal":
      svgStr = generateDiagonalSvg(w, h, density);
      break;
    case "hero-circuit":
      svgStr = generateHeroPatternSvg(w, h, HERO_CIRCUIT_BOARD, density);
      break;
    case "hero-hexagons":
      svgStr = generateHeroPatternSvg(w, h, HERO_OVERLAPPING_HEX, density);
      break;
    case "hero-diamonds":
      svgStr = generateHeroPatternSvg(w, h, HERO_FLIPPED_DIAMONDS, density);
      break;
    case "hero-clouds":
      svgStr = generateHeroPatternSvg(w, h, HERO_ENDLESS_CLOUDS, density);
      break;
    case "hero-morphing":
      svgStr = generateHeroPatternSvg(w, h, HERO_MORPHING_DIAMONDS, density);
      break;
    case "hero-signal":
      svgStr = generateHeroPatternSvg(w, h, HERO_SIGNAL, density);
      break;
    case "hero-connections":
      svgStr = generateHeroPatternSvg(w, h, HERO_CONNECTIONS, density);
      break;
    case "hero-architect":
      svgStr = generateHeroPatternSvg(w, h, HERO_ARCHITECT, density);
      break;
    case "globe":
      svgStr = generateGlobeSvg(w, h, density);
      break;
    case "illust-fingerprint":
    case "illust-flat-map":
    case "illust-cyber-lock":
    case "illust-globe-transport":
      renderIllustrationOverlay(
        parent,
        "bg-illust-" + pattern,
        activePatternSvgStr,
        w,
        h,
        density,
      );
      return;
    case "custom":
      renderCustomPattern(parent, w, h);
      return;
  }

  if (svgStr) {
    renderSvgPattern(parent, "bg-pattern-" + pattern, svgStr, w, h);
  }
}

function addEllipse(
  parent: FrameNode,
  name: string,
  w: number,
  h: number,
  x: number,
  y: number,
  fill: Paint,
): EllipseNode {
  const e = figma.createEllipse();
  e.name = name;
  e.resize(w, h);
  e.x = x;
  e.y = y;
  e.fills = [fill];
  parent.appendChild(e);
  return e;
}

function addCtaButton(
  parent: FrameNode,
  fontSize: number,
  x: number,
  y: number,
  padX: number,
  padY: number,
  text?: string,
  shadow?: boolean,
): FrameNode {
  const btn = figma.createFrame();
  btn.name = "cta-button";
  btn.fills = [solid(C.red)];
  btn.cornerRadius = Math.max(6, Math.round(fontSize * 0.5));
  btn.clipsContent = true;

  const t = figma.createText();
  t.name = "cta";
  t.fontName = INTER_SEMI;
  t.fontSize = fontSize;
  t.fills = [solid(FIXED_WHITE)];
  var defaultCtas = [
    "Start Free Trial",
    "Book a Demo",
    "Learn More",
    "Get Started",
    "See How It Works",
    "Request Demo",
  ];
  var ctaIdx = Math.floor(Math.random() * defaultCtas.length);
  t.characters = text || defaultCtas[ctaIdx];
  t.x = padX;
  t.y = padY;
  btn.appendChild(t);

  btn.resize(t.width + padX * 2, t.height + padY * 2);
  btn.x = x;
  btn.y = y;
  if (shadow) {
    btn.effects = [
      {
        type: "DROP_SHADOW",
        color: { r: 0, g: 0, b: 0, a: 0.3 },
        offset: { x: 0, y: 4 },
        radius: 16,
        spread: 0,
        visible: true,
        blendMode: "NORMAL",
      } as DropShadowEffect,
      {
        type: "INNER_SHADOW",
        color: { r: 1, g: 1, b: 1, a: 0.12 },
        offset: { x: 0, y: 1 },
        radius: 0,
        spread: 0,
        visible: true,
        blendMode: "NORMAL",
      } as InnerShadowEffect,
    ];
  }
  parent.appendChild(btn);
  return btn;
}

function addBrand(
  parent: FrameNode,
  x: number,
  y: number,
  size: number,
  short?: boolean,
): SceneNode {
  // In-template brand is always the small circle C icon — subtle, not overwhelming
  // The full wordmark lives in the brand footer
  const iconSize = Math.round(size * 3.2);
  if (circleLogo) {
    const r = figma.createRectangle();
    r.name = "brand";
    r.resize(iconSize, iconSize);
    r.x = x;
    r.y = y;
    r.cornerRadius = Math.round(iconSize / 2);
    r.fills = [
      { type: "IMAGE", imageHash: circleLogo.hash, scaleMode: "FILL" },
    ];
    parent.appendChild(r);
    return r;
  }
  // Fallback: red circle with C letter
  addEllipse(parent, "brand-bg", iconSize, iconSize, x, y, solid(C.red));
  var cText = addText(
    parent,
    "brand",
    "C",
    INTER_BOLD,
    Math.round(size * 1.8),
    FIXED_WHITE,
    0,
    0,
  );
  cText.x = x + Math.round((iconSize - cText.width) / 2);
  cText.y = y + Math.round((iconSize - cText.height) / 2);
  return cText;
}

// Creates a proper vector social media icon from SVG path data
function addSocialIcon(
  parent: FrameNode,
  name: string,
  svgPath: string,
  color: RGB,
  size: number,
  x: number,
  y: number,
): void {
  const svgStr =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="' +
    svgPath +
    '"/></svg>';
  const svgFrame = figma.createNodeFromSvg(svgStr);
  const flat = figma.flatten([svgFrame]);
  flat.name = name;
  flat.resize(size, size);
  flat.x = x;
  flat.y = y;
  flat.fills = [solid(color)];
  parent.appendChild(flat);
}

// ── Brand Frame System ──────────────────────────────────────

interface BrandFrameConfig {
  topH: number;
  footerH: number;
  type: "full" | "none";
}

function getBrandFrameConfig(w: number, h: number): BrandFrameConfig {
  // Skip for very small, extreme aspect ratios, or tall story formats
  if (w <= 400 || h <= 150 || w / h > 3.5 || h / w > 1.5) {
    return { topH: 0, footerH: 0, type: "none" };
  }
  const base = Math.min(w, h);
  const footerH = Math.max(60, Math.round(base * 0.08));
  return { topH: 6, footerH, type: "full" };
}

function addTopAccentBar(parent: FrameNode, w: number): void {
  addRect(parent, "top-accent", w, 6, 0, 0, solid(C.red));
}

function addBrandFooter(
  parent: FrameNode,
  w: number,
  h: number,
  footerH: number,
  logoImage?: Image,
): void {
  const y = h - footerH;
  const s = footerH / 72; // scale factor (base designed for 72px)
  // Width-based scale cap: on narrow frames, shrink elements proportionally
  var wScale = Math.min(1, w / 1200);
  var sW = s * wScale; // combined scale for width-sensitive elements

  // Footer is ALWAYS a dark strip — consistent branding across light & dark themes
  var footerDarkBg: RGB = { r: 0.055, g: 0.055, b: 0.063 };
  var footerDimText: RGB = { r: 0.4, g: 0.4, b: 0.4 };
  addRect(parent, "footer-bg", w, footerH, 0, y, solid(footerDarkBg));

  // Red accent line at top of footer
  addRect(parent, "footer-line", w, 2, 0, y, solid(C.red, 0.8));

  const padX = Math.round(w * 0.03);
  const cy = y + Math.round(footerH / 2);

  // ── Left section: Full wordmark logo (always white on dark strip) ──
  // Cap logo to max 22% of frame width so it never crowds center elements
  if (brandLogo) {
    const rawLogoH = Math.round(22 * s);
    const rawLogoW = Math.round(rawLogoH * 7.65);
    const maxLogoW = Math.round(w * 0.22);
    const logoW = Math.min(rawLogoW, maxLogoW);
    const logoH = Math.round(logoW / 7.65);
    const r = figma.createRectangle();
    r.name = "footer-brand-logo";
    r.resize(logoW, logoH);
    r.x = padX;
    r.y = cy - Math.round(logoH * 0.7);
    r.fills = [{ type: "IMAGE", imageHash: brandLogo.hash, scaleMode: "FIT" }];
    parent.appendChild(r);

    // URL below wordmark
    const urlSize = Math.max(6, Math.round(9 * sW));
    addText(
      parent,
      "footer-url",
      "commando360.ai",
      INTER_REG,
      urlSize,
      footerDimText,
      padX,
      cy + Math.round(logoH * 0.4),
    );
  } else {
    // Fallback: text brand on dark strip
    const brandFontSize = Math.max(8, Math.round(13 * sW));
    addText(
      parent,
      "footer-brand",
      "COMMANDO360.AI",
      INTER_BOLD,
      brandFontSize,
      FIXED_WHITE,
      padX,
      cy - Math.round(brandFontSize * 0.6),
      { letterSpacing: 5 },
    );
  }

  // ── Center: Social icons (proper SVG vectors) ──
  const iconSize = Math.round(18 * sW);
  const iconGap = Math.round(12 * sW);

  const socials: Array<{ name: string; svg: string; color: RGB }> = [
    {
      name: "social-linkedin",
      svg: SVG_LINKEDIN,
      color: { r: 0.0, g: 0.47, b: 0.71 },
    },
    {
      name: "social-youtube",
      svg: SVG_YOUTUBE,
      color: { r: 0.86, g: 0.13, b: 0.13 },
    },
    {
      name: "social-instagram",
      svg: SVG_INSTAGRAM,
      color: { r: 0.76, g: 0.22, b: 0.47 },
    },
    {
      name: "social-x",
      svg: SVG_X,
      color: FIXED_WHITE,
    },
  ];

  const totalIconsW =
    iconSize * socials.length + iconGap * (socials.length - 1);
  const iconsStartX = Math.round(w * 0.5) - Math.round(totalIconsW / 2);
  const iconY = cy - Math.round(iconSize / 2);

  // Thin vertical dividers flanking social icons (fixed colors for dark footer)
  const divH = Math.round(footerH * 0.45);
  const divY = cy - Math.round(divH / 2);
  addRect(
    parent,
    "footer-div-l",
    1,
    divH,
    iconsStartX - Math.round(16 * sW),
    divY,
    solid(footerDimText, 0.25),
  );
  addRect(
    parent,
    "footer-div-r",
    1,
    divH,
    iconsStartX + totalIconsW + Math.round(16 * sW),
    divY,
    solid(footerDimText, 0.25),
  );

  for (let i = 0; i < socials.length; i++) {
    const sx = iconsStartX + i * (iconSize + iconGap);
    addSocialIcon(
      parent,
      socials[i].name,
      socials[i].svg,
      socials[i].color,
      iconSize,
      sx,
      iconY,
    );
  }

  // ── Right section: QR code + app badges ──
  const qrSize = Math.round(40 * sW);
  const qrX = w - padX - qrSize;
  const qrY = cy - Math.round(qrSize / 2);
  addRect(
    parent,
    "qr-code",
    qrSize,
    qrSize,
    qrX,
    qrY,
    solid(FIXED_WHITE),
    Math.round(3 * sW),
  );

  // App store text to the left of QR
  const badgeSize = Math.max(6, Math.round(8 * sW));
  const badgeX = qrX - Math.round(12 * sW);
  var footerGrayText: RGB = { r: 0.7, g: 0.7, b: 0.7 };
  const playText = addText(
    parent,
    "footer-playstore",
    "\u25B6 Google Play",
    INTER_MED,
    badgeSize,
    footerGrayText,
    0,
    cy - Math.round(badgeSize * 1.2),
  );
  playText.x = badgeX - playText.width;

  const appText = addText(
    parent,
    "footer-appstore",
    "App Store \u2014 Soon",
    INTER_REG,
    Math.max(6, Math.round(7 * sW)),
    footerDimText,
    0,
    cy + Math.round(badgeSize * 0.3),
  );
  appText.x = badgeX - appText.width;
}

// ══════════════════════════════════════════════════════════════
// BLOG TEMPLATE HELPERS
// ══════════════════════════════════════════════════════════════

function addImagePlaceholder(
  parent: FrameNode,
  name: string,
  w: number,
  h: number,
  x: number,
  y: number,
  caption?: string,
): number {
  // Dashed-border placeholder rectangle
  var r = figma.createRectangle();
  r.name = name;
  r.resize(w, h);
  r.x = x;
  r.y = y;
  r.fills = [
    solid(
      C.bg.r < 0.5
        ? { r: 0.08, g: 0.09, b: 0.1 }
        : { r: 0.92, g: 0.93, b: 0.94 },
    ),
  ];
  r.strokes = [
    solid(
      C.bg.r < 0.5
        ? { r: 0.2, g: 0.22, b: 0.25 }
        : { r: 0.7, g: 0.72, b: 0.75 },
    ),
  ];
  r.strokeWeight = 2;
  r.dashPattern = [8, 6];
  r.cornerRadius = 8;
  parent.appendChild(r);
  // Centered label
  addText(
    parent,
    name + "-label",
    "IMAGE",
    INTER_MED,
    14,
    C.bg.r < 0.5 ? { r: 0.35, g: 0.38, b: 0.4 } : { r: 0.55, g: 0.58, b: 0.6 },
    x + Math.round(w / 2) - 28,
    y + Math.round(h / 2) - 8,
    { opacity: 0.6 },
  );
  var totalH = h;
  if (caption) {
    addText(
      parent,
      name + "-caption",
      caption,
      INTER_REG,
      12,
      C.bg.r < 0.5
        ? { r: 0.5, g: 0.52, b: 0.55 }
        : { r: 0.45, g: 0.48, b: 0.5 },
      x,
      y + h + 8,
      { maxWidth: w, opacity: 0.7 },
    );
    totalH += 28;
  }
  return totalH;
}

function addSectionHeading(
  parent: FrameNode,
  num: number,
  title: string,
  y: number,
  contentW: number,
  contentX: number,
): number {
  var numStr = num < 10 ? "0" + num : String(num);
  addText(
    parent,
    "section_" + num + "_num",
    numStr,
    INTER_BOLD,
    14,
    C.red,
    contentX,
    y,
    { opacity: 0.8, letterSpacing: 10 },
  );
  var t = addText(
    parent,
    "section_" + num + "_title",
    title,
    INTER_BOLD,
    28,
    C.white,
    contentX,
    y + 24,
    { maxWidth: contentW, lineHeight: 130 },
  );
  // Red underline
  addRect(
    parent,
    "section-" + num + "-line",
    60,
    3,
    contentX,
    y + 24 + t.height + 12,
    solid(C.red, 0.6),
    2,
  );
  return t.height + 50;
}

function addPullquote(
  parent: FrameNode,
  text: string,
  attribution: string,
  y: number,
  contentW: number,
  contentX: number,
): number {
  // Red left bar
  addRect(parent, "pullquote-bar", 4, 80, contentX, y, solid(C.red, 0.8), 2);
  var t = addText(
    parent,
    "pullquote",
    text,
    INTER_MED,
    20,
    C.white,
    contentX + 24,
    y,
    { maxWidth: contentW - 24, lineHeight: 160, opacity: 0.9 },
  );
  var attrY = y + t.height + 12;
  addText(
    parent,
    "pullquote_author",
    "— " + attribution,
    INTER_REG,
    13,
    C.gray,
    contentX + 24,
    attrY,
    { opacity: 0.6 },
  );
  // Adjust bar height to match content
  return t.height + 40;
}

function addStatCard(
  parent: FrameNode,
  value: string,
  label: string,
  w: number,
  h: number,
  x: number,
  y: number,
): void {
  addRect(
    parent,
    "stat-card-bg",
    w,
    h,
    x,
    y,
    solid(
      C.bg.r < 0.5
        ? { r: 0.06, g: 0.07, b: 0.08 }
        : { r: 0.95, g: 0.96, b: 0.97 },
    ),
    8,
  );
  addText(
    parent,
    "stat_" + label.replace(/\s+/g, "_").toLowerCase(),
    value,
    INTER_BOLD,
    36,
    C.red,
    x + Math.round(w / 2) - 30,
    y + Math.round(h * 0.2),
    { align: "CENTER", maxWidth: w - 20 },
  );
  addText(
    parent,
    "stat_" + label.replace(/\s+/g, "_").toLowerCase() + "_label",
    label,
    INTER_REG,
    12,
    C.gray,
    x + Math.round(w / 2) - 30,
    y + Math.round(h * 0.65),
    { align: "CENTER", maxWidth: w - 20, opacity: 0.7 },
  );
}

function addCalloutBox(
  parent: FrameNode,
  title: string,
  body: string,
  accentColor: RGB,
  y: number,
  contentW: number,
  contentX: number,
): number {
  var boxH = 120;
  var bg = addRect(
    parent,
    "callout-bg",
    contentW,
    boxH,
    contentX,
    y,
    solid(
      C.bg.r < 0.5
        ? { r: 0.05, g: 0.06, b: 0.07 }
        : { r: 0.95, g: 0.96, b: 0.97 },
    ),
    8,
  );
  // Left accent bar
  addRect(
    parent,
    "callout-accent",
    4,
    boxH,
    contentX,
    y,
    solid(accentColor),
    2,
  );
  addText(
    parent,
    "callout-title",
    title,
    INTER_SEMI,
    14,
    accentColor,
    contentX + 20,
    y + 16,
    { maxWidth: contentW - 40 },
  );
  var bt = addText(
    parent,
    "callout-body",
    body,
    INTER_REG,
    13,
    C.white,
    contentX + 20,
    y + 40,
    { maxWidth: contentW - 40, lineHeight: 160, opacity: 0.8 },
  );
  var actualH = Math.max(boxH, bt.height + 56);
  if (actualH > boxH) bg.resize(contentW, actualH);
  return actualH;
}

// Reusable website nav bar — overlays on hero or sits at top
function addBlogNav(
  parent: FrameNode,
  w: number,
  y: number,
  transparent?: boolean,
): number {
  var isDark = C.bg.r < 0.5;
  var navH = 64;
  if (transparent) {
    // Transparent nav for hero overlays
    addRect(parent, "nav-bg", w, navH, 0, y, solid(FIXED_BLACK, 0.25));
  } else {
    addRect(
      parent,
      "nav-bg",
      w,
      navH,
      0,
      y,
      solid(
        isDark
          ? { r: 0.027, g: 0.031, b: 0.039 }
          : { r: 0.97, g: 0.97, b: 0.98 },
        0.85,
      ),
    );
  }
  addRect(
    parent,
    "nav-border",
    w,
    1,
    0,
    y + navH - 1,
    solid(isDark ? FIXED_WHITE : FIXED_BLACK, 0.04),
  );

  var navCy = y + Math.round(navH / 2);
  var navPad = Math.round(w * 0.04);

  if (brandLogo) {
    var logoH = 20;
    var logoW = Math.round(logoH * 7.65);
    var lr = figma.createRectangle();
    lr.name = "nav-logo";
    lr.resize(logoW, logoH);
    lr.x = navPad;
    lr.y = navCy - Math.round(logoH / 2);
    lr.fills = [{ type: "IMAGE", imageHash: brandLogo.hash, scaleMode: "FIT" }];
    parent.appendChild(lr);
  } else {
    addBrand(parent, navPad, navCy - 14, 8);
    addText(
      parent,
      "nav-brand-text",
      "Commando360.ai",
      INTER_SEMI,
      15,
      transparent ? FIXED_WHITE : C.white,
      navPad + 36,
      navCy - 8,
    );
  }

  var navLinkBase: RGB = transparent
    ? { r: 0.7, g: 0.7, b: 0.72 }
    : isDark
      ? { r: 0.5, g: 0.5, b: 0.52 }
      : { r: 0.4, g: 0.4, b: 0.42 };
  var navLinks = ["Home", "Blog", "Pricing", "Contact"];
  var nlX = w - navPad;
  for (var ni = navLinks.length - 1; ni >= 0; ni--) {
    var nlColor =
      navLinks[ni] === "Blog"
        ? transparent
          ? FIXED_WHITE
          : C.white
        : navLinkBase;
    var nt = addText(
      parent,
      "nav-" + navLinks[ni].toLowerCase(),
      navLinks[ni],
      INTER_MED,
      13,
      nlColor,
      0,
      navCy - 7,
    );
    nt.x = nlX - nt.width;
    nlX -= nt.width + 32;
  }
  return navH;
}

function addBlogHeader(
  parent: FrameNode,
  w: number,
  title: string,
  category: string,
  author: string,
  readTime: string,
  y: number,
): number {
  var startY = y;
  var isDark = C.bg.r < 0.5;
  var contentX = Math.round((w - 800) / 2);

  // ── Website-style sticky nav bar (glass effect) ──
  y += addBlogNav(parent, w, y);

  var navLinkColor: RGB = isDark
    ? { r: 0.5, g: 0.5, b: 0.52 }
    : { r: 0.4, g: 0.4, b: 0.42 };

  // Spacer
  y += 48;

  // ── Breadcrumbs (monospace, uppercase, small) ──
  var crumbStr = "Blog / " + category;
  addText(
    parent,
    "breadcrumbs",
    crumbStr,
    INTER_MED,
    11,
    navLinkColor,
    contentX,
    y,
    { letterSpacing: 15, opacity: 0.6 },
  );
  y += 32;

  // ── Category badge ──
  var catW = Math.round(category.length * 8 + 24);
  addRect(
    parent,
    "category-badge-bg",
    catW,
    26,
    contentX,
    y,
    solid(C.red, 0.1),
    6,
  );
  // Subtle border on badge
  var catBorder = figma.createRectangle();
  catBorder.name = "category-badge-border";
  catBorder.resize(catW, 26);
  catBorder.x = contentX;
  catBorder.y = y;
  catBorder.cornerRadius = 6;
  catBorder.fills = [];
  catBorder.strokes = [solid(C.red, 0.2)];
  catBorder.strokeWeight = 1;
  parent.appendChild(catBorder);
  addText(
    parent,
    "category",
    category.toUpperCase(),
    INTER_MED,
    11,
    C.red,
    contentX + 12,
    y + 6,
    { letterSpacing: 10 },
  );
  y += 42;

  // ── Meta line: date | author | read time ──
  var metaStr =
    "Mar 2026  |  " +
    (author || activeBlogAuthor) +
    "  |  " +
    readTime +
    " read";
  addText(parent, "meta", metaStr, INTER_REG, 11, navLinkColor, contentX, y, {
    letterSpacing: 8,
    opacity: 0.6,
  });
  y += 32;

  // ── Title ──
  var titleText = title || activeBlogTitle || "Your Article Title Goes Here";
  var tt = addText(
    parent,
    "title",
    titleText,
    INTER_BOLD,
    42,
    C.white,
    contentX,
    y,
    { maxWidth: 800, lineHeight: 110 },
  );
  y += tt.height + 28;

  // ── Gradient divider (matching website) ──
  var divGrad = figma.createRectangle();
  divGrad.name = "header-divider";
  divGrad.resize(800, 1);
  divGrad.x = contentX;
  divGrad.y = y;
  divGrad.fills = [
    {
      type: "GRADIENT_LINEAR",
      gradientTransform: [
        [1, 0, 0],
        [0, 1, 0],
      ],
      gradientStops: [
        { position: 0, color: { r: 1, g: 1, b: 1, a: isDark ? 0.06 : 0.1 } },
        { position: 0.5, color: { r: 1, g: 1, b: 1, a: isDark ? 0.04 : 0.06 } },
        { position: 1, color: { r: 1, g: 1, b: 1, a: 0 } },
      ],
    },
  ];
  parent.appendChild(divGrad);
  y += 40;

  return y - startY;
}

function addBlogFooter(parent: FrameNode, w: number, y: number): number {
  var startY = y;
  var isDark = C.bg.r < 0.5;
  var contentX = Math.round((w - 800) / 2);
  var dimColor: RGB = isDark
    ? { r: 0.5, g: 0.5, b: 0.52 }
    : { r: 0.4, g: 0.4, b: 0.42 };
  var faintColor: RGB = isDark
    ? { r: 0.35, g: 0.36, b: 0.38 }
    : { r: 0.55, g: 0.56, b: 0.58 };

  // ── Gradient divider ──
  y += 40;
  addBlogGradientDivider(parent, w, contentX, 800, y, isDark);
  y += 1;

  // ── Related Articles section ──
  y += 48;
  // Label with line (monospace, uppercase like website)
  addText(
    parent,
    "related-label",
    "RELATED ARTICLES",
    INTER_MED,
    11,
    dimColor,
    contentX,
    y,
    { letterSpacing: 15, opacity: 0.6 },
  );
  // Horizontal line extending from label
  addRect(
    parent,
    "related-line",
    560,
    1,
    contentX + 180,
    y + 6,
    solid(isDark ? FIXED_WHITE : FIXED_BLACK, 0.04),
  );
  y += 40;

  // Related article cards (3-column, with viewfinder corner brackets)
  var cardW = Math.round((800 - 40) / 3);
  var cardH = 180;
  var relatedTitles = [
    "AI-Powered Guard Scheduling: A New Approach",
    "Biometric Attendance in Security Operations",
    "Client Portal Best Practices for 2026",
  ];
  var relatedCategories = ["Technology", "Operations", "Product"];
  var relatedTimes = ["5 min", "4 min", "6 min"];
  for (var ri = 0; ri < 3; ri++) {
    var cx = contentX + ri * (cardW + 20);

    // Card background
    addRect(
      parent,
      "related_" + (ri + 1) + "_bg",
      cardW,
      cardH,
      cx,
      y,
      solid(isDark ? FIXED_WHITE : FIXED_BLACK, isDark ? 0.015 : 0.02),
      12,
    );

    // Viewfinder corner brackets
    var cornerSize = 16;
    var cornerStroke = 2;
    var cornerColor = solid(isDark ? FIXED_WHITE : FIXED_BLACK, 0.08);
    // Top-left
    addRect(
      parent,
      "vf-tl-h-" + ri,
      cornerSize,
      cornerStroke,
      cx,
      y,
      cornerColor,
    );
    addRect(
      parent,
      "vf-tl-v-" + ri,
      cornerStroke,
      cornerSize,
      cx,
      y,
      cornerColor,
    );
    // Top-right
    addRect(
      parent,
      "vf-tr-h-" + ri,
      cornerSize,
      cornerStroke,
      cx + cardW - cornerSize,
      y,
      cornerColor,
    );
    addRect(
      parent,
      "vf-tr-v-" + ri,
      cornerStroke,
      cornerSize,
      cx + cardW - cornerStroke,
      y,
      cornerColor,
    );
    // Bottom-left
    addRect(
      parent,
      "vf-bl-h-" + ri,
      cornerSize,
      cornerStroke,
      cx,
      y + cardH - cornerStroke,
      cornerColor,
    );
    addRect(
      parent,
      "vf-bl-v-" + ri,
      cornerStroke,
      cornerSize,
      cx,
      y + cardH - cornerSize,
      cornerColor,
    );
    // Bottom-right
    addRect(
      parent,
      "vf-br-h-" + ri,
      cornerSize,
      cornerStroke,
      cx + cardW - cornerSize,
      y + cardH - cornerStroke,
      cornerColor,
    );
    addRect(
      parent,
      "vf-br-v-" + ri,
      cornerStroke,
      cornerSize,
      cx + cardW - cornerStroke,
      y + cardH - cornerSize,
      cornerColor,
    );

    // Category badge
    var catText = relatedCategories[ri];
    var catBadgeW = Math.round(catText.length * 7 + 18);
    addRect(
      parent,
      "related_" + (ri + 1) + "_cat_bg",
      catBadgeW,
      20,
      cx + 20,
      y + 20,
      solid(C.red, 0.08),
      4,
    );
    addText(
      parent,
      "related_" + (ri + 1) + "_cat",
      catText.toUpperCase(),
      INTER_MED,
      9,
      C.red,
      cx + 28,
      y + 25,
      { letterSpacing: 8 },
    );

    // Title
    addText(
      parent,
      "related_" + (ri + 1) + "_title",
      relatedTitles[ri],
      INTER_SEMI,
      15,
      C.white,
      cx + 20,
      y + 56,
      { maxWidth: cardW - 40, lineHeight: 135, opacity: 0.85 },
    );

    // Footer divider + meta
    addRect(
      parent,
      "related_" + (ri + 1) + "_div",
      cardW - 40,
      1,
      cx + 20,
      y + cardH - 36,
      solid(isDark ? FIXED_WHITE : FIXED_BLACK, 0.04),
    );
    addText(
      parent,
      "related_" + (ri + 1) + "_time",
      relatedTimes[ri],
      INTER_REG,
      11,
      faintColor,
      cx + 20,
      y + cardH - 24,
      { letterSpacing: 5 },
    );
  }
  y += cardH;

  // ── Gradient divider ──
  y += 48;
  addBlogGradientDivider(
    parent,
    w,
    Math.round(w * 0.2),
    Math.round(w * 0.6),
    y,
    isDark,
  );
  y += 1;

  // ── Newsletter signup section ──
  y += 48;
  addText(
    parent,
    "newsletter-label",
    "STAY INFORMED",
    INTER_MED,
    11,
    C.red,
    Math.round(w / 2) - 50,
    y,
    { letterSpacing: 15, opacity: 0.6, align: "CENTER", maxWidth: 100 },
  );
  y += 28;
  addText(
    parent,
    "newsletter-heading",
    "Don't miss a dispatch",
    INTER_BOLD,
    28,
    C.white,
    Math.round(w / 2) - 180,
    y,
    { maxWidth: 360, align: "CENTER" },
  );
  y += 44;
  addText(
    parent,
    "newsletter-sub",
    "Join security and facility management leaders who get actionable intelligence delivered to their inbox every week.",
    INTER_REG,
    15,
    dimColor,
    Math.round(w / 2) - 220,
    y,
    { maxWidth: 440, align: "CENTER", lineHeight: 160 },
  );
  y += 60;

  // Email input + Subscribe button
  var formW = 420;
  var formX = Math.round((w - formW) / 2);
  var inputW = formW - 130;
  addRect(
    parent,
    "email-input",
    inputW,
    48,
    formX,
    y,
    solid(isDark ? FIXED_WHITE : FIXED_BLACK, 0.03),
    12,
  );
  var emailBorder = figma.createRectangle();
  emailBorder.name = "email-input-border";
  emailBorder.resize(inputW, 48);
  emailBorder.x = formX;
  emailBorder.y = y;
  emailBorder.cornerRadius = 12;
  emailBorder.fills = [];
  emailBorder.strokes = [solid(isDark ? FIXED_WHITE : FIXED_BLACK, 0.06)];
  emailBorder.strokeWeight = 1;
  parent.appendChild(emailBorder);
  addText(
    parent,
    "email-placeholder",
    "your@email.com",
    INTER_REG,
    13,
    faintColor,
    formX + 20,
    y + 16,
  );
  // Subscribe button
  addRect(
    parent,
    "subscribe-btn",
    120,
    48,
    formX + inputW + 10,
    y,
    solid(C.red),
    12,
  );
  addText(
    parent,
    "subscribe-text",
    "Subscribe",
    INTER_SEMI,
    13,
    FIXED_WHITE,
    formX + inputW + 28,
    y + 16,
  );
  y += 64;

  addText(
    parent,
    "newsletter-disclaimer",
    "No spam. Unsubscribe anytime. Weekly delivery.",
    INTER_REG,
    11,
    faintColor,
    Math.round(w / 2) - 160,
    y,
    { maxWidth: 320, align: "CENTER", letterSpacing: 5 },
  );
  y += 28;

  // ── Gradient divider ──
  y += 24;
  addBlogGradientDivider(
    parent,
    w,
    Math.round(w * 0.2),
    Math.round(w * 0.6),
    y,
    isDark,
  );
  y += 1;

  // ── Social links row ──
  y += 24;
  var socialY = y;
  // Left line
  addRect(
    parent,
    "social-line-l",
    48,
    1,
    Math.round(w / 2) - 130,
    socialY + 7,
    solid(isDark ? FIXED_WHITE : FIXED_BLACK, 0.06),
  );
  addText(
    parent,
    "social-linkedin",
    "LinkedIn",
    INTER_REG,
    12,
    faintColor,
    Math.round(w / 2) - 65,
    socialY,
    { letterSpacing: 5 },
  );
  addText(
    parent,
    "social-sep",
    "|",
    INTER_REG,
    12,
    { r: 0.25, g: 0.25, b: 0.27 },
    Math.round(w / 2) + 2,
    socialY,
  );
  addText(
    parent,
    "social-x",
    "@Commando360_AI",
    INTER_REG,
    12,
    faintColor,
    Math.round(w / 2) + 18,
    socialY,
    { letterSpacing: 5 },
  );
  // Right line
  addRect(
    parent,
    "social-line-r",
    48,
    1,
    Math.round(w / 2) + 148,
    socialY + 7,
    solid(isDark ? FIXED_WHITE : FIXED_BLACK, 0.06),
  );
  y += 32;

  // ── Minimal site footer (matching website) ──
  y += 24;
  addRect(
    parent,
    "site-footer-line",
    w,
    1,
    0,
    y,
    solid(isDark ? FIXED_WHITE : FIXED_BLACK, 0.04),
  );
  y += 1;
  var footerPadY = y + 28;
  var footerPad = Math.round(w * 0.04);

  // Left: logo + copyright
  if (brandLogo) {
    var fLogoH = 16;
    var fLogoW = Math.round(fLogoH * 7.65);
    var flr = figma.createRectangle();
    flr.name = "site-footer-logo";
    flr.resize(fLogoW, fLogoH);
    flr.x = footerPad;
    flr.y = footerPadY;
    flr.fills = [
      { type: "IMAGE", imageHash: brandLogo.hash, scaleMode: "FIT" },
    ];
    flr.opacity = 0.5;
    parent.appendChild(flr);
  } else {
    addBrand(parent, footerPad, footerPadY - 4, 6);
  }
  addText(
    parent,
    "site-footer-copy",
    "\u00A9 2026",
    INTER_REG,
    11,
    { r: 0.25, g: 0.25, b: 0.27 },
    footerPad + (brandLogo ? Math.round(16 * 7.65) + 16 : 40),
    footerPadY + 2,
    { letterSpacing: 5 },
  );

  // Right: Privacy · Terms
  var rightX = w - footerPad;
  var termsT = addText(
    parent,
    "site-footer-terms",
    "Terms",
    INTER_REG,
    11,
    faintColor,
    0,
    footerPadY + 2,
    { letterSpacing: 5 },
  );
  termsT.x = rightX - termsT.width;
  var privT = addText(
    parent,
    "site-footer-privacy",
    "Privacy",
    INTER_REG,
    11,
    faintColor,
    0,
    footerPadY + 2,
    { letterSpacing: 5 },
  );
  privT.x = rightX - termsT.width - 32 - privT.width;

  y = footerPadY + 40;
  return y - startY;
}

// Helper: gradient divider matching website style
function addBlogGradientDivider(
  parent: FrameNode,
  w: number,
  x: number,
  divW: number,
  y: number,
  isDark: boolean,
): void {
  var dv = figma.createRectangle();
  dv.name = "gradient-divider";
  dv.resize(divW, 1);
  dv.x = x;
  dv.y = y;
  dv.fills = [
    {
      type: "GRADIENT_LINEAR",
      gradientTransform: [
        [1, 0, 0],
        [0, 1, 0],
      ],
      gradientStops: [
        { position: 0, color: { r: 1, g: 1, b: 1, a: 0 } },
        { position: 0.5, color: { r: 1, g: 1, b: 1, a: isDark ? 0.04 : 0.08 } },
        { position: 1, color: { r: 1, g: 1, b: 1, a: 0 } },
      ],
    },
  ];
  parent.appendChild(dv);
}

// Placeholder body paragraph text
var BLOG_PLACEHOLDER_BODY =
  "Security operations are evolving rapidly as organizations adopt technology-driven approaches. Modern platforms enable real-time monitoring, automated incident response, and data-driven decision making that was impossible just a few years ago. This shift represents a fundamental change in how security companies deliver value to their clients.";

var BLOG_PLACEHOLDER_BODIES: string[] = [
  "The integration of IoT sensors, AI-powered analytics, and mobile-first workflows has created new possibilities for operational efficiency. Teams can now respond to incidents faster, track guard movements with precision, and generate compliance reports automatically.",
  "Client expectations have shifted dramatically. Today's security buyers demand transparency, real-time dashboards, and measurable KPIs. Companies that fail to modernize risk losing contracts to tech-forward competitors who can demonstrate clear ROI.",
  "Training and workforce development remain critical success factors. Technology amplifies human capability but cannot replace the judgment and situational awareness that experienced security professionals bring to every assignment.",
  "Data privacy and compliance requirements continue to evolve across jurisdictions. Organizations must balance the operational benefits of comprehensive data collection with their obligations under GDPR, CCPA, and industry-specific regulations.",
  "Looking ahead, the convergence of physical and cyber security will accelerate. Companies that build integrated platforms spanning both domains will be best positioned to serve the next generation of enterprise security needs.",
];

// ══════════════════════════════════════════════════════════════
// BLOG BUILD FUNCTIONS (8 templates)
// ══════════════════════════════════════════════════════════════

// ── 1. Hero Banner ──────────────────────────────────────────
function buildBlogHeroBanner(
  frame: FrameNode,
  w: number,
  h: number,
  sectionCount: number,
): number {
  var contentW = 800;
  var contentX = Math.round((w - contentW) / 2);
  var y = 0;

  // Full-width hero image
  addImagePlaceholder(
    frame,
    "hero-image",
    w,
    600,
    0,
    0,
    "Hero image — 1920×1080 recommended",
  );
  // Gradient overlay on hero
  var overlay = addRect(frame, "hero-overlay-grad", w, 600, 0, 0, {
    type: "GRADIENT_LINEAR",
    gradientTransform: [
      [1, 0, 0],
      [0, 1, 0],
    ],
    gradientStops: [
      { position: 0, color: { r: 0, g: 0, b: 0, a: 0 } },
      { position: 0.6, color: { r: 0, g: 0, b: 0, a: 0.4 } },
      { position: 1, color: { r: C.bg.r, g: C.bg.g, b: C.bg.b, a: 1 } },
    ],
  });

  // Website nav overlaid on hero
  addBlogNav(frame, w, 0, true);
  y = 600;

  // Header content overlaid on hero bottom
  y -= 200;
  var catBadgeY = y;
  addRect(
    frame,
    "category-badge-bg",
    120,
    28,
    contentX,
    catBadgeY,
    solid(C.red, 0.15),
    14,
  );
  addText(
    frame,
    "category",
    "Technology",
    INTER_SEMI,
    11,
    FIXED_WHITE,
    contentX + 20,
    catBadgeY + 7,
  );
  y = catBadgeY + 44;
  var titleStr =
    activeBlogTitle ||
    "AI-Powered Command Centers: The New Nerve Center of Security";
  var tt = addText(
    frame,
    "title",
    titleStr,
    INTER_BOLD,
    42,
    FIXED_WHITE,
    contentX,
    y,
    { maxWidth: contentW, lineHeight: 120 },
  );
  y += tt.height + 16;
  var metaStr =
    (activeBlogAuthor || "Commando360 Team") + "  ·  7 min read  ·  Mar 2026";
  addText(frame, "meta", metaStr, INTER_REG, 13, FIXED_WHITE, contentX, y, {
    opacity: 0.7,
  });
  y = 640;

  // Stats row
  y += 40;
  var statW = Math.round((contentW - 60) / 4);
  var stats = [
    ["87%", "Faster Response"],
    ["3.2x", "Detection Rate"],
    ["45%", "Cost Reduction"],
    ["99.9%", "Uptime"],
  ];
  for (var si = 0; si < 4; si++) {
    addStatCard(
      frame,
      stats[si][0],
      stats[si][1],
      statW,
      90,
      contentX + si * (statW + 20),
      y,
    );
  }
  y += 130;

  // Body sections
  for (var s = 0; s < sectionCount; s++) {
    y += 40;
    var titles = [
      "The Evolution of Security Command Centers",
      "How AI Transforms Monitoring",
      "Real-Time Threat Detection",
      "Predictive Analytics in Security",
      "Integration with Field Operations",
      "The ROI of Smart Command Centers",
    ];
    y += addSectionHeading(
      frame,
      s + 1,
      titles[s % titles.length],
      y,
      contentW,
      contentX,
    );
    y += 16;
    var bodyText = BLOG_PLACEHOLDER_BODIES[s % BLOG_PLACEHOLDER_BODIES.length];
    var bt = addText(
      frame,
      "section_" + (s + 1) + "_body",
      bodyText,
      INTER_REG,
      16,
      C.white,
      contentX,
      y,
      { maxWidth: contentW, lineHeight: 175, opacity: 0.85 },
    );
    y += bt.height + 24;

    // Breakout image after section 1
    if (s === 0) {
      y += addImagePlaceholder(
        frame,
        "breakout-image",
        w,
        400,
        0,
        y,
        "Full-width breakout image",
      );
      y += 20;
    }

    // Callout after section 2
    if (s === 1) {
      y += addCalloutBox(
        frame,
        "Key Insight",
        "Organizations using AI-powered command centers report 87% faster incident response times and 45% reduction in security breaches.",
        C.red,
        y,
        contentW,
        contentX,
      );
      y += 20;
    }
  }

  // Footer
  y += addBlogFooter(frame, w, y);
  return y;
}

// ── 2. Editorial ────────────────────────────────────────────
function buildBlogEditorial(
  frame: FrameNode,
  w: number,
  h: number,
  sectionCount: number,
): number {
  var contentW = 720;
  var contentX = Math.round((w - contentW) / 2);
  var y = 0;

  // Header
  y += addBlogHeader(
    frame,
    w,
    "",
    "Industry Insights",
    activeBlogAuthor || "Commando360 Team",
    "8 min read",
    0,
  );

  // Hero image
  y += 20;
  y += addImagePlaceholder(
    frame,
    "hero-image",
    contentW,
    400,
    contentX,
    y,
    "Featured image — 960×540 recommended",
  );
  y += 40;

  // Excerpt (italic)
  var excerptText =
    "How the security industry is transforming from reactive guarding to proactive, technology-enabled security operations.";
  var et = addText(
    frame,
    "excerpt",
    excerptText,
    INTER_MED,
    18,
    C.white,
    contentX,
    y,
    { maxWidth: contentW, lineHeight: 170, opacity: 0.7 },
  );
  y += et.height + 30;

  // Divider
  addRect(
    frame,
    "excerpt-divider",
    contentW,
    1,
    contentX,
    y,
    solid(
      C.bg.r < 0.5
        ? { r: 0.15, g: 0.16, b: 0.18 }
        : { r: 0.85, g: 0.86, b: 0.87 },
    ),
  );
  y += 30;

  // Drop cap first paragraph
  var firstBody = BLOG_PLACEHOLDER_BODY;
  addText(
    frame,
    "drop-cap",
    firstBody.charAt(0),
    INTER_BOLD,
    72,
    C.red,
    contentX,
    y - 4,
  );
  var restText = firstBody.substring(1);
  var ft = addText(
    frame,
    "section_1_body",
    restText,
    INTER_REG,
    16,
    C.white,
    contentX + 52,
    y,
    { maxWidth: contentW - 52, lineHeight: 180, opacity: 0.85 },
  );
  y += ft.height + 40;

  // Remaining sections
  for (var s = 1; s < sectionCount; s++) {
    var titles = [
      "The Shift from Reactive to Proactive",
      "Technology as an Enabler",
      "Building a Culture of Innovation",
      "Measuring What Matters",
      "The Path Forward",
    ];
    var tt = addText(
      frame,
      "section_" + (s + 1) + "_title",
      titles[s % titles.length],
      INTER_BOLD,
      26,
      C.white,
      contentX,
      y,
      { maxWidth: contentW, lineHeight: 130 },
    );
    y += tt.height + 16;
    var bt = addText(
      frame,
      "section_" + (s + 1) + "_body",
      BLOG_PLACEHOLDER_BODIES[s % BLOG_PLACEHOLDER_BODIES.length],
      INTER_REG,
      16,
      C.white,
      contentX,
      y,
      { maxWidth: contentW, lineHeight: 180, opacity: 0.85 },
    );
    y += bt.height + 30;

    // Pullquote after section 2
    if (s === 1) {
      y += addPullquote(
        frame,
        "The future belongs to security companies that can blend human expertise with intelligent technology.",
        "Industry Analyst",
        y,
        contentW,
        contentX,
      );
      y += 30;
    }
  }

  // Author bio
  y += 30;
  addRect(
    frame,
    "author-bio-bg",
    contentW,
    100,
    contentX,
    y,
    solid(
      C.bg.r < 0.5
        ? { r: 0.06, g: 0.07, b: 0.08 }
        : { r: 0.94, g: 0.95, b: 0.96 },
    ),
    8,
  );
  // Avatar circle
  var avatarR = figma.createEllipse();
  avatarR.name = "author-avatar";
  avatarR.resize(56, 56);
  avatarR.x = contentX + 20;
  avatarR.y = y + 22;
  avatarR.fills = [solid(C.red, 0.2)];
  frame.appendChild(avatarR);
  addText(
    frame,
    "author",
    activeBlogAuthor || "Commando360 Team",
    INTER_SEMI,
    15,
    C.white,
    contentX + 90,
    y + 24,
  );
  addText(
    frame,
    "author-role",
    "Security Operations Platform",
    INTER_REG,
    12,
    C.gray,
    contentX + 90,
    y + 48,
    { opacity: 0.6 },
  );
  y += 130;

  // Footer
  y += addBlogFooter(frame, w, y);
  return y;
}

// ── 3. Case Study ───────────────────────────────────────────
function buildBlogCaseStudy(
  frame: FrameNode,
  w: number,
  h: number,
  sectionCount: number,
): number {
  var contentW = 820;
  var contentX = Math.round((w - contentW) / 2);
  var y = 0;

  // Compact hero with gradient bg
  addPremiumBg(frame, w, 340, 1);
  addRect(frame, "hero-overlay", w, 340, 0, 0, {
    type: "GRADIENT_LINEAR",
    gradientTransform: [
      [1, 0, 0],
      [0, 1, 0],
    ],
    gradientStops: [
      { position: 0, color: { r: C.bg.r, g: C.bg.g, b: C.bg.b, a: 0.3 } },
      { position: 1, color: { r: C.bg.r, g: C.bg.g, b: C.bg.b, a: 0.95 } },
    ],
  });

  // Website nav overlaid on hero
  addBlogNav(frame, w, 0, true);
  y = 80;
  addRect(frame, "badge-bg", 100, 26, contentX, y, solid(C.red, 0.15), 13);
  addText(
    frame,
    "badge",
    "Case Study",
    INTER_SEMI,
    11,
    C.red,
    contentX + 16,
    y + 6,
  );
  y += 44;
  var titleStr =
    activeBlogTitle || "How SecureGuard Reduced Incident Response Time by 87%";
  var tt = addText(
    frame,
    "title",
    titleStr,
    INTER_BOLD,
    36,
    C.white,
    contentX,
    y,
    { maxWidth: contentW, lineHeight: 125 },
  );
  y += tt.height + 16;
  addText(
    frame,
    "meta",
    (activeBlogAuthor || "Commando360 Team") + "  ·  6 min read",
    INTER_REG,
    13,
    C.gray,
    contentX,
    y,
    { opacity: 0.5 },
  );
  y = 360;

  // Results snapshot bar
  y += 20;
  var snapW = Math.round((contentW - 30) / 4);
  var results = [
    ["87%", "Faster Response"],
    ["3.2x", "Detection Rate"],
    ["45%", "Cost Savings"],
    ["240+", "Sites Managed"],
  ];
  for (var ri = 0; ri < 4; ri++) {
    addStatCard(
      frame,
      results[ri][0],
      results[ri][1],
      snapW,
      85,
      contentX + ri * (snapW + 10),
      y,
    );
  }
  y += 120;

  // Featured image
  y += addImagePlaceholder(
    frame,
    "featured-image",
    contentW,
    400,
    contentX,
    y,
    "Client site or operations center",
  );
  y += 30;

  // Body sections with case-study structure
  var csLabels = [
    "The Client",
    "The Challenge",
    "Our Solution",
    "The Results",
    "Implementation Details",
    "What's Next",
  ];
  for (var s = 0; s < sectionCount; s++) {
    addText(
      frame,
      "section_label_" + (s + 1),
      csLabels[s % csLabels.length].toUpperCase(),
      INTER_SEMI,
      11,
      C.red,
      contentX,
      y,
      { letterSpacing: 15, opacity: 0.8 },
    );
    y += 24;
    var st = addText(
      frame,
      "section_" + (s + 1) + "_title",
      csLabels[s % csLabels.length],
      INTER_BOLD,
      24,
      C.white,
      contentX,
      y,
      { maxWidth: contentW },
    );
    y += st.height + 12;
    var bt = addText(
      frame,
      "section_" + (s + 1) + "_body",
      BLOG_PLACEHOLDER_BODIES[s % BLOG_PLACEHOLDER_BODIES.length],
      INTER_REG,
      16,
      C.white,
      contentX,
      y,
      { maxWidth: contentW, lineHeight: 175, opacity: 0.85 },
    );
    y += bt.height + 30;

    // Before/After cards after "The Challenge"
    if (s === 1) {
      var halfW = Math.round((contentW - 20) / 2);
      addRect(
        frame,
        "before-card",
        halfW,
        160,
        contentX,
        y,
        solid(
          C.bg.r < 0.5
            ? { r: 0.06, g: 0.07, b: 0.08 }
            : { r: 0.94, g: 0.95, b: 0.96 },
        ),
        8,
      );
      addRect(
        frame,
        "before-accent",
        halfW,
        3,
        contentX,
        y,
        solid(C.gray, 0.3),
      );
      addText(
        frame,
        "before-label",
        "BEFORE",
        INTER_SEMI,
        12,
        C.gray,
        contentX + 16,
        y + 16,
        { opacity: 0.5 },
      );
      addText(
        frame,
        "before-text",
        "Manual paper-based incident reports\nAverage 45-minute response time\nNo real-time visibility across sites",
        INTER_REG,
        13,
        C.white,
        contentX + 16,
        y + 44,
        { maxWidth: halfW - 32, lineHeight: 170, opacity: 0.7 },
      );

      var afterX = contentX + halfW + 20;
      addRect(
        frame,
        "after-card",
        halfW,
        160,
        afterX,
        y,
        solid(
          C.bg.r < 0.5
            ? { r: 0.06, g: 0.07, b: 0.08 }
            : { r: 0.94, g: 0.95, b: 0.96 },
        ),
        8,
      );
      addRect(frame, "after-accent", halfW, 3, afterX, y, solid(C.red, 0.6));
      addText(
        frame,
        "after-label",
        "AFTER",
        INTER_SEMI,
        12,
        C.red,
        afterX + 16,
        y + 16,
      );
      addText(
        frame,
        "after-text",
        "Digital real-time incident reporting\nAverage 6-minute response time\nLive dashboard for all 240+ sites",
        INTER_REG,
        13,
        C.white,
        afterX + 16,
        y + 44,
        { maxWidth: halfW - 32, lineHeight: 170, opacity: 0.7 },
      );
      y += 190;
    }

    // Client quote
    if (s === 2) {
      y += addPullquote(
        frame,
        "Commando360 transformed how we manage security across all our locations. The visibility alone was worth the investment.",
        "VP of Security, SecureGuard Inc.",
        y,
        contentW,
        contentX,
      );
      y += 20;
    }
  }

  y += addBlogFooter(frame, w, y);
  return y;
}

// ── 4. Changelog ────────────────────────────────────────────
function buildBlogChangelog(
  frame: FrameNode,
  w: number,
  h: number,
  sectionCount: number,
): number {
  var contentW = 800;
  var contentX = Math.round((w - contentW) / 2);
  var y = 0;

  // Header
  y += addBlogHeader(
    frame,
    w,
    "",
    "Product Updates",
    activeBlogAuthor || "Commando360 Team",
    "5 min read",
    0,
  );

  // Version tag
  addRect(frame, "version-bg", 80, 28, contentX, y, solid(C.red, 0.12), 14);
  addText(
    frame,
    "version",
    "v3.2.0",
    INTER_SEMI,
    12,
    C.red,
    contentX + 14,
    y + 6,
  );
  y += 48;

  // Changelog title override
  var titleStr = activeBlogTitle || "March 2026 Product Updates";
  var tt = addText(
    frame,
    "changelog-title",
    titleStr,
    INTER_BOLD,
    32,
    C.white,
    contentX,
    y,
    { maxWidth: contentW },
  );
  y += tt.height + 12;
  var es = addText(
    frame,
    "excerpt",
    "New features, improvements, and bug fixes for March 2026.",
    INTER_REG,
    16,
    C.gray,
    contentX,
    y,
    { maxWidth: contentW, opacity: 0.6 },
  );
  y += es.height + 40;

  // Changelog entries
  var badgeColors: Record<string, RGB> = {
    New: { r: 0.13, g: 0.77, b: 0.37 },
    Improved: { r: 0.23, g: 0.51, b: 0.96 },
    Fixed: { r: 0.98, g: 0.75, b: 0.15 },
  };
  var entries = [
    {
      badge: "New",
      date: "Mar 8",
      title: "AI-Powered Incident Categorization",
      body: "Incidents are now automatically categorized using machine learning, reducing manual triage time by 60%.",
    },
    {
      badge: "New",
      date: "Mar 6",
      title: "Mobile Shift Swap Requests",
      body: "Guards can now request shift swaps directly from the mobile app with supervisor approval workflow.",
    },
    {
      badge: "Improved",
      date: "Mar 5",
      title: "Dashboard Load Performance",
      body: "Command center dashboard now loads 3x faster with optimized data queries and client-side caching.",
    },
    {
      badge: "Improved",
      date: "Mar 3",
      title: "Report Export Formatting",
      body: "PDF and Excel exports now include branded headers, better date formatting, and configurable columns.",
    },
    {
      badge: "Fixed",
      date: "Mar 2",
      title: "GPS Drift on Android Devices",
      body: "Resolved intermittent GPS accuracy issues on certain Android 14 devices during guard tour tracking.",
    },
    {
      badge: "Fixed",
      date: "Mar 1",
      title: "Timezone Handling in Shift Generation",
      body: "Fixed edge case where overnight shifts crossing timezone boundaries could generate duplicate entries.",
    },
  ];

  var entryCount = Math.min(entries.length, sectionCount * 2);
  for (var ei = 0; ei < entryCount; ei++) {
    var entry = entries[ei];
    // Date
    addText(
      frame,
      "entry_" + ei + "_date",
      entry.date,
      INTER_REG,
      12,
      C.gray,
      contentX,
      y + 2,
      { opacity: 0.5 },
    );
    // Badge
    var badgeColor = badgeColors[entry.badge] || C.gray;
    addRect(
      frame,
      "entry_" + ei + "_badge_bg",
      70,
      22,
      contentX + 60,
      y,
      solid(badgeColor, 0.15),
      11,
    );
    addText(
      frame,
      "entry_" + ei + "_badge",
      entry.badge,
      INTER_SEMI,
      10,
      badgeColor,
      contentX + 74,
      y + 4,
    );
    // Title & body
    var entryT = addText(
      frame,
      "entry_" + ei + "_title",
      entry.title,
      INTER_SEMI,
      17,
      C.white,
      contentX + 150,
      y,
      { maxWidth: contentW - 150 },
    );
    y += entryT.height + 8;
    var entryB = addText(
      frame,
      "entry_" + ei + "_body",
      entry.body,
      INTER_REG,
      14,
      C.white,
      contentX + 150,
      y,
      { maxWidth: contentW - 150, lineHeight: 165, opacity: 0.75 },
    );
    y += entryB.height + 12;

    // Screenshot placeholder for major entries
    if (ei < 2) {
      y += addImagePlaceholder(
        frame,
        "entry_" + ei + "_screenshot",
        contentW - 150,
        200,
        contentX + 150,
        y,
        "Feature screenshot",
      );
      y += 8;
    }

    // Divider
    addRect(
      frame,
      "entry_" + ei + "_divider",
      contentW,
      1,
      contentX,
      y,
      solid(
        C.bg.r < 0.5
          ? { r: 0.12, g: 0.13, b: 0.15 }
          : { r: 0.88, g: 0.89, b: 0.9 },
      ),
    );
    y += 24;
  }

  y += addBlogFooter(frame, w, y);
  return y;
}

// ── 5. Comparison ───────────────────────────────────────────
function buildBlogComparison(
  frame: FrameNode,
  w: number,
  h: number,
  sectionCount: number,
): number {
  var contentW = 820;
  var contentX = Math.round((w - contentW) / 2);
  var y = 0;

  y += addBlogHeader(
    frame,
    w,
    "",
    "Comparison",
    activeBlogAuthor || "Commando360 Team",
    "10 min read",
    0,
  );

  // Excerpt
  var excerptStr =
    "A comprehensive feature-by-feature comparison to help you make the right choice for your security operations.";
  var et = addText(
    frame,
    "excerpt",
    excerptStr,
    INTER_REG,
    16,
    C.gray,
    contentX,
    y,
    { maxWidth: contentW, lineHeight: 170, opacity: 0.6 },
  );
  y += et.height + 40;

  // Comparison table
  var colW = Math.round((contentW - 200) / 2);
  // Table header
  addRect(
    frame,
    "table-header-bg",
    contentW,
    48,
    contentX,
    y,
    solid(
      C.bg.r < 0.5
        ? { r: 0.08, g: 0.09, b: 0.1 }
        : { r: 0.92, g: 0.93, b: 0.94 },
    ),
    8,
  );
  addText(
    frame,
    "table-header-feature",
    "Feature",
    INTER_SEMI,
    13,
    C.gray,
    contentX + 16,
    y + 15,
  );
  addText(
    frame,
    "table-header-c360",
    "Commando360",
    INTER_SEMI,
    13,
    C.red,
    contentX + 216,
    y + 15,
  );
  addText(
    frame,
    "table-header-trad",
    "Traditional",
    INTER_SEMI,
    13,
    C.gray,
    contentX + 216 + colW + 16,
    y + 15,
    { opacity: 0.6 },
  );
  y += 52;

  // Table rows
  var rows = [
    ["Real-time GPS Tracking", "Yes — live map view", "Manual check-ins only"],
    [
      "Incident Reporting",
      "Mobile app + auto-categorize",
      "Paper forms, next-day",
    ],
    ["Shift Management", "AI-optimized scheduling", "Manual spreadsheets"],
    ["Client Portal", "Self-serve dashboards", "Monthly PDF reports"],
    [
      "Biometric Attendance",
      "Face + fingerprint + geo-fence",
      "Fingerprint only",
    ],
    ["Command Center", "AI-powered, multi-site", "CCTV monitoring room"],
  ];
  var rowCount = Math.min(rows.length, sectionCount * 2);
  for (var ri = 0; ri < rowCount; ri++) {
    var rowBg =
      ri % 2 === 0
        ? solid(
            C.bg.r < 0.5
              ? { r: 0.05, g: 0.055, b: 0.06 }
              : { r: 0.96, g: 0.965, b: 0.97 },
          )
        : solid(C.bg);
    addRect(frame, "row_" + ri + "_bg", contentW, 48, contentX, y, rowBg);
    addText(
      frame,
      "row_" + ri + "_feature",
      rows[ri][0],
      INTER_MED,
      13,
      C.white,
      contentX + 16,
      y + 15,
      { maxWidth: 184, opacity: 0.9 },
    );
    addText(
      frame,
      "row_" + ri + "_c360",
      rows[ri][1],
      INTER_REG,
      13,
      C.white,
      contentX + 216,
      y + 15,
      { maxWidth: colW - 16, opacity: 0.85 },
    );
    addText(
      frame,
      "row_" + ri + "_trad",
      rows[ri][2],
      INTER_REG,
      13,
      C.gray,
      contentX + 216 + colW + 16,
      y + 15,
      { maxWidth: colW - 16, opacity: 0.5 },
    );
    y += 50;
  }
  y += 30;

  // Body sections
  for (var s = 0; s < Math.min(sectionCount, 3); s++) {
    y += addSectionHeading(
      frame,
      s + 1,
      [
        "Deep Dive: Operational Efficiency",
        "The Total Cost of Ownership",
        "Implementation & Onboarding",
      ][s % 3],
      y,
      contentW,
      contentX,
    );
    y += 16;
    var bt = addText(
      frame,
      "section_" + (s + 1) + "_body",
      BLOG_PLACEHOLDER_BODIES[s % BLOG_PLACEHOLDER_BODIES.length],
      INTER_REG,
      16,
      C.white,
      contentX,
      y,
      { maxWidth: contentW, lineHeight: 175, opacity: 0.85 },
    );
    y += bt.height + 30;
  }

  y += addBlogFooter(frame, w, y);
  return y;
}

// ── 6. Data Report ──────────────────────────────────────────
function buildBlogDataReport(
  frame: FrameNode,
  w: number,
  h: number,
  sectionCount: number,
): number {
  var sidebarW = 220;
  var mainW = 820;
  var mainX = sidebarW + 80;
  var contentW = mainW;
  var y = 0;

  // Nav bar (full width)
  addRect(
    frame,
    "nav-bg",
    w,
    64,
    0,
    0,
    solid(
      C.bg.r < 0.5
        ? { r: 0.04, g: 0.045, b: 0.05 }
        : { r: 0.97, g: 0.97, b: 0.98 },
    ),
  );
  addBrand(frame, 40, 18, 28);
  y = 64;

  // Sidebar TOC
  var tocY = y + 40;
  addText(frame, "toc-label", "CONTENTS", INTER_SEMI, 11, C.red, 40, tocY, {
    letterSpacing: 15,
  });
  tocY += 30;
  var tocTitles = [
    "Executive Summary",
    "Key Findings",
    "Market Analysis",
    "Security Metrics",
    "Recommendations",
    "Methodology",
  ];
  for (var ti = 0; ti < Math.min(tocTitles.length, sectionCount + 1); ti++) {
    var numStr = (ti + 1 < 10 ? "0" : "") + (ti + 1);
    addText(
      frame,
      "toc_" + ti,
      numStr + "  " + tocTitles[ti],
      INTER_REG,
      13,
      ti === 0 ? C.red : C.gray,
      40,
      tocY,
      { maxWidth: sidebarW - 20, opacity: ti === 0 ? 1 : 0.6 },
    );
    tocY += 32;
  }

  // Main content
  y += 40;
  addRect(frame, "report-badge-bg", 80, 26, mainX, y, solid(C.red, 0.12), 13);
  addText(
    frame,
    "category",
    "Report",
    INTER_SEMI,
    11,
    C.red,
    mainX + 16,
    y + 6,
  );
  y += 44;
  var titleStr = activeBlogTitle || "2026 Security Operations Benchmark Report";
  var tt = addText(
    frame,
    "title",
    titleStr,
    INTER_BOLD,
    36,
    C.white,
    mainX,
    y,
    { maxWidth: contentW, lineHeight: 120 },
  );
  y += tt.height + 12;
  addText(
    frame,
    "meta",
    (activeBlogAuthor || "Commando360 Team") + "  ·  12 min read",
    INTER_REG,
    13,
    C.gray,
    mainX,
    y,
    { opacity: 0.5 },
  );
  y += 40;

  // Hero image
  y += addImagePlaceholder(
    frame,
    "hero-image",
    contentW,
    320,
    mainX,
    y,
    "Report cover or key visual",
  );
  y += 40;

  // Stat cards row
  var scW = Math.round((contentW - 30) / 4);
  var reportStats = [
    ["1,200+", "Companies Surveyed"],
    ["4.7M", "Data Points"],
    ["28", "Countries"],
    ["$340B", "Market Size"],
  ];
  for (var si = 0; si < 4; si++) {
    addStatCard(
      frame,
      reportStats[si][0],
      reportStats[si][1],
      scW,
      85,
      mainX + si * (scW + 10),
      y,
    );
  }
  y += 120;

  // Numbered sections
  for (var s = 0; s < sectionCount; s++) {
    y += addSectionHeading(
      frame,
      s + 1,
      tocTitles[(s + 1) % tocTitles.length],
      y,
      contentW,
      mainX,
    );
    y += 16;
    var bt = addText(
      frame,
      "section_" + (s + 1) + "_body",
      BLOG_PLACEHOLDER_BODIES[s % BLOG_PLACEHOLDER_BODIES.length],
      INTER_REG,
      16,
      C.white,
      mainX,
      y,
      { maxWidth: contentW, lineHeight: 175, opacity: 0.85 },
    );
    y += bt.height + 24;

    // Chart placeholder after first section
    if (s === 0) {
      y += addImagePlaceholder(
        frame,
        "chart-1",
        contentW,
        280,
        mainX,
        y,
        "Chart or data visualization",
      );
      addText(
        frame,
        "chart-1-cite",
        "Source: Commando360 Security Operations Survey, 2026 (n=1,247)",
        INTER_REG,
        11,
        C.gray,
        mainX,
        y - 8,
        { opacity: 0.4 },
      );
      y += 20;
    }

    // Callout after section 2
    if (s === 1) {
      y += addCalloutBox(
        frame,
        "Key Finding",
        "Organizations that adopted integrated security platforms saw a 3.2x improvement in incident detection rates compared to those using fragmented point solutions.",
        { r: 0.13, g: 0.77, b: 0.37 },
        y,
        contentW,
        mainX,
      );
      y += 20;
    }
  }

  y += addBlogFooter(frame, w, y);
  return y;
}

// ── 7. Immersive ────────────────────────────────────────────
function buildBlogImmersive(
  frame: FrameNode,
  w: number,
  h: number,
  sectionCount: number,
): number {
  var contentW = 700;
  var contentX = Math.round((w - contentW) / 2);
  var y = 0;

  // Full-bleed hero
  addImagePlaceholder(
    frame,
    "hero-image",
    w,
    700,
    0,
    0,
    "Dramatic hero image — 1920×1080",
  );
  addRect(frame, "hero-overlay", w, 700, 0, 0, {
    type: "GRADIENT_LINEAR",
    gradientTransform: [
      [1, 0, 0],
      [0, 1, 0],
    ],
    gradientStops: [
      { position: 0, color: { r: 0, g: 0, b: 0, a: 0 } },
      { position: 0.5, color: { r: 0, g: 0, b: 0, a: 0.3 } },
      { position: 1, color: { r: C.bg.r, g: C.bg.g, b: C.bg.b, a: 0.95 } },
    ],
  });

  // Website nav overlaid on hero
  addBlogNav(frame, w, 0, true);

  // Kicker + title centered on hero
  addText(
    frame,
    "kicker",
    "VISUAL STORY",
    INTER_SEMI,
    12,
    FIXED_WHITE,
    Math.round(w / 2) - 50,
    480,
    { letterSpacing: 20, opacity: 0.7 },
  );
  var titleStr =
    activeBlogTitle || "A Night in the Life of Security Operations";
  var tt = addText(
    frame,
    "title",
    titleStr,
    INTER_BOLD,
    48,
    FIXED_WHITE,
    Math.round(w / 2) - 350,
    510,
    { maxWidth: 700, align: "CENTER", lineHeight: 115 },
  );
  // Red divider under title
  addRect(
    frame,
    "hero-divider",
    60,
    3,
    Math.round(w / 2) - 30,
    510 + tt.height + 16,
    solid(C.red),
  );
  y = 720;

  // Intro paragraph (narrow)
  y += 20;
  var introT = addText(
    frame,
    "intro",
    "As the sun sets and the city transitions from day to night, a different kind of workforce takes over. These are the stories of the professionals who keep our world secure while most of us sleep.",
    INTER_REG,
    18,
    C.white,
    contentX,
    y,
    { maxWidth: contentW, lineHeight: 185, opacity: 0.9 },
  );
  y += introT.height + 60;

  // Alternating sections with full-bleed images
  for (var s = 0; s < sectionCount; s++) {
    // Full-bleed image
    y += addImagePlaceholder(
      frame,
      "fullbleed_" + (s + 1),
      w,
      500,
      0,
      y,
      "Full-width story image " + (s + 1),
    );
    y += 40;

    // Text section
    if (s < 3) {
      var titles = [
        "18:00 — The Handover",
        "22:00 — First Patrol",
        "02:00 — The Quiet Hours",
      ];
      var st = addText(
        frame,
        "section_" + (s + 1) + "_title",
        titles[s % titles.length],
        INTER_BOLD,
        28,
        C.white,
        contentX,
        y,
        { maxWidth: contentW, lineHeight: 130 },
      );
      y += st.height + 16;
    }
    var bt = addText(
      frame,
      "section_" + (s + 1) + "_body",
      BLOG_PLACEHOLDER_BODIES[s % BLOG_PLACEHOLDER_BODIES.length],
      INTER_REG,
      17,
      C.white,
      contentX,
      y,
      { maxWidth: contentW, lineHeight: 185, opacity: 0.85 },
    );
    y += bt.height + 30;

    // Pullquote in middle
    if (s === 1) {
      y += addPullquote(
        frame,
        "There is a quiet dignity in protecting people while they sleep. Every patrol, every checkpoint, every alert — it all matters.",
        "Senior Guard, Night Watch Division",
        y,
        contentW,
        contentX,
      );
      y += 30;
    }
  }

  // Gallery
  y += 20;
  addText(
    frame,
    "gallery-label",
    "Gallery",
    INTER_SEMI,
    18,
    C.white,
    contentX,
    y,
  );
  y += 40;
  var galleryColW = Math.round((contentW - 20) / 2);
  for (var gi = 0; gi < 4; gi++) {
    var gx = contentX + (gi % 2) * (galleryColW + 20);
    var gy = y + Math.floor(gi / 2) * 230;
    addImagePlaceholder(
      frame,
      "gallery_" + (gi + 1),
      galleryColW,
      210,
      gx,
      gy,
      "Gallery image " + (gi + 1),
    );
  }
  y += 480;

  // Closing visual
  addImagePlaceholder(
    frame,
    "closing-image",
    w,
    400,
    0,
    y,
    "Closing dramatic image",
  );
  addRect(frame, "closing-overlay", w, 400, 0, y, {
    type: "GRADIENT_LINEAR",
    gradientTransform: [
      [1, 0, 0],
      [0, 1, 0],
    ],
    gradientStops: [
      { position: 0, color: { r: C.bg.r, g: C.bg.g, b: C.bg.b, a: 0.8 } },
      { position: 0.5, color: { r: 0, g: 0, b: 0, a: 0.3 } },
      { position: 1, color: { r: C.bg.r, g: C.bg.g, b: C.bg.b, a: 0.95 } },
    ],
  });
  addText(
    frame,
    "closing-text",
    "Every night. Every site. Every guard. Security never sleeps.",
    INTER_BOLD,
    28,
    FIXED_WHITE,
    Math.round(w / 2) - 250,
    y + 170,
    { maxWidth: 500, align: "CENTER", lineHeight: 140 },
  );
  y += 420;

  y += addBlogFooter(frame, w, y);
  return y;
}

// ── 8. Tutorial ─────────────────────────────────────────────
function buildBlogTutorial(
  frame: FrameNode,
  w: number,
  h: number,
  sectionCount: number,
): number {
  var contentW = 780;
  var contentX = Math.round((w - contentW) / 2);
  var y = 0;

  y += addBlogHeader(
    frame,
    w,
    "",
    "Tutorial",
    activeBlogAuthor || "Commando360 Team",
    "12 min read",
    0,
  );

  // Hero image
  y += addImagePlaceholder(
    frame,
    "hero-image",
    contentW,
    380,
    contentX,
    y,
    "Tutorial cover image — 1920×1080",
  );
  y += 40;

  // Info boxes (2 columns)
  var boxW = Math.round((contentW - 20) / 2);
  var boxH = 160;

  // What You'll Learn box
  addRect(
    frame,
    "learn-box-bg",
    boxW,
    boxH,
    contentX,
    y,
    solid(
      C.bg.r < 0.5
        ? { r: 0.06, g: 0.04, b: 0.1 }
        : { r: 0.95, g: 0.94, b: 0.98 },
    ),
    10,
  );
  addRect(
    frame,
    "learn-box-accent",
    4,
    boxH,
    contentX,
    y,
    solid({ r: 0.55, g: 0.36, b: 0.96 }),
    2,
  );
  addText(
    frame,
    "learn-title",
    "What You'll Learn",
    INTER_SEMI,
    14,
    { r: 0.55, g: 0.36, b: 0.96 },
    contentX + 20,
    y + 16,
  );
  addText(
    frame,
    "learn-items",
    "• Set up real-time GPS guard tracking\n• Configure geofence boundaries for sites\n• Enable automated deviation alerts\n• Generate patrol compliance reports",
    INTER_REG,
    13,
    C.white,
    contentX + 20,
    y + 44,
    { maxWidth: boxW - 40, lineHeight: 170, opacity: 0.8 },
  );

  // Prerequisites box
  var preX = contentX + boxW + 20;
  addRect(
    frame,
    "prereq-box-bg",
    boxW,
    boxH,
    preX,
    y,
    solid(
      C.bg.r < 0.5
        ? { r: 0.1, g: 0.04, b: 0.04 }
        : { r: 0.98, g: 0.95, b: 0.95 },
    ),
    10,
  );
  addRect(frame, "prereq-box-accent", 4, boxH, preX, y, solid(C.red), 2);
  addText(
    frame,
    "prereq-title",
    "Prerequisites",
    INTER_SEMI,
    14,
    C.red,
    preX + 20,
    y + 16,
  );
  addText(
    frame,
    "prereq-items",
    "• Commando360 admin account\n• At least one active site configured\n• Mobile app installed on guard devices\n• GPS permissions enabled",
    INTER_REG,
    13,
    C.white,
    preX + 20,
    y + 44,
    { maxWidth: boxW - 40, lineHeight: 170, opacity: 0.8 },
  );
  y += boxH + 40;

  // Steps
  var stepTitles = [
    "Enable GPS Tracking in Admin Settings",
    "Configure Site Geofence Boundaries",
    "Set Up Guard Tour Checkpoints",
    "Configure Alert Rules and Notifications",
    "Test the System with a Trial Patrol",
    "Deploy and Monitor Compliance",
  ];
  var stepBodies = [
    "Navigate to Admin > Settings > Location Services and enable real-time GPS tracking. Choose your update frequency (recommended: 30 seconds for active patrols, 5 minutes for static posts).",
    "Open the site configuration page and use the map interface to draw geofence boundaries. Set the boundary radius based on site size — typically 50-200 meters for most commercial properties.",
    "Define checkpoint locations within each site. Place them at critical access points, patrol route waypoints, and areas requiring regular verification. Each checkpoint can have a QR code or NFC tag.",
    "Set up deviation alerts for when guards leave their assigned geofence, miss scheduled checkpoints, or deviate from planned patrol routes. Configure notification channels (push, SMS, email).",
    "Run a test patrol with a team member. Verify that GPS tracks display correctly on the live map, checkpoint scans register in real-time, and alerts trigger as configured.",
    "Roll out to all sites with a phased approach. Monitor the compliance dashboard for the first week and fine-tune alert thresholds based on real-world performance data.",
  ];

  for (var s = 0; s < Math.min(sectionCount + 2, stepTitles.length); s++) {
    // Step number circle
    var circleR = figma.createEllipse();
    circleR.name = "step_" + (s + 1) + "_circle";
    circleR.resize(40, 40);
    circleR.x = contentX;
    circleR.y = y;
    circleR.fills = [solid(C.red)];
    frame.appendChild(circleR);
    addText(
      frame,
      "step_" + (s + 1) + "_num",
      String(s + 1),
      INTER_BOLD,
      18,
      FIXED_WHITE,
      contentX + (s + 1 < 10 ? 14 : 9),
      y + 9,
    );
    // Step title
    var st = addText(
      frame,
      "section_" + (s + 1) + "_title",
      stepTitles[s],
      INTER_SEMI,
      20,
      C.white,
      contentX + 56,
      y + 8,
      { maxWidth: contentW - 56 },
    );
    y += Math.max(st.height + 16, 48);
    // Step body
    var bt = addText(
      frame,
      "section_" + (s + 1) + "_body",
      stepBodies[s],
      INTER_REG,
      15,
      C.white,
      contentX + 56,
      y,
      { maxWidth: contentW - 56, lineHeight: 175, opacity: 0.85 },
    );
    y += bt.height + 16;
    // Screenshot for each step
    y += addImagePlaceholder(
      frame,
      "step_" + (s + 1) + "_image",
      contentW - 56,
      220,
      contentX + 56,
      y,
      "Step " + (s + 1) + " screenshot",
    );
    y += 8;

    // Tip callout after step 2
    if (s === 1) {
      y += addCalloutBox(
        frame,
        "Pro Tip",
        "Start with your highest-traffic site first. The data you collect will help you fine-tune settings before rolling out to all locations.",
        { r: 0.23, g: 0.51, b: 0.96 },
        y,
        contentW,
        contentX,
      );
      y += 16;
    }

    // Connector line between steps
    if (
      s < stepTitles.length - 1 &&
      s < Math.min(sectionCount + 2, stepTitles.length) - 1
    ) {
      addRect(
        frame,
        "step-connector-" + s,
        2,
        24,
        contentX + 19,
        y,
        solid(C.red, 0.3),
      );
      y += 28;
    }
  }

  // Summary
  y += 20;
  y += addCalloutBox(
    frame,
    "Summary",
    "You've configured GPS tracking, geofences, checkpoints, and alerts. Your guard tour system is now fully operational. Monitor the compliance dashboard regularly and adjust thresholds as needed.",
    C.red,
    y,
    contentW,
    contentX,
  );

  y += addBlogFooter(frame, w, y);
  return y;
}

// BLOG_STYLES registry populated at declaration site (below, in BLOG TEMPLATE SYSTEM section)

// ══════════════════════════════════════════════════════════════
// SINGLE POST LAYOUTS (5 styles)
// ══════════════════════════════════════════════════════════════

// ── Layout 1: Vertical Split (50/50 — Urban Company / editorial) ──
function buildVerticalSplit(frame: FrameNode, w: number, h: number): void {
  const splitX = Math.round(w * 0.5);
  const rightW = w - splitX;
  const pad = Math.round(rightW * 0.1);

  // Left panel: image drop zone with bold color
  addRect(frame, "image-area", splitX, h, 0, 0, solid(C.card));
  addText(
    frame,
    "image-label",
    "DROP\nIMAGE\nHERE",
    INTER_MED,
    Math.round(w * 0.02),
    C.dim,
    Math.round(splitX * 0.3),
    Math.round(h * 0.4),
    { align: "CENTER" },
  );

  // Vertical red divider
  addRect(frame, "divider", 4, h, splitX, 0, solid(C.red));

  // Right panel: text content with premium bg
  addPremiumBg(frame, w, h, 0);

  // Brand at top of right panel
  addBrand(frame, splitX + pad, Math.round(h * 0.08), Math.round(w * 0.012));

  addText(
    frame,
    "headline",
    "Your Headline\nGoes Here",
    resolveFont(JAKARTA_XBOLD),
    Math.round(w * 0.038),
    C.white,
    splitX + pad,
    Math.round(h * 0.22),
    { maxWidth: rightW - pad * 2, lineHeight: 115, effect: "lifted" },
  );

  addText(
    frame,
    "description",
    "Benefit-focused description text goes here.",
    INTER_REG,
    Math.round(w * 0.017),
    C.gray,
    splitX + pad,
    Math.round(h * 0.55),
    { maxWidth: rightW - pad * 2, lineHeight: 155 },
  );

  addCtaButton(
    frame,
    Math.round(w * 0.017),
    splitX + pad,
    Math.round(h * 0.75),
    Math.round(w * 0.022),
    Math.round(w * 0.012),
    undefined,
    true,
  );

  // Accent dots bottom-right
  addAccentDots(frame, 3, 6, w - pad - 30, h - Math.round(h * 0.06), 10);
}

// ── Layout 2: Typography Hero (Nike manifesto / Spotify style) ──
function buildTypographyHero(frame: FrameNode, w: number, h: number): void {
  const pad = Math.round(w * 0.07);

  addPremiumBg(frame, w, h, 1);

  // Massive headline — fills the frame
  addText(
    frame,
    "headline",
    "Your\nHeadline\nHere",
    resolveFont(BEBAS),
    Math.round(w * 0.1),
    C.white,
    pad,
    Math.round(h * 0.1),
    {
      maxWidth: Math.round(w * 0.86),
      lineHeight: 95,
      effect: "glow",
    },
  );

  // Thin red accent line as divider
  addRect(
    frame,
    "divider",
    Math.round(w * 0.15),
    2,
    pad,
    Math.round(h * 0.65),
    solid(C.red),
  );

  // Small description below divider
  addText(
    frame,
    "description",
    "Benefit-focused description text goes here.",
    INTER_REG,
    Math.round(w * 0.018),
    C.gray,
    pad,
    Math.round(h * 0.7),
    { maxWidth: Math.round(w * 0.55), lineHeight: 155 },
  );

  // CTA at bottom-left
  addCtaButton(
    frame,
    Math.round(w * 0.017),
    pad,
    Math.round(h * 0.85),
    Math.round(w * 0.022),
    Math.round(w * 0.012),
    undefined,
    true,
  );

  // Diagonal line accents
  addDiagonalLine(
    frame,
    4,
    Math.round(w * 0.06),
    w - pad - Math.round(w * 0.12),
    Math.round(h * 0.12),
    8,
  );

  // Brand logo at bottom-right
  addBrand(
    frame,
    w - pad - Math.round(w * 0.15),
    Math.round(h * 0.88),
    Math.round(w * 0.011),
    true,
  );
}

// ── Layout 3: Circle Crop (fashion / personal brand style) ──
function buildCircleCrop(frame: FrameNode, w: number, h: number): void {
  const pad = Math.round(w * 0.06);
  const cx = Math.round(w / 2);
  const circleD = Math.round(Math.min(w, h) * 0.5);
  const circleR = Math.round(circleD / 2);
  const circleX = cx - circleR;
  const circleY = Math.round(h * 0.22);

  addPremiumBg(frame, w, h, 2);

  // Brand top-left
  addBrand(frame, pad, Math.round(h * 0.06), Math.round(w * 0.012));

  // Headline top-right area
  addText(
    frame,
    "headline",
    "Your Headline",
    resolveFont(BEBAS),
    Math.round(w * 0.035),
    C.white,
    Math.round(w * 0.5),
    Math.round(h * 0.06),
    { maxWidth: Math.round(w * 0.42), lineHeight: 110, align: "RIGHT" },
  );

  // Red accent ring behind circle
  addRect(
    frame,
    "circle-ring",
    circleD + 6,
    circleD + 6,
    circleX - 3,
    circleY - 3,
    solid(C.red, 0.5),
    circleR + 3,
  );

  // Circle image area
  addRect(
    frame,
    "image-area",
    circleD,
    circleD,
    circleX,
    circleY,
    solid(C.card),
    circleR,
  );
  addText(
    frame,
    "image-label",
    "DROP\nIMAGE",
    INTER_MED,
    Math.round(w * 0.018),
    C.dim,
    cx - Math.round(w * 0.04),
    circleY + circleR - Math.round(w * 0.03),
    { align: "CENTER" },
  );

  // Description below circle
  const descY = circleY + circleD + Math.round(h * 0.04);
  addText(
    frame,
    "description",
    "Benefit-focused description text goes here.",
    INTER_REG,
    Math.round(w * 0.018),
    C.gray,
    pad,
    descY,
    { maxWidth: Math.round(w * 0.6), lineHeight: 150 },
  );

  // CTA at bottom-right
  addCtaButton(
    frame,
    Math.round(w * 0.017),
    w - pad - Math.round(w * 0.22),
    descY,
    Math.round(w * 0.022),
    Math.round(w * 0.012),
  );
}

// ── Layout 4: Horizontal Split (Apple product launch style) ──
function buildHorizontalSplit(frame: FrameNode, w: number, h: number): void {
  const splitY = Math.round(h * 0.6);
  const bottomH = h - splitY;
  const pad = Math.round(w * 0.06);

  // Top panel: image drop zone
  addRect(frame, "image-area", w, splitY, 0, 0, solid(C.card));
  addText(
    frame,
    "image-label",
    "DROP IMAGE HERE",
    INTER_MED,
    Math.round(w * 0.018),
    C.dim,
    Math.round(w * 0.35),
    Math.round(splitY * 0.45),
    { align: "CENTER" },
  );

  // Red accent line at split
  addRect(frame, "accent", w, 3, 0, splitY, solid(C.red));

  // Bottom panel: text content
  addPremiumBg(frame, w, h, 3);

  const textY = splitY + Math.round(bottomH * 0.12);
  // Accent dots above headline
  addAccentDots(frame, 3, 5, pad, textY - 14, 9);

  addText(
    frame,
    "headline",
    "Your Headline Here",
    resolveFont(JAKARTA_XBOLD),
    Math.round(w * 0.038),
    C.white,
    pad,
    textY,
    { maxWidth: Math.round(w * 0.75), lineHeight: 115, effect: "lifted" },
  );

  addText(
    frame,
    "description",
    "Benefit-focused description text.",
    INTER_REG,
    Math.round(w * 0.017),
    C.gray,
    pad,
    textY + Math.round(bottomH * 0.38),
    { maxWidth: Math.round(w * 0.55), lineHeight: 150 },
  );

  // CTA at bottom-left
  addCtaButton(
    frame,
    Math.round(w * 0.017),
    pad,
    h - Math.round(bottomH * 0.2),
    Math.round(w * 0.022),
    Math.round(w * 0.012),
    undefined,
    true,
  );

  // Brand at bottom-right
  addBrand(
    frame,
    w - pad - Math.round(w * 0.13),
    h - Math.round(bottomH * 0.25),
    Math.round(w * 0.011),
    true,
  );
}

// ── Layout 5: Frame-in-Frame (Premium gallery / luxury style) ──
function buildFrameInFrame(frame: FrameNode, w: number, h: number): void {
  const inset = Math.round(w * 0.06);
  const innerW = w - inset * 2;
  const innerH = h - inset * 2;
  const pad = Math.round(innerW * 0.05);

  addPremiumBg(frame, w, h, 4);

  // Outer border frame (red accent)
  addRect(frame, "border-top", w, 2, 0, 0, solid(C.red, 0.6));
  addRect(frame, "border-bottom", w, 2, 0, h - 2, solid(C.red, 0.6));
  addRect(frame, "border-left", 2, h, 0, 0, solid(C.red, 0.6));
  addRect(frame, "border-right", 2, h, w - 2, 0, solid(C.red, 0.6));

  // Inner image area (top 58% of inner space)
  const imgH = Math.round(innerH * 0.58);
  addRect(frame, "image-area", innerW, imgH, inset, inset, solid(C.card), 8);
  addText(
    frame,
    "image-label",
    "DROP IMAGE HERE",
    INTER_MED,
    Math.round(w * 0.016),
    C.dim,
    inset + Math.round(innerW * 0.32),
    inset + Math.round(imgH * 0.45),
    { align: "CENTER" },
  );

  // Text area below image
  const textY = inset + imgH + Math.round(innerH * 0.06);
  addText(
    frame,
    "headline",
    "Your Headline Here",
    resolveFont(JAKARTA_XBOLD),
    Math.round(w * 0.035),
    C.white,
    inset + pad,
    textY,
    { maxWidth: innerW - pad * 2, lineHeight: 115, effect: "outline" },
  );

  addText(
    frame,
    "description",
    "Benefit-focused description text goes here.",
    INTER_REG,
    Math.round(w * 0.016),
    C.gray,
    inset + pad,
    textY + Math.round(innerH * 0.18),
    { maxWidth: Math.round(innerW * 0.6), lineHeight: 150 },
  );

  // CTA at bottom-right of inner frame
  addCtaButton(
    frame,
    Math.round(w * 0.016),
    inset + innerW - pad - Math.round(w * 0.18),
    textY + Math.round(innerH * 0.18),
    Math.round(w * 0.02),
    Math.round(w * 0.01),
  );

  // Brand logo at bottom-left of inner frame
  addBrand(
    frame,
    inset + pad,
    h - inset - Math.round(innerH * 0.06),
    Math.round(w * 0.011),
    true,
  );
}

// ══════════════════════════════════════════════════════════════
// CAROUSEL LAYOUTS (3 slide types at 1080×1080)
// ══════════════════════════════════════════════════════════════

function buildCarouselCover(frame: FrameNode, w: number, h: number): void {
  const cx = Math.round(w / 2);

  addPremiumBg(frame, w, h, 3);
  addRect(frame, "accent", w, 6, 0, 0, solid(C.red));

  const brand = addBrand(frame, 0, Math.round(h * 0.06), Math.round(w * 0.018));
  brand.x = Math.round(cx - brand.width / 2);

  addText(
    frame,
    "headline",
    "5 Signs You Need\nDigital Security",
    resolveFont(BEBAS),
    Math.round(w * 0.065),
    C.white,
    Math.round(w * 0.08),
    Math.round(h * 0.28),
    {
      maxWidth: Math.round(w * 0.84),
      lineHeight: 115,
      align: "CENTER",
      effect: "gradientFill",
    },
  );

  addText(
    frame,
    "description",
    "Swipe to learn more",
    INTER_REG,
    Math.round(w * 0.025),
    C.gray,
    Math.round(w * 0.08),
    Math.round(h * 0.6),
    {
      maxWidth: Math.round(w * 0.84),
      align: "CENTER",
    },
  );

  // Swipe indicator
  addText(
    frame,
    "swipe",
    "SWIPE \u2192",
    INTER_SEMI,
    Math.round(w * 0.018),
    C.dim,
    0,
    Math.round(h * 0.82),
    {
      letterSpacing: 20,
    },
  ).x = Math.round(cx - 40);

  // Slide dots
  for (let i = 0; i < 5; i++) {
    addEllipse(
      frame,
      `dot-${i}`,
      8,
      8,
      Math.round(cx - 32 + i * 16),
      Math.round(h * 0.92),
      solid(i === 0 ? C.red : C.dim),
    );
  }
}

function buildCarouselSlide(frame: FrameNode, w: number, h: number): void {
  const pad = Math.round(w * 0.08);

  addPremiumBg(frame, w, h, 4);

  // Slide number
  addText(
    frame,
    "slide_number",
    "02",
    INTER_BOLD,
    Math.round(w * 0.1),
    C.red,
    pad,
    Math.round(h * 0.06),
    {
      opacity: 0.3,
    },
  );

  addText(
    frame,
    "headline",
    "Paper Logbooks",
    resolveFont(JAKARTA_XBOLD),
    Math.round(w * 0.055),
    C.white,
    pad,
    Math.round(h * 0.2),
    {
      maxWidth: Math.round(w * 0.84),
      lineHeight: 115,
      effect: "lifted",
    },
  );

  addText(
    frame,
    "description",
    "Still tracking incidents on paper? You're losing 4 hours per site per week.",
    INTER_REG,
    Math.round(w * 0.025),
    C.gray,
    pad,
    Math.round(h * 0.38),
    { maxWidth: Math.round(w * 0.84), lineHeight: 155 },
  );

  // Image area (bottom half)
  addRect(
    frame,
    "image-area",
    Math.round(w * 0.84),
    Math.round(h * 0.35),
    pad,
    Math.round(h * 0.56),
    solid(C.card),
    12,
  );
  addText(
    frame,
    "image-label",
    "DROP IMAGE HERE",
    INTER_MED,
    Math.round(w * 0.016),
    C.dim,
    0,
    Math.round(h * 0.72),
    {
      align: "CENTER",
    },
  ).x = Math.round(w / 2 - 55);

  // Progress dots
  const cx = Math.round(w / 2);
  for (let i = 0; i < 5; i++) {
    addEllipse(
      frame,
      `dot-${i}`,
      8,
      8,
      Math.round(cx - 32 + i * 16),
      Math.round(h * 0.95),
      solid(i === 1 ? C.red : C.dim),
    );
  }
}

function buildCarouselCTA(frame: FrameNode, w: number, h: number): void {
  const cx = Math.round(w / 2);

  addPremiumBg(frame, w, h, 4);
  addRect(frame, "accent", w, 6, 0, 0, solid(C.red));

  const brand = addBrand(frame, 0, Math.round(h * 0.08), Math.round(w * 0.022));
  brand.x = Math.round(cx - brand.width / 2);

  addText(
    frame,
    "headline",
    "Ready to\nUpgrade?",
    resolveFont(BEBAS),
    Math.round(w * 0.07),
    C.white,
    Math.round(w * 0.08),
    Math.round(h * 0.28),
    {
      maxWidth: Math.round(w * 0.84),
      lineHeight: 110,
      align: "CENTER",
      effect: "glow",
    },
  );

  addText(
    frame,
    "description",
    "Join 500+ security firms on Commando360",
    INTER_REG,
    Math.round(w * 0.025),
    C.gray,
    Math.round(w * 0.08),
    Math.round(h * 0.55),
    {
      maxWidth: Math.round(w * 0.84),
      align: "CENTER",
    },
  );

  const btn = addCtaButton(
    frame,
    Math.round(w * 0.03),
    0,
    Math.round(h * 0.7),
    Math.round(w * 0.05),
    Math.round(w * 0.022),
    undefined,
    true,
  );
  btn.x = Math.round(cx - btn.width / 2);

  // Slide dots
  for (let i = 0; i < 5; i++) {
    addEllipse(
      frame,
      `dot-${i}`,
      8,
      8,
      Math.round(cx - 32 + i * 16),
      Math.round(h * 0.92),
      solid(i === 4 ? C.red : C.dim),
    );
  }
}

// ══════════════════════════════════════════════════════════════
// IMAGE POST LAYOUTS (3 styles)
// ══════════════════════════════════════════════════════════════

function buildImageBottom(frame: FrameNode, w: number, h: number): void {
  const splitY = Math.round(h * 0.6);
  const pad = Math.round(w * 0.05);

  addPremiumBg(frame, w, h, 0);

  // Image area (top 60%)
  addRect(frame, "image-area", w, splitY, 0, 0, solid(C.card));
  addText(
    frame,
    "image-label",
    "DROP IMAGE HERE",
    INTER_MED,
    Math.round(w * 0.016),
    C.dim,
    0,
    Math.round(splitY / 2 - 8),
    {
      align: "CENTER",
      maxWidth: w,
    },
  );

  // Bottom text bar
  addRect(frame, "text-bg", w, h - splitY, 0, splitY, solid(C.bg));
  addRect(frame, "bottom-accent", w, 3, 0, splitY, solid(C.red));

  addText(
    frame,
    "headline",
    "Your Headline Here",
    resolveFont(JAKARTA_XBOLD),
    Math.round(w * 0.032),
    C.white,
    pad,
    splitY + Math.round((h - splitY) * 0.15),
    {
      maxWidth: Math.round(w * 0.7),
      lineHeight: 120,
      effect: "lifted",
    },
  );
  addText(
    frame,
    "description",
    "Benefit-focused description.",
    INTER_REG,
    Math.round(w * 0.018),
    C.gray,
    pad,
    splitY + Math.round((h - splitY) * 0.55),
    {
      maxWidth: Math.round(w * 0.65),
    },
  );
  addBrand(frame, w - pad - 90, h - pad - 12, Math.round(w * 0.011), true);
}

function buildImageTop(frame: FrameNode, w: number, h: number): void {
  const barH = Math.round(h * 0.28);
  const pad = Math.round(w * 0.05);

  addPremiumBg(frame, w, h, 1);

  // Top dark bar
  addRect(frame, "top-bar", w, barH, 0, 0, solid(C.bg));
  addRect(frame, "top-accent", w, 3, 0, barH - 3, solid(C.red));

  addBrand(frame, pad, Math.round(barH * 0.15), Math.round(w * 0.012));
  addText(
    frame,
    "headline",
    "Your Headline Here",
    resolveFont(BEBAS),
    Math.round(w * 0.035),
    C.white,
    pad,
    Math.round(barH * 0.4),
    {
      maxWidth: Math.round(w * 0.85),
      lineHeight: 120,
    },
  );

  // Image area (bottom 72%)
  addRect(frame, "image-area", w, h - barH, 0, barH, solid(C.card));
  addText(
    frame,
    "image-label",
    "DROP IMAGE HERE",
    INTER_MED,
    Math.round(w * 0.016),
    C.dim,
    0,
    Math.round(barH + (h - barH) / 2 - 8),
    {
      align: "CENTER",
      maxWidth: w,
    },
  );

  // CTA overlay bottom-right
  addCtaButton(
    frame,
    Math.round(w * 0.018),
    w - pad - 140,
    h - pad - 36,
    Math.round(w * 0.02),
    Math.round(w * 0.01),
    undefined,
    true,
  );
}

function buildImageFull(frame: FrameNode, w: number, h: number): void {
  const pad = Math.round(w * 0.05);

  addPremiumBg(frame, w, h, 2);

  // Full image area
  addRect(frame, "image-area", w, h, 0, 0, solid(C.card));
  addText(
    frame,
    "image-label",
    "DROP IMAGE HERE",
    INTER_MED,
    Math.round(w * 0.02),
    C.dim,
    0,
    Math.round(h * 0.45),
    {
      align: "CENTER",
      maxWidth: w,
    },
  );

  // Dark scrim overlay at bottom
  addRect(
    frame,
    "scrim",
    w,
    Math.round(h * 0.35),
    0,
    Math.round(h * 0.65),
    solid(C.bg, 0.8),
  );

  addText(
    frame,
    "headline",
    "Your Headline Here",
    resolveFont(BEBAS),
    Math.round(w * 0.035),
    C.white,
    pad,
    Math.round(h * 0.72),
    {
      maxWidth: Math.round(w * 0.75),
      lineHeight: 120,
      effect: "lifted",
    },
  );

  const btn = addCtaButton(
    frame,
    Math.round(w * 0.018),
    w - pad - 130,
    Math.round(h * 0.88),
    Math.round(w * 0.02),
    Math.round(w * 0.01),
    undefined,
    true,
  );
  // adjust if off screen
  if (btn.x + btn.width > w) btn.x = w - pad - btn.width;

  addBrand(frame, pad, Math.round(h * 0.04), Math.round(w * 0.012));
}

// ══════════════════════════════════════════════════════════════
// STATS LAYOUTS (3 styles)
// ══════════════════════════════════════════════════════════════

function buildBigStat(frame: FrameNode, w: number, h: number): void {
  const cx = Math.round(w / 2);

  addPremiumBg(frame, w, h, 0);

  addBrand(
    frame,
    Math.round(w * 0.05),
    Math.round(h * 0.06),
    Math.round(w * 0.013),
  );

  // Context headline
  addText(
    frame,
    "headline",
    "Reduction in incidents",
    INTER_MED,
    Math.round(w * 0.02),
    C.gray,
    0,
    Math.round(h * 0.18),
    {
      maxWidth: Math.round(w * 0.8),
      align: "CENTER",
    },
  ).x = Math.round(cx - w * 0.4);

  // Massive stat
  const stat = addText(
    frame,
    "stat",
    "73%",
    resolveFont(BEBAS),
    Math.round(w * 0.16),
    C.white,
    0,
    Math.round(h * 0.28),
    { effect: "glow" },
  );
  stat.x = Math.round(cx - stat.width / 2);

  // Stat label
  const label = addText(
    frame,
    "stat_label",
    "fewer incidents",
    INTER_SEMI,
    Math.round(w * 0.025),
    C.red,
    0,
    Math.round(h * 0.62),
  );
  label.x = Math.round(cx - label.width / 2);

  addText(
    frame,
    "description",
    "AI-powered command centers catch threats before they escalate.",
    INTER_REG,
    Math.round(w * 0.018),
    C.gray,
    0,
    Math.round(h * 0.74),
    {
      maxWidth: Math.round(w * 0.65),
      align: "CENTER",
    },
  ).x = Math.round(cx - w * 0.325);

  addCtaButton(
    frame,
    Math.round(w * 0.018),
    0,
    Math.round(h * 0.86),
    Math.round(w * 0.025),
    Math.round(w * 0.012),
    undefined,
    true,
  ).x = Math.round(cx - 70);

  // Red accent lines
  const lineW = Math.round(w * 0.08);
  addRect(
    frame,
    "line-l",
    lineW,
    2,
    Math.round(cx - w * 0.25),
    Math.round(h * 0.68),
    solid(C.red, 0.3),
  );
  addRect(
    frame,
    "line-r",
    lineW,
    2,
    Math.round(cx + w * 0.17),
    Math.round(h * 0.68),
    solid(C.red, 0.3),
  );
}

function buildBeforeAfter(frame: FrameNode, w: number, h: number): void {
  const cx = Math.round(w / 2);
  const pad = Math.round(w * 0.05);
  const colW = Math.round(w * 0.42);

  addPremiumBg(frame, w, h, 1);

  addBrand(frame, pad, Math.round(h * 0.06), Math.round(w * 0.013));

  // Main headline
  addText(
    frame,
    "headline",
    "Before vs After Commando360.ai",
    resolveFont(JAKARTA_XBOLD),
    Math.round(w * 0.03),
    C.white,
    0,
    Math.round(h * 0.15),
    {
      maxWidth: Math.round(w * 0.9),
      align: "CENTER",
    },
  ).x = Math.round(cx - w * 0.45);

  // Red center divider
  addRect(
    frame,
    "divider",
    2,
    Math.round(h * 0.55),
    cx - 1,
    Math.round(h * 0.28),
    solid(C.red, 0.5),
  );

  // Left column — Before
  addText(
    frame,
    "left_headline",
    "BEFORE",
    INTER_BOLD,
    Math.round(w * 0.016),
    C.dim,
    pad,
    Math.round(h * 0.28),
    {
      letterSpacing: 15,
    },
  );
  addText(
    frame,
    "left_description",
    "Paper logbooks, missed patrols, buddy punching, no real-time visibility",
    INTER_REG,
    Math.round(w * 0.018),
    C.gray,
    pad,
    Math.round(h * 0.36),
    {
      maxWidth: colW,
      lineHeight: 160,
    },
  );

  // Right column — After
  const rightX = cx + pad;
  addText(
    frame,
    "right_headline",
    "WITH Commando360.ai",
    INTER_BOLD,
    Math.round(w * 0.016),
    C.red,
    rightX,
    Math.round(h * 0.28),
    {
      letterSpacing: 15,
    },
  );
  addText(
    frame,
    "right_description",
    "GPS tracking, face ID attendance, real-time command center, auto compliance",
    INTER_REG,
    Math.round(w * 0.018),
    C.white,
    rightX,
    Math.round(h * 0.36),
    {
      maxWidth: colW,
      lineHeight: 160,
    },
  );

  addCtaButton(
    frame,
    Math.round(w * 0.018),
    0,
    Math.round(h * 0.84),
    Math.round(w * 0.025),
    Math.round(w * 0.012),
    undefined,
    true,
  ).x = Math.round(cx - 70);
}

function buildStatRow(frame: FrameNode, w: number, h: number): void {
  const cx = Math.round(w / 2);
  const pad = Math.round(w * 0.06);
  const colW = Math.round(w * 0.25);
  const gap = Math.round((w - pad * 2 - colW * 3) / 2);

  addPremiumBg(frame, w, h, 2);

  addRect(frame, "accent", w, 4, 0, 0, solid(C.red));
  addBrand(frame, pad, Math.round(h * 0.07), Math.round(w * 0.013));

  addText(
    frame,
    "headline",
    "Commando360 by the Numbers",
    resolveFont(JAKARTA_XBOLD),
    Math.round(w * 0.03),
    C.white,
    0,
    Math.round(h * 0.18),
    {
      maxWidth: Math.round(w * 0.9),
      align: "CENTER",
      effect: "gradientFill",
    },
  ).x = Math.round(cx - w * 0.45);

  // Three stat columns
  const stats = [
    {
      name: "stat_1",
      value: "500+",
      label: "stat_1_label",
      labelText: "Security Firms",
    },
    {
      name: "stat_2",
      value: "73%",
      label: "stat_2_label",
      labelText: "Fewer Incidents",
    },
    {
      name: "stat_3",
      value: "4hrs",
      label: "stat_3_label",
      labelText: "Saved Per Site",
    },
  ];

  const startY = Math.round(h * 0.35);
  for (let i = 0; i < 3; i++) {
    const colX = pad + i * (colW + gap);
    const colCx = colX + Math.round(colW / 2);

    const sv = addText(
      frame,
      stats[i].name,
      stats[i].value,
      INTER_BOLD,
      Math.round(w * 0.055),
      C.white,
      0,
      startY,
      {
        align: "CENTER",
      },
    );
    sv.x = Math.round(colCx - sv.width / 2);

    const sl = addText(
      frame,
      stats[i].label,
      stats[i].labelText,
      INTER_REG,
      Math.round(w * 0.015),
      C.gray,
      0,
      startY + Math.round(h * 0.15),
      {
        align: "CENTER",
      },
    );
    sl.x = Math.round(colCx - sl.width / 2);

    // Accent dot above
    addEllipse(
      frame,
      `stat-dot-${i}`,
      6,
      6,
      colCx - 3,
      startY - 16,
      solid(C.red),
    );
  }

  addText(
    frame,
    "description",
    "The platform trusted by India's leading security companies",
    INTER_REG,
    Math.round(w * 0.017),
    C.gray,
    0,
    Math.round(h * 0.72),
    {
      maxWidth: Math.round(w * 0.7),
      align: "CENTER",
    },
  ).x = Math.round(cx - w * 0.35);

  addCtaButton(
    frame,
    Math.round(w * 0.018),
    0,
    Math.round(h * 0.84),
    Math.round(w * 0.025),
    Math.round(w * 0.012),
    undefined,
    true,
  ).x = Math.round(cx - 70);
}

// ══════════════════════════════════════════════════════════════
// VIDEO THUMBNAIL
// ══════════════════════════════════════════════════════════════

function buildVideoThumb(frame: FrameNode, w: number, h: number): void {
  const cx = Math.round(w / 2);
  const cy = Math.round(h / 2);
  const pad = Math.round(w * 0.05);

  addPremiumBg(frame, w, h, 3);

  // Full image area
  addRect(frame, "image-area", w, h, 0, 0, solid(C.card));

  // Dark overlay
  addRect(frame, "overlay", w, h, 0, 0, solid(C.bg, 0.5));

  // Play button circle
  const playSize = Math.round(Math.min(w, h) * 0.15);
  addEllipse(
    frame,
    "play-circle",
    playSize,
    playSize,
    Math.round(cx - playSize / 2),
    Math.round(cy - playSize / 2),
    solid(C.white, 0.9),
  );
  // Play triangle (using text character)
  const play = addText(
    frame,
    "play-icon",
    "\u25B6",
    INTER_REG,
    Math.round(playSize * 0.4),
    C.bg,
    0,
    0,
  );
  play.x = Math.round(cx - play.width / 2 + 2);
  play.y = Math.round(cy - play.height / 2);

  // Duration badge (top right)
  const dur = addText(
    frame,
    "duration",
    "2:30",
    INTER_SEMI,
    Math.round(w * 0.016),
    C.white,
    0,
    pad,
  );
  const durBg = addRect(
    frame,
    "dur-bg",
    dur.width + 16,
    dur.height + 8,
    w - pad - dur.width - 16,
    pad - 4,
    solid(C.bg, 0.7),
    4,
  );
  // bring text above bg — move dur after bg in the tree
  dur.x = durBg.x + 8;
  dur.y = durBg.y + 4;

  // Bottom text
  addRect(
    frame,
    "bottom-scrim",
    w,
    Math.round(h * 0.25),
    0,
    Math.round(h * 0.75),
    solid(C.bg, 0.75),
  );
  addText(
    frame,
    "headline",
    "Your Video Title Here",
    resolveFont(JAKARTA_XBOLD),
    Math.round(w * 0.03),
    C.white,
    pad,
    Math.round(h * 0.8),
    {
      maxWidth: Math.round(w * 0.8),
      effect: "lifted",
    },
  );

  addBrand(frame, pad, Math.round(h * 0.93), Math.round(w * 0.011), true);
}

// ══════════════════════════════════════════════════════════════
// QUOTE CARD
// ══════════════════════════════════════════════════════════════

function buildQuoteCard(frame: FrameNode, w: number, h: number): void {
  const cx = Math.round(w / 2);
  const pad = Math.round(w * 0.08);

  addPremiumBg(frame, w, h, 3);

  addRect(frame, "accent", w, 4, 0, 0, solid(C.red));

  // Big decorative quote mark
  addText(
    frame,
    "quote-mark",
    "\u201C",
    INTER_BOLD,
    Math.round(w * 0.18),
    C.red,
    pad,
    Math.round(h * 0.04),
    {
      opacity: 0.2,
    },
  );

  addBrand(frame, w - pad - 100, Math.round(h * 0.06), Math.round(w * 0.012));

  // Quote text
  addText(
    frame,
    "quote",
    "Commando360 transformed how we manage our 50-site security operation. What took hours now takes minutes.",
    resolveFont(BEBAS),
    Math.round(w * 0.025),
    C.white,
    pad,
    Math.round(h * 0.28),
    { maxWidth: Math.round(w * 0.84), lineHeight: 170, align: "CENTER" },
  );

  // Red divider
  const divW = Math.round(w * 0.08);
  addRect(
    frame,
    "divider",
    divW,
    2,
    Math.round(cx - divW / 2),
    Math.round(h * 0.62),
    solid(C.red),
  );

  // Author
  addText(
    frame,
    "author",
    "Rajesh Kumar, CEO\nSecureForce India",
    INTER_SEMI,
    Math.round(w * 0.018),
    C.gray,
    0,
    Math.round(h * 0.68),
    {
      maxWidth: Math.round(w * 0.7),
      align: "CENTER",
      lineHeight: 160,
    },
  ).x = Math.round(cx - w * 0.35);

  // Optional headline/context
  addText(
    frame,
    "headline",
    "Client Testimonial",
    INTER_REG,
    Math.round(w * 0.014),
    C.dim,
    0,
    Math.round(h * 0.87),
    {
      align: "CENTER",
      letterSpacing: 15,
    },
  ).x = Math.round(cx - 55);
}

// ══════════════════════════════════════════════════════════════
// SPECIAL SIZE LAYOUTS (story, compact, leaderboard)
// ══════════════════════════════════════════════════════════════

function buildStory(frame: FrameNode, w: number, h: number): void {
  const pad = Math.round(w * 0.08);

  addPremiumBg(frame, w, h, 5);
  addRect(frame, "accent", w, 4, 0, 0, solid(C.red));

  const brand = addBrand(frame, 0, Math.round(h * 0.06), Math.round(w * 0.018));
  brand.x = Math.round((w - brand.width) / 2);

  addText(
    frame,
    "headline",
    "Your Headline\nGoes Here",
    resolveFont(BEBAS),
    Math.round(w * 0.065),
    C.white,
    pad,
    Math.round(h * 0.3),
    {
      maxWidth: w - pad * 2,
      lineHeight: 115,
      align: "CENTER",
      effect: "gradientFill",
    },
  );

  addText(
    frame,
    "description",
    "Your description text goes here.\nKeep it benefit-focused.",
    INTER_REG,
    Math.round(w * 0.028),
    C.gray,
    pad,
    Math.round(h * 0.48),
    {
      maxWidth: w - pad * 2,
      lineHeight: 155,
      align: "CENTER",
    },
  );

  const btn = addCtaButton(
    frame,
    Math.round(w * 0.028),
    0,
    Math.round(h * 0.65),
    Math.round(w * 0.05),
    Math.round(w * 0.02),
    undefined,
    true,
  );
  btn.x = Math.round((w - btn.width) / 2);

  for (let i = 0; i < 3; i++) {
    addEllipse(
      frame,
      `dot-${i}`,
      6,
      6,
      Math.round(w / 2 - 20 + i * 14),
      Math.round(h * 0.88),
      solid(i === 0 ? C.red : C.dim),
    );
  }
}

function buildCompact(frame: FrameNode, w: number, h: number): void {
  const left = Math.round(w * 0.08) + 8;

  addPremiumBg(frame, w, h, 4);

  addRect(frame, "accent", 4, h, 0, 0, solid(C.red));
  addBrand(frame, left, Math.round(h * 0.08), Math.round(w * 0.035), true);
  addText(
    frame,
    "headline",
    "Your Headline",
    resolveFont(JAKARTA_XBOLD),
    Math.round(w * 0.065),
    C.white,
    left,
    Math.round(h * 0.25),
    {
      maxWidth: w - left - 16,
      lineHeight: 120,
      effect: "lifted",
    },
  );
  addText(
    frame,
    "description",
    "Benefit-focused copy.",
    INTER_REG,
    Math.round(w * 0.04),
    C.gray,
    left,
    Math.round(h * 0.55),
    {
      maxWidth: w - left - 16,
      lineHeight: 145,
    },
  );
  addCtaButton(
    frame,
    Math.round(w * 0.038),
    left,
    Math.round(h * 0.78),
    Math.round(w * 0.04),
    Math.round(w * 0.025),
    undefined,
    true,
  );
}

function buildLeaderboard(frame: FrameNode, w: number, h: number): void {
  addPremiumBg(frame, w, h, 5);

  addRect(frame, "accent", 4, h, 0, 0, solid(C.red));
  addBrand(frame, 24, Math.round((h - 14) / 2), 14, true);
  addText(
    frame,
    "headline",
    "Your Headline Here",
    INTER_BOLD,
    18,
    C.white,
    100,
    Math.round((h - 22) / 2),
  );
  const btn = addCtaButton(frame, 13, 0, 0, 14, 8, "Learn More");
  btn.x = w - btn.width - 16;
  btn.y = Math.round((h - btn.height) / 2);
}

// ══════════════════════════════════════════════════════════════
// FULL-PAGE IMAGE LAYOUTS (editorial / magazine style)
// ══════════════════════════════════════════════════════════════

// Full-bleed image with a minimal text overlay strip at the bottom
function buildEditorialOverlay(frame: FrameNode, w: number, h: number): void {
  var pad = Math.round(w * 0.06);

  // Full-bleed image area
  addRect(frame, "image-area", w, h, 0, 0, solid(C.card));
  addText(
    frame,
    "image-label",
    "DROP IMAGE HERE",
    INTER_MED,
    Math.round(w * 0.018),
    C.dim,
    0,
    Math.round(h * 0.45),
    { align: "CENTER", maxWidth: w },
  );

  // Bottom gradient scrim — taller for breathing room
  var scrimH = Math.round(h * 0.32);
  var scrim = figma.createRectangle();
  scrim.name = "scrim";
  scrim.resize(w, scrimH);
  scrim.x = 0;
  scrim.y = h - scrimH;
  scrim.fills = [
    {
      type: "GRADIENT_LINEAR",
      gradientTransform: [
        [1, 0, 0],
        [0, 1, 0],
      ],
      gradientStops: [
        { position: 0, color: { r: 0, g: 0, b: 0, a: 0 } },
        { position: 0.4, color: { r: 0, g: 0, b: 0, a: 0.55 } },
        { position: 1, color: { r: 0, g: 0, b: 0, a: 0.85 } },
      ],
    } as GradientPaint,
  ];
  frame.appendChild(scrim);

  // Thin red accent line above text
  addRect(
    frame,
    "accent-line",
    Math.round(w * 0.08),
    3,
    pad,
    Math.round(h * 0.76),
    solid(C.red),
  );

  addText(
    frame,
    "headline",
    "Your Headline Here",
    resolveFont(JAKARTA_XBOLD),
    Math.round(w * 0.04),
    FIXED_WHITE,
    pad,
    Math.round(h * 0.79),
    { maxWidth: Math.round(w * 0.7), lineHeight: 115, effect: "lifted" },
  );

  addText(
    frame,
    "description",
    "Supporting caption or tagline goes here",
    INTER_REG,
    Math.round(w * 0.016),
    { r: 0.85, g: 0.85, b: 0.85 },
    pad,
    Math.round(h * 0.91),
    { maxWidth: Math.round(w * 0.65), lineHeight: 150 },
  );

  addBrand(
    frame,
    w - pad - Math.round(w * 0.04),
    Math.round(h * 0.04),
    Math.round(w * 0.012),
  );
}

// Magazine cover: full image with top headline + subtitle
function buildMagazineCover(frame: FrameNode, w: number, h: number): void {
  var pad = Math.round(w * 0.06);

  // Full-bleed image
  addRect(frame, "image-area", w, h, 0, 0, solid(C.card));
  addText(
    frame,
    "image-label",
    "DROP IMAGE HERE",
    INTER_MED,
    Math.round(w * 0.018),
    C.dim,
    0,
    Math.round(h * 0.45),
    { align: "CENTER", maxWidth: w },
  );

  // Top gradient scrim
  var scrimH = Math.round(h * 0.35);
  var scrim = figma.createRectangle();
  scrim.name = "scrim-top";
  scrim.resize(w, scrimH);
  scrim.x = 0;
  scrim.y = 0;
  scrim.fills = [
    {
      type: "GRADIENT_LINEAR",
      gradientTransform: [
        [1, 0, 0],
        [0, -1, 1],
      ],
      gradientStops: [
        { position: 0, color: { r: 0, g: 0, b: 0, a: 0 } },
        { position: 0.5, color: { r: 0, g: 0, b: 0, a: 0.5 } },
        { position: 1, color: { r: 0, g: 0, b: 0, a: 0.8 } },
      ],
    } as GradientPaint,
  ];
  frame.appendChild(scrim);

  addBrand(frame, pad, Math.round(h * 0.04), Math.round(w * 0.012));

  addText(
    frame,
    "headline",
    "Magazine\nStyle Hero",
    resolveFont(BEBAS),
    Math.round(w * 0.055),
    FIXED_WHITE,
    pad,
    Math.round(h * 0.1),
    { maxWidth: Math.round(w * 0.8), lineHeight: 105, effect: "lifted" },
  );

  addText(
    frame,
    "description",
    "Subheadline or date",
    INTER_MED,
    Math.round(w * 0.016),
    { r: 0.9, g: 0.9, b: 0.9 },
    pad,
    Math.round(h * 0.28),
    { maxWidth: Math.round(w * 0.6) },
  );

  // Bottom CTA
  addCtaButton(
    frame,
    Math.round(w * 0.018),
    pad,
    Math.round(h * 0.88),
    Math.round(w * 0.022),
    Math.round(w * 0.012),
    undefined,
    true,
  );
}

// Center-cropped image with generous white/dark border and centered text below
function buildFramedPhoto(frame: FrameNode, w: number, h: number): void {
  var pad = Math.round(w * 0.08);
  var imgW = w - pad * 2;
  var imgH = Math.round(h * 0.6);

  addPremiumBg(frame, w, h, 3);

  addBrand(frame, pad, Math.round(h * 0.03), Math.round(w * 0.012));

  // Framed image area with rounded corners
  var imgRect = addRect(
    frame,
    "image-area",
    imgW,
    imgH,
    pad,
    Math.round(h * 0.1),
    solid(C.card),
    12,
  );

  addText(
    frame,
    "image-label",
    "DROP IMAGE HERE",
    INTER_MED,
    Math.round(w * 0.018),
    C.dim,
    0,
    Math.round(h * 0.1 + imgH * 0.45),
    { align: "CENTER", maxWidth: w },
  );

  // Text area below image
  var textY = Math.round(h * 0.1) + imgH + Math.round(h * 0.04);

  addText(
    frame,
    "headline",
    "Your Headline Here",
    resolveFont(JAKARTA_XBOLD),
    Math.round(w * 0.032),
    C.white,
    0,
    textY,
    { maxWidth: w, align: "CENTER", lineHeight: 120 },
  );

  addText(
    frame,
    "description",
    "A brief description or caption for this image",
    INTER_REG,
    Math.round(w * 0.016),
    C.gray,
    0,
    textY + Math.round(h * 0.07),
    { maxWidth: w, align: "CENTER", lineHeight: 150 },
  );
}

// ══════════════════════════════════════════════════════════════
// BOLD COLOR LAYOUTS (solid brand backgrounds for visual pop)
// ══════════════════════════════════════════════════════════════

// Solid red background with large centered white text — punchy statement post
function buildBoldStatement(frame: FrameNode, w: number, h: number): void {
  var pad = Math.round(w * 0.08);

  // Solid brand red background
  addRect(frame, "bg-color", w, h, 0, 0, solid(C.red));

  // Subtle dark gradient at edges for depth
  var vignette = figma.createRectangle();
  vignette.name = "vignette";
  vignette.resize(w, h);
  vignette.x = 0;
  vignette.y = 0;
  vignette.fills = [
    {
      type: "GRADIENT_RADIAL",
      gradientTransform: [
        [1.2, 0, -0.1],
        [0, 1.2, -0.1],
      ],
      gradientStops: [
        { position: 0, color: { r: 1, g: 1, b: 1, a: 0.06 } },
        { position: 0.7, color: { r: 0, g: 0, b: 0, a: 0 } },
        { position: 1, color: { r: 0, g: 0, b: 0, a: 0.15 } },
      ],
    } as GradientPaint,
  ];
  frame.appendChild(vignette);

  addBrand(frame, pad, Math.round(h * 0.06), Math.round(w * 0.012));

  addText(
    frame,
    "headline",
    "Bold Statement\nGoes Here",
    resolveFont(BEBAS),
    Math.round(w * 0.06),
    FIXED_WHITE,
    0,
    Math.round(h * 0.3),
    { maxWidth: w, align: "CENTER", lineHeight: 105, effect: "lifted" },
  );

  addText(
    frame,
    "description",
    "Supporting line that adds context",
    INTER_MED,
    Math.round(w * 0.018),
    { r: 1, g: 0.85, b: 0.85 },
    0,
    Math.round(h * 0.65),
    { maxWidth: w, align: "CENTER", lineHeight: 150 },
  );

  addCtaButton(
    frame,
    Math.round(w * 0.018),
    0,
    Math.round(h * 0.8),
    Math.round(w * 0.022),
    Math.round(w * 0.012),
    "Learn More",
    true,
  );
  // Center the CTA button horizontally — position after creation
}

// Dark red gradient with a centered circle icon area + text — branded announcement
function buildColorAnnouncement(frame: FrameNode, w: number, h: number): void {
  var pad = Math.round(w * 0.08);

  // Deep red-to-dark gradient
  var bg = figma.createRectangle();
  bg.name = "bg-gradient";
  bg.resize(w, h);
  bg.x = 0;
  bg.y = 0;
  bg.fills = [
    {
      type: "GRADIENT_LINEAR",
      gradientTransform: [
        [0.7, 0.7, 0],
        [-0.7, 0.7, 0.5],
      ],
      gradientStops: [
        { position: 0, color: { r: 0.86, g: 0.14, b: 0.14, a: 1 } },
        { position: 0.5, color: { r: 0.5, g: 0.06, b: 0.06, a: 1 } },
        { position: 1, color: { r: 0.12, g: 0.02, b: 0.02, a: 1 } },
      ],
    } as GradientPaint,
  ];
  frame.appendChild(bg);

  addBrand(frame, pad, Math.round(h * 0.06), Math.round(w * 0.012));

  // Centered icon circle placeholder
  var circleSize = Math.round(Math.min(w, h) * 0.18);
  var cx = Math.round(w / 2) - Math.round(circleSize / 2);
  var cy = Math.round(h * 0.2);
  addEllipse(
    frame,
    "icon-area",
    circleSize,
    circleSize,
    cx,
    cy,
    solid({ r: 1, g: 1, b: 1 }, 0.12),
  );
  addText(
    frame,
    "icon-label",
    "ICON",
    INTER_BOLD,
    Math.round(circleSize * 0.2),
    { r: 1, g: 1, b: 1 },
    0,
    cy + Math.round(circleSize * 0.35),
    { maxWidth: w, align: "CENTER", opacity: 0.5 },
  );

  addText(
    frame,
    "headline",
    "Announcing Something",
    resolveFont(JAKARTA_XBOLD),
    Math.round(w * 0.038),
    FIXED_WHITE,
    0,
    Math.round(h * 0.45),
    { maxWidth: w, align: "CENTER", lineHeight: 120, effect: "lifted" },
  );

  addText(
    frame,
    "description",
    "Details about this announcement or feature update",
    INTER_REG,
    Math.round(w * 0.016),
    { r: 1, g: 0.8, b: 0.8 },
    0,
    Math.round(h * 0.6),
    { maxWidth: Math.round(w * 0.75), align: "CENTER", lineHeight: 155 },
  );

  // Center the description
  addCtaButton(
    frame,
    Math.round(w * 0.018),
    0,
    Math.round(h * 0.78),
    Math.round(w * 0.022),
    Math.round(w * 0.012),
    undefined,
    true,
  );
}

// Solid color with large number/stat — bold data point post
function buildColorStat(frame: FrameNode, w: number, h: number): void {
  var pad = Math.round(w * 0.08);

  // Crimson-to-dark gradient background
  var bg = figma.createRectangle();
  bg.name = "bg-gradient";
  bg.resize(w, h);
  bg.x = 0;
  bg.y = 0;
  bg.fills = [
    {
      type: "GRADIENT_LINEAR",
      gradientTransform: [
        [1, 0, 0],
        [0, 1, 0],
      ],
      gradientStops: [
        { position: 0, color: { r: 0.86, g: 0.14, b: 0.14, a: 1 } },
        { position: 1, color: { r: 0.35, g: 0.04, b: 0.04, a: 1 } },
      ],
    } as GradientPaint,
  ];
  frame.appendChild(bg);

  addBrand(frame, pad, Math.round(h * 0.06), Math.round(w * 0.012));

  // Oversized stat number
  addText(
    frame,
    "stat",
    "97%",
    resolveFont(BEBAS),
    Math.round(w * 0.14),
    FIXED_WHITE,
    0,
    Math.round(h * 0.2),
    { maxWidth: w, align: "CENTER", lineHeight: 100, effect: "lifted" },
  );

  addText(
    frame,
    "headline",
    "of teams report better outcomes",
    resolveFont(JAKARTA_XBOLD),
    Math.round(w * 0.028),
    FIXED_WHITE,
    0,
    Math.round(h * 0.55),
    { maxWidth: Math.round(w * 0.8), align: "CENTER", lineHeight: 130 },
  );

  addText(
    frame,
    "description",
    "Source: Industry Report 2024",
    INTER_REG,
    Math.round(w * 0.014),
    { r: 1, g: 0.8, b: 0.8 },
    0,
    Math.round(h * 0.72),
    { maxWidth: w, align: "CENTER", opacity: 0.7 },
  );

  // Decorative dots at bottom
  var dotSize = Math.round(w * 0.008);
  var dotsX = Math.round(w / 2) - Math.round(dotSize * 4);
  addAccentDots(
    frame,
    4,
    dotSize,
    dotsX,
    Math.round(h * 0.88),
    Math.round(dotSize * 2),
  );
}

// ══════════════════════════════════════════════════════════════
// DEVICE MOCKUP SYSTEM
// ══════════════════════════════════════════════════════════════

// ── Device SVG Generators ────────────────────────────────────
// Accurate proportions based on real device measurements.
// Each returns an SVG string + the screen rect coordinates within it.

interface DeviceColors {
  body: string;
  btn: string;
  highlight: string;
}

function getDeviceColors(colorScheme: string): DeviceColors {
  if (colorScheme === "silver") {
    return { body: "#e3e3e5", btn: "#c8c8ca", highlight: "#f0f0f2" };
  }
  // space-black default
  return { body: "#1d1d1f", btn: "#2a2a2a", highlight: "#3a3a3c" };
}

// ── iPhone 15 Pro ──
// Real proportions: 70.6mm × 146.6mm, ~1.7mm side bezel, Dynamic Island
function generateiPhoneSVG(w: number, h: number, dc: DeviceColors): string {
  var rx = Math.round(h * 0.054);
  var bx = Math.max(4, Math.round(w * 0.021));
  var by = Math.max(5, Math.round(h * 0.013));
  var srx = Math.round(rx * 0.82);

  // Dynamic Island
  var diW = Math.round(w * 0.31);
  var diH = Math.round(h * 0.036);
  var diX = Math.round((w - diW) / 2);
  var diY = by + Math.round(h * 0.012);
  var diRx = Math.round(diH / 2);

  // Home indicator
  var hiW = Math.round(w * 0.34);
  var hiH = Math.max(3, Math.round(h * 0.006));
  var hiX = Math.round((w - hiW) / 2);
  var hiY = h - by - Math.round(h * 0.018);

  var s =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    w +
    '" height="' +
    h +
    '">';

  // Device body
  s +=
    '<rect x="0" y="0" width="' +
    w +
    '" height="' +
    h +
    '" rx="' +
    rx +
    '" fill="' +
    dc.body +
    '"/>';
  // Titanium edge highlight
  s +=
    '<rect x="0.5" y="0.5" width="' +
    (w - 1) +
    '" height="' +
    (h - 1) +
    '" rx="' +
    rx +
    '" fill="none" stroke="' +
    dc.highlight +
    '" stroke-width="0.5" opacity="0.5"/>';

  // Side buttons (within bounds)
  // Power (right)
  s +=
    '<rect x="' +
    (w - 2) +
    '" y="' +
    Math.round(h * 0.23) +
    '" width="2" height="' +
    Math.round(h * 0.075) +
    '" rx="1" fill="' +
    dc.btn +
    '"/>';
  // Volume up (left)
  s +=
    '<rect x="0" y="' +
    Math.round(h * 0.215) +
    '" width="2" height="' +
    Math.round(h * 0.042) +
    '" rx="1" fill="' +
    dc.btn +
    '"/>';
  // Volume down (left)
  s +=
    '<rect x="0" y="' +
    Math.round(h * 0.275) +
    '" width="2" height="' +
    Math.round(h * 0.042) +
    '" rx="1" fill="' +
    dc.btn +
    '"/>';
  // Action button (left)
  s +=
    '<rect x="0" y="' +
    Math.round(h * 0.165) +
    '" width="2" height="' +
    Math.round(h * 0.024) +
    '" rx="1" fill="' +
    dc.btn +
    '"/>';

  // Screen
  s +=
    '<rect x="' +
    bx +
    '" y="' +
    by +
    '" width="' +
    (w - bx * 2) +
    '" height="' +
    (h - by * 2) +
    '" rx="' +
    srx +
    '" fill="#000"/>';

  // Dynamic Island
  s +=
    '<rect x="' +
    diX +
    '" y="' +
    diY +
    '" width="' +
    diW +
    '" height="' +
    diH +
    '" rx="' +
    diRx +
    '" fill="' +
    dc.body +
    '"/>';
  // Front camera lens dot
  s +=
    '<circle cx="' +
    (diX + diW - Math.round(diH * 0.7)) +
    '" cy="' +
    (diY + Math.round(diH / 2)) +
    '" r="' +
    Math.round(diH * 0.18) +
    '" fill="#0a0a0a" opacity="0.8"/>';

  // Home indicator
  s +=
    '<rect x="' +
    hiX +
    '" y="' +
    hiY +
    '" width="' +
    hiW +
    '" height="' +
    hiH +
    '" rx="' +
    Math.round(hiH / 2) +
    '" fill="#555" opacity="0.35"/>';

  s += "</svg>";
  return s;
}

function getPhoneScreenRect(
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number } {
  var bx = Math.max(4, Math.round(w * 0.021));
  var by = Math.max(5, Math.round(h * 0.013));
  return { x: bx, y: by, w: w - bx * 2, h: h - by * 2 };
}

// ── MacBook Pro ──
// Front view, screen open. Real proportions: 312.6mm × 221.2mm closed,
// screen 14.2" diagonal. Open view ~60% screen, ~8% hinge, ~32% base is too much...
// Mockup convention: screen dominates, base is a thin strip.
function generateMacBookSVG(w: number, h: number, dc: DeviceColors): string {
  var housingW = Math.round(w * 0.87);
  var housingH = Math.round(h * 0.935);
  var housingX = Math.round((w - housingW) / 2);
  var housingRx = Math.round(housingW * 0.016);

  // Screen insets within housing
  var bezT = Math.round(housingH * 0.042);
  var bezS = Math.round(housingW * 0.014);
  var bezB = Math.round(housingH * 0.032);
  var screenX = housingX + bezS;
  var screenY = bezT;
  var screenW = housingW - bezS * 2;
  var screenH = housingH - bezT - bezB;
  var screenRx = Math.max(2, Math.round(screenW * 0.004));

  // Notch
  var notchW = Math.round(housingW * 0.1);
  var notchH = Math.round(bezT * 0.88);
  var notchX = Math.round((w - notchW) / 2);
  var notchRx = Math.round(notchH * 0.3);

  // Hinge & base — thin like a real MacBook
  var hingeY = housingH;
  var hingeH = Math.round(h * 0.008);
  var baseY = hingeY + hingeH;
  var baseH = h - baseY;
  var baseRx = Math.round(baseH * 0.35);

  var s =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    w +
    '" height="' +
    h +
    '">';

  // Screen housing (rounded top corners, flat bottom to meet hinge)
  s +=
    '<rect x="' +
    housingX +
    '" y="0" width="' +
    housingW +
    '" height="' +
    housingH +
    '" rx="' +
    housingRx +
    '" fill="' +
    dc.body +
    '"/>';
  // Square off bottom of housing
  s +=
    '<rect x="' +
    housingX +
    '" y="' +
    Math.round(housingH * 0.5) +
    '" width="' +
    housingW +
    '" height="' +
    Math.round(housingH * 0.5) +
    '" fill="' +
    dc.body +
    '"/>';

  // Screen
  s +=
    '<rect x="' +
    screenX +
    '" y="' +
    screenY +
    '" width="' +
    screenW +
    '" height="' +
    screenH +
    '" rx="' +
    screenRx +
    '" fill="#000"/>';

  // Notch at top center (covers housing + screen edge)
  s +=
    '<path d="M ' +
    notchX +
    " 0 L " +
    notchX +
    " " +
    Math.round(notchH * 0.6) +
    " Q " +
    notchX +
    " " +
    notchH +
    " " +
    (notchX + notchRx) +
    " " +
    notchH +
    " L " +
    (notchX + notchW - notchRx) +
    " " +
    notchH +
    " Q " +
    (notchX + notchW) +
    " " +
    notchH +
    " " +
    (notchX + notchW) +
    " " +
    Math.round(notchH * 0.6) +
    " L " +
    (notchX + notchW) +
    ' 0 Z" fill="' +
    dc.body +
    '"/>';
  // Camera dot
  s +=
    '<circle cx="' +
    Math.round(w / 2) +
    '" cy="' +
    Math.round(notchH * 0.45) +
    '" r="' +
    Math.max(2, Math.round(notchH * 0.15)) +
    '" fill="#0a0a0a" opacity="0.6"/>';
  // Camera ring
  s +=
    '<circle cx="' +
    Math.round(w / 2) +
    '" cy="' +
    Math.round(notchH * 0.45) +
    '" r="' +
    Math.max(3, Math.round(notchH * 0.22)) +
    '" fill="none" stroke="#333" stroke-width="0.5" opacity="0.4"/>';

  // Hinge
  s +=
    '<rect x="' +
    Math.round(housingX * 0.4) +
    '" y="' +
    hingeY +
    '" width="' +
    Math.round(w - housingX * 0.8) +
    '" height="' +
    hingeH +
    '" fill="#111"/>';

  // Base (wider than screen housing)
  s +=
    '<rect x="0" y="' +
    baseY +
    '" width="' +
    w +
    '" height="' +
    baseH +
    '" rx="' +
    baseRx +
    '" fill="' +
    dc.body +
    '"/>';
  // Square off top of base
  s +=
    '<rect x="0" y="' +
    baseY +
    '" width="' +
    w +
    '" height="' +
    Math.round(baseH * 0.5) +
    '" fill="' +
    dc.body +
    '"/>';

  // Keyboard area hint (subtle inner rect)
  var kbW = Math.round(w * 0.72);
  var kbH = Math.round(baseH * 0.38);
  var kbX = Math.round((w - kbW) / 2);
  var kbY = baseY + Math.round(baseH * 0.18);
  s +=
    '<rect x="' +
    kbX +
    '" y="' +
    kbY +
    '" width="' +
    kbW +
    '" height="' +
    kbH +
    '" rx="2" fill="' +
    dc.btn +
    '" opacity="0.12"/>';

  // Trackpad
  var tpW = Math.round(w * 0.3);
  var tpH = Math.round(baseH * 0.28);
  var tpX = Math.round((w - tpW) / 2);
  var tpY = kbY + kbH + Math.round(baseH * 0.06);
  s +=
    '<rect x="' +
    tpX +
    '" y="' +
    tpY +
    '" width="' +
    tpW +
    '" height="' +
    tpH +
    '" rx="3" fill="' +
    dc.btn +
    '" opacity="0.08"/>';

  s += "</svg>";
  return s;
}

function getMacBookScreenRect(
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number } {
  var housingW = Math.round(w * 0.87);
  var housingH = Math.round(h * 0.935);
  var housingX = Math.round((w - housingW) / 2);
  var bezT = Math.round(housingH * 0.042);
  var bezS = Math.round(housingW * 0.014);
  var bezB = Math.round(housingH * 0.032);
  return {
    x: housingX + bezS,
    y: bezT,
    w: housingW - bezS * 2,
    h: housingH - bezT - bezB,
  };
}

// ── Browser Window ──
// Chrome-style with traffic lights, tab bar, URL bar
function generateBrowserSVG(w: number, h: number, dark: boolean): string {
  var titleH = Math.max(32, Math.round(h * 0.058));
  var barBg = dark ? "#2b2b2b" : "#dee1e6";
  var contentBg = dark ? "#1a1a1a" : "#ffffff";
  var urlBg = dark ? "#1a1a1a" : "#ffffff";
  var tabBg = dark ? "#1a1a1a" : "#ffffff";
  var dotMeta = dark ? "#666" : "#aaa";
  var rx = Math.round(titleH * 0.3);

  var s =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    w +
    '" height="' +
    h +
    '">';

  // Window chrome (rounded top)
  s +=
    '<rect x="0" y="0" width="' +
    w +
    '" height="' +
    h +
    '" rx="' +
    rx +
    '" fill="' +
    barBg +
    '"/>';
  // Square off bottom
  s +=
    '<rect x="0" y="' +
    Math.round(h * 0.5) +
    '" width="' +
    w +
    '" height="' +
    Math.round(h * 0.5) +
    '" fill="' +
    contentBg +
    '"/>';

  // Title bar
  s +=
    '<rect x="0" y="0" width="' +
    w +
    '" height="' +
    titleH +
    '" rx="' +
    rx +
    '" fill="' +
    barBg +
    '"/>';
  s +=
    '<rect x="0" y="' +
    Math.round(titleH * 0.5) +
    '" width="' +
    w +
    '" height="' +
    Math.round(titleH * 0.5) +
    '" fill="' +
    barBg +
    '"/>';

  // 1px separator
  s +=
    '<rect x="0" y="' +
    titleH +
    '" width="' +
    w +
    '" height="1" fill="' +
    (dark ? "#1a1a1a" : "#c5c8cc") +
    '" opacity="0.5"/>';

  // Traffic lights
  var dotR = Math.max(4, Math.round(titleH * 0.14));
  var dotY = Math.round(titleH / 2);
  var dotX1 = Math.round(titleH * 0.45);
  var dotGap = Math.round(dotR * 2.4);
  s +=
    '<circle cx="' +
    dotX1 +
    '" cy="' +
    dotY +
    '" r="' +
    dotR +
    '" fill="#ff5f57"/>';
  s +=
    '<circle cx="' +
    (dotX1 + dotGap) +
    '" cy="' +
    dotY +
    '" r="' +
    dotR +
    '" fill="#ffbd2e"/>';
  s +=
    '<circle cx="' +
    (dotX1 + dotGap * 2) +
    '" cy="' +
    dotY +
    '" r="' +
    dotR +
    '" fill="#28c940"/>';

  // Active tab
  var tabH = Math.round(titleH * 0.65);
  var tabW = Math.round(w * 0.15);
  var tabX = Math.round(dotX1 + dotGap * 3 + dotR * 2);
  var tabY = Math.round((titleH - tabH) / 2);
  s +=
    '<rect x="' +
    tabX +
    '" y="' +
    tabY +
    '" width="' +
    tabW +
    '" height="' +
    tabH +
    '" rx="' +
    Math.round(tabH * 0.25) +
    '" fill="' +
    tabBg +
    '"/>';
  // Tab text hint
  s +=
    '<rect x="' +
    (tabX + 10) +
    '" y="' +
    Math.round(tabY + tabH * 0.35) +
    '" width="' +
    Math.round(tabW * 0.4) +
    '" height="' +
    Math.round(tabH * 0.3) +
    '" rx="2" fill="' +
    dotMeta +
    '" opacity="0.3"/>';

  // URL bar
  var urlW = Math.round(w * 0.4);
  var urlH = Math.round(titleH * 0.6);
  var urlX = Math.round((w - urlW) / 2);
  var urlY = Math.round((titleH - urlH) / 2);
  s +=
    '<rect x="' +
    urlX +
    '" y="' +
    urlY +
    '" width="' +
    urlW +
    '" height="' +
    urlH +
    '" rx="' +
    Math.round(urlH / 2) +
    '" fill="' +
    urlBg +
    '"/>';
  // URL hint text
  s +=
    '<rect x="' +
    (urlX + 12) +
    '" y="' +
    Math.round(urlY + urlH * 0.35) +
    '" width="' +
    Math.round(urlW * 0.25) +
    '" height="' +
    Math.round(urlH * 0.3) +
    '" rx="2" fill="' +
    dotMeta +
    '" opacity="0.25"/>';

  // Content area
  s +=
    '<rect x="0" y="' +
    (titleH + 1) +
    '" width="' +
    w +
    '" height="' +
    (h - titleH - 1) +
    '" fill="' +
    contentBg +
    '"/>';

  s += "</svg>";
  return s;
}

function getBrowserScreenRect(
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number } {
  var titleH = Math.max(32, Math.round(h * 0.058));
  return { x: 0, y: titleH + 1, w: w, h: h - titleH - 1 };
}

// ── Windows Browser (Chrome on Windows) ──
// Right-aligned minimize/maximize/close, tab bar, URL bar
function generateWindowsBrowserSVG(
  w: number,
  h: number,
  dark: boolean,
): string {
  var titleH = Math.max(32, Math.round(h * 0.058));
  var barBg = dark ? "#2b2b2b" : "#dee1e6";
  var contentBg = dark ? "#1a1a1a" : "#ffffff";
  var urlBg = dark ? "#1a1a1a" : "#ffffff";
  var tabBg = dark ? "#1a1a1a" : "#ffffff";
  var dotMeta = dark ? "#666" : "#aaa";
  // Windows has no rounded top corners by default
  var rx = 0;

  var s =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    w +
    '" height="' +
    h +
    '">';

  // Window chrome (square top for Windows)
  s +=
    '<rect x="0" y="0" width="' +
    w +
    '" height="' +
    h +
    '" fill="' +
    barBg +
    '"/>';
  // Content area
  s +=
    '<rect x="0" y="' +
    (titleH + 1) +
    '" width="' +
    w +
    '" height="' +
    (h - titleH - 1) +
    '" fill="' +
    contentBg +
    '"/>';

  // Title bar area
  var tabBarH = Math.round(titleH * 0.52);
  var urlBarH = titleH - tabBarH;

  // ── Windows title bar buttons (right-aligned: ─ □ ✕) ──
  var btnW = Math.round(titleH * 1.1);
  var btnH = tabBarH;
  var closeColor = "#c42b1c";
  var btnHover = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  var iconColor = dark ? "#ccc" : "#555";

  // Close button (rightmost, red)
  s +=
    '<rect x="' +
    (w - btnW) +
    '" y="0" width="' +
    btnW +
    '" height="' +
    btnH +
    '" fill="' +
    closeColor +
    '"/>';
  // ✕ icon
  var cx1 = w - Math.round(btnW / 2);
  var cy1 = Math.round(btnH / 2);
  var crossS = Math.round(btnH * 0.18);
  s +=
    '<line x1="' +
    (cx1 - crossS) +
    '" y1="' +
    (cy1 - crossS) +
    '" x2="' +
    (cx1 + crossS) +
    '" y2="' +
    (cy1 + crossS) +
    '" stroke="#fff" stroke-width="1.2"/>';
  s +=
    '<line x1="' +
    (cx1 + crossS) +
    '" y1="' +
    (cy1 - crossS) +
    '" x2="' +
    (cx1 - crossS) +
    '" y2="' +
    (cy1 + crossS) +
    '" stroke="#fff" stroke-width="1.2"/>';

  // Maximize button
  s +=
    '<rect x="' +
    (w - btnW * 2) +
    '" y="0" width="' +
    btnW +
    '" height="' +
    btnH +
    '" fill="' +
    btnHover +
    '"/>';
  var cx2 = w - Math.round(btnW * 1.5);
  var boxS = Math.round(btnH * 0.16);
  s +=
    '<rect x="' +
    (cx2 - boxS) +
    '" y="' +
    (cy1 - boxS) +
    '" width="' +
    boxS * 2 +
    '" height="' +
    boxS * 2 +
    '" fill="none" stroke="' +
    iconColor +
    '" stroke-width="1"/>';

  // Minimize button
  s +=
    '<rect x="' +
    (w - btnW * 3) +
    '" y="0" width="' +
    btnW +
    '" height="' +
    btnH +
    '" fill="' +
    btnHover +
    '"/>';
  var cx3 = w - Math.round(btnW * 2.5);
  s +=
    '<line x1="' +
    (cx3 - boxS) +
    '" y1="' +
    cy1 +
    '" x2="' +
    (cx3 + boxS) +
    '" y2="' +
    cy1 +
    '" stroke="' +
    iconColor +
    '" stroke-width="1.2"/>';

  // Active tab (left side)
  var tabW = Math.round(w * 0.14);
  var tabX = Math.round(titleH * 0.28);
  var tabRx = Math.round(tabBarH * 0.2);
  s +=
    '<rect x="' +
    tabX +
    '" y="' +
    Math.round(tabBarH * 0.2) +
    '" width="' +
    tabW +
    '" height="' +
    Math.round(tabBarH * 0.8) +
    '" rx="' +
    tabRx +
    '" fill="' +
    tabBg +
    '"/>';
  // Square off tab bottom
  s +=
    '<rect x="' +
    tabX +
    '" y="' +
    Math.round(tabBarH * 0.55) +
    '" width="' +
    tabW +
    '" height="' +
    Math.round(tabBarH * 0.45) +
    '" fill="' +
    tabBg +
    '"/>';
  // Tab label
  var tabFontSz = Math.max(8, Math.round(tabBarH * 0.32));
  s +=
    '<text x="' +
    (tabX + Math.round(tabW * 0.12)) +
    '" y="' +
    Math.round(tabBarH * 0.65) +
    '" fill="' +
    dotMeta +
    '" font-family="Inter,system-ui,sans-serif" font-size="' +
    tabFontSz +
    '">New Tab</text>';

  // URL bar
  var urlPad = Math.round(titleH * 0.22);
  var urlY = tabBarH;
  var urlRx = Math.round(urlBarH * 0.3);
  var urlInnerH = Math.round(urlBarH * 0.65);
  s +=
    '<rect x="' +
    urlPad +
    '" y="' +
    (urlY + Math.round(urlBarH * 0.18)) +
    '" width="' +
    (w - urlPad * 2) +
    '" height="' +
    urlInnerH +
    '" rx="' +
    urlRx +
    '" fill="' +
    urlBg +
    '"/>';
  // URL placeholder
  var urlFontSz = Math.max(8, Math.round(urlBarH * 0.35));
  s +=
    '<text x="' +
    (urlPad + Math.round(urlBarH * 0.5)) +
    '" y="' +
    (urlY + Math.round(urlBarH * 0.62)) +
    '" fill="' +
    dotMeta +
    '" font-family="Inter,system-ui,sans-serif" font-size="' +
    urlFontSz +
    '">commando360.ai</text>';

  s += "</svg>";
  return s;
}

function getWindowsBrowserScreenRect(
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number } {
  var titleH = Math.max(32, Math.round(h * 0.058));
  return { x: 0, y: titleH + 1, w: w, h: h - titleH - 1 };
}

// ── Device Placement Helper ─────────────────────────────────
// Creates a device frame with an image placeholder at screen position

function addDeviceMockup(
  parent: FrameNode,
  device: string,
  x: number,
  y: number,
  deviceH: number,
  colorScheme: string,
  rot?: number,
): { wrapper: FrameNode; screen: RectangleNode } {
  var dc = getDeviceColors(colorScheme);
  var isDark = C.bg.r < 0.5;

  var deviceW: number;
  var svgStr: string;
  var screenR: { x: number; y: number; w: number; h: number };

  switch (device) {
    case "macbook":
      deviceW = Math.round(deviceH * 1.55);
      svgStr = generateMacBookSVG(deviceW, deviceH, dc);
      screenR = getMacBookScreenRect(deviceW, deviceH);
      break;
    case "browser":
      deviceW = Math.round(deviceH * 1.5);
      svgStr = generateBrowserSVG(deviceW, deviceH, isDark);
      screenR = getBrowserScreenRect(deviceW, deviceH);
      break;
    case "windows-browser":
      deviceW = Math.round(deviceH * 1.5);
      svgStr = generateWindowsBrowserSVG(deviceW, deviceH, isDark);
      screenR = getWindowsBrowserScreenRect(deviceW, deviceH);
      break;
    default: // iphone
      deviceW = Math.round(deviceH * 0.483);
      svgStr = generateiPhoneSVG(deviceW, deviceH, dc);
      screenR = getPhoneScreenRect(deviceW, deviceH);
  }

  // Wrapper frame (transparent, no clip so shadow renders)
  var wrapper = figma.createFrame();
  wrapper.name = device + "-mockup";
  wrapper.resize(deviceW, deviceH);
  wrapper.fills = [];
  wrapper.clipsContent = false;

  // Render device SVG
  var svgNode = figma.createNodeFromSvg(svgStr);
  svgNode.x = 0;
  svgNode.y = 0;
  wrapper.appendChild(svgNode);

  // Screen image placeholder (sits on top of SVG's black screen)
  var screen = figma.createRectangle();
  screen.name = "screen";
  screen.resize(screenR.w, screenR.h);
  screen.x = screenR.x;
  screen.y = screenR.y;
  screen.fills = [
    solid(
      isDark ? { r: 0.05, g: 0.06, b: 0.07 } : { r: 0.1, g: 0.11, b: 0.13 },
    ),
  ];
  if (device === "iphone") {
    screen.cornerRadius = Math.round(deviceH * 0.045);
  } else if (device === "macbook") {
    screen.cornerRadius = Math.max(2, Math.round(screenR.w * 0.004));
  }
  wrapper.appendChild(screen);

  // "DROP SCREENSHOT" label
  var labelSize = Math.max(8, Math.round(screenR.h * 0.025));
  var lbl = figma.createText();
  lbl.fontName = INTER_MED;
  lbl.fontSize = labelSize;
  lbl.fills = [solid({ r: 0.28, g: 0.3, b: 0.34 })];
  lbl.characters = "DROP SCREENSHOT";
  lbl.name = "screen-label";
  lbl.textAlignHorizontal = "CENTER";
  lbl.resize(screenR.w, lbl.height);
  lbl.textAutoResize = "HEIGHT";
  lbl.x = screenR.x;
  lbl.y = screenR.y + Math.round(screenR.h / 2) - Math.round(labelSize * 0.6);
  wrapper.appendChild(lbl);

  // Drop shadow for realism
  var shadowScale = deviceH / 600;
  wrapper.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: isDark ? 0.5 : 0.22 },
      offset: { x: 0, y: Math.round(14 * shadowScale) },
      radius: Math.round(48 * shadowScale),
      spread: Math.round(-4 * shadowScale),
      visible: true,
      blendMode: "NORMAL",
    } as DropShadowEffect,
  ];

  wrapper.x = x;
  wrapper.y = y;
  if (rot) wrapper.rotation = rot;

  parent.appendChild(wrapper);
  return { wrapper, screen };
}

// ── Mockup Composition Builders ──────────────────────────────

function buildMockupPhoneHero(
  parent: FrameNode,
  w: number,
  h: number,
  color: string,
): void {
  addPremiumBg(parent, w, h, 0);
  var dH = Math.round(h * 0.78);
  var dW = Math.round(dH * 0.483);
  addDeviceMockup(
    parent,
    "iphone",
    Math.round((w - dW) / 2),
    Math.round((h - dH) / 2),
    dH,
    color,
  );
}

function buildMockupLaptopHero(
  parent: FrameNode,
  w: number,
  h: number,
  color: string,
): void {
  addPremiumBg(parent, w, h, 1);
  var dH = Math.round(h * 0.72);
  var dW = Math.round(dH * 1.55);
  addDeviceMockup(
    parent,
    "macbook",
    Math.round((w - dW) / 2),
    Math.round((h - dH) / 2),
    dH,
    color,
  );
}

function buildMockupBrowserHero(
  parent: FrameNode,
  w: number,
  h: number,
  color: string,
): void {
  addPremiumBg(parent, w, h, 2);
  var dH = Math.round(h * 0.82);
  var dW = Math.round(dH * 1.5);
  addDeviceMockup(
    parent,
    "browser",
    Math.round((w - dW) / 2),
    Math.round((h - dH) / 2),
    dH,
    color,
  );
}

function buildMockupPhoneTrio(
  parent: FrameNode,
  w: number,
  h: number,
  color: string,
): void {
  addPremiumBg(parent, w, h, 3);

  var sideH = Math.round(h * 0.62);
  var sideW = Math.round(sideH * 0.483);
  var centerH = Math.round(h * 0.72);
  var centerW = Math.round(centerH * 0.483);
  var cx = Math.round(w / 2);
  var cy = Math.round(h / 2);
  var spread = Math.round(centerW * 0.95);

  // Left phone (behind, rotated)
  addDeviceMockup(
    parent,
    "iphone",
    cx - spread - Math.round(sideW / 2),
    cy - Math.round(sideH / 2) + Math.round(h * 0.02),
    sideH,
    color,
    12,
  );

  // Right phone (behind, rotated)
  addDeviceMockup(
    parent,
    "iphone",
    cx + spread - Math.round(sideW / 2),
    cy - Math.round(sideH / 2) + Math.round(h * 0.02),
    sideH,
    color,
    -12,
  );

  // Center phone (front, on top — added last for z-order)
  addDeviceMockup(
    parent,
    "iphone",
    cx - Math.round(centerW / 2),
    cy - Math.round(centerH / 2),
    centerH,
    color,
  );
}

function buildMockupPhoneLaptop(
  parent: FrameNode,
  w: number,
  h: number,
  color: string,
): void {
  addPremiumBg(parent, w, h, 4);

  // Laptop behind, offset left
  var lapH = Math.round(h * 0.68);
  var lapW = Math.round(lapH * 1.55);
  var lapX = Math.round((w - lapW) / 2) - Math.round(w * 0.06);
  var lapY = Math.round((h - lapH) / 2) - Math.round(h * 0.04);
  addDeviceMockup(parent, "macbook", lapX, lapY, lapH, color);

  // Phone front-right, overlapping
  var phH = Math.round(h * 0.58);
  var phW = Math.round(phH * 0.483);
  var phX = lapX + lapW - Math.round(phW * 0.6);
  var phY = Math.round((h - phH) / 2) + Math.round(h * 0.1);
  addDeviceMockup(parent, "iphone", phX, phY, phH, color);
}

function buildMockupCascade(
  parent: FrameNode,
  w: number,
  h: number,
  color: string,
): void {
  addPremiumBg(parent, w, h, 5);

  var phH = Math.round(h * 0.72);
  var phW = Math.round(phH * 0.483);
  var cx = Math.round(w / 2);
  var cy = Math.round(h / 2);
  var offsetX = Math.round(phW * 0.45);
  var offsetY = Math.round(phH * 0.06);

  // Back phone (offset up-left)
  addDeviceMockup(
    parent,
    "iphone",
    cx - offsetX - Math.round(phW / 2),
    cy - offsetY - Math.round(phH / 2),
    phH,
    color,
  );

  // Front phone (offset down-right)
  addDeviceMockup(
    parent,
    "iphone",
    cx + offsetX - Math.round(phW / 2),
    cy + offsetY - Math.round(phH / 2),
    phH,
    color,
  );
}

function buildMockupResponsive(
  parent: FrameNode,
  w: number,
  h: number,
  color: string,
): void {
  addPremiumBg(parent, w, h, 0);

  // Browser window (left/center, larger)
  var brH = Math.round(h * 0.72);
  var brW = Math.round(brH * 1.5);
  var brX = Math.round(w * 0.06);
  var brY = Math.round((h - brH) / 2);
  addDeviceMockup(parent, "browser", brX, brY, brH, color);

  // Phone (right, overlapping slightly)
  var phH = Math.round(h * 0.6);
  var phW = Math.round(phH * 0.483);
  var phX = brX + brW - Math.round(phW * 0.15);
  var phY = Math.round(h * 0.5) - Math.round(phH * 0.35);
  addDeviceMockup(parent, "iphone", phX, phY, phH, color);
}

// ── Windows Browser Hero ──
function buildMockupWindowsBrowserHero(
  parent: FrameNode,
  w: number,
  h: number,
  color: string,
): void {
  addPremiumBg(parent, w, h, 2);
  var dH = Math.round(h * 0.82);
  var dW = Math.round(dH * 1.5);
  addDeviceMockup(
    parent,
    "windows-browser",
    Math.round((w - dW) / 2),
    Math.round((h - dH) / 2),
    dH,
    color,
  );
}

// ── Branded Mockup Post Builders ────────────────────────────
// Ready-to-post layouts with device mockup + headline + subtext + brand footer.
// Each builder takes the full frame and a device type.

function buildMockupPostSplit(
  parent: FrameNode,
  w: number,
  h: number,
  color: string,
  postDevice: string,
): void {
  // Left side: text, right side: device
  var isDark = C.bg.r < 0.5;
  addPremiumBg(parent, w, h, 0);

  var footerH = Math.round(h * 0.09);
  var safeH = h - footerH;
  var midX = Math.round(w * 0.48);
  var padX = Math.round(w * 0.05);
  var padY = Math.round(safeH * 0.12);

  // Headline
  var headSz = Math.max(14, Math.round(h * 0.045));
  addText(
    parent,
    "headline",
    "YOUR HEADLINE HERE",
    INTER_BOLD,
    headSz,
    C.white,
    padX,
    padY,
    {
      maxWidth: midX - padX * 2,
      lineHeight: 120,
    },
  );

  // Subtext
  var subSz = Math.max(10, Math.round(h * 0.022));
  addText(
    parent,
    "subtext",
    "Supporting copy goes here. Describe the feature shown in the mockup.",
    INTER_REG,
    subSz,
    C.gray,
    padX,
    padY + Math.round(headSz * 3),
    {
      maxWidth: midX - padX * 2,
      lineHeight: 150,
    },
  );

  // Red accent line
  addRect(
    parent,
    "accent",
    Math.round(w * 0.06),
    3,
    padX,
    padY + Math.round(headSz * 2.2),
    solid(C.red),
  );

  // Device on right side
  var devH = Math.round(safeH * 0.72);
  var isWide =
    postDevice === "macbook" ||
    postDevice === "browser" ||
    postDevice === "windows-browser";
  var devW = isWide ? Math.round(devH * 1.5) : Math.round(devH * 0.483);
  var devX = Math.max(midX, Math.round(w - devW - padX * 0.5));
  var devY = Math.round((safeH - devH) / 2);
  addDeviceMockup(parent, postDevice, devX, devY, devH, color);

  // Brand footer
  addBrandFooter(parent, w, h, footerH, brandLogo || undefined);
}

function buildMockupPostCentered(
  parent: FrameNode,
  w: number,
  h: number,
  color: string,
  postDevice: string,
): void {
  // Device centered with text above
  addPremiumBg(parent, w, h, 1);

  var footerH = Math.round(h * 0.09);
  var safeH = h - footerH;
  var padX = Math.round(w * 0.08);
  var topPad = Math.round(safeH * 0.06);

  // Headline (centered)
  var headSz = Math.max(14, Math.round(h * 0.04));
  addText(
    parent,
    "headline",
    "YOUR HEADLINE HERE",
    INTER_BOLD,
    headSz,
    C.white,
    padX,
    topPad,
    {
      maxWidth: w - padX * 2,
      align: "CENTER",
    },
  );

  // Subtext
  var subSz = Math.max(10, Math.round(h * 0.02));
  addText(
    parent,
    "subtext",
    "Brief description of the product feature being showcased.",
    INTER_REG,
    subSz,
    C.gray,
    padX,
    topPad + Math.round(headSz * 2),
    {
      maxWidth: w - padX * 2,
      align: "CENTER",
      lineHeight: 150,
    },
  );

  // Device centered below text
  var textBottom = topPad + Math.round(headSz * 4.5);
  var devH = Math.round(safeH - textBottom - Math.round(safeH * 0.04));
  var isWide =
    postDevice === "macbook" ||
    postDevice === "browser" ||
    postDevice === "windows-browser";
  var devW = isWide ? Math.round(devH * 1.5) : Math.round(devH * 0.483);
  var devX = Math.round((w - devW) / 2);
  addDeviceMockup(parent, postDevice, devX, textBottom, devH, color);

  addBrandFooter(parent, w, h, footerH, brandLogo || undefined);
}

function buildMockupPostAngled(
  parent: FrameNode,
  w: number,
  h: number,
  color: string,
  postDevice: string,
): void {
  // Device angled from bottom-right, text top-left
  addPremiumBg(parent, w, h, 3);

  var footerH = Math.round(h * 0.09);
  var safeH = h - footerH;
  var padX = Math.round(w * 0.06);
  var padY = Math.round(safeH * 0.1);

  // Headline top-left
  var headSz = Math.max(14, Math.round(h * 0.042));
  addText(
    parent,
    "headline",
    "YOUR HEADLINE HERE",
    INTER_BOLD,
    headSz,
    C.white,
    padX,
    padY,
    {
      maxWidth: Math.round(w * 0.55),
      lineHeight: 120,
    },
  );

  // Subtext
  var subSz = Math.max(10, Math.round(h * 0.02));
  addText(
    parent,
    "subtext",
    "Feature description that sells the product.",
    INTER_REG,
    subSz,
    C.gray,
    padX,
    padY + Math.round(headSz * 2.5),
    {
      maxWidth: Math.round(w * 0.45),
      lineHeight: 150,
    },
  );

  // Red accent
  addRect(
    parent,
    "accent",
    Math.round(w * 0.06),
    3,
    padX,
    padY + Math.round(headSz * 2),
    solid(C.red),
  );

  // Device from bottom-right corner, slightly rotated
  var devH = Math.round(safeH * 0.7);
  var isWide =
    postDevice === "macbook" ||
    postDevice === "browser" ||
    postDevice === "windows-browser";
  var devW = isWide ? Math.round(devH * 1.5) : Math.round(devH * 0.483);
  var devX = Math.round(w - devW - padX * 0.3);
  var devY = Math.round(safeH - devH + Math.round(safeH * 0.08));
  addDeviceMockup(
    parent,
    postDevice,
    devX,
    devY,
    devH,
    color,
    isWide ? -3 : -8,
  );

  addBrandFooter(parent, w, h, footerH, brandLogo || undefined);
}

function buildMockupPostStory(
  parent: FrameNode,
  w: number,
  h: number,
  color: string,
  postDevice: string,
): void {
  // Story/portrait: device centered, text below
  addPremiumBg(parent, w, h, 4);

  var footerH = Math.round(h * 0.05);
  var safeH = h - footerH;
  var padX = Math.round(w * 0.08);

  // Device upper half
  var devH = Math.round(safeH * 0.52);
  var isWide =
    postDevice === "macbook" ||
    postDevice === "browser" ||
    postDevice === "windows-browser";
  var devW = isWide ? Math.round(devH * 1.5) : Math.round(devH * 0.483);
  var devX = Math.round((w - devW) / 2);
  var devY = Math.round(safeH * 0.06);
  addDeviceMockup(parent, postDevice, devX, devY, devH, color);

  // Text below device
  var textY = devY + devH + Math.round(safeH * 0.04);
  var headSz = Math.max(16, Math.round(h * 0.032));
  addText(
    parent,
    "headline",
    "YOUR HEADLINE HERE",
    INTER_BOLD,
    headSz,
    C.white,
    padX,
    textY,
    {
      maxWidth: w - padX * 2,
      align: "CENTER",
      lineHeight: 120,
    },
  );

  var subSz = Math.max(11, Math.round(h * 0.018));
  addText(
    parent,
    "subtext",
    "Describe the feature shown above. Perfect for stories and vertical content.",
    INTER_REG,
    subSz,
    C.gray,
    padX,
    textY + Math.round(headSz * 2.5),
    {
      maxWidth: w - padX * 2,
      align: "CENTER",
      lineHeight: 150,
    },
  );

  // Red accent
  var accentW = Math.round(w * 0.12);
  addRect(
    parent,
    "accent",
    accentW,
    3,
    Math.round((w - accentW) / 2),
    textY + Math.round(headSz * 2),
    solid(C.red),
  );

  addBrandFooter(parent, w, h, footerH, brandLogo || undefined);
}

// ── Phone + Desktop combo post ──────────────────────────────
function buildMockupPostDual(
  parent: FrameNode,
  w: number,
  h: number,
  color: string,
  desktopDevice: string,
): void {
  addPremiumBg(parent, w, h, 5);

  var footerH = Math.round(h * 0.09);
  var safeH = h - footerH;
  var padX = Math.round(w * 0.04);

  // Desktop behind (left/center)
  var deskH = Math.round(safeH * 0.62);
  var deskW = Math.round(deskH * 1.5);
  var deskX = padX;
  var deskY = Math.round(safeH * 0.08);
  addDeviceMockup(parent, desktopDevice, deskX, deskY, deskH, color);

  // Phone overlapping front-right
  var phH = Math.round(safeH * 0.55);
  var phW = Math.round(phH * 0.483);
  var phX = deskX + deskW - Math.round(phW * 0.3);
  var phY = Math.round(safeH * 0.25);
  addDeviceMockup(parent, "iphone", phX, phY, phH, color);

  // Headline below devices (right-aligned area)
  var textX = Math.round(w * 0.55);
  var textY = Math.round(safeH * 0.72);
  var headSz = Math.max(12, Math.round(h * 0.032));
  addText(
    parent,
    "headline",
    "YOUR HEADLINE HERE",
    INTER_BOLD,
    headSz,
    C.white,
    textX,
    textY,
    {
      maxWidth: w - textX - padX,
      lineHeight: 120,
    },
  );

  var subSz = Math.max(9, Math.round(h * 0.018));
  addText(
    parent,
    "subtext",
    "Available on all devices.",
    INTER_REG,
    subSz,
    C.gray,
    textX,
    textY + Math.round(headSz * 2),
    {
      maxWidth: w - textX - padX,
      lineHeight: 150,
    },
  );

  addBrandFooter(parent, w, h, footerH, brandLogo || undefined);
}

// ── Phone + Desktop story variant ──
function buildMockupPostDualStory(
  parent: FrameNode,
  w: number,
  h: number,
  color: string,
  desktopDevice: string,
): void {
  addPremiumBg(parent, w, h, 2);

  var footerH = Math.round(h * 0.05);
  var safeH = h - footerH;
  var padX = Math.round(w * 0.06);

  // Desktop upper area
  var deskH = Math.round(safeH * 0.3);
  var deskW = Math.round(deskH * 1.5);
  var deskX = Math.round((w - deskW) / 2);
  var deskY = Math.round(safeH * 0.05);
  addDeviceMockup(parent, desktopDevice, deskX, deskY, deskH, color);

  // Phone middle
  var phH = Math.round(safeH * 0.35);
  var phW = Math.round(phH * 0.483);
  var phX = Math.round((w - phW) / 2);
  var phY = deskY + deskH + Math.round(safeH * 0.02);
  addDeviceMockup(parent, "iphone", phX, phY, phH, color);

  // Text below
  var textY = phY + phH + Math.round(safeH * 0.03);
  var headSz = Math.max(14, Math.round(h * 0.028));
  addText(
    parent,
    "headline",
    "YOUR HEADLINE HERE",
    INTER_BOLD,
    headSz,
    C.white,
    padX,
    textY,
    {
      maxWidth: w - padX * 2,
      align: "CENTER",
      lineHeight: 120,
    },
  );

  var subSz = Math.max(10, Math.round(h * 0.016));
  addText(
    parent,
    "subtext",
    "Works everywhere you do.",
    INTER_REG,
    subSz,
    C.gray,
    padX,
    textY + Math.round(headSz * 2.5),
    {
      maxWidth: w - padX * 2,
      align: "CENTER",
      lineHeight: 150,
    },
  );

  addBrandFooter(parent, w, h, footerH, brandLogo || undefined);
}

// Post style registry: device focus determines which builders apply.
// "phone" = only phone device. "desktop" = only desktop device. "dual" = phone + desktop.
var MOCKUP_POST_STYLES: Array<{
  key: string;
  label: string;
  device: string; // "phone" | "desktop" | "dual"
  build: (f: FrameNode, w: number, h: number, c: string, d: string) => void;
  forStory?: boolean;
}> = [
  {
    key: "phone-split",
    label: "Phone Split",
    device: "phone",
    build: buildMockupPostSplit,
  },
  {
    key: "phone-centered",
    label: "Phone Centered",
    device: "phone",
    build: buildMockupPostCentered,
  },
  {
    key: "phone-angled",
    label: "Phone Angled",
    device: "phone",
    build: buildMockupPostAngled,
  },
  {
    key: "phone-story",
    label: "Phone Story",
    device: "phone",
    build: buildMockupPostStory,
    forStory: true,
  },
  {
    key: "desktop-split",
    label: "Desktop Split",
    device: "desktop",
    build: buildMockupPostSplit,
  },
  {
    key: "desktop-centered",
    label: "Desktop Centered",
    device: "desktop",
    build: buildMockupPostCentered,
  },
  {
    key: "desktop-angled",
    label: "Desktop Angled",
    device: "desktop",
    build: buildMockupPostAngled,
  },
  {
    key: "desktop-story",
    label: "Desktop Story",
    device: "desktop",
    build: buildMockupPostStory,
    forStory: true,
  },
  {
    key: "dual",
    label: "Phone + Desktop",
    device: "dual",
    build: buildMockupPostDual,
  },
  {
    key: "dual-story",
    label: "Phone + Desktop Story",
    device: "dual",
    build: buildMockupPostDualStory,
    forStory: true,
  },
];

// ── Mockup Orchestrator ─────────────────────────────────────

var MOCKUP_LAYOUTS: Record<string, { w: number; h: number }> = {
  "phone-hero": { w: 1200, h: 900 },
  "laptop-hero": { w: 1400, h: 900 },
  "browser-hero": { w: 1400, h: 900 },
  "windows-browser-hero": { w: 1400, h: 900 },
  "phone-trio": { w: 1500, h: 900 },
  "phone-laptop": { w: 1500, h: 950 },
  "phone-cascade": { w: 1200, h: 900 },
  responsive: { w: 1600, h: 900 },
};

var MOCKUP_POST_PLATFORMS: Record<
  string,
  { w: number; h: number; label: string }
> = {
  linkedin: { w: 1200, h: 627, label: "LinkedIn" },
  instagram: { w: 1080, h: 1080, label: "Instagram" },
  "ig-story": { w: 1080, h: 1920, label: "IG Story" },
  twitter: { w: 1200, h: 675, label: "X (Twitter)" },
  facebook: { w: 1200, h: 628, label: "Facebook" },
};

async function createMockups(
  layouts: string[],
  deviceColor: string,
  themes: string[],
  platforms: string[],
  postDeviceFocus: string[],
  desktopStyle: string,
  logoImage?: number[],
  fullLogoImage?: number[],
): Promise<void> {
  await Promise.all([
    figma.loadFontAsync(INTER_BOLD),
    figma.loadFontAsync(INTER_SEMI),
    figma.loadFontAsync(INTER_MED),
    figma.loadFontAsync(INTER_REG),
  ]);

  // Set logo globals for brand footer
  if (fullLogoImage && fullLogoImage.length > 0) {
    brandLogo = figma.createImage(new Uint8Array(fullLogoImage));
  }
  if (logoImage && logoImage.length > 0) {
    circleLogo = figma.createImage(new Uint8Array(logoImage));
  }

  // Resolve which device string to use for desktop posts
  var deskDev = desktopStyle || "macbook";

  // Build a set of selected device focuses for filtering post styles
  var focusSet: Record<string, boolean> = {};
  for (var fi = 0; fi < postDeviceFocus.length; fi++) {
    focusSet[postDeviceFocus[fi]] = true;
  }

  // Filter applicable post styles based on selected device focuses
  var applicableStyles = MOCKUP_POST_STYLES.filter(function (st) {
    return !!focusSet[st.device];
  });

  // Scan existing page nodes to find maxY → avoid overlap
  var pageMaxY = 0;
  for (var ci = 0; ci < figma.currentPage.children.length; ci++) {
    var child = figma.currentPage.children[ci];
    var bottom = child.y + child.height;
    if (bottom > pageMaxY) pageMaxY = bottom;
  }
  var startY = pageMaxY > 0 ? pageMaxY + 150 : 0;

  // Count total frames to generate for progress
  var postStylesPerPlatform = 0;
  for (var csi = 0; csi < applicableStyles.length; csi++) {
    // We'll count properly in the loop; rough estimate here
    postStylesPerPlatform++;
  }
  var totalCount =
    layouts.length * themes.length +
    platforms.length * themes.length * postStylesPerPlatform;
  var frameIdx = 0;
  var xPos = 0;
  var curY = startY;
  var rowMaxH = 0;

  // ── Phase 1: Raw mockup compositions ──
  for (var li = 0; li < layouts.length; li++) {
    var layout = layouts[li];
    var dims = MOCKUP_LAYOUTS[layout] || { w: 1200, h: 900 };

    for (var ti = 0; ti < themes.length; ti++) {
      var isDark = themes[ti] === "dark";
      applyTheme(isDark);
      var tSuffix = themes.length > 1 ? (isDark ? " (Dark)" : " (Light)") : "";

      var frame = figma.createFrame();
      frame.name = "Mockup \u2014 " + layout + tSuffix;
      frame.resize(dims.w, dims.h);
      frame.x = xPos;
      frame.y = curY;
      frame.fills = [{ type: "SOLID", color: C.bg }];
      frame.clipsContent = true;

      try {
        switch (layout) {
          case "phone-hero":
            buildMockupPhoneHero(frame, dims.w, dims.h, deviceColor);
            break;
          case "laptop-hero":
            buildMockupLaptopHero(frame, dims.w, dims.h, deviceColor);
            break;
          case "browser-hero":
            buildMockupBrowserHero(frame, dims.w, dims.h, deviceColor);
            break;
          case "windows-browser-hero":
            buildMockupWindowsBrowserHero(frame, dims.w, dims.h, deviceColor);
            break;
          case "phone-trio":
            buildMockupPhoneTrio(frame, dims.w, dims.h, deviceColor);
            break;
          case "phone-laptop":
            buildMockupPhoneLaptop(frame, dims.w, dims.h, deviceColor);
            break;
          case "phone-cascade":
            buildMockupCascade(frame, dims.w, dims.h, deviceColor);
            break;
          case "responsive":
            buildMockupResponsive(frame, dims.w, dims.h, deviceColor);
            break;
        }
      } catch (err) {
        figma.ui.postMessage({
          type: "error",
          message:
            "Mockup error (" +
            layout +
            "): " +
            (err instanceof Error ? err.message : String(err)),
        });
      }

      figma.currentPage.appendChild(frame);
      if (dims.h > rowMaxH) rowMaxH = dims.h;
      xPos += dims.w + 100;
      frameIdx++;
      figma.ui.postMessage({
        type: "progress",
        current: frameIdx,
        total: totalCount,
      });
    }
  }

  // ── Phase 2: Branded mockup posts per platform ──
  if (platforms.length > 0 && applicableStyles.length > 0) {
    // Start a new row below raw mockups
    if (rowMaxH > 0) {
      curY += rowMaxH + 150;
    }
    xPos = 0;

    for (var pi = 0; pi < platforms.length; pi++) {
      var plat = platforms[pi];
      var pDims = MOCKUP_POST_PLATFORMS[plat];
      if (!pDims) continue;

      var isStory = pDims.h > pDims.w * 1.4; // tall format
      var platRowMaxH = 0;
      var platXPos = xPos;

      for (var si = 0; si < applicableStyles.length; si++) {
        var style = applicableStyles[si];
        // Skip story layout for landscape, skip non-story for stories
        if (style.forStory && !isStory) continue;
        if (!style.forStory && isStory) continue;

        // Resolve the device string to pass to the builder
        var devForBuild =
          style.device === "phone"
            ? "iphone"
            : style.device === "desktop"
              ? deskDev
              : deskDev; // dual builders use desktopStyle internally

        for (var tti = 0; tti < themes.length; tti++) {
          var isDark2 = themes[tti] === "dark";
          applyTheme(isDark2);
          var tSuffix2 =
            themes.length > 1 ? (isDark2 ? " (Dark)" : " (Light)") : "";

          var pFrame = figma.createFrame();
          pFrame.name =
            "Mockup Post \u2014 " + pDims.label + " " + style.label + tSuffix2;
          pFrame.resize(pDims.w, pDims.h);
          pFrame.x = platXPos;
          pFrame.y = curY;
          pFrame.fills = [{ type: "SOLID", color: C.bg }];
          pFrame.clipsContent = true;

          try {
            style.build(pFrame, pDims.w, pDims.h, deviceColor, devForBuild);
          } catch (err) {
            figma.ui.postMessage({
              type: "error",
              message:
                "Mockup post error (" +
                pDims.label +
                " " +
                style.label +
                "): " +
                (err instanceof Error ? err.message : String(err)),
            });
          }

          figma.currentPage.appendChild(pFrame);
          if (pDims.h > platRowMaxH) platRowMaxH = pDims.h;
          platXPos += pDims.w + 80;
          frameIdx++;
          figma.ui.postMessage({
            type: "progress",
            current: frameIdx,
            total: totalCount,
          });
        }
      }

      // Next platform on a new row
      curY += platRowMaxH + 120;
      platRowMaxH = 0;
    }
  }

  figma.ui.postMessage({
    type: "done",
    message:
      "Created " +
      frameIdx +
      " mockup(s). Drop your screenshots into the 'screen' layers.",
  });
}

// ══════════════════════════════════════════════════════════════
// TEMPLATE CREATOR
// ══════════════════════════════════════════════════════════════

type BuildFn = (frame: FrameNode, w: number, h: number) => void;

interface TemplateVariant {
  suffix: string;
  build: BuildFn;
  brandFrame?: boolean; // undefined = yes (default), false = skip brand frame
}

const SINGLE_STYLES: TemplateVariant[] = [
  { suffix: "Vertical Split", build: buildVerticalSplit },
  { suffix: "Typography Hero", build: buildTypographyHero },
  { suffix: "Circle Crop", build: buildCircleCrop },
  { suffix: "Horizontal Split", build: buildHorizontalSplit },
  { suffix: "Frame in Frame", build: buildFrameInFrame },
];

const CAROUSEL_SLIDES: TemplateVariant[] = [
  { suffix: "Carousel Cover", build: buildCarouselCover },
  { suffix: "Carousel Slide", build: buildCarouselSlide, brandFrame: false },
  { suffix: "Carousel CTA", build: buildCarouselCTA },
];

const IMAGE_STYLES: TemplateVariant[] = [
  { suffix: "Image Bottom", build: buildImageBottom },
  { suffix: "Image Top", build: buildImageTop },
  { suffix: "Image Full", build: buildImageFull },
];

const STATS_STYLES: TemplateVariant[] = [
  { suffix: "Big Stat", build: buildBigStat },
  { suffix: "Before-After", build: buildBeforeAfter },
  { suffix: "Stat Row", build: buildStatRow },
];

const VIDEO_STYLES: TemplateVariant[] = [
  { suffix: "Video Thumb", build: buildVideoThumb },
];
const QUOTE_STYLES: TemplateVariant[] = [
  { suffix: "Quote Card", build: buildQuoteCard },
];

const FULLPAGE_STYLES: TemplateVariant[] = [
  { suffix: "Editorial Overlay", build: buildEditorialOverlay },
  { suffix: "Magazine Cover", build: buildMagazineCover },
  { suffix: "Framed Photo", build: buildFramedPhoto },
];

const BOLDCOLOR_STYLES: TemplateVariant[] = [
  { suffix: "Bold Statement", build: buildBoldStatement },
  { suffix: "Color Announcement", build: buildColorAnnouncement },
  { suffix: "Color Stat", build: buildColorStat },
];

function isStandard(p: PlatformDef): boolean {
  const ratio = p.w / p.h;
  return ratio <= 4 && p.h / p.w <= 1.5 && p.w > 400;
}

async function createTemplates(
  platforms: string[],
  contentTypes: string[],
  brandFrame: boolean,
  themes: string[],
  bgPattern: string,
  bgDensity: string,
  qrImage?: number[],
  logoImageBytes?: number[],
  fullLogoImageBytes?: number[],
  patternImageBytes?: number[],
  patternSvgStr?: string,
): Promise<void> {
  // Load core Inter fonts (required)
  try {
    await Promise.all([
      figma.loadFontAsync(INTER_BOLD),
      figma.loadFontAsync(INTER_SEMI),
      figma.loadFontAsync(INTER_MED),
      figma.loadFontAsync(INTER_REG),
    ]);
    loadedFonts.add(fontKey(INTER_BOLD));
    loadedFonts.add(fontKey(INTER_SEMI));
    loadedFonts.add(fontKey(INTER_MED));
    loadedFonts.add(fontKey(INTER_REG));
  } catch {
    figma.ui.postMessage({
      type: "error",
      message: "Failed to load Inter font. Ensure Inter is available.",
    });
    return;
  }

  // Load display fonts independently — each falls back to Inter Bold on failure
  for (var di = 0; di < DISPLAY_FONTS.length; di++) {
    try {
      await figma.loadFontAsync(DISPLAY_FONTS[di]);
      loadedFonts.add(fontKey(DISPLAY_FONTS[di]));
    } catch {
      // Font not available — resolveFont() will return INTER_BOLD
    }
  }

  // Set background pattern and density (designer's global choice)
  activeBgPattern = bgPattern || "none";
  activeBgDensity = bgDensity || "medium";
  activePatternSvgStr = patternSvgStr || "";

  // Create custom pattern image if bytes provided
  if (patternImageBytes && patternImageBytes.length > 0) {
    customPatternImage = figma.createImage(new Uint8Array(patternImageBytes));
  } else {
    customPatternImage = null;
  }

  // Create logo Figma images if bytes provided
  let logoImg: Image | undefined;
  if (logoImageBytes && logoImageBytes.length > 0) {
    logoImg = figma.createImage(new Uint8Array(logoImageBytes));
    circleLogo = logoImg; // circle C icon for in-template brand placement
  } else {
    circleLogo = null;
  }
  // Full logo (wordmark + icon) for footer brand placement
  if (fullLogoImageBytes && fullLogoImageBytes.length > 0) {
    brandLogo = figma.createImage(new Uint8Array(fullLogoImageBytes));
  } else {
    brandLogo = null;
  }

  // Count total templates to create
  let totalCount = 0;
  for (const key of platforms) {
    const p = PLATFORMS[key];
    if (!p) continue;
    if (isStandard(p)) {
      if (contentTypes.indexOf("single") >= 0)
        totalCount += SINGLE_STYLES.length;
      if (contentTypes.indexOf("image") >= 0) totalCount += IMAGE_STYLES.length;
      if (contentTypes.indexOf("stats") >= 0) totalCount += STATS_STYLES.length;
      if (contentTypes.indexOf("video") >= 0) totalCount += VIDEO_STYLES.length;
      if (contentTypes.indexOf("quote") >= 0) totalCount += QUOTE_STYLES.length;
      if (contentTypes.indexOf("fullpage") >= 0)
        totalCount += FULLPAGE_STYLES.length;
      if (contentTypes.indexOf("boldcolor") >= 0)
        totalCount += BOLDCOLOR_STYLES.length;
    } else if (p.h / p.w > 1.5) {
      totalCount += 1; // story
    } else if (p.w <= 400) {
      totalCount += 1; // compact
    } else {
      totalCount += 1; // leaderboard
    }
  }
  // Carousel is platform-independent (always 1080x1080)
  if (contentTypes.indexOf("carousel") >= 0) {
    totalCount += CAROUSEL_SLIDES.length;
  }
  // Multiply by number of themes
  totalCount *= themes.length;

  const frames: SceneNode[] = [];
  // Start below any existing frames on the page (avoids overlap on re-generation)
  let yPos = 0;
  var existingNodes = figma.currentPage.children;
  for (var ei = 0; ei < existingNodes.length; ei++) {
    var nodeBottom = existingNodes[ei].y + existingNodes[ei].height;
    if (nodeBottom > yPos) yPos = nodeBottom;
  }
  if (yPos > 0) yPos += 120; // gap between batches
  const themeLabel = themes.length > 1;

  for (const theme of themes) {
    applyTheme(theme === "dark");
    const tSuffix = themeLabel
      ? theme === "dark"
        ? " \u2014 Dark"
        : " \u2014 Light"
      : "";

    for (const key of platforms) {
      const p = PLATFORMS[key];
      if (!p) continue;

      let xPos = 0;

      if (isStandard(p)) {
        const typesToBuild: TemplateVariant[][] = [];
        if (contentTypes.indexOf("single") >= 0)
          typesToBuild.push(SINGLE_STYLES);
        if (contentTypes.indexOf("image") >= 0) typesToBuild.push(IMAGE_STYLES);
        if (contentTypes.indexOf("stats") >= 0) typesToBuild.push(STATS_STYLES);
        if (contentTypes.indexOf("video") >= 0) typesToBuild.push(VIDEO_STYLES);
        if (contentTypes.indexOf("quote") >= 0) typesToBuild.push(QUOTE_STYLES);
        if (contentTypes.indexOf("fullpage") >= 0)
          typesToBuild.push(FULLPAGE_STYLES);
        if (contentTypes.indexOf("boldcolor") >= 0)
          typesToBuild.push(BOLDCOLOR_STYLES);

        for (const variants of typesToBuild) {
          for (const v of variants) {
            const useBrand = brandFrame && v.brandFrame !== false;
            const f = createFrame(
              p.w,
              p.h,
              `Commando360.ai \u2014 ${p.label} \u2014 ${v.suffix}${tSuffix}`,
              v.build,
              useBrand,
              logoImg,
            );
            f.x = xPos;
            f.y = yPos;
            figma.currentPage.appendChild(f);
            frames.push(f);
            xPos += p.w + 60;

            figma.ui.postMessage({
              type: "progress",
              current: frames.length,
              total: totalCount,
            });
          }
          xPos += 40;
        }
      } else {
        let buildFn: BuildFn;
        if (p.h / p.w > 1.5) {
          buildFn = buildStory;
        } else if (p.w <= 400) {
          buildFn = buildCompact;
        } else {
          buildFn = buildLeaderboard;
        }

        const f = createFrame(
          p.w,
          p.h,
          `Commando360.ai \u2014 ${p.label}${tSuffix}`,
          buildFn,
          brandFrame,
          logoImg,
        );
        f.x = xPos;
        f.y = yPos;
        figma.currentPage.appendChild(f);
        frames.push(f);

        figma.ui.postMessage({
          type: "progress",
          current: frames.length,
          total: totalCount,
        });
      }

      yPos += p.h + 80;
    }

    // Carousel (always 1080x1080, independent of platform)
    if (contentTypes.indexOf("carousel") >= 0) {
      let xPos = 0;
      for (const v of CAROUSEL_SLIDES) {
        const useBrand = brandFrame && v.brandFrame !== false;
        const f = createFrame(
          1080,
          1080,
          `Commando360.ai \u2014 ${v.suffix}${tSuffix}`,
          v.build,
          useBrand,
          logoImg,
        );
        f.x = xPos;
        f.y = yPos;
        figma.currentPage.appendChild(f);
        frames.push(f);
        xPos += 1080 + 60;

        figma.ui.postMessage({
          type: "progress",
          current: frames.length,
          total: totalCount,
        });
      }
      yPos += 1080 + 80;
    }
  }

  // Fill QR code placeholders with actual QR image
  if (qrImage && qrImage.length > 0) {
    const img = figma.createImage(new Uint8Array(qrImage));
    for (const f of frames) {
      const qrRect = (f as FrameNode).findOne(
        (n) => n.name === "qr-code" && n.type === "RECTANGLE",
      ) as RectangleNode | null;
      if (qrRect) {
        qrRect.fills = [
          { type: "IMAGE", imageHash: img.hash, scaleMode: "FILL" },
        ];
      }
    }
  }

  figma.currentPage.selection = frames;
  figma.viewport.scrollAndZoomIntoView(frames);

  figma.ui.postMessage({
    type: "done",
    message: `Created ${frames.length} template(s) across ${platforms.length} platform(s). Select any and use Generate tab.`,
  });
}

function createFrame(
  w: number,
  h: number,
  name: string,
  buildFn: BuildFn,
  brandFrame?: boolean,
  logoImage?: Image,
): FrameNode {
  const frame = figma.createFrame();
  frame.name = name;
  frame.resize(w, h);
  frame.fills = [solid(C.bg)];
  frame.clipsContent = true;

  if (brandFrame) {
    const cfg = getBrandFrameConfig(w, h);
    if (cfg.type !== "none") {
      const contentH = h - cfg.topH - cfg.footerH;
      const content = figma.createFrame();
      content.name = "content";
      content.resize(w, contentH);
      content.x = 0;
      content.y = cfg.topH;
      content.fills = [];
      content.clipsContent = true;
      frame.appendChild(content);

      buildFn(content, w, contentH);

      addTopAccentBar(frame, w);
      addBrandFooter(frame, w, h, cfg.footerH, logoImage);
      return frame;
    }
  }

  buildFn(frame, w, h);
  return frame;
}

// ══════════════════════════════════════════════════════════════
// BROCHURE PAGE SYSTEM
// ══════════════════════════════════════════════════════════════

// Dedicated brochure colors — does NOT mutate global C object
interface BrochureColors {
  bg: RGB;
  heading: RGB;
  body: RGB;
  subtext: RGB;
  accent: RGB;
  cardBg: RGB;
  cardBorder: RGB;
  darkCardBg: RGB;
  darkCardText: RGB;
  placeholderBg: RGB;
  placeholderBorder: RGB;
}

function getBrochureColors(dark: boolean): BrochureColors {
  if (dark) {
    return {
      bg: { r: 0.031, g: 0.035, b: 0.039 },
      heading: { r: 1, g: 1, b: 1 },
      body: { r: 0.702, g: 0.702, b: 0.722 },
      subtext: { r: 0.439, g: 0.439, b: 0.471 },
      accent: { r: 0.863, g: 0.137, b: 0.137 },
      cardBg: { r: 0.067, g: 0.071, b: 0.078 },
      cardBorder: { r: 0.133, g: 0.133, b: 0.133 },
      darkCardBg: { r: 0.102, g: 0.102, b: 0.118 },
      darkCardText: { r: 1, g: 1, b: 1 },
      placeholderBg: { r: 0.102, g: 0.106, b: 0.118 },
      placeholderBorder: { r: 0.2, g: 0.2, b: 0.2 },
    };
  }
  return {
    bg: { r: 1, g: 1, b: 1 },
    heading: { r: 0.078, g: 0.078, b: 0.086 },
    body: { r: 0.294, g: 0.294, b: 0.322 },
    subtext: { r: 0.541, g: 0.541, b: 0.576 },
    accent: { r: 0.863, g: 0.137, b: 0.137 },
    cardBg: { r: 0.961, g: 0.961, b: 0.969 },
    cardBorder: { r: 0.91, g: 0.91, b: 0.925 },
    darkCardBg: { r: 0.102, g: 0.106, b: 0.118 },
    darkCardText: { r: 1, g: 1, b: 1 },
    placeholderBg: { r: 0.941, g: 0.941, b: 0.953 },
    placeholderBorder: { r: 0.8, g: 0.8, b: 0.8 },
  };
}

var BROCHURE_RESOLUTIONS: Record<
  string,
  { w: number; h: number; label: string }
> = {
  digital: { w: 794, h: 1123, label: "Digital (72dpi)" },
  "high-res": { w: 1587, h: 2245, label: "High-Res (150dpi)" },
  print: { w: 2480, h: 3508, label: "Print (300dpi)" },
};

// ── Brochure Helpers ─────────────────────────────────────────

// Proportional constants for consistent brochure design
var B = {
  PHONE_RATIO: 2.08, // iPhone 15 Pro h/w ratio
  LAPTOP_RATIO: 0.625, // 16:10 laptop h/w ratio
  MARGIN: 0.06, // page margin as fraction of w
  ICON_SIZE: 0.035, // icon circle diameter as fraction of w
  CARD_RADIUS: 0.015, // card corner radius as fraction of w
  TITLE_SIZE: 0.048, // main title font size as fraction of w
  SUBTITLE_SIZE: 0.015, // subtitle font size as fraction of w
  FEAT_TITLE: 0.018, // feature item title size as fraction of w
  BODY_SIZE: 0.014, // body text size as fraction of w
  DARK_BG: { r: 0.102, g: 0.106, b: 0.118 } as RGB,
  DARK_CARD: { r: 0.14, g: 0.145, b: 0.16 } as RGB,
  LIGHT_GRAY: { r: 0.65, g: 0.65, b: 0.67 } as RGB,
};

function addBrochureBlock(
  parent: FrameNode,
  name: string,
  w: number,
  h: number,
  x: number,
  y: number,
  color: RGB,
  radius?: number,
): FrameNode {
  var block = figma.createFrame();
  block.name = name;
  block.resize(w, h);
  block.x = x;
  block.y = y;
  block.fills = [solid(color)];
  if (radius) block.cornerRadius = radius;
  block.clipsContent = false;
  parent.appendChild(block);
  return block;
}

function addBrochurePlaceholder(
  parent: FrameNode,
  name: string,
  w: number,
  h: number,
  x: number,
  y: number,
  bc: BrochureColors,
  radius?: number,
): FrameNode {
  var ph = figma.createFrame();
  ph.name = name;
  ph.resize(w, h);
  ph.x = x;
  ph.y = y;
  ph.fills = [solid(bc.placeholderBg)];
  if (radius) ph.cornerRadius = radius;
  ph.clipsContent = true;
  ph.strokes = [solid(bc.placeholderBorder, 0.5)];
  ph.strokeWeight = 1;
  ph.dashPattern = [8, 4];
  var phText = figma.createText();
  phText.fontName = INTER_REG;
  phText.fontSize = Math.max(10, Math.round(w * 0.028));
  phText.fills = [solid(bc.subtext, 0.4)];
  phText.characters = "Drop image here";
  phText.name = "placeholder-hint";
  phText.x = Math.round((w - phText.width) / 2);
  phText.y = Math.round((h - phText.height) / 2);
  ph.appendChild(phText);
  parent.appendChild(ph);
  return ph;
}

function addPhoneFrame(
  parent: FrameNode,
  name: string,
  phoneW: number,
  x: number,
  y: number,
  bc: BrochureColors,
  dark?: boolean,
): FrameNode {
  var phoneH = Math.round(phoneW * B.PHONE_RATIO);
  var bezel = Math.round(phoneW * 0.035);
  var radius = Math.round(phoneW * 0.13);
  var shellColor =
    dark !== false
      ? { r: 0.1, g: 0.1, b: 0.12 }
      : { r: 0.85, g: 0.86, b: 0.88 };
  var phone = figma.createFrame();
  phone.name = name + "-device";
  phone.resize(phoneW, phoneH);
  phone.x = x;
  phone.y = y;
  phone.fills = [solid(shellColor)];
  phone.cornerRadius = radius;
  phone.clipsContent = true;
  phone.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.18 },
      offset: { x: 0, y: 4 },
      radius: 16,
      spread: 0,
      visible: true,
      blendMode: "NORMAL",
    } as DropShadowEffect,
  ];
  // Screen area
  var screen = figma.createFrame();
  screen.name = name;
  screen.resize(phoneW - bezel * 2, phoneH - bezel * 2);
  screen.x = bezel;
  screen.y = bezel;
  screen.fills = [solid(bc.placeholderBg)];
  screen.cornerRadius = Math.round(radius * 0.7);
  screen.clipsContent = true;
  var scrText = figma.createText();
  scrText.fontName = INTER_REG;
  scrText.fontSize = Math.max(9, Math.round(phoneW * 0.035));
  scrText.fills = [solid(bc.subtext, 0.35)];
  scrText.characters = "Drop screenshot";
  scrText.name = "placeholder-hint";
  scrText.x = Math.round((screen.width - scrText.width) / 2);
  scrText.y = Math.round((screen.height - scrText.height) / 2);
  screen.appendChild(scrText);
  phone.appendChild(screen);
  parent.appendChild(phone);
  return phone;
}

function addLaptopFrame(
  parent: FrameNode,
  name: string,
  laptopW: number,
  x: number,
  y: number,
  bc: BrochureColors,
  dark?: boolean,
): FrameNode {
  var laptopH = Math.round(laptopW * B.LAPTOP_RATIO);
  var bezel = Math.round(laptopW * 0.012);
  var radius = Math.round(laptopW * 0.015);
  var shellColor =
    dark !== false
      ? { r: 0.1, g: 0.1, b: 0.12 }
      : { r: 0.82, g: 0.83, b: 0.85 };
  var laptop = figma.createFrame();
  laptop.name = name + "-device";
  laptop.resize(laptopW, laptopH);
  laptop.x = x;
  laptop.y = y;
  laptop.fills = [solid(shellColor)];
  laptop.cornerRadius = radius;
  laptop.clipsContent = true;
  laptop.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.15 },
      offset: { x: 0, y: 4 },
      radius: 14,
      spread: 0,
      visible: true,
      blendMode: "NORMAL",
    } as DropShadowEffect,
  ];
  // Screen area
  var screen = figma.createFrame();
  screen.name = name;
  screen.resize(laptopW - bezel * 2, laptopH - bezel * 2);
  screen.x = bezel;
  screen.y = bezel;
  screen.fills = [solid(bc.placeholderBg)];
  screen.clipsContent = true;
  var scrText = figma.createText();
  scrText.fontName = INTER_REG;
  scrText.fontSize = Math.max(9, Math.round(laptopW * 0.016));
  scrText.fills = [solid(bc.subtext, 0.35)];
  scrText.characters = "Drop screenshot";
  scrText.name = "placeholder-hint";
  scrText.x = Math.round((screen.width - scrText.width) / 2);
  scrText.y = Math.round((screen.height - scrText.height) / 2);
  screen.appendChild(scrText);
  laptop.appendChild(screen);
  parent.appendChild(laptop);
  return laptop;
}

function addBrochureIconCircle(
  parent: FrameNode,
  size: number,
  x: number,
  y: number,
  bc: BrochureColors,
  filled?: boolean,
): EllipseNode {
  var e = figma.createEllipse();
  e.name = "icon-circle";
  e.resize(size, size);
  e.x = x;
  e.y = y;
  if (filled !== false) {
    e.fills = [solid(bc.accent)];
  } else {
    e.fills = [solid(bc.accent, 0.12)];
    e.strokes = [solid(bc.accent, 0.3)];
    e.strokeWeight = 1;
  }
  parent.appendChild(e);
  return e;
}

function addBrochureDarkCard(
  parent: FrameNode,
  name: string,
  w: number,
  h: number,
  x: number,
  y: number,
  radius: number,
): FrameNode {
  var card = figma.createFrame();
  card.name = name;
  card.resize(w, h);
  card.x = x;
  card.y = y;
  card.fills = [solid(B.DARK_CARD)];
  card.cornerRadius = radius;
  card.clipsContent = true;
  card.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.1 },
      offset: { x: 0, y: 1 },
      radius: 3,
      spread: 0,
      visible: true,
      blendMode: "NORMAL",
    } as DropShadowEffect,
  ];
  parent.appendChild(card);
  return card;
}

// Convenience: icon circle + title + description, returns height consumed
function addBrochureFeatureItem(
  parent: FrameNode,
  index: number,
  x: number,
  y: number,
  maxW: number,
  titleText: string,
  descText: string,
  bc: BrochureColors,
  w: number, // page width for proportional sizing
  opts?: { darkBg?: boolean },
): number {
  var iconSize = Math.round(w * B.ICON_SIZE);
  var titleColor = opts && opts.darkBg ? FIXED_WHITE : bc.heading;
  var descColor = opts && opts.darkBg ? B.LIGHT_GRAY : bc.body;
  addBrochureIconCircle(parent, iconSize, x, y, bc, true);
  var textX = x + iconSize + Math.round(w * 0.015);
  var textW = maxW - iconSize - Math.round(w * 0.015);
  addText(
    parent,
    "icon-" + index + "-title",
    titleText,
    INTER_SEMI,
    Math.round(w * B.FEAT_TITLE),
    titleColor,
    textX,
    y + Math.round(iconSize * 0.05),
    { maxWidth: textW },
  );
  var descNode = addText(
    parent,
    "icon-" + index + "-desc",
    descText,
    INTER_REG,
    Math.round(w * B.BODY_SIZE),
    descColor,
    textX,
    y + Math.round(w * B.FEAT_TITLE) + Math.round(iconSize * 0.15),
    { maxWidth: textW, lineHeight: 150 },
  );
  return (
    iconSize +
    Math.round(w * B.FEAT_TITLE) +
    descNode.height +
    Math.round(w * 0.01)
  );
}

// ══════════════════════════════════════════════════════════════
// BROCHURE LAYOUTS — Pattern 1: Title + Icons + Dark Screenshot Zone
// ══════════════════════════════════════════════════════════════

function buildBrochureHeroFeature(
  frame: FrameNode,
  w: number,
  h: number,
  bc: BrochureColors,
): void {
  var margin = Math.round(w * B.MARGIN);
  var contentW = w - margin * 2;

  // Red accent bar
  addRect(
    frame,
    "accent-bar",
    w,
    Math.round(h * 0.005),
    0,
    0,
    solid(bc.accent),
  );

  // Title
  addText(
    frame,
    "title",
    "FEATURE TITLE",
    resolveFont(BEBAS),
    Math.round(w * B.TITLE_SIZE),
    bc.heading,
    margin,
    Math.round(h * 0.03),
    { maxWidth: contentW, align: "CENTER", letterSpacing: 3 },
  );

  // Subtitle
  addText(
    frame,
    "subtitle",
    "Manage your operations with clarity, control, and confidence.",
    INTER_REG,
    Math.round(w * B.SUBTITLE_SIZE),
    bc.subtext,
    margin,
    Math.round(h * 0.08),
    { maxWidth: contentW, align: "CENTER" },
  );

  // 2x2 icon grid
  var gridY = Math.round(h * 0.13);
  var colW = Math.round(contentW * 0.46);
  var col1X = margin;
  var col2X = margin + Math.round(contentW * 0.54);
  var rowGap = Math.round(h * 0.11);

  var featureTitles = [
    "Core Feature One",
    "Core Feature Two",
    "Core Feature Three",
    "Core Feature Four",
  ];
  var featureDescs = [
    "Brief description of this capability and its value to operations.",
    "Brief description of this capability and its value to operations.",
    "Brief description of this capability and its value to operations.",
    "Brief description of this capability and its value to operations.",
  ];

  for (var fi = 0; fi < 4; fi++) {
    var fCol = fi % 2 === 0 ? col1X : col2X;
    var fRow = Math.floor(fi / 2);
    addBrochureFeatureItem(
      frame,
      fi + 1,
      fCol,
      gridY + fRow * rowGap,
      colW,
      featureTitles[fi],
      featureDescs[fi],
      bc,
      w,
    );
  }

  // Dark block — sharp edge, bottom 55%
  var darkY = Math.round(h * 0.42);
  var darkH = h - darkY;
  addBrochureBlock(frame, "dark-zone", w, darkH, 0, darkY, B.DARK_BG);

  // Laptop frame — in the dark zone
  var laptopW = Math.round(w * 0.55);
  var laptopX = Math.round(margin * 0.8);
  var laptopY = darkY + Math.round(darkH * 0.06);
  addLaptopFrame(frame, "image-area", laptopW, laptopX, laptopY, bc);

  // Phone frame — overlapping laptop on right
  var phoneW = Math.round(w * 0.18);
  var phoneH = Math.round(phoneW * B.PHONE_RATIO);
  var phoneX = laptopX + laptopW - Math.round(phoneW * 0.3);
  var phoneY = darkY + Math.round(darkH * 0.12);
  addPhoneFrame(frame, "image-area-2", phoneW, phoneX, phoneY, bc);

  // Additional feature callouts in dark zone
  var calloutY = darkY + Math.round(darkH * 0.65);
  var calloutX = margin;
  addBrochureFeatureItem(
    frame,
    5,
    calloutX,
    calloutY,
    Math.round(contentW * 0.45),
    "Additional Feature",
    "Capture performance data through structured field surveys.",
    bc,
    w,
    { darkBg: true },
  );

  addBrochureFeatureItem(
    frame,
    6,
    margin + Math.round(contentW * 0.54),
    calloutY,
    Math.round(contentW * 0.45),
    "Another Feature",
    "Digital verification with QR codes and controlled access.",
    bc,
    w,
    { darkBg: true },
  );
}

function buildBrochureSplitLeft(
  frame: FrameNode,
  w: number,
  h: number,
  bc: BrochureColors,
): void {
  var margin = Math.round(w * B.MARGIN);

  // Red accent bar
  addRect(
    frame,
    "accent-bar",
    w,
    Math.round(h * 0.005),
    0,
    0,
    solid(bc.accent),
  );

  // Dark block on left — 52% wide
  var darkW = Math.round(w * 0.52);
  var darkY = Math.round(h * 0.04);
  var darkH = h - darkY * 2;
  addBrochureBlock(frame, "dark-zone", darkW, darkH, 0, darkY, B.DARK_BG);

  // Laptop in dark zone
  var laptopW = Math.round(darkW * 0.78);
  var laptopH = Math.round(laptopW * B.LAPTOP_RATIO);
  var laptopX = Math.round((darkW - laptopW) / 2);
  var laptopY = darkY + Math.round(darkH * 0.08);
  addLaptopFrame(frame, "image-area", laptopW, laptopX, laptopY, bc);

  // Phone in dark zone — bottom right
  var phoneW = Math.round(w * 0.13);
  var phoneH = Math.round(phoneW * B.PHONE_RATIO);
  var phoneX = darkW - Math.round(phoneW * 1.1);
  var phoneY = laptopY + laptopH + Math.round(darkH * 0.04);
  addPhoneFrame(frame, "image-area-2", phoneW, phoneX, phoneY, bc);

  // Right side — text content
  var textX = darkW + Math.round(w * 0.04);
  var textW = w - textX - margin;
  var textY = Math.round(h * 0.08);

  // Title
  addText(
    frame,
    "title",
    "FEATURE TITLE",
    resolveFont(BEBAS),
    Math.round(w * B.TITLE_SIZE),
    bc.heading,
    textX,
    textY,
    { maxWidth: textW, letterSpacing: 3 },
  );

  // Red accent line
  addRect(
    frame,
    "accent-line",
    Math.round(w * 0.08),
    3,
    textX,
    textY + Math.round(w * B.TITLE_SIZE) + Math.round(h * 0.015),
    solid(bc.accent),
  );

  // Subtitle
  addText(
    frame,
    "subtitle",
    "Brief description of what this feature does.",
    INTER_REG,
    Math.round(w * B.SUBTITLE_SIZE),
    bc.body,
    textX,
    textY + Math.round(w * B.TITLE_SIZE) + Math.round(h * 0.04),
    { maxWidth: textW, lineHeight: 150 },
  );

  // 3 feature items stacked
  var itemY = textY + Math.round(h * 0.18);
  var itemGap = Math.round(h * 0.14);
  var items = [
    {
      t: "Key Capability One",
      d: "Maintain complete information for every team member.",
    },
    {
      t: "Key Capability Two",
      d: "Track verification, compliance documents, automated reminders.",
    },
    {
      t: "Key Capability Three",
      d: "Securely maintain details for administrative purposes.",
    },
  ];
  for (var ii = 0; ii < items.length; ii++) {
    addBrochureFeatureItem(
      frame,
      ii + 1,
      textX,
      itemY + ii * itemGap,
      textW,
      items[ii].t,
      items[ii].d,
      bc,
      w,
    );
  }
}

function buildBrochureSplitRight(
  frame: FrameNode,
  w: number,
  h: number,
  bc: BrochureColors,
): void {
  var margin = Math.round(w * B.MARGIN);

  // Red accent bar
  addRect(
    frame,
    "accent-bar",
    w,
    Math.round(h * 0.005),
    0,
    0,
    solid(bc.accent),
  );

  // Right dark block — 52% wide
  var darkW = Math.round(w * 0.52);
  var darkX = w - darkW;
  var darkY = Math.round(h * 0.04);
  var darkH = h - darkY * 2;
  addBrochureBlock(frame, "dark-zone", darkW, darkH, darkX, darkY, B.DARK_BG);

  // Laptop in dark zone
  var laptopW = Math.round(darkW * 0.78);
  var laptopX = darkX + Math.round((darkW - laptopW) / 2);
  var laptopY = darkY + Math.round(darkH * 0.08);
  addLaptopFrame(frame, "image-area", laptopW, laptopX, laptopY, bc);

  // Phone in dark zone — bottom left
  var phoneW = Math.round(w * 0.13);
  var phoneX = darkX + Math.round(phoneW * 0.3);
  var phoneY =
    laptopY + Math.round(laptopW * B.LAPTOP_RATIO) + Math.round(darkH * 0.04);
  addPhoneFrame(frame, "image-area-2", phoneW, phoneX, phoneY, bc);

  // Left side — text content
  var textX = margin;
  var textW = darkX - margin - Math.round(w * 0.04);
  var textY = Math.round(h * 0.08);

  addText(
    frame,
    "title",
    "FEATURE TITLE",
    resolveFont(BEBAS),
    Math.round(w * B.TITLE_SIZE),
    bc.heading,
    textX,
    textY,
    { maxWidth: textW, letterSpacing: 3 },
  );
  addRect(
    frame,
    "accent-line",
    Math.round(w * 0.08),
    3,
    textX,
    textY + Math.round(w * B.TITLE_SIZE) + Math.round(h * 0.015),
    solid(bc.accent),
  );
  addText(
    frame,
    "subtitle",
    "Brief description of what this feature does.",
    INTER_REG,
    Math.round(w * B.SUBTITLE_SIZE),
    bc.body,
    textX,
    textY + Math.round(w * B.TITLE_SIZE) + Math.round(h * 0.04),
    { maxWidth: textW, lineHeight: 150 },
  );

  var itemY = textY + Math.round(h * 0.18);
  var itemGap = Math.round(h * 0.14);
  var items = [
    {
      t: "Key Capability One",
      d: "Maintain complete information for every team member.",
    },
    {
      t: "Key Capability Two",
      d: "Track verification, compliance documents, automated reminders.",
    },
    {
      t: "Key Capability Three",
      d: "Securely maintain details for administrative purposes.",
    },
  ];
  for (var ii = 0; ii < items.length; ii++) {
    addBrochureFeatureItem(
      frame,
      ii + 1,
      textX,
      itemY + ii * itemGap,
      textW,
      items[ii].t,
      items[ii].d,
      bc,
      w,
    );
  }
}

function buildBrochureDualDevice(
  frame: FrameNode,
  w: number,
  h: number,
  bc: BrochureColors,
): void {
  var margin = Math.round(w * B.MARGIN);
  var contentW = w - margin * 2;

  // Red accent bar
  addRect(
    frame,
    "accent-bar",
    w,
    Math.round(h * 0.005),
    0,
    0,
    solid(bc.accent),
  );

  // Title + subtitle + description in white zone
  addText(
    frame,
    "title",
    "FEATURE TITLE",
    resolveFont(BEBAS),
    Math.round(w * B.TITLE_SIZE),
    bc.heading,
    margin,
    Math.round(h * 0.03),
    { maxWidth: contentW, align: "CENTER", letterSpacing: 3 },
  );
  addText(
    frame,
    "subtitle",
    "A brief tagline for this feature.",
    INTER_MED,
    Math.round(w * B.SUBTITLE_SIZE * 1.1),
    bc.subtext,
    margin,
    Math.round(h * 0.085),
    { maxWidth: contentW, align: "CENTER" },
  );
  addText(
    frame,
    "description",
    "Detailed description of the feature and how it transforms operations. This gives context for the screenshots below.",
    INTER_REG,
    Math.round(w * B.BODY_SIZE),
    bc.body,
    Math.round(w * 0.12),
    Math.round(h * 0.13),
    { maxWidth: Math.round(w * 0.76), align: "CENTER", lineHeight: 160 },
  );

  // Dark block — bottom 58%, sharp edge
  var darkY = Math.round(h * 0.4);
  addBrochureBlock(frame, "dark-zone", w, h - darkY, 0, darkY, B.DARK_BG);

  // Laptop — overlapping white/dark boundary
  var laptopW = Math.round(w * 0.6);
  var laptopH = Math.round(laptopW * B.LAPTOP_RATIO);
  var laptopX = Math.round((w - laptopW) / 2) - Math.round(w * 0.06);
  var laptopY = darkY - Math.round(laptopH * 0.25);
  addLaptopFrame(frame, "image-area", laptopW, laptopX, laptopY, bc);

  // Phone — overlapping laptop right side
  var phoneW = Math.round(w * 0.17);
  var phoneH = Math.round(phoneW * B.PHONE_RATIO);
  var phoneX = laptopX + laptopW - Math.round(phoneW * 0.15);
  var phoneY = darkY + Math.round(h * 0.05);
  addPhoneFrame(frame, "image-area-2", phoneW, phoneX, phoneY, bc);
}

// ══════════════════════════════════════════════════════════════
// BROCHURE LAYOUTS — Pattern 2: Flowing Sections with Devices
// ══════════════════════════════════════════════════════════════

function buildBrochurePhoneBullets(
  frame: FrameNode,
  w: number,
  h: number,
  bc: BrochureColors,
): void {
  var margin = Math.round(w * B.MARGIN);
  var contentW = w - margin * 2;

  // Red accent bar
  addRect(
    frame,
    "accent-bar",
    w,
    Math.round(h * 0.005),
    0,
    0,
    solid(bc.accent),
  );

  // Title — left aligned
  addText(
    frame,
    "title",
    "FEATURE TITLE",
    resolveFont(BEBAS),
    Math.round(w * B.TITLE_SIZE),
    bc.heading,
    margin,
    Math.round(h * 0.03),
    { maxWidth: Math.round(contentW * 0.5), letterSpacing: 3 },
  );

  // 3 feature items on left
  var itemY = Math.round(h * 0.1);
  var itemGap = Math.round(h * 0.1);
  var leftItems = [
    {
      t: "AI-Driven Detection",
      d: "Detect risks and anomalies automatically.",
    },
    {
      t: "Smart Cameras",
      d: "Real-time fire, smoke, and intrusion detection.",
    },
    { t: "IoT Sensors", d: "Perimeter and environmental monitoring alerts." },
  ];
  for (var li = 0; li < leftItems.length; li++) {
    addBrochureFeatureItem(
      frame,
      li + 1,
      margin,
      itemY + li * itemGap,
      Math.round(contentW * 0.42),
      leftItems[li].t,
      leftItems[li].d,
      bc,
      w,
    );
  }

  // Phone frame floating on right alongside the bullets
  var phoneW = Math.round(w * 0.22);
  var phoneH = Math.round(phoneW * B.PHONE_RATIO);
  var phoneX = w - margin - phoneW;
  var phoneY = Math.round(h * 0.06);
  addPhoneFrame(frame, "image-area", phoneW, phoneX, phoneY, bc);

  // Subtitle section — mid page
  addText(
    frame,
    "subtitle",
    "Visitor Management",
    resolveFont(BEBAS),
    Math.round(w * 0.03),
    bc.heading,
    Math.round(w * 0.48),
    Math.round(h * 0.42),
    { maxWidth: Math.round(contentW * 0.45), letterSpacing: 2 },
  );

  // 3 more bullet items on right side
  var rightY = Math.round(h * 0.47);
  var rightItems = [
    { t: "OTP-Based Entry", d: "Pre-approvals and walk-in management." },
    { t: "Digital Visitor Logs", d: "Photos, audit trails, complete records." },
    { t: "Entry Time Tracking", d: "Complete visibility on approvals." },
  ];
  for (var ri = 0; ri < rightItems.length; ri++) {
    addBrochureFeatureItem(
      frame,
      ri + 4,
      Math.round(w * 0.48),
      rightY + ri * Math.round(h * 0.08),
      Math.round(contentW * 0.45),
      rightItems[ri].t,
      rightItems[ri].d,
      bc,
      w,
    );
  }

  // Dark block — bottom 30%
  var darkY = Math.round(h * 0.7);
  addBrochureBlock(frame, "dark-zone", w, h - darkY, 0, darkY, B.DARK_BG);

  // Title in dark zone
  addText(
    frame,
    "description",
    "Real-Time Visibility Unified",
    resolveFont(BEBAS),
    Math.round(w * 0.03),
    FIXED_WHITE,
    margin,
    darkY + Math.round(h * 0.03),
    { maxWidth: Math.round(contentW * 0.4), letterSpacing: 2 },
  );

  // Bullets in dark zone
  var darkBullets = [
    "Multi-site, multi-region access",
    "One live dashboard for all operations",
    "Real-time attendance and tracking",
  ];
  for (var db = 0; db < darkBullets.length; db++) {
    addEllipse(
      frame,
      "bullet-dot",
      Math.round(w * 0.006),
      Math.round(w * 0.006),
      margin,
      darkY + Math.round(h * 0.08) + db * Math.round(h * 0.03),
      solid(bc.accent),
    );
    addText(
      frame,
      "bullet-" + (db + 1),
      darkBullets[db],
      INTER_REG,
      Math.round(w * B.BODY_SIZE),
      FIXED_WHITE,
      margin + Math.round(w * 0.015),
      darkY + Math.round(h * 0.076) + db * Math.round(h * 0.03),
      { maxWidth: Math.round(contentW * 0.38), opacity: 0.85 },
    );
  }

  // Laptop in dark zone — right side
  var darkLaptopW = Math.round(w * 0.48);
  addLaptopFrame(
    frame,
    "image-area-2",
    darkLaptopW,
    w - margin - darkLaptopW,
    darkY + Math.round(h * 0.04),
    bc,
  );
}

function buildBrochureFeatureStack(
  frame: FrameNode,
  w: number,
  h: number,
  bc: BrochureColors,
): void {
  var margin = Math.round(w * B.MARGIN);
  var contentW = w - margin * 2;
  var rowH = Math.round(h * 0.3);
  var dividerH = 1;
  var accentBarH = Math.round(h * 0.005);

  // Red accent bar
  addRect(frame, "accent-bar", w, accentBarH, 0, 0, solid(bc.accent));

  // Row 1 — White bg: text left, laptop right
  var r1Y = accentBarH + Math.round(h * 0.02);
  addText(
    frame,
    "feature-1-title",
    "Feature One",
    resolveFont(BEBAS),
    Math.round(w * 0.032),
    bc.heading,
    margin,
    r1Y + Math.round(rowH * 0.12),
    { maxWidth: Math.round(contentW * 0.38), letterSpacing: 2 },
  );
  addText(
    frame,
    "feature-1-desc",
    "A detailed description of this feature, explaining how it improves security operations and provides real-time visibility.",
    INTER_REG,
    Math.round(w * B.BODY_SIZE),
    bc.body,
    margin,
    r1Y + Math.round(rowH * 0.3),
    { maxWidth: Math.round(contentW * 0.38), lineHeight: 155 },
  );
  addBrochureIconCircle(
    frame,
    Math.round(w * B.ICON_SIZE),
    margin,
    r1Y + Math.round(rowH * 0.62),
    bc,
    true,
  );
  var laptopW1 = Math.round(contentW * 0.5);
  addLaptopFrame(
    frame,
    "image-area-1",
    laptopW1,
    w - margin - laptopW1,
    r1Y + Math.round(rowH * 0.08),
    bc,
  );

  // Divider
  addRect(
    frame,
    "divider-1",
    contentW,
    dividerH,
    margin,
    r1Y + rowH,
    solid(bc.cardBorder),
  );

  // Row 2 — Light tint bg: phone left, text right
  var r2Y = r1Y + rowH + Math.round(h * 0.01);
  addRect(frame, "tint-bg", w, rowH, 0, r2Y, solid(bc.cardBg));
  var phoneW2 = Math.round(w * 0.17);
  addPhoneFrame(
    frame,
    "image-area-2",
    phoneW2,
    margin + Math.round(contentW * 0.04),
    r2Y + Math.round(rowH * 0.06),
    bc,
  );
  addText(
    frame,
    "feature-2-title",
    "Feature Two",
    resolveFont(BEBAS),
    Math.round(w * 0.032),
    bc.heading,
    Math.round(w * 0.38),
    r2Y + Math.round(rowH * 0.12),
    { maxWidth: Math.round(contentW * 0.5), letterSpacing: 2 },
  );
  addText(
    frame,
    "feature-2-desc",
    "Explanation of how this feature streamlines visitor management and provides digital audit trails.",
    INTER_REG,
    Math.round(w * B.BODY_SIZE),
    bc.body,
    Math.round(w * 0.38),
    r2Y + Math.round(rowH * 0.3),
    { maxWidth: Math.round(contentW * 0.5), lineHeight: 155 },
  );
  addBrochureIconCircle(
    frame,
    Math.round(w * B.ICON_SIZE),
    Math.round(w * 0.38),
    r2Y + Math.round(rowH * 0.62),
    bc,
    true,
  );

  // Divider
  addRect(
    frame,
    "divider-2",
    contentW,
    dividerH,
    margin,
    r2Y + rowH,
    solid(bc.cardBorder),
  );

  // Row 3 — Dark bg: text left, devices right
  var r3Y = r2Y + rowH + Math.round(h * 0.01);
  addBrochureBlock(frame, "dark-row", w, rowH, 0, r3Y, B.DARK_BG);
  addText(
    frame,
    "feature-3-title",
    "Feature Three",
    resolveFont(BEBAS),
    Math.round(w * 0.032),
    FIXED_WHITE,
    margin,
    r3Y + Math.round(rowH * 0.12),
    { maxWidth: Math.round(contentW * 0.38), letterSpacing: 2 },
  );
  addText(
    frame,
    "feature-3-desc",
    "How this capability provides unified real-time visibility across all sites and operations.",
    INTER_REG,
    Math.round(w * B.BODY_SIZE),
    B.LIGHT_GRAY,
    margin,
    r3Y + Math.round(rowH * 0.3),
    { maxWidth: Math.round(contentW * 0.38), lineHeight: 155 },
  );
  addBrochureIconCircle(
    frame,
    Math.round(w * B.ICON_SIZE),
    margin,
    r3Y + Math.round(rowH * 0.62),
    bc,
    true,
  );
  var laptopW3 = Math.round(contentW * 0.42);
  addLaptopFrame(
    frame,
    "image-area-3",
    laptopW3,
    w - margin - laptopW3,
    r3Y + Math.round(rowH * 0.08),
    bc,
  );
}

function buildBrochureScreenshotGallery(
  frame: FrameNode,
  w: number,
  h: number,
  bc: BrochureColors,
): void {
  var margin = Math.round(w * B.MARGIN);
  var contentW = w - margin * 2;

  // Red accent bar
  addRect(
    frame,
    "accent-bar",
    w,
    Math.round(h * 0.005),
    0,
    0,
    solid(bc.accent),
  );

  // Title + subtitle
  addText(
    frame,
    "title",
    "FEATURE TITLE",
    resolveFont(BEBAS),
    Math.round(w * B.TITLE_SIZE),
    bc.heading,
    margin,
    Math.round(h * 0.03),
    { maxWidth: contentW, align: "CENTER", letterSpacing: 3 },
  );
  addText(
    frame,
    "subtitle",
    "See the platform in action across multiple views.",
    INTER_REG,
    Math.round(w * B.SUBTITLE_SIZE),
    bc.subtext,
    margin,
    Math.round(h * 0.085),
    { maxWidth: contentW, align: "CENTER" },
  );

  // Dark block — bottom 72%
  var darkY = Math.round(h * 0.14);
  addBrochureBlock(frame, "dark-zone", w, h - darkY, 0, darkY, B.DARK_BG);

  // Large laptop — top left, overlapping white/dark boundary
  var mainLaptopW = Math.round(w * 0.54);
  addLaptopFrame(
    frame,
    "image-area-1",
    mainLaptopW,
    margin,
    darkY - Math.round(h * 0.02),
    bc,
  );

  // Phone — top right, partially overlapping laptop
  var phoneW = Math.round(w * 0.18);
  var phoneX = margin + mainLaptopW - Math.round(phoneW * 0.1);
  addPhoneFrame(
    frame,
    "image-area-2",
    phoneW,
    phoneX,
    darkY + Math.round(h * 0.04),
    bc,
  );

  // Small laptop — bottom center
  var smallLaptopW = Math.round(w * 0.42);
  var smallLaptopX = Math.round((w - smallLaptopW) / 2);
  var smallLaptopY = darkY + Math.round(h * 0.48);
  addLaptopFrame(
    frame,
    "image-area-3",
    smallLaptopW,
    smallLaptopX,
    smallLaptopY,
    bc,
  );
}

function buildBrochureStatsBanner(
  frame: FrameNode,
  w: number,
  h: number,
  bc: BrochureColors,
): void {
  var margin = Math.round(w * B.MARGIN);
  var contentW = w - margin * 2;

  // Red accent bar
  addRect(
    frame,
    "accent-bar",
    w,
    Math.round(h * 0.005),
    0,
    0,
    solid(bc.accent),
  );

  // Title
  addText(
    frame,
    "title",
    "BY THE NUMBERS",
    resolveFont(BEBAS),
    Math.round(w * B.TITLE_SIZE),
    bc.heading,
    margin,
    Math.round(h * 0.03),
    { maxWidth: contentW, align: "CENTER", letterSpacing: 3 },
  );

  // Red stats banner
  var bannerW = Math.round(w * 0.88);
  var bannerH = Math.round(h * 0.1);
  var bannerX = Math.round((w - bannerW) / 2);
  var bannerY = Math.round(h * 0.1);
  var bannerRadius = Math.round(bannerH * 0.15);
  addRect(
    frame,
    "stats-banner",
    bannerW,
    bannerH,
    bannerX,
    bannerY,
    solid(bc.accent),
    bannerRadius,
  );

  // 4 stats on banner
  var statW = Math.round(bannerW / 4);
  var stats = [
    { n: "99.9%", l: "Uptime" },
    { n: "500+", l: "Sites Managed" },
    { n: "50K+", l: "Employees" },
    { n: "24/7", l: "Monitoring" },
  ];
  for (var si = 0; si < stats.length; si++) {
    var statX = bannerX + si * statW;
    addText(
      frame,
      "stat-" + (si + 1) + "-number",
      stats[si].n,
      resolveFont(BEBAS),
      Math.round(bannerH * 0.38),
      FIXED_WHITE,
      statX,
      bannerY + Math.round(bannerH * 0.12),
      { maxWidth: statW, align: "CENTER" },
    );
    addText(
      frame,
      "stat-" + (si + 1) + "-label",
      stats[si].l,
      INTER_REG,
      Math.round(bannerH * 0.18),
      FIXED_WHITE,
      statX,
      bannerY + Math.round(bannerH * 0.56),
      { maxWidth: statW, align: "CENTER", opacity: 0.75 },
    );
    // Vertical divider between stats
    if (si < 3) {
      addRect(
        frame,
        "stat-divider-" + si,
        1,
        Math.round(bannerH * 0.5),
        statX + statW,
        bannerY + Math.round(bannerH * 0.25),
        solid(FIXED_WHITE, 0.25),
      );
    }
  }

  // Dark block — from below stats
  var darkY = Math.round(h * 0.26);
  addBrochureBlock(frame, "dark-zone", w, h - darkY, 0, darkY, B.DARK_BG);

  // Laptop overlapping white/dark boundary
  var laptopW = Math.round(w * 0.68);
  var laptopX = Math.round((w - laptopW) / 2);
  var laptopY = darkY - Math.round(h * 0.03);
  addLaptopFrame(frame, "image-area", laptopW, laptopX, laptopY, bc);

  // Feature callouts below laptop
  var calloutY = darkY + Math.round(h * 0.4);
  addBrochureFeatureItem(
    frame,
    1,
    margin,
    calloutY,
    Math.round(contentW * 0.42),
    "Enterprise Grade",
    "Built for scale with multi-tenant architecture.",
    bc,
    w,
    { darkBg: true },
  );
  addBrochureFeatureItem(
    frame,
    2,
    margin + Math.round(contentW * 0.55),
    calloutY,
    Math.round(contentW * 0.42),
    "Compliant",
    "ISO 27001, SOC 2, and GDPR certified.",
    bc,
    w,
    { darkBg: true },
  );
}

function buildBrochureCenteredShowcase(
  frame: FrameNode,
  w: number,
  h: number,
  bc: BrochureColors,
): void {
  var margin = Math.round(w * B.MARGIN);
  var contentW = w - margin * 2;

  // Red accent bar
  addRect(
    frame,
    "accent-bar",
    w,
    Math.round(h * 0.005),
    0,
    0,
    solid(bc.accent),
  );

  // Small red accent line centered
  var lineW = Math.round(w * 0.06);
  addRect(
    frame,
    "accent-line",
    lineW,
    3,
    Math.round((w - lineW) / 2),
    Math.round(h * 0.04),
    solid(bc.accent),
  );

  // Title centered
  addText(
    frame,
    "title",
    "FEATURE TITLE",
    resolveFont(BEBAS),
    Math.round(w * B.TITLE_SIZE * 1.1),
    bc.heading,
    margin,
    Math.round(h * 0.06),
    { maxWidth: contentW, align: "CENTER", letterSpacing: 3 },
  );

  // Description centered
  addText(
    frame,
    "description",
    "A comprehensive platform that brings together all your security and facility management operations into one unified dashboard.",
    INTER_REG,
    Math.round(w * B.BODY_SIZE * 1.1),
    bc.body,
    Math.round(w * 0.15),
    Math.round(h * 0.12),
    { maxWidth: Math.round(w * 0.7), align: "CENTER", lineHeight: 160 },
  );

  // Dark block — bottom 52%
  var darkY = Math.round(h * 0.45);
  addBrochureBlock(frame, "dark-zone", w, h - darkY, 0, darkY, B.DARK_BG);

  // Large laptop centered — overlapping boundary
  var laptopW = Math.round(w * 0.76);
  var laptopH = Math.round(laptopW * B.LAPTOP_RATIO);
  var laptopX = Math.round((w - laptopW) / 2);
  var laptopY = darkY - Math.round(laptopH * 0.35);
  addLaptopFrame(frame, "image-area", laptopW, laptopX, laptopY, bc);
}

// ══════════════════════════════════════════════════════════════
// BROCHURE LAYOUTS — Pattern 3: Full Dark Card Grid
// ══════════════════════════════════════════════════════════════

function buildBrochureIconGrid2x3(
  frame: FrameNode,
  w: number,
  h: number,
  bc: BrochureColors,
): void {
  var margin = Math.round(w * B.MARGIN);
  var contentW = w - margin * 2;

  // Full dark background — override frame fill
  frame.fills = [solid(B.DARK_BG)];

  // Title with first word in red (simulated with two text nodes)
  addText(
    frame,
    "title",
    "EVERYTHING COVERED.",
    resolveFont(BEBAS),
    Math.round(w * B.TITLE_SIZE),
    FIXED_WHITE,
    margin,
    Math.round(h * 0.04),
    { maxWidth: contentW, align: "CENTER", letterSpacing: 3 },
  );
  addText(
    frame,
    "subtitle",
    "Everything your security operations need, built into one platform.",
    INTER_REG,
    Math.round(w * B.SUBTITLE_SIZE),
    B.LIGHT_GRAY,
    margin,
    Math.round(h * 0.095),
    { maxWidth: contentW, align: "CENTER" },
  );

  // 2x3 card grid
  var gridY = Math.round(h * 0.15);
  var cardRadius = Math.round(w * B.CARD_RADIUS);
  var gapX = Math.round(w * 0.03);
  var gapY = Math.round(h * 0.02);
  var cardW = Math.round((contentW - gapX) / 2);
  var cardH = Math.round((h * 0.78 - gapY * 2) / 3);

  var cardItems = [
    {
      t: "Biometric Validation",
      d: "Confirm identity before every shift starts.",
    },
    { t: "Live GPS Tracking", d: "Know where every guard is, in real time." },
    {
      t: "Scheduling & Rostering",
      d: "Every post covered, every shift filled.",
    },
    { t: "SOPs & Training", d: "Compliance and readiness before every shift." },
    {
      t: "Incident Reporting",
      d: "Replace every paper log your operations use.",
    },
    { t: "Patrol Route Tracking", d: "Verify supervisors are on the ground." },
  ];

  for (var ci = 0; ci < cardItems.length; ci++) {
    var col = ci % 2;
    var row = Math.floor(ci / 2);
    var cardX = margin + col * (cardW + gapX);
    var cardY = gridY + row * (cardH + gapY);
    var card = addBrochureDarkCard(
      frame,
      "card-" + (ci + 1),
      cardW,
      cardH,
      cardX,
      cardY,
      cardRadius,
    );

    var iconSize = Math.round(w * B.ICON_SIZE);
    var pad = Math.round(cardW * 0.08);
    addBrochureIconCircle(card, iconSize, pad, pad, bc, true);
    addText(
      card,
      "card-" + (ci + 1) + "-title",
      cardItems[ci].t,
      INTER_SEMI,
      Math.round(w * B.FEAT_TITLE),
      FIXED_WHITE,
      pad,
      pad + iconSize + Math.round(cardH * 0.06),
      { maxWidth: cardW - pad * 2 },
    );
    addText(
      card,
      "card-" + (ci + 1) + "-desc",
      cardItems[ci].d,
      INTER_REG,
      Math.round(w * B.BODY_SIZE),
      B.LIGHT_GRAY,
      pad,
      pad +
        iconSize +
        Math.round(cardH * 0.06) +
        Math.round(w * B.FEAT_TITLE) +
        Math.round(cardH * 0.06),
      { maxWidth: cardW - pad * 2, lineHeight: 150 },
    );
  }
}

function buildBrochureIconGrid2x2(
  frame: FrameNode,
  w: number,
  h: number,
  bc: BrochureColors,
): void {
  var margin = Math.round(w * B.MARGIN);
  var contentW = w - margin * 2;

  // Full dark background
  frame.fills = [solid(B.DARK_BG)];

  addText(
    frame,
    "title",
    "KEY CAPABILITIES",
    resolveFont(BEBAS),
    Math.round(w * B.TITLE_SIZE),
    FIXED_WHITE,
    margin,
    Math.round(h * 0.04),
    { maxWidth: contentW, align: "CENTER", letterSpacing: 3 },
  );
  addText(
    frame,
    "subtitle",
    "Four pillars of operational excellence.",
    INTER_REG,
    Math.round(w * B.SUBTITLE_SIZE),
    B.LIGHT_GRAY,
    margin,
    Math.round(h * 0.095),
    { maxWidth: contentW, align: "CENTER" },
  );

  // 2x2 card grid — larger cards with screenshot placeholders
  var gridY = Math.round(h * 0.15);
  var cardRadius = Math.round(w * B.CARD_RADIUS);
  var gapX = Math.round(w * 0.03);
  var gapY = Math.round(h * 0.025);
  var cardW = Math.round((contentW - gapX) / 2);
  var cardH = Math.round((h * 0.78 - gapY) / 2);

  var cardItems = [
    { t: "Capability One", d: "Description of this capability." },
    { t: "Capability Two", d: "Description of this capability." },
    { t: "Capability Three", d: "Description of this capability." },
    { t: "Capability Four", d: "Description of this capability." },
  ];

  for (var ci = 0; ci < cardItems.length; ci++) {
    var col = ci % 2;
    var row = Math.floor(ci / 2);
    var cardX = margin + col * (cardW + gapX);
    var cardY = gridY + row * (cardH + gapY);
    var card = addBrochureDarkCard(
      frame,
      "card-" + (ci + 1),
      cardW,
      cardH,
      cardX,
      cardY,
      cardRadius,
    );

    var iconSize = Math.round(w * B.ICON_SIZE);
    var pad = Math.round(cardW * 0.08);
    addBrochureIconCircle(card, iconSize, pad, pad, bc, true);
    addText(
      card,
      "card-" + (ci + 1) + "-title",
      cardItems[ci].t,
      INTER_SEMI,
      Math.round(w * B.FEAT_TITLE),
      FIXED_WHITE,
      pad,
      pad + iconSize + Math.round(cardH * 0.04),
      { maxWidth: cardW - pad * 2 },
    );
    addText(
      card,
      "card-" + (ci + 1) + "-desc",
      cardItems[ci].d,
      INTER_REG,
      Math.round(w * B.BODY_SIZE),
      B.LIGHT_GRAY,
      pad,
      pad +
        iconSize +
        Math.round(cardH * 0.04) +
        Math.round(w * B.FEAT_TITLE) +
        Math.round(cardH * 0.03),
      { maxWidth: cardW - pad * 2, lineHeight: 150 },
    );

    // Screenshot placeholder inside card — bottom portion
    var phW = cardW - pad * 2;
    var phH = Math.round(cardH * 0.38);
    addBrochurePlaceholder(
      card,
      "card-" + (ci + 1) + "-image",
      phW,
      phH,
      pad,
      cardH - pad - phH,
      bc,
      Math.round(cardRadius * 0.6),
    );
  }
}

function buildBrochureIconGrid3x2(
  frame: FrameNode,
  w: number,
  h: number,
  bc: BrochureColors,
): void {
  var margin = Math.round(w * B.MARGIN);
  var contentW = w - margin * 2;

  // Full dark background
  frame.fills = [solid(B.DARK_BG)];

  addText(
    frame,
    "title",
    "PLATFORM OVERVIEW",
    resolveFont(BEBAS),
    Math.round(w * B.TITLE_SIZE),
    FIXED_WHITE,
    margin,
    Math.round(h * 0.04),
    { maxWidth: contentW, align: "CENTER", letterSpacing: 3 },
  );

  // Bento grid: Row 1 = wide card + narrow card. Row 2 = narrow card + wide card.
  var gridY = Math.round(h * 0.12);
  var cardRadius = Math.round(w * B.CARD_RADIUS);
  var gapX = Math.round(w * 0.025);
  var gapY = Math.round(h * 0.02);
  var narrowW = Math.round(contentW * 0.35);
  var wideW = contentW - narrowW - gapX;
  var rowH = Math.round((h * 0.82 - gapY) / 2);
  var iconSize = Math.round(w * B.ICON_SIZE);
  var pad = Math.round(narrowW * 0.1);

  // Row 1: Wide card left + narrow card right
  var wideCard1 = addBrochureDarkCard(
    frame,
    "card-1",
    wideW,
    rowH,
    margin,
    gridY,
    cardRadius,
  );
  addBrochureIconCircle(wideCard1, iconSize, pad, pad, bc, true);
  addText(
    wideCard1,
    "card-1-title",
    "Primary Feature",
    INTER_SEMI,
    Math.round(w * B.FEAT_TITLE),
    FIXED_WHITE,
    pad,
    pad + iconSize + Math.round(rowH * 0.04),
    { maxWidth: Math.round(wideW * 0.45) },
  );
  addText(
    wideCard1,
    "card-1-desc",
    "Comprehensive overview of the main platform capability.",
    INTER_REG,
    Math.round(w * B.BODY_SIZE),
    B.LIGHT_GRAY,
    pad,
    pad +
      iconSize +
      Math.round(rowH * 0.04) +
      Math.round(w * B.FEAT_TITLE) +
      Math.round(rowH * 0.03),
    { maxWidth: Math.round(wideW * 0.45), lineHeight: 150 },
  );
  // Image placeholder in right half of wide card
  var widePh = Math.round(wideW * 0.45);
  addBrochurePlaceholder(
    wideCard1,
    "card-1-image",
    widePh,
    rowH - pad * 2,
    wideW - pad - widePh,
    pad,
    bc,
    Math.round(cardRadius * 0.6),
  );

  var narrowCard1 = addBrochureDarkCard(
    frame,
    "card-2",
    narrowW,
    rowH,
    margin + wideW + gapX,
    gridY,
    cardRadius,
  );
  addBrochureIconCircle(narrowCard1, iconSize, pad, pad, bc, true);
  addText(
    narrowCard1,
    "card-2-title",
    "Feature Two",
    INTER_SEMI,
    Math.round(w * B.FEAT_TITLE),
    FIXED_WHITE,
    pad,
    pad + iconSize + Math.round(rowH * 0.04),
    { maxWidth: narrowW - pad * 2 },
  );
  addText(
    narrowCard1,
    "card-2-desc",
    "Description of this secondary capability.",
    INTER_REG,
    Math.round(w * B.BODY_SIZE),
    B.LIGHT_GRAY,
    pad,
    pad +
      iconSize +
      Math.round(rowH * 0.04) +
      Math.round(w * B.FEAT_TITLE) +
      Math.round(rowH * 0.03),
    { maxWidth: narrowW - pad * 2, lineHeight: 150 },
  );

  // Row 2: Narrow card left + wide card right
  var row2Y = gridY + rowH + gapY;
  var narrowCard2 = addBrochureDarkCard(
    frame,
    "card-3",
    narrowW,
    rowH,
    margin,
    row2Y,
    cardRadius,
  );
  addBrochureIconCircle(narrowCard2, iconSize, pad, pad, bc, true);
  addText(
    narrowCard2,
    "card-3-title",
    "Feature Three",
    INTER_SEMI,
    Math.round(w * B.FEAT_TITLE),
    FIXED_WHITE,
    pad,
    pad + iconSize + Math.round(rowH * 0.04),
    { maxWidth: narrowW - pad * 2 },
  );
  addText(
    narrowCard2,
    "card-3-desc",
    "Description of this additional capability.",
    INTER_REG,
    Math.round(w * B.BODY_SIZE),
    B.LIGHT_GRAY,
    pad,
    pad +
      iconSize +
      Math.round(rowH * 0.04) +
      Math.round(w * B.FEAT_TITLE) +
      Math.round(rowH * 0.03),
    { maxWidth: narrowW - pad * 2, lineHeight: 150 },
  );

  var wideCard2 = addBrochureDarkCard(
    frame,
    "card-4",
    wideW,
    rowH,
    margin + narrowW + gapX,
    row2Y,
    cardRadius,
  );
  addBrochureIconCircle(wideCard2, iconSize, pad, pad, bc, true);
  addText(
    wideCard2,
    "card-4-title",
    "Feature Four",
    INTER_SEMI,
    Math.round(w * B.FEAT_TITLE),
    FIXED_WHITE,
    pad,
    pad + iconSize + Math.round(rowH * 0.04),
    { maxWidth: Math.round(wideW * 0.45) },
  );
  addText(
    wideCard2,
    "card-4-desc",
    "Description of this comprehensive platform feature.",
    INTER_REG,
    Math.round(w * B.BODY_SIZE),
    B.LIGHT_GRAY,
    pad,
    pad +
      iconSize +
      Math.round(rowH * 0.04) +
      Math.round(w * B.FEAT_TITLE) +
      Math.round(rowH * 0.03),
    { maxWidth: Math.round(wideW * 0.45), lineHeight: 150 },
  );
  addBrochurePlaceholder(
    wideCard2,
    "card-4-image",
    widePh,
    rowH - pad * 2,
    wideW - pad - widePh,
    pad,
    bc,
    Math.round(cardRadius * 0.6),
  );
}

// ══════════════════════════════════════════════════════════════
// BROCHURE LAYOUTS — Pattern 4: Special Layouts
// ══════════════════════════════════════════════════════════════

function buildBrochureComparison(
  frame: FrameNode,
  w: number,
  h: number,
  bc: BrochureColors,
): void {
  var margin = Math.round(w * B.MARGIN);
  var contentW = w - margin * 2;

  // Red accent bar
  addRect(
    frame,
    "accent-bar",
    w,
    Math.round(h * 0.005),
    0,
    0,
    solid(bc.accent),
  );

  // Title
  addText(
    frame,
    "title",
    "WHY SWITCH?",
    resolveFont(BEBAS),
    Math.round(w * B.TITLE_SIZE),
    bc.heading,
    margin,
    Math.round(h * 0.03),
    { maxWidth: contentW, align: "CENTER", letterSpacing: 3 },
  );

  // Two columns
  var colW = Math.round((contentW - Math.round(w * 0.04)) / 2);
  var leftX = margin;
  var rightX = margin + colW + Math.round(w * 0.04);
  var colY = Math.round(h * 0.1);

  // Vertical divider
  addRect(
    frame,
    "divider",
    1,
    Math.round(h * 0.82),
    Math.round(w / 2),
    colY,
    solid(bc.cardBorder),
  );

  // Subtle red tint on right column
  addRect(
    frame,
    "right-tint",
    colW + Math.round(w * 0.02),
    Math.round(h * 0.84),
    rightX - Math.round(w * 0.01),
    colY - Math.round(h * 0.01),
    solid(bc.accent, 0.03),
    Math.round(w * 0.008),
  );

  // Left column — "The Old Way"
  var pillH = Math.round(h * 0.028);
  var pillW = Math.round(w * 0.14);
  addRect(
    frame,
    "old-pill",
    pillW,
    pillH,
    leftX,
    colY,
    solid(bc.cardBg),
    Math.round(pillH / 2),
  );
  addText(
    frame,
    "col-1-subtitle",
    "The Old Way",
    INTER_SEMI,
    Math.round(pillH * 0.55),
    bc.subtext,
    leftX + Math.round(pillW * 0.12),
    colY + Math.round(pillH * 0.18),
  );

  var bulletY = colY + pillH + Math.round(h * 0.04);
  var bulletGap = Math.round(h * 0.045);
  var oldBullets = [
    "Paper-based logs and registers",
    "Manual attendance tracking",
    "No real-time visibility",
    "Delayed incident reporting",
    "Fragmented communication",
  ];
  for (var bi = 0; bi < oldBullets.length; bi++) {
    addEllipse(
      frame,
      "old-dot-" + bi,
      Math.round(w * 0.007),
      Math.round(w * 0.007),
      leftX,
      bulletY + bi * bulletGap + Math.round(w * 0.003),
      solid(bc.subtext),
    );
    addText(
      frame,
      "col-1-bullet-" + (bi + 1),
      oldBullets[bi],
      INTER_REG,
      Math.round(w * B.BODY_SIZE),
      bc.body,
      leftX + Math.round(w * 0.018),
      bulletY + bi * bulletGap,
      { maxWidth: colW - Math.round(w * 0.02) },
    );
  }

  // Muted placeholder at bottom left
  addBrochurePlaceholder(
    frame,
    "col-1-image",
    Math.round(colW * 0.85),
    Math.round(h * 0.2),
    leftX,
    Math.round(h * 0.68),
    bc,
    Math.round(w * 0.008),
  );

  // Right column — "The New Way"
  addRect(
    frame,
    "new-pill",
    pillW,
    pillH,
    rightX,
    colY,
    solid(bc.accent),
    Math.round(pillH / 2),
  );
  addText(
    frame,
    "col-2-subtitle",
    "The New Way",
    INTER_SEMI,
    Math.round(pillH * 0.55),
    FIXED_WHITE,
    rightX + Math.round(pillW * 0.1),
    colY + Math.round(pillH * 0.18),
  );

  var newBullets = [
    "Digital registers and audit trails",
    "Biometric + GPS verification",
    "Real-time dashboard visibility",
    "Instant incident alerts",
    "Unified messaging platform",
  ];
  for (var ni = 0; ni < newBullets.length; ni++) {
    addEllipse(
      frame,
      "new-dot-" + ni,
      Math.round(w * 0.007),
      Math.round(w * 0.007),
      rightX,
      bulletY + ni * bulletGap + Math.round(w * 0.003),
      solid(bc.accent),
    );
    addText(
      frame,
      "col-2-bullet-" + (ni + 1),
      newBullets[ni],
      INTER_SEMI,
      Math.round(w * B.BODY_SIZE),
      bc.heading,
      rightX + Math.round(w * 0.018),
      bulletY + ni * bulletGap,
      { maxWidth: colW - Math.round(w * 0.02) },
    );
  }

  // Phone at bottom right
  var phoneW = Math.round(w * 0.17);
  addPhoneFrame(
    frame,
    "col-2-image",
    phoneW,
    rightX + Math.round((colW - phoneW) / 2),
    Math.round(h * 0.62),
    bc,
  );
}

function buildBrochureTimeline(
  frame: FrameNode,
  w: number,
  h: number,
  bc: BrochureColors,
): void {
  var margin = Math.round(w * B.MARGIN);

  // Red accent bar
  addRect(
    frame,
    "accent-bar",
    w,
    Math.round(h * 0.005),
    0,
    0,
    solid(bc.accent),
  );

  // Title
  addText(
    frame,
    "title",
    "HOW IT WORKS",
    resolveFont(BEBAS),
    Math.round(w * B.TITLE_SIZE),
    bc.heading,
    margin,
    Math.round(h * 0.03),
    { maxWidth: Math.round(w * 0.38), letterSpacing: 3 },
  );

  // Vertical timeline line
  var lineX = margin + Math.round(w * 0.015);
  var lineTop = Math.round(h * 0.12);
  var lineBottom = Math.round(h * 0.85);
  addRect(
    frame,
    "timeline-line",
    2,
    lineBottom - lineTop,
    lineX,
    lineTop,
    solid(bc.accent),
  );

  // 4 steps along the line
  var stepGap = Math.round((lineBottom - lineTop) / 4);
  var dotSize = Math.round(w * 0.012);
  var textX = lineX + Math.round(w * 0.03);
  var textW = Math.round(w * 0.3);

  var steps = [
    {
      t: "Step 1: Onboard",
      d: "Set up sites, posts, and employee profiles in minutes.",
    },
    {
      t: "Step 2: Schedule",
      d: "Auto-generate shifts with smart rostering tools.",
    },
    {
      t: "Step 3: Monitor",
      d: "Track attendance, patrols, and incidents in real-time.",
    },
    {
      t: "Step 4: Report",
      d: "Generate compliance reports and analytics dashboards.",
    },
  ];

  for (var si = 0; si < steps.length; si++) {
    var stepY = lineTop + si * stepGap + Math.round(stepGap * 0.2);
    // Dot on the line
    addEllipse(
      frame,
      "step-dot-" + (si + 1),
      dotSize,
      dotSize,
      lineX - Math.round(dotSize / 2) + 1,
      stepY,
      solid(bc.accent),
    );
    // Step text
    addText(
      frame,
      "step-" + (si + 1) + "-title",
      steps[si].t,
      INTER_SEMI,
      Math.round(w * B.FEAT_TITLE),
      bc.heading,
      textX,
      stepY - Math.round(dotSize * 0.2),
      { maxWidth: textW },
    );
    addText(
      frame,
      "step-" + (si + 1) + "-desc",
      steps[si].d,
      INTER_REG,
      Math.round(w * B.BODY_SIZE),
      bc.body,
      textX,
      stepY + Math.round(w * B.FEAT_TITLE) + Math.round(h * 0.01),
      { maxWidth: textW, lineHeight: 150 },
    );
  }

  // Dark block on right — 52% wide
  var darkX = Math.round(w * 0.46);
  var darkW = w - darkX;
  var darkY = Math.round(h * 0.08);
  var darkH = Math.round(h * 0.84);
  addBrochureBlock(frame, "dark-zone", darkW, darkH, darkX, darkY, B.DARK_BG);

  // Phone inside dark zone
  var phoneW = Math.round(w * 0.2);
  var phoneH = Math.round(phoneW * B.PHONE_RATIO);
  var phoneX = darkX + Math.round((darkW - phoneW) / 2);
  var phoneY = darkY + Math.round((darkH - phoneH) / 2);
  addPhoneFrame(frame, "image-area", phoneW, phoneX, phoneY, bc);
}

function buildBrochureFullBleed(
  frame: FrameNode,
  w: number,
  h: number,
  bc: BrochureColors,
): void {
  // Full-page image placeholder
  addBrochurePlaceholder(frame, "image-area", w, h, 0, 0, bc);

  // Gradient overlay — transparent top to dark bottom
  var overlay = figma.createRectangle();
  overlay.name = "gradient-overlay";
  overlay.resize(w, h);
  overlay.x = 0;
  overlay.y = 0;
  overlay.fills = [
    {
      type: "GRADIENT_LINEAR",
      gradientStops: [
        { position: 0, color: { r: 0, g: 0, b: 0, a: 0 } },
        { position: 0.5, color: { r: 0, g: 0, b: 0, a: 0.2 } },
        { position: 1, color: { r: 0, g: 0, b: 0, a: 0.85 } },
      ],
      gradientTransform: [
        [0, 1, 0],
        [-1, 0, 1],
      ],
    } as GradientPaint,
  ];
  frame.appendChild(overlay);

  // Red accent bar at top
  addRect(
    frame,
    "accent-bar",
    w,
    Math.round(h * 0.005),
    0,
    0,
    solid(bc.accent),
  );

  // Small brand circle top-left
  var brandSize = Math.round(w * 0.05);
  addEllipse(
    frame,
    "brand-circle",
    brandSize,
    brandSize,
    Math.round(w * B.MARGIN),
    Math.round(h * 0.025),
    solid(bc.accent),
  );

  var margin = Math.round(w * B.MARGIN);
  var contentW = w - margin * 2;

  // Title
  addText(
    frame,
    "title",
    "FEATURE TITLE",
    resolveFont(BEBAS),
    Math.round(w * B.TITLE_SIZE * 1.2),
    FIXED_WHITE,
    margin,
    Math.round(h * 0.68),
    { maxWidth: contentW, letterSpacing: 3 },
  );

  // Subtitle
  addText(
    frame,
    "subtitle",
    "One platform to command your entire operation.",
    INTER_MED,
    Math.round(w * B.SUBTITLE_SIZE * 1.2),
    FIXED_WHITE,
    margin,
    Math.round(h * 0.74),
    { maxWidth: Math.round(contentW * 0.7), opacity: 0.85 },
  );

  // 3 bullets with red dots
  var bulletY = Math.round(h * 0.8);
  var bulletGap = Math.round(h * 0.035);
  var bullets = [
    "Real-time monitoring across all sites",
    "Instant incident alerts and response",
    "Complete compliance reporting",
  ];
  for (var bi = 0; bi < bullets.length; bi++) {
    addEllipse(
      frame,
      "bullet-dot-" + bi,
      Math.round(w * 0.007),
      Math.round(w * 0.007),
      margin,
      bulletY + bi * bulletGap + Math.round(w * 0.003),
      solid(bc.accent),
    );
    addText(
      frame,
      "bullet-" + (bi + 1),
      bullets[bi],
      INTER_REG,
      Math.round(w * B.BODY_SIZE),
      FIXED_WHITE,
      margin + Math.round(w * 0.018),
      bulletY + bi * bulletGap,
      { maxWidth: Math.round(contentW * 0.7), opacity: 0.8 },
    );
  }
}

// ── Brochure Layout Registry & Orchestrator ──────────────────

interface BrochureLayoutVariant {
  key: string;
  suffix: string;
  build: (frame: FrameNode, w: number, h: number, bc: BrochureColors) => void;
}

var BROCHURE_LAYOUTS: BrochureLayoutVariant[] = [
  {
    key: "hero-feature",
    suffix: "Hero Feature",
    build: buildBrochureHeroFeature,
  },
  { key: "split-left", suffix: "Split Left", build: buildBrochureSplitLeft },
  { key: "split-right", suffix: "Split Right", build: buildBrochureSplitRight },
  {
    key: "icon-grid-2x2",
    suffix: "Icon Grid 2x2",
    build: buildBrochureIconGrid2x2,
  },
  {
    key: "icon-grid-2x3",
    suffix: "Icon Grid 2x3",
    build: buildBrochureIconGrid2x3,
  },
  {
    key: "icon-grid-3x2",
    suffix: "Icon Grid 3x2",
    build: buildBrochureIconGrid3x2,
  },
  {
    key: "phone-bullets",
    suffix: "Phone + Bullets",
    build: buildBrochurePhoneBullets,
  },
  { key: "dual-device", suffix: "Dual Device", build: buildBrochureDualDevice },
  {
    key: "feature-stack",
    suffix: "Feature Stack",
    build: buildBrochureFeatureStack,
  },
  {
    key: "stats-banner",
    suffix: "Stats Banner",
    build: buildBrochureStatsBanner,
  },
  {
    key: "screenshot-gallery",
    suffix: "Screenshot Gallery",
    build: buildBrochureScreenshotGallery,
  },
  {
    key: "centered-showcase",
    suffix: "Centered Showcase",
    build: buildBrochureCenteredShowcase,
  },
  { key: "timeline", suffix: "Timeline", build: buildBrochureTimeline },
  { key: "comparison", suffix: "Comparison", build: buildBrochureComparison },
  {
    key: "full-bleed",
    suffix: "Full Bleed Image",
    build: buildBrochureFullBleed,
  },
];

async function createBrochurePages(
  layouts: string[],
  themes: string[],
  resolution: string,
): Promise<void> {
  // Load fonts
  try {
    await Promise.all([
      figma.loadFontAsync(INTER_BOLD),
      figma.loadFontAsync(INTER_SEMI),
      figma.loadFontAsync(INTER_MED),
      figma.loadFontAsync(INTER_REG),
    ]);
    loadedFonts.add(fontKey(INTER_BOLD));
    loadedFonts.add(fontKey(INTER_SEMI));
    loadedFonts.add(fontKey(INTER_MED));
    loadedFonts.add(fontKey(INTER_REG));
  } catch {
    figma.ui.postMessage({
      type: "error",
      message: "Failed to load Inter font.",
    });
    return;
  }

  // Load display fonts with fallback
  for (var di = 0; di < DISPLAY_FONTS.length; di++) {
    try {
      await figma.loadFontAsync(DISPLAY_FONTS[di]);
      loadedFonts.add(fontKey(DISPLAY_FONTS[di]));
    } catch {}
  }

  // Get resolution
  var res = BROCHURE_RESOLUTIONS[resolution] || BROCHURE_RESOLUTIONS["digital"];
  var pageW = res.w;
  var pageH = res.h;

  // Filter selected layouts
  var selectedLayouts: BrochureLayoutVariant[] = [];
  for (var si = 0; si < BROCHURE_LAYOUTS.length; si++) {
    if (layouts.indexOf(BROCHURE_LAYOUTS[si].key) >= 0) {
      selectedLayouts.push(BROCHURE_LAYOUTS[si]);
    }
  }

  var totalCount = selectedLayouts.length * themes.length;
  var frameIdx = 0;
  var xPos = 0;

  // Find maxY to place below existing content
  var pageMaxY = 0;
  for (var ci = 0; ci < figma.currentPage.children.length; ci++) {
    var child = figma.currentPage.children[ci];
    var bottom = child.y + child.height;
    if (bottom > pageMaxY) pageMaxY = bottom;
  }
  var startY = pageMaxY > 0 ? pageMaxY + 150 : 0;

  for (var ti = 0; ti < themes.length; ti++) {
    var isDark = themes[ti] === "dark";
    var bc = getBrochureColors(isDark);
    var tSuffix = themes.length > 1 ? (isDark ? " (Dark)" : " (Light)") : "";

    for (var bi = 0; bi < selectedLayouts.length; bi++) {
      var bv = selectedLayouts[bi];
      var frame = figma.createFrame();
      frame.name = "Brochure \u2014 " + bv.suffix + tSuffix;
      frame.resize(pageW, pageH);
      frame.x = xPos;
      frame.y = startY;
      frame.fills = [solid(bc.bg)];
      frame.clipsContent = true;

      try {
        bv.build(frame, pageW, pageH, bc);
      } catch (buildErr) {
        figma.ui.postMessage({
          type: "error",
          message:
            "Brochure build error (" +
            bv.suffix +
            "): " +
            (buildErr instanceof Error ? buildErr.message : String(buildErr)),
        });
      }

      figma.currentPage.appendChild(frame);
      xPos += pageW + 100;
      frameIdx++;

      figma.ui.postMessage({
        type: "progress",
        current: frameIdx,
        total: totalCount,
      });
    }
  }

  figma.ui.postMessage({
    type: "done",
    message: "Created " + frameIdx + " brochure page(s).",
  });
}

// ══════════════════════════════════════════════════════════════
// BLOG TEMPLATE SYSTEM
// ══════════════════════════════════════════════════════════════

type BlogBuildFn = (
  frame: FrameNode,
  w: number,
  h: number,
  sectionCount: number,
) => number;

interface BlogTemplateVariant {
  key: string;
  suffix: string;
  build: BlogBuildFn;
}

var BLOG_STYLES: BlogTemplateVariant[] = [
  { key: "hero-banner", suffix: "Hero Banner", build: buildBlogHeroBanner },
  { key: "editorial", suffix: "Editorial", build: buildBlogEditorial },
  { key: "case-study", suffix: "Case Study", build: buildBlogCaseStudy },
  { key: "changelog", suffix: "Changelog", build: buildBlogChangelog },
  { key: "comparison", suffix: "Comparison", build: buildBlogComparison },
  { key: "data-report", suffix: "Data Report", build: buildBlogDataReport },
  { key: "immersive", suffix: "Immersive", build: buildBlogImmersive },
  { key: "tutorial", suffix: "Tutorial", build: buildBlogTutorial },
];

async function createBlogTemplates(
  blogTemplates: string[],
  themes: string[],
  bgPattern: string,
  bgDensity: string,
  title?: string,
  author?: string,
  sectionCount?: number,
  logoImageBytes?: number[],
  fullLogoImageBytes?: number[],
): Promise<void> {
  // Load fonts
  try {
    await Promise.all([
      figma.loadFontAsync(INTER_BOLD),
      figma.loadFontAsync(INTER_SEMI),
      figma.loadFontAsync(INTER_MED),
      figma.loadFontAsync(INTER_REG),
    ]);
    loadedFonts.add(fontKey(INTER_BOLD));
    loadedFonts.add(fontKey(INTER_SEMI));
    loadedFonts.add(fontKey(INTER_MED));
    loadedFonts.add(fontKey(INTER_REG));
  } catch {
    figma.ui.postMessage({
      type: "error",
      message: "Failed to load Inter font.",
    });
    return;
  }

  // Load display fonts independently
  for (var di = 0; di < DISPLAY_FONTS.length; di++) {
    try {
      await figma.loadFontAsync(DISPLAY_FONTS[di]);
      loadedFonts.add(fontKey(DISPLAY_FONTS[di]));
    } catch {
      // Font not available — resolveFont() will return INTER_BOLD
    }
  }

  // Set globals
  activeBgPattern = bgPattern || "none";
  activeBgDensity = bgDensity || "medium";
  activeBlogTitle = title || "";
  activeBlogAuthor = author || "Commando360 Team";
  activeBlogSections = sectionCount || 3;

  // Load logos
  if (logoImageBytes && logoImageBytes.length > 0) {
    circleLogo = figma.createImage(new Uint8Array(logoImageBytes));
  }
  if (fullLogoImageBytes && fullLogoImageBytes.length > 0) {
    brandLogo = figma.createImage(new Uint8Array(fullLogoImageBytes));
  }

  // Determine which blog templates to build
  var selectedStyles: BlogTemplateVariant[] = [];
  for (var si = 0; si < BLOG_STYLES.length; si++) {
    if (blogTemplates.indexOf(BLOG_STYLES[si].key) >= 0) {
      selectedStyles.push(BLOG_STYLES[si]);
    }
  }

  var totalCount = selectedStyles.length * themes.length;
  var frameIdx = 0;
  var blogW = 1440;
  var blogH = 4000; // initial estimate, resized by build fn
  var xPos = 0;

  for (var ti = 0; ti < themes.length; ti++) {
    var isDark = themes[ti] === "dark";
    applyTheme(isDark);
    var tSuffix = themes.length > 1 ? (isDark ? " (Dark)" : " (Light)") : "";

    for (var bi = 0; bi < selectedStyles.length; bi++) {
      var bv = selectedStyles[bi];
      var frame = figma.createFrame();
      frame.name = "Blog — " + bv.suffix + tSuffix;
      frame.resize(blogW, blogH);
      frame.x = xPos;
      frame.y = 0;
      frame.fills = [{ type: "SOLID", color: C.bg }];
      frame.clipsContent = true;

      try {
        var actualH = bv.build(frame, blogW, blogH, activeBlogSections);
        if (actualH > 0 && actualH !== blogH) {
          frame.resize(blogW, actualH);
        }
      } catch (buildErr) {
        // Add error text to frame so it's visible
        figma.ui.postMessage({
          type: "error",
          message:
            "Blog build error (" +
            bv.suffix +
            "): " +
            (buildErr instanceof Error ? buildErr.message : String(buildErr)),
        });
      }

      figma.currentPage.appendChild(frame);
      xPos += blogW + 100;
      frameIdx++;

      figma.ui.postMessage({
        type: "progress",
        current: frameIdx,
        total: totalCount,
      });
    }
  }

  figma.ui.postMessage({ type: "done", count: frameIdx });
}

// ══════════════════════════════════════════════════════════════
// MAIN MESSAGE HANDLER
// ══════════════════════════════════════════════════════════════

let cancelled = false;

figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === "cancel") {
    cancelled = true;
    return;
  }

  if (msg.type === "create-templates") {
    await createTemplates(
      msg.platforms,
      msg.contentTypes,
      msg.brandFrame,
      msg.themes,
      msg.bgPattern || "none",
      msg.bgDensity || "medium",
      msg.qrImage,
      msg.logoImage,
      msg.fullLogoImage,
      msg.patternImage,
      msg.patternSvgStr,
    );
    return;
  }

  if (msg.type === "create-blog") {
    await createBlogTemplates(
      msg.blogTemplates,
      msg.themes,
      msg.bgPattern || "none",
      msg.bgDensity || "medium",
      msg.title,
      msg.author,
      msg.sectionCount || 3,
      msg.logoImage,
      msg.fullLogoImage,
    );
    return;
  }

  if (msg.type === "create-mockups") {
    await createMockups(
      msg.layouts || [],
      msg.deviceColor || "space-black",
      msg.themes || ["dark"],
      msg.platforms || [],
      msg.postDeviceFocus || ["phone"],
      msg.desktopStyle || "macbook",
      msg.logoImage,
      msg.fullLogoImage,
    );
    return;
  }

  if (msg.type === "create-brochure") {
    await createBrochurePages(
      msg.layouts || [],
      msg.themes || ["light"],
      msg.resolution || "digital",
    );
    return;
  }

  if (msg.type !== "generate") return;

  cancelled = false;
  const { variations, columns, gap } = msg;

  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    figma.ui.postMessage({
      type: "error",
      message: "Select one or more template frames first.",
    });
    return;
  }

  const templates = selection.filter(
    (n): n is FrameNode | ComponentNode | InstanceNode =>
      n.type === "FRAME" || n.type === "COMPONENT" || n.type === "INSTANCE",
  );

  if (templates.length === 0) {
    figma.ui.postMessage({
      type: "error",
      message: "Selection must contain frame(s).",
    });
    return;
  }

  const layerNames = new Set<string>();
  for (const t of templates) {
    const textNodes = t.findAllWithCriteria({
      types: ["TEXT"],
    }) as TextNode[];
    for (const tn of textNodes) {
      layerNames.add(tn.name.toLowerCase());
    }
  }

  figma.ui.postMessage({
    type: "info",
    message: `Found ${templates.length} template(s) with layers: ${Array.from(layerNames).join(", ")}`,
  });

  const allFonts: FontName[] = [];
  for (const t of templates) {
    allFonts.push(...collectFonts(t));
  }
  const uniqueFonts = new Map<string, FontName>();
  for (const f of allFonts) {
    uniqueFonts.set(`${f.family}::${f.style}`, f);
  }
  await Promise.all(
    Array.from(uniqueFonts.values()).map((f) => figma.loadFontAsync(f)),
  );

  let totalGenerated = 0;
  const allClones: SceneNode[] = [];

  // Sort templates left-to-right, top-to-bottom so output is predictable
  const sortedTemplates = [...templates].sort((a, b) => a.x - b.x || a.y - b.y);

  // Place all variation grids below all templates, not below each individual one
  let globalMaxY = 0;
  for (const t of sortedTemplates) {
    globalMaxY = Math.max(globalMaxY, t.y + t.height);
  }
  let nextRowY = globalMaxY + gap;

  for (const template of sortedTemplates) {
    const tw = template.width;
    const th = template.height;
    const startX = template.x;
    const startY = nextRowY;

    // Reserve vertical space for this template's grid rows
    const rowCount = Math.ceil(variations.length / columns);
    nextRowY = startY + rowCount * (th + gap) + gap;

    for (let i = 0; i < variations.length; i++) {
      if (cancelled) {
        figma.ui.postMessage({
          type: "cancelled",
          message: `Cancelled. Generated ${totalGenerated} variations.`,
        });
        return;
      }

      const variation = variations[i];
      const clone = template.clone();

      const col = i % columns;
      const row = Math.floor(i / columns);
      clone.x = startX + col * (tw + gap);
      clone.y = startY + row * (th + gap);
      clone.name = `${template.name} \u2014 v${i + 1}`;

      for (const [key, value] of Object.entries(variation)) {
        if (value === undefined || value === "") continue;
        if (key === "qr_url") continue; // handled separately below
        const textNode = findTextByName(
          clone as FrameNode | ComponentNode | InstanceNode,
          key,
        );
        if (textNode) {
          await setText(textNode, value);
        }
      }

      // Fill QR code from per-variation URL
      const qrUrl = variation["qr_url"];
      if (qrUrl && msg.qrImages && msg.qrImages[qrUrl]) {
        const qrRect = (
          clone as FrameNode | ComponentNode | InstanceNode
        ).findOne(
          (n) => n.name === "qr-code" && n.type === "RECTANGLE",
        ) as RectangleNode | null;
        if (qrRect) {
          const img = figma.createImage(new Uint8Array(msg.qrImages[qrUrl]));
          qrRect.fills = [
            { type: "IMAGE", imageHash: img.hash, scaleMode: "FILL" },
          ];
        }
      }

      allClones.push(clone);
      totalGenerated++;

      if (totalGenerated % 5 === 0 || i === variations.length - 1) {
        figma.ui.postMessage({
          type: "progress",
          current: totalGenerated,
          total: templates.length * variations.length,
        });
      }
    }
  }

  figma.currentPage.selection = allClones;
  figma.viewport.scrollAndZoomIntoView(allClones);

  figma.ui.postMessage({
    type: "done",
    message: `Generated ${totalGenerated} variation(s) across ${templates.length} template(s).`,
  });
};
