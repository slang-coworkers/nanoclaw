Daily incremental learnings-wiki synth for nemoclaw-coworkers (the Hermes port). No public mirror: the wiki is served read-only on this install's viewer.

OBJECTIVE: a BOUNDED encyclopedia, not full coverage. Chasing "every atom cited" alone forces append-only growth — pages only ever get longer, and the largest pages are the most-read ones, so their truncated tails hurt most where it matters most. Retiring an atom is a SUCCESS, not a regression.

BACKLOG GUARD (no-backlog invariant). The gate payload reports `uncovered` (uncited, non-superseded atoms). This run must not leave a large residual:
- If uncovered > ~150: do NOT use the serial ~40/run path (step 5) — run a PARALLEL FAN-OUT. Partition the uncovered atoms by concept-group and spawn ONE bounded Agent subagent per group, all in one message. Each subagent reads ONLY its bucket (<=25 atoms/batch), folds into ITS group's `<group>-*` concept pages by the rules below, touches only its own pages, and REDIRECTS every command's output to a file / reads only tails. (An agent that dumps a full `finalize` or reads the whole corpus 400s on its final assembly turn; the file writes still persist, but keep each agent lean.) This clears a big backlog in one night while every subagent stays bounded — no giant session.
- After folding, re-run finalize. If uncovered is STILL > 150 (not converging), ESCALATE: one unmarked line to the operator on this task's chat destination (ncl destinations list) "learnings-wiki backlog not converging: <N> uncovered after fold" so a human can look. NEVER leave a large residual silently.
- If uncovered <= 150: use the normal serial incremental path (step 5, ~40 cap). Superseding/retiring atoms also reduces uncovered and is a valid way to converge.


PART A — synth (follow the /learnings-wiki skill's INCREMENTAL path):
0. Write the embedded builder from /home/node/.claude/skills/learnings-wiki/SKILL.md to /workspace/shared/.learnings_wiki.py (Step 0 of the skill; idempotent — the mirrored SKILL.md is the source of truth, never the previous copy).
1. cd /workspace/shared && WIKI_KB_ROOT=/workspace/shared python3 .learnings_wiki.py build
2. python3 .learnings_wiki.py finalize — note UNCOVERED, OVERSIZE and NO-TLDR. (finalize prints only the first 40 uncovered; compute the true set with: for each wiki/learnings/*.md, it is uncovered unless some wiki/concepts/*.md links to it via [[wiki/learnings/<file>.md]] or [text](wiki/learnings/<file>.md).)
3. Fold each uncovered learning into the most relevant existing wiki/concepts/*.md page — RECONCILE, don't append. Add or extend a synthesis paragraph with an inline [[wiki/learnings/<file>.md]] link and add a "- [[…]] — <desc>" row to that page's "**Source learnings (N):**" footer. Do NOT hand-maintain N — _normalize_concept_footers() recomputes it and drops duplicate rows.
   - SUPERSESSION: when a new learning replaces an older one, rewrite the paragraph to state the current truth, add `superseded_by: <new-stem>` to the OLD atom's wiki/learnings/<old>.md frontmatter, and REMOVE the old row from the footer. finalize excludes superseded atoms from coverage, so this is how the wiki stays bounded.
   - Near-duplicates collapse into ONE paragraph citing both.
   - PAGE CAP 40 KB. Create a new concept page if a learning opens a genuinely new topic, OR if the target page is at the cap — then SPLIT by subtopic (<group>-<subtopic>-2.md). Never let a page exceed 40 KB: past ~56 KB the Read tool silently truncates it and the tail never reaches the reader. Growth belongs in page COUNT, never page SIZE.
   - Every concept page must open with a "## TL;DR" of <=40 lines (durable rules, no citations). Backfill it on any page you touch.
4. SPLIT THE LARGEST OVER-CAP PAGES FIRST — independent of where this run's learnings landed.
   Run: ls -S wiki/concepts/*.md | head -5. Split the TWO LARGEST that exceed 40 KB even if
   today's atoms did not touch them. Splitting only the page you folded into leaves the biggest
   and most-read pages over cap indefinitely.

5. BOUNDED WORK PER RUN — do not attempt the whole backlog in one night. Cap this run at ~40 uncovered folded, at most 2 page splits, and at most 5 TL;DR backfills. Report what remains.
6. Re-run python3 .learnings_wiki.py finalize — confirm 0 dangling, uncovered decreasing, and OVERSIZE / NO-TLDR counts not increasing.
7. Report ONE line on this task's chat destination: "learnings-wiki: <atoms> atoms, <concepts> concept pages, <folded> folded, uncovered <before>→<after>, OVERSIZE <n>, NO-TLDR <n>". Nothing else; no PR, no git.

