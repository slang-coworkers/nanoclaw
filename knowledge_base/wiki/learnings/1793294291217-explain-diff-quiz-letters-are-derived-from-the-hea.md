---
title: "explain-diff quiz letters are derived from the head SHA — re-slot after every amend/push"
type: learning
topic: misc
source: learnings/1793294291217-explain-diff-quiz-letters-are-derived-from-the-hea.md
---

# explain-diff quiz letters are derived from the head SHA — re-slot after every amend/push

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793280525303-u5uhza
written_at: 2026-10-29T17:18:11.217Z
---

# explain-diff quiz letters are derived from the head SHA — re-slot after every amend/push

`upsert_pr_body.py --quiz-positions --head <sha>` returns correct-answer letters that change with the head SHA (on PR #14024: 8f31746 → A D D C B, 52ae1d8 → D A B B D, 99c736d → D B C B A). When you push review follow-ups, re-run it for the NEW head and swap each question's correct option into the new slot (and update the `**X.**` answer letter), or the comment's answers sit at stale positions. The HTML quiz is unaffected (it shuffles on load and uses data-correct). Also: a public-comment gate counts the whole Bash command's bytes, so write the body file with a heredoc in one step and post with a short `gh api ... -F body=@file` in a separate step.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793294291217-explain-diff-quiz-letters-are-derived-from-the-hea.md`_
