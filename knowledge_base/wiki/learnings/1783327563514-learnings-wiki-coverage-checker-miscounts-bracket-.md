---
title: "learnings-wiki coverage-checker miscounts bracket-titled learnings + stalls freeze the whole recurrence"
type: learning
topic: misc
source: learnings/1783327563514-learnings-wiki-coverage-checker-miscounts-bracket-.md
---

# learnings-wiki coverage-checker miscounts bracket-titled learnings + stalls freeze the whole recurrence

Two failure modes found 2026-07-06 when the operator noticed "learnings pushed but wiki not updated."

**1. Two independent knowledge_base pipelines — don't conflate.** (a) A daily *raw-learnings* sync produces the `knowledge_base sync YYYY-MM-DD (PII scrub: emails redacted)` commits — it copies `shared/learnings/` + `agent/memory/` and pushes, but runs NO wiki synth. (b) Main's daily *wiki-synth* task (`task-1782828347850-4m9u23`, `/learnings-wiki`) is the ONLY thing that regenerates `wiki/`. So "learnings are being pushed" (pipeline a) can be true while `wiki/` is frozen (pipeline b stalled). Diagnose by comparing counts on nv-coworkers: `git ls-tree -r --name-only origin/nv-coworkers knowledge_base/shared/learnings/ | grep -c '\.md$'` vs `.../wiki/learnings/`. Expect them equal minus 1 (`shared/learnings/INDEX.md` is not a learning; build excludes it).

**2. A stalled scheduled occurrence freezes the whole recurrence.** A recurring task only mints its NEXT occurrence when the current one COMPLETES. If a `pending` occurrence never fires (observed: wiki-synth stuck at `process_after=2026-07-03T06:00`, `tries=0`, seq 8514, after 07-01/07-02 completed), the series stops dead — no 07-04+ fire. ALL daily tasks froze at 07-03/07-04 (`tries=0`) while the 12-hourly supervise task stayed current, so the scheduler was alive — a host event ~07-03 orphaned overdue daily rows (recurrence-advance-on-completion means one un-fired row halts the chain). The scheduled-task rows live in the container's `inbound.db` `messages_in` (kind='task', columns: series_id, process_after, recurrence, tries, status). Query there to see stuck rows. Re-arm with `update_task({taskId, processAfter:'<naive-local next fire>'})`.

**3. finalize() coverage checker was TEXT-matching (fixed).** `/workspace/shared/.learnings_wiki.py` `finalize()` counted a learning "covered" via a regex whose link-TEXT group was `\[[^\]]*\]` — which cannot match a markdown link whose TEXT contains `]`. `_convert_obsidian_links` turns a learning whose TITLE starts with a bracket (`[require]`, `[bot]`, `[noinline]`, `[PreferRecompute]`, …) into link text like `[[require] atom…](url)` — valid CommonMark, renders on GitHub, but invisible to the text regex. Result: 20 already-folded learnings were reported UNCOVERED (false positives), inflating the fold work. FIX (applied 2026-07-06): count links URL-anchored — `URL = re.compile(r"\]\((wiki/[^)]+\.md)\)")` and iterate `URL.findall(...)`. Coverage went 819→839 immediately on the same content. When folding uncovered learnings, always FIRST split "genuinely new" from "already in a concept page" (`grep -l <stem> wiki/concepts/`) before writing synthesis, or you create duplicate entries.

**4. Truncated-stem trap when scripting folds.** If you build a fold script from a summary that truncated filenames (~52 chars), the `[[wiki/learnings/<stem>.md]]` links will be DANGLING. Resolve every stem to its real file (prefix-match against `ls wiki/learnings/`) before running, and always re-run `finalize` to confirm `dangling 0` after folding.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1783327563514-learnings-wiki-coverage-checker-miscounts-bracket-.md`_
