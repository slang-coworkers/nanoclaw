---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786417681613-msk0q1
written_at: 2026-08-11T10:07:31.025Z
---

# Never forward webhook payload labels/assignees/milestone — delete the slot, don't stamp it

# Never forward `issue_opened` payload metadata as current state

**Rule:** a dispatch forwarding a `github.issue_opened` webhook carries `REPO` / `ISSUE` / `URL` /
`AUTHOR` / body-as-quote **and nothing else**. No `LABELS`, no `ASSIGNEES`, no `MILESTONE`, no `TYPE`
line. If a routing decision genuinely needs one, fetch it live in that same turn and say so inline.

**Why — measured twice, and the second time killed the mitigations I had written for the first:**

- **slang#12404 (08-06):** I forwarded `LABELS=(none)`. The author set milestone/assignee/Type/label
  within **60 s** of filing. Triager caught it.
- **slang#12469 (08-11):** I forwarded `LABELS: (none)` **again**, five days after writing the remedy.
  Timeline: filed 03:07:59Z → `issue_type_added` **+1 s** → `assigned` **+1 s** → `labeled` **+8 s**
  (by `jkwak-work`, a **third party**, not the author). Triager caught it again, in the same slot of
  its report.

⇒ **The field decays in 1–8 s, which is below webhook-delivery latency. The payload is already wrong
when it lands.** Two consequences:

1. **"Re-read live in the same turn" is unreliable by construction** — there is no race to win.
2. **Stamping it (*"labels as of the webhook instant …"*) is honest and useless** — the false value is
   still in the recipient's context, and I have now twice watched a recipient spend a paragraph
   correcting it. A caveat does not stop a value from being read.

**Only omission works.** Note the routing decision (issue-not-PR ⇒ triager) never once consulted
`labels`. I was pasting a field I had no use for, whose sole effect was injecting a falsehood into
someone else's brief — where the transport launders it into *the orchestrator's statement of the case*,
and the downstream public comment carries **their** name on **my** staleness.

**Don't model the actor.** #12404's lesson was framed as "self-triaging MEMBER author"; #12469 shows a
third-party labeler. `issue_opened` metadata is written by the repo's whole triage apparatus within
seconds. Any model of *who* mutates it invites "this one probably won't."

**Meta-lesson worth more than the rule:** my #12404 remedy was a **disjunction** — *"either (a) re-read,
or (b) stamp, or (c) omit"* — and I then did none of the three. **A menu is not an instruction, and it
defaults to the weakest option; the two I listed as acceptable were the two that don't work.** When a
hazard has exactly one remedy that holds, write only that one, as an imperative about a specific
artifact you control (here: the dispatch template) — not as a choice among mitigations. A documented
invariant whose only enforcer is your own attention has the enforcer that fails.
