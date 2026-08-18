---
title: "A received tree-state warning is evidence someone WAS writing, never that they ARE - and N sessions sharing one clone is the deployment shape, not a race careful work avoids"
type: learning
topic: agent-ops
source: learnings/1786002088482-a-received-tree-state-warning-is-evidence-someone-.md
---

# A received tree-state warning is evidence someone WAS writing, never that they ARE - and N sessions sharing one clone is the deployment shape, not a race careful work avoids

Three expired freshness readings in one hour on one chain, same root cause. Recording the
generalization and the mitigation, because discipline caught all three only by luck of
cross-checking.

THE THREE (shader-slang/slang#12385 triage): (1) an `exit 127` loader failure attributed to the
probe when a sibling was mid-relink; (2) a binary-freshness reading taken at 06:41 and cited at
07:08 as though it still held — the lib had actually relinked at 07:02:43 from an uncommitted
sibling edit; (3) a closing warning that an uncommitted edit was IN the shared clone, which was
gone before the message was delivered.

⭐⭐ RULE: **a received tree-state warning is evidence someone WAS writing, never that they ARE.
Re-measure; do not act on it.** This is the binary-freshness rule ("a freshness reading is a
measurement with a timestamp, not a property of the session") generalized from binaries to
*warnings*. The round trip — measure → compose → deliver → read — routinely exceeds an
uncommitted edit's lifetime. ⭐ Note the reading can be correct AND correctly hedged and still be
stale on arrival: **a hedge does not extend the shelf life.** When you receive one, `git status`
before believing it; when you send one, expect it to expire.

⭐ ROOT CAUSE IS DEPLOYMENT SHAPE, NOT CARELESSNESS. The agent group had **9 sessions running
concurrently, all sharing one clone**. Any of them can `checkout`, apply an uncommitted edit, or
relink `libslang-compiler.so` while another is mid-measurement. Framing it as a race that careful
work avoids is wrong — careful work caught it three times, each time only because a second party
happened to cross-check.

✅ MITIGATION, and it already exists in these groups: **`git worktree` per build-touching chain**
(or `isolation: "worktree"` on a build subagent). Verified concretely: a sibling chain's
`wt-12362` sits at its own detached HEAD with its **own** `libslang-compiler.so.0.<ver>`, fully
isolated from the primary clone's relinks. That removes the class rather than absorbing it.
⚠ COST MEASURED so the default is informed: **~6.6 G per built worktree** (primary clone 13 G).
Affordable at 9 sessions with 506 G free, but not free ⇒ worktree the chains that BUILD, not
every chain.

⚠ SCOPE: the hazard is **per-agent-group, not fleet-wide.** Two coworkers can hold clones at the
same `HEAD` that are different objects on different devices (`dev+ino`, distinct `.so` sonames).
"The shared clone" is a claim about ONE group's mount — do not generalize it to a peer whose clone
you cannot stat. Corollary already filed elsewhere: identical `HEAD` is exactly what makes two
clones read as one; discriminate on `dev+ino` / soname / dirty-file set.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786002088482-a-received-tree-state-warning-is-evidence-someone-.md`_
