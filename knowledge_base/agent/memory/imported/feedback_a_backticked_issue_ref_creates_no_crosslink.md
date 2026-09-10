---
name: feedback_a_backticked_issue_ref_creates_no_crosslink
description: "A `#12378`-style issue ref inside a code span is INERT — GitHub creates no cross-reference, so a 'cross-linked, worth cross-linking' claim in a comment can be true as prose and false as GitHub state. Verify a link by the TIMELINE, never by the body text; and `git log -S` on a shallow clone attributes every addition to the graft root"
metadata:
  node_type: memory
  type: feedback
  originSessionId: webhook-12428-routing
---

# A backticked issue reference is prose, not a link

**2026-08-08, slang#12428, routing `slang-triager`'s triage.** The verdict comment (`5225765253`)
said #12378 *"is worth cross-linking"* and its dedup section reasoned about it at length. I went to
confirm the link existed and found **it does not**.

**Measured on the posted body:**
- `#11454`, `#11455`, `#11520`, `#12378` — **4 refs, all inside backticks. 0 bare.**
- Instrument control: the same regex on #12367's comment `5199718759` finds **1 bare** `#12378` ⇒
  the pattern detects bare refs; the zero is real, not a broken grep.
- GitHub state control: #12378's timeline holds **1** `cross-referenced` event, *"from #12367"* —
  **not from #12428** — across 28 total timeline events. #12428's own timeline: `commented`,
  `issue_type_added`, 4× `labeled`. **No cross-reference in either direction.**

⇒ ⭐⭐⭐**A `#N` inside a code span is inert: no link, no timeline event, no notification on the
target.** A maintainer triaging #12378 will never learn #12428 exists. The comment's *prose* is
accurate ("worth cross-linking" — a recommendation) and its *effect* is nil, which is exactly the
gap that reads as done.

⇒ ⭐⭐**Verify a cross-link by the TARGET's timeline, never by the source's body text.** The body
tells you what someone meant to do; the timeline tells you what GitHub did. Cheap:
`gh api repos/O/R/issues/N/timeline --paginate --jq '.[]|select(.event=="cross-referenced")'`.

⚠️**Why backticks are the DEFAULT failure here, not an accident:** every house style rule that says
"wrap identifiers in code spans" pushes `#12378` into a code span, because it *looks* like an
identifier. The habit that makes comments readable is the habit that silently unlinks them. Expect
this in any well-formatted bot comment, and expect the author to believe the link exists.

## Second finding from the same check: `git log -S` lied on my edge

The triage's recommendation rested on *"two precedents already in `visitExpressionStmt`."* Applying
[[feedback_two_tiers_one_frame_is_shared_prior]] §1 (**date the CHANGE, not the file it lives in**), I
ran `git log -S` on both strings and got **one commit for both** — `0864e60e6`, subject *"scope
SPIR-V DebugFunction…"*, unrelated to either diagnostic.

**That was my instrument, not a finding.** `git rev-parse --is-shallow-repository` → **true**,
`git rev-list --count HEAD` → **32**, and `0864e60e6` **is the graft root** (`git log --format=%h |
tail -1`). ⇒ ⭐⭐⭐**On a shallow clone `git log -S` reports the graft root as the introducer of
everything that predates the graft** — a confident, plausible, wrong date, with no error and no
empty result. Same family as [[feedback_shallow_clone_makes_your_head_the_graft_root]].

✅**The method that needs neither edge's local history — GraphQL blame against the remote:**
```
gh api graphql -f query='{repository(owner:"O",name:"R"){object(expression:"<sha>"){
  ... on Commit { blame(path:"<path>"){ ranges { startingLine endingLine
    commit { oid committedDate messageHeadline } } } } }}}'
```
Both precedents came back genuinely pre-existing: dangling-`==` → `61ad43dbc` **#11493, 2026-06-12**;
`[NoDiscard]` → `4ed4aeffb` **#11520, 2026-06-16**. **The recommendation's foundation held** — but I
would have published "the precedents are 5 days old and from the same commit as an unrelated SPIR-V
fix" if I had trusted `-S`. ⇒ ⭐⭐**A date check that AGREES with your prior is the one you skip
controlling.** I only questioned it because the *subject line* was absurd for the change — the
range-check habit from [[feedback_deference_drifts_to_whoever_corrected_you_last]], firing on a
commit message instead of a number.

Related: [[feedback_an_in_place_edit_notifies_nobody]] (the sibling failure — the write happened but
notifies nobody; here the link never happened at all),
[[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]].
