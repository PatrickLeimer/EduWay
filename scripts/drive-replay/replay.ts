/**
 * Replay a drive recording from the phone's Drive recorder and print a tuning
 * and validation report. Guide: docs/drive-recording.md.
 *
 *   npm run drive-replay -- fixtures/drives/drive-20260927-101500-ios.ndjson
 *   npm run drive-replay -- <file> --set HARD_BRAKE.coach.start=3.0 --set ROUGH_TURN.coach.start=3.5
 *   npm run drive-replay -- <file> --out report.txt
 *
 * --set only changes thresholds inside this replay. To keep a new value, edit
 * packages/shared/src/thresholds.ts in its own commit (protected contract).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

import { parseRecording } from '../../apps/mobile/src/recorder/format';

import { applyOverrides, formatReport, replay, score, thresholdDrift } from './analyze';

const USAGE = `Usage: npm run drive-replay -- <recording.ndjson> [--set GROUP.path=value ...] [--out report.txt]`;

async function main(argv: string[]) {
  const sets: string[] = [];
  let file: string | null = null;
  let outFile: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--set') sets.push(argv[++i] ?? '');
    else if (a.startsWith('--set=')) sets.push(a.slice(6));
    else if (a === '--out') outFile = argv[++i] ?? null;
    else if (a === '-h' || a === '--help') {
      console.log(USAGE);
      return;
    } else if (!file) file = a;
    else throw new Error(`Unexpected argument "${a}"\n${USAGE}`);
  }
  if (!file) throw new Error(USAGE);

  const rec = parseRecording(readFileSync(file, 'utf8'));
  const drift = thresholdDrift(rec); // before --set, so overrides are not reported as drift
  applyOverrides(sets);
  const r = await replay(rec);
  const report = formatReport({
    rec,
    replay: r,
    scoring: score(rec, r.events),
    fileName: basename(file),
    overrides: sets,
    thresholdDrift: drift,
  });
  if (outFile) {
    writeFileSync(outFile, report);
    console.log(`Report written to ${outFile}`);
  } else {
    console.log(report);
  }
}

main(process.argv.slice(2)).catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
