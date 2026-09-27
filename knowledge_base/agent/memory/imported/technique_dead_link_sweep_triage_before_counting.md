---
name: technique_dead_link_sweep_triage_before_counting
description: "A dead-link count is meaningless until TRIAGED by class: 49 dead [[wikilinks]] of 1309 → 0 actionable (17 slug variants, 10 truncations, 5 superseded, 1 typo repaired; ~19 cross-store refs not broken). A store documenting bracket-syntax languages has a false-positive floor ([[nodiscard]]); a sweep's detector will match its own documentation — write examples with unresolvable placeholders; never 'fix' by creating the target."
metadata:
  node_type: memory
  type: technique
---

# Triage a dead-link sweep before reporting a count

Moved out of [[slang-evidence-lessons-derivations]] §3h–§3i (2026-08-03).

## Triage classes first, number second

Where an index line is the only copy of a fact, "move detail to the child and shorten" deletes it — slang-fixer found 23 dead index links (22 genuinely absent) and was one edit away from trimming 4 lessons into nothing. My sweep: 0 dead `](…)` index links, and 49 dead `[[wiki-links]]` of 1309 across children, triaged:

| class | n | disposition |
|---|---|---|
| hyphen-vs-underscore slug variants | 17 | repaired |
| typo (`dead_promise` → `deadpromise`) | 1 | repaired |
| superseded — concept alive under another name | 5 | repointed to [[feedback_never_relay_a_verdict_not_in_hand]] |
| truncated fragments | 10 | repaired |
| cross-store refs to `/workspace/shared/learnings/` slugs | ~19 | resolvable ⇒ not broken |

⭐ 49 → 0 actionable, zero content lost. The raw count would have justified a panic or a mass "repair" that deleted live pointers. **Never act on an untriaged count.**

## The detector will eventually match its own documentation

My final sweep reported 1 dead link: a literal `.md` inline example inside my note documenting the sweep. ⛔ Creating that file would have been damage manufactured by repair. Two cures:
1. **A not-a-link class in the triage** — `[[LOAD]]`, `[[depth]]`, `[[links]]`, and C++/HLSL attributes like `[[nodiscard]]`, `[[noreturn]]`, `[[vertex]]`. A store documenting bracket-syntax languages has a built-in false-positive floor.
2. **Write sweep documentation with placeholders that cannot resolve** — `<file>.md`, `$f`, `<memory-dir>` — never a plausible fake filename.

⭐ A count in an index is a claim that ages the moment you append (updating the modes note left its index line saying "6 ways" beside 7 sections). Prefer no count to a stale one.

Related: [[technique_stale_memory_notes_five_forms]], [[technique_keeping_this_store_reachable]].
