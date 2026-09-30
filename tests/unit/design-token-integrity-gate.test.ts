import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  analyzeDesignTokenIntegrity,
  createDesignTokenIntegrityBaseline,
  validateDesignTokenIntegrity,
} from "../../scripts/quality/check-design-token-integrity.mjs";

const temporaryRoots: string[] = [];

function createFixture(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lotus-token-integrity-"));
  temporaryRoots.push(root);
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
  }
  return root;
}

function analyze(repoRoot: string) {
  return analyzeDesignTokenIntegrity({
    repoRoot,
    rawColorExemptPaths: [
      "src/design-system/theme/tokens.ts",
      "src/styles/global/tokens.css",
    ],
    runtimeDefinedCustomProperties: [],
  });
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("design-token integrity gate", () => {
  it("is wired into the repository lint lane", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../../package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.["quality:design-tokens"]).toBe(
      "node scripts/quality/check-design-token-integrity.mjs",
    );
    expect(packageJson.scripts?.lint).toContain(
      "npm run quality:design-tokens",
    );
  });

  it("accepts resolved variables and an unchanged exact baseline", () => {
    const root = createFixture({
      "src/styles/global/tokens.css": ":root { --text: #18262f; }",
      "src/panel.module.css": ".panel { color: var(--text); }",
    });
    const analysis = analyze(root);
    const baseline = createDesignTokenIntegrityBaseline(analysis);

    expect(analysis.undefinedReferences).toEqual([]);
    expect(validateDesignTokenIntegrity({ analysis, baseline })).toEqual([]);
  });

  it("fails closed when a custom property reference is undefined", () => {
    const root = createFixture({
      "src/panel.module.css":
        ".panel { color: var(--undefined-anything, #fff); }",
    });
    const analysis = analyze(root);
    const baseline = createDesignTokenIntegrityBaseline(analysis);

    expect(validateDesignTokenIntegrity({ analysis, baseline })).toContain(
      "src/panel.module.css: --undefined-anything is referenced but never defined or registered as runtime-owned.",
    );
  });

  it("finds undefined references inside nested fallbacks", () => {
    const root = createFixture({
      "src/styles/global/tokens.css": ":root { --text: #18262f; }",
      "src/panel.module.css":
        ".panel { color: var(--text, color-mix(in srgb, var(--nested-undefined) 50%, #fff)); }",
    });
    const analysis = analyze(root);
    const baseline = createDesignTokenIntegrityBaseline(analysis);

    expect(validateDesignTokenIntegrity({ analysis, baseline })).toContain(
      "src/panel.module.css: --nested-undefined is referenced but never defined or registered as runtime-owned.",
    );
  });

  it("parses the complete dashed-ident for custom properties", () => {
    const root = createFixture({
      "src/styles/global/tokens.css": ":root { --risk_score: 42; }",
      "src/panel.module.css": ".panel { z-index: var(--risk_score); }",
    });

    expect(analyze(root).undefinedReferences).toEqual([]);
  });

  it("does not accept commented-out custom-property definitions", () => {
    const root = createFixture({
      "src/panel.module.css":
        "/* --missing: retired token; */ .panel { color: var(--missing); }",
      "src/panel.ts":
        "// '--also-missing': retired token\nexport const panel = 'var(--also-missing)';",
    });
    const analysis = analyze(root);
    const baseline = createDesignTokenIntegrityBaseline(analysis);

    expect(validateDesignTokenIntegrity({ analysis, baseline })).toEqual(
      expect.arrayContaining([
        "src/panel.module.css: --missing is referenced but never defined or registered as runtime-owned.",
        "src/panel.ts: --also-missing is referenced but never defined or registered as runtime-owned.",
      ]),
    );
  });

  it("does not accept metadata keys as custom-property definitions", () => {
    const root = createFixture({
      "src/panel.ts":
        "export const metadata = { '--retired': 'documentation' };\nexport const style = 'var(--retired)';",
    });
    const analysis = analyze(root);
    const baseline = createDesignTokenIntegrityBaseline(analysis);

    expect(validateDesignTokenIntegrity({ analysis, baseline })).toContain(
      "src/panel.ts: --retired is referenced but never defined or registered as runtime-owned.",
    );
  });

  it("accepts explicitly registered runtime custom properties", () => {
    const root = createFixture({
      "src/panel.tsx":
        "export const style = { '--runtime-token': 'inherit', color: 'var(--runtime-token)' };",
    });
    const analysis = analyzeDesignTokenIntegrity({
      repoRoot: root,
      rawColorExemptPaths: [],
      runtimeDefinedCustomProperties: ["--runtime-token"],
    });

    expect(analysis.undefinedReferences).toEqual([]);
  });

  it("ignores issue references and colour examples inside comments", () => {
    const root = createFixture({
      "src/panel.module.css":
        "/* Issue #1031 used oklch(50% 0.2 120). */ .panel { color: inherit; }",
      "src/panel.ts":
        "// Issue #1031 used #fff.\nexport const panel = 'no raw colour';",
    });
    const analysis = analyze(root);

    expect(analysis.rawColorLiterals).toMatchObject({ count: 0, fileCount: 0 });
  });

  it("ignores hex-shaped identifiers in ordinary TypeScript product copy", () => {
    const root = createFixture({
      "src/incident-copy.ts":
        "export const incidentCopy = 'Review Incident #123 before approval.';",
    });

    expect(analyze(root).rawColorLiterals).toMatchObject({
      count: 0,
      fileCount: 0,
    });
  });

  it("binds raw-colour evidence to the CSS selector and declaration property", () => {
    const root = createFixture({
      "src/panel.module.css": ".panel { color: #123; background-color: #fff; }",
    });
    const baseline = createDesignTokenIntegrityBaseline(analyze(root));
    fs.writeFileSync(
      path.join(root, "src/panel.module.css"),
      ".panel { color: #fff; background-color: #123; }",
      "utf8",
    );

    const analysis = analyze(root);
    expect(analysis.rawColorLiterals.count).toBe(
      baseline.rawColorLiterals.count,
    );
    expect(analysis.rawColorLiterals.digest).not.toBe(
      baseline.rawColorLiterals.digest,
    );
    expect(validateDesignTokenIntegrity({ analysis, baseline })).toEqual(
      expect.arrayContaining([
        expect.stringContaining("rawColorLiterals.digest"),
      ]),
    );
  });

  it("binds repeated selector declarations to their cascade occurrence", () => {
    const root = createFixture({
      "src/panel.module.css": ".panel { color: #fff; } .panel { color: #000; }",
    });
    const baseline = createDesignTokenIntegrityBaseline(analyze(root));
    fs.writeFileSync(
      path.join(root, "src/panel.module.css"),
      ".panel { color: #000; } .panel { color: #fff; }",
      "utf8",
    );

    const analysis = analyze(root);
    expect(analysis.rawColorLiterals.count).toBe(
      baseline.rawColorLiterals.count,
    );
    expect(analysis.rawColorLiterals.digest).not.toBe(
      baseline.rawColorLiterals.digest,
    );
    expect(validateDesignTokenIntegrity({ analysis, baseline })).toContainEqual(
      expect.stringContaining("rawColorLiterals.digest"),
    );
  });

  it("keeps declaration-context evidence stable across line-ending styles", () => {
    const root = createFixture({
      "src/panel.module.css": ".panel,\r\n.card {\r\n  color: #123;\r\n}\r\n",
    });
    const windowsDigest = analyze(root).rawColorLiterals.digest;
    fs.writeFileSync(
      path.join(root, "src/panel.module.css"),
      ".panel,\n.card {\n  color: #123;\n}\n",
      "utf8",
    );

    expect(analyze(root).rawColorLiterals.digest).toBe(windowsDigest);
  });

  it("rejects modern raw colour functions in declaration values", () => {
    const root = createFixture({
      "src/panel.module.css": ".panel { color: inherit; }",
    });
    const baseline = createDesignTokenIntegrityBaseline(analyze(root));
    fs.writeFileSync(
      path.join(root, "src/panel.module.css"),
      ".panel { color: oklch(50% 0.2 120); }",
      "utf8",
    );

    expect(
      validateDesignTokenIntegrity({ analysis: analyze(root), baseline }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("rawColorLiterals.count"),
        expect.stringContaining("rawColorLiterals.digest"),
      ]),
    );
  });

  it("rejects named colours in CSS and TypeScript style values", () => {
    const root = createFixture({
      "src/panel.module.css": ".panel { color: inherit; }",
      "src/panel.tsx": "export const style = { color: 'inherit' };",
    });
    const baseline = createDesignTokenIntegrityBaseline(analyze(root));
    fs.writeFileSync(
      path.join(root, "src/panel.module.css"),
      ".panel { color: red; }",
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "src/panel.tsx"),
      "export const style = { color: 'white' };",
      "utf8",
    );

    const analysis = analyze(root);
    expect(analysis.rawColorLiterals).toMatchObject({ count: 2, fileCount: 2 });
    expect(validateDesignTokenIntegrity({ analysis, baseline })).toEqual(
      expect.arrayContaining([
        expect.stringContaining("rawColorLiterals.count"),
        expect.stringContaining("rawColorLiterals.digest"),
      ]),
    );
  });

  it("rejects raw colours in image and filter TypeScript style properties", () => {
    const root = createFixture({
      "src/panel.tsx":
        "export const style = { backgroundImage: 'none', filter: 'blur(2px)' };",
    });
    const baseline = createDesignTokenIntegrityBaseline(analyze(root));
    fs.writeFileSync(
      path.join(root, "src/panel.tsx"),
      "export const style = { backgroundImage: 'linear-gradient(#fff, #000)', filter: 'drop-shadow(0 0 red)' };",
      "utf8",
    );

    const analysis = analyze(root);
    expect(analysis.rawColorLiterals.count).toBe(
      baseline.rawColorLiterals.count + 3,
    );
    expect(validateDesignTokenIntegrity({ analysis, baseline })).toEqual(
      expect.arrayContaining([
        expect.stringContaining("rawColorLiterals.count"),
        expect.stringContaining("rawColorLiterals.digest"),
      ]),
    );
  });

  it("does not treat an invalid standalone filter value as a CSS colour", () => {
    const root = createFixture({
      "src/query.ts": "export const query = { filter: 'red' };",
    });

    expect(analyze(root).rawColorLiterals).toMatchObject({
      count: 0,
      fileCount: 0,
    });
  });

  it("does not treat a keyframes identifier as a named colour", () => {
    const root = createFixture({
      "src/panel.module.css":
        "@keyframes red { from { opacity: 0; } to { opacity: 1; } }",
    });

    expect(analyze(root).rawColorLiterals).toMatchObject({
      count: 0,
      fileCount: 0,
    });
  });

  it("still scans declaration values in supports-rule parameters", () => {
    const root = createFixture({
      "src/panel.module.css":
        "@supports (background: linear-gradient(red, blue)) { .panel { display: grid; } } @supports selector(red) { .panel { display: block; } }",
    });

    expect(analyze(root).rawColorLiterals).toMatchObject({
      count: 2,
      fileCount: 1,
    });
  });

  it("scans productive SVG and MJS source files", () => {
    const root = createFixture({
      "src/icon.svg": '<svg><path fill="#fff" /></svg>',
      "src/palette.mjs": "export const style = { color: 'red' };",
    });
    const analysis = analyze(root);

    expect(analysis.sourceFileCount).toBe(2);
    expect(analysis.rawColorLiterals).toMatchObject({ count: 2, fileCount: 2 });
  });

  it("finds custom-property references in non-colour SVG attributes", () => {
    const root = createFixture({
      "src/icon.svg":
        '<svg><path stroke-width="var(--missing-width)" opacity="var(--missing-opacity)" /></svg>',
    });

    expect(analyze(root).undefinedReferences).toEqual([
      { name: "--missing-opacity", path: "src/icon.svg" },
      { name: "--missing-width", path: "src/icon.svg" },
    ]);
    expect(analyze(root).rawColorLiterals).toMatchObject({
      count: 0,
      fileCount: 0,
    });
  });

  it("rejects named colours in TSX SVG attributes", () => {
    const root = createFixture({
      "src/icon.tsx": "export const Icon = () => <path fill='none' />;",
    });
    const baseline = createDesignTokenIntegrityBaseline(analyze(root));
    fs.writeFileSync(
      path.join(root, "src/icon.tsx"),
      "export const Icon = () => <path fill='red' stroke='white' />;",
      "utf8",
    );

    const analysis = analyze(root);
    expect(analysis.rawColorLiterals).toMatchObject({ count: 2, fileCount: 1 });
    expect(validateDesignTokenIntegrity({ analysis, baseline })).toEqual(
      expect.arrayContaining([
        expect.stringContaining("rawColorLiterals.count"),
        expect.stringContaining("rawColorLiterals.digest"),
      ]),
    );
  });

  it("rejects named colours inside TSX expression and conditional style values", () => {
    const root = createFixture({
      "src/icon.tsx": "export const Icon = () => <path fill={'none'} />;",
    });
    const baseline = createDesignTokenIntegrityBaseline(analyze(root));
    fs.writeFileSync(
      path.join(root, "src/icon.tsx"),
      "export const Icon = ({ active }) => <path fill={active ? 'red' : 'white'} style={{ stroke: active ? 'blue' : 'black' }} />;",
      "utf8",
    );

    const analysis = analyze(root);
    expect(analysis.rawColorLiterals).toMatchObject({ count: 4, fileCount: 1 });
    expect(validateDesignTokenIntegrity({ analysis, baseline })).toEqual(
      expect.arrayContaining([
        expect.stringContaining("rawColorLiterals.count"),
        expect.stringContaining("rawColorLiterals.digest"),
      ]),
    );
  });

  it("rejects named colours supplied to JSX styles through a local constant", () => {
    const root = createFixture({
      "src/icon.tsx":
        'const accent = "inherit"; export const Icon = () => <path fill={accent} />;',
    });
    const baseline = createDesignTokenIntegrityBaseline(analyze(root));
    fs.writeFileSync(
      path.join(root, "src/icon.tsx"),
      'const accent = "red"; export const Icon = () => <path fill={accent} />;',
      "utf8",
    );

    const analysis = analyze(root);
    expect(analysis.rawColorLiterals.count).toBe(
      baseline.rawColorLiterals.count + 1,
    );
    expect(validateDesignTokenIntegrity({ analysis, baseline })).toEqual(
      expect.arrayContaining([
        expect.stringContaining("rawColorLiterals.count"),
        expect.stringContaining("rawColorLiterals.digest"),
      ]),
    );
  });

  it("records every style use of an imported colour constant", () => {
    const root = createFixture({
      "src/palette.ts": 'export const accent = "#fff";',
      "src/panel.tsx":
        'import { accent } from "./palette"; export const style = { color: accent };',
    });
    const baseline = createDesignTokenIntegrityBaseline(analyze(root));
    fs.writeFileSync(
      path.join(root, "src/secondary-panel.tsx"),
      'import { accent as secondaryAccent } from "./palette"; export const style = { borderColor: secondaryAccent };',
      "utf8",
    );

    const analysis = analyze(root);
    expect(analysis.rawColorLiterals.count).toBe(
      baseline.rawColorLiterals.count + 1,
    );
    expect(validateDesignTokenIntegrity({ analysis, baseline })).toEqual(
      expect.arrayContaining([
        expect.stringContaining("rawColorLiterals.count"),
        expect.stringContaining("rawColorLiterals.digest"),
      ]),
    );
  });

  it("records every style site backed by the same local colour constant", () => {
    const root = createFixture({
      "src/panel.tsx":
        'const accent = "#fff"; export const panel = { color: accent };',
    });
    const baseline = createDesignTokenIntegrityBaseline(analyze(root));
    fs.writeFileSync(
      path.join(root, "src/panel.tsx"),
      'const accent = "#fff"; export const panel = { color: accent, backgroundColor: accent };',
      "utf8",
    );

    const analysis = analyze(root);
    expect(analysis.rawColorLiterals.count).toBe(
      baseline.rawColorLiterals.count + 1,
    );
    expect(validateDesignTokenIntegrity({ analysis, baseline })).toEqual(
      expect.arrayContaining([
        expect.stringContaining("rawColorLiterals.count"),
        expect.stringContaining("rawColorLiterals.digest"),
      ]),
    );
  });

  it("rejects named colours in generated inline-style markup", () => {
    const root = createFixture({
      "src/tooltip.ts":
        'export const tooltip = (label) => `<div style="color:var(--text)">${label}</div>`;',
      "src/styles/global/tokens.css": ":root { --text: #18262f; }",
    });
    const baseline = createDesignTokenIntegrityBaseline(analyze(root));
    fs.writeFileSync(
      path.join(root, "src/tooltip.ts"),
      'export const tooltip = (label) => `<div style="color:red">${label}</div>`;',
      "utf8",
    );

    const analysis = analyze(root);
    expect(analysis.rawColorLiterals.count).toBe(
      baseline.rawColorLiterals.count + 1,
    );
    expect(validateDesignTokenIntegrity({ analysis, baseline })).toEqual(
      expect.arrayContaining([
        expect.stringContaining("rawColorLiterals.count"),
        expect.stringContaining("rawColorLiterals.digest"),
      ]),
    );
  });

  it("rejects hex and functional colours in generated inline-style markup", () => {
    const root = createFixture({
      "src/tooltip.ts":
        'export const tooltip = `<div style="color:inherit;background:inherit">label</div>`;',
    });
    const baseline = createDesignTokenIntegrityBaseline(analyze(root));
    fs.writeFileSync(
      path.join(root, "src/tooltip.ts"),
      'export const tooltip = `<div style="color:#fff;background:oklch(50% 0.2 120)">label</div>`;',
      "utf8",
    );

    const analysis = analyze(root);
    expect(analysis.rawColorLiterals.count).toBe(
      baseline.rawColorLiterals.count + 2,
    );
    expect(validateDesignTokenIntegrity({ analysis, baseline })).toEqual(
      expect.arrayContaining([
        expect.stringContaining("rawColorLiterals.count"),
        expect.stringContaining("rawColorLiterals.digest"),
      ]),
    );
  });

  it("rejects named colours supplied to generated styles through a local constant", () => {
    const root = createFixture({
      "src/tooltip.ts":
        'const accent = "inherit"; export const tooltip = `<div style="color:${accent}">label</div>`;',
    });
    const baseline = createDesignTokenIntegrityBaseline(analyze(root));
    fs.writeFileSync(
      path.join(root, "src/tooltip.ts"),
      'const accent = "red"; export const tooltip = `<div style="color:${accent}">label</div>`;',
      "utf8",
    );

    const analysis = analyze(root);
    expect(analysis.rawColorLiterals.count).toBe(
      baseline.rawColorLiterals.count + 1,
    );
    expect(validateDesignTokenIntegrity({ analysis, baseline })).toEqual(
      expect.arrayContaining([
        expect.stringContaining("rawColorLiterals.count"),
        expect.stringContaining("rawColorLiterals.digest"),
      ]),
    );
  });

  it("rejects named colours supplied by an imported-style colour registry", () => {
    const root = createFixture({
      "src/chart-colors.ts":
        'export const CHART_COLORS = { portfolio: "inherit" };',
    });
    const baseline = createDesignTokenIntegrityBaseline(analyze(root));
    fs.writeFileSync(
      path.join(root, "src/chart-colors.ts"),
      'export const CHART_COLORS = { portfolio: "red" };',
      "utf8",
    );

    const analysis = analyze(root);
    expect(analysis.rawColorLiterals.count).toBe(
      baseline.rawColorLiterals.count + 1,
    );
    expect(validateDesignTokenIntegrity({ analysis, baseline })).toEqual(
      expect.arrayContaining([
        expect.stringContaining("rawColorLiterals.count"),
        expect.stringContaining("rawColorLiterals.digest"),
      ]),
    );
  });

  it("does not treat product-copy variables as colour registries", () => {
    const root = createFixture({
      "src/status-copy.ts": 'export const colorLabel = "inherit";',
    });
    const baseline = createDesignTokenIntegrityBaseline(analyze(root));
    fs.writeFileSync(
      path.join(root, "src/status-copy.ts"),
      'export const colorLabel = "red";',
      "utf8",
    );

    expect(
      validateDesignTokenIntegrity({ analysis: analyze(root), baseline }),
    ).toEqual([]);
  });

  it("ignores comments embedded inside live CSS declaration values", () => {
    const root = createFixture({
      "src/styles/global/tokens.css": ":root { --text: #18262f; }",
      "src/panel.module.css": ".panel { color: var(--text); }",
    });
    const baseline = createDesignTokenIntegrityBaseline(analyze(root));
    fs.writeFileSync(
      path.join(root, "src/panel.module.css"),
      ".panel { color: /* retired var(--missing), #fff */ var(--text); }",
      "utf8",
    );

    expect(
      validateDesignTokenIntegrity({ analysis: analyze(root), baseline }),
    ).toEqual([]);
  });

  it("rejects a new out-of-layer raw colour even when all variables resolve", () => {
    const root = createFixture({
      "src/styles/global/tokens.css": ":root { --text: #18262f; }",
      "src/panel.module.css": ".panel { color: var(--text); }",
    });
    const baseline = createDesignTokenIntegrityBaseline(analyze(root));
    fs.writeFileSync(
      path.join(root, "src/panel.module.css"),
      ".panel { color: var(--text); background: #ffffff; }",
      "utf8",
    );

    expect(
      validateDesignTokenIntegrity({ analysis: analyze(root), baseline }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("rawColorLiterals.count"),
        expect.stringContaining("rawColorLiterals.digest"),
      ]),
    );
  });

  it("rejects fallback drift without requiring an expensive browser run", () => {
    const root = createFixture({
      "src/styles/global/tokens.css":
        ":root { --text: #18262f; --muted: #5b6872; }",
      "src/panel.module.css": ".panel { color: var(--text, var(--muted)); }",
    });
    const baseline = createDesignTokenIntegrityBaseline(analyze(root));
    fs.writeFileSync(
      path.join(root, "src/panel.module.css"),
      ".panel { color: var(--text); }",
      "utf8",
    );

    expect(
      validateDesignTokenIntegrity({ analysis: analyze(root), baseline }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("variableFallbacks.count"),
        expect.stringContaining("variableFallbacks.digest"),
      ]),
    );
  });

  it("binds fallback evidence to its declaration context", () => {
    const root = createFixture({
      "src/styles/global/tokens.css": ":root { --gap: 0; }",
      "src/panel.module.css":
        ".compact { gap: var(--gap, 1rem); } .wide { gap: var(--gap, 2rem); }",
    });
    const baseline = createDesignTokenIntegrityBaseline(analyze(root));
    fs.writeFileSync(
      path.join(root, "src/panel.module.css"),
      ".compact { gap: var(--gap, 2rem); } .wide { gap: var(--gap, 1rem); }",
      "utf8",
    );

    const analysis = analyze(root);
    expect(analysis.variableFallbacks.count).toBe(
      baseline.variableFallbacks.count,
    );
    expect(analysis.variableFallbacks.digest).toBe(
      baseline.variableFallbacks.digest,
    );
    expect(analysis.variableFallbacks.contextDigest).not.toBe(
      baseline.variableFallbacks.contextDigest,
    );
    expect(validateDesignTokenIntegrity({ analysis, baseline })).toContainEqual(
      expect.stringContaining("variableFallbacks.contextDigest"),
    );
  });

  it("fails closed when the configured source tree has no eligible files", () => {
    const root = createFixture({});
    const analysis = analyze(root);
    const baseline = createDesignTokenIntegrityBaseline(analysis);

    expect(validateDesignTokenIntegrity({ analysis, baseline })).toContain(
      "No eligible source files were scanned; token integrity fails closed.",
    );
  });

  it("rejects a baseline that weakens scanner configuration", () => {
    const root = createFixture({
      "src/styles/global/tokens.css": ":root { --text: #18262f; }",
      "src/panel.module.css": ".panel { color: var(--text); }",
    });
    const analysis = analyze(root);
    const baseline = {
      ...createDesignTokenIntegrityBaseline(analysis),
      rawColorExemptPaths: ["src"],
    };

    expect(validateDesignTokenIntegrity({ analysis, baseline })).toContain(
      "rawColorExemptPaths: baseline configuration must match the governed scanner configuration.",
    );
  });
});
