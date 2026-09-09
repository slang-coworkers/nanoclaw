---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786557673652-u9x19x
written_at: 2026-08-13T08:38:52.673Z
---

# [approver/challenger-calibration] Devin-only clean-review WOULD_APPROVE on a bot-authored unorm/snorm SPIRV fix

**Context.** shader-slang/slang#12468 revision 2 (head 1d763afe00df, a master-merge of the fix branch). Bot-authored (nv-slang-bot), so harvest exit 20 (no production/CodeRabbit review — they skip bot branches). Devin exit 0 this time (30-min run completed), returned 0 bugs / 0 flags + 2 informational notes ⇒ decided WOULD_APPROVE. (Prior revision 74b0423f had abstained NO_REVIEW_SIGNAL only because Devin timed out then — the SAME change, so the abstain was purely an infra gap, confirmed here once Devin ran.)

**The transferable lesson — how to clear the two "informational" notes a reviewer WILL raise on an unwrap-before-classify fix:**

The fix adds `basicType = as<IRType>(unwrapAttributedType(basicType));` at the top of a type classifier that then computes multiple flags (isFloatingPoint, isSigned, isBool). A reviewer/Devin correctly notes "unwrap changes MORE than just the float flag." The way to clear it WITHOUT a build:

1. **Monotonicity argument for classifier flags.** For each flag the classifier derives, check the pre-unwrap behavior on the wrapper. In slang, both `isSignedType` and the float-switch hit `default:` for `Attributed(X)` (i.e. the SAFE/negative value: false). Unwrapping can therefore only move a flag false→true for a type that GENUINELY is float/signed. Each such flip selects the CORRECT opcode (OpU*→OpS*, int→float). There is no flip toward a wrong opcode, so the change is *monotonic toward correctness* — you don't need to enumerate every attributed shape, you need the sign of every possible change. This is the strongest kind of clear: the failure direction does not exist.

2. **"Sibling site still attribute-blind" clears as a missed optimization, not a bug — IF the opcode is already correct.** The nearby `isFloatOrPackedFloatType(elementType)` gate for OpVectorTimesScalar answers false on an attributed element, so it just SKIPS the canonical-form optimization and falls through to a general (valid) OpFMul-with-splat. Verify the fallthrough path emits valid SPIR-V; if so it's canonicality, not correctness. The PR named it out-of-scope; that's legitimate when there's no real-world correctness trigger.

**Bot-authored + Devin-clean is a legitimate WOULD_APPROVE path** — don't reflexively abstain just because there's no github-actions[bot] primary review. The fallback tier's verdict is fuzzier so apply extra caution (trace informational notes rather than parse them), but a Devin 0-bug/0-flag on a change that is (a) byte-identical to a human-approved head, (b) CI-green, (c) monotonic-to-correct, has no residual uncertainty to round down from.

**Join reminder.** DISMISSED on the prior head = branch-protection stale-dismissal from the master-merge (auto_merge_enabled by the human AFTER approving), NOT a human retraction. The human's APPROVE still counts for the prior commit; this revision decides on its own doc.
