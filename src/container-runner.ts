/**
 * Agent Runner for NanoClaw
 * Spawns agent execution as Node processes in git worktrees (no Docker required).
 */
import { ChildProcess, spawn } from 'child_process';
import { execSync } from 'child_process';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import yaml from 'js-yaml';

import {
  CONTAINER_MAX_OUTPUT_SIZE,
  CONTAINER_PREFIX,
  CONTAINER_TIMEOUT,
  DATA_DIR,
  GROUPS_DIR,
  IDLE_TIMEOUT,
  MCP_PROXY_PORT,
  TIMEZONE,
} from './config.js';
import { resolveGroupFolderPath, resolveGroupIpcPath } from './group-folder.js';
import { logger } from './logger.js';
import { AGENT_HOST_GATEWAY, getOrCreateWorktree } from './worktree-runtime.js';
import { readEnvFile } from './env.js';
import { validateAdditionalMounts } from './mount-security.js';
import {
  getDiscoveredToolInventory,
  registerContainerToken,
  revokeContainerToken,
} from './mcp-auth-proxy.js';
import { RegisteredGroup } from './types.js';

interface ManifestConfig {
  base: string;
  sections: string[];
  project_overlays: boolean;
}

/**
 * Compose a CLAUDE.md from a YAML manifest.
 * Layers: upstream base -> platform sections -> project overlays -> role templates
 */
function composeClaudeMd(
  templatesDir: string,
  manifestName: string,
  group: RegisteredGroup,
  projectRoot: string,
): string {
  const manifestPath = path.join(
    templatesDir,
    'manifests',
    `${manifestName}.yaml`,
  );
  const manifest = yaml.load(
    fs.readFileSync(manifestPath, 'utf-8'),
  ) as ManifestConfig;

  // Layer 0: upstream base
  const basePath =
    manifest.base === 'upstream-main'
      ? path.join(projectRoot, 'groups', 'main', 'CLAUDE.md')
      : path.join(projectRoot, 'groups', 'global', 'CLAUDE.md');
  let composed = fs.readFileSync(basePath, 'utf-8');

  // Layer 1: platform sections
  for (const section of manifest.sections || []) {
    const sectionPath = path.join(templatesDir, 'sections', `${section}.md`);
    if (fs.existsSync(sectionPath)) {
      composed += `\n\n---\n\n${fs.readFileSync(sectionPath, 'utf-8')}`;
    }
  }

  // Layer 2: project overlays
  if (manifest.project_overlays) {
    const projectsDir = path.join(templatesDir, 'projects');
    if (fs.existsSync(projectsDir)) {
      for (const proj of fs.readdirSync(projectsDir).sort()) {
        const projDir = path.join(projectsDir, proj);
        if (!fs.statSync(projDir).isDirectory()) continue;
        if (manifestName === 'coworker') {
          const f = path.join(projDir, 'coworker-base.md');
          if (fs.existsSync(f)) {
            composed += `\n\n---\n\n${fs.readFileSync(f, 'utf-8')}`;
          }
        } else {
          const f = path.join(projDir, `${manifestName}-overlay.md`);
          if (fs.existsSync(f)) {
            composed += `\n\n---\n\n${fs.readFileSync(f, 'utf-8')}`;
          }
        }
      }
    }
  }

  // Layer 3: role templates (typed coworkers only)
  if (group.coworkerType) {
    try {
      const types = JSON.parse(
        fs.readFileSync(
          path.join(projectRoot, 'groups', 'coworker-types.json'),
          'utf-8',
        ),
      );
      for (const role of group.coworkerType.split('+')) {
        const entry = types[role.trim()];
        const templates = Array.isArray(entry?.template)
          ? entry.template
          : entry?.template
            ? [entry.template]
            : [];
        for (const tpl of templates) {
          try {
            composed += `\n\n---\n\n${fs.readFileSync(path.resolve(projectRoot, tpl), 'utf-8')}`;
          } catch {
            /* template missing */
          }
        }
        const focusFiles: string[] | undefined = entry?.focusFiles;
        if (focusFiles && focusFiles.length > 0) {
          composed += `\n\n## Priority Files\n\nFocus your work on these paths first:\n`;
          for (const f of focusFiles) composed += `- \`${f}\`\n`;
        }
      }
    } catch {
      /* coworker-types.json missing */
    }
  }

  return composed;
}

