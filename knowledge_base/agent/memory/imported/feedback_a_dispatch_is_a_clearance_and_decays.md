---
name: feedback_a_dispatch_is_a_clearance_and_decays
description: "A work order's premise expires like a posting clearance — probe live state BEFORE researching. Root pattern (2x in one chain): never publish arithmetic over an input you didn't measure while the artifact is local. A RETRACTION is a claim with equal burden of proof."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 45bb0cad-f1da-493d-8390-3f1d816e7368
---

⛔ **A dispatch is a clearance, and it decays identically.** On 2026-08-05 I dispatched `slang-triager` to "scrub and assess" shader-slang/slang#6578, describing it as **no labels, 1 comment**. Live at dispatch-read time it was **3 comments, label `reproduced`, Type `Bug`** — two bot verdicts already public, the second opening *"No change to its verdict."* The premise had expired ~70 min before I wrote it. The triager caught it with **one call before starting research** and correctly refused to post a third comment (which would have been a duplicate-post failure).

**The probe is one call, and it goes FIRST:**
```
gh api repos/<o>/<r>/issues/<n> --jq '{cmts:.comments,labels:[.labels[].name],updated:.updated_at}'
```
Checking the premise *before* the research pass saves the whole pass; a pre-post drift check only saves the last second. Both are cheap — the ordering is the whole lesson. Generalizes past posting authority ([[feedback_a_stale_clearance_to_post]] family): **any** instruction whose premise is a mutable remote state needs a currency check at the point of use.

⛔ **My worse error: I relayed my own scouted inference to the operator as fact.** I told the operator "the repro is gated behind a DNI hack that no longer applies / needs re-porting before anyone can reproduce" — presented as a verified cost item. It was an *inference* from the hack commit touching `slang.cpp` while `Linkage::loadModule` had moved to `slang-session.cpp`. Measured myself afterward on the clean tree at `b0e43d657` with the prebuilt `build/Release/bin/slangc`: **the repro needs no hack, no re-port, and no GPU** —
```
slangc tools/gfx-unit-test/root-shader-parameter.slang -o /tmp/m.slang-module \
    -target spirv -embed-downstream-ir -profile lib_6_6 -incomplete-library   # exit 0, 52486 B
slangc /tmp/m.slang-module -target spirv -entry computeMain -stage compute -o /tmp/o.spv
    # "SPIRV-TOOLS: The entry point "main" ... was already defined." — no file, exit 0
```
Control (same shader, no `-embed-downstream-ir`): **exit 0, writes 1728 B.** The cost I reported as a blocker was **zero**. My own CLAUDE.md rule — *state a coworker's diagnosis as their finding until you've seen receipts* — applies to **my own scouting** with equal force. A `gh api` file-location read is evidence about *where code is*, never about *whether a repro runs*.

⭐ **Exit-code measurement trap I hit twice in five minutes:** `cmd 2>&1 | head; echo $?` reports `head`'s status, and `${PIPESTATUS[0]}` after an intervening `echo` is already clobbered. A trailing `ls` likewise overwrites the code the harness surfaces. **Isolate: redirect to files, make the measured command the LAST command, then `echo $?`.** Here it flipped the reading from "exit 2" to the true **exit 0** — which is the actual severity of the bug (silent failure: no file, no diagnostic, success status).

⭐ **Two agents citing different line numbers for one symbol may both be right.** `slang-session.cpp:187` vs `:205` for `Linkage::loadModule` looked like a contradiction; `sed -n '185,188p;203,206p'` showed **187 = the signature, 205 = the hack's insertion point inside the body**. Resolve numeric disagreements by *printing both spans* before calling either wrong — cf. the shape-invariant rule in [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].

⛔ **A RETRACTION IS A CLAIM AND CARRIES THE SAME BURDEN OF PROOF — same night, second instance of the same root defect.** A peer explained a 24 B cross-edge `.slang-module` size delta via embedded version strings. I "refuted" it on a **sign** argument computed from `2026.13.1` (9 B) — **the string they had reported, which I never measured**. The string actually in their artifact was `2026.13.1-50-g3649fb982` (**23 B**), which predicts *their* module larger, exactly as observed. My refutation was backwards, and it caused them to retract a substantially correct mechanism. **Both of us then let "the 24 bytes remain unexplained" stand as the cautious position — it was simply false.** ⭐**Caution that isn't measurement is not accuracy; it just fails in a quieter direction, and it doesn't get audited because retracting *looks* like humility.** Verify a refutation exactly as you'd verify a finding; **when someone refutes you using a number you supplied, that number is the first thing to re-measure.**

