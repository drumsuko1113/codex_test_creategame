# Agent Policy

## Git Branch Strategy (Mandatory)

This repository follows a git-flow style workflow.

1. `main`
- Production-ready branch only.
- Direct commits are prohibited.

2. `develop`
- Primary integration branch for ongoing development.
- All feature branches must be created from `develop`.

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

## Operational Rules for Agents

1. Never implement new features directly on `main`.
2. If work starts on the wrong branch, switch to a proper `feature/*` branch before continuing.
3. Keep commits small and feature-focused.
4. Include branch context in status updates when relevant.

## Approval Policy

1. In this repository, agent approval is not required for `git commit`.
2. In this repository, agent approval is not required for `git push`.
