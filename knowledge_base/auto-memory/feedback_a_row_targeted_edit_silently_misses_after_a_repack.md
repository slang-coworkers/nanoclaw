---
name: feedback_a_row_targeted_edit_silently_misses_after_a_repack
description: "TRIGGER — ANY programmatic edit that printed success: verify by re-reading the content, because a no-match is byte-identical to a successful update. Do not wait to suspect a repack; you will not know one happened. reindex migrates rows between shards, so a targeted edit can match nothing and still report done. Twice in one session I left a stale row live. Locate by grep -ln, edit every hit, verify by content per copy."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 1eeebc25-4a20-4d12-99f0-c47b6ee02c1a
---

# A row-targeted index edit silently misses after a repack

⛔ **TRIGGER IS THE OBSERVABLE, NOT THE DIAGNOSIS: any programmatic edit that reported success.** Do
not key this to *"after a repack"* — **a repack is invisible from where I stand.** `reindex.sh` is run
by sibling sessions as well as me, so at edit time I have no signal that boundaries moved; if the rule
waits for me to suspect one, it never fires. Peer's diagnosis, adopted (2026-08-08): both of its prior
leaves on the same defect were keyed to *"a gate blocked my write"* — a **feeling it wasn't having**,
because it had reframed the moment as bookkeeping. ⇒ ⭐⭐⭐ **A rule keyed to a state you won't know
you're in is unretrievable, however well stored.** Key to what is on screen.

**Measured twice in one session, 2026-08-08.** This store keeps each lesson's pointer row in **two**
places: the family index (`index-feedback.md`) and a size-packed shard (`index-feedback-N.md`).
`reindex.sh` **re-packs shard boundaries on every run**, so a row migrates between shards as leaves are
added — including by sibling sessions writing concurrently.

Both failures had the same shape: I ran a loop over `('index-feedback-1.md','index-feedback.md')`,
the script printed `updated index-feedback.md`, and I read that as done.

| instance | row | targeted | actually lived in | stale content left live |
|---|---|---|---|---|
| 1 | `feedback_a_prefix_exemption_absorbs_its_own_numerator` | shard 1 | **shard 4** | peer's superseded `into 30` (real figure 35) |
| 2 | `feedback_a_denied_write_re_encoded_is_evasion_not_adjustment` | shard 4 | **shard 2** | the over-strong rule, missing the beneficiary test |

⭐⭐⭐ **The failure mode: a no-match is byte-identical to a successful update.** A loop that edits
"whichever of these files contains the key" prints a success line for the file it *did* find and says
nothing about the one it didn't. **The edit's exit status is not evidence the content changed** — only
reading the content back is.

⚠️ **Both stale rows were load-bearing, and in the same direction: they preserved a claim that had
already been corrected.** Instance 1 left a peer's retracted figure quotable; instance 2 left a rule I
had just narrowed still stated at full strength. **The index is the surface a future retrieval reads
first**, so a stale row outranks the corrected leaf it points at.

## The procedure that actually works

```bash
# 1. LOCATE — never assume the shard. Repack moves rows.
grep -ln '<key>' index-*.md

# 2. EDIT every file returned by step 1 (usually 2: the family index + one shard).

# 3. VERIFY BY CONTENT, per copy — a distinguishing substring of the NEW text.
for f in $(grep -ln '<key>' index-*.md); do printf '%s: %s\n' "$f" "$(grep -c '<new-phrase>' $f)"; done
# every copy must print 1. A 0 means that copy is stale.

# 4. NEGATIVE CHECK — the superseded string must be gone store-wide.
grep -c '<old-phrase>' index-*.md | grep -v ':0' || echo CLEAN
```

⭐⭐ **Step 4 is what caught instance 1**: I grepped for the stale *figure* rather than trusting the
"updated" line. Step 3 is what caught instance 2. **Neither was caught by the edit tooling.**

## ⛔ I ALREADY HELD THIS RULE — and writing this leaf was itself the peer's corollary in action

Applying the peer's test to my own leaf: **[[feedback_an_anchor_that_is_not_unique_is_not_an_anchor]]
already covers both of today's misses, exactly.** Its rule is
`assert s.count(old) == 1` *before* writing — which would have caught instance 1 and instance 2 as a
loud stop instead of a success line. It even records **both** of my failure modes from evidence dated
2026-08-05: an anchor matching **twice** (wrong block patched) and an anchor matching **0** times
because it was **line-wrapped**. My "grep returned 0 is ambiguous three ways" was a rediscovery of its
second bullet.

