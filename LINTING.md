# ESLint + Prettier + Husky

Code quality setup for `backend` (NestJS).

## Pieces

- **ESLint** (`eslint.config.mjs`) — flat config, `typescript-eslint` recommendedTypeChecked + `eslint-plugin-prettier` (runs Prettier as an ESLint rule, so one command fixes both).
- **Prettier** (`.prettierrc`) — `singleQuote: true`, `trailingComma: all`.
- **Husky** (`.husky/pre-commit`) — git hook that runs `lint-staged` before every commit.
- **lint-staged** (config in `package.json`) — runs `eslint --fix` + `prettier --write` only on staged `.ts` files (not the whole repo).

## Installation (already done, reference if cloned fresh)

```bash
npm install
npm run prepare   # installs husky's git hooks (runs automatically via "prepare" on npm install)
```

## Scripts

| Command | What it does |
|---|---|
| `npm run lint` | Runs ESLint with `--fix` over `src`, `apps`, `libs`, `test`. |
| `npm run format` | Runs Prettier `--write` over `src/**/*.ts` and `test/**/*.ts`. |

## Pre-commit hook

`.husky/pre-commit`:

```bash
npx lint-staged
```

`lint-staged` config (`package.json`):

```json
"lint-staged": {
  "*.ts": [
    "eslint --fix",
    "prettier --write"
  ]
}
```

On `git commit`, only the staged `.ts` files go through `eslint --fix` and `prettier --write`. If ESLint throws an error (not a warning) on any of those files, the commit is aborted — fix it and re-run `git add` + `git commit`.

## Non-default ESLint rules

- `@typescript-eslint/no-explicit-any`: `off` — the project uses `any` in a few spots (DTOs, responses from untyped libraries), not worth forcing it.
- `@typescript-eslint/no-floating-promises`: `warn` (not `error`) — doesn't block the commit, but worth reviewing (there's one pending in `src/main.ts:16`, the `bootstrap()` call without `void`/`.catch`).
- `@typescript-eslint/no-unsafe-argument`: `warn`.
- `prettier/prettier`: `error` with `endOfLine: "auto"` (avoids false positives from line endings between macOS/Windows).

## Format on save (VS Code)

Required extensions (already installed):

- `esbenp.prettier-vscode` (Prettier)
- `dbaeumer.vscode-eslint` (ESLint)

Config in `.vscode/settings.json` (checked in, applies to anyone who opens `backend/` as the root folder in VS Code):

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.validate": ["typescript"]
}
```

On saving a `.ts` file: Prettier formats first, then ESLint runs `--fix` (quotes, import order if there's a rule, etc). If VS Code doesn't apply it: check that both extensions are enabled and that the open folder is `backend/` (or a workspace that includes it) — `.vscode/` settings don't apply if you open the monorepo root without `backend` as the folder root.

## Bypassing the hook

Only if intentional (e.g. a local WIP commit that gets squashed later):

```bash
git commit --no-verify
```
