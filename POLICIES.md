# POLICIES.md

Cross-cutting policies for AI coding agents.

Read this when a task touches cleanup, secrets, destructive commands, generated
files, external network access, security review, or pentest-style work.

---

## Cleanup

- Keep disposable artifacts out of the final workspace.
- Disposable artifacts include temporary pentest output, scratch reports,
  generated payloads, debug dumps, downloaded samples, one-off repro folders,
  and ad-hoc `tmp` files.
- Prefer ignored scratch locations such as `/tmp`, `.tmp/`, or `tmp/`.
- Record disposable artifact paths in the runtime session.
- Delete disposable artifacts before final verification unless the user
  explicitly asks to keep them.
- Do not delete requested deliverables, implementation files, tests, fixtures,
  docs, snapshots, lockfiles, or permanent project outputs.

---

## Secrets And Private Data

- Never write secrets, tokens, cookies, private keys, raw auth headers, or
  sensitive payloads into logs, docs, session files, or generated reports.
- Redact sensitive values as `[REDACTED]`.
- Summarize large or sensitive payloads instead of copying them.
- Do not add real credentials to examples, fixtures, tests, or screenshots.

---

## Destructive Actions

- Do not run destructive commands unless the user explicitly asks for them.
- Treat deletes, force pushes, resets, migrations, bulk rewrites, and production
  data changes as high-risk.
- Prefer dry runs and backups when available.
- State what will be deleted or modified before running a destructive action.

---

## Generated Files

- Keep generated files only when they are part of the requested deliverable or
  the project build/test contract.
- Do not commit or preserve generated scratch output by default.
- If generated output is intentionally kept, document the command that produced
  it and how to refresh it.

---

## Network And Downloads

- Use network access only when it is relevant to the task.
- Prefer official or primary sources for technical facts.
- Do not download untrusted payloads into the repository unless required.
- Put temporary downloads in a scratch path and delete them before final
  verification.

---

## Security Audit And Pentest Boundaries

- Work only within the scope authorized by the user.
- Do not exfiltrate, retain, or publish sensitive data.
- Record findings as concise summaries with reproduction steps, impact, and
  remediation guidance.
- Store raw scan output only when explicitly requested; otherwise summarize it
  and delete the disposable files.
