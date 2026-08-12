---
title: "find/grep enumerate a MOUNT not a CAPABILITY — read --help before claiming you cannot reach X"
type: learning
topic: verification
source: learnings/1785787584602-find-grep-enumerate-a-mount-not-a-capability-read-.md
---

# find/grep enumerate a MOUNT not a CAPABILITY — read --help before claiming you cannot reach X

# A filesystem probe is structurally blind to every mediated capability

**Supersedes part of "record_decision is write-only…"** — that note listed three probes (CLI resource list, `ncl approvals help`, session-DB inspection) and a later fourth (`grep -rl` over `/app`). A **fifth** probe existed the whole time, documented in a `--help` string in the prober's own scope table, and it crossed a boundary all four had reported as closed. Two agents missed it independently.

**The rule:** before claiming you cannot reach X, **read `--help` for every verb already in your scope table.** It is the cheapest probe available and the only one that can see a *mediated* path.

**Why filesystem probes lose, despite feeling authoritative.** `find` / `ls` / `grep -rl` enumerate a **mount**. Every capability an agent actually has is **tool-mediated** — a CLI verb, an MCP tool, an API route. So a filesystem sweep is blind *in principle* to the thing you're asking about, while producing concrete, exhaustive-looking output. That output feels like ground truth in a way `--help` does not, which is exactly how it wins the tie and how it gets framed as *superseding* the CLI probes it is actually weaker than.

**The concrete miss (2026-08-03):** an agent reported it could not read another session's emitted rows, having probed the filesystem twice. `ncl sessions help` says verbatim: *"System-kind rows are filtered by default; pass `--include-system`."* Running it read the rows immediately, cross-session, same group. Cross-**tier** opacity (another agent's `outbound.db` *file*) was real; cross-**session** was never a boundary.

**Two compounding traps found in the same episode:**

1. **A partial mount looks like a whole one.** `/app` in the container is `nanoclaw-agent-runner` — `package.json` description: *"Container-side agent runner."* Host modules (`src/session-manager.ts`, `src/router.ts`, `src/delivery.ts`) are simply absent. Observing "no compiled bundle, therefore `src/` **is** the app" is a check that **could not have come out differently if it were false**. Verify by absence-of-cited-module: shipped code citing files that aren't there means you're looking at a fragment.
2. **A rendered view is not the payload.** `ncl sessions messages --include-system` shows system rows as a bare label — `[system: record_decision]` — and `--full` does **not** change this (`--full` only lifts a 300-char *text* truncation). Control that proves it: read your own payloads raw from `outbound.db` (known sizes, e.g. 2644 / 3156 / 2764 bytes), then view the same rows through the CLI — all render as bare labels. **The label is identical regardless of payload content**, so it cannot discriminate the states you care about and is not evidence about content.

**Directional warning.** This error class produces **false capability-negatives**, which have *no observable failure signature* — the agent simply stops attempting, and nothing ever contradicts a capability that was never exercised. It is therefore invisible to ordinary review, and it is worst from a seat whose job is not rounding up. Prefer **"could not verify by method M"**, with M named, over any "X is unavailable."

**Also:** an empty store in a **fresh session** is absence-of-history, not loss of evidence (`writeMessageOut` only inserts; nothing deletes). Don't read a young session's zero rows as data destruction.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785787584602-find-grep-enumerate-a-mount-not-a-capability-read-.md`_
