#!/usr/bin/env npx tsx
/**
 * migrate-v1-to-v2.ts — Export NanoClaw v1 coworkers as v2 YAML import bundles.
 *
 * Reads a v1 installation directory (store/messages.db + groups/) and produces
 * v2-compatible YAML bundles (one per registered coworker group), ready to
 * POST to v2's /api/coworkers/import or drop into the coworkers/ directory
 * for /onboard-coworker.
 *
 * ## How to run
 *
 *   # Export from a v1 install:
 *   npx tsx scripts/migrate-v1-to-v2.ts \
 *     --v1-dir /home/ubuntu/jkiviluoto/nanoclaw \
 *     --out-dir /tmp/v1-export-janne
 *
 *   # Copy YAMLs to coworkers/ for /onboard-coworker skill:
 *   cp /tmp/v1-export-janne/*.yaml coworkers/  # (skip scheduled-tasks.yaml)
 *
 *   # Or import directly via API:
 *   for f in /tmp/v1-export-janne/*.yaml; do
 *     [ "$(basename "$f")" = "scheduled-tasks.yaml" ] && continue
 *     curl -X POST http://localhost:3838/api/coworkers/import \
 *       -H 'Content-Type: text/yaml' --data-binary @"$f"
 *   done
 *
 * ## Output
 *
 *   {out-dir}/{folder}.yaml       — per-group v3 import bundles
 *   {out-dir}/coworker-types.json  — copied type registry (merge into groups/)
 *   {out-dir}/templates/           — copied template directory (merge into groups/templates/)
 *   {out-dir}/slang-templates/     — container skill templates (merge into container/skills/slang-templates/templates/)
 *   {out-dir}/scheduled-tasks.yaml — summary of cron tasks to recreate manually
 *   {out-dir}/MIGRATION-SUMMARY.md — human-readable migration summary
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

import { extractLegacyCustomInstructions, recomposeLegacyTemplate } from '../src/v1-migration.js';

// --- Args ---
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const v1Dir = getArg('v1-dir');
const outDir = getArg('out-dir');

if (!v1Dir || !outDir) {
  console.error('Usage: npx tsx scripts/migrate-v1-to-v2.ts --v1-dir <path> --out-dir <path>');
  process.exit(1);
}

if (!fs.existsSync(v1Dir)) {
  console.error(`v1 directory not found: ${v1Dir}`);
  process.exit(1);
}

// --- Helpers ---
function readFileOr(filePath: string, fallback: string | null = null): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return fallback;
  }
}

function readMemoryFiles(memDir: string): Record<string, string> | null {
  if (!fs.existsSync(memDir)) return null;
  const memory: Record<string, string> = {};
  for (const file of fs.readdirSync(memDir)) {
    if (!file.endsWith('.md')) continue;
    const content = readFileOr(path.join(memDir, file));
    if (content) memory[file] = content;
  }
  return Object.keys(memory).length > 0 ? memory : null;
}

function copyDirRecursive(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function yamlEscape(s: string): string {
  // Simple YAML block scalar for multiline strings
  if (s.includes('\n')) return `|\n${s.split('\n').map((l) => `  ${l}`).join('\n')}`;
  if (/[:#{}[\],&*?|>!'"%@`]/.test(s) || s.trim() !== s) return JSON.stringify(s);
  return s;
}

function toYaml(obj: Record<string, unknown>, indent = 0): string {
  const pad = '  '.repeat(indent);
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      lines.push(`${pad}${key}: null`);
    } else if (typeof value === 'string') {
      if (value.includes('\n')) {
        lines.push(`${pad}${key}: |`);
        for (const line of value.split('\n')) {
          lines.push(`${pad}  ${line}`);
        }
      } else {
        lines.push(`${pad}${key}: ${yamlEscape(value)}`);
      }
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${pad}${key}: ${value}`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${pad}${key}: []`);
      } else if (typeof value[0] === 'string') {
        lines.push(`${pad}${key}:`);
        for (const item of value) {
          lines.push(`${pad}  - ${yamlEscape(item as string)}`);
        }
      } else {
        lines.push(`${pad}${key}:`);
        for (const item of value) {
          const subLines = toYaml(item as Record<string, unknown>, indent + 2).split('\n');
          lines.push(`${pad}  - ${subLines[0].trim()}`);
          for (const sl of subLines.slice(1)) {
            lines.push(`${pad}    ${sl.trim()}`);
          }
        }
      }
    } else if (typeof value === 'object') {
      lines.push(`${pad}${key}:`);
      lines.push(toYaml(value as Record<string, unknown>, indent + 1));
    }
  }

  return lines.join('\n');
}

// --- SKIP folders ---
const SKIP_FOLDERS = new Set(['main', 'global', 'new-group', 'templates']);

// --- Main ---
console.log(`Migrating v1 → v2`);
console.log(`  v1 dir: ${v1Dir}`);
console.log(`  output: ${outDir}`);
console.log('');

fs.mkdirSync(outDir, { recursive: true });

// Open v1 database
const dbPath = path.join(v1Dir, 'store', 'messages.db');
if (!fs.existsSync(dbPath)) {
  console.error(`v1 database not found: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

// Read registered groups
interface V1Group {
  folder: string;
  name: string;
  trigger_pattern: string;
  container_config: string | null;
  requires_trigger: number;
  is_main: number;
  coworker_type: string | null;
  allowed_mcp_tools: string | null;
  jid: string;
}

const groups = db.prepare(`
  SELECT folder, name, trigger_pattern, container_config, requires_trigger,
         is_main, coworker_type, allowed_mcp_tools, jid
  FROM registered_groups
`).all() as V1Group[];

console.log(`Found ${groups.length} registered groups`);

// Read scheduled tasks
interface V1Task {
  id: string;
  group_folder: string;
  chat_jid: string;
  prompt: string;
  schedule_type: string;
  schedule_value: string;
  status: string;
  created_at: string;
}

let tasks: V1Task[] = [];
try {
  tasks = db.prepare(`
    SELECT id, group_folder, chat_jid, prompt, schedule_type, schedule_value, status, created_at
    FROM scheduled_tasks WHERE status = 'active'
  `).all() as V1Task[];
} catch {
  console.log('No scheduled_tasks table found (or empty)');
}

db.close();

// Process each group
const exported: string[] = [];
const skipped: string[] = [];
const warnings: string[] = [];

for (const g of groups) {
  // Skip system groups
  if (SKIP_FOLDERS.has(g.folder) || g.is_main === 1) {
    skipped.push(`${g.folder} (${g.is_main ? 'isMain' : 'system'})`);
    continue;
  }

  const groupDir = path.join(v1Dir, 'groups', g.folder);
  if (!fs.existsSync(groupDir)) {
    warnings.push(`Group dir missing: ${groupDir}`);
    continue;
  }

  // Read memory
  const memory = readMemoryFiles(path.join(groupDir, 'memory'));

  // Read instructions: prefer .instructions.md, fall back to extracting
  // custom content from v1's composed CLAUDE.md.
  //
  // In v1, CLAUDE.md is auto-composed from templates (base + sections +
  // project overlays + role templates). Agents could also append content
  // directly. The custom/role-specific part is what v2 needs as
  // .instructions.md. We reconstruct the template portion and diff it
  // against the actual CLAUDE.md to extract just the custom additions.
  let instructions = readFileOr(path.join(groupDir, '.instructions.md'));
  if (!instructions) {
    const claudeMd = readFileOr(path.join(groupDir, 'CLAUDE.md'));
    if (claudeMd) {
      // Reconstruct what v1's composeClaudeMd() would have produced
      const templatesDir = path.join(v1Dir, 'groups', 'templates');
      const composed =
        fs.existsSync(templatesDir)
          ? recomposeLegacyTemplate(v1Dir, { isMain: g.is_main, coworkerType: g.coworker_type || null })
          : null;

      if (composed) {
        // Find the custom portion: everything in CLAUDE.md after the template
        const customContent = extractLegacyCustomInstructions(claudeMd, composed);
        if (customContent) {
          instructions = customContent;
          console.log(`    ${g.folder}: extracted ${customContent.split('\n').length} lines of custom instructions from CLAUDE.md`);
        } else {
          // No diff found — CLAUDE.md is identical to template
          console.log(`    ${g.folder}: CLAUDE.md matches template, no custom instructions`);
        }
      } else {
        // Couldn't reconstruct template — use full CLAUDE.md as fallback
        instructions = claudeMd;
        console.log(`    ${g.folder}: using full CLAUDE.md as instructions (template reconstruction failed)`);
      }
    }
  }

  // Parse containerConfig
  let containerConfig: Record<string, unknown> | null = null;
  if (g.container_config) {
    try {
      containerConfig = JSON.parse(g.container_config);
    } catch {
      warnings.push(`${g.folder}: invalid container_config JSON`);
    }
  }

  // Parse allowedMcpTools
  let allowedMcpTools: string[] | null = null;
  if (g.allowed_mcp_tools) {
    try {
      allowedMcpTools = JSON.parse(g.allowed_mcp_tools);
    } catch {
      warnings.push(`${g.folder}: invalid allowed_mcp_tools JSON`);
    }
  }

  // Build v3 YAML bundle
  const bundle: Record<string, unknown> = {
    version: 3,
    exportedAt: new Date().toISOString(),
    requires: g.coworker_type
      ? { coworkerTypes: [g.coworker_type] }
      : null,
    agent: {
      name: g.name,
      folder: g.folder,
      coworkerType: g.coworker_type || null,
      agentProvider: null,
      containerConfig,
      allowedMcpTools,
    },
    instructions: instructions || null,
    instructionTemplate: null,
    trigger: g.trigger_pattern || `@${g.name.replace(/\s+/g, '')}`,
    destinations: [],
    memory: memory || null,
  };

  const yaml = toYaml(bundle);
  const outPath = path.join(outDir, `${g.folder}.yaml`);
  fs.writeFileSync(outPath, yaml);
  exported.push(g.folder);
  console.log(`  Exported: ${g.folder} → ${outPath}`);
}

// Copy coworker-types.json
const typesPath = path.join(v1Dir, 'groups', 'coworker-types.json');
if (fs.existsSync(typesPath)) {
  fs.copyFileSync(typesPath, path.join(outDir, 'coworker-types.json'));
  console.log(`  Copied: coworker-types.json`);
}

// Copy templates/
const templatesDir = path.join(v1Dir, 'groups', 'templates');
if (fs.existsSync(templatesDir)) {
  copyDirRecursive(templatesDir, path.join(outDir, 'templates'));
  console.log(`  Copied: templates/`);
}

// Copy slang-templates
const slangTemplatesDir = path.join(v1Dir, 'container', 'skills', 'slang-templates', 'templates');
if (fs.existsSync(slangTemplatesDir)) {
  copyDirRecursive(slangTemplatesDir, path.join(outDir, 'slang-templates'));
  console.log(`  Copied: slang-templates/`);
}

// Export scheduled tasks
if (tasks.length > 0) {
  const taskLines: string[] = ['# Scheduled Tasks (manual recreation needed in v2)', ''];
  for (const t of tasks) {
    taskLines.push(`- group: ${t.group_folder}`);
    taskLines.push(`  schedule: ${t.schedule_type} ${t.schedule_value}`);
    taskLines.push(`  prompt: ${t.prompt.substring(0, 200)}${t.prompt.length > 200 ? '...' : ''}`);
    taskLines.push('');
  }
  fs.writeFileSync(path.join(outDir, 'scheduled-tasks.yaml'), taskLines.join('\n'));
  console.log(`  Exported: ${tasks.length} scheduled tasks`);
}

// Write summary
const summary = `# V1 → V2 Migration Summary

**Date:** ${new Date().toISOString()}
**Source:** ${v1Dir}
**Output:** ${outDir}

## Exported (${exported.length})
${exported.map((f) => `- ${f}`).join('\n')}

## Skipped (${skipped.length})
${skipped.map((f) => `- ${f}`).join('\n')}

## Warnings (${warnings.length})
${warnings.length > 0 ? warnings.map((w) => `- ${w}`).join('\n') : 'None'}

## Scheduled Tasks (${tasks.length})
${tasks.length > 0 ? tasks.map((t) => `- ${t.group_folder}: ${t.schedule_type} ${t.schedule_value}`).join('\n') : 'None'}

## Next Steps

1. Copy \`coworker-types.json\` to v2 \`groups/coworker-types.json\` (merge with existing)
2. Copy \`templates/\` to v2 \`groups/templates/\` (merge with existing)
3. Copy \`slang-templates/\` to v2 \`container/skills/slang-templates/templates/\` (merge with existing)
4. Import each YAML bundle:
   \`\`\`bash
   for f in ${outDir}/*.yaml; do
     [ "$(basename "$f")" = "scheduled-tasks.yaml" ] && continue
     curl -X POST http://localhost:3838/api/coworkers/import \\
       -H 'Content-Type: text/yaml' \\
       --data-binary @"$f"
     echo ""
   done
   \`\`\`
5. Manually recreate scheduled tasks in v2 (see scheduled-tasks.yaml)
6. Verify imported coworkers in dashboard
`;

fs.writeFileSync(path.join(outDir, 'MIGRATION-SUMMARY.md'), summary);

console.log('');
console.log(`Done! ${exported.length} groups exported, ${skipped.length} skipped, ${warnings.length} warnings`);
console.log(`Summary: ${path.join(outDir, 'MIGRATION-SUMMARY.md')}`);
