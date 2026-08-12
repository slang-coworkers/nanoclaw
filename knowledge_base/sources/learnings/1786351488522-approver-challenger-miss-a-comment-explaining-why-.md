# [approver/challenger-miss] A comment explaining why some query is unreliable is a PREDICATE to test against the adjacent code, not just rationale — and "does this helper query the thing its name asserts?" is a first-class probe

## Symptom

On slang-rhi#820 I abstained (`ABSTAIN_POLICY:OPEN_GAP`) on an 18-line new Vulkan
helper, `isSwapchainImageUsageSupported` (`src/vulkan/vk-surface.cpp:32-49`),
having confirmed two mechanical defects in it: an unguarded possibly-null proc
call with no API-version gate, and `return … == VK_SUCCESS` conflating OOM with
"usage unsupported".

Devin, arriving after I recorded, flagged a **third and more fundamental** defect
in the same helper that I had not found: *the probe queries the wrong thing.* It
builds a plain `VkPhysicalDeviceImageFormatInfo2` with
`tiling = VK_IMAGE_TILING_OPTIMAL` and calls
`vkGetPhysicalDeviceImageFormatProperties2` — which describes **ordinary 2D
images**. Swapchain image usage is governed by
`vkGetPhysicalDeviceSurfaceCapabilitiesKHR().supportedUsageFlags`, used correctly
elsewhere in that very same file. A function named `isSwapchainImageUsageSupported`
does not answer the question its name asserts.

## Root cause

The refutation was sitting in the diff I had already read twice. Immediately
above the call site, a comment (surviving from the previous revision) warns:

> a format's optimal-tiling features may report storage support while the
> swapchain still rejects `VK_IMAGE_USAGE_STORAGE_BIT` for that format (e.g.
> `*_SRGB`), tripping `VUID-VkSwapchainCreateInfoKHR-imageFormat-01778`

The author **documented that optimal-tiling properties are not authoritative for
swapchains** — and then built the new swapchain gate on exactly that query. I
read that comment as *rationale for a design choice* and moved on, instead of
treating it as a *claim to check against the adjacent code*. The check was
purely local, cost nothing, and needed no GPU. I found the two defects that look
like defects (missing guard, wrong error mapping) and missed the one that
requires holding the comment and the code in the same thought.

## How to catch it

Two probes, both cheap, both addressable to a specific decision point:

1. **When a diff contains a comment explaining why some query/mechanism is
   unreliable, immediately check whether the new code in that hunk uses it.**
   Trigger: any "may report X while actually Y", "is not authoritative", "can
   be stale", "defense-in-depth only" comment. The author's own caveat is the
   sharpest severity argument available, because a self-contradiction is settled
   by the text — no runtime, no reviewer judgment call.
2. **For every new predicate helper (`is…`, `has…`, `supports…`, `can…`), ask:
   does it query the thing its name asserts?** Checkable in isolation with no
   callers and no execution. A name/behaviour mismatch is a first-class finding,
   not a style nit — every future caller will trust the name.

Corollary on convergence: three independent sources hit this one helper at three
different layers (null/version gating, VkResult conflation, wrong query
semantics). **Multiple findings clustering in one small function is a signal the
function is wrong in kind, not merely rough** — when that happens, re-derive the
function's purpose from scratch rather than enumerating its defects.

## Fix

Decision state was already `ABSTAIN_POLICY:OPEN_GAP`, so the miss changed no
outcome — the abstain was strengthened, and `OPEN_GAP` covers all three findings.
Recorded a post-record addendum in the decision artifact (no second ledger row;
keyed on `(repo, pr, commit_sha)` and the head was unchanged) and corrected an
earlier line in my own record that said Devin "contributed nothing", which the
addendum refutes.

Related instrument note: the subagent could neither confirm nor refute that its
Devin scrape was of the current head — the page renders no SHA — and it said so
after running a **positive control** proving the grep worked. Reinforces: a
zero-hit grep needs both a must-be-nonzero control AND a check that the token
could ever have appeared; otherwise "absent" is a fact about rendering, not the
world.
