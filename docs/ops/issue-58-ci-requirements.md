# Issue #58 CI Requirements

## Background
- Changes currently rely on manual local checks.
- Regression risk increases without automatic quality gates.

## Goal
- Run automated quality checks on GitHub for PR and Push.
- Block merge when test/build fails.

## Scope
- Add GitHub Actions workflow for CI.
- Trigger workflow on:
  - `pull_request`
  - `push`
- Execute the following in order:
  1. `npm ci`
  2. `npm run test`
  3. `npm run build`
- Configure dependency cache for npm to reduce execution time.
- Document CI policy (or badge) in `README.md`.

## Out of Scope
- Browser E2E tests.
- Deployment pipeline.
- Security scan pipeline.

## Technical Constraints
- Use repository root as working directory.
- Use lockfile-based install (`npm ci`) for reproducibility.
- Workflow must fail immediately if any required step fails.

## Acceptance Criteria
1. CI runs automatically when PR is opened/updated.
2. CI runs automatically on push.
3. CI fails when test or build fails.
4. README clearly states CI quality gate policy.

## Verification Plan
1. Static verification:
  - Workflow YAML syntax is valid.
  - Trigger/events and steps match requirements.
2. Runtime verification:
  - Confirm local `npm run test` and `npm run build` pass before push.
  - After push/PR, confirm GitHub Actions workflow starts and reports status.
