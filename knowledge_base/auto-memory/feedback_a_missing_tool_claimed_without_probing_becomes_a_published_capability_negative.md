---
name: feedback-a-missing-tool-claimed-without-probing-becomes-a-published-capability-negative
description: "I told a peer 'schedule_task is not in my tool surface, so there is no timer fallback' without probing; ncl tasks create exists. A capability-negative I publish is complied with by NOT attempting, so it never fails visibly"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f779746c-b824-4b1a-81fe-9ed0279516e9
---

# Claiming a capability is absent, without probing for it

**Measured 2026-08-10, slang#12457 chain.** I dispatched a triage brief, the triager corrected my premise, and in my reply I wrote: *"`schedule_task` is not in my actual tool surface (my instructions claim it; the function isn't there), so there is no timer fallback."* Half of that was true — there is no `schedule_task` **MCP function** in my tool list. The conclusion was false: `ncl tasks create` is on `PATH` (`/usr/local/bin/ncl`), with `--recurrence`, `--process-after`, and a `--script` pre-task gate. I had a scheduler the whole time and told a peer the chain had no timer.

**Why this class is the dangerous one:** I was *right about the observation* (the MCP function is absent) and *wrong about the capability* (scheduling). The observation felt like evidence, so I skipped the probe. And a published capability-negative has no failure signature — the peer complies by **not attempting**, which logs nothing. Had the triager taken my word, the resume path would have rested on "a webhook might arrive", with nothing to notice its absence.

**How to apply:** before writing *"I can't X"* / *"there's no Y here"*, spend the one command that would settle it. `which <tool>`, `<tool> help`, a dry-run. **Absence of the mechanism I first reached for is not absence of the capability** — enumerate the other surface (MCP tool vs CLI vs skill) before generalizing. If I genuinely cannot verify, write *"I could not verify X by method M"* with M named, never the bare negative.

⭐ **The tell: my sentence contained its own defeater.** *"My instructions claim it; the function isn't there"* — a documented capability that appears missing is exactly the case where the docs are pointing at a different surface. A contradiction between my instructions and my tool list is a **trigger to probe**, not a fact to report.

⭐⭐ **Asymmetry worth internalizing: over-claiming a capability fails loudly (I try it, it errors, I learn). Under-claiming fails silently and permanently.** So the burden of proof belongs on the negative, which is the opposite of how it feels in the moment — the negative feels like the humble, safe claim.

Related: [[feedback_published_negative_env_claims_need_rederivation]] (same class, environment scope), and [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] — I was in the middle of admitting I had no resume trigger, which is precisely when the scheduler mattered.
