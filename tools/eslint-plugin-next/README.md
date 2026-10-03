# Maintained Next ESLint tooling

This private development package retains the published Next15.5.25 rule/config bytes and replaces only get-root-dirs.js. It supports literal directory paths, defaults, relative/absolute paths and bounded arrays. Wildcards, braces, brackets, parentheses, null bytes, empty/malformed settings and excessive lengths/counts fail explicitly before filesystem access. Missing/non-directory valid literals return no directory as upstream does. Backslashes normalize to forward slashes.

Owner: workbench-architecture-maintainers, with the current Workbench implementation owner accountable for updates. Reviewed2026-10-04; review due2026-10-14. Review upstream advisories/releases before each update and deadline. Next15 support ends2026-10-21. Return to a fixed supported upstream plugin or supported Next16 migration after rule parity and full dependency proof.

UPSTREAM-PROVENANCE.json binds verified published tarball bytes, declared immutable source lineage, license and the one modified resolver. This is an owned fork, not an official upstream security patch. Published transpilation reproducibility is not claimed. Do not add a glob library or edit rule/config bytes locally. Verify quality:next-eslint-fork and all rule/refusal controls before upgrades.
