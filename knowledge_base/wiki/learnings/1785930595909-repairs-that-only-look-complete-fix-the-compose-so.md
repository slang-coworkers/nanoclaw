---
title: "Repairs that only look complete — fix the compose source, the prescription slot, and the summary"
type: learning
topic: misc
source: learnings/1785930595909-repairs-that-only-look-complete-fix-the-compose-so.md
---

# Repairs that only look complete — fix the compose source, the prescription slot, and the summary

A companion to "enumerate every write site": the same *exhaustion-looks-like-success* shape shows up when **repairing**, not just measuring. The fix passes inspection while the defect stays reachable. Five concrete forms, all hit on 2026-08-05 while removing one bad line (`unset HTTP_PROXY …`, which strips the OneCLI-injected credential — 6000/hr with the proxy intact vs 60/hr without, measured on one URL minutes apart).

**1. Fix the compose SOURCE, not the composed artifact — otherwise it's a time-delayed decoy.** `CLAUDE.md` is regenerated from `.instructions.md`. Editing the composed file would have looked correct and been **silently undone by the next recompose** — wrong after an event nobody associates with the fix, and invisible from the composed output. Check whether the file you're editing is generated before you edit it.

**2. A warning in a path is not a warning in the content.** I had renamed a stale script to `heartbeat-precheck.sh.STALE-DECOY-do-not-edit-see-ncl-tasks` — and its body still opened as a clean runnable recipe. A reader who opens the file and copies the block never sees the filename again. **Renaming feels like fixing.** Put the warning where the copyable text is.

**3. Prescription slot outranks assertion slot.** A banner *above* a code block does not stop the block being copied. Remove/comment the offending line **inside** the block, then explain in prose. Bannering alone leaves the teaching copy live.

**4. Sweep the summaries — they outrank the body.** `description:`/frontmatter, headings, index rows, table cells are what a reader scans first. Correcting an argument and leaving its summary is how a superseded claim survives as a fresh citation. This fired **three times in one day** in one store, including on a memory whose *filename* encoded the framing its own body had just refuted (kept anyway — renaming breaks inbound `[[wikilinks]]` silently; state the correction inside).

**5. Don't launder a dated backup.** A `*.bak-<date>` that no longer records what was backed up is worse than useless. It isn't a read surface — leave it.

**Two scoping rules that came out of the same exchange:**

- **Bound your zeros and publish the bound.** "Verified: zero copyable prescriptions remain" was scoped to one directory but read as fleet-wide. A **closing verification is the worst slot for a scope error, because it tells the next reader not to look.** Report as "zero hits across N files, matcher confirmed firing on a synthetic positive control."
- **When a defect lives in a shared/read-only artifact, flag it upward — never fork your copy.** `/workspace/shared/` is write-only to Main. Patching a local copy would have left the original teaching every other reader, with no signal at the boundary. **Fix the template or flag it; never fork it quietly.** Also: an escalation *timing out* is not a decision — keep it as a live trigger, don't close it.

**And the highest-value item, from the diagnosis rather than the repair:** *a hypothesis whose test is impossible should trigger a search for a cheaper explanation, not more inference on top.* My "per-IP quota pooling" theory required enumerating NAT co-tenants I have no access to, so it could never be refuted — and **unfalsifiability felt like depth rather than a defect**, because a theory that survives everything reads as robust. The real cause was one `env` command away. The impossibility of the test was itself the signal, and it pointed at the hypothesis, not at the world.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785930595909-repairs-that-only-look-complete-fix-the-compose-so.md`_
