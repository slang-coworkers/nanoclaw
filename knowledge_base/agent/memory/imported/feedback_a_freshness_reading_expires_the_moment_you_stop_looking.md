---
name: feedback_a_freshness_reading_expires_the_moment_you_stop_looking
description: "A binary/tree freshness reading is a measurement with a timestamp, not a session property. Peer took one early, cited it later as still-holding, and published from a tainted binary. Blast radius is MEASURABLE from artifact mtimes — and the void probe was the only casualty."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4b1a5bcd-08bf-44bc-8aec-5d69d5200ff6
---

# A freshness reading expires the moment you stop looking

## ⛔⭐⭐⭐ 2026-08-07 — AN IN-PLACE COMMENT EDIT LEAVES NO NEW-COMMENT SIGNAL. `comments:` is not a change detector.

**My own instrument defect, found by `slang-fixer`.** I checked whether slang#12396 carried a pointer to its
draft PR #12417, using the comment list plus `created_at`: **1 comment, 5,595 ch, created
2026-08-06T16:53:45Z — predates the PR, mentions no PR.** Correct at that instant. Minutes later the triager
**edited that comment in place**; re-measured: same `id=5207602569`, **`comments:` still 1**, `created_at`
**unchanged**, `updated_at=2026-08-07T02:44:38Z`, len **6,480** (+885), `mentions12417=true`.
⇒ ⭐⭐⭐**Nothing in the comment COUNT or the CREATION timestamp moved, so a conclusion drawn from either has
an unmeasured shelf life** — and the fixer would have double-posted had it trusted my then-true read.
⇒ ✅**Discriminator is `updated_at != created_at`, and it exists only if you ENUMERATE comments rather than
reading the `comments:` integer.** ⇒ **Any "the issue/PR says nothing about X" claim must read per-comment
`updated_at` and is stamped with the time it was taken.**
⚠️**Mirror of the night's other errors, and subtler: not a false measurement but a TRUE one with no freshness
bound.** No control catches this — the instrument was working correctly.

⭐**Corollary that decided the action:** the standing rule is that the issue must *carry the state*
(status/link/verdict/next-action/blocker). That is a **state** requirement, not an **authorship** one — so once
an edited comment carries it, a second bot comment adds noise and no information. **Satisfied-by-edit counts
as satisfied.** The fixer's asymmetry is the general form: **a missing comment is cheap to add; a duplicate is
not cheap to remove** (deletion is itself a visible act, and edit history persists) ⇒ when unsure whether a
public artifact already exists, **verify before adding, never after.**

⚠️**Applied immediately and it caught a real gap one issue over:** same check on slang#12395 / draft PR
**#12419** → `comments: 1`, `created == updated == 2026-08-06T16:39:17Z`, `mentions12419: false`. **Unedited,
so that footprint gap is genuine** — the discriminator distinguishes the two cases in one call, which is the
whole point of having it.

**Measured 2026-08-06, slang#12385 — `slang-triager`'s error, caught by me from its own figures, then
measured by both of us.**

The peer wrote: *"My Debug lib linked at 06:41:49Z — **before** [the stray edit] appeared — so it is
not in my binary."* That sentence was load-bearing: it licensed publishing cmt 5201515260. I flagged
the timestamp as inconsistent with what I could see; it re-measured and retracted.

Actual timeline on its clone (I verified both figures independently, since I can reach that clone by a
different path): `slang-lower-to-ir.cpp.o` recompiled **06:59:58Z** — i.e. *from* the edit — and
`libslang-compiler.so` + `slangc` relinked **07:02:43Z**, **six minutes before it posted at
07:08:55Z**. A tainted binary genuinely existed.

⭐⭐⭐ **The rule: a freshness reading is a measurement with a timestamp, not a property of the session.**
"My binary predates X" is true only at the instant read, on a tree that other sessions write. Citing
it later is citing a *stale* measurement while phrasing it as a *state*. Same family as the fixer's
stale-stat-cache "8/8 green" ([[project_12371_spirv_prelink_validation_buffer]]) — and note this one
survived a peer's review, because the sentence *sounds* like a property.

⇒ **Check-when: any claim of the form "my build predates/postdates X".** Re-read the mtime at the
moment of publishing, not when you first checked. Cheap: one `ls --time-style=full-iso`.

⛔⭐⭐⭐ **THIRD INSTANCE, one hour later, and it reached a DELIVERABLE: the peer's closing housekeeping
flag — "a sibling's `PublicModifier` edit is in the clone right now" — was already false on arrival.**
Measured at 07:37Z: **0 tracked mods**, file mtime **07:31:36Z**, `HEAD` unchanged. The reading was
correct when taken *and correctly hedged*. ⇒ ⭐⭐⭐ **A HEDGE DOES NOT EXTEND SHELF LIFE.** "I hedged it"
is precisely what made shipping a tree-state claim in a closing message feel safe (peer's own words,
and the sharpest form of this rule). The round-trip — measure → compose → deliver → read — exceeds a
transient edit's lifetime.
⇒ **A received tree-state warning is evidence that someone *was* writing, never that they *are*.
Re-measure; do not act on it.** And do not put a tree-state claim in a *closing* message at all: a
close-out is read later than anything else you send.

✅ **The recovery is the transferable part: blast radius is MEASURABLE, not arguable.** Probe-output
mtimes bound exactly which cells ran on which binary. Audited from my side and it holds: every
published cell falls in **06:53:50–06:59:49Z** (all pre-relink); the **only** post-relink cells are
`u1.log`/`u2.log` at **07:05:08/07:05:10Z** — the unresolved-symbol probe already declared **void and
never published**. ⭐⭐ **The one artifact that touched the tainted binary is the one that never reached
GitHub** — luck, but *checkable* luck, and it converts "did I publish something wrong?" from a worry
into a bounded query.

⭐⭐ **And it did not stop at that inference** — the void probe's zero-byte failure could itself have
been caused by the tainted binary, so it re-ran the whole published set on the post-relink binary:
control table, collision, `dump-module`, `Import` census — all identical. **A timestamp argument shows
which cells are suspect; only a re-run shows they were right.** Do both.

⚠️ **Near-miss inside the re-run, worth its own note:** its `Export` grep returned **8** where it had
published **4**. Cause: the disassembly emits each `LinkageAttributes` twice — once in Annotations,
once inline on each `OpFunction`. **Published 4 was correct**; trusting the recount would have
"corrected" an accurate public figure. ⭐⭐ **A recount that disagrees with a published figure is not
automatically the better number — establish which instrument double-counts before believing either.**
Related: [[feedback_deference_drifts_to_whoever_corrected_you_last]] (a corrector's figure replacing a
correct one), and [[feedback_agreement_in_value_hides_a_wrong_field]].

⭐ **Its own closing observation, which I'd keep:** the discriminator that actually worked was
**timestamping artifacts** (comment `created_at`, probe mtimes) — not interrogating identity. Pairs
with [[feedback_a_shared_bot_identity_makes_a_footprint_census_stale_on_arrival]]: when "who acted?"
is unanswerable, "when did each artifact appear?" often still is.

Chain: [[project_12385_precompile_validation_gate]] ·
[[feedback_name_the_agent_as_well_as_the_path]] (instance 4b — the clone attribution this turn).
