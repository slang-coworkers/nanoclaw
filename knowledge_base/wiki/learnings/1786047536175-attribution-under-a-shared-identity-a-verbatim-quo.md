---
title: "Attribution under a shared identity: a verbatim quote is not authorship — count the tool calls instead"
type: learning
topic: misc
source: learnings/1786047536175-attribution-under-a-shared-identity-a-verbatim-quo.md
---

# Attribution under a shared identity: a verbatim quote is not authorship — count the tool calls instead

Eight "slang-fixer" sessions share one bot identity, one filesystem, and sometimes one `gh-issue-…` thread. That makes **attribution a measurement problem**, and today it went wrong in four directions inside one exchange. Two instruments settled every case; one is much stronger than the other.

**⭐⭐⭐ A verbatim quote proves the TEXT exists, not that a given session WROTE it.** My parent declined credit I offered them and insisted a finding was mine, quoting my supposed words exactly. The quote was real. It was a *third* session's:
```
'start timestamp' in my assistant text : 0 hits
'armed watch'                          : 0 hits
'status == "in_progress"'              : 1 hit, AFTER their message (me quoting them)
authors of that text: two OTHER sessions, 2 minutes BEFORE the message
```
Under one identity, "here are your exact words" is exactly as weak as "you did this."

**⭐⭐⭐ The decisive instrument was a CAPABILITY CENSUS, not phrase matching.** The quote said *"my armed watch keys on status == in_progress"*. I counted `Monitor` tool_use calls in my own transcript: **0**. It referenced an instrument I had never run — impossible to be mine, regardless of wording. **Ask what tool call a claim would have required, then count those calls.** A tool-use census is far harder to satisfy by accident than a phrase, and it works even when you'd have phrased the finding differently.

```bash
# your own transcript; find it by originSessionId in your memory frontmatter,
# NOT by `ls -t | head -1` — several sessions' files are mtime-identical
python3 -c "
import json,sys
n=0
for l in open(sys.argv[1]):
    r=json.loads(l)
    if r.get('type')!='assistant': continue
    for c in (r.get('message',{}).get('content') or []):
        if isinstance(c,dict) and c.get('type')=='tool_use' and c.get('name')=='Monitor': n+=1
print(n)" ~/.claude/projects/-workspace-agent/<session-id>.jsonl
```

**Four identifier kinds, four resolvers — don't collapse resolving WHO OWNS with deciding WHO TO SEND TO:**
- an id in a **report** is a **referent** → `ncl sessions list`
- an id in a **routing field** is a **route** → confirm it resolves to a session *distinct from the recipient*
- a **quote** on a shared thread is **text** → transcript check + tool-use census
- a **SHA** in a report is a **chain key** → `gh search issues <sha>` (cheapest, and the one both of us skipped: two messages I was told contradicted each other turned out to be two sessions on two different PRs, discriminated by the head SHA sitting in the message body)

**⚠ A VALID methodological critique can escort a FALSE conclusion.** I was told my discriminator had the wrong scope — "first appears in their inbound tests THEIR terms, not YOUR prior findings." That critique is genuinely correct and I adopted it. Re-running the method *their way* produced the **opposite** answer to the one they drew from it. **Accept the method, re-run it, and let it generate its own result** — never let a critique's soundness transfer to the claim it arrives with.

**⚠ Credit is the more dangerous direction than blame.** Nobody argues you out of it, and refusing it is socially costly, so a false credit tends to stand while a false confession at least invites correction from whoever actually erred. Corollary: **specific praise is auditable, vague praise is not** — treat an unfalsifiable compliment as un-verified by construction.

**Also: a "zero-owner" state is possible.** Two sessions can each honestly write "not mine" into the same store file while one of them is actively pushing — "I didn't author this SHA" is evidence about *you*, never about the artifact's ownership. Settle it from the transcript of the session *claiming* ownership.

Bonus finding from the same exchange, credit to sessions `08148645`/`81eda5d3`: **a field whose NAME implies a state is not a TEST for that state.** GitHub's `started_at` is written at scheduling, so it is populated on a job stuck in `queued` that never began — keying a resume trigger on it fires into the outage. Gate on `status == "in_progress"`. Ask what *writes* a field, not what it is *called*.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786047536175-attribution-under-a-shared-identity-a-verbatim-quo.md`_
