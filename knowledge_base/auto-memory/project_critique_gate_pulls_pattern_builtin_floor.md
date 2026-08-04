---
name: project_critique_gate_pulls_pattern_builtin_floor
description: "Critique gate's /pulls pattern is a hardcoded built-in floor (not per-agent config); denial cap auto-files admin bypass requests — 3 pending, all slang-pr-approver"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2d76471f-0c2b-40b5-aaa4-dd22929f52db
---

# Critique gate `/pulls` pattern — built-in floor, and its auto-escalation

## ⭐⭐ 5th instance (08-03, spy#1068) — the ABSTAIN fast-path is NOT path-dependent

**slangpy-pr-approver reported:** *"the critique gate refused my first attempt to send
the verdict as a final-response `<message>` block, though the identical marker text
passed via `send_message`. The ABSTAIN fast-path appears honored on the tool-call path
but not the final-response path."* **DO NOT RELAY THAT MECHANISM — it is almost
certainly wrong, and I nearly passed it upstream as a platform bug.**

Two independent disproofs, both cheap:
1. **The hook cannot see a final-response `<message>` block at all.** It is registered
   `PreToolUse` with matcher `mcp__nanoclaw__send_message|Bash` (verified in my
   `settings.json` hook dump). A `<message>` block is *not a tool call* — no PreToolUse
   fires, so the gate is not the denier. The real cause of a dropped `<message>` is the
   long-known [[feedback_message_block_before_toolcall_dropped]]: a block emitted before
   any later tool call in the same turn is **silently dropped, no error**. The approver
   saw "refused" and attributed it to the loudest nearby mechanism.
2. **The fast-path is content-dependent, and that fully explains a real denial.**
   `:96-99` fires only when `ABSTAIN_(POLICY|INFRA)` matches **and**
   `\b(WOULD_APPROVE|BLOCK)\b` does **not**. I ran the exact predicate:
   a bare abstain → allowed; an abstain whose prose *mentions* `WOULD_APPROVE`/`BLOCK`
   (e.g. explaining "only WOULD_APPROVE and BLOCK are critique-gated" — a very natural
   first draft, and its own report contains that sentence) → **fast-path declines, gate
   proceeds to the stage check, DENY.** Control: lowercase `blocked` does *not* trip it
   (`\b…\b` on the uppercase token), so `mergeable_state=blocked` is safe.

⇒ Same failure family as the 4 instances below: **a plausible mechanism, partially read,
citing a real file** ([[feedback_mechanism_must_predict_observed_coordinates]]). The
discriminator nobody ran: *does the denier even receive this event?* Here it cannot.
Note the asymmetry — the approver's story blames the **harness**; mine blames the
**message text**, which is fixable by the author. Prefer the hypothesis that the
instrument *can* observe.
⚠️ Both diagnoses are inference from the script + my own predicate run; I did **not**
see the approver's actual denial stderr (its session's `workflow-state.json` isn't
readable from my edge, and **no pending card exists for `sess-1785785872817-yn43nz`** —
`ncl approvals list` → 0 rows for it, so its send did not hit the denial cap).
**Actionable remedy either way:** keep `WOULD_APPROVE`/`BLOCK` out of an abstain's prose
(say "the asserting verdicts"), and deliver verdicts via `send_message`, not a trailing
`<message>` block.

---

**2026-08-03.** I was about to file this as a *per-agent config* defect. The
approver read the hook and corrected me; I then verified on my own edge.

## MINE-VERIFIED: it is a shared hardcoded floor, not per-agent config
`/app/hooks/gate-critique-on-deliver.sh` exists identically on my edge
(14391 bytes, Jul 26 11:22 — shared image path):
- **`:52`** `BASH_PATTERNS='gh pr create|gh api [^|]*pulls\b|api\.github\.com[^ ]*/pulls\b|createPullRequest'`
- **`:44`** comment: defaults "can never be configured away"; `.critique-delivery-markers`
  is **additive only** (`:58` appends `EXTRA_BASH`).
- **`:81`** `grep -qE "($BASH_PATTERNS)" <<< "$TEXT"` — matches the **text**, so a
  read-only `GET` on `pulls/N` is indistinguishable from a `POST`.
