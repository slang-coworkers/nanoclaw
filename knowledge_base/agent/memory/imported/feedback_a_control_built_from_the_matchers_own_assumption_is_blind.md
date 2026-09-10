---
name: feedback_a_control_built_from_the_matchers_own_assumption_is_blind
description: "A positive control invented from the same assumption as the matcher fires happily while the matcher is blind to the target's real vocabulary — harvest control samples from the TARGET, and range-check a zero against prior instances"
metadata:
  node_type: memory
  type: feedback
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1142
---

Measured on the kb-sync PII scan for slang-coworkers/nanoclaw#1142
([[project_nanoclaw_kb_sync_pr_autoref_noop]]).

**The near-miss.** I scanned 47,822 added lines for email-shaped strings with
`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`, alongside a positive control
(`jane.doe@example.com`). Control fired **1/1**. Target read **0**. Every secret matcher also
read 0 with its control firing. By the store's own standard — *"the zeros are measured, not
inert"* — that is a clean, control-backed result, and I was one step from publishing it.

It was **false**. The corpus's only email-shaped strings are
`nv-slang-bot[bot]@users.noreply.github.com` and its `274397474+…` variant. The `]` immediately
before `@` falls outside my local-part class, so the regex declined every real instance while
matching my invented one perfectly.

⇒ ⭐⭐⭐**A control I authored from the same mental model as the matcher tests only that the
matcher runs — never that its character classes cover what the target actually contains.**
Matcher and control share one author and one assumption, so they fail together and *agree*. This
is the blind spot the "positive control" ritual was supposed to close, and it does not close it:
the control validates the instrument against my idea of the input, not against the input.

**What actually caught it: a cross-instance range check.** Prior kb-sync instances measured
**7** (#1070) and **14** (#1073) bot `noreply` emails. `0` was not merely low — it was
*impossible*, because these snapshots always carry bot commit trailers. Absurdity beat
control-agreement as the detector, exactly as in
[[feedback_deference_drifts_to_whoever_corrected_you_last]].

**And the repair broke the control too — which is the control working correctly.** Widening to
`[A-Za-z0-9._%+\[\]-]+` under `grep -E` returned **control=0/4**: bracket-class escaping is not
portable in ERE. Had I only re-run the target, I would have read another confident 0. `grep -P`
gave control **4/4**, target **1** (both spellings of the same bot address, `noreply`, zero
non-bot). A separate `jwt` matcher likewise showed `control=0` and needed repair before its
target zero meant anything.

**How to apply.**
1. **Harvest control samples from the target's observed vocabulary, not from your idea of the
   class.** Before trusting a zero, `grep -o` the *bare sigil* (`@`, `AKIA`, `Bearer`) and read
   the distinct contexts. Here `grep -ao '…@…'` immediately showed `[bot]@` — the shape my class
   excluded. One cheap sigil census beats any number of invented controls.
2. **Range-check every zero against prior instances of the same measurement.** A quantity that
   was 7, then 14, then 0 is an instrument report, not a data report.
3. **Re-verify the control after every matcher edit.** A repair that widens a pattern can void
   the control; `control=0` after a fix means the fix is unmeasured, not that the target is clean.
4. Report the shape as *"1 email-shaped, both spellings bot `noreply`, 0 non-bot"* — never a bare
   `0`, which cannot be distinguished from a refusing regex.

Same family as [[feedback_execute_the_template_a_diff_read_cannot_see_a_refusing_regex]] (a regex
that declines to match emits no signal) and
[[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]] (a control answers the
matcher question only) — this is the third face: a control cannot detect a matcher **blind to the
target's vocabulary**, because the control was drawn from the same blind assumption.
