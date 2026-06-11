# AGENTS.md

Operating entry point for AI coding agents.

Read this file first. Then read `CONTEXT.md` to decide which project files are relevant for the task. Do not load every RunBook file by default.

---

## Core Principles

- Understand the existing system before making meaningful changes.
- Prefer the repository's current patterns over new abstractions.
- Keep changes scoped to the task and its immediate blast radius.
- Do not overwrite user work or revert changes you did not make unless explicitly asked.
- Treat auth, payments, data migrations, secrets, destructive actions, and public contracts as high-risk.
- Verify honestly. Do not claim work is done without stating what was checked.

---

## Context Routing

After this file, read `CONTEXT.md`.

Use it to choose only the files needed for the task:

- `PROJECT.md` for project commands, architecture, important paths, environment notes, tests, gotchas, and do-not-touch areas.
- `ACTIVE-PLAN.md` for active non-trivial execution plans.
- `SESSION.md` and `.runbook/sessions/` for resume, handoff, interrupted work, `run:status`, `run:resume`, or `run:recap`.
- `FRONTEND.md` for frontend, UI, layout, visual, interaction, or design-system work.
- `SECURITY.md` for backend or security-sensitive work.
- `BACKLOG.md` for strategic backlog and prioritization.
- `CHANGELOG.md` for completed meaningful changes.

If `CONTEXT.md` is missing, continue with the smallest safe set of files and report that the context router is unavailable.

---

## Audit Before Editing

For non-trivial tasks:

1. Read the relevant context files.
2. Inspect the affected files, modules, routes, schemas, UI surfaces, tests, or configuration.
3. Identify the actual problem, not just the symptom.
4. Note risks and constraints before editing.
5. Make the smallest effective change.
6. Verify the result.

For trivial tasks, keep the audit lightweight but still inspect before changing.

---

## Planning

Use a written plan for multi-step, risky, or cross-file work.

- Use `ACTIVE-PLAN.md` only for large active work that needs a durable human-readable plan.
- Keep the plan short and status-driven.
- Update the plan when the task changes.
- Do not continue with a stale plan if the audit disproves it.

---

## Session Recovery

Before starting implementation, debugging, refactoring, audits, project bootstrap, or any other repository-changing task, check for recoverable runtime sessions:

```bash
runbook session pending
```

If `runbook` is not available in PATH, use `npx @matsumiko/runbook session pending`. If the CLI cannot run, inspect `.runbook/sessions/` manually and enforce the same gate before editing.

If a recoverable session exists, do not start new work. Summarize the pending session and ask the user to type exactly `I will fight` to resume it. Only after that exact phrase should you run `runbook session resume` and continue from the recorded next step.

If the user explicitly chooses to start fresh instead, create a new session with `runbook session new --force`.

If no recoverable session exists, create a new runtime session before the first repository edit. Use `runbook session new` when available. If the CLI is unavailable, manually create `.runbook/sessions/SESSION-[YYYYMMDD]-[HHMM].json` using the schema in `SESSION.md`, set `session.status` to `ACTIVE`, record the prompt and plan, and keep updating that file during work.

When the CLI is available, these session commands are mandatory. Do not hand-write `.runbook/sessions/*.json` unless both `runbook` and `npx @matsumiko/runbook` failed after a real attempt:

```bash
runbook session pending
runbook session new
runbook session step "<action>"
runbook session touch <path>
runbook session verify "<command/result>"
runbook session close --status completed
runbook session validate
```

If you must use `npx`, run the same commands as `npx @matsumiko/runbook ...`.

If the user sends `run:status`, `run:resume`, or `run:recap`, read `SESSION.md` first and follow its protocol.

Use runtime session files in `.runbook/sessions/` for implementation, debugging, refactoring, audits, multi-step work, risky work, work likely to be interrupted, or explicitly requested handoff.

For task work, create a runtime session before editing, update it at meaningful milestones, record touched files and verification, and close it when completed or paused.

Use this checkpoint loop for every implementation step:

1. Before changing files for the step, record the concrete next action with `runbook session step "<action>"` or update the runtime JSON manually.
2. Change only the files needed for that step.
3. Immediately after the change, record each touched file with `runbook session touch <path>` or update `summary.filesChanged[]` manually.
4. Update `lastPosition.lastAction`, `lastPosition.lastFileTouched`, and `lastPosition.nextStep` before starting another step.
5. After verification, record it with `runbook session verify "<command/result>"`.

Do not batch all session updates at the end. A step is not complete until both the work and its runtime session checkpoint are saved.

## Clean Workspace

Keep the repository clean after task work.

