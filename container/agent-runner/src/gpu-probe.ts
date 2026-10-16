/**
 * GPU probe — measure, once per container start, whether this container can
 * actually execute on an NVIDIA GPU, and tell the agent the measured answer.
 *
 * Why this exists: coworkers on a GPU host wrote learnings like "no GPU in this
 * container" because `vulkaninfo` was missing from their image (command not
 * found), then stopped running GPU tests that would have helped. The host
 * passes the GPU through (`--runtime=nvidia`); the agent just had no reliable
 * fact about it. This module produces that fact.
 *
 * Probes (all bounded by a short timeout, all run in parallel, none can fail
 * startup):
 *   - `nvidia-smi --query-gpu=name,driver_version --format=csv,noheader` →
 *     GPU name(s) + driver version (NVML reachable).
 *   - `/dev/nvidia0` presence.
 *   - CUDA driver init: a throwaway `bun -e` child dlopens `libcuda.so.1` and
 *     calls `cuInit(0)`. A child, not this process, so a hung or crashing
 *     driver cannot take the runner with it, and the long-lived runner never
 *     holds driver state.
 *   - Vulkan: `vulkaninfo --summary` device names when the tool exists, else
 *     presence of the NVIDIA ICD manifest.
 *
 * The result is persisted to outbound.db `session_state` key `gpu_probe` (JSON)
 * so the host can compare it with the GPU args it applied, and rendered into
 * ONE line of the system-prompt addendum (see `renderGpuContextLine`).
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';

export const GPU_PROBE_STATE_KEY = 'gpu_probe';

/** Per-command timeout. vulkaninfo on a cold driver is the slowest (~1 s). */
const PROBE_TIMEOUT_MS = 5_000;

const NVIDIA_ICD_PATHS = [
  '/usr/share/vulkan/icd.d/nvidia_icd.json',
  '/etc/vulkan/icd.d/nvidia_icd.json',
  '/usr/share/vulkan/icd.d/nvidia_icd.x86_64.json',
];

export interface GpuDevice {
  name: string;
  driver?: string;
}

export interface GpuProbe {
  /**
   * True when ANY execution signal is positive: nvidia-smi listed a GPU, CUDA
   * initialized, or vulkaninfo enumerated a hardware device. `nvml` says
   * whether nvidia-smi itself worked.
   */
  gpu: boolean;
  nvml: boolean;
  devices: GpuDevice[];
  driver?: string;
  /** Why nvidia-smi listed nothing (missing / failed / timed out / no rows). */
  reason?: string;
  devNode: boolean;
  /** CUDA driver init: 'ok', 'failed: <detail>', or 'unavailable: <detail>'. */
  cuda: string;
  /** Vulkan: device names from vulkaninfo, or the ICD fallback. */
  vulkan: { tool: boolean; devices: string[]; nvidiaIcd: boolean; error?: string };
  probedAt: string;
}

/** Outcome of one bounded command run. */
export interface CmdResult {
  ok: boolean;
  stdout: string;
  /** 'enoent' | 'timeout' | 'exit <code>' | other error text, when !ok. */
  error?: string;
}

export type RunCmd = (cmd: string, args: string[], timeoutMs: number) => Promise<CmdResult>;

/**
 * Run one bounded command. The deadline is enforced independently of the
 * child: a probe stuck in an uninterruptible driver call can outlive SIGKILL,
 * and waiting for its exit callback would block runner startup indefinitely.
 * On the deadline the child is killed, its pipes destroyed and unref'd, and the
 * promise resolves 'timeout' without waiting for it.
 */
export const runCmd: RunCmd = (cmd, args, timeoutMs) =>
  new Promise((resolve) => {
    let settled = false;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const settle = (r: CmdResult): void => {
      if (settled) return;
      settled = true;
      if (deadline) clearTimeout(deadline);
      resolve(r);
    };
    try {
      const child = execFile(
        cmd,
        args,
        { timeout: timeoutMs, killSignal: 'SIGKILL', encoding: 'utf8', maxBuffer: 1024 * 1024 },
        (err, stdout) => {
          if (!err) return settle({ ok: true, stdout: String(stdout) });
          const e = err as NodeJS.ErrnoException & { killed?: boolean; code?: unknown; signal?: unknown };
          let error: string;
          if (e.code === 'ENOENT') error = 'enoent';
          else if (e.killed || e.signal === 'SIGKILL') error = 'timeout';
          else if (typeof e.code === 'number') error = `exit ${e.code}`;
          else error = e.message.split('\n')[0];
          settle({ ok: false, stdout: String(stdout ?? ''), error });
        },
      );
      // Grace past execFile's own timeout so the normal path reports first.
      deadline = setTimeout(() => {
        try {
          child.kill('SIGKILL');
          child.stdin?.destroy();
          child.stdout?.destroy();
          child.stderr?.destroy();
          child.unref();
        } catch {
          /* best effort */
        }
        settle({ ok: false, stdout: '', error: 'timeout' });
      }, timeoutMs + 500);
      if (settled) clearTimeout(deadline);
    } catch (err) {
      settle({ ok: false, stdout: '', error: err instanceof Error ? err.message : String(err) });
    }
  });

