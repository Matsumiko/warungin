# CONTEXT.md

This file tells agents which RunBook files to read for each task type.
Do not load every file by default.

Use this as the context router after reading `AGENTS.md`.

---

## Default Load

Always start with:

- `AGENTS.md` - operating rules and verification discipline
- `CONTEXT.md` - this routing map

Then load only the files that match the task.

---

## Context Routes

| Task type                             | Read these files                                                | Why                                                                                                                 |
| ------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| General code task                     | `AGENTS.md`, `CONTEXT.md`, `PROJECT.md`                         | Understand operating rules, project commands, architecture, and gotchas.                                            |
| Session gate before task work         | `SESSION.md`                                                    | Check `runbook session pending` before implementation, debugging, refactoring, audits, or repository-changing work. |
| Project commands or architecture      | `PROJECT.md`                                                    | Find install, dev, build, test commands, important paths, environment notes, and project boundaries.                |
| Architecture or product decision work | `PROJECT.md`, `DECISIONS.md`, `MODULE-MAP.md`                   | Respect accepted decisions and module boundaries before changing direction.                                         |
| Bugfix or regression work             | `PROJECT.md`, `MODULE-MAP.md`, `BUG-HISTORY.md`, `DECISIONS.md` | Start in the likely module and check old root causes before changing behavior.                                      |
| Module-specific implementation work   | `PROJECT.md`, `MODULE-MAP.md`, `DECISIONS.md`                   | Find responsibilities, first files to inspect, related rules, and module-specific pitfalls.                         |
| Large active task execution           | `ACTIVE-PLAN.md`                                                | Use only for non-trivial, multi-phase, cross-file, or risky work that needs a human-readable plan.                  |
| Resumable work or handoff             | `SESSION.md`, `.runbook/sessions/`                              | Follow recovery protocol and inspect the latest runtime session before continuing.                                  |
| Frontend work                         | `PROJECT.md`, `FRONTEND.md`                                     | Preserve the product's visual language, interaction rules, and UI stack conventions.                                |
| Backend or security-sensitive work    | `PROJECT.md`, `SECURITY.md`                                     | Check auth, data integrity, secrets, abuse protection, and risky backend surfaces.                                  |
| Security audit or pentest             | `PROJECT.md`, `SESSION.md`, `SECURITY.md`, `POLICIES.md`        | Keep audit boundaries, secrets handling, generated artifacts, and cleanup behavior explicit.                        |
| Planning or prioritization            | `ACTIVE-PLAN.md`, `BACKLOG.md`                                  | Keep active large-task planning separate from strategic backlog.                                                    |
| Completed meaningful changes          | `CHANGELOG.md`                                                  | Record what shipped, what was verified, and any residual risk.                                                      |
| Multi-agent compatibility             | `AGENT-VARIANTS.md`                                             | Understand adapter behavior for non-Codex agents.                                                                   |

---

## CLI Shortcuts

Use these commands to print recommended context files:

```bash
runbook context list
runbook context frontend
runbook context backend
runbook context architecture
runbook context bugfix
runbook context module-work
runbook context security-audit
runbook context resume
runbook context planning
runbook context inspect
```

---

## Custom Routes

Add project-specific rows here when the built-in routes are not precise enough.
Route names are matched case-insensitively; spaces become dashes.

| Route        | Read these files                | Why                                  |
| ------------ | ------------------------------- | ------------------------------------ |
| [route name] | `PROJECT.md`, `docs/example.md` | [When agents should use this route.] |

Example:

If you add `database migration`, call it with `runbook context database-migration`.

---

## Reading Rules

1. Read `AGENTS.md` first.
2. Read `CONTEXT.md` second.
3. Load task-specific files from the routing table.
4. Stop reading when you have enough context to act safely.
5. Do not treat missing optional files as permission to guess; state the gap and proceed conservatively.
6. Check `runbook session pending` before task work that changes the repository.
7. Never load runtime `.runbook/sessions/*.json` files unless `runbook session pending` reports a recoverable session or the task involves resume, status, recap, handoff, or interrupted work.
