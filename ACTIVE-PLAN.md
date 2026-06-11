# ACTIVE-PLAN.md

Active execution plan for the current large task only.

Use this file for non-trivial, multi-phase, cross-file, or risky work that needs
a human-readable plan. Do not use it as a backlog and do not duplicate ordinary
session progress here. Small tasks can rely on `.runbook/sessions/*.json`.

---

## Status Reference

| Status | Meaning                |
| ------ | ---------------------- |
| `[ ]`  | Not started            |
| `[~]`  | In progress            |
| `[x]`  | Completed and verified |
| `[!]`  | Blocked                |
| `[-]`  | Skipped                |
| `[?]`  | Needs clarification    |

---

## Active Plan

### Task

[One-line description]

### Goal

[What success looks like]

### Context

[Why this is being done and current state]

### Assumptions

- [Assumption]

### Ambiguities

| Ambiguity | Resolution / Default | Flagged? |
| --------- | -------------------- | -------- |
| [Unknown] | [Decision]           | yes/no   |

### Constraints

- [Constraint]

### Affected Surfaces

- `path/to/file` - [why affected]

### Risk Assessment

| Risk   | Likelihood   | Impact       | Mitigation   |
| ------ | ------------ | ------------ | ------------ |
| [Risk] | low/med/high | low/med/high | [Mitigation] |

### Execution Steps

- [ ] Step 1 - [description]
- [ ] Step 2 - [description]
- [ ] Step 3 - Verify: [checks]
- [ ] Step 4 - Update CHANGELOG.md
- [ ] Step 5 - Update BACKLOG.md if follow-up items exist

### Rollback Plan

- [Rollback step]

### Definition of Done

- [ ] All execution steps complete
- [ ] Verification performed
- [ ] CHANGELOG.md updated
- [ ] Residual risks documented

---

## Blocker Log

---

## Replan Log

---

## Archive