/**
 * Parse `nvidia-smi --query-gpu=name,driver_version --format=csv,noheader`.
 * One `name, driver` row per GPU. Lines that do not look like a row (warnings,
 * "No devices were found") are ignored.
 */
export function parseNvidiaSmiQuery(stdout: string): GpuDevice[] {
  const devices: GpuDevice[] = [];
  for (const raw of stdout.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const idx = line.lastIndexOf(',');
    if (idx <= 0) continue;
    const name = line.slice(0, idx).trim();
    const driver = line.slice(idx + 1).trim();
    if (!name || !/^\d+(\.\d+)+$/.test(driver)) continue;
    devices.push({ name, driver });
  }
  return devices;
}

/** Device names from `vulkaninfo --summary` (`deviceName = ...` lines). CPU (llvmpipe) devices dropped. */
export function parseVulkanSummary(stdout: string): string[] {
  const names: string[] = [];
  for (const m of stdout.matchAll(/^\s*deviceName\s*=\s*(.+?)\s*$/gm)) {
    const name = m[1];
    if (/llvmpipe|lavapipe|swiftshader/i.test(name)) continue;
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

/** Interpret the cuInit child's stdout: it prints the CUresult code. */
export function parseCuInit(result: CmdResult): string {
  if (!result.ok) {
    const detail = (result.error ?? 'error') + (result.stdout.trim() ? ` (${result.stdout.trim().slice(0, 80)})` : '');
    return /libcuda|dlopen|cannot open/i.test(result.stdout) ? `unavailable: ${detail}` : `failed: ${detail}`;
  }
  const code = result.stdout.trim();
  return code === '0' ? 'ok' : `failed: cuInit returned ${code || 'nothing'}`;
}

/** Child script: dlopen libcuda and call cuInit(0); print the CUresult. */
const CUINIT_SCRIPT =
  "import{dlopen,FFIType}from'bun:ffi';" +
  "try{const l=dlopen('libcuda.so.1',{cuInit:{args:[FFIType.u32],returns:FFIType.i32}});" +
  'console.log(l.symbols.cuInit(0))}catch(e){console.log(String(e&&e.message||e));process.exit(3)}';

export interface ProbeDeps {
  run: RunCmd;
  exists: (p: string) => boolean;
  now: () => Date;
}

const defaultDeps: ProbeDeps = { run: runCmd, exists: (p) => fs.existsSync(p), now: () => new Date() };

export async function probeGpu(deps: ProbeDeps = defaultDeps): Promise<GpuProbe> {
  const [smi, cuda, vk] = await Promise.all([
    deps.run('nvidia-smi', ['--query-gpu=name,driver_version', '--format=csv,noheader'], PROBE_TIMEOUT_MS),
    deps.run(process.execPath || 'bun', ['-e', CUINIT_SCRIPT], PROBE_TIMEOUT_MS),
    deps.run('vulkaninfo', ['--summary'], PROBE_TIMEOUT_MS),
  ]);

  const devices = smi.ok ? parseNvidiaSmiQuery(smi.stdout) : [];
  let reason: string | undefined;
  if (!smi.ok) reason = smi.error === 'enoent' ? 'nvidia-smi not found' : `nvidia-smi ${smi.error}`;
  else if (devices.length === 0) reason = 'nvidia-smi listed no GPUs';

  const nvidiaIcd = NVIDIA_ICD_PATHS.some((p) => deps.exists(p));
  const vkTool = vk.error !== 'enoent';
  const vulkan: GpuProbe['vulkan'] = {
    tool: vkTool,
    devices: vk.ok ? parseVulkanSummary(vk.stdout) : [],
    nvidiaIcd,
    ...(vkTool && !vk.ok ? { error: vk.error } : {}),
  };

  const cudaResult = parseCuInit(cuda);
  return {
    gpu: devices.length > 0 || cudaResult === 'ok' || vulkan.devices.length > 0,
    nvml: devices.length > 0,
    devices,
    ...(devices[0]?.driver ? { driver: devices[0].driver } : {}),
    ...(reason ? { reason } : {}),
    devNode: deps.exists('/dev/nvidia0'),
    cuda: cudaResult,
    vulkan,
    probedAt: deps.now().toISOString(),
  };
}

/** Collapse identical device names: "2x NVIDIA L40S". */
function describeDevices(devices: GpuDevice[]): string {
  const counts = new Map<string, number>();
  for (const d of devices) counts.set(d.name, (counts.get(d.name) ?? 0) + 1);
  return [...counts].map(([name, n]) => (n > 1 ? `${n}x ${name}` : name)).join(', ');
}

/**
 * The one Environment line the agent sees each session. Measured, never
 * assumed: every clause comes from the probe. Empty when there is no probe.
 */
export function renderGpuContextLine(probe: GpuProbe | null | undefined): string {
  if (!probe) return '';
  if (!probe.gpu) {
    return (
      `Environment: no NVIDIA GPU detected in this container (probe at container start: ${probe.reason ?? 'no GPU listed'}; CUDA ${probe.cuda}; ${vulkanFact(probe)}). ` +
      'GPU tests (slang-test -api vk/cuda, SlangPy GPU devices) cannot run here — say so explicitly instead of reporting them as passed, ' +
      'and report it to the operator as an infra problem; do not record it as an environment fact in learnings or memory.'
    );
  }
  const cudaFact = probe.cuda === 'ok' ? 'CUDA driver init OK' : `CUDA ${probe.cuda}`;
  if (!probe.nvml) {
    return (
      `Environment: GPU partially detected at container start (${probe.reason ?? 'nvidia-smi listed no GPUs'}; ${cudaFact}; ${vulkanFact(probe)}). ` +
      'Run GPU tests on the backend that probed OK when the task needs real GPU execution, and verify any other backend before skipping its tests; ' +
      'report the nvidia-smi failure to the operator as an infra problem.'
    );
  }
  const plural = probe.devices.length > 1 ? 'GPUs' : 'GPU';
  const facts: string[] = [];
  if (probe.driver) facts.push(`driver ${probe.driver}`);
  facts.push(cudaFact, vulkanFact(probe));
  return (
    `Environment: this container has ${probe.devices.length > 1 ? '' : 'an '}${describeDevices(probe.devices)} ${plural} (${facts.join('; ')}), measured at container start. ` +
    'Run GPU tests (slang-test -api vk/cuda, SlangPy GPU devices) when the task needs real GPU execution; ' +
    'GPU-free compile checks are a complement, not a substitute.'
  );
}

/**
 * What the Vulkan probe actually showed. An installed ICD manifest proves
 * installation, not working access, so it is only reported as "unverified".
 */
function vulkanFact(probe: GpuProbe): string {
  const vk = probe.vulkan;
  if (vk.devices.length > 0) return `Vulkan device ${vk.devices.join(', ')}`;
  if (vk.error) return `Vulkan probe failed: ${vk.error}`;
  if (vk.tool) return 'Vulkan probe listed no hardware GPUs';
  return `vulkaninfo not installed; NVIDIA Vulkan ICD ${vk.nvidiaIcd ? 'present' : 'absent'}, Vulkan access unverified`;
}

/** Validate a stored probe row (also used by tests). Null on garbage. */
export function parseStoredGpuProbe(raw: string | undefined | null): GpuProbe | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<GpuProbe>;
    if (!p || typeof p !== 'object' || typeof p.gpu !== 'boolean' || typeof p.probedAt !== 'string') return null;
    return p as GpuProbe;
  } catch {
    return null;
  }
}

/**
 * Run the probe and persist it. Never throws: on any failure it logs and
 * returns null, and the agent simply gets no Environment line.
 */
export async function runGpuProbe(
  persist: (key: string, value: string) => void,
  log: (msg: string) => void,
  deps: ProbeDeps = defaultDeps,
): Promise<GpuProbe | null> {
  try {
    const probe = await probeGpu(deps);
    try {
      persist(GPU_PROBE_STATE_KEY, JSON.stringify(probe));
    } catch (err) {
      log(`GPU probe: persist failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    log(
      probe.gpu
        ? `GPU probe: ${describeDevices(probe.devices)} driver=${probe.driver ?? '?'} cuda=${probe.cuda} vulkan=${probe.vulkan.devices.join('|') || (probe.vulkan.nvidiaIcd ? 'icd' : 'none')}`
        : `GPU probe: no GPU (${probe.reason})`,
    );
    return probe;
  } catch (err) {
    log(`GPU probe failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
