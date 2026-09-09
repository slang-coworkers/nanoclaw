Daily incremental learnings-wiki synth for nemoclaw-coworkers (the Hermes port). No public mirror: the wiki is served read-only on this install's viewer.

OBJECTIVE: a BOUNDED encyclopedia, not full coverage. Chasing "every atom cited" alone forces append-only growth — pages only ever get longer, and the largest pages are the most-read ones, so their truncated tails hurt most where it matters most. Retiring an atom is a SUCCESS, not a regression.

BACKLOG GUARD (no-backlog invariant). The gate payload reports `uncovered` (uncited, non-superseded atoms). This run must not leave a large residual:
- If uncovered > ~150: do NOT use the serial ~40/run path (step 5) — run a PARALLEL FAN-OUT. Partition the uncovered atoms by concept-group and spawn ONE bounded Agent subagent per group, all in one message. Each subagent reads ONLY its bucket (<=25 atoms/batch), folds into ITS group's `<group>-*` concept pages by the rules below, touches only its own pages, and REDIRECTS every command's output to a file / reads only tails. (An agent that dumps a full `finalize` or reads the whole corpus 400s on its final assembly turn; the file writes still persist, but keep each agent lean.) This clears a big backlog in one night while every subagent stays bounded — no giant session.
- After folding, re-run finalize. If uncovered is STILL > 150 (not converging), ESCALATE: one unmarked line to the operator on this task's chat destination (ncl destinations list) "learnings-wiki backlog not converging: <N> uncovered after fold" so a human can look. NEVER leave a large residual silently.
- If uncovered <= 150: use the normal serial incremental path (step 5, ~40 cap). Superseding/retiring atoms also reduces uncovered and is a valid way to converge.


