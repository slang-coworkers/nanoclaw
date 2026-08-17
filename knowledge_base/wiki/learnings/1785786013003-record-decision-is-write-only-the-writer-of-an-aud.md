---
title: "record_decision is write-only — the writer of an audit artifact cannot verify its own write"
type: learning
topic: ci-tooling
source: learnings/1785786013003-record-decision-is-write-only-the-writer-of-an-aud.md
---

# record_decision is write-only — the writer of an audit artifact cannot verify its own write

# The `approval_decisions` ledger is write-only from every agent tier

> ## ⚠️ PARTIALLY RETRACTED same day (2026-08-03 20:06Z) — read this first
>
> The sentence below claiming **"no agent tier has any read path back to it"** is **TOO WIDE**, and the "three/four probes" framing under-counted. A **fifth** probe existed the whole time, documented in a `--help` string in my own scope table: **`ncl sessions messages <session-id> --include-system` reads emitted rows ACROSS SESSIONS** (same group). It shows that a `record_decision` call happened, and when — verified against another agent's session. So **emission and call-count ARE readable**; cross-*tier* opacity applies to another agent's `outbound.db` **file**, not to cross-*session* reads.
>
> What survives, and is now the load-bearing claim: **the stored `approval_decisions` ROW is unreadable, so the upsert-vs-append semantics remain unverifiable.**
>
> **The payload is ABSENT FROM THE API SURFACE — not truncated (verified two agents, `--json`).** `ncl sessions messages` renders system rows as a bare label (`[system: record_decision]`); `--full` does *not* lift it (that flag only removes a 300-char *text* truncation). An **undocumented `--json`** bypasses the renderer and settles the mechanism: each row has exactly **five** keys — `direction, kind, seq, text, timestamp` — and **`text` is synthesized**, not stored content. There is no payload field to ask for, so **no flag and no retry rescues it.** Control that proves it: an `append_learning` row known to be **3156 bytes** in the writer's own `outbound.db` returns `text_len=25` via `--json`, with no payload key.
>
> ⭐ **"Truncated" and "absent field" imply opposite remedies** — hunt for the flag vs. stop looking. Diagnose which one you have before promising either.
>
> ⚠️ **Do not count occurrences by grepping raw session transcripts: your own `ncl` reads are logged into the transcript you are reading.** Measured in one session, system rows were `cli_request` 15 + `cli_response` 14 + real actions 4 — i.e. **29 of 33 rows were the observer's own queries**. A grep-the-transcript census inflates with query volume. Filter with `--json` + `kind=system` and match the action name. **A read that is itself logged to the thing you are reading is not a passive observation.**
>
> Root cause of the over-wide claim: I trusted `find`/`grep` over `--help`, because filesystem probes *feel* like ground truth. They enumerate a **mount, not a capability** — see the superseding note **"find/grep enumerate a MOUNT not a CAPABILITY — read --help before claiming you cannot reach X."** Prefer *"could not verify by method M"*, M named, over any "X is unavailable."

**Fact (probed 2026-08-03 at `cli_scope=global`, the widest agent scope) — ⚠️see retraction above, the "no read path" half is too wide:** `mcp__nanoclaw__record_decision` and `record_human_verdict` write to the host-owned `approval_decisions` table. You cannot confirm the stored row's contents, nor that a re-record replaced a prior row rather than appending. (Emission *is* confirmable — via `ncl sessions messages --include-system`, and via your own `outbound.db`.)

**Three independent probes, all negative — reuse these rather than re-deriving:**

1. `ncl help` → 13 resources (groups, messaging-groups, wirings, users, roles, members, destinations, sessions, tasks, user-dms, dropped-messages, approvals, policies). **No `approval_decisions`.**
2. `ncl approvals help` → **a different table.** In-flight self-mod / OneCLI approval *cards*, whose rows are *deleted* after the admin responds. The name collision is the trap: "approvals" is not "approval decisions."
3. Reachable SQLite is only the two session DBs — `/workspace/inbound.db` (`messages_in`, `delivered`, `destinations`, `session_routing`) and `/workspace/outbound.db` (`messages_out`, `processing_ack`, `session_state`, `container_state`). Neither holds a ledger table.

A `global`-scope negative is the strong form: a narrower-scoped coworker will not find a path that `global` lacks.

**What this means for how you report.** The tool doc states "Host-owned + auditable; survives container exit" and "One row per `(repo, pr, commit_sha)` — a re-run on the same commit replaces it." Both are true as a **contract**, and both are things you **relay, never observe**. A success return from the tool call means the call succeeded, not that the stored row reads the way you intend.

- Say **"recorded — call returned success; row contents not verifiable from my tier."**
- Never say "the ledger row now reads X."
- Per the capability-negative rule, phrase the limit as **"could not verify by method M"** with M named — never "the ledger is unverifiable" (it is fully auditable *host-side*, by the operator). This is not a broken audit trail; it is that **self-verification is structurally unavailable.**

**The generalizable shape: the writer of an audit artifact cannot verify its own write.** This is the intended direction of an audit trail — a record you could freely re-read and adjust would be worth less. But it has a sharp consequence when combined with correction sweeps: if a retraction contaminates a reasoning field you already wrote into the ledger (e.g. `challenger`), you can *attempt* the repair but **cannot confirm it landed**. So a ledger correction must always be reported upward as **attempted**, naming the operator as the only party who can close it. Do not mark that item resolved.

**Companion:** a stale ledger field is the worst sweep surface to miss — notes only mislead future-you, while the audit artifact misleads the human auditing whether the process worked, and its headline fields (verdict, SHA) stay correct so nothing looks wrong.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785786013003-record-decision-is-write-only-the-writer-of-an-aud.md`_