// Sentinel markers for robust output parsing (must match agent-runner)
const OUTPUT_START_MARKER = '---NANOCLAW_OUTPUT_START---';
const OUTPUT_END_MARKER = '---NANOCLAW_OUTPUT_END---';

export interface ContainerInput {
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
  assistantName?: string;
  script?: string;
  allowedMcpTools?: string[];
  /** Full MCP tool inventory (auto-discovered). Agent-runner uses this to build disallowedTools. */
  mcpToolInventory?: Record<string, string[]>;
  /** Skip initial query, go straight to IPC polling. Used for interactive resume. */
  interactive?: boolean;
}

export interface ContainerOutput {
  status: 'success' | 'error';
  result: string | null;
  newSessionId?: string;
  error?: string;
}

/**
 * Compile the agent-runner TypeScript once at startup.
 * Subsequent calls are no-ops if the build is up to date.
 */
let agentRunnerBuilt = false;
let agentRunnerPath: string | null = null;

export function ensureAgentRunnerBuilt(): void {
  if (agentRunnerBuilt && agentRunnerPath) return;

  const agentRunnerDir = path.join(process.cwd(), 'container', 'agent-runner');
  const distDir = path.join(agentRunnerDir, 'dist');
  const indexJs = path.join(distDir, 'index.js');

  // Install deps if node_modules is missing
  if (!fs.existsSync(path.join(agentRunnerDir, 'node_modules'))) {
    logger.info('Installing agent-runner dependencies...');
    try {
      execSync('npm install', {
        cwd: agentRunnerDir,
        stdio: 'inherit',
        timeout: 120_000,
      });
    } catch (err) {
      logger.error({ err }, 'Failed to install agent-runner dependencies');
      throw new Error('Agent runner dependency installation failed', {
        cause: err,
      });
    }
  }

  // Build if dist is missing or source is newer
  const srcIndex = path.join(agentRunnerDir, 'src', 'index.ts');
  let needsBuild = !fs.existsSync(indexJs);
  if (!needsBuild && fs.existsSync(srcIndex)) {
    const srcMtime = fs.statSync(srcIndex).mtimeMs;
    const distMtime = fs.statSync(indexJs).mtimeMs;
    if (srcMtime > distMtime) needsBuild = true;
  }

  if (needsBuild) {
    logger.info('Compiling agent-runner...');
    try {
      execSync('npm run build', {
        cwd: agentRunnerDir,
        stdio: 'inherit',
        timeout: 60_000,
      });
      logger.info('Agent-runner compiled successfully');
    } catch (err) {
      logger.error({ err }, 'Failed to compile agent-runner');
      throw new Error('Agent runner compilation failed', { cause: err });
    }
  }

  agentRunnerBuilt = true;
  agentRunnerPath = indexJs;
}

/**
 * Set up per-group settings, skills, CLAUDE.md, and IPC directories.
 * This replaces the Docker volume-mount preparation from the old container-runner.
 */