PART A — synth (follow the /learnings-wiki skill's INCREMENTAL path):
0. Write the embedded builder from /home/node/.claude/skills/learnings-wiki/SKILL.md to /workspace/shared/.learnings_wiki.py (Step 0 of the skill; idempotent — the mirrored SKILL.md is the source of truth, never the previous copy).
1. cd /workspace/shared && WIKI_KB_ROOT=/workspace/shared python3 .learnings_wiki.py build
2. python3 .learnings_wiki.py finalize — note UNCOVERED, OVERSIZE and NO-TLDR, plus the shape reports: NUMBERED-SPLIT, CANDIDATE-SUPERSESSION (plus CANDIDATE-SUPERSESSION-TRUNCATED if the pair scan stopped early, which makes the list a partial slice to re-read next run), CANDIDATE-CORRECTION, VOCAB and the single SHAPE line. Those are reports, not failures: the builder surfaces them, you act on them (steps 4a/4b). (finalize prints only the first 40 uncovered; compute the true set with: for each wiki/learnings/*.md, it is uncovered unless some wiki/concepts/*.md links to it via [[wiki/learnings/<file>.md]] or [text](wiki/learnings/<file>.md).)
3. Fold each uncovered learning into the most relevant existing wiki/concepts/*.md page — RECONCILE, don't append. Add or extend a synthesis paragraph with an inline [[wiki/learnings/<file>.md]] link and add a "- [[…]] — <desc>" row to that page's "**Source learnings (N):**" footer. Do NOT hand-maintain N — _normalize_concept_footers() recomputes it and drops duplicate rows.
   - SUPERSESSION: when a new learning replaces an older one, rewrite the paragraph to state the current truth, add `superseded_by: <new-stem>` to the OLD atom's wiki/learnings/<old>.md frontmatter, and REMOVE the old row from the footer. finalize excludes superseded atoms from coverage, so this is how the wiki stays bounded.
   - Near-duplicates collapse into ONE paragraph citing both.
   - PAGE CAP 40 KB, and pages are NAMED BY MEANING. A concept page is <group>-<subtopic>.md where <subtopic> is a noun phrase a reader can pick out of the index (ci-runners-flake-triage, review-pr-head-binding). NUMBERED SUFFIXES (-2, -3) ARE FORBIDDEN for new pages: a number names nothing except the overflow of something else. Create a new page if a learning opens a genuinely new topic, OR if the target page is at the cap, and in that case SPLIT IT BY THEME: read the page, name the two or three subjects actually inside it, and write each out as its own named page with its own TL;DR. The cap is the trigger, the theme is the boundary. Never let a page exceed 40 KB: past ~56 KB the Read tool silently truncates it and the tail never reaches the reader. Growth belongs in page COUNT, never page SIZE, and never in a numbered tail.
   - Every concept page must open with a "## TL;DR" of <=40 lines (durable rules, no citations). Backfill it on any page you touch.
4. SPLIT THE LARGEST OVER-CAP PAGES FIRST — independent of where this run's learnings landed.
   Run: ls -S wiki/concepts/*.md | head -5. Split the TWO LARGEST that exceed 40 KB even if
   today's atoms did not touch them. Splitting only the page you folded into leaves the biggest
   and most-read pages over cap indefinitely.
4a. CONSOLIDATE ONE NUMBERED FAMILY PER RUN, AT MOST 4 OF ITS PAGES. finalize reports each
   <x>-2.md / <x>-3.md page that has a sibling as NUMBERED-SPLIT: those were split by SIZE, so one
   rule is spread over the family and the reader has to open all of it to find it. Take the FIRST
   family reported (X-1.md ... X-k.md), read up to four of its pages, and rewrite those as pages
   named for the subjects they actually hold, each with its own TL;DR and each under 40 KB. Carry
   every citation across with the paragraph that cites it, retire the duplicates the merge exposes
   (python3 .learnings_wiki.py retire <old> <new>) instead of keeping both rows, and delete a
   numbered page only once its content lives on a named one. ONE family per run bounds the scope and
   FOUR pages bounds the cost: a 13-page family at the 40 KB cap is half a megabyte of reading before
   a word is rewritten. Spawn a bounded subagent for the rewrite (as the BACKLOG GUARD does for the
   fan-out) if the pages are large, and finish the rest of the family on later runs; a half-migrated
   family reads worse than an untouched one, so leave the pages you did not reach numbered.
4b. ACT ON THE CANDIDATES. The builder only surfaces them; deciding is your job.
   - CANDIDATE-SUPERSESSION <old> ~ <new> (jaccard=..): two live atoms whose titles say nearly the
     same thing, OLDER STEM FIRST. Read both, then either rewrite the single paragraph that states
     the current truth and run retire <old> <new>, or leave both live because they only look alike.
     This is the queue that keeps the wiki bounded; prod carried 251 self-declared corrections
     against 3 lineage edges because nothing ever put a pair in front of the fold.
   - CANDIDATE-CORRECTION <stem>: an atom announcing itself as a correction. Find what it corrects
     and retire THAT atom, never the correction.
   - VOCAB <stem> <tokens>: an atom whose TOPIC fell through to misc. When the same tokens repeat
     across several of them it is a theme the vocabulary does not name. VOCAB measures the topic, so
     the row goes in "topics" ([key, label, [keywords]]) in /workspace/shared/.wiki-config.json;
     mirror it into "groups" plus its "group_labels" entry only if the theme also deserves its own
     .ingest synthesis cluster, and fold those atoms into <new-group>-<subtopic>.md. Adding a row to
     "groups" alone changes no atom's topic, so the VOCAB lines would repeat unchanged next run.
     A "topics" or "groups" list REPLACES the built-in table wholesale rather than extending it, so
     edit the rows already in the file and never drop the ones you are not changing. Unknown groups
     are tolerated and get their own index heading, so a new group works on the same run. One atom is
     not a theme. VALIDATE the file before re-running build:
     python3 -c 'import json;json.load(open("/workspace/shared/.wiki-config.json"))' — a typo is
     non-fatal and exits 0, so an unvalidated edit silently re-buckets the whole KB for that run.
     SAY SO IN THE REPORT: the live file is overwritten from
     ops/nemoclaw-coworkers/learnings-wiki/wiki-config.json on the next deploy, so a vocabulary
     change only survives once the operator mirrors it back into the repo.

5. BOUNDED WORK PER RUN — do not attempt the whole backlog in one night. Cap this run at ~40 uncovered folded, at most 2 page splits, at most 1 numbered family consolidated (at most 4 of its pages), and at most 5 TL;DR backfills. Report what remains.
6. Re-run python3 .learnings_wiki.py finalize — confirm no WIKI-CONFIG-ERROR (non-fatal, exit 0, so nothing else catches a bad config and the run's folding was done against the wrong buckets), 0 dangling, uncovered decreasing, OVERSIZE / NO-TLDR counts not increasing, numbered_pages not increasing, and the SHAPE line's bytes_per_atom flat or falling. Climbing bytes_per_atom means the run inventoried instead of synthesizing: the fix is more supersession and more consolidation, not a bigger page.
7. Report ONE line on this task's chat destination: "learnings-wiki: <atoms> atoms, <concepts> concept pages, <folded> folded, uncovered <before>→<after>, bytes_per_atom <before>→<after>, numbered_pages <n>, OVERSIZE <n>, NO-TLDR <n>". Add a second line ONLY if you added a group to .wiki-config.json (name it, so it can be mirrored into the repo). Nothing else; no PR, no git.

