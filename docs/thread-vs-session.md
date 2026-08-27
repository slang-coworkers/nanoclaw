# NanoClaw — Thread vs Session: the two independent keys

A recurring source of confusion (and at least one real chain-integrity bug) is conflating a **thread** with a
**session**. They are two orthogonal identifiers. Keeping them distinct is the key to reasoning about
multi-coworker collaboration and about what the dashboard shows.

---

## 1. The two keys

| Key | What it identifies | Granularity |
|-----|--------------------|-------------|
| `thread_id` (e.g. `gh-issue-shader-slang/slang-11487`) | the **shared topic** — one issue/PR/conversation | one per topic, shared by ALL coworkers |
| session, keyed `(agent_group_id, messaging_group_id, thread_id)` | **one coworker's private memory** — its own `inbound.db` / `outbound.db` (= its container context) | one per coworker per topic |

The critical sentence: **a session is NOT the conversation.** A session is one coworker's *private notebook*
for a topic. The shared conversation is the *set* of all coworkers' notebooks that carry the same `thread_id`.

- Session identity & resolution: `resolveSession` (`src/session-manager.ts`), `findSessionForAgent`,
  `findSessionByAgentThread` (`src/db/sessions.ts`).
- Per-session DBs: see [db-session.md](db-session.md).

---

## 2. A worked example

Issue X = `gh-issue-shader-slang/slang-11487`, worked by four coworkers. Each has its **own** session / its
own pair of DBs:

```
gh-issue-…-11487            (one shared thread_id)
 ├─ orch(X)      → session O   →  O.inbound.db / O.outbound.db
 ├─ triager(X)   → session T   →  T.inbound.db / T.outbound.db
 ├─ fixer(X)     → session F   →  F.inbound.db / F.outbound.db
 └─ reviewer(X)  → session R   →  R.inbound.db / R.outbound.db
```