function prepareGroupWorkspace(
  group: RegisteredGroup,
  isMain: boolean,
): { homeDir: string; claudeDir: string } {
  const projectRoot = process.cwd();
  const groupDir = resolveGroupFolderPath(group.folder);

  // Per-group HOME dir: agents see ~/.claude here
  const homeDir = path.join(DATA_DIR, 'sessions', group.folder);
  const claudeDir = path.join(homeDir, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });

  // Build managed env for settings.json
  const managedEnv: Record<string, string> = {
    CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
    CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: '1',
    CLAUDE_CODE_DISABLE_AUTO_MEMORY: '0',
    NANOCLAW_GROUP_FOLDER: group.folder,
  };

  const dashboardInstalled = fs.existsSync(
    path.join(projectRoot, 'dashboard', 'server.ts'),
  );
  if (dashboardInstalled) {
    const dashboardPort = process.env.DASHBOARD_PORT || '3737';
    managedEnv.DASHBOARD_URL = `http://${AGENT_HOST_GATEWAY}:${dashboardPort}`;
  }

  // Read existing settings to preserve user-added keys
  const settingsFile = path.join(claudeDir, 'settings.json');
  let existing: Record<string, any> = {};
  try {
    existing = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
  } catch {
    /* file missing or invalid — start fresh */
  }

  const mergedEnv = { ...(existing.env || {}), ...managedEnv };

  // Merge hooks
  let mergedHooks = existing.hooks || {};
  // Clean stale NanoClaw hooks
  for (const event of Object.keys(mergedHooks)) {
    const existingList: { hooks?: any[]; command?: string }[] =
      mergedHooks[event] || [];
    mergedHooks[event] = existingList.filter((h) => {
      if (h.command && h.command.includes('notify-dashboard.sh')) return false;
      if (
        h.hooks &&
        h.hooks.some(
          (inner: any) =>
            (inner.type === 'http' &&
              inner.url &&
              inner.url.includes('/api/hook-event')) ||
            (inner.type === 'command' &&
              inner.command &&
              inner.command.includes('/api/hook-event')),
        )
      )
        return false;
      return true;
    });
  }
  if (dashboardInstalled) {
    const dashboardPort = process.env.DASHBOARD_PORT || '3737';
    const hookEvents = [
      'PreToolUse',
      'PostToolUse',
      'PostToolUseFailure',
      'SessionStart',
      'SessionEnd',
      'Stop',
      'Notification',
      'UserPromptSubmit',
      'PermissionRequest',
      'SubagentStart',
      'SubagentStop',
      'TaskCompleted',
      'TeammateIdle',
      'PreCompact',
      'PostCompact',
      'InstructionsLoaded',
    ];
    // Use a node one-liner to POST hook events — works cross-platform
    // (bash curl doesn't work on Windows, and type:"http" hooks may not be supported)
    const hookCmd = `node -e "const h=require('http');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=h.request({hostname:'127.0.0.1',port:${dashboardPort},path:'/api/hook-event',method:'POST',headers:{'Content-Type':'application/json','X-Group-Folder':'${group.folder}'}},()=>{});r.on('error',()=>{});r.end(d)})"`;
    for (const event of hookEvents) {
      const userHooks = mergedHooks[event] || [];
      mergedHooks[event] = [
        {
          hooks: [
            {
              type: 'command',
              command: hookCmd,
              timeout: 5,
            },
          ],
        },
        ...userHooks,
      ];
    }
  }

  const settings: Record<string, unknown> = {
    ...existing,
    env: mergedEnv,
    hooks: mergedHooks,
    permissions: existing.permissions || {
      allow: [
        'Bash(*)',
        'Read(*)',
        'Write(*)',
        'Edit(*)',
        'Glob(*)',
        'Grep(*)',
        'WebFetch(*)',
        'mcp__*',
      ],
      deny: [],
    },
  };
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');

  // Also write settings to the agent's working directory as project-level settings.
  // On Windows, Claude Code reads user settings from USERPROFILE (which we can't override
  // without breaking auth), so project-level settings at {cwd}/.claude/settings.json
  // are the reliable way to deliver hooks and permissions to the agent.
  const resolvedWorkDir =
    group.containerConfig?.workDir ||
    group.containerConfig?.additionalMounts?.[0]?.hostPath ||
    undefined;
  const cwdDir = resolvedWorkDir
    ? getOrCreateWorktree(group.folder, resolvedWorkDir)
    : groupDir;
  const projectClaudeDir = path.join(cwdDir, '.claude');
  const projectSettingsFile = path.join(projectClaudeDir, 'settings.json');
  if (cwdDir !== groupDir || projectSettingsFile !== settingsFile) {
    fs.mkdirSync(projectClaudeDir, { recursive: true });
    // Read existing project settings to preserve user keys
    let existingProject: Record<string, any> = {};
    try {
      existingProject = JSON.parse(
        fs.readFileSync(projectSettingsFile, 'utf-8'),
      );
    } catch {
      /* file missing or invalid */
    }
    const projectSettings = {
      ...existingProject,
      hooks: mergedHooks,
      permissions: settings.permissions,
    };
    fs.writeFileSync(
      projectSettingsFile,
      JSON.stringify(projectSettings, null, 2) + '\n',
    );
  }

  // Sync skills from container/skills/ into each group's .claude/skills/
  const skillsSrc = path.join(projectRoot, 'container', 'skills');
  const skillsDst = path.join(claudeDir, 'skills');
  if (fs.existsSync(skillsSrc)) {
    const srcDirs = new Set(
      fs
        .readdirSync(skillsSrc)
        .filter((d) => fs.statSync(path.join(skillsSrc, d)).isDirectory()),
    );
    if (fs.existsSync(skillsDst)) {
      for (const existing of fs.readdirSync(skillsDst)) {
        if (!srcDirs.has(existing)) {
          fs.rmSync(path.join(skillsDst, existing), {
            recursive: true,
            force: true,
          });
        }
      }
    }
    for (const skillDir of srcDirs) {
      fs.cpSync(
        path.join(skillsSrc, skillDir),
        path.join(skillsDst, skillDir),
        { recursive: true },
      );
    }
  }

  // Compose CLAUDE.md from manifest at every startup
  {
    const templatesDir = path.join(projectRoot, 'groups', 'templates');
    const claudeMd = path.join(groupDir, 'CLAUDE.md');
    const manifestName = isMain
      ? 'main'
      : group.coworkerType
        ? 'coworker'
        : null;

    if (
      manifestName &&
      fs.existsSync(
        path.join(templatesDir, 'manifests', `${manifestName}.yaml`),
      )
    ) {
      try {
        const composed = composeClaudeMd(
          templatesDir,
          manifestName,
          group,
          projectRoot,
        );
        fs.writeFileSync(claudeMd, composed);
        logger.debug(
          { folder: group.folder, manifest: manifestName },
          'Composed CLAUDE.md from manifest',
        );
      } catch (err) {
        logger.warn(
          { folder: group.folder, err },
          'Failed to compose CLAUDE.md from manifest',
        );
      }
    }
  }

  // Ensure IPC directories exist
  const groupIpcDir = resolveGroupIpcPath(group.folder);
  fs.mkdirSync(path.join(groupIpcDir, 'messages'), { recursive: true });
  fs.mkdirSync(path.join(groupIpcDir, 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(groupIpcDir, 'input'), { recursive: true });

  return { homeDir, claudeDir };
}

