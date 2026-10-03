import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { getRootDirs } = require("../../tools/eslint-plugin-next/dist/utils/get-root-dirs.js") as {
  getRootDirs(context: { cwd: string; settings: { next?: unknown } }): string[];
};
const root = mkdtempSync(join(tmpdir(), "lotus-next-root-"));
mkdirSync(join(root, "nested"));
writeFileSync(join(root, "file.txt"), "not a directory");
afterAll(() => rmSync(root, { recursive: true, force: true }));
const normalize = (path: string) => path.replace(/\\/g, "/");
const context = (rootDir: unknown) => ({ cwd: root, settings: { next: { rootDir } } });
describe("bounded literal Next roots", () => {
  it("admits default, relative, absolute, arrays and actual backslash separators", () => {
    expect(getRootDirs({ cwd: root, settings: {} })).toEqual([root]);
    expect(getRootDirs(context("."))).toEqual(["."]);
    expect(getRootDirs(context(root))).toEqual([normalize(root)]);
    expect(getRootDirs(context([root, join(root, "nested")]))).toEqual([normalize(root), normalize(join(root, "nested"))]);
    expect(getRootDirs(context(root.replace(/\//g, "\\")))).toEqual([normalize(root)]);
  });
  it("preserves missing and non-directory literal refusal without throwing", () => {
    expect(getRootDirs(context(join(root, "missing")))).toEqual([]);
    expect(getRootDirs(context(join(root, "file.txt")))).toEqual([]);
  });
  it.each([null, 1, {}, [], [root, null], new Array(33).fill(root), "", "a".repeat(4097),
    "*", "asset-{equity,bond}", "[ab]", "?(root)", "root\0x", "{".repeat(4500) + "a" + "}".repeat(4500)])(
    "explicitly refuses malformed/unsupported root setting %#", (value) => {
      expect(() => getRootDirs(context(value))).toThrow(/literal|bounded/);
    });
  it.each([null, [], "bad"])("refuses malformed next settings %#", (next) => {
    expect(() => getRootDirs({ cwd: root, settings: { next } })).toThrow(/settings.next/);
  });
  it("validates every array entry before any filesystem access", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const spy = vi.spyOn(fs, "statSync");
    try {
      expect(getRootDirs(context(root))).toEqual([normalize(root)]);
      expect(spy).toHaveBeenCalledOnce();
      spy.mockClear();
      expect(() => getRootDirs(context([root, "{bad}"]))).toThrow(/literal/);
      expect(spy).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });
});
