---
name: feedback-a-guard-whose-armedness-is-unverified-is-worse-than-none
description: "Editing a running bash script replaced the inode, so the guard added mid-run could never fire — its silence would have read as 'tree clean'. Verify a guard is ARMED, not just present. Plus: don't mutate any artifact a live process reads."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 73c43656-0b8f-4a5b-b4d5-1c374eb48e35
---

# A guard whose armed-ness is unverified is worse than no guard

**Measured 2026-08-06, slang#12284.** A peer added a post-run tree-mutation check to a bash script **while that script was executing** (PID 114390). It reasoned correctly about byte offsets — bash reads a script incrementally, its read head was at byte 1475, the edit began at 2454, so the running text was uncorrupted — and concluded the new check would be picked up when execution reached it.

**That conclusion was wrong, and the inodes prove it:**

```
bash's open fd inode : 484136341   (/proc/114390/fd/255)
file on disk inode   :  41718480   → DIFFERENT
```

The edit **replaced** the file rather than modifying it in place, so the running shell holds the **deleted original**. The "added" guard could never execute.

⭐⭐⭐ **Its silence at completion would have read as "the tree was not mutated."** That is the worst available outcome: a guard converts an *unknown* into a *false reassurance*. **Verify that a guard is ARMED, not merely present.** Coverage ≠ armed-ness ≠ correct diagnosis — three separate properties, each needing its own check.

## The mechanism: in-place vs replace (verified on this box)

```
python write_text / >> / sed WITHOUT -i   → SAME inode → open fd sees new bytes
sed -i / tempfile+os.replace / editors    → NEW inode  → open fd holds the OLD file
```

Measured: in-place `write_text` preserved inode `39192155`; `tempfile + os.replace` produced `39192156`. **`open(p,'w')` after a read is not reliably in-place** — it was a replace here.

⇒ **One command decides it:** `stat -c %i /proc/<pid>/fd/<n>` vs `stat -c %i <path>`. Same ⇒ live. Different ⇒ the process is reading a deleted inode; nothing you added will run.

## The invariant, in its widest form

⭐⭐⭐ **Don't mutate any artifact a live process is reading.** One rule, three verbs, all hit in a single afternoon:
1. **Don't rebuild** the tree mid-run — the peer held this rule and honoured it twice.
2. **Don't edit the tree** mid-run — it edited a header at object 176/281 of a build whose whole purpose was a controlled A/B. (Recovered: proved the change comment-only via `grep -cvE '^[+-]\s*//'` → 0; **and** I ruled out the exception that would have broken that argument — `slang-check-impl.h` is **not** in the PCH set, `source/slang/CMakeLists.txt:263-268`. With PCH involved, a comment-only header edit *can* matter; the repo has a scar for it, issue #12227.)
3. **Don't edit the running script** — the least obvious member of the set, **because a script doesn't look like state.**

⚠️ **A launch-time guard cannot protect against a mid-run mutation.** Every `HEAD ==` / file-set assertion validates a *precondition* and never observes the artifact again. ⇒ Snapshot `HEAD`, **`HEAD^{tree}`**, and `git status --porcelain` at launch; compare at completion. `HEAD^{tree}` is the strong form — it catches a mutation that was **reverted** before the check, which porcelain cannot.

## Companion: an instrument can become structurally unable to return zero

Same session, the peer reported "suite is running" from `pgrep -f "slang-test -use-test-server"`. Both matches were **its own processes** — a monitor whose *command text* contains the pattern, plus the probing `pgrep` itself. No suite existed; the build was at 222/281.

⛔ Because the monitor embeds the pattern, **every future `pgrep -f` on that string matches it — the check can never return zero for the rest of the session.** Care cannot fix a structurally-poisoned instrument.

⇒ **Anchor on the executable** (`pgrep -f "^\./build/Debug/bin/slang-test"`), or better, **test the ARTIFACT**: does the log exist and is it growing? The log's absence was unambiguous evidence, and it was never looked at. Same principle as artifact-derived controls beating self-authored ones ([[technique_ab_suite_delta_four_dispositions]]).

## ⛔ The retrieval failure underneath all of this

The peer **already had `pgrep -c <pat>` counts your own probe ⇒ never 0` in its own store** and did not consult it — *because checking whether a suite is running felt too routine to warrant a lookup.*

⭐⭐⭐ **Holding a rule is not applying it, and the moment of use is exactly when retrieval fails — because the action feels ordinary.** Third instance between two agents in one day (my `CLAUDE.md:11` citation error inside a leaf *about* the injected view; my stale-figure warning *containing* a stale figure; this).

⇒ **Structural fix beats recall: put the discriminator IN A SCRIPT.** A `check_suite_running()` that greps the log cannot be forgotten at the moment of use. Anything that depends on remembering a rule mid-action will eventually not be remembered.

Related: [[feedback_the_remedy_for_an_untrusted_number_is_re_measurement_not_arithmetic]] · [[feedback_verify_identity_never_position_stash_and_citations]] · [[project_12284_cross_module_overload_silent_break_warning]].
