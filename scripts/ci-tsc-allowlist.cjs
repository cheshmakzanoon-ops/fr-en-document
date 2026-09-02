#!/usr/bin/env node
/**
 * CI gate: run `tsc --noEmit` in the packages that ship type errors, and fail
 * only on errors OUTSIDE the known pre-existing upstream allowlist.
 *
 * Known errors (Prisma model drift from upstream changes, pre-dating every
 * NorthSign phase — see DECISIONS.md D-028):
 * - packages/lib/server-only/field/get-completed-fields-for-document.ts
 * - packages/lib/server-only/subscription/get-active-subscriptions-by-user-id.ts
 * - packages/lib/server-only/team/find-organisation-invoices.ts
 *
 * The repo has no root tsconfig.json, so typechecking happens per package.
 * apps/remix typechecks via `react-router typegen && tsc` (clean as of
 * Phase 5.5); packages/lib carries the three allowlisted drift files.
 *
 * Usage: node scripts/ci-tsc-allowlist.cjs
 */

const { execSync } = require('node:child_process');

const ALLOWLIST = [
  // Paths as tsc prints them (relative to the package's working directory).
  'server-only/field/get-completed-fields-for-document.ts',
  'server-only/subscription/get-active-subscriptions-by-user-id.ts',
  'server-only/team/find-organisation-invoices.ts',
];

const parseTsc = (stdout) => {
  const lines = stdout.split('\n');

  const errors = [];

  for (const line of lines) {
    const match = /^([^(]+)\((\d+),(\d+)\): error TS\d+: (.+)$/.exec(line);

    if (!match) {
      continue;
    }

    const [, file, lineNo, col, message] = match;

    errors.push({ file, line: Number(lineNo), column: Number(col), message });
  }

  return errors;
};

const runTypechecks = () => {
  // Per-package typechecks. Each entry: [working directory, command].
  const commands = [['packages/lib', 'npx tsc --noEmit']];

  let stdout = '';

  for (const [cwd, command] of commands) {
    try {
      const result = execSync(command, {
        encoding: 'utf8',
        cwd,
        maxBuffer: 256 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      if (result) {
        stdout += result;
      }
    } catch (err) {
      stdout += String(err?.stdout ?? '');

      if (!err?.stdout) {
        console.error(`Failed to run typecheck "${command}" in ${cwd} and no output captured.`);
        process.exit(1);
      }
    }
  }

  return stdout;
};

const main = () => {
  const stdout = runTypechecks();

  const errors = parseTsc(stdout);

  const unknownErrors = errors.filter((error) => !ALLOWLIST.some((allowed) => error.file.trim().endsWith(allowed)));

  console.log(
    `tsc --noEmit: ${errors.length} error(s) total; ${errors.length - unknownErrors.length} known upstream (allowlisted), ${unknownErrors.length} actionable.`,
  );

  if (unknownErrors.length === 0) {
    console.log('OK: no new TypeScript errors.');
    return;
  }

  console.error('FAIL: new TypeScript errors outside the known-errors allowlist:');
  for (const error of unknownErrors) {
    console.error(`  - ${error.file}:${error.line}:${error.column}: ${error.message}`);
  }
  process.exit(1);
};

main();