/**
 * Resolve which MCP tools a group is allowed to use.
 */
function resolveAllowedMcpTools(
  group: RegisteredGroup,
  isMain: boolean,
): string[] | undefined {
  if (group.allowedMcpTools && group.allowedMcpTools.length > 0) {
    return group.allowedMcpTools;
  }

  if (group.coworkerType) {
    try {
      const typesPath = path.join(
        process.cwd(),
        'groups',
        'coworker-types.json',
      );
      const types = JSON.parse(fs.readFileSync(typesPath, 'utf-8'));
      const entry = types[group.coworkerType];
      if (entry?.allowedMcpTools) {
        return entry.allowedMcpTools;
      }
    } catch {
      /* coworker-types.json missing or invalid */
    }
  }

  const raw = process.env.DEFAULT_MCP_TOOLS || '';
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Build environment variables for the agent runner process.
 * Replaces Docker volume mounts and -e flags.
 */
async function buildAgentEnv(
  group: RegisteredGroup,
  input: ContainerInput,
  homeDir: string,
): Promise<{ env: Record<string, string>; mcpToken: string | null }> {
  const projectRoot = process.cwd();
  const groupDir = resolveGroupFolderPath(group.folder);
  const groupIpcDir = resolveGroupIpcPath(group.folder);
  const globalDir = path.join(GROUPS_DIR, 'global');

  // Build worktree path for the agent's working directory.
  // When the group has a workDir (external repo), create the worktree from
  // that repo so each agent gets an isolated copy of the target codebase.
  // Fallback: if no workDir but additionalMounts exist, use the first mount's
  // hostPath as the source repo (handles orchestrator using the old Docker pattern).
  const workDir =
    group.containerConfig?.workDir ||
    group.containerConfig?.additionalMounts?.[0]?.hostPath ||
    undefined;
  const sourceRepo = workDir || projectRoot;
  const worktreePath = getOrCreateWorktree(group.folder, sourceRepo);

  const env: Record<string, string> = {
    // Inherit host environment so credentials and PATH are available
    ...Object.fromEntries(
      Object.entries(process.env).filter(([, v]) => v !== undefined) as [
        string,
        string,
      ][],
    ),

    // Workspace paths (replace Docker volume mounts)
    WORKSPACE_GROUP: groupDir,
    WORKSPACE_IPC: groupIpcDir,
    WORKSPACE_GLOBAL: globalDir,
    WORKSPACE_WORKTREE: worktreePath,

    // Claude Code home dir for session data
    // NOTE: Do NOT override USERPROFILE — Claude Code uses it for auth/login credentials
    HOME: homeDir,

    // Nanoclaw context
    NANOCLAW_GROUP_FOLDER: group.folder,
    NANOCLAW_HOST_GATEWAY: AGENT_HOST_GATEWAY,
    TZ: TIMEZONE,

    // SDK settings
    CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
    CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: '1',
    CLAUDE_CODE_DISABLE_AUTO_MEMORY: '0',
    CLAUDE_CODE_AUTO_COMPACT_WINDOW: '165000',
  };

  // Dashboard
  const dashboardInstalled = fs.existsSync(
    path.join(projectRoot, 'dashboard', 'server.ts'),
  );
  if (dashboardInstalled) {
    const dashboardPort = process.env.DASHBOARD_PORT || '3737';
    env.DASHBOARD_URL = `http://${AGENT_HOST_GATEWAY}:${dashboardPort}`;
    env.NANOCLAW_DASHBOARD_PORT = dashboardPort;
  }

  // MCP proxy — agents reach it directly on localhost
  const mcpProxyPort = String(MCP_PROXY_PORT);
  env.MCP_PROXY_URL = `http://127.0.0.1:${mcpProxyPort}/mcp`;

  // Per-agent MCP token for tool-level ACL
  let mcpToken: string | null = null;
  const allowedMcpTools = input.allowedMcpTools || [];
  if (allowedMcpTools.length > 0) {
    mcpToken = registerContainerToken(group.folder, allowedMcpTools);
    env.MCP_PROXY_TOKEN = mcpToken;
  }

  // Passthrough model/SDK overrides
  const passthroughEnvVars = [
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_BASE_URL',
    'ANTHROPIC_DEFAULT_OPUS_MODEL',
    'ANTHROPIC_DEFAULT_SONNET_MODEL',
    'ANTHROPIC_DEFAULT_HAIKU_MODEL',
    'ANTHROPIC_MODEL',
    'ANTHROPIC_SMALL_FAST_MODEL',
    'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS',
  ];
  const passthroughFromFile = readEnvFile(passthroughEnvVars);
  for (const key of passthroughEnvVars) {
    const val = process.env[key] || passthroughFromFile[key];
    if (val) env[key] = val;
  }

  // GH_TOKEN placeholder so gh CLI doesn't refuse to start
  if (!env.GH_TOKEN) env.GH_TOKEN = 'placeholder';

  // Main group also gets access to the project root (read path)
  if (input.isMain) {
    env.WORKSPACE_PROJECT = projectRoot;
  }

  // Working directory override — when workDir (or additionalMounts fallback) is set,
  // the worktree was created from that repo, so point the agent at the worktree.
  if (workDir) {
    env.WORKSPACE_CWD = worktreePath;
  }

  // Additional mounts become extra directory paths passed as env JSON.
  if (group.containerConfig?.additionalMounts) {
    const validated = validateAdditionalMounts(
      group.containerConfig.additionalMounts,
      group.name,
      input.isMain,
    );
    if (validated.length > 0) {
      env.WORKSPACE_EXTRA_DIRS = JSON.stringify(
        validated.map((m) => ({
          name: path.basename(m.hostPath),
          path: m.hostPath,
        })),
      );
    }
  }

  return { env, mcpToken };
}

export async function runContainerAgent(
  group: RegisteredGroup,
  input: ContainerInput,
  onProcess: (proc: ChildProcess, containerName: string) => void,
  onOutput?: (output: ContainerOutput) => Promise<void>,
): Promise<ContainerOutput> {
  const startTime = Date.now();

  // Resolve MCP tool permissions
  if (!input.allowedMcpTools) {
    input.allowedMcpTools = resolveAllowedMcpTools(group, input.isMain);
  }
  input.mcpToolInventory = getDiscoveredToolInventory();

  const groupDir = resolveGroupFolderPath(group.folder);
  fs.mkdirSync(groupDir, { recursive: true });

  // Prepare workspace (settings, skills, CLAUDE.md, IPC dirs)
  const { homeDir } = prepareGroupWorkspace(group, input.isMain);

  // Ensure agent-runner is compiled
  ensureAgentRunnerBuilt();

  const agentRunnerIndexJs = path.join(
    process.cwd(),
    'container',
    'agent-runner',
    'dist',
    'index.js',
  );

  // Unique name for logging (replaces container name)
  const safeName = group.folder.replace(/[^a-zA-Z0-9-]/g, '-');
  const processName = `nanoclaw-${safeName}-${Date.now()}`;

  const { env: agentEnv, mcpToken } = await buildAgentEnv(
    group,
    input,
    homeDir,
  );

  logger.info(
    {
      group: group.name,
      processName,
      isMain: input.isMain,
      workspaceGroup: agentEnv.WORKSPACE_GROUP,
      workspaceIpc: agentEnv.WORKSPACE_IPC,
    },
    'Spawning agent process',
  );

  const logsDir = path.join(groupDir, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });

  return new Promise((resolve) => {
    const agentProcess = spawn('node', [agentRunnerIndexJs], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: agentEnv,
    });

    onProcess(agentProcess, processName);

    let stdout = '';
    let stderr = '';
    let stdoutTruncated = false;
    let stderrTruncated = false;

    // Write input JSON to agent's stdin
    agentProcess.stdin.write(JSON.stringify(input));
    agentProcess.stdin.end();

    // Streaming output: parse OUTPUT_START/END marker pairs as they arrive
    let parseBuffer = '';
    let newSessionId: string | undefined;
    let outputChain = Promise.resolve();

    agentProcess.stdout.on('data', (data) => {
      const chunk = data.toString();

      if (!stdoutTruncated) {
        const remaining = CONTAINER_MAX_OUTPUT_SIZE - stdout.length;
        if (chunk.length > remaining) {
          stdout += chunk.slice(0, remaining);
          stdoutTruncated = true;
          logger.warn(
            { group: group.name, size: stdout.length },
            'Agent stdout truncated due to size limit',
          );
        } else {
          stdout += chunk;
        }
      }

      if (onOutput) {
        parseBuffer += chunk;
        let startIdx: number;
        while ((startIdx = parseBuffer.indexOf(OUTPUT_START_MARKER)) !== -1) {
          const endIdx = parseBuffer.indexOf(OUTPUT_END_MARKER, startIdx);
          if (endIdx === -1) break;

          const jsonStr = parseBuffer
            .slice(startIdx + OUTPUT_START_MARKER.length, endIdx)
            .trim();
          parseBuffer = parseBuffer.slice(endIdx + OUTPUT_END_MARKER.length);

          try {
            const parsed: ContainerOutput = JSON.parse(jsonStr);
            if (parsed.newSessionId) {
              newSessionId = parsed.newSessionId;
            }
            hadStreamingOutput = true;
            resetTimeout();
            outputChain = outputChain
              .then(() => onOutput(parsed))
              .catch((err) => {
                logger.error(
                  { group: group.name, error: err },
                  'onOutput callback failed — continuing chain',
                );
              });
          } catch (err) {
            logger.warn(
              { group: group.name, error: err },
              'Failed to parse streamed output chunk',
            );
          }
        }
      }
    });

    agentProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      const lines = chunk.trim().split('\n');
      for (const line of lines) {
        if (line) logger.debug({ agent: group.folder }, line);
      }
      if (stderrTruncated) return;
      const remaining = CONTAINER_MAX_OUTPUT_SIZE - stderr.length;
      if (chunk.length > remaining) {
        stderr += chunk.slice(0, remaining);
        stderrTruncated = true;
        logger.warn(
          { group: group.name, size: stderr.length },
          'Agent stderr truncated due to size limit',
        );
      } else {
        stderr += chunk;
      }
    });

    let timedOut = false;
    let hadStreamingOutput = false;
    const configTimeout = group.containerConfig?.timeout || CONTAINER_TIMEOUT;
    const timeoutMs = Math.max(configTimeout, IDLE_TIMEOUT + 30_000);

    const killOnTimeout = () => {
      timedOut = true;
      logger.error(
        { group: group.name, processName },
        'Agent timeout, stopping gracefully',
      );
      agentProcess.kill('SIGTERM');
      // Force kill after 5s if still alive
      setTimeout(() => {
        if (!agentProcess.killed) agentProcess.kill('SIGKILL');
      }, 5000);
    };

    let timeout = setTimeout(killOnTimeout, timeoutMs);

    const absoluteMaxMs = Math.max(configTimeout * 3, 3_600_000);
    const absoluteTimeout = setTimeout(() => {
      logger.warn(
        { group: group.name, processName, absoluteMaxMs },
        'Agent hit absolute lifetime cap, killing',
      );
      killOnTimeout();
    }, absoluteMaxMs);

    const resetTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(killOnTimeout, timeoutMs);
    };

    agentProcess.on('close', (code) => {
      clearTimeout(timeout);
      clearTimeout(absoluteTimeout);
      if (mcpToken) revokeContainerToken(mcpToken);
      const duration = Date.now() - startTime;

      // Notify dashboard of session end
      if (fs.existsSync(path.join(process.cwd(), 'dashboard', 'server.ts'))) {
        const dashPort = process.env.DASHBOARD_PORT || '3737';
        const body = JSON.stringify({
          event: 'SessionEnd',
          session_id: input.sessionId || '',
          timestamp: new Date().toISOString(),
        });
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: parseInt(dashPort, 10),
            path: '/api/hook-event',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Group-Folder': group.folder,
              'Content-Length': Buffer.byteLength(body),
            },
          },
          () => {},
        );
        req.on('error', () => {});
        req.end(body);
      }

      if (timedOut) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const timeoutLog = path.join(logsDir, `agent-${ts}.log`);
        fs.writeFileSync(
          timeoutLog,
          [
            `=== Agent Run Log (TIMEOUT) ===`,
            `Timestamp: ${new Date().toISOString()}`,
            `Group: ${group.name}`,
            `Process: ${processName}`,
            `Duration: ${duration}ms`,
            `Exit Code: ${code}`,
            `Had Streaming Output: ${hadStreamingOutput}`,
          ].join('\n'),
        );

        if (hadStreamingOutput) {
          logger.info(
            { group: group.name, processName, duration, code },
            'Agent timed out after output (idle cleanup)',
          );
          outputChain
            .then(() => {
              resolve({
                status: 'success',
                result: null,
                newSessionId,
              });
            })
            .catch(() => {
              resolve({ status: 'success', result: null, newSessionId });
            });
          return;
        }

        logger.error(
          { group: group.name, processName, duration, code },
          'Agent timed out with no output',
        );
        resolve({
          status: 'error',
          result: null,
          error: `Agent timed out after ${configTimeout}ms`,
        });
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFile = path.join(logsDir, `agent-${timestamp}.log`);
      const isVerbose =
        process.env.LOG_LEVEL === 'debug' || process.env.LOG_LEVEL === 'trace';

      const logLines = [
        `=== Agent Run Log ===`,
        `Timestamp: ${new Date().toISOString()}`,
        `Group: ${group.name}`,
        `IsMain: ${input.isMain}`,
        `Duration: ${duration}ms`,
        `Exit Code: ${code}`,
        `Stdout Truncated: ${stdoutTruncated}`,
        `Stderr Truncated: ${stderrTruncated}`,
        ``,
      ];

      const isError = code !== 0;

      if (isVerbose || isError) {
        if (isVerbose) {
          logLines.push(`=== Input ===`, JSON.stringify(input, null, 2), ``);
        } else {
          logLines.push(
            `=== Input Summary ===`,
            `Prompt length: ${input.prompt.length} chars`,
            `Session ID: ${input.sessionId || 'new'}`,
            ``,
          );
        }
        logLines.push(
          `=== Stderr${stderrTruncated ? ' (TRUNCATED)' : ''} ===`,
          stderr,
          ``,
          `=== Stdout${stdoutTruncated ? ' (TRUNCATED)' : ''} ===`,
          stdout,
        );
      } else {
        logLines.push(
          `=== Input Summary ===`,
          `Prompt length: ${input.prompt.length} chars`,
          `Session ID: ${input.sessionId || 'new'}`,
          ``,
        );
      }

      fs.writeFileSync(logFile, logLines.join('\n'));
      logger.debug({ logFile, verbose: isVerbose }, 'Agent log written');

      if (code !== 0) {
        logger.error(
          { group: group.name, code, duration, logFile },
          'Agent exited with error',
        );
        resolve({
          status: 'error',
          result: null,
          error: `Agent exited with code ${code}: ${stderr.slice(-200)}`,
        });
        return;
      }

      if (onOutput) {
        outputChain
          .then(() => {
            logger.info(
              { group: group.name, duration, newSessionId },
              'Agent completed (streaming mode)',
            );
            resolve({ status: 'success', result: null, newSessionId });
          })
          .catch(() => {
            resolve({ status: 'success', result: null, newSessionId });
          });
        return;
      }

      // Legacy mode: parse last output marker from accumulated stdout
      try {
        const startIdx = stdout.indexOf(OUTPUT_START_MARKER);
        const endIdx = stdout.indexOf(OUTPUT_END_MARKER);

        let jsonLine: string;
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          jsonLine = stdout
            .slice(startIdx + OUTPUT_START_MARKER.length, endIdx)
            .trim();
        } else {
          const lines = stdout.trim().split('\n');
          jsonLine = lines[lines.length - 1];
        }

        const output: ContainerOutput = JSON.parse(jsonLine);

        logger.info(
          {
            group: group.name,
            duration,
            status: output.status,
            hasResult: !!output.result,
          },
          'Agent completed',
        );
        resolve(output);
      } catch {
        logger.warn(
          { group: group.name, duration, stdout: stdout.slice(-500) },
          'Failed to parse agent output',
        );
        resolve({
          status: 'error',
          result: null,
          error: 'Failed to parse agent output',
        });
      }
    });
  });
}