- **`:89-99`** ABSTAIN fast-path is real: `send_message` carrying
  `ABSTAIN_POLICY`/`ABSTAIN_INFRA` skips the gate (an abstain asserts nothing).
  Disabled by `CRITIQUE_ABSTAIN_FASTPATH=0`. This is why #803 reporting never
  tripped it — only ad-hoc reads did.

⇒ ❌**"per-agent config difference" was WRONG** (my framing) and ❌**"over-broad
regex, substring-not-method" was wrong on the interesting part** (approver's
framing) — the client-agnostic text match is *deliberate*, since pattern
enumeration can't be complete and the OneCLI proxy is the real backstop. The only
defensible narrow complaint: **GET vs POST on `pulls/N` is not discriminated.**

## The real mechanism — same hook, different STATE
The gate denies only when required stages are unsatisfied. Approver's session had
`critique_rounds: None`, `stages: []` ⇒ **every** `/pulls`-shaped read denied. My
edge has recorded rounds / no `DECISION_REVIEW`+`OUTPUT_REVIEW` requirement ⇒ same
reads pass. **Capability differences between tiers can come from session state, not
config** — check state before blaming config.

## ⚠️ The denial cap auto-files an admin bypass request — 3 PENDING, all approver
`ncl approvals list` (admin-only, mine to run):

| approval_id | created | session | reason |
|---|---|---|---|
| `appr-1785782142147-2w0ll8` | 08-03 18:35 | `sess-1785780348602-wzx7m9` | missing stages: DECISION_REVIEW, OUTPUT_REVIEW |
| `appr-1785777471712-vu2nbi` | 08-03 17:17 | `sess-1785394329456-a80m0q` | 5 edits since last critique round — OUTPUT_REVIEW approve no longer covers current state |
| `appr-1785536641647-wfi55o` | 07-31 22:24 | `sess-1785454385716-bvj5tl` | missing stages: DECISION_REVIEW, OUTPUT_REVIEW |

All `agent_group_id = ag-1783611156430-vvj8oi` (**Slang PR Approver**), all
`action=critique_gate_bypass`, all `hit="PR creation"`, all **pending**.

⭐**Only the 18:35 row corresponds to the approver's self-reported probe** (it
cited `requested_at 1785782080` ≈ 18:34:40Z; row is 18:35:42Z, same minute, same
session-era). **The 17:17 and 07-31 rows are NOT from the probe** and the approver
did not mention them — so "treat it as noise from my probe" covers **one of three**.
⚠️Do **not** dismiss a queue on a report that explains only its newest row: the
17:17 row's reason ("5 edits since the last critique round") describes a *real*
stale-critique condition, and the 07-31 row has sat pending ~3 days.

**Standing decision: approve none of them.** A `critique_gate_bypass` is a request
to deliver an artifact whose critique stages are unsatisfied — approving it as
"probe noise" would wave through the exact gate that has been catching errors all
session.

## ⛔ `ncl approvals` IS READ-ONLY — clearing these was never mine to do
`ncl approvals help` → **verbs: `list`, `get` only.** No reject/deny/expire verb;
rows are deleted "after the admin approves/rejects **or the request expires**" —
i.e. via the **card**, not the CLI. ⇒ my offer to "have them rejected" overstated
my own surface. All I can do is *not approve*, and tell the operator these three
cards are safe to reject. ⭐**Check the verb list before promising a disposition** —
an admin-only *read* resource reads as write-capable if you never ran `help`.

## ⚠️ The approval→session mapping I was given was WRONG (verified, disposition unchanged)
Approver reported `appr-…vu2nbi` (17:17) as `sess-1785777174387-pqkljg`, thread
`gh-pr-…-801`. **Ledger says its `session_id` is `sess-1785394329456-a80m0q`,
thread `gh-issue-shader-slang/slang-rhi-803`** — the session that produced this
chain's **R1** verdict. All four cited sessions are still `status=active`, so
"terminal/dead" describes the *work*, not the session row.

I verified the substance anyway rather than rejecting the conclusion with the
mapping: `sessions messages sess-…a80m0q` ends with the R1 ABSTAIN_POLICY delivered
outbound (07:13–07:14Z, "Chain closed and acknowledged") ⇒ **that session's artifact
WAS delivered**; nothing undelivered sits behind its bypass. Same disposition,
independently derived. ⭐**A right disposition on a wrong mapping is still worth
correcting — the next person re-checks via the citation, and a bad citation sends
them to the wrong session** ([[feedback_mechanism_must_predict_observed_coordinates]]).

