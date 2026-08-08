---
name: feedback_enumerating_by_an_optional_field_silently_drops_records
description: "Counting GitHub Actions steps with `grep '^      - name:'` undercounts — a bare `uses: actions/checkout@…` step has NO name: key, so it vanishes. Count by the LIST MARKER (`^      - `), never by an optional field. I published 6→1 upstream; truth was 7→1."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8ae42c2d-1623-4a18-b809-9b7ef4286691
---

# Enumerating records by an OPTIONAL field silently drops every record that omits it

**2026-08-07, slang#12145.** I built a capability table showing a workflow job's step count collapsing
after a migration, and enumerated the parent's steps with:

```bash
grep -E '^      - name:'      # → 6 steps
```

**The real count is 7.** `slang-ci-babysitter` caught it by counting the **list marker** instead:

```bash
grep -cE '^      - '          # → 7
```

The missing entry:

```yaml
      - name: Add Git Bash to PATH
      - uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5   ← NO name: key
      - name: Download Slang build
      …
```

In GitHub Actions `name:` is **optional**; a step can be identified solely by `uses:` or `run:`. So a
`name:`-keyed enumeration isn't a count of steps — it's a count of *named* steps, silently reported as the
former.

⛔**The damage: 6→1 had already gone upstream to the operator inside a table I'd argued was trustworthy
*because* it was measured.** The conclusion (step granularity destroyed) was unaffected, but I had told the
peer in the same breath that "numbers in a capability table matter because someone may re-derive them" —
and then shipped one that doesn't re-derive.

⭐⭐⭐**RULE: count by the STRUCTURAL marker, never by an optional attribute.** For YAML lists that's the
`- ` item marker; for JSON arrays it's `length`; for records it's the row, not a field. **Before filtering
on a field, ask: is this field REQUIRED?** If it's optional, the filter is a sampling decision disguised as
an enumeration.

⭐⭐**Why it evades notice — it fails toward a plausible number.** A wrong-but-reasonable `6` reads exactly
like a right `6`; nothing is empty, nothing errors, no zero prompts a re-check. Contrast the loud failures
in this same chain (a jq compile error, a `grep` rc=1) which announced themselves. **Silent
undercounts are the expensive class**, and the only defense is choosing the right key up front.

✅**Cheap cross-check when a count is load-bearing: count the same set two ways and require agreement**
(here `^      - ` vs `^      - name:` differ by exactly the unnamed steps — the discrepancy *is* the
diagnosis). Same construction as *`total == rows printed`* from
[[technique_keeping_this_store_reachable]].

Family: [[feedback_head_1_on_a_two_job_prefix_inverts_the_verdict]] (a predicate that matches the wrong
member of a set), [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] (the instrument manufactures
the answer). All three are one shape: **the query, not the world, produced the number.**
