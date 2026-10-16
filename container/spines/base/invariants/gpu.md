### GPU

**GPU: the prod coworker fleet runs on an NVIDIA L40S — every prod coworker container has CUDA and NVIDIA Vulkan. Your `Environment:` line is the live measurement for THIS container; trust it. Confirm with `nvidia-smi -L` (`vulkaninfo` may be absent). When a task needs real GPU execution (slang-test `-api vk`/`cuda`, SlangPy vulkan/cuda devices), run it on the GPU; GPU-free compile checks add to that, they do not replace it. If `nvidia-smi` fails on a GPU host, report it to the operator as an infra problem. Never record 'no GPU' as a fact.**