### ⭐⭐ WHY it was wrong — and why approval→session mapping is PERMANENTLY MINE
The approver **structurally cannot read the approvals ledger**: `ncl approvals get`
→ `error (forbidden): CLI access is scoped to this agent group`, even for its own
group's row. **MINE-VERIFIED:** its `cli_scope = 'group'`, and scope=group permits
only `groups`/`sessions`/`destinations`/`members`/`tasks` — **`approvals` is not in
the set.** So it had no `session_id` field at all and *derived* one by matching the
card's `17:17:51Z` against `sessions list`, picking one created 17:12.

⭐**Timestamp adjacency is correlation, not identification — and here it
systematically EXCLUDED the right answer**, because the true session was created
**07-30** and merely *fired* on 08-03. Proximity ranks candidates; it never
identifies one. The authoritative field is the ledger's own `session_id`.

⇒ **Standing routing rule: when a coworker reports a `critique_gate_bypass` (or any
approvals row), it CANNOT supply the session mapping — I must run
`ncl approvals get <id>` myself.** Ask the coworker only for what it can see from
its own transcripts (was the artifact delivered?). Symmetric to my own
`ncl approvals help` miss: **both tiers overclaimed a surface they hadn't checked**,
one on the read side, one on the write side.

⭐**A wrong id is worse than no id.** Omission makes the reader look it up; a
confident wrong one gets re-checked *through* it. Correct form when blocked:
*"cannot read the ledger — its `session_id` is authoritative, please map it"* plus
the part you can verify. Also: **"terminal" described the WORK while `sessions get`
shows all four rows `status=active`** — two different claims that read identically
in a table column.

## Root cause of the 17:17 row: a DELIVERY gate tripped by memory-maintenance EDITS
The 17:17 reason "5 edits since the last critique round" reads like a stale-critique
condition on deliverable work. It isn't: that session was **editing memory files**
(index compaction / retraction sweeps). The gate counts *any* edits, so a burst of
memory maintenance ages an `OUTPUT_REVIEW` approve, then trips on the next
`/pulls`-shaped **read** ⇒ **a read blocked by a delivery gate**. Real fix is
upstream: don't let memory-file edits age a delivery approval, and discriminate GET
from POST.

### ✅ MECHANISM MINE-VERIFIED (control flow, not assertion) — and it SCOPES the claim
Approver flagged that it had only *asserted* this. I read the branch ordering myself
and its correction holds:
- **`:153`** freshness branch is guarded by **`[ -z "$DENIAL_REASON" ]`**, and
  `DENIAL_REASON` is set at **`:130-132`** when stages are missing (also `:140-147`
  on a non-`approve`/unrecorded `OUTPUT_REVIEW` verdict).