- Treat temporary pentest output, scratch reports, throwaway scans, generated payloads, downloaded samples, debug dumps, coverage scratch files, one-off repro folders, and ad-hoc `tmp` artifacts as disposable unless the user explicitly asks to keep them.
- Create disposable artifacts under an ignored temporary location when practical, such as `/tmp`, `.tmp/`, `tmp/`, or another project-approved scratch path.
- Record disposable artifact paths in the runtime session before using them, especially for pentest, security, audit, scraping, migration rehearsal, or data-processing tasks.
- Before final verification, delete disposable artifacts that are not required deliverables and record the cleanup in the runtime session.
- Do not delete files that are part of the requested implementation, tests, fixtures, documentation, snapshots, lockfiles, or permanent project outputs.
- If a temporary artifact must be kept for user review, move it to a deliberate project path, document why it remains, and mention it in the final report.

After closing completed work, keep only the newest 5 completed/cancelled runtime sessions. Never auto-delete `ACTIVE`, `PAUSED`, `INTERRUPTED`, or `BLOCKED` sessions.

Never write secrets, tokens, cookies, private keys, raw auth headers, or sensitive payloads into session files.

---

## Project Bootstrap

When the repository starts from only RunBook files or has no real project files yet:

1. Treat the first agreed implementation task as project bootstrap.
2. Create a runtime session before editing.
3. Build the smallest useful project structure that satisfies the agreed task.
4. After each created project file, checkpoint that file in the runtime session before creating the next file.
5. Verify the project with a real command.
6. Update `PROJECT.md` with verified reusable facts: commands, architecture, important paths, environment, tests, and gotchas.
7. For frontend bootstrap, update `FRONTEND.md` with actual design decisions and checkpoint it before closing the session.
8. Use `ACTIVE-PLAN.md` only if the bootstrap is large or multi-phase.
9. Use `BACKLOG.md` only for deferred follow-up work.
10. Update `CHANGELOG.md` only for meaningful completed milestones.

Do not leave `PROJECT.md` as a placeholder after bootstrapping a real project. Replace every bracket placeholder such as `[command]`, `[name]`, or `[VAR_NAME]` with verified facts, `none`, or `n/a`.

---

## Long-Term Memory Checkpoint

Before closing any repository-changing task, review durable project memory and update it when the task created or verified reusable facts.

This is required; do not treat memory files as optional decoration.

- Update `PROJECT.md` when commands, architecture, important paths, environment notes, tests, gotchas, or do-not-touch areas changed.
- Update `MODULE-MAP.md` when a module, feature area, entrypoint, responsibility, first file to inspect, related rule, common task, or module-specific pitfall was created or changed.
- Update `DECISIONS.md` when the user accepts a product, business, architecture, security, data, or UX direction that future agents must not undo accidentally.
- Update `BUG-HISTORY.md` after a verified bugfix or regression fix with the problem, cause, fix, changed files, and regression check.
- Update `FRONTEND.md` for frontend bootstrap or meaningful frontend changes.
- Update `SECURITY.md` for new security-sensitive rules, auth/authorization constraints, secret handling, abuse protection, or sensitive data behavior.
- If a memory file is relevant but no durable fact changed, state that in the final report. Do not silently skip the review.

When updating durable memory, preserve the file's existing structure and instructions. Append or edit concrete entries under the right section; do not replace the whole memory file with a terse summary.

Checkpoint every memory file update with `runbook session touch <file>` before closing the runtime session.

---

## Frontend Work

Before frontend work, read `FRONTEND.md`.

Preserve existing visual language, component patterns, layout rhythm, interaction behavior, and responsive constraints unless the user explicitly asks for a redesign.

A frontend task is not done if the result feels visually foreign to the product.

For frontend bootstrap or meaningful frontend changes, update `FRONTEND.md` after verification with the actual frontend decisions that now exist in the project. Record the verified tone, palette, typography, layout rules, component patterns, responsive breakpoints, accessibility expectations, and test/preview commands. If `FRONTEND.md` is still a generic template, add or replace a clear project-specific baseline near the top so future agents do not rely on placeholders.

---

## Backend and Security Work

Before backend or security-sensitive work, read `SECURITY.md`.

Apply it when work touches authentication, authorization, billing, payments, uploads, webhooks, secrets, admin access, account recovery, migrations, or sensitive data.

---

## Verification

Run the most relevant available checks:

- tests for changed behavior
- lint or typecheck for code quality
- build for integration risk
- manual trace when no automated check exists

Before reporting completion, check for disposable artifacts created during the task and clean them up or explicitly report why they remain.

For repository-changing work, do not send the final response until these RunBook proof commands pass after the runtime session is closed:

```bash
runbook session pending
runbook session validate
runbook doctor --strict-live
runbook finish
```

The final report must state the result of those checks. If any command fails, fix the RunBook/session state or report the work as incomplete.

If a check cannot be run, say why. Do not replace verification with confidence.

---

## Reporting

Final reports should be concise and factual:

- what changed
- what was verified
- what could not be verified
- residual risk or follow-up only when relevant
