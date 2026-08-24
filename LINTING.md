# ESLint + Prettier + Husky

Setup de calidad de código para `backend` (NestJS).

## Piezas

- **ESLint** (`eslint.config.mjs`) — flat config, `typescript-eslint` recommendedTypeChecked + `eslint-plugin-prettier` (corre Prettier como regla de ESLint, así un solo comando arregla ambos).
- **Prettier** (`.prettierrc`) — `singleQuote: true`, `trailingComma: all`.
- **Husky** (`.husky/pre-commit`) — hook de git que corre `lint-staged` antes de cada commit.
- **lint-staged** (config en `package.json`) — corre `eslint --fix` + `prettier --write` solo sobre los `.ts` staged (no el repo entero).

## Instalación (ya hecha, referencia si se clona limpio)

```bash
npm install
npm run prepare   # instala los git hooks de husky (se corre solo via "prepare" en npm install)
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run lint` | Corre ESLint con `--fix` sobre `src`, `apps`, `libs`, `test`. |
| `npm run format` | Corre Prettier `--write` sobre `src/**/*.ts` y `test/**/*.ts`. |

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

Al hacer `git commit`, solo los `.ts` en el stage pasan por `eslint --fix` y `prettier --write`. Si ESLint tira error (no warning) sobre alguno de esos archivos, el commit se aborta — corregí y volvé a `git add` + `git commit`.

## Reglas ESLint no default

- `@typescript-eslint/no-explicit-any`: `off` — el proyecto usa `any` en algunos puntos (DTOs, respuestas de librerías sin tipos), no vale la pena forzarlo.
- `@typescript-eslint/no-floating-promises`: `warn` (no `error`) — no bloquea commit, pero conviene revisar (hay uno pendiente en `src/main.ts:16`, el `bootstrap()` sin `void`/`.catch`).
- `@typescript-eslint/no-unsafe-argument`: `warn`.
- `prettier/prettier`: `error` con `endOfLine: "auto"` (evita falsos positivos por line endings entre macOS/Windows).

## Format on save (VS Code)

Extensiones necesarias (ya instaladas):

- `esbenp.prettier-vscode` (Prettier)
- `dbaeumer.vscode-eslint` (ESLint)

Config en `.vscode/settings.json` (versionado, aplica a cualquiera que abra `backend/` como carpeta raíz en VS Code):

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

Al guardar un `.ts`: Prettier formatea primero, después ESLint corre `--fix` (comillas, orden de imports si hay regla, etc). Si VS Code no lo aplica: revisar que ambas extensiones estén habilitadas y que la carpeta abierta sea `backend/` (o un workspace que lo incluya) — settings de `.vscode/` no aplican si abrís la raíz del monorepo sin `backend` como folder root.

## Bypass del hook

Solo si es intencional (ej. WIP commit local que después se squashea):

```bash
git commit --no-verify
```