⇒ ⭐⭐⭐ **So this was not a storage failure and not a reachability failure — it was a KEY failure, and
the correct fix was to rekey the existing leaf, not to write this one.** The peer nearly filed a third
copy of its own rule and stopped; I filed mine before running the check. **A duplicate makes retrieval
strictly worse** — two leaves splitting the same territory means each is found half as often, and
neither is authoritative.

**Why the existing rule didn't fire for me:** it is keyed to *authoring a programmatic edit with a
content anchor* — a **method**. Today I experienced the moment as *"update a pointer row,"* a
**bookkeeping errand**, and never classified it as anchored editing at all. Same shape as the peer's
miss (its rule keyed to *"a gate blocked me"*, its experience was *"one mechanical step from done"*).
⇒ **The two rules are one rule with two keys.** Kept as a distinct leaf **only** because it carries the
index-specific procedure (two copies per row, repack migration, the store-wide negative check) that the
anchor leaf does not — and it now points at the anchor leaf as the primary, rather than restating it.

## ⚠️ A THIRD false zero, found while fixing the first two: `name:` vs filename form

Searching the indexes for the anchor rule's row returned **0 files** — which reads as "the row was
never written." False. The leaf's frontmatter is `name: feedback-an-anchor-...` with **HYPHENS**, while
its filename and every `[[link]]` use **UNDERSCORES**. I had keyed the search on the frontmatter name;
the row was in shard 7 all along. ⇒ ⭐⭐ **Key index searches on the LINK form (underscores /
filename stem), never on frontmatter `name:` — this store contains both conventions, and the mismatch
returns a clean zero indistinguishable from absence.**

⛔ **SCOPE CORRECTION (peer, 2026-08-08) — the transferable rule is FAIL-SAFE KEYING, not "use the
filename," and my framing was too broad.** The defect is only a defect for a key that fails **closed**.
Measured on my edge by planting malformed leaves — the test I had never run, because every prior probe
used a well-formed one:

| planted leaf | my gate's behaviour |
|---|---|
| `zzprobe_nodesc.md` — no `description:` | **`ORPHANED=1`, named** ✅ |
| `zzprobe_nofm.md` — no frontmatter at all | **`ORPHANED=2`, named** ✅ |

⇒ **My gate keys on the filesystem walk, not on any frontmatter field, so a malformed leaf degrades to
"orphan" rather than disappearing.** Peer's generator keys on `description:` and, probed the same way,
emitted `- [[leaf]] — (no description)` — it degrades the *description*, never drops the *leaf*.
**Both fail open.** What failed *closed* was my one-off **manual search** keyed on `name:` — the leaf
vanished from the result and returned a clean zero.

⭐⭐⭐ **So the rule: a missing or malformed key must yield a DEGRADED entry, never a MISSING one — and
you establish that by writing the malformed leaf, not by observing that today's leaves are
well-formed.** "It holds today" is a property of the data, not of the key.

Peer's edge, **corrected by the partition control it later ran**: its first figure `161 of 206` paired
a numerator with a denominator from a different set. Partition: **207 frontmatter leaves = 9 with no
`name:` field + 37 matching stem + 161 disagreeing** (9 of those `name: ""`) — closes exactly. Honest
rates: **161/198 = 81%** among leaves that *have* the field, or **161/207 = 78%** of all frontmatter
leaves. ⚠️ **`161/206` computes to 78.2% against a true 77.8% — the wrong denominator was invisible in
the percentage**, which is exactly why the partition, not the rate, is the control. Either way the
authoring convention is never coming back, so robustness has to live in the key.

⛔ **AND THE SAME CONTROL CONVICTED MY OWN NUMERATOR: it is 179, not the 159 I published.** Re-derived
with a closing partition: **1056 leaves = 0 without frontmatter + 0 without a `name:` field + 877
matching stem + 179 disagreeing** ⇒ **179/1056 = 17.0%**. My denominator was right by luck (every leaf
here carries frontmatter), but my first pass tested `'-' in name and '_' in stem`, which **structurally
could not see** any mismatch lacking a hyphen — the free-prose and `#`-prefixed names. ⭐⭐⭐ **A
numerator built from a shape-specific predicate silently defines its own population; the partition is
what exposes it, because a plausible rate cannot.** Both of us published a wrong figure derived the
same careless way, and both were found only by making the parts sum to the whole.

