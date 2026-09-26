# Agent guide — EduDriver / ShellHacks

Instructions for AI agents working in this repository. **Remote:** `https://github.com/PatrickLeimer/ShellHacks.git` · **Default branch:** `main` · **Required CI check:** `ci`

---

## GitHub workflow (follow in order)

### 1. Before you change code

1. Confirm the task scope (feature, fix, CI, docs only).
2. Sync with `main` when starting non-trivial work:
   ```bash
   git fetch origin
   git checkout main
   git pull origin main
   ```
3. Create a **topic branch** from `main`. Prefer names that match repo rulesets when possible:
   - `feature/<short-description>`
   - `fix/<short-description>`
   - `chore/<short-description>`
   - `setup/<short-description>` (tooling, CI, repo config)

4. **Do not push to `main` directly** unless the user explicitly asks. Default path is branch → pull request → merge.

### 2. While implementing

1. Keep commits focused; one logical change per commit when the user wants commits.
2. **Never commit** secrets or local env files (`.env`, `.env.local`, credentials JSON, keystores, `.pem`, etc.). Push rulesets may block these paths.
3. After dependency changes, commit **`package-lock.json`** with `package.json`.
4. Use **`npx expo install <pkg>`** for Expo/RN packages (not raw `npm install` for native deps).
5. Before saying the work is done, run the **same checks as CI** locally:
   ```bash
   npm ci
   npx expo-doctor
   npm run lint
   npm run typecheck
   npm test -- --ci
   ```
   CI uses **Node 20** (`.nvmrc`) and **npm 11.6.1** (see `.github/workflows/ci.yml`).

### 3. Git commits

- **Only create commits when the user asks** (or a user rule explicitly allows it). If unclear, ask first.
- Do not amend, force-push, or skip hooks unless the user explicitly requests it.
- Do not push unless the user explicitly asks.
- Use clear commit messages (what/why, present tense).

### 4. Opening and updating pull requests

1. Push the topic branch: `git push -u origin <branch>`.
2. Open a PR **into `main`** (GitHub UI or `gh pr create` after `gh auth login`).
3. PR description should include:
   - **Summary** — what changed and why
   - **Test plan** — checklist (local CI commands, manual QA if relevant)
4. Wait for the **`ci`** status check on the PR. Fix failures on the same branch and push again.
5. If branch protection requires review, do not merge until approval (unless the user explicitly merges themselves).

### 5. Merge and post-merge

1. Prefer **squash merge** or **merge commit** per team preference; rulesets allow both on `main`.
2. After merge, confirm **`ci`** passed on `main` (push workflow).
3. Delete the topic branch when the user wants cleanup (`git push origin --delete <branch>` only if asked).

### 6. When the user asks for a PR only

Use `gh` when available:

```bash
gh pr create --base main --head <branch> --title "..." --body "..."
gh pr checks <number>
gh pr view <number> --web
```

If `gh` is not authenticated, give the compare URL:  
`https://github.com/PatrickLeimer/ShellHacks/compare/main...<branch>`

### 7. Branch protection and rulesets (admin / repo owner)

Agents with **write** access often **cannot** change protection rules. Document for an **admin** instead of retrying failed API calls.

| Resource | Purpose |
|----------|---------|
| [`.github/rulesets/edudriver-safety.json`](.github/rulesets/edudriver-safety.json) | Importable rulesets (PR + `ci`, push safety, tags, optional conventional commits) |
| [`.github/BRANCH_PROTECTION.md`](.github/BRANCH_PROTECTION.md) | Manual UI steps and legacy branch protection |
| [`scripts/apply-branch-protection.ps1`](scripts/apply-branch-protection.ps1) | Admin script (requires `gh auth login` as admin) |

**Order for new repos:** merge a PR that adds CI → green **`ci`** run → import **EduDriver — Protect default branch** ruleset (or legacy protection with check **`ci`**).

### 8. GitHub Actions (CI)

- Workflow: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)
- Triggers: `pull_request` and `push` to `main`
- Job id: `ci` (this is the required status check name)

When editing the workflow, validate YAML and ensure required check name stays **`ci`** unless protection rules are updated to match.

### 9. Security and safety rules for agents

- Do not add API keys, map keys, LLM keys, or `EXPO_TOKEN` to the repo. Use GitHub **Secrets** only when the user sets up deployment jobs.
- Do not disable branch protection, rulesets, or CI to “unblock” a merge without user approval.
- No `git push --force` to `main` / `master` unless the user explicitly requests it (warn about risk).
- Do not commit `.env*` secret files; `.env.example` with placeholders is fine.

### 10. Quick decision tree

```
User wants code change?
  → branch from main → implement → run local CI → commit (if asked) → push branch (if asked) → PR → wait for ci

User wants CI fixed?
  → reproduce with npm ci + lint + typecheck + test on Node 20 → fix → push branch → verify ci on PR

User wants branch protection?
  → point admin to rulesets JSON or apply-branch-protection.ps1; do not push unless asked

User says "push" / "open PR" / "commit"?
  → follow user rules for git/gh exactly
```

---

## Mobile / Expo development

This is an Expo/React Native app. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

### Expo docs (do not rely on stale training data)

1. Read the `expo` major version in `package.json`.
2. Use versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. Index: https://docs.expo.dev/llms.txt

### Common commands

Use `bunx` instead of `npx` if `bun.lock` exists.

```bash
npx expo install <package>   # SDK-compatible versions
npx expo start
npm run lint                 # expo lint
npm run typecheck            # tsc --noEmit
npx expo-doctor
```

### Project conventions

- Prefer **Expo Router** when navigation is in scope; routes under `src/app/` when that layout exists.
- Do not hand-edit generated `ios/` / `android/` if using prebuild/CNG; use `app.json` and config plugins.
- Native modules may require a dev build (`npx expo run:ios|android` or EAS), not only Expo Go.

---

## Reference links

- [README.md](README.md) — setup and local CI
- [GitHub Actions tab](https://github.com/PatrickLeimer/ShellHacks/actions)
- [Pull requests](https://github.com/PatrickLeimer/ShellHacks/pulls)
