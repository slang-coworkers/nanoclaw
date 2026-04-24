import fs from 'fs';
import path from 'path';

import { CronExpressionParser } from 'cron-parser';
import yaml from 'js-yaml';

import { DATA_DIR, IPC_POLL_INTERVAL, TIMEZONE } from './config.js';
import { AvailableGroup } from './container-runner.js';
import {
  createTask,
  deleteTask,
  getTaskById,
  storeMessage,
  updateTask,
} from './db.js';
import { isValidGroupFolder } from './group-folder.js';
import { logger } from './logger.js';
import { RegisteredGroup } from './types.js';

export interface IpcDeps {
  sendMessage: (jid: string, text: string) => Promise<void>;
  registeredGroups: () => Record<string, RegisteredGroup>;
  registerGroup: (jid: string, group: RegisteredGroup) => void;
  syncGroups: (force: boolean) => Promise<void>;
  getAvailableGroups: () => AvailableGroup[];
  writeGroupsSnapshot: (
    groupFolder: string,
    isMain: boolean,
    availableGroups: AvailableGroup[],
    registeredJids: Set<string>,
  ) => void;
  onTasksChanged: () => void;
  spawnInteractive?: (jid: string) => Promise<boolean>;
}

let ipcWatcherRunning = false;

export function startIpcWatcher(deps: IpcDeps): void {
  if (ipcWatcherRunning) {
    logger.debug('IPC watcher already running, skipping duplicate start');
    return;
  }
  ipcWatcherRunning = true;

  const ipcBaseDir = path.join(DATA_DIR, 'ipc');
  fs.mkdirSync(ipcBaseDir, { recursive: true });

  const processIpcFiles = async () => {
    // Scan all group IPC directories (identity determined by directory)
    let groupFolders: string[];
    try {
      groupFolders = fs.readdirSync(ipcBaseDir).filter((f) => {
        const stat = fs.statSync(path.join(ipcBaseDir, f));
        return stat.isDirectory() && f !== 'errors';
      });
    } catch (err) {
      logger.error({ err }, 'Error reading IPC base directory');
      setTimeout(processIpcFiles, IPC_POLL_INTERVAL);
      return;
    }

    const registeredGroups = deps.registeredGroups();

    // Build folder→isMain lookup from registered groups
    const folderIsMain = new Map<string, boolean>();
    for (const group of Object.values(registeredGroups)) {
      if (group.isMain) folderIsMain.set(group.folder, true);
    }

    for (const sourceGroup of groupFolders) {
      const isMain = folderIsMain.get(sourceGroup) === true;
      const messagesDir = path.join(ipcBaseDir, sourceGroup, 'messages');
      const tasksDir = path.join(ipcBaseDir, sourceGroup, 'tasks');

      // Process messages from this group's IPC directory
      try {
        if (fs.existsSync(messagesDir)) {
          const messageFiles = fs
            .readdirSync(messagesDir)
            .filter((f) => f.endsWith('.json'));
          for (const file of messageFiles) {
            const filePath = path.join(messagesDir, file);
            try {
              const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
              if (data.type === 'message' && data.chatJid && data.text) {
                // Authorization: verify this group can send to this chatJid
                const targetGroup = registeredGroups[data.chatJid];
                if (
                  isMain ||
                  (targetGroup && targetGroup.folder === sourceGroup)
                ) {
                  await deps.sendMessage(data.chatJid, data.text);
                  // Store IPC reply in DB so dashboard can display it
                  storeMessage({
                    id: `ipc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    chat_jid: data.chatJid,
                    sender: data.sender || 'assistant',
                    sender_name: data.sender || sourceGroup,
                    content: data.text,
                    timestamp: new Date().toISOString(),
                    is_from_me: true,
                    is_bot_message: true,
                  });
                  logger.info(
                    { chatJid: data.chatJid, sourceGroup, sender: data.sender },
                    'IPC message sent',
                  );
                } else {
                  logger.warn(
                    { chatJid: data.chatJid, sourceGroup },
                    'Unauthorized IPC message attempt blocked',
                  );
                }
              }
              fs.unlinkSync(filePath);
            } catch (err) {
              logger.error(
                { file, sourceGroup, err },
                'Error processing IPC message',
              );
              const errorDir = path.join(ipcBaseDir, 'errors');
              fs.mkdirSync(errorDir, { recursive: true });
              fs.renameSync(
                filePath,
                path.join(errorDir, `${sourceGroup}-${file}`),
              );
            }
          }
        }
      } catch (err) {
        logger.error(
          { err, sourceGroup },
          'Error reading IPC messages directory',
        );
      }

      // Process tasks from this group's IPC directory
      try {
        if (fs.existsSync(tasksDir)) {
          const taskFiles = fs
            .readdirSync(tasksDir)
            .filter((f) => f.endsWith('.json'));
          for (const file of taskFiles) {
            const filePath = path.join(tasksDir, file);
            try {
              const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
              // Pass source group identity to processTaskIpc for authorization
              await processTaskIpc(data, sourceGroup, isMain, deps);
              fs.unlinkSync(filePath);
            } catch (err) {
              logger.error(
                { file, sourceGroup, err },
                'Error processing IPC task',
              );
              const errorDir = path.join(ipcBaseDir, 'errors');
              fs.mkdirSync(errorDir, { recursive: true });
              fs.renameSync(
                filePath,
                path.join(errorDir, `${sourceGroup}-${file}`),
              );
            }
          }
        }
      } catch (err) {
        logger.error({ err, sourceGroup }, 'Error reading IPC tasks directory');
      }

      // Process control files (e.g. spawn-interactive requests from dashboard)
      const controlDir = path.join(ipcBaseDir, sourceGroup, 'control');
      try {
        if (fs.existsSync(controlDir)) {
          const controlFiles = fs
            .readdirSync(controlDir)
            .filter((f) => f.endsWith('.json'));
          for (const file of controlFiles) {
            const filePath = path.join(controlDir, file);
            try {
              const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
              fs.unlinkSync(filePath);
              if (data.type === 'spawn_interactive' && deps.spawnInteractive) {
                const entry = Object.entries(registeredGroups).find(
                  ([, g]) => g.folder === sourceGroup,
                );
                if (entry) {
                  const [jid] = entry;
                  logger.info(
                    { sourceGroup, jid },
                    'Interactive spawn requested via IPC control',
                  );
                  deps
                    .spawnInteractive(jid)
                    .catch((err) =>
                      logger.error(
                        { sourceGroup, err },
                        'Failed to spawn interactive container',
                      ),
                    );
                }
              }
            } catch (err) {
              logger.error(
                { file, sourceGroup, err },
                'Error processing IPC control file',
              );
              try {
                fs.unlinkSync(filePath);
              } catch {
                /* ignore */
              }
            }
          }
        }
      } catch {
        /* control dir doesn't exist yet — that's fine */
      }
    }

    setTimeout(processIpcFiles, IPC_POLL_INTERVAL);
  };

  processIpcFiles();
  logger.info('IPC watcher started (per-group namespaces)');
}

export async function processTaskIpc(
  data: {
    type: string;
    taskId?: string;
    prompt?: string;
    schedule_type?: string;
    schedule_value?: string;
    context_mode?: string;
    script?: string;
    groupFolder?: string;
    chatJid?: string;
    targetJid?: string;
    // For register_group
    jid?: string;
    name?: string;
    folder?: string;
    trigger?: string;
    requiresTrigger?: boolean;
    containerConfig?: RegisteredGroup['containerConfig'];
    repo?: string; // Named repo from groups/seed.json "repos" map → resolves to workDir
    coworkerType?: string;
    claudeMdAppend?: string;
    allowedMcpTools?: string[];
    // For append_learning
    content?: string;
  },
  sourceGroup: string, // Verified identity from IPC directory
  isMain: boolean, // Verified from directory path
  deps: IpcDeps,
): Promise<void> {
  const registeredGroups = deps.registeredGroups();

  switch (data.type) {
    case 'schedule_task':
      if (
        data.prompt &&
        data.schedule_type &&
        data.schedule_value &&
        data.targetJid
      ) {
        // Resolve the target group from JID
        const targetJid = data.targetJid as string;
        const targetGroupEntry = registeredGroups[targetJid];

        if (!targetGroupEntry) {
          logger.warn(
            { targetJid },
            'Cannot schedule task: target group not registered',
          );
          break;
        }

        const targetFolder = targetGroupEntry.folder;

        // Authorization: non-main groups can only schedule for themselves
        if (!isMain && targetFolder !== sourceGroup) {
          logger.warn(
            { sourceGroup, targetFolder },
            'Unauthorized schedule_task attempt blocked',
          );
          break;
        }

        const scheduleType = data.schedule_type as 'cron' | 'interval' | 'once';

        let nextRun: string | null = null;
        if (scheduleType === 'cron') {
          try {
            const interval = CronExpressionParser.parse(data.schedule_value, {
              tz: TIMEZONE,
            });
            nextRun = interval.next().toISOString();
          } catch {
            logger.warn(
              { scheduleValue: data.schedule_value },
              'Invalid cron expression',
            );
            break;
          }
        } else if (scheduleType === 'interval') {
          const ms = parseInt(data.schedule_value, 10);
          if (isNaN(ms) || ms <= 0) {
            logger.warn(
              { scheduleValue: data.schedule_value },
              'Invalid interval',
            );
            break;
          }
          nextRun = new Date(Date.now() + ms).toISOString();
        } else if (scheduleType === 'once') {
          const date = new Date(data.schedule_value);
          if (isNaN(date.getTime())) {
            logger.warn(
              { scheduleValue: data.schedule_value },
              'Invalid timestamp',
            );
            break;
          }
          nextRun = date.toISOString();
        }

        const taskId =
          data.taskId ||
          `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const contextMode =
          data.context_mode === 'group' || data.context_mode === 'isolated'
            ? data.context_mode
            : 'isolated';
        createTask({
          id: taskId,
          group_folder: targetFolder,
          chat_jid: targetJid,
          prompt: data.prompt,
          script: data.script || null,
          schedule_type: scheduleType,
          schedule_value: data.schedule_value,
          context_mode: contextMode,
          next_run: nextRun,
          status: 'active',
          created_at: new Date().toISOString(),
        });
        logger.info(
          { taskId, sourceGroup, targetFolder, contextMode },
          'Task created via IPC',
        );
        deps.onTasksChanged();
      }
      break;

    case 'pause_task':
      if (data.taskId) {
        const task = getTaskById(data.taskId);
        if (task && (isMain || task.group_folder === sourceGroup)) {
          updateTask(data.taskId, { status: 'paused' });
          logger.info(
            { taskId: data.taskId, sourceGroup },
            'Task paused via IPC',
          );
          deps.onTasksChanged();
        } else {
          logger.warn(
            { taskId: data.taskId, sourceGroup },
            'Unauthorized task pause attempt',
          );
        }
      }
      break;

    case 'resume_task':
      if (data.taskId) {
        const task = getTaskById(data.taskId);
        if (task && (isMain || task.group_folder === sourceGroup)) {
          updateTask(data.taskId, { status: 'active' });
          logger.info(
            { taskId: data.taskId, sourceGroup },
            'Task resumed via IPC',
          );
          deps.onTasksChanged();
        } else {
          logger.warn(
            { taskId: data.taskId, sourceGroup },
            'Unauthorized task resume attempt',
          );
        }
      }
      break;

    case 'cancel_task':
      if (data.taskId) {
        const task = getTaskById(data.taskId);
        if (task && (isMain || task.group_folder === sourceGroup)) {
          deleteTask(data.taskId);
          logger.info(
            { taskId: data.taskId, sourceGroup },
            'Task cancelled via IPC',
          );
          deps.onTasksChanged();
        } else {
          logger.warn(
            { taskId: data.taskId, sourceGroup },
            'Unauthorized task cancel attempt',
          );
        }
      }
      break;

    case 'update_task':
      if (data.taskId) {
        const task = getTaskById(data.taskId);
        if (!task) {
          logger.warn(
            { taskId: data.taskId, sourceGroup },
            'Task not found for update',
          );
          break;
        }
        if (!isMain && task.group_folder !== sourceGroup) {
          logger.warn(
            { taskId: data.taskId, sourceGroup },
            'Unauthorized task update attempt',
          );
          break;
        }

        const updates: Parameters<typeof updateTask>[1] = {};
        if (data.prompt !== undefined) updates.prompt = data.prompt;
        if (data.script !== undefined) updates.script = data.script || null;
        if (data.schedule_type !== undefined)
          updates.schedule_type = data.schedule_type as
            | 'cron'
            | 'interval'
            | 'once';
        if (data.schedule_value !== undefined)
          updates.schedule_value = data.schedule_value;

        // Recompute next_run if schedule changed
        if (data.schedule_type || data.schedule_value) {
          const updatedTask = {
            ...task,
            ...updates,
          };
          if (updatedTask.schedule_type === 'cron') {
            try {
              const interval = CronExpressionParser.parse(
                updatedTask.schedule_value,
                { tz: TIMEZONE },
              );
              updates.next_run = interval.next().toISOString();
            } catch {
              logger.warn(
                { taskId: data.taskId, value: updatedTask.schedule_value },
                'Invalid cron in task update',
              );
              break;
            }
          } else if (updatedTask.schedule_type === 'interval') {
            const ms = parseInt(updatedTask.schedule_value, 10);
            if (!isNaN(ms) && ms > 0) {
              updates.next_run = new Date(Date.now() + ms).toISOString();
            }
          }
        }

        updateTask(data.taskId, updates);
        logger.info(
          { taskId: data.taskId, sourceGroup, updates },
          'Task updated via IPC',
        );
        deps.onTasksChanged();
      }
      break;

    case 'refresh_groups':
      // Only main group can request a refresh
      if (isMain) {
        logger.info(
          { sourceGroup },
          'Group metadata refresh requested via IPC',
        );
        await deps.syncGroups(true);
        // Write updated snapshot immediately
        const availableGroups = deps.getAvailableGroups();
        deps.writeGroupsSnapshot(
          sourceGroup,
          true,
          availableGroups,
          new Set(Object.keys(registeredGroups)),
        );
      } else {
        logger.warn(
          { sourceGroup },
          'Unauthorized refresh_groups attempt blocked',
        );
      }
      break;

    case 'register_group': {
      // Only main group can register new groups
      if (!isMain) {
        logger.warn(
          { sourceGroup },
          'Unauthorized register_group attempt blocked',
        );
        break;
      }
      if (data.jid && data.name && data.folder && data.trigger) {
        if (!isValidGroupFolder(data.folder)) {
          logger.warn(
            { sourceGroup, folder: data.folder },
            'Invalid register_group request - unsafe folder name',
          );
          break;
        }

        // Resolve workDir from seed.json repos.
        // Priority: explicit repo field → additionalMounts match → nothing.
        let containerConfig = data.containerConfig;
        if (!containerConfig?.workDir) {
          let resolvedWorkDir: string | undefined;
          try {
            const seedPath = path.join(process.cwd(), 'groups', 'seed.json');
            const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
            const repos: Record<string, string> = seed.repos || {};

            if (data.repo) {
              // Explicit repo name
              resolvedWorkDir = repos[data.repo];
              if (!resolvedWorkDir) {
                logger.warn(
                  { repo: data.repo },
                  'Unknown repo name in register_group',
                );
              }
            }

            // Fallback: if orchestrator used additionalMounts with made-up paths,
            // try to match them against known repos by checking if any repo name
            // appears in the mount paths (e.g. "D:\corvk-bloom5" matches "corvk").
            if (!resolvedWorkDir && containerConfig?.additionalMounts?.length) {
              for (const [repoName, repoPath] of Object.entries(repos)) {
                const mountsMatchRepo =
                  containerConfig.additionalMounts.some(
                    (m: any) =>
                      m.hostPath &&
                      (path.basename(m.hostPath)
                        .toLowerCase()
                        .includes(repoName.toLowerCase()) ||
                        m.containerPath === repoName),
                  );
                if (mountsMatchRepo) {
                  resolvedWorkDir = repoPath;
                  logger.info(
                    { repoName, workDir: repoPath },
                    'Auto-resolved workDir from additionalMounts matching repo name',
                  );
                  break;
                }
              }
            }
          } catch {
            logger.warn('Failed to read groups/seed.json for repo resolution');
          }

          if (resolvedWorkDir) {
            containerConfig = { ...containerConfig, workDir: resolvedWorkDir };
            logger.info(
              { workDir: resolvedWorkDir },
              'Resolved workDir for new group',
            );
          }
        }

        // Extract coworkerType from data or nested containerConfig.
        // If claudeMdAppend is also set, force coworkerType to null —
        // they conflict (coworkerType rebuilds CLAUDE.md on every startup,
        // destroying the appended content).
        const coworkerType = data.claudeMdAppend
          ? undefined
          : data.coworkerType || (containerConfig as any)?.coworkerType;
        // Remove coworkerType from containerConfig if it was nested there
        if (containerConfig && (containerConfig as any).coworkerType) {
          const { coworkerType: _, ...rest } = containerConfig as any;
          containerConfig = Object.keys(rest).length ? rest : undefined;
        }

        // Coworkers manage their own project repos inside the container
        // via skill-provided build instructions. No host mounts needed.

        // Auto-resolve allowedMcpTools from coworker-types.json if not explicitly provided
        let resolvedMcpTools = data.allowedMcpTools;
        if (!resolvedMcpTools && coworkerType) {
          try {
            const typesPath = path.join(
              process.cwd(),
              'groups',
              'coworker-types.json',
            );
            const types = JSON.parse(fs.readFileSync(typesPath, 'utf-8'));
            if (types[coworkerType]?.allowedMcpTools) {
              resolvedMcpTools = types[coworkerType].allowedMcpTools;
            }
          } catch {
            /* coworker-types.json missing */
          }
        }

        // Defense in depth: agent cannot set isMain via IPC.
        // Preserve isMain from the existing registration so IPC config
        // updates (e.g. adding additionalMounts) don't strip the flag.
        const existingGroup = registeredGroups[data.jid];
        deps.registerGroup(data.jid, {
          name: data.name,
          folder: data.folder,
          trigger: data.trigger,
          added_at: new Date().toISOString(),
          containerConfig,
          requiresTrigger: data.requiresTrigger ?? false,
          isMain: existingGroup?.isMain,
          coworkerType: coworkerType || undefined,
          allowedMcpTools: resolvedMcpTools || undefined,
        });

        // Create group folder and compose CLAUDE.md from manifest
        const projectRoot = process.cwd();
        const groupDir = path.join(projectRoot, 'groups', data.folder);
        fs.mkdirSync(groupDir, { recursive: true });
        const claudeMd = path.join(groupDir, 'CLAUDE.md');
        if (!fs.existsSync(claudeMd)) {
          const templatesDir = path.join(projectRoot, 'groups', 'templates');
          const manifestPath = path.join(
            templatesDir,
            'manifests',
            'coworker.yaml',
          );
          if (fs.existsSync(manifestPath)) {
            try {
              const manifest = yaml.load(
                fs.readFileSync(manifestPath, 'utf-8'),
              ) as any;
              const basePath = path.join(
                projectRoot,
                'groups',
                'global',
                'CLAUDE.md',
              );
              let composed = fs.existsSync(basePath)
                ? fs.readFileSync(basePath, 'utf-8')
                : '';
              for (const section of manifest.sections || []) {
                const sPath = path.join(
                  templatesDir,
                  'sections',
                  `${section}.md`,
                );
                if (fs.existsSync(sPath)) {
                  composed += `\n\n---\n\n${fs.readFileSync(sPath, 'utf-8')}`;
                }
              }
              if (manifest.project_overlays) {
                const projDir = path.join(templatesDir, 'projects');
                if (fs.existsSync(projDir)) {
                  for (const proj of fs.readdirSync(projDir).sort()) {
                    const f = path.join(projDir, proj, 'coworker-base.md');
                    if (fs.existsSync(f))
                      composed += `\n\n---\n\n${fs.readFileSync(f, 'utf-8')}`;
                  }
                }
              }
              if (data.claudeMdAppend)
                composed += `\n\n---\n\n${data.claudeMdAppend}`;
              fs.writeFileSync(claudeMd, composed);
              logger.info(
                { folder: data.folder },
                'Composed CLAUDE.md from coworker manifest',
              );
            } catch (err) {
              logger.warn(
                { folder: data.folder, err },
                'Manifest composition failed, falling back',
              );
              const globalMd = path.join(
                projectRoot,
                'groups',
                'global',
                'CLAUDE.md',
              );
              if (fs.existsSync(globalMd)) fs.copyFileSync(globalMd, claudeMd);
              if (data.claudeMdAppend)
                fs.appendFileSync(
                  claudeMd,
                  `\n\n---\n\n${data.claudeMdAppend}`,
                );
            }
          } else {
            const globalMd = path.join(
              projectRoot,
              'groups',
              'global',
              'CLAUDE.md',
            );
            if (fs.existsSync(globalMd)) fs.copyFileSync(globalMd, claudeMd);
            if (data.claudeMdAppend)
              fs.appendFileSync(claudeMd, `\n\n---\n\n${data.claudeMdAppend}`);
          }
        } else if (data.claudeMdAppend) {
          fs.appendFileSync(claudeMd, `\n\n---\n\n${data.claudeMdAppend}`);
          logger.info(
            { folder: data.folder },
            'Appended custom content to existing CLAUDE.md',
          );
        }
      } else {
        logger.warn(
          { data },
          'Invalid register_group request - missing required fields',
        );
      }
      break;
    }

    case 'append_learning': {
      if (!data.content) {
        logger.warn({ sourceGroup }, 'Missing content in append_learning IPC');
        break;
      }
      const learningsDir = path.join(
        process.cwd(),
        'groups',
        'global',
        'learnings',
      );
      fs.mkdirSync(learningsDir, { recursive: true });
      const filename = `${sourceGroup}-${Date.now()}.md`;
      fs.writeFileSync(path.join(learningsDir, filename), data.content);

      // Maintain INDEX.md so agents can scan learnings without reading every file
      const title =
        data.content.match(/^#\s+(.+)$/m)?.[1] || 'Untitled learning';
      const indexLine = `- [${title}](${filename}) — from ${sourceGroup} (${new Date().toISOString().split('T')[0]})\n`;
      fs.appendFileSync(path.join(learningsDir, 'INDEX.md'), indexLine);

      logger.info(
        { sourceGroup, filename },
        'Learning appended to global via IPC',
      );
      break;
    }

    default:
      logger.warn({ type: data.type }, 'Unknown IPC task type');
  }
}
