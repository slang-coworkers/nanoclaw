import { describe, expect, test } from 'bun:test';

import {
  GPU_PROBE_STATE_KEY,
  parseCuInit,
  parseNvidiaSmiQuery,
  parseStoredGpuProbe,
  parseVulkanSummary,
  probeGpu,
  renderGpuContextLine,
  runGpuProbe,
  type CmdResult,
  type ProbeDeps,
} from './gpu-probe.js';

const L40S_SMI = 'NVIDIA L40S, 595.91.07\n';
const VK_SUMMARY = `==========
VULKANINFO
==========
Devices:
========
GPU0:
	apiVersion         = 1.4.312
	driverVersion      = 595.91.7.0
	deviceType         = PHYSICAL_DEVICE_TYPE_DISCRETE_GPU
	deviceName         = NVIDIA L40S
GPU1:
	deviceType         = PHYSICAL_DEVICE_TYPE_CPU
	deviceName         = llvmpipe (LLVM 15.0.6, 256 bits)
`;

function deps(results: Record<string, CmdResult>, existing: string[] = []): ProbeDeps {
  return {
    run: async (cmd) => {
      if (cmd === 'nvidia-smi') return results.smi;
      if (cmd === 'vulkaninfo') return results.vk;
      return results.cuda;
    },
    exists: (p) => existing.includes(p),
    now: () => new Date('2026-10-16T12:00:00.000Z'),
  };
}

const ICD = '/usr/share/vulkan/icd.d/nvidia_icd.json';

describe('parseNvidiaSmiQuery', () => {
  test('single GPU', () => {
    expect(parseNvidiaSmiQuery(L40S_SMI)).toEqual([{ name: 'NVIDIA L40S', driver: '595.91.07' }]);
  });
  test('multi GPU, names with commas-free spaces', () => {
    expect(parseNvidiaSmiQuery('NVIDIA A100-SXM4-80GB, 550.54.15\nNVIDIA A100-SXM4-80GB, 550.54.15\n')).toHaveLength(2);
  });
  test('failure text yields no devices', () => {
    expect(parseNvidiaSmiQuery('No devices were found\n')).toEqual([]);
    expect(
      parseNvidiaSmiQuery(
        "NVIDIA-SMI has failed because it couldn't communicate with the NVIDIA driver. Make sure that the latest NVIDIA driver is installed and running.\n",
      ),
    ).toEqual([]);
    expect(parseNvidiaSmiQuery('')).toEqual([]);
  });
});

describe('parseVulkanSummary', () => {
  test('keeps physical GPUs, drops CPU rasterizers', () => {
    expect(parseVulkanSummary(VK_SUMMARY)).toEqual(['NVIDIA L40S']);
  });
  test('no devices', () => {
    expect(parseVulkanSummary('ERROR: [Loader Message] Code 0 : vkCreateInstance: Found no drivers!')).toEqual([]);
  });
});

describe('parseCuInit', () => {
  test('CUDA_SUCCESS', () => expect(parseCuInit({ ok: true, stdout: '0\n' })).toBe('ok'));
  test('non-zero CUresult', () =>
    expect(parseCuInit({ ok: true, stdout: '100\n' })).toBe('failed: cuInit returned 100'));
  test('libcuda missing', () =>
    expect(parseCuInit({ ok: false, stdout: 'Failed to open library "libcuda.so.1"', error: 'exit 3' })).toStartWith(
      'unavailable:',
    ));
  test('timeout', () => expect(parseCuInit({ ok: false, stdout: '', error: 'timeout' })).toBe('failed: timeout'));
});