When **triager → fixer** sends an agent-to-agent (a2a) message, the host writes a row into **F.inbound.db**
(fixer's notebook), stamped `source_session_id = T`. When **fixer ⇄ reviewer** talk, rows land in F and R
respectively, each tagged with its sender. So:

- **fixer's one session F** physically holds the messages it *received* from triager AND reviewer, plus its
  own outbound — all in one DB pair, because it is all *fixer's* memory. Each inbound row knows its sender via
  `messages_in.source_session_id`.
- triager's T and reviewer's R are **separate** DB pairs. Fixer's notebook never contains triager's private
  reasoning — only the messages triager explicitly *sent to* fixer.

### Reply routing is per-message, not per-session

A reply resolves its destination from the specific inbound row it answers — `in_reply_to` →
`messages_in.source_session_id` (`resolveExplicitReplyTarget`, `getInboundSourceSessionId`). It does NOT depend
on the recipient session's identity. This is why one session can safely receive from multiple senders and still
route every reply home to the correct peer.

---

## 3. Before/after the gh-issue/gh-pr collapse fix

The collapse fix in `resolveSession` did **not** merge across coworkers. It fixed a coworker fragmenting its
**own** notebook into several.

Session identity includes `messaging_group_id`, and every a2a sender talks through a distinct synthetic
messaging group `agent:<sender>:<recipient>` (`ensureA2aWiring`). So before the fix, the fixer got a *separate
session per phone-line*:

```
BEFORE  (fixer's own memory fragmented across senders):
 fixer(X) ┌─ session F1  (mg = triager→fixer)   ← triager's handoff landed here
          ├─ session F2  (mg = main→fixer)       ← main's follow-up landed here (F2 can't see F1!)
          └─ session F3  (mg = fixer→fixer)       ← fixer's own self-notes

AFTER  (one coworker = one session per gh-issue thread):
 fixer(X) └─ session F   (canonical for gh-issue-…-11487)
            ← triager's handoff + main's follow-up + fixer's notes ALL here,
              each row tagged source_session_id = who sent it
```

A handoff from the triager and a follow-up from main on the *same issue* used to land in *different fixer
containers' memory* — a chain-integrity hazard. The fix collapses them, scoped to the canonical
`^gh-(issue|pr)-` namespace only (GitHub issue/PR ids are globally unique = one conversation everywhere).
Generic a2a threads (named threads, Slack `thread_ts`, `msg-*` ids) keep their per-source isolation by design —
broadening the collapse to all a2a threads was tried and reverted in PR #301.

**Existing splits are reconciled automatically.** The forward fix only stops *new* splits; installs that already
accumulated splits are healed by `reconcileGhSessions` (`src/reconcile-gh-sessions.ts`), which runs once at host
startup (`src/index.ts`) and merges every non-canonical session for a gh-thread into the canonical one. It is
idempotent (a no-op once collapsed), preserves seq parity, rewrites `messages_in.source_session_id` references
so per-message reply routing still resolves, and backs up `v2.db` + each mutated session DB first. The CLI
wrapper `scripts/reconcile-gh-sessions.ts` (`--apply` / dry-run default) exposes the same function for manual
runs (host service must be stopped — it aborts on a live session).

---

## 4. The right dashboard mental model

There is **no single "gh-\* conversation" DB.** The issue's full conversation is spread across O, T, F, R — four
notebooks. So two distinct views answer two distinct questions:

1. **Per-coworker view (a tile = one session)** — "what does *fixer* know/see about this issue?" → open session
   F. The dashboard thread tile carries the specific session id and opens exactly that session, not an
   interleave of everything sharing the thread_id.

2. **Shared-thread swim-lane view** — "show the *whole* issue across all coworkers" → the union of O, T, F, R on
   `thread_id`, rendered **one lane per coworker**, attributed by `session_id` / `source_session_id`:

```
gh-issue-…-11487   [shared thread view]
 orch     │ ▸────▸──────────▸
 triager  │     ▸───▸                (handoff to fixer)
 fixer    │         ▸──▸───▸         (received triager + reviewer messages)
 reviewer │              ▸──▸        (review thread with fixer)
          └ one timeline, grouped/colored by coworker — never silently interleaved
```

The original "mixing conversation" bug was a **broken** version of view 2: the endpoint unioned multiple
sessions sharing a thread_id and interleaved them into one ambiguous scroll with no per-coworker attribution —
made worse by the self-fragmentation, which meant some of those "sessions" should never have existed. After the
collapse + the tile-opens-one-session fix, view 1 is clean.

**Both views now exist.** View 2 (the swim-lane) is served by `/api/messages?thread_id=<tid>&lane=1`: the
endpoint unions every coworker's active session on that `thread_id` (each row already stamped with
`group_folder` + `session_id`) and returns an ordered `lanes` array (participants ordered by when they joined
the chain). The client (`dashboard/public/app.js`) renders one color-coded lane per coworker. Toggle it from
any gh-issue/pr thread header (the `⇄ shared` button) or deep-link via `#/cw/<folder>/l/<thread_id>`.

---

## 5. Side-channels on the same issue

The collapse keys on the **exact, full** `thread_id` (`findSessionByAgentThread` matches `thread_id = ?`). So
only a session whose thread_id is *exactly* the canonical `gh-issue-<owner>/<repo>-<num>` is folded in. A
distinct thread_id — including the documented append-only sub-thread form
`gh-issue-<owner>/<repo>-<num>/<sub-task>` — is a different string, gets its **own** session, and is NOT
collapsed.

This matches what coworkers are actually instructed to do (`container/spines/base/context/chain-reporting.md`):
reuse the canonical key *verbatim* for the main chain, and only append `/<sub-task>` for a genuinely separate
sub-conversation. Reply routing is per-message (`in_reply_to → source_session_id`), so a coworker can be in the
shared issue thread AND a private sub-thread at once and each reply still lands in the right place.

The one thing to avoid: deliberately reusing the *exact* canonical id for an unrelated side-conversation — that
WILL merge into the main session, by design. Use a `/<sub-task>` suffix (or an unrelated named thread) instead.

---

## See also

- [db-session.md](db-session.md) — the per-session `inbound.db` / `outbound.db` schemas + seq parity.
- [db.md](db.md) — three-DB overview and the single-writer rule.
- [isolation-model.md](isolation-model.md) — channel isolation levels.
- [cross-instance-routing.md](cross-instance-routing.md) — how GitHub webhooks pick the owning session.
