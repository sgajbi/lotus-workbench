import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import postcss from "postcss";
import valueParser from "postcss-value-parser";
import ts from "typescript";

const SOURCE_EXTENSIONS = new Set([".css", ".mjs", ".svg", ".ts", ".tsx"]);
const HEX_COLOR_PATTERN =
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g;
const RAW_COLOR_FUNCTIONS = new Set([
  "color",
  "color-mix",
  "hsl",
  "hsla",
  "hwb",
  "lab",
  "lch",
  "light-dark",
  "oklab",
  "oklch",
  "rgb",
  "rgba",
]);
const CSS_NAMED_COLORS = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
  blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk
  crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki
  darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
  darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue
  dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite
  gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
  lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
  lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
  lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen
  magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen
  mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream
  mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
  palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum
  powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown
  seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen
  steelblue tan teal thistle tomato transparent turquoise violet wheat white whitesmoke
  yellow yellowgreen`.split(/\s+/),
);
const TYPESCRIPT_COLOR_BEARING_PROPERTIES = new Set([
  "accentcolor",
  "backdropfilter",
  "background",
  "backgroundcolor",
  "backgroundimage",
  "border",
  "borderblock",
  "borderblockcolor",
  "borderblockend",
  "borderblockendcolor",
  "borderblockstart",
  "borderblockstartcolor",
  "borderbottom",
  "borderbottomcolor",
  "bordercolor",
  "borderimage",
  "borderimagesource",
  "borderinline",
  "borderinlinecolor",
  "borderinlineend",
  "borderinlineendcolor",
  "borderinlinestart",
  "borderinlinestartcolor",
  "borderleft",
  "borderleftcolor",
  "borderright",
  "borderrightcolor",
  "bordertop",
  "bordertopcolor",
  "boxshadow",
  "caretcolor",
  "color",
  "columnrule",
  "columnrulecolor",
  "fill",
  "filter",
  "floodcolor",
  "lightingcolor",
  "liststyle",
  "liststyleimage",
  "mask",
  "maskborder",
  "maskbordersource",
  "maskimage",
  "outline",
  "outlinecolor",
  "scrollbarcolor",
  "stroke",
  "stopcolor",
  "textdecoration",
  "textdecorationcolor",
  "textemphasis",
  "textemphasiscolor",
  "textfillcolor",
  "textshadow",
  "textstroke",
  "textstrokecolor",
  "webkittextfillcolor",
  "webkittextstroke",
  "webkittextstrokecolor",
]);
const TYPESCRIPT_EMBEDDED_COLOR_PROPERTIES = new Set([
  "backdropfilter",
  "backgroundimage",
  "borderimage",
  "borderimagesource",
  "filter",
  "liststyleimage",
  "mask",
  "maskborder",
  "maskbordersource",
  "maskimage",
]);
const EMBEDDED_NAMED_COLOR_FUNCTIONS = new Set([
  "cross-fade",
  "drop-shadow",
  "image",
]);
const SVG_COLOR_ATTRIBUTES = new Set([
  "color",
  "fill",
  "flood-color",
  "lighting-color",
  "stop-color",
  "stroke",
]);

export const DEFAULT_TOKEN_INTEGRITY_CONFIG = {
  sourceRoot: "src",
  baselinePath: "scripts/quality/design-token-integrity-baseline.json",
  rawColorExemptPaths: [
    "src/design-system/theme/tokens.ts",
    "src/styles/global/tokens.css",
  ],
  runtimeDefinedCustomProperties: [
    "--analytics-table-pinned-background",
    "--font-lotus-display-face",
    "--font-lotus-mono-face",
    "--font-lotus-ui-face",
  ],
};

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function walkSourceFiles(rootPath) {
  if (!fs.existsSync(rootPath)) {
    return [];
  }

  const files = [];
  const pending = [rootPath];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
      } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(entryPath);
      }
    }
  }
  return files.sort();
}

function digestOccurrences(occurrences) {
  const canonical = [...occurrences].sort().join("\n");
  return `sha256:${crypto.createHash("sha256").update(canonical).digest("hex")}`;
}

function canonicalizeEvidenceContext(value) {
  return value.replace(/\r\n?/g, "\n").replace(/\s+/g, " ").trim();
}

function extractCustomPropertyReferences(content) {
  const references = [];
  valueParser(content).walk((node) => {
    if (node.type !== "function" || node.value.toLowerCase() !== "var") {
      return;
    }
    const commaIndex = node.nodes.findIndex(
      (child) => child.type === "div" && child.value === ",",
    );
    const name = valueParser
      .stringify(commaIndex < 0 ? node.nodes : node.nodes.slice(0, commaIndex))
      .trim();
    if (!name.startsWith("--")) {
      return;
    }
    const fallback =
      commaIndex < 0
        ? null
        : valueParser.stringify(node.nodes.slice(commaIndex + 1)).trim();
    references.push({
      name,
      fallback: fallback ? fallback.replace(/\s+/g, " ") : null,
    });
  });
  return references;
}

function extractAtRuleDeclarationValues(atRuleName, params) {
  if (atRuleName.toLowerCase() !== "supports") {
    return [];
  }
  const values = [];
  valueParser(params).walk((node) => {
    if (node.type !== "function" || node.value !== "") {
      return;
    }
    const colonIndex = node.nodes.findIndex(
      (child) => child.type === "div" && child.value === ":",
    );
    if (colonIndex >= 0) {
      values.push(
        valueParser.stringify(node.nodes.slice(colonIndex + 1)).trim(),
      );
    }
  });
  return values;
}

function extractRawColors(
  value,
  { includeNamedColors = false, namedColorsInFunctionsOnly = false } = {},
) {
  const colors = [];
  for (const match of value.matchAll(HEX_COLOR_PATTERN)) {
    colors.push(match[0]);
  }
  const parsed = valueParser(value);
  parsed.walk((node) => {
    if (
      node.type === "function" &&
      RAW_COLOR_FUNCTIONS.has(node.value.toLowerCase())
    ) {
      colors.push(valueParser.stringify(node));
    }
    if (
      includeNamedColors &&
      !namedColorsInFunctionsOnly &&
      node.type === "word" &&
      CSS_NAMED_COLORS.has(node.value.toLowerCase())
    ) {
      colors.push(node.value);
    }
  });
  if (includeNamedColors && namedColorsInFunctionsOnly) {
    const collectNamedColors = (nodes, insideColorFunction = false) => {
      for (const node of nodes) {
        const functionName =
          node.type === "function" ? node.value.toLowerCase() : "";
        const nextInsideColorFunction =
          insideColorFunction ||
          EMBEDDED_NAMED_COLOR_FUNCTIONS.has(functionName) ||
          functionName.endsWith("gradient");
        if (
          nextInsideColorFunction &&
          node.type === "word" &&
          CSS_NAMED_COLORS.has(node.value.toLowerCase())
        ) {
          colors.push(node.value);
        }
        if (node.type === "function") {
          collectNamedColors(node.nodes, nextInsideColorFunction);
        }
      }
    };
    collectNamedColors(parsed.nodes);
  }
  return colors;
}

function recordValueEvidence({
  value,
  relativePath,
  references,
  fallbackOccurrences,
  fallbackContextOccurrences,
  rawColorOccurrences,
  rawColorFiles,
  collectRawColors,
  includeNamedColors = false,
  namedColorsInFunctionsOnly = false,
  collectReferences = true,
  recordRawColors = true,
  evidenceContext = "unscoped",
  rawColorEvidenceContext = evidenceContext,
}) {
  if (collectReferences) {
    for (const reference of extractCustomPropertyReferences(value)) {
      references.push({ name: reference.name, path: relativePath });
      if (reference.fallback) {
        fallbackOccurrences.push(
          `${relativePath}\u0000${reference.name}\u0000${reference.fallback}`,
        );
        fallbackContextOccurrences.push(
          `${relativePath}\u0000${canonicalizeEvidenceContext(evidenceContext)}\u0000${reference.name}\u0000${reference.fallback}`,
        );
      }
    }
  }

  if (!collectRawColors || !recordRawColors) {
    return;
  }
  for (const color of extractRawColors(value, {
    includeNamedColors,
    namedColorsInFunctionsOnly,
  })) {
    rawColorFiles.add(relativePath);
    rawColorOccurrences.push(
      `${relativePath}\u0000${canonicalizeEvidenceContext(rawColorEvidenceContext)}\u0000${color.toLowerCase().replace(/\s+/g, " ")}`,
    );
  }
}

function readTypeScriptPropertyName(name) {
  if (ts.isIdentifier(name)) {
    return name.text;
  }
  if (ts.isStringLiteralLike(name)) {
    return name.text;
  }
  if (
    ts.isComputedPropertyName(name) &&
    ts.isStringLiteralLike(name.expression)
  ) {
    return name.expression.text;
  }
  return null;
}

function typeScriptScriptKind(filePath) {
  if (filePath.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }
  if (filePath.endsWith(".mjs")) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function parseTypeScriptSource(filePath, content) {
  return ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    typeScriptScriptKind(filePath),
  );
}

function collectStaticStringValues(
  node,
  constInitializers,
  resolving = new Set(),
) {
  if (ts.isStringLiteralLike(node)) {
    return [node.text];
  }
  if (ts.isIdentifier(node)) {
    if (resolving.has(node.text)) {
      return [];
    }
    const initializer = constInitializers.get(node.text);
    return initializer
      ? collectStaticStringValues(
          initializer,
          constInitializers,
          new Set([...resolving, node.text]),
        )
      : [];
  }
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node)
  ) {
    return collectStaticStringValues(
      node.expression,
      constInitializers,
      resolving,
    );
  }
  if (ts.isConditionalExpression(node)) {
    return [
      ...collectStaticStringValues(node.whenTrue, constInitializers, resolving),
      ...collectStaticStringValues(
        node.whenFalse,
        constInitializers,
        resolving,
      ),
    ];
  }
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    return [
      ...collectStaticStringValues(node.left, constInitializers, resolving),
      ...collectStaticStringValues(node.right, constInitializers, resolving),
    ];
  }
  if (ts.isTemplateExpression(node)) {
    return [
      node.head.text,
      ...node.templateSpans.flatMap((span) => [
        ...collectStaticStringValues(
          span.expression,
          constInitializers,
          resolving,
        ),
        span.literal.text,
      ]),
    ];
  }
  return [];
}

function buildStaticModuleExportIndex(sourceFiles) {
  const moduleExports = new Map();
  for (const absolutePath of sourceFiles) {
    const extension = path.extname(absolutePath).toLowerCase();
    if (![".mjs", ".ts", ".tsx"].includes(extension)) {
      continue;
    }
    const sourceFile = parseTypeScriptSource(
      absolutePath,
      fs.readFileSync(absolutePath, "utf8"),
    );
    const constInitializers = new Map();
    for (const statement of sourceFile.statements) {
      if (!ts.isVariableStatement(statement)) {
        continue;
      }
      if ((statement.declarationList.flags & ts.NodeFlags.Const) === 0) {
        continue;
      }
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer) {
          constInitializers.set(declaration.name.text, declaration.initializer);
        }
      }
    }

    const exports = new Map();
    for (const statement of sourceFile.statements) {
      const isExported = statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      );
      if (isExported && ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name) && declaration.initializer) {
            exports.set(
              declaration.name.text,
              collectStaticStringValues(
                declaration.initializer,
                constInitializers,
              ),
            );
          }
        }
      } else if (
        ts.isExportDeclaration(statement) &&
        !statement.moduleSpecifier &&
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause)
      ) {
        for (const element of statement.exportClause.elements) {
          const localName = element.propertyName?.text ?? element.name.text;
          const initializer = constInitializers.get(localName);
          if (initializer) {
            exports.set(
              element.name.text,
              collectStaticStringValues(initializer, constInitializers),
            );
          }
        }
      } else if (ts.isExportAssignment(statement)) {
        exports.set(
          "default",
          collectStaticStringValues(statement.expression, constInitializers),
        );
      }
    }
    moduleExports.set(path.resolve(absolutePath).toLowerCase(), exports);
  }
  return moduleExports;
}

function createStaticImportResolver(sourceFiles, absoluteSourceRoot) {
  const moduleExports = buildStaticModuleExportIndex(sourceFiles);
  const extensions = ["", ".ts", ".tsx", ".mjs"];
  return (importerPath, moduleSpecifier, exportName) => {
    if (!moduleSpecifier.startsWith(".") && !moduleSpecifier.startsWith("@/")) {
      return [];
    }
    const basePath = moduleSpecifier.startsWith("@/")
      ? path.resolve(absoluteSourceRoot, moduleSpecifier.slice(2))
      : path.resolve(path.dirname(importerPath), moduleSpecifier);
    const baseWithoutJavaScriptExtension = basePath.replace(/\.m?js$/i, "");
    const candidates = [];
    for (const extension of extensions) {
      candidates.push(`${baseWithoutJavaScriptExtension}${extension}`);
      candidates.push(
        path.join(baseWithoutJavaScriptExtension, `index${extension}`),
      );
    }
    for (const candidate of candidates) {
      const exports = moduleExports.get(path.resolve(candidate).toLowerCase());
      if (exports?.has(exportName)) {
        return exports.get(exportName);
      }
    }
    return [];
  };
}

function analyzeTypeScriptSource({
  content,
  absolutePath,
  relativePath,
  recordValue,
  recordGeneratedStyleValue,
  resolveStaticImport,
}) {
  const sourceFile = parseTypeScriptSource(relativePath, content);
  const constInitializers = new Map();
  const importedStaticValues = new Map();

  function enclosingLexicalScope(node) {
    let current = node.parent;
    while (current) {
      if (
        ts.isBlock(current) ||
        ts.isModuleBlock(current) ||
        ts.isSourceFile(current)
      ) {
        return current;
      }
      current = current.parent;
    }
    return sourceFile;
  }

  function indexConstInitializers(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      const entries = constInitializers.get(node.name.text) ?? [];
      entries.push({
        initializer: node.initializer,
        position: node.pos,
        scope: enclosingLexicalScope(node),
      });
      constInitializers.set(node.name.text, entries);
    }
    ts.forEachChild(node, indexConstInitializers);
  }

  indexConstInitializers(sourceFile);

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.importClause ||
      statement.importClause.isTypeOnly
    ) {
      continue;
    }
    const moduleSpecifier = statement.moduleSpecifier.text;
    if (statement.importClause.name) {
      importedStaticValues.set(
        statement.importClause.name.text,
        resolveStaticImport(absolutePath, moduleSpecifier, "default"),
      );
    }
    const bindings = statement.importClause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if (element.isTypeOnly) {
          continue;
        }
        importedStaticValues.set(
          element.name.text,
          resolveStaticImport(
            absolutePath,
            moduleSpecifier,
            element.propertyName?.text ?? element.name.text,
          ),
        );
      }
    }
  }

  function containingStyleProperty(node) {
    let current = node.parent;
    while (current && !ts.isSourceFile(current)) {
      if (ts.isPropertyAssignment(current)) {
        return readTypeScriptPropertyName(current.name);
      }
      if (ts.isJsxAttribute(current)) {
        return current.name.getText(sourceFile);
      }
      current = current.parent;
    }
    return null;
  }

  function styleEvidenceContext(node) {
    const segments = [];
    let current = node.parent;
    while (current && !ts.isSourceFile(current)) {
      if (ts.isPropertyAssignment(current)) {
        const propertyName = readTypeScriptPropertyName(current.name);
        if (propertyName) {
          segments.push(`property:${propertyName}`);
        }
      } else if (ts.isJsxAttribute(current)) {
        segments.push(`jsx-attribute:${current.name.getText(sourceFile)}`);
      } else if (
        ts.isVariableDeclaration(current) &&
        ts.isIdentifier(current.name)
      ) {
        segments.push(`variable:${current.name.text}`);
      } else if (
        (ts.isFunctionDeclaration(current) ||
          ts.isFunctionExpression(current) ||
          ts.isMethodDeclaration(current)) &&
        current.name
      ) {
        segments.push(`function:${current.name.getText(sourceFile)}`);
      }
      current = current.parent;
    }
    return segments.reverse().join("/") || "typescript-style";
  }

  function belongsToColorRegistry(node) {
    let current = node.parent;
    while (current && !ts.isSourceFile(current)) {
      if (
        ts.isVariableDeclaration(current) &&
        ts.isIdentifier(current.name) &&
        /colou?rs?$/i.test(current.name.text)
      ) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  function recordGeneratedStyleMarkup(markup) {
    const expressionContexts = new Map();
    for (const match of markup.matchAll(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/gi)) {
      let root;
      try {
        root = postcss.parse(`generated { ${match[2]} }`);
      } catch {
        continue;
      }
      root.walkDecls((declaration) => {
        const evidenceContext = `generated-style:${declaration.prop}`;
        recordGeneratedStyleValue(declaration.value, evidenceContext);
        for (const marker of declaration.value.matchAll(
          /__lotus_style_expr_(\d+)__/g,
        )) {
          expressionContexts.set(Number(marker[1]), evidenceContext);
        }
      });
      for (const marker of match[2].matchAll(/__lotus_style_expr_(\d+)__/g)) {
        const expressionIndex = Number(marker[1]);
        if (!expressionContexts.has(expressionIndex)) {
          expressionContexts.set(expressionIndex, "generated-style");
        }
      }
    }
    return expressionContexts;
  }

  function findVisibleConstInitializer(identifier) {
    const visibleScopes = new Set();
    let current = identifier.parent;
    while (current) {
      if (
        ts.isBlock(current) ||
        ts.isModuleBlock(current) ||
        ts.isSourceFile(current)
      ) {
        visibleScopes.add(current);
      }
      current = current.parent;
    }
    return (constInitializers.get(identifier.text) ?? [])
      .filter(
        (entry) =>
          entry.position < identifier.pos && visibleScopes.has(entry.scope),
      )
      .sort((left, right) => right.position - left.position)[0]?.initializer;
  }

  function recordGeneratedStyleExpression(
    node,
    evidenceContext,
    resolving = new Set(),
    evidenceOptions = {},
  ) {
    if (ts.isStringLiteralLike(node)) {
      recordGeneratedStyleValue(node.text, evidenceContext, evidenceOptions);
      return;
    }
    if (ts.isIdentifier(node)) {
      if (resolving.has(node.text)) {
        return;
      }
      const initializer = findVisibleConstInitializer(node);
      if (initializer) {
        recordGeneratedStyleExpression(
          initializer,
          evidenceContext,
          new Set([...resolving, node.text]),
          evidenceOptions,
        );
      }
      return;
    }
    ts.forEachChild(node, (child) =>
      recordGeneratedStyleExpression(
        child,
        evidenceContext,
        resolving,
        evidenceOptions,
      ),
    );
  }

  function isIdentifierValueReference(node) {
    const parent = node.parent;
    return !(
      (ts.isVariableDeclaration(parent) && parent.name === node) ||
      (ts.isPropertyAssignment(parent) && parent.name === node) ||
      (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
      (ts.isJsxAttribute(parent) && parent.name === node) ||
      (ts.isBindingElement(parent) && parent.name === node)
    );
  }

  function recordStyleIdentifierInitializer(
    identifier,
    evidenceContext,
    evidenceOptions,
    resolving = new Set(),
  ) {
    if (resolving.has(identifier.text)) {
      return;
    }
    const initializer = findVisibleConstInitializer(identifier);
    if (!initializer) {
      for (const value of importedStaticValues.get(identifier.text) ?? []) {
        recordGeneratedStyleValue(value, evidenceContext, evidenceOptions);
      }
      return;
    }
    if (belongsToColorRegistry(initializer)) {
      return;
    }
    recordGeneratedStyleExpression(
      initializer,
      evidenceContext,
      new Set([...resolving, identifier.text]),
      evidenceOptions,
    );
  }

  function visit(node) {
    if (ts.isTemplateExpression(node)) {
      const styleExpressionContexts = recordGeneratedStyleMarkup(
        node.head.text +
          node.templateSpans
            .map(
              (span, index) =>
                `__lotus_style_expr_${index}__${span.literal.text}`,
            )
            .join(""),
      );
      for (const [
        expressionIndex,
        evidenceContext,
      ] of styleExpressionContexts) {
        const expression = node.templateSpans[expressionIndex]?.expression;
        if (expression) {
          recordGeneratedStyleExpression(expression, evidenceContext);
        }
      }
    } else if (ts.isStringLiteralLike(node)) {
      recordGeneratedStyleMarkup(node.text);
    }
    if (
      ts.isStringLiteralLike(node) ||
      node.kind === ts.SyntaxKind.TemplateHead ||
      node.kind === ts.SyntaxKind.TemplateMiddle ||
      node.kind === ts.SyntaxKind.TemplateTail
    ) {
      const normalizedProperty = containingStyleProperty(node)
        ?.replaceAll("-", "")
        .toLowerCase();
      const isStyleValue =
        (normalizedProperty !== undefined &&
          TYPESCRIPT_COLOR_BEARING_PROPERTIES.has(normalizedProperty)) ||
        belongsToColorRegistry(node);
      recordValue(node.text, {
        includeNamedColors: isStyleValue,
        namedColorsInFunctionsOnly:
          normalizedProperty !== undefined &&
          TYPESCRIPT_EMBEDDED_COLOR_PROPERTIES.has(normalizedProperty),
        recordRawColors: isStyleValue,
        evidenceContext: styleEvidenceContext(node),
      });
    }
    if (ts.isIdentifier(node) && isIdentifierValueReference(node)) {
      const normalizedProperty = containingStyleProperty(node)
        ?.replaceAll("-", "")
        .toLowerCase();
      if (
        normalizedProperty !== undefined &&
        TYPESCRIPT_COLOR_BEARING_PROPERTIES.has(normalizedProperty)
      ) {
        recordStyleIdentifierInitializer(node, styleEvidenceContext(node), {
          namedColorsInFunctionsOnly:
            TYPESCRIPT_EMBEDDED_COLOR_PROPERTIES.has(normalizedProperty),
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function analyzeCssSource({ content, relativePath, definitions, recordValue }) {
  let root;
  try {
    root = postcss.parse(content, { from: relativePath });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${relativePath}: CSS parsing failed: ${detail}`);
  }

  const declarationContexts = new Map();
  const declarationOccurrences = new Map();
  const contextForDeclaration = (declaration) => {
    const contexts = [`property:${declaration.prop}`];
    let ancestor = declaration.parent;
    while (ancestor && ancestor !== root) {
      if (ancestor.type === "rule") {
        contexts.push(`selector:${ancestor.selector}`);
      } else if (ancestor.type === "atrule") {
        contexts.push(`@${ancestor.name}:${ancestor.params}`);
      }
      ancestor = ancestor.parent;
    }
    return contexts.reverse().join("/");
  };
  root.walkDecls((declaration) => {
    const context = contextForDeclaration(declaration);
    declarationContexts.set(
      context,
      (declarationContexts.get(context) ?? 0) + 1,
    );
  });

  root.walkDecls((declaration) => {
    if (declaration.prop.startsWith("--")) {
      definitions.add(declaration.prop);
    }
    const evidenceContext = contextForDeclaration(declaration);
    const occurrence = declarationOccurrences.get(evidenceContext) ?? 0;
    declarationOccurrences.set(evidenceContext, occurrence + 1);
    recordValue(declaration.value, {
      includeNamedColors: true,
      evidenceContext,
      rawColorEvidenceContext:
        declarationContexts.get(evidenceContext) > 1
          ? `${evidenceContext}/occurrence:${occurrence}`
          : evidenceContext,
    });
  });
  root.walkAtRules((atRule) => {
    if (atRule.name.toLowerCase() === "property") {
      const propertyName = atRule.params.trim().split(/\s+/, 1)[0];
      if (propertyName?.startsWith("--")) {
        definitions.add(propertyName);
      }
    }
    recordValue(atRule.params, {
      recordRawColors: false,
      evidenceContext: `at-rule:${atRule.name}`,
    });
    for (const declarationValue of extractAtRuleDeclarationValues(
      atRule.name,
      atRule.params,
    )) {
      recordValue(declarationValue, {
        collectReferences: false,
        includeNamedColors: true,
        evidenceContext: `at-rule:${atRule.name}:declaration-value`,
      });
    }
  });
}