export function writeTasksSnapshot(
  groupFolder: string,
  isMain: boolean,
  tasks: Array<{
    id: string;
    groupFolder: string;
    prompt: string;
    script?: string | null;
    schedule_type: string;
    schedule_value: string;
    status: string;
    next_run: string | null;
  }>,
): void {
  const groupIpcDir = resolveGroupIpcPath(groupFolder);
  fs.mkdirSync(groupIpcDir, { recursive: true });

  const filteredTasks = isMain
    ? tasks
    : tasks.filter((t) => t.groupFolder === groupFolder);

  const tasksFile = path.join(groupIpcDir, 'current_tasks.json');
  fs.writeFileSync(tasksFile, JSON.stringify(filteredTasks, null, 2));
}

export interface AvailableGroup {
  jid: string;
  name: string;
  lastActivity: string;
  isRegistered: boolean;
}

export function writeGroupsSnapshot(
  groupFolder: string,
  isMain: boolean,
  groups: AvailableGroup[],
  _registeredJids: Set<string>,
): void {
  const groupIpcDir = resolveGroupIpcPath(groupFolder);
  fs.mkdirSync(groupIpcDir, { recursive: true });

  const visibleGroups = isMain ? groups : [];

  const groupsFile = path.join(groupIpcDir, 'available_groups.json');
  fs.writeFileSync(
    groupsFile,
    JSON.stringify(
      {
        groups: visibleGroups,
        lastSync: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}
