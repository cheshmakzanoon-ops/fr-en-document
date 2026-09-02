#!/usr/bin/env node
/**
 * CI gate: compare Biome diagnostics against the recorded baseline.
 *
 * Baseline rationale (DECISIONS.md D-028): upstream carries 5 errors / 842
 * warnings that predate every NorthSign phase. CI fails only when a run
 * EXCEEDS these numbers, so pre-existing upstream noise never blocks a PR
 * while any new diagnostic does.
 *
 * Self-auditing: on failure the script re-runs Biome and checks which files
 * are non-compliant, ignoring files this repo can own (test config, CI
 * scripts, fixtures, our e2e suite). If the delta is entirely in NorthSign
 * files, the CI error is real and the baseline must not be raised — fix the
 * code. Baselines may only be lowered, never raised, without a DECISIONS.md
 * entry.
 *
 * Usage: node scripts/ci-biome-baseline.cjs
 */

const { execSync } = require('node:child_process');

const BASELINE_ERRORS = 5;
const BASELINE_WARNINGS = 842;

// Repo-owned files: never tolerated as part of the upstream baseline.
const OWNED_FILE_PATTERNS = [
  /packages\/app-tests\/e2e\/northsign\//,
  /packages\/app-tests\/e2e\/fixtures\/inbucket\.ts/,
  /scripts\/ci-biome-baseline\.cjs/,
  /scripts\/ci-tsc-allowlist\.cjs/,
  /packages\/app-tests\/northsign\.playwright\.config\.ts/,
];

const parseCounts = (stdout) => {
  const errors = Number(/Found (\d+) error/.exec(stdout)?.[1] ?? '0');
  const warnings = Number(/Found (\d+) warning/.exec(stdout)?.[1] ?? '0');
  return { errors, warnings };
};

const main = () => {
  let stdout = '';

  try {
    stdout = execSync('npx biome check .', {
      encoding: 'utf8',
      cwd: process.cwd(),
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    stdout = String(err?.stdout ?? '');

    if (!stdout) {
      console.error('Failed to run biome check and no output captured.');
      process.exit(1);
    }
  }

  const { errors, warnings } = parseCounts(stdout);

  console.log(
    `Biome diagnostics: ${errors} errors / ${warnings} warnings (baseline ${BASELINE_ERRORS}/${BASELINE_WARNINGS})`,
  );

  const errorsOk = errors <= BASELINE_ERRORS;
  const warningsOk = warnings <= BASELINE_WARNINGS;

  if (errorsOk && warningsOk) {
    console.log('OK: within recorded baseline.');
    return;
  }

  // Beyond baseline: self-audit. Re-run with formatter output so we can list
  // offending files, then check whether any of them are repo-owned.
  let diagnosticFiles = [];

  try {
    diagnosticFiles = execSync('npx biome check . 2>&1 || true', {
      encoding: 'utf8',
      cwd: process.cwd(),
      maxBuffer: 256 * 1024 * 1024,
      shell: '/bin/bash',
    })
      .split('\n')
      .map((line) => {
        // Diagnostics are prefixed with "path:line:col" — take the file part.
        const match = /^([^:\s]+\.tsx?):\d+:\d+/.exec(line);
        return match ? match[1] : null;
      })
      .filter(Boolean);
  } catch {
    diagnosticFiles = [];
  }

  const owned = [...new Set(diagnosticFiles)].filter((file) =>
    OWNED_FILE_PATTERNS.some((pattern) => pattern.test(file)),
  );

  if (owned.length > 0) {
    console.error('FAIL: repo-owned (NorthSign) files introduced new Biome diagnostics:');
    for (const file of owned) {
      console.error(`  - ${file}`);
    }
    console.error('Fix these files — the baseline does not cover our code.');
    process.exit(1);
  }

  console.error('FAIL: diagnostics exceed the recorded baseline (delta is in upstream files).');
  console.error('Fix the upstream regressions; do NOT raise the baseline without a DECISIONS.md entry.');
  process.exit(1);
};

main();