⛔⭐⭐⭐ **THE RULE APPLIES TO A TALLY OF YOUR OWN CONDUCT, NOT JUST TO A CODE CENSUS — peer's
extension, and it convicts a figure I published about myself.** Closing this chain I offered "eight
defects against your four," adopting the peer's four. It then enumerated from artifacts rather than
recall and found **nine**: the four it had reported all had *someone else's prompt attached*, while the
five it omitted were all **self-caught** (an empty-haystack sweep that returned 0 body lines for every
file and still "passed"; a 65-hit over-firing predicate; a hypothesis its own control refuted 63→1; an
index row asserting `#12432 still OPEN` minutes after it closed it). ⇒ **The omission is systematic,
not random: a self-caught defect gets fixed, and the fix becomes the memory — the defect leaves no
external trace to recall.** So the tally measured *"errors a peer mentioned"* while claiming to measure
*"errors I made."*

**Mine has the same shape and I should assume the same undercount.** My predicate was "has a hyphen";
its was "someone flagged it"; my self-tally's was "I remember it." All three are shape-specific
numerators over a population they silently define.

⚠️ **And the venue makes it the least-audited figure in the exchange: a self-critical tally offered
while closing reads as candour, so nobody re-derives it — least of all the peer it flatters by
comparison.** ⇒ **Either enumerate a self-tally from artifacts (transcript, diffs, commits) or don't
publish a number at all.** A vague "several, and probably more I fixed silently" is *more* accurate
than a precise count with an unstated predicate.

⭐⭐ **Measured the scope rather than treating it as a one-off: 179 leaves** (17.0% of 1056) have a
frontmatter `name:` that does not match their filename stem. Some are hyphenated
(`feedback-annotating-a-defect-is-not-fixing-it`), some are free prose
(`name: Always authorized to reap merged-PR worktrees`), some carry `#` and em-dashes
(`name: #11837 Metal half-float literal suffix — SHIPPED…`). ⇒ **`name:` is not an identifier in this
store; the filename stem is.** Any **ad-hoc sweep** keyed on `name:` silently misses about one leaf in
seven — and reports a clean zero while doing it. ⚠️ **Scoped correctly: this indicts hand-written
searches, NOT my gate** (which never reads `name:` — proven above). Same instrument family as
[[feedback_a_dedup_claim_i_relayed_as_verified_was_my_own_unrun_search]].

Also observed in the same run: a row I had inserted minutes earlier had already migrated **shard 2 →
shard 5**, so the repack is not a between-sessions event — it happens *within* one.

## How to apply

- ⭐⭐⭐ **After any edit to an index row, verify by content in EVERY copy** — `grep -ln` to find them,
  then a per-file count of a phrase unique to the new text. Same discipline as
  [[feedback_an_anchor_that_is_not_unique_is_not_an_anchor]]: assert, then write, then re-read.
- ⭐⭐⭐ **A rule's `description:` is part of the rule.** Peer hit the mirror defect — it corrected a
  retracted rule's body and left the over-strong wording in the frontmatter `description:`, which is
  **the only line a future retrieval reads**. I then found the identical defect in my own leaf. ⇒ **A
  retraction that stops at the body is not a retraction.**
- ⭐⭐ **A "grep returned 0" on a just-edited file is ambiguous three ways**: the edit missed, the
  phrase wrapped across lines, or the row moved. Peer measured a line-wrap false zero on exactly this.
  Prefer a short, unwrappable substring; cf.
  [[command_grep_markdown_strip_emphasis_before_matching]].
- ⭐ **A lesson that lives only in outbound messages will recur.** Both instances happened *after* I
  had stated the lesson to a peer in prose — stating it is not storing it. That is why this is a leaf.

Instance: [[project_12431_12432_unit_test_assert_empty_output]]. Family:
[[technique_keeping_this_store_reachable]], [[feedback_delivered_artifact_missing_index_row]],
[[feedback_orphan_check_races_a_concurrent_writer]] (the concurrent writers that drive the repack).
