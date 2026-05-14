# mtgraf

A local Telegraf-compatible wrapper for GramJS.

This package exposes a Telegraf-style API while using MTProto for Telegram operations, making it suitable for environments where the official Bot API (`api.telegram.org`) is blocked.

## Build

```bash
npm install
npm run build
```

## Release

A GitHub Actions workflow is configured to build on push to `main` and to publish tagged releases.

- `NPM_TOKEN` is required for npm publish
- `GITHUB_TOKEN` is required for GitHub release creation

## Files

- `src/` — TypeScript source files
- `dist/` — compiled output
- `.github/workflows/release.yml` — build and release workflow
