# The unifying diagnosis: a signal that cannot distinguish the states you care about

## The rule

Before you let an observation carry a conclusion, ask the discrimination question: **would this signal have looked different if the opposite were true?** If not, it carries zero bits — regardless of how carefully you sourced it. Provenance checks (is this the real log? the right commit? the right file?) catch none of these; only method does. Verifying *where* a signal came from is not the same as verifying *what it can distinguish*.

## Five instances from one chain (slangpy#1088 / slang#11225, 2026-08-03), all the same shape

| Signal | Looked like | Couldn't distinguish |
|---|---|---|
| `grep -c "DEEPEST SUBCASE: d3d12"` → 0 | "no d3d12 failures" | pattern matched nothing — vulkan (28 real failures) also returned 0 |
| Slang release artifact newer than the pin | "includes the change" | version date vs. merge status of an *unmerged* PR |
| Stale symlink into a build tree | "built binary present" | current build from a previous one |
| `git submodule update --depth 1` | "submodules ready" | success from a fetch failure it masked |
| An escalation whose presupposition can't be false | "asking a question" | nothing — no possible answer changes the action |
| Guard's false arm executed locally | "behavior verified" | patched from unpatched (diagnostic unreachable at that pin) |

## Practice

- **Absence claims need a positive control; presence claims mostly don't.** See [`1785749557692-a-grep-returning-0-is-only-evidence-if-the-same-pa.md`](1785749557692-a-grep-returning-0-is-only-evidence-if-the-same-pa.md).
- **A log absence tells you WHAT, never WHY.** Even a correctly-derived zero *with* a passing positive control cannot separate *ran-and-exited-early* from *never-a-step* from *excluded-by-an-`if:`*. Resolve the cause at the workflow/build **definition**. This is the subtlest instance in the table below, because the conclusion was right — the causal story attached to it was the unverified part.
- **A count can be topically right and semantically empty.** `grep -c pytest` = 22 in these logs, but **1** after filtering `Downloading|Installing|Requirement|Collecting|cached` — the rest is pip chatter. Distinct from the vacuous grep: there the pattern *couldn't* match; here it matches abundantly and means nothing.
- **Run the discrimination test on the causal story too, not just the conclusion.** "Is this zero real?" and "does my explanation for the zero follow from it?" are different questions.
- **State the discriminating power, not just the result**, in any writeup: "ran green, but this environment cannot show the failure" beats "ran green."
- **Executed ≠ observed.** A code path can run in an environment where its effect is invisible.
- **Two independent extraction methods** for any load-bearing claim.
- **Apply it to your own draft before sending.** On this chain, four separate tiers' adversarial passes each found something in their *own* output — one overclaim retracted outright. That hit rate means the self-check is not optional ceremony.
- A claim you've had to weaken twice is telling you the property is **not verifiable in your environment** — say that instead of hedging a third time.

## Also: name a diff_hash's derivation

When `gh` is unauthenticated, `sha256(git diff <merge-base> <head>)` is *not* byte-identical to `sha256(gh pr diff)`. A downstream approver comparing hashes reads the mismatch as a changed diff when it's only a different derivation — another non-discriminating signal. Always state which derivation produced the hash, and regenerate rather than assume.
