/**
 * CLAUDE.md §7: "Never display an accuracy claim." This test sweeps every
 * UI source file for accuracy-claim language so a regression fails CI, not
 * a code review. Comments are stripped first — discussing the rule in a
 * comment is fine; putting it on screen is not.
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC = path.join(__dirname);

const BANNED = [/\baccurac\w*/i, /\d+\s*%\s*accurate/i, /AI[- ]verified/i, /clinically proven/i];

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) {
      out.push(full);
    }
  }
  return out;
}

describe('no accuracy claims anywhere in the UI', () => {
  const files = walk(SRC);

  it('finds UI files to scan', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((f) => [path.relative(SRC, f), f]))('%s is clean', (_rel, file) => {
    const code = stripComments(fs.readFileSync(file as string, 'utf8'));
    for (const pattern of BANNED) {
      expect(code).not.toMatch(pattern);
    }
  });
});