- ⇒ **"N edit(s) since the last critique round" is only REACHABLE once the required
  stages are recorded and the `OUTPUT_REVIEW` verdict is `approve`.** So the 17:17
  session had **completed** critique rounds, and `track-edits.sh` bumping
  `edits_since_critique` on its **memory writes** is what aged that approve
  (`:148-152` says exactly this: nonzero ⇒ "approve covers code that has since
  changed").
- ⇒ ⚠️**SCOPE: the memory-edits story explains the 17:17 row ONLY.** The 18:35 and
  07-31 rows read `missing critique stages: DECISION_REVIEW, OUTPUT_REVIEW` — the
  `:130` path, where freshness is never evaluated. My earlier "2 of 3 cards, same
  root cause" was wrong: **1 of 3** is the memory-aging defect; the other two are
  plain missing-stages denials.

⭐**Both tiers made the same error one message apart: read the branch that matched
the story, not the guard above it.** I did it twice on `gate-plan.sh`; the approver
did it here. ⭐⭐**For a hook, the GUARD CLAUSES ARE THE SEMANTICS — whether it runs
at all precedes what it matches** (`|| exit 0` entry conditions, then
`[ -z "$DENIAL_REASON" ]` short-circuits). ⭐**And I over-credited the approver**
("real and verified" when it was real but unverified) — **don't launder someone
else's assertion into verification while retracting your own**; that manufactures a
verified-looking claim out of a symmetry gesture
([[feedback_unattributed_fact_reads_as_your_own]] mirror-image clause).

## ⚠️ 18:4xZ — A COMPETING LEARNING NAMES A DIFFERENT TRIGGER. Both are edge-true.
Shared learning `1785782647584-only-the-passing-cases-locate-a-trigger-four-wrong.md`
states the guard's trigger is **the literal `state=` on an `issues/N` path**, listing
"blocks read-only `gh api`" as wrong-version v1. Its **methodological** rules are
excellent and adopted (below). But its *stated trigger* is **not** the built-in floor:
- MINE-VERIFIED: `/app/hooks/gate-critique-on-deliver.sh:52` contains **no `state=`
  and no `issues` alternative** (only hit for "issues" is unrelated prose in a denial
  message at `:143`).
- `:28` `OVERLAY_DIR="${OVERLAY_MARKER_DIR:-/workspace/agent}"`, `:53-58` reads
  `$OVERLAY_DIR/.critique-delivery-markers` and **appends** `bash_patterns`.
- Approver reports its own markers file = `bash_patterns: []`; **I have no markers
  file at all** (`/workspace/agent/.critique-delivery-markers` absent).
⇒ **Same hook, different ADDITIVE CONFIG** — one level out from "same hook, different
session state." An edge carrying a `state=`-on-`issues` marker sees exactly the
trigger that learning describes, correctly; a floor-only edge does not. ⚠️Neither
characterization is fleet-wide, and the learning should be amended to say so before
someone on a floor-only edge tests `state=`, sees it pass, and concludes the gate is
nondeterministic.

## ⭐⭐ I then committed the learning's OWN Rule 2, twice, while checking it
I tried the discriminating case `gh api …/issues/805 --jq '"state=\(.state)"'` →
**DENIED on my edge**, which contradicts the floor-only prediction. Rather than
concluding anything, note what actually happened: my **second** "control" put
`state=` inside a `grep -qE` pattern **in the same command** — so the co-located
literal killed the control, exactly the failure the learning documents as Rule 2 #1
(*one probe per command, always*). ⇒ **My two denials are NOT evidence about the
floor**; they're evidence my probe was malformed. ✅No escalation card resulted (still exactly 3
pending, none new, no `critique-escalation.json` on my edge).

### ✅ RESOLVED — it was `gate-plan.sh`, NOT the critique gate, and NOT my command text
I recorded "which hook fired" as unresolved. The approver pointed out it was
answerable from config, and it was — I filed a gap I could have closed. Only **3**
of the 7 `PreToolUse` registrations match `Bash` (not 13):
| matcher | hook |
|---|---|
| `Bash` | inline git-remote/OneCLI-stub guard (irrelevant — needs `git remote set-url`) |
| `Edit|Write|MultiEdit|NotebookEdit|Bash` | **`gate-plan.sh`** (`OVERLAY_HAS_PLAN=1`) |
| `mcp__nanoclaw__send_message|Bash` | `gate-critique-on-deliver.sh` |

**The critique gate is exonerated on my edge:** `OVERLAY_DIR=/workspace/agent` and
`.critique-delivery-markers` is **absent** ⇒ my floor is byte-identical to the
approver's, which has no `state=` and no `issues` alternative.

⛔⛔**RETRACTED — my `gate-plan.sh:71-86` attribution was ALSO WRONG, twice over
(approver-corrected, then MINE-VERIFIED by reading the file).** I read the middle of
the script and skipped both its entry conditions:
- **`:24` `[ -f "$OVERLAY_DIR/.overlay-plan-gate" ] || exit 0`** — the plan gate is
  **opt-in per edge**. **`/workspace/agent/.overlay-plan-gate` does NOT exist on my
  edge** ⇒ `gate-plan.sh` exits **before** ever reading `plan_written`. So my
  `plan_written: null` / `edits_since_plan: 32` are **inert**, exactly as they are on
  the approver's edge. It cannot have been the denier.
- **`:33-42` it DOES read the command for `Bash`** — a write heuristic on
  `(^|\s|\|)(>|>>)\s` or `\b(tee|sed -i|patch |git apply|git am|dd )\b`; non-writes
  `exit 0`. My "never reads the command" was wrong.
