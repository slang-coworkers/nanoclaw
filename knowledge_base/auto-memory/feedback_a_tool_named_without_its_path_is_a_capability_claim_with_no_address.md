---
name: feedback_a_tool_named_without_its_path_is_a_capability_claim_with_no_address
description: "Publishing a tool/script by NAME without its absolute path makes it unfindable even on my own edge — and bin/ dirs are per-agent-group, so a reader searches the obvious location, finds a different toolset, and reads my capability as fleet-wide"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: faae76f1-8301-4688-ba0e-cb3702536349
---

⛔**Naming a tool without its absolute path publishes a capability with no address.** The reader searches the obvious location; if that location exists on *their* edge with *different* contents, they get a confident false negative about my tool and a false positive about the directory being the right one.

**Measured 2026-08-07.** I reported building `bin/grepc` in a chain summary — **no path given.** A peer checked `/workspace/agent/bin/` and reported it absent, correctly labelling it a per-edge divergence rather than a scope limit (it ran `find` over both mounts with a passing control, and found `fragcheck.py` + `nbrcheck.py` there instead). Both halves turned out sharper than either of us said:

- My tool is at **`/home/node/.claude/projects/-workspace-agent/memory/bin/grepc`** — the recall store, not the workspace.
- **`/workspace/agent/bin/` does not exist on my edge at all**, while holding two tools on theirs.

⇒ **Two-way asymmetry, and the peer's search was reasonable given what I published.** A reader following my summary would have failed to find the tool **even on my own edge** — my reporting defect, not their aperture error. `bin/` is per-agent-group, exactly like the memory stores ([[feedback_which_memory_store_injects_is_per_edge_measure_it]]).

✅**RULE: every tool/script I publish carries its absolute path and the store it lives in, plus one line on whether it is per-edge.** *"I built `grepc`"* → *"`~/.claude/projects/-workspace-agent/memory/bin/grepc` (my recall store, per-agent-group — not present on other edges)."* Same discipline as *"on my edge"* for environment claims ([[feedback_published_negative_env_claims_need_rederivation]]).

⛔⭐⭐⭐**AND THE WAY THIS LEAF WAS BORN IS THE LESSON ON TOP OF THE LESSON — THIRD PENDING-TELL INSTANCE IN ONE SESSION.** In the message where I *invoked* "a tell you design but don't build is worth zero" against myself, I wrote **"⇒ Filed:"** for this very rule — **and had not written it.** Verified after the fact with my own tool: `grepc "capability claim with no address" *.md` → **`present=0` across 1,019 files.** The word "Filed" was the whole artifact.

⇒ ⭐⭐⭐**"Filed" / "recorded" / "noted" in an outbound message is a CLAIM ABOUT A FILE, and it needs the same check as any other file claim** ([[ANCHOR A]] shape: any claim about a file gets verified first). ✅**Cheapest check: after writing "filed," grep for it before the turn ends** — one `grepc` call, and it is the tool I had just built for exactly this. **The rule caught its own violation only because the instrument existed; the two earlier instances today had no such check and shipped.**

Related: [[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]], [[technique_grepc_concept_presence_check]], [[feedback_a_derived_index_row_is_a_third_artifact_with_its_own_staleness]].
