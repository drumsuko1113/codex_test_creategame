# Agent Policy

## Git Branch Strategy (Mandatory)

This repository follows a git-flow style workflow.

1. `main`
- Production-ready branch only.
- Direct commits are prohibited.

2. `develop`
- Primary integration branch for ongoing development.
- All feature branches must be created from `develop`.
- Direct commits/pushes to `develop` are prohibited.
- Changes must reach `develop` only via reviewed PR merges from `feature/*` or `fix/*`.

3. `feature/*`
- Implement one feature per branch.
- Branch naming format: `feature/<feature-name>`.
- Merge target is always `develop`.

## Required Workflow

1. Update local `develop` before starting work.
2. Create a new `feature/*` branch from `develop`.
3. Implement only the scoped feature in that branch.
4. Open PR from `feature/*` to `develop`.
5. Merge to `main` only through release process.
6. Never push commits directly to `develop`.

## Issue Implementation Protocol (Mandatory)

1. Handle issues one by one, and create a dedicated branch per issue.
2. Branch naming should include issue number, e.g. `feature/issue-58-<topic>`.
3. Before coding, write and confirm concrete requirements for that issue.
4. Use TDD by default:
- Write/extend tests first and confirm they fail for the target behavior.
- Implement the minimum change to make tests pass.
- Refactor while keeping tests green.
5. CI-related issues may skip strict TDD where not practical.
6. After implementation, always run regression tests (`npm test`) and build check (`npm run build`).
7. Do not batch multiple issues into a single implementation branch.

## Operational Rules for Agents

1. Never implement new features directly on `main`.
2. If work starts on the wrong branch, switch to a proper `feature/*` branch before continuing.
3. Keep commits small and feature-focused.
4. Include branch context in status updates when relevant.

## Reporting Rules (Mandatory)

1. Do not include local absolute paths (e.g. `C:\...`) in implementation summaries, PR descriptions, or PR comments.
2. Always use repository-relative paths (e.g. `server/src/app.ts`).
3. When sharing change lists for PR text, provide plain relative file paths only.

## Approval Policy

1. In this repository, agent approval is not required for `git commit`.
2. In this repository, agent approval is not required for `git push`.