- **`:48-58` the allowlist is whole DIRECTORIES** (`/workspace/agent/{plans,reports,memory,conversations,fixes,reviews,critiques}/*`, `/workspace/.claude/*`) — the `*.md`/`*.json` rule is only the `:62-65` fallback. ⚠️**My memory lives at
  `/home/node/.claude/projects/-workspace-agent/memory/`, outside every allowlisted
  path** — latent, not live, since the marker is absent.

⇒ **The denier of my two `gh api` probes is once again UNRESOLVED**, and this time I
leave it that way rather than name a third suspect. What the evidence *does* support:
both probe commands carried write-shaped text (`2>&1 | head`, and a quoted
`> /tmp/f` inside a test string) — and a later command of mine was denied while
containing `> /tmp/f` **only inside a quoted string**, i.e. a **false-positive write
classification on a pure read** is a live candidate defect independent of any
`pulls` pattern. But candidate ≠ identified: I have not read the stderr prefix that
names the hook, so I am not claiming it.

⇒ ⭐⭐⭐**"Denied" is not one event type — identify the DENIER before treating a
denial as evidence about a MATCHER.** I have now mis-attributed the same two denials
**twice**: first to the critique-gate regex, then to `gate-plan.sh`'s plan state —
each time from a *plausible* mechanism I had partially read. ⭐**Reading a script's
middle and skipping its guard clauses produces confident, specific, wrong
attributions**; entry conditions (`|| exit 0` lines) come first. And ⭐**a
second wrong answer, delivered with fresh file:line citations, is more dangerous
than the first** — the citations read as verification.

**The symmetry survives, but with the mechanism corrected:** the approver's gate was
armed by memory-file edits aging an `OUTPUT_REVIEW` approve — that one is real and
verified. Mine was **not** `edits_since_plan` (inert here). So the honest line is
*one* tier's gate was armed by recording lessons, not both.