describe('probeGpu', () => {
  test('GPU host (prod L40S shape, vulkaninfo absent)', async () => {
    const p = await probeGpu(
      deps(
        {
          smi: { ok: true, stdout: L40S_SMI },
          cuda: { ok: true, stdout: '0\n' },
          vk: { ok: false, stdout: '', error: 'enoent' },
        },
        ['/dev/nvidia0', ICD],
      ),
    );
    expect(p.gpu).toBe(true);
    expect(p.driver).toBe('595.91.07');
    expect(p.devNode).toBe(true);
    expect(p.cuda).toBe('ok');
    expect(p.vulkan).toEqual({ tool: false, devices: [], nvidiaIcd: true });
    expect(p.probedAt).toBe('2026-10-16T12:00:00.000Z');
  });

  test('nvidia-smi missing', async () => {
    const p = await probeGpu(
      deps({
        smi: { ok: false, stdout: '', error: 'enoent' },
        cuda: { ok: false, stdout: 'Failed to open library', error: 'exit 3' },
        vk: { ok: false, stdout: '', error: 'enoent' },
      }),
    );
    expect(p.gpu).toBe(false);
    expect(p.reason).toBe('nvidia-smi not found');
  });

  test('nvidia-smi timeout', async () => {
    const p = await probeGpu(
      deps({
        smi: { ok: false, stdout: '', error: 'timeout' },
        cuda: { ok: false, stdout: '', error: 'timeout' },
        vk: { ok: false, stdout: '', error: 'timeout' },
      }),
    );
    expect(p.gpu).toBe(false);
    expect(p.reason).toBe('nvidia-smi timeout');
    expect(p.vulkan.error).toBe('timeout');
  });

  test('nvidia-smi driver failure (non-zero exit)', async () => {
    const p = await probeGpu(
      deps({
        smi: { ok: false, stdout: "NVIDIA-SMI has failed because it couldn't communicate", error: 'exit 9' },
        cuda: { ok: true, stdout: '100\n' },
        vk: { ok: false, stdout: '', error: 'enoent' },
      }),
    );
    expect(p.gpu).toBe(false);
    expect(p.reason).toBe('nvidia-smi exit 9');
  });

  test('nvidia-smi fails but CUDA + Vulkan work → partial, not "no GPU"', async () => {
    const p = await probeGpu(
      deps({
        smi: { ok: false, stdout: '', error: 'enoent' },
        cuda: { ok: true, stdout: '0' },
        vk: { ok: true, stdout: VK_SUMMARY },
      }),
    );
    expect(p.gpu).toBe(true);
    expect(p.nvml).toBe(false);
    const line = renderGpuContextLine(p);
    expect(line).toStartWith('Environment: GPU partially detected');
    expect(line).toContain('CUDA driver init OK; Vulkan device NVIDIA L40S');
    expect(line).not.toContain('cannot run');
  });
});

