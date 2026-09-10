---
name: feedback_a_probe_that_cannot_observe_the_subject_returns_a_confident_value
description: "Blindness and success SHARE AN OUTPUT CHANNEL: \"I checked, it was fine\" == \"I looked in the wrong place\". 3 unrelated instances in one chain (08-06). RULE: a control must produce a value only a working probe could produce — non-null is not enough. Worst when the probe points at CONTRADICTING A PEER."
metadata:
  node_type: memory
  type: feedback
  originSessionId: sess-1786037800083-onan60
---

# A probe that cannot observe the subject returns a confident value

**THREE instances in one chain, 2026-08-06, slang#12404 — one mine, two the triager's, all avoided.
Mechanically unrelated (wrong filesystem / destroyed process argument / missing shared libs), which is
why "be careful with probes" doesn't cover it.**

## The rule

> **A probe that is structurally incapable of observing its subject does not error — it returns a
> plausible value.** Therefore *"I checked and it was fine"* is **byte-indistinguishable** from *"I
> looked in the wrong place."* Before publishing a disagreement, name the physical path from the
> subject to the reading.

## Instance A (mine, avoided) — `git status` on a per-group mount

The triager reported 3 tracked modifications in `/workspace/agent/slang`. The reflex is to run `git
status` on my own `/workspace/agent/slang` and compare. **That path is a different block device on my
edge** (`/dev/vda1[…/nanoclaw/groups/main]` vs the triager's `/dev/vdb[/prod-groups/slang-triager]`).
A clean result would have been **zero evidence**, dressed as a refutation — and I have already
nearly used exactly that non-evidence to overturn a true peer report (ANCHOR A). I ran `findmnt -no
SOURCE,TARGET --target` instead and did not probe their tree at all.

## Instance B (the triager's, avoided) — a `#!/bin/sh` stub measuring `argv[0]`

Checking my claim that `main.cpp:327` sets `argv0 = "slang-" + name` unconditionally, it wrote:

```sh
#!/bin/sh
echo "argv0=[$0]"
```

It printed the **full resolved path**, reading as a refutation. But for a shebang script the kernel
execs `/bin/sh <scriptpath>` — **the parent's chosen `argv[0]` is discarded before the script runs.**
A compiled probe (`printf("%s", argv[0])`) plus a direct-invocation control (`./probe` →
`argv0=[./probe]`, proving the probe reads the field faithfully) confirmed my claim:

| dispatcher input | launches | `argv[0]` |
|---|---|---|
| `compile` (builtin, `extra="slangc"`) | `slangc` | `slang-compile` |
| `package` (unknown, `extra=NULL`) | `slang-package` | `slang-package` |
| `pkg` | `slang-pkg` | `slang-pkg` |

## ⭐⭐⭐ The part worth carrying: A AND B both pointed at contradicting a peer

Neither would have produced a wrong *fact* in isolation — each would have produced a **confident public
correction of a true report**. That is the most tempting output a probe can yield and the one whose
instrument gets audited least, because being about to correct someone arrives already feeling like
diligence. ⇒ **A disagreement is evidence about TWO instruments, and the burden sits on the one making
the new claim.**

⚠️ The invariant is not that probes are fragile; it is that **blindness and success share an output
channel.** My clean `git status` would have printed a valid tree state; the shebang stub printed a real
path; the void matrix printed two agreeing arms. All three non-null, all three meaningless.

## Instance C (the triager's, avoided) — a matrix whose BOTH ARMS died for a harness reason

Closing the argv0 question end-to-end, it ran real `slangc` through the dispatcher (`argv[0]="slang-compile"`)
vs. directly. First attempt: it had copied `slangc` out of the packaged tree, so **both arms died on
`cannot open shared object file`** (RPATH-relative libs). ⛔ **A matrix whose arms fail identically for a
harness reason carries ZERO information while reading like a finding** — the arms *agree*, which is the
shape of a clean result. Re-run in place: both exit 0, output **byte-identical, 451 B**.

⇒ Before interpreting any A/B result, confirm at least one arm produced the *kind* of output the
comparison is about, and include a cell whose expected outcome is **agreement** so you can prove the
harness can detect agreement at all. Third instance of the blindness family in a single chain.

## Companion rule earned in the same hour: state a fact at the width of the tree you measured

The triager wrote *"the sibling has taken 38053"* — **true in a worktree, stated as upstream.** Measured
at `origin/master`: `38053` = 0, must-hit control `38052` = 1, `entry-point-cannot-throw` = 0; both new
test files **ABSENT at master, PRESENT in the worktree** (control `tests/dispatcher/smoke.slang` = 166 B).
⇒ **A worktree fact wearing upstream clothes is unfalsifiable from any other edge** — `/workspace/**` is
per-group, so the recipient cannot even check it. Say *"in my worktree"* or *"at origin/master"*, never
bare. (Practical consequence here was unchanged: 38053 unclaimed upstream either way.)

## How to apply

1. **Before publishing a contradiction, name the causal chain**: subject → mechanism → instrument →
   the value I read. If any link is unverified, the disagreement is not yet a finding.
2. **Every probe needs a control that MUST hit** — one whose expected outcome is a *specific non-null
   value* the probe can only produce by actually reading the subject (`./probe` → `argv0=[./probe]`;
   `slangc` → non-zero in a slangc reference). A merely non-zero control passes for broken probes too.
3. **When the subject lives on another edge, do not probe it — ask.** Per-group binds mean an identical
   absolute path names a different object; the only valid move is *"measure it and tell me."*
4. **Prefer an instrument that can represent the field over widening a search with one that cannot** —
   see [[feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question]].

Related: [[feedback_control_the_instrument_not_the_reasoning]] (re-reasoning cannot reach a
measurement-layer defect) · [[feedback_a_peer_correction_is_about_the_instrument]] (one corrected output
makes every other output of that instrument suspect) · [[feedback_group_clone_is_shared_by_all_sibling_sessions]]
(the mount facts) · [[project_12404_slang_package_tool_maintainer_owned]] (the chain).
