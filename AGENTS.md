# Project working agreements

- In task descriptions, documentation, changelogs, and other prose, refer to the requester as “the user” or similar; do not use their personal name. Preserve the explicitly specified Git commit identity.
- Use npm. `npm run build` is the current automated code check; there is no test suite yet, so do not report tests as passing.
- Never commit changes directly to `main`. Work on a `codex/...` feature branch, and keep `main` aligned with `origin/main` until the user explicitly requests that a release be prepared and merged; do not merge or push a release automatically.
- Give every major and minor release a distinctive name that fits its changes. Include that name in its changelog heading, annotated tag message, and GitHub release title; patch releases do not require a name.
- Before publishing a release, replace the **Unreleased** changelog heading with the versioned release heading; never retain an empty **Unreleased** section. Recreate it only when adding new pending changes during development.
- Preserve the distinction between Natural Earth source map units, meaningful geographic components, quiz identities, and region membership. A source-data split must not automatically become a separate country or quiz answer.
- When changing map drawing or geometry, keep the default canvas renderer and SVG fallback consistent, and account for both 50m and 10m detail. Prefer shared data or configuration over country-specific rendering branches.
