# mtgraf

## What is this repository?

This project is a local Telegraf-like wrapper for GramJS. It is designed to work in environments where the Telegram Bot API is blocked or unavailable, and uses MTProto-based uploads and downloads where possible.

## Why this build guide exists

The file structure and workflow are intentionally set up for:

- **local development** with source files in `src/`
- **compiled package output** in `dist/`
- **GitHub Actions release publishing** using an npm token stored in GitHub Secrets
- **ignored local files** such as `node_modules`, build artifacts, and personal notes

The repository is not intended to track generated files like `dist/` or `node_modules/`, because those can be rebuilt and they make the repo much larger.

## Publishing with GitHub Actions

This repository includes a workflow at `.github/workflows/release.yml` that:

- checks out the code
- installs dependencies
- builds the package with `npm run build`
- publishes to npm when pushed on `main` or when a version tag is created

### Required secret

Add this secret in your repository settings under `Settings > Secrets and variables > Actions`:

- `NPM_TOKEN`

This token should be generated on npmjs.com as an **Automation** token and stored in GitHub Secrets. The action uses it to authenticate and publish the `mtgraf` package.

## Build

```bash
npm install
npm run build
```

## Local ignored files

- `guid.md` — local guidance or temporary identifier file
- `steps.md` — local workflow notes or progress tracking
- `node_modules/` — dependency directory
- `dist/` — built package output

These files are intentionally ignored so the repo stays clean and reproducible.
