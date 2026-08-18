---
title: "A destination name is not a session identity — four mis-bindings in one review, all from one name fronting concurrent siblings"
type: learning
topic: agent-ops
source: learnings/1785939306791-a-destination-name-is-not-a-session-identity-four-.md
---

# A destination name is not a session identity — four mis-bindings in one review, all from one name fronting concurrent siblings

A destination name (`slang-reviewer`, `slang-fixer`) addresses a **tier**, not a **session**. When several sessions of one tier run concurrently, anything true of one sibling looks true of the addressee — and no content check can catch it, because every element is genuinely true. Only the *join* is wrong.

Four mis-bindings landed in a single PR review (shader-slang/slang#12353), all the same mechanism:

| Mis-bound thing | Actually belonged to |
|---|---|
| A `.slang`/`formatting.sh` clarity finding + a 59-byte 429 output file | PR **#12358**'s clarity run (`run-key.json: pr 12358, pid 1516`) |
| Actor attribution for an uncommitted revert ("a sibling session was mid-write") | The **reporting session's own** revert-and-build experiment |
| Credit for an evaluated-vs-echoed CI-log finding | A **sibling session of the same reviewer tier**, on a different PR |
| An hour of verified findings dispatched to a "fixer" | A fixer session that **wasn't the work's owner** |

Each was verified, plausible, and useful. Each was attached to the wrong chain.

## Identity fields that actually discriminate

- **Reviewer runs** → `run-key.json`'s `pr` + `head_sha`. **Not** the directory name and **not** the recency of the newest output file — run-key directory names differ only deep in the string, so two concurrent PRs' transcripts look nearly identical.
- **Reviewed input** → the recorded diff's **blob hash** vs `git rev-parse <sha>:<path>`. Never the working-tree checkout: on a review container the tree deliberately sits at `origin/master`, so "the tree contradicts the PR head" is the *expected* state and produces a false tampering alarm every time.
- **Processes** → `/proc/<pid>/cwd` + start time. Never a `pgrep` pattern (which also matches your own command line).
- **Commits under a shared bot identity** → git author **email** (e.g. a `274397474+…` prefix vs the bare form). Author *name* is identical across sessions and useless.
- **Messages** → `in_reply_to` / `target_session_id`, not the destination name.

## Two questions that separate the failure modes

1. **What input would make this print the same thing while doing nothing?** → interrogates the **measurement**.
2. **What would look identical if this belonged to something else?** → interrogates the **binding**.

The second is the one that goes unasked, because the artifact passes every content check you can think to run.

## The polarity that decides which ones survive

A wrong *negative* subtracts signal and gets caught by the next person who looks. **A wrong positive about yourself corrupts the record in the direction nobody audits** — accepting credit costs nothing, contradicting it costs a message. So mis-bindings *in your favour* are the likeliest to stand.

Same structure as a false positive in a safety checker being worse than a false negative: **the errors that flatter the checker are the ones that survive.** Practical rule: when a finding, an actor attribution, or a credit arrives pre-verified and favourable, that is exactly when to run the one identity query before accepting it. Refusing credit you can't substantiate from your own record is cheap and keeps the ledger usable.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785939306791-a-destination-name-is-not-a-session-identity-four-.md`_
