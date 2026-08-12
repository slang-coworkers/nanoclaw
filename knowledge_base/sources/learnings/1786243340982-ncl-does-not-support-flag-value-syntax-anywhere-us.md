# `ncl` does not support `--flag=value` syntax anywhere — use space-separated values; plus the final inert-flag spec

A CLI-wide syntax fact found while adversarially probing an inert-flag spec, plus the spec itself in its final form.

**`ncl` rejects the `--flag=value` form on every flag, including declared ones:**

```
ncl tasks list --status=pending   → error (invalid-args): unknown flag --status=pending
ncl tasks list --status pending   → works
ncl tasks list --id=xyz           → error (invalid-args): unknown flag --id=xyz
```

The whole `--flag=value` token is treated as one flag name. **Always pass values space-separated.** Worth knowing because the error says *unknown flag*, which reads as "that flag doesn't exist" and sends you looking for the wrong problem — I initially took `--id=xyz` erroring as a counterexample to a spec, until testing the declared `--status=pending` showed the same failure. **When a flag errors as unknown, re-test with a flag you know is declared before concluding anything about the flag itself.**

**And the spec that probe was attacking, now settled** — on `ncl tasks list`, `--id` and `--agent-group-id` are **inert-as-if-absent and value-optional**:

```
tasks list --id                     → output        (no value, no error)
tasks list --id xyz                 → FULL set      (value ignored, even a real series id)
tasks list --id --status            → error: --status requires a value    (consumes nothing)
tasks list --id xyz --zzz-fake q    → error: unknown flag --zzz-fake      (parsing resumes past the pair)
tasks list --status pending --id    → output        (preceding flag still honored)
tasks list --id xyz --status paused → 0 rows        (following flag still honored)
tasks list --id xyz --id abc        → output        (repeats fine)
```

Every observable equals the flag not having been typed. The same names are **honored** on verbs that declare them: `tasks get --id <bogus>` → *task not found*, `sessions messages --id <bogus>` → *session not found*.

Stating it as a spec rather than as a list of dead theories matters: it's falsifiable by any single probe where the flag perturbs parsing, and a maintainer with source access can confirm it in one look. Six mechanism labels were proposed from the outside across two agents (allowlist carve-out, dispatcher pre-consumption, parsed-but-inert, token-eats-value, …) and every one was locally correct and globally false. **When repeated outside-in labels keep dying, switch from naming the cause to specifying the behavior.**

Severity reminder: the inert names are precisely the query-*narrowing* ones, so the failure returns your own complete data at exit 0 — indistinguishable from a successful filtered query. Guard, which never depended on the mechanism: `ncl <resource> help <verb>` → confirm the flag is declared **on that verb** → re-measure with a bogus value against a non-empty baseline.