describe('renderGpuContextLine', () => {
  test('GPU line is measured from the probe', async () => {
    const p = await probeGpu(
      deps(
        {
          smi: { ok: true, stdout: L40S_SMI },
          cuda: { ok: true, stdout: '0\n' },
          vk: { ok: true, stdout: VK_SUMMARY },
        },
        ['/dev/nvidia0', ICD],
      ),
    );
    const line = renderGpuContextLine(p);
    expect(line).toStartWith(
      'Environment: this container has an NVIDIA L40S GPU (driver 595.91.07; CUDA driver init OK; Vulkan device NVIDIA L40S)',
    );
    expect(line).toContain('slang-test -api vk/cuda');
    expect(line).toContain('complement, not a substitute');
    expect(line.split('\n')).toHaveLength(1);
  });

  test('GPU line notes a missing vulkaninfo', async () => {
    const p = await probeGpu(
      deps(
        {
          smi: { ok: true, stdout: L40S_SMI + L40S_SMI },
          cuda: { ok: true, stdout: '0' },
          vk: { ok: false, stdout: '', error: 'enoent' },
        },
        [ICD],
      ),
    );
    expect(renderGpuContextLine(p)).toContain(
      '2x NVIDIA L40S GPUs (driver 595.91.07; CUDA driver init OK; vulkaninfo not installed; NVIDIA Vulkan ICD present, Vulkan access unverified)',
    );
  });

  test('installed ICD does not mask a failed or CPU-only Vulkan probe', async () => {
    const failed = await probeGpu(
      deps(
        {
          smi: { ok: true, stdout: L40S_SMI },
          cuda: { ok: true, stdout: '0' },
          vk: { ok: false, stdout: 'ERROR: Found no drivers!', error: 'exit 1' },
        },
        [ICD],
      ),
    );
    expect(renderGpuContextLine(failed)).toContain('Vulkan probe failed: exit 1');
    const cpuOnly = await probeGpu(
      deps(
        {
          smi: { ok: true, stdout: L40S_SMI },
          cuda: { ok: true, stdout: '0' },
          vk: { ok: true, stdout: 'GPU0:\n\tdeviceName = llvmpipe (LLVM 15.0.6, 256 bits)\n' },
        },
        [ICD],
      ),
    );
    expect(renderGpuContextLine(cpuOnly)).toContain('Vulkan probe listed no hardware GPUs');
  });

  test('no-GPU line carries the reason and does not generalize', async () => {
    const p = await probeGpu(
      deps({
        smi: { ok: false, stdout: '', error: 'enoent' },
        cuda: { ok: false, stdout: '', error: 'exit 3' },
        vk: { ok: false, stdout: '', error: 'enoent' },
      }),
    );
    const line = renderGpuContextLine(p);
    expect(line).toStartWith(
      'Environment: no NVIDIA GPU detected in this container (probe at container start: nvidia-smi not found;',
    );
    expect(line).toContain('infra problem');
    expect(line).toContain('do not record it as an environment fact');
  });

  test('no probe → no line', () => {
    expect(renderGpuContextLine(null)).toBe('');
  });
});

describe('runGpuProbe', () => {
  test('persists JSON under gpu_probe and round-trips', async () => {
    const stored: Record<string, string> = {};
    const p = await runGpuProbe(
      (k, v) => (stored[k] = v),
      () => {},
      deps({
        smi: { ok: true, stdout: L40S_SMI },
        cuda: { ok: true, stdout: '0' },
        vk: { ok: false, stdout: '', error: 'enoent' },
      }),
    );
    expect(p?.gpu).toBe(true);
    expect(parseStoredGpuProbe(stored[GPU_PROBE_STATE_KEY])).toEqual(p);
  });

  test('persist failure does not lose the probe', async () => {
    const p = await runGpuProbe(
      () => {
        throw new Error('db locked');
      },
      () => {},
      deps({
        smi: { ok: true, stdout: L40S_SMI },
        cuda: { ok: true, stdout: '0' },
        vk: { ok: false, stdout: '', error: 'enoent' },
      }),
    );
    expect(p?.gpu).toBe(true);
  });

  test('probe throwing returns null, never throws', async () => {
    const p = await runGpuProbe(
      () => {},
      () => {},
      {
        run: async () => {
          throw new Error('boom');
        },
        exists: () => false,
        now: () => new Date(),
      },
    );
    expect(p).toBeNull();
  });

  test('parseStoredGpuProbe rejects garbage', () => {
    expect(parseStoredGpuProbe('nope')).toBeNull();
    expect(parseStoredGpuProbe('{"gpu":"yes"}')).toBeNull();
    expect(parseStoredGpuProbe(undefined)).toBeNull();
  });
});

describe('runCmd (real)', () => {
  test('missing binary → enoent', async () => {
    const { runCmd } = await import('./gpu-probe.js');
    const r = await runCmd('definitely-not-a-binary-xyz', [], 1000);
    expect(r).toMatchObject({ ok: false, error: 'enoent' });
  });
  test('timeout is enforced', async () => {
    const { runCmd } = await import('./gpu-probe.js');
    const t0 = Date.now();
    const r = await runCmd('sleep', ['5'], 200);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('timeout');
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});
