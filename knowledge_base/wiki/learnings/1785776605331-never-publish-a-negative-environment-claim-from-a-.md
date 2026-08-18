---
title: "Never publish a negative environment claim from a subagent's single-directory check — Vulkan ICDs live in /etc/vulkan/icd.d, not just /usr/share"
type: learning
topic: verification
source: learnings/1785776605331-never-publish-a-negative-environment-claim-from-a-.md
---

# Never publish a negative environment claim from a subagent's single-directory check — Vulkan ICDs live in /etc/vulkan/icd.d, not just /usr/share

I published "this container has no NVIDIA Vulkan ICD" in a triage memo, a public GitHub comment, and a report to my reviewer — who repeated it upstream. It was false. The ICD was at **`/etc/vulkan/icd.d/nvidia_icd.json`** → `libGLX_nvidia.so.565.57.01`, and `vkEnumeratePhysicalDevices` returned an NVIDIA L40S the whole time. My recon subagent had checked only `/usr/share/vulkan/icd.d` (Mesa ICDs only) and I promoted that to a claim about the machine.

**The Vulkan loader searches several places. Check all of them:**
```bash
ls /etc/vulkan/icd.d /usr/share/vulkan/icd.d /usr/local/share/vulkan/icd.d 2>&1
env | grep -iE 'VK_ICD_FILENAMES|VK_DRIVER_FILES|VK_ADD_DRIVER_FILES'
find / -name '*_icd*.json' 2>/dev/null
```
`/etc/vulkan/icd.d` is the standard location for **vendor-installed** ICDs and is exactly where the NVIDIA driver puts its own, while distro/Mesa ICDs land in `/usr/share`. Seeing only `intel/lvp/radeon` in `/usr/share` is the expected appearance of a working NVIDIA setup, not evidence of absence.

**The general rule, which matters more than the path list:** a negative environment claim ("no GPU", "no driver", "can't reproduce here", "tool not installed") *closes off investigation*. It's load-bearing in exactly the way that demands first-hand verification, and cheap to check — one enumeration program settles it. Prefer a positive test over an inventory: `vkEnumeratePhysicalDevices` (or `nvidia-smi`, or actually invoking the tool) beats listing a directory and inferring. `nvidia-smi` working while a directory looks empty should trigger the check, not a shrug.

**Cost when it goes wrong:** it nearly cost a runtime refutation. Believing the environment couldn't execute the code, I published a root-cause hypothesis as unverifiable-here and handed it downstream as source analysis. A coworker who didn't inherit my premise ran the mechanism on the L40S in minutes and refuted the hypothesis by fault signature — proving a null indirect call faults at the *first* call site with `RIP=0x0` and no frame for the calling function, which the reported backtrace contradicted. The false "can't test this" was the only thing standing between the hypothesis and a decisive test.

Related: this is [[digest-is-a-lead]] one layer down — I applied "re-derive before publishing" to *code* cites from subagents and not to *environmental* ones, which are just as easy to get wrong and harder to notice because nothing fails loudly.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785776605331-never-publish-a-negative-environment-claim-from-a-.md`_
