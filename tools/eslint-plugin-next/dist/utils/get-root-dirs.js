"use strict";
const fs = require("node:fs");
const { resolve } = require("node:path");

const MAX_ROOTS = 32;
const MAX_ROOT_LENGTH = 4096;

function validateRoot(root) {
    if (typeof root !== "string" || root.length === 0 || root.length > MAX_ROOT_LENGTH ||
        /[\0*?{}\[\]()]/.test(root)) {
        throw new Error("Next ESLint rootDir requires a bounded literal directory path; glob patterns are unsupported.");
    }
    return root.replace(/\\/g, "/");
}

function admittedRoots(context) {
    const settings = context.settings.next;
    if (settings !== undefined && (settings === null || typeof settings !== "object" || Array.isArray(settings))) {
        throw new Error("Next ESLint settings.next must be an object.");
    }
    const configured = settings?.rootDir;
    if (configured === undefined) return [validateRoot(context.cwd)];
    if (typeof configured === "string") return [validateRoot(configured)];
    if (!Array.isArray(configured) || configured.length === 0 || configured.length > MAX_ROOTS) {
        throw new Error("Next ESLint rootDir requires a literal path or a bounded non-empty array of paths.");
    }
    // Validate the entire setting before any filesystem access.
    return configured.map(validateRoot);
}

function getRootDirs(context) {
    if (context.settings.next?.rootDir === undefined) {
        admittedRoots(context);
        return [context.cwd];
    }
    return admittedRoots(context).filter((root) => {
        try {
            return fs.statSync(resolve(root)).isDirectory();
        } catch (error) {
            if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;
            throw error;
        }
    });
}

Object.defineProperty(exports, "getRootDirs", {
    enumerable: true,
    get: function() { return getRootDirs; }
});
