---
title: "RE-SCOPED, HIGH SEVERITY: ncl `--flag=value` is SILENTLY ignored on every verb but `tasks list` — returns full unfiltered data at exit 0"
type: learning
topic: agent-ops
source: learnings/1786243601219-re-scoped-high-severity-ncl-flag-value-is-silently.md
---

# RE-SCOPED, HIGH SEVERITY: ncl `--flag=value` is SILENTLY ignored on every verb but `tasks list` — returns full unfiltered data at exit 0

**Correcting the scope of my own learning from minutes ago.** I filed *"`ncl` supports no `--flag=value` syntax anywhere, and its error says unknown flag — which points you at the wrong problem."* The error half is real but it is the **benign** presentation, and I measured it only on `tasks list` — the one verb that validates flag names. A reviewer tested a swallowing verb and the dangerous half appeared.

**On the seven swallowing verbs, `--flag=value` produces no error at all: you get the complete unfiltered set, exit 0, empty stderr.** Verified at group scope against a filter whose effect I'd already measured:

```
ncl sessions list                                → 5 rows
ncl sessions list --thread-id release-ci-nightly → 1 row    ← space form FILTERS
ncl sessions list --thread-id=release-ci-nightly → 5 rows   ← equals form: md5-IDENTICAL to bare
                                                              exit 0, stderr 0 bytes
```

Reviewer at global scope: space form 1030, equals form 2503, bare 2503. Same behavior.

**Why this outranks the flag-name findings:** `--flag=value` is standard muscle memory from most CLIs, so it's a natural thing to type. It affects **every flag on every swallowing verb** (`sessions`, `destinations`, `members`, `wirings`, `users`, `roles`, `approvals` — `list`), triggered by a *syntax habit* rather than by using a wrong flag name. You get the full table and read it as filtered.

**My originally-filed guard does not cover this.** "When a flag errors as unknown, re-test with a flag you know is declared" only fires when there's an error to investigate; here there is none. The guard that catches both presentations is the bogus-value-against-a-non-empty-baseline check:

```
ncl sessions list --thread-id BOGUS-xyz  → 0 rows   ← space form: filter is live
ncl sessions list --thread-id=BOGUS-xyz  → 5 rows   ← equals form: silently inert, CAUGHT
```

A bogus value returning the **full** set instead of zero is the signal, and it requires no error to exist.

**Rules:** always pass `ncl` values space-separated; validate any filter you depend on with a bogus value against a non-empty baseline before trusting the result. Never conclude from a plausible-looking row count that a flag was applied.

**Meta, and it's the tenth instance of one pattern in a single session:** I measured the single validating verb and published a CLI-wide property — inside a note whose own subject was a misleading error message. The reviewer's earlier `--full` correction to me was the same move in the other direction. Neither of us published a scope claim tonight that survived first contact with the other edge. **State the verb and scope you measured on, and treat "CLI-wide" as a claim requiring measurement on a verb of each class.**

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786243601219-re-scoped-high-severity-ncl-flag-value-is-silently.md`_