⇒ ⭐⭐⭐ **THE ROOT PATTERN (twice in one chain): I published arithmetic over an input I never measured, while the artifact sat locally.** First the DNI-hack "needs re-porting" cost (inferred from a file-location read; true cost zero), then this string length. **When an argument's input is a number someone else supplied AND the artifact is local, measuring is not optional — `strings`/`od` on the file beats any correspondence chain.**

⛔ **Hand-rolled offset arithmetic manufactured a phantom asymmetry that sent a peer investigating my edge.** I reported my two version fields as **24 B and 32 B** for an identical 13-byte string, implying a hidden adjacent member. Reading the bytes: **both are 24 B.** Cause — I derived offsets by subtracting 4 from `grep -abo` string positions, then ran a `field()` helper that re-added its own `4 + len`: **double-counting in my own instrument.** ⇒ **Parse a binary field by unpacking the length prefix at a known struct start, never by back-computing from a string-content hit.** Sound method:
```
python3 - <<'EOF'
import struct; d=open(M,'rb').read()
ln=struct.unpack_from('<I',d,start)[0]; s=d[start+4:start+4+ln]
end=(start+4+ln+7)//8*8   # 4-byte len prefix, field padded to 8
print(ln, s, end-start, struct.unpack_from('<Q',d,end)[0])
EOF
```
Final reconciliation: mine 2×24=48, theirs 2×32=64 ⇒ **+16 from the build tag**.

⛔⭐⭐⭐ **THE REMAINING 8 B WAS NOT A MISSING TERM — THE MEASUREMENT WAS ILL-POSED. `.slang-module` embeds a cwd-DERIVED source path, a SECOND per-edge size term.** Mine `tools/gfx-unit-test/root-shader-parameter.slang` (47 B → padded 56) vs theirs `../slang/tools/…` (56 B → 64) ⇒ **+8**. **Predicted 24, observed 24, residual 0.** Stronger than cwd-sensitivity: passing an **absolute** path does NOT stabilize it — from `/tmp` the stored string was rewritten to `../workspace/agent/slang/tools/…` (72 B → 80), size 52,486 → **52,510**, which *coincidentally equalled the peer's figure for unrelated reasons* (would have read as agreement without dumping the string).

⇒ ⭐⭐⭐ **A RESIDUAL IS A CLAIM ABOUT THE MODEL ONLY IF THE MEASUREMENT IS WELL-DEFINED; OTHERWISE IT IS A CLAIM ABOUT THE HARNESS.** We spent three exchanges treating 8 bytes as a missing mechanism when it was an uncontrolled variable. **Before attributing any cross-edge delta to a mechanism, enumerate what differs between the edges** (cwd, build tag, tree state, flags) — two known-different inputs were present from the start. Scope: these terms are *stable within one edge*, so they are **cross-edge confounds only**; the same-edge 3-run MD5 nondeterminism is untouched. **Any writeup must present the same-edge repro ONLY — the cross-edge arithmetic is inadmissible.**

⇒ ⭐⭐⭐ **PADDED LENGTH-PREFIXED FIELDS MAKE SIZE A LOSSY FUNCTION OF CONTENT BY DESIGN — equal sizes are EXPECTED to collide, so a size match is near-uninformative.** Not a Slang defect; a property of the format, and it generalizes to any such serialization. Worked positive control (best artifact of the chain, because the variable is *deliberately* introduced so the hash difference is unambiguous): same shader/flags/binary, cwd `/` vs `/tmp` ⇒ stored paths **69 B vs 72 B**, both padded to an **80 B** field ⇒ **both modules exactly 52,510 B with different MD5s** (`4b332ad3…` / `48f09541…`). An 8-byte pad absorbs any sub-8-byte content difference. **Both of the "agreeing" numbers in this chain were collisions, and neither was evidence.**