function analyzeSvgSource({ content, relativePath, definitions, recordValue }) {
  const uncommented = content.replace(/<!--[\s\S]*?-->/g, "");
  for (const match of uncommented.matchAll(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
  )) {
    analyzeCssSource({
      content: match[1],
      relativePath,
      definitions,
      recordValue,
    });
  }

  const attributePattern = /\b([a-z][a-z0-9:-]*)\s*=\s*(["'])([\s\S]*?)\2/gi;
  for (const match of uncommented.matchAll(attributePattern)) {
    const attributeName = match[1].toLowerCase();
    const attributeValue = match[3];
    if (attributeName === "style") {
      analyzeCssSource({
        content: `svg { ${attributeValue} }`,
        relativePath,
        definitions,
        recordValue,
      });
    } else if (SVG_COLOR_ATTRIBUTES.has(attributeName)) {
      recordValue(attributeValue, {
        includeNamedColors: true,
        evidenceContext: `svg-attribute:${attributeName}`,
      });
    } else {
      recordValue(attributeValue, {
        recordRawColors: false,
        evidenceContext: `svg-attribute:${attributeName}`,
      });
    }
  }
}

export function analyzeDesignTokenIntegrity({
  repoRoot,
  sourceRoot = DEFAULT_TOKEN_INTEGRITY_CONFIG.sourceRoot,
  rawColorExemptPaths = DEFAULT_TOKEN_INTEGRITY_CONFIG.rawColorExemptPaths,
  runtimeDefinedCustomProperties = DEFAULT_TOKEN_INTEGRITY_CONFIG.runtimeDefinedCustomProperties,
}) {
  const absoluteSourceRoot = path.resolve(repoRoot, sourceRoot);
  const sourceFiles = walkSourceFiles(absoluteSourceRoot);
  const resolveStaticImport = createStaticImportResolver(
    sourceFiles,
    absoluteSourceRoot,
  );
  const definitions = new Set(runtimeDefinedCustomProperties);
  const references = [];
  const rawColorOccurrences = [];
  const fallbackOccurrences = [];
  const fallbackContextOccurrences = [];
  const rawColorFiles = new Set();
  const exemptPaths = new Set(rawColorExemptPaths.map(normalizePath));

  for (const absolutePath of sourceFiles) {
    const relativePath = normalizePath(path.relative(repoRoot, absolutePath));
    const content = fs.readFileSync(absolutePath, "utf8");
    const recordValue = (value, options = {}) =>
      recordValueEvidence({
        value,
        relativePath,
        references,
        fallbackOccurrences,
        fallbackContextOccurrences,
        rawColorOccurrences,
        rawColorFiles,
        collectRawColors: !exemptPaths.has(relativePath),
        ...options,
      });
    const recordGeneratedStyleValue = (
      value,
      evidenceContext = "generated-style",
      options = {},
    ) =>
      recordValueEvidence({
        value,
        relativePath,
        references,
        fallbackOccurrences,
        fallbackContextOccurrences,
        rawColorOccurrences,
        rawColorFiles,
        collectRawColors: !exemptPaths.has(relativePath),
        includeNamedColors: true,
        collectReferences: false,
        evidenceContext,
        ...options,
      });

    const extension = path.extname(absolutePath).toLowerCase();
    if (extension === ".css") {
      analyzeCssSource({ content, relativePath, definitions, recordValue });
    } else if (extension === ".svg") {
      analyzeSvgSource({ content, relativePath, definitions, recordValue });
    } else {
      analyzeTypeScriptSource({
        content,
        absolutePath,
        relativePath,
        recordValue,
        recordGeneratedStyleValue,
        resolveStaticImport,
      });
    }
  }

  const undefinedReferences = references
    .filter(({ name }) => !definitions.has(name))
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) ||
        left.path.localeCompare(right.path),
    );

  return {
    sourceFileCount: sourceFiles.length,
    definitionCount: definitions.size,
    referenceCount: references.length,
    undefinedReferences,
    rawColorLiterals: {
      count: rawColorOccurrences.length,
      fileCount: rawColorFiles.size,
      digest: digestOccurrences(rawColorOccurrences),
    },
    variableFallbacks: {
      count: fallbackOccurrences.length,
      digest: digestOccurrences(fallbackOccurrences),
      contextDigest: digestOccurrences(fallbackContextOccurrences),
    },
  };
}