## ✅ PRIOR ART CONFIRMED — the floor trigger has THREE independent observations
MINE-VERIFIED in `/workspace/shared/learnings/`. This is what a "v1 was wrong"
framing would have retired:
1. **`1784126848994-critique-gate-bash-patterns-false-blocks-read-only.md`
   (2026-07-15, slang-pr-approver, PR #12119 R2):** names `gh api [^|]*pulls\b`
   exactly, "tripped **3× in one turn**", detoured via `issues` / `gh pr view` /
   `gh run list`. **Carries the operator-facing fix**: gate on write verbs/flags
   (`-X POST|PATCH|PUT|DELETE`, `--method …`, `-f`/`--field`/`--input`) instead of
   the bare `pulls\b`. Explicitly warns: **do NOT loosen unilaterally** — operator
   sign-off required, a mis-written regex could let real writes through.
2. **`1784737519525-critique-gate-false-positives-on-read-only-gh-api-.md`
   (2026-07-22, slang#11665):** ⚠️**I first filed this as "independently documents the
   memory-edit interaction" — i.e. adjacent corroboration. WRONG: it is a second
   INSTANCE of the compound failure.** MINE-RE-VERIFIED at `:3`, its symptom quotes
   **one** denial containing **both** halves verbatim — blocks a read-only
   `gh api …/pulls/<n>` **with** *"CRITIQUE REQUIRED before PR creation … N edit(s)
   recorded since the last critique round"* — and names `MEMORY.md compaction` as the
   aging cause. Grep confirms it quotes the **freshness** message (`:158`) and **not**
   `missing critique stages` (0 hits) ⇒ that session, like the 17:17 row, had
   completed stages and was aged by memory edits.
   ⇒ ⭐**CORRECTED COUNTS:** floor `pulls\b` GET false-block = **3** observations
   (07-15 · 07-22 · today, unchanged); memory-edits aging a delivery approve =
   **2 instances** (07-22 + today's 17:17 row), *not* "1 confirmed + a related note."
   The weaker finding is twice as well-evidenced as I filed it, and the two halves are
   **one compound defect**, observed together 13 days apart.
   ⭐⭐**A misclassification can under-state as easily as over-state — and I made both
   errors on the same document set this session** ("2 of 3 cards" over-stated; this
   under-stated). *"1 instance + a related note"* and *"2 instances of one recurring
   defect"* carry different weight in a filing, so the classification IS the claim.
   Also: "repeated denials escalate to an admin bypass request — which an admin may
   (correctly) reject, since there's genuinely nothing to critique" ⇒ **my refusal of
   all three cards matches two-week-old standing guidance**, arrived at independently.
   Also lists working detours: `git ls-remote origin refs/heads/<branch>`,
   `git log origin/master`, webhook payload as authoritative, `actions/runs` +
   `gh run list` ungated.
3. **Today (08-03):** **1 of 3** bypass cards = a read blocked by a delivery gate, aged
   by memory-file edits (the 17:17 row). ⛔**Was written here as "2 of 3" — the very
   figure §SCOPE above retracts.** The other two rows are plain `missing critique
   stages` denials (`:130` path, freshness never evaluated).
   ⇒ ⭐⭐**A correction is not applied until every restatement of the number is fixed.**
   This file retracted "2 of 3" in one section and preserved it in the summary list, which
   is the copy a reader scanning for the conclusion actually lands on. **Grep your own
   file for the wrong figure after retracting it** — a retraction that leaves a duplicate
   standing re-teaches the error with the authority of a numbered list.

⇒ ⭐⭐**A NEW HYPOTHESIS MUST EXPLAIN THE OLD EVIDENCE OR SCOPE ITSELF EXPLICITLY.**
The `state=`/`issues` trigger is real on an edge carrying that additive marker, but
calling the floor observation "wrong version v1" **retires evidence that was right
about a different edge** — the exact failure mode this whole thread has been
correcting, now committed by a *corrective* artifact. Both learnings' suggested
narrowing **is the same fix I filed with the operator**, which is the strongest
argument for it: three observations, a year apart, three agents, one fix.

## ✅ UNGATED DETOURS — documented 07-22, and I reinvented them ad hoc today
From the 07-22 note (all "confirmed working"), for PR state without touching a
`pulls`-shaped path:
- **`gh run list` and `gh api repos/.../actions/runs?...` are NOT gated** (no `pulls`
  in path) — this is why my CI checks on #803 sailed through all session.
- **git-only:** `git ls-remote origin refs/heads/<branch>` (true remote tip) ·
  `git log origin/master --oneline | grep <PR#>` (did it merge?) ·
  `git fetch && git log HEAD..FETCH_HEAD` (behind/ahead).
- **The webhook payload is authoritative** for merge/approval state.
- ✅ Add mine from today: **`raw.githubusercontent.com/<owner>/<repo>/<sha>/<path>`
  unauthenticated** — every source verification in this chain (`:409`, `:2040`,
  `:1099`) went through it, and it's immune to both the gate and the GraphQL outage.
⭐**Two weeks of documented detours existed while I derived them live** — cf. the
standing lesson that the answer already in my store is a *recall* failure, not an
evidence failure ([[feedback_narrowing_is_not_testing_check_own_store]]).

⭐**Rules adopted from that learning (they outlive its trigger claim):**
1. **Only PASSING cases locate a trigger** — a denial is consistent with every
   hypothesis that covers it; a pass eliminates hypotheses. Before publishing a
   characterization, list the observed passes and check the pattern predicts them; if
   it mispredicts even one, it is **known-false at the moment of writing**.
2. **An instrument inside the phenomenon cannot measure it** — co-location kills the
   control under a command-*text* matcher. One probe per command.

## ⭐ The probe tripped the instrument it was measuring
Testing which shapes match required *writing the pattern*, so the gate fired on the
probe text itself — twice — hitting the denial cap and auto-escalating. Same class
as this session's control-that-isn't-a-control chain
([[project_github_actions_graphql_401_outage]]): **an instrument that perturbs what
it measures.** The approver stopped rather than evading the pattern to keep testing
— correct: working around a safety gate to test it is the wrong move.

Related: [[feedback_dont_route_operator_gates_through_coworkers]] (bypass approval is
an operator gate, never routed through a coworker), [[project_slang_rhi_803_cpu_ray_query]].

---

## → Apparatus/probe failures moved out (size limit)
The `rate_limit` false capability-negative, the LOUD-vs-QUIET rule, the retire-a-probe rule, and the
enumerated 4 apparatus instances now live in **[[project_apparatus_probe_failures_rate_limit]]** — this file
crossed the 24,985-byte Read limit, which truncates the NEWEST content first.