⇒ ⭐⭐ **WHEN A MEASUREMENT SURPRISES YOU, SUSPECT THE HARNESS BEFORE THE SUBJECT.** Twice in this chain the instrument was the defect and the artifact innocent: my `field()` double-count, and a `--jq contains($p)` blanking on a positive control. Validate the harness against a case whose answer you already know.

⛔⭐⭐ **"THE ERRORS WERE MOSTLY MINE" IS ITSELF AN UNMEASURED CLAIM — and it fails the same way as the rest.** I closed the chain assigning most method errors to myself; the peer itemized a roughly even split (their side: a wrong-magnitude version mechanism, a control searching for a bare form the artifact never contained, a void Release cell nearly published as a config finding, a failed-control probe matrix, an over-tidy framing I had to falsify, a library layout asserted from an error string). **Neither of us found our OWN errors; each found the other's — that is the finding, not the tally.** ⇒ Self-deprecating attribution *feels* like the safe direction, so it escapes the check an accusation would trigger — the same asymmetry as [[a retraction looks like humility]] above. **Blame allocation gets carried forward as fact by the next reader; measure it or don't state it.** ⇒ ⭐⭐⭐ **Corollary — the load-bearing case for adversarial review: error-finding is reliable ACROSS parties and unreliable WITHIN one.** Don't budget a self-audit to do a peer's job.

⭐ **Symmetric half of the unmeasured-input rule (peer's, sharpened): when a conclusion comes back at me resting on a number *I* supplied, that figure is the cheapest thing in the loop to re-measure.** They gave the short `2026.13.1`, then accepted a refutation built on it. Both halves were needed; both were one call.

⭐ **Found while chasing the delta — `.slang-module` output on the `-embed-downstream-ir` path is NONDETERMINISTIC.** 3 runs, identical source/flags/binary/clean tree: **identical size, 3 distinct MD5s**, exactly **12 differing bytes** in three 8-byte slots holding little-endian heap pointers (`0x5624_27f4_e128` …), at fixed intra-run offsets with a per-process base. ⇒ ⭐⭐ **BOTH `stat -c %s` AND `md5sum` are broken as equality tests for `.slang-module` — the defect is size-invariant, so "budget N bytes of slack" is the wrong SHAPE of fix. Use `cmp -l` and read the offsets.** Peer scoping (verified by them): plain front-end module is bit-identical ⇒ **not** a general serializer defect; reproduces on a trivial shader ⇒ not shader-specific; **`isBinaryModuleUpToDate` is UNAFFECTED** (hashes build tag + options + `sourceFile->getDigest()`, never the module bytes — `slang-session.cpp:1831/1889/1892`), which **lowers severity** and refutes the natural urgency. Producer **not localized** — do not name a write site. Exposure is external content-addressing only. Not filed (uninvited-dup trap); write site is step 1 if pursued.

⛔ **A cell that writes no output cannot be compared — I got a phantom `cmp` reading from it.** `-target spirv` *without* `-embed-downstream-ir` writes **no module at all** (exit 0, no file); my "1 differing byte" was `cmp` on two nonexistent paths. Companion (peer's): `setarch -R` blocked in-container ⇒ zero files ⇒ "0 distinct hashes" would have read as **"ASLR off ⇒ deterministic ⇒ hypothesis confirmed"**, the most flattering possible misreading of an empty result. ⇒ **Always confirm a cell produced artifacts before reading its comparison.**

⭐ **Two agents citing different line numbers for one symbol may both be right** — `slang-session.cpp:187` (signature) vs `:205` (`findOrImportModule`, the patch insertion point). Print both spans before calling either wrong.

⭐ **"Take the scope question upstream" presumes the work is unstarted.** I offered the operator a "cluster sweep" of 11 sibling issues (#6518/6519/6520/6524/6540/6542/6572/6607/6664/4846/9004) as *new* work. All 11 had been updated within ~90 min and carried verdicts. Measure the cluster (`for n in …; do gh api …/issues/$n --jq '.comments, .updated_at'; done`) before proposing a fan-out. The live question was never "should we sweep?" but "are 11 independently-authored verdicts *consistent*?" — a **review** task, not a triage fan-out. Also: **11 vs 6 was not a discrepancy but different nouns** (my superset of open mkeshavaNV precompile work vs the #6521 predicate-derived cohort); before reconciling two counts, confirm they denote the same set.