export function createDesignTokenIntegrityBaseline(analysis) {
  return {
    schemaVersion: 1,
    sourceRoot: DEFAULT_TOKEN_INTEGRITY_CONFIG.sourceRoot,
    rawColorExemptPaths: DEFAULT_TOKEN_INTEGRITY_CONFIG.rawColorExemptPaths,
    runtimeDefinedCustomProperties:
      DEFAULT_TOKEN_INTEGRITY_CONFIG.runtimeDefinedCustomProperties,
    rawColorLiterals: analysis.rawColorLiterals,
    variableFallbacks: analysis.variableFallbacks,
  };
}

export function validateDesignTokenIntegrity({ analysis, baseline }) {
  const violations = [];
  if (baseline.schemaVersion !== 1) {
    violations.push(
      `schemaVersion: expected 1, received ${String(baseline.schemaVersion)}.`,
    );
  }
  if (baseline.sourceRoot !== DEFAULT_TOKEN_INTEGRITY_CONFIG.sourceRoot) {
    violations.push(
      `sourceRoot: expected ${DEFAULT_TOKEN_INTEGRITY_CONFIG.sourceRoot}, received ${String(baseline.sourceRoot)}.`,
    );
  }
  for (const configName of [
    "rawColorExemptPaths",
    "runtimeDefinedCustomProperties",
  ]) {
    const actual = baseline[configName];
    const expected = DEFAULT_TOKEN_INTEGRITY_CONFIG[configName];
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      violations.push(
        `${configName}: baseline configuration must match the governed scanner configuration.`,
      );
    }
  }
  if (analysis.sourceFileCount === 0) {
    violations.push(
      "No eligible source files were scanned; token integrity fails closed.",
    );
  }
  for (const reference of analysis.undefinedReferences) {
    violations.push(
      `${reference.path}: ${reference.name} is referenced but never defined or registered as runtime-owned.`,
    );
  }
  for (const inventoryName of ["rawColorLiterals", "variableFallbacks"]) {
    const actual = analysis[inventoryName];
    const expected = baseline[inventoryName];
    if (!expected) {
      violations.push(`${inventoryName}: baseline entry is missing.`);
      continue;
    }
    const fields =
      inventoryName === "variableFallbacks"
        ? ["count", "digest", "contextDigest"]
        : ["count", "digest"];
    for (const field of fields) {
      if (actual[field] !== expected[field]) {
        violations.push(
          `${inventoryName}.${field}: expected ${expected[field]}, received ${actual[field]}. ` +
            "Review the change and re-bank the exact baseline only when token-layer migration is intentional.",
        );
      }
    }
  }
  return violations;
}

function runCli() {
  const repoRoot = process.cwd();
  const baselinePath = path.resolve(
    repoRoot,
    DEFAULT_TOKEN_INTEGRITY_CONFIG.baselinePath,
  );
  const analysis = analyzeDesignTokenIntegrity({ repoRoot });

  if (process.argv.includes("--print-baseline")) {
    process.stdout.write(
      `${JSON.stringify(createDesignTokenIntegrityBaseline(analysis), null, 2)}\n`,
    );
    return;
  }

  if (!fs.existsSync(baselinePath)) {
    throw new Error(
      `Design-token baseline is missing at ${DEFAULT_TOKEN_INTEGRITY_CONFIG.baselinePath}.`,
    );
  }
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const violations = validateDesignTokenIntegrity({ analysis, baseline });
  if (violations.length > 0) {
    throw new Error(
      `Design-token integrity failed:\n- ${violations.join("\n- ")}`,
    );
  }

  console.log(
    `Design-token integrity passed: ${analysis.referenceCount} references, ` +
      `${analysis.rawColorLiterals.count} banked raw colours, ` +
      `${analysis.variableFallbacks.count} banked fallbacks.`,
  );
}

const isDirectExecution =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
