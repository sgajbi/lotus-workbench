import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Linter, type Rule } from "eslint";
import { afterAll, describe, expect, it } from "vitest";
// @ts-expect-error Repository quality scripts are executable JavaScript modules.
import { NEXT_RULE_NAMES, verifyNextEslintFork } from "../../scripts/quality/check-next-eslint-fork.mjs";

const require = createRequire(import.meta.url);
const plugin = require("../../tools/eslint-plugin-next/dist/index.js") as {
  rules: Record<string, Rule.RuleModule>;
  configs: Record<string, { rules: Record<string, "warn" | "error"> }>;
};
const root = mkdtempSync(join(tmpdir(), "lotus-next-rule-parity-"));
mkdirSync(join(root, "pages"));
writeFileSync(join(root, "pages", "index.jsx"), "export default function Page(){}");
afterAll(() => rmSync(root, { recursive: true, force: true }));

const cases: [string, string, string, string?][] = [
  [
    "google-font-display",
    "<link href=\"https://fonts.googleapis.com/css?family=Roboto&display=optional\" />",
    "<link href=\"https://fonts.googleapis.com/css?family=Roboto\" />"
  ],
  [
    "google-font-preconnect",
    "<link href=\"https://fonts.gstatic.com\" rel=\"preconnect\" />",
    "<link href=\"https://fonts.gstatic.com\" />"
  ],
  [
    "inline-script-id",
    "import Script from \"next/script\"; <Script id=\"analytics\">{`hello`}</Script>",
    "import Script from \"next/script\"; <Script>{`hello`}</Script>"
  ],
  [
    "next-script-for-ga",
    "import Script from \"next/script\"; <Script src=\"https://www.google-analytics.com/analytics.js\" />",
    "<script src=\"https://www.google-analytics.com/analytics.js\" />"
  ],
  [
    "no-assign-module-variable",
    "const localModule = {};",
    "const module = {};"
  ],
  [
    "no-async-client-component",
    "\"use client\"; export default function Page(){return <div/>;}",
    "\"use client\"; export default async function Page(){return <div/>;}"
  ],
  [
    "no-before-interactive-script-outside-document",
    "import Script from \"next/script\"; <Script strategy=\"afterInteractive\" src=\"/script.js\"/>",
    "import Script from \"next/script\"; <Script strategy=\"beforeInteractive\" src=\"/script.js\"/>"
  ],
  [
    "no-css-tags",
    "<link rel=\"preload\" href=\"/styles.css\"/>",
    "<link rel=\"stylesheet\" href=\"/styles.css\"/>"
  ],
  [
    "no-document-import-in-page",
    "import Head from \"next/head\";",
    "import Document from \"next/document\";"
  ],
  [
    "no-duplicate-head",
    "import Document,{Head} from \"next/document\"; class Page extends Document {render(){return <div><Head/></div>}}",
    "import Document,{Head} from \"next/document\"; class Page extends Document {render(){return <div><Head/><Head/></div>}}"
  ],
  [
    "no-head-element",
    "<header/>",
    "<head/>"
  ],
  [
    "no-head-import-in-document",
    "import {Head} from \"next/document\";",
    "import Head from \"next/head\";",
    "pages/_document.jsx"
  ],
  [
    "no-html-link-for-pages",
    "import Link from \"next/link\"; <Link href=\"/\">Home</Link>",
    "<a href=\"/\">Home</a>"
  ],
  [
    "no-img-element",
    "<Image src=\"/photo.png\" alt=\"Photo\"/>",
    "<img src=\"/photo.png\" alt=\"Photo\"/>"
  ],
  [
    "no-page-custom-font",
    "<link href=\"/fonts.css\"/>",
    "<link href=\"https://fonts.googleapis.com/css?family=Roboto\"/>"
  ],
  [
    "no-script-component-in-head",
    "import Head from \"next/head\"; import Script from \"next/script\"; <><Head/><Script src=\"/s.js\"/></>",
    "import Head from \"next/head\"; import Script from \"next/script\"; <Head><Script src=\"/s.js\"/></Head>"
  ],
  [
    "no-styled-jsx-in-document",
    "<style>{`body {color: red}`}</style>",
    "<style jsx>{`body {color: red}`}</style>",
    "pages/_document.jsx"
  ],
  [
    "no-sync-scripts",
    "<script async src=\"/s.js\"/>",
    "<script src=\"/s.js\"/>"
  ],
  [
    "no-title-in-document-head",
    "import {Head} from \"next/document\"; <Head><meta name=\"viewport\"/></Head>",
    "import {Head} from \"next/document\"; <Head><title>Page</title></Head>"
  ],
  [
    "no-typos",
    "export function getStaticProps(){}",
    "export function getStaticProp(){}"
  ],
  [
    "no-unwanted-polyfillio",
    "<script src=\"https://polyfill.io/v3/polyfill.min.js?features=Intl\"/>",
    "<script src=\"https://polyfill.io/v3/polyfill.min.js?features=Promise\"/>"
  ]
];
function lint(rule: string, code: string, filename = "pages/index.jsx", directory = root) {
  return new Linter({ cwd: root }).verify(code, [{
    files: ["**/*.jsx"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { "@next/next": plugin },
    settings: { next: { rootDir: directory } },
    rules: { ["@next/next/" + rule]: "error" },
  }], { filename: join(root, filename) });
}
describe("maintained Next rule behavioral parity", () => {
  it("binds every exported rule and unchanged config to verified upstream bytes", () => {
    expect(verifyNextEslintFork(resolve("tools/eslint-plugin-next"), { today: "2026-10-04" })).toEqual({ rules: 21, files: 52 });
    expect(Object.keys(plugin.rules).sort()).toEqual([...NEXT_RULE_NAMES].sort());
    expect(cases.map((entry) => entry[0]).sort()).toEqual([...NEXT_RULE_NAMES].sort());
    expect(Object.keys(plugin.configs.recommended.rules)).toHaveLength(21);
    expect(plugin.configs["core-web-vitals"].rules["@next/next/no-html-link-for-pages"]).toBe("error");
  });
  it.each(cases)("admits valid AST and reports invalid AST for %s", (rule, valid, invalid, filename) => {
    expect(lint(rule, valid, filename)).toEqual([]);
    const messages = lint(rule, invalid, filename);
    expect(messages).toHaveLength(1);
    expect(messages[0].fatal).not.toBe(true);
    expect(messages[0].ruleId).toBe("@next/next/" + rule);
    expect(messages[0].severity).toBe(2);
  });
  it.each(["pages", "app"])("retains internal anchor denial for %s routes", (kind) => {
    const routeRoot = mkdtempSync(join(tmpdir(), "lotus-next-route-"));
    try {
      mkdirSync(join(routeRoot, kind));
      writeFileSync(join(routeRoot, kind, kind === "app" ? "page.jsx" : "index.jsx"), "export default function Page(){}");
      expect(lint("no-html-link-for-pages", '<a href="/">Home</a>', "pages/index.jsx", routeRoot)[0].ruleId).toBe("@next/next/no-html-link-for-pages");
      for (const code of ['<a href="https://example.com/">External</a>', '<a href="#heading">Anchor</a>', 'import Link from "next/link"; <Link href="/">Home</Link>']) {
        expect(lint("no-html-link-for-pages", code, "pages/index.jsx", routeRoot)).toEqual([]);
      }
    } finally { rmSync(routeRoot, { recursive: true, force: true }); }
  });
});
