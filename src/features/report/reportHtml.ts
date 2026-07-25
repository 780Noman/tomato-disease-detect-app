import { CLASS_INFO, categoryDisplayName } from '@/config/classes';
import {
  confidenceBand,
  confidenceBandLabel,
  displayPercent,
  TOP_PREDICTIONS_SHOWN,
} from '@/config/thresholds';
import { GUIDANCE_SCOPE_NOTE, libraryEntry } from '@/features/library/catalog';
import type { SavedScan } from '@/features/history/types';

/**
 * Builds the PDF report body. Carries the SAME honesty rules as the results
 * screen (CLAUDE.md §7): category first, top-3 only, low confidence as the
 * headline when it applies, limited-data caveat, no-healthy-class note, no
 * accuracy claim, whole percentages.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function buildReportHtml(scan: SavedScan, imageDataUri: string | null): string {
  const info = CLASS_INFO[scan.topClass];
  const entry = libraryEntry(scan.topClass);
  const shown = [...scan.scores]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, TOP_PREDICTIONS_SHOWN);

  const headline = scan.lowConfidence
    ? `<p class="tag warn">Uncertain</p>
       <h1>This leaf could not be classified reliably</h1>
       <p class="muted">No prediction reached the confidence required for a diagnosis. Consult an agricultural extension officer.</p>`
    : `<p class="tag">${escapeHtml(categoryDisplayName(info.category))}</p>
       <h1>${escapeHtml(info.displayName)}</h1>
       <p class="muted">${escapeHtml(confidenceBandLabel(confidenceBand(scan.confidence)))} · ${displayPercent(scan.confidence)}</p>`;

  // Owner decision 2026-07-25: the "Limited training data" badge and its
  // explanation were removed here as well as on the results screen, so the
  // exported report matches what the user saw. The footer already tells the
  // reader to confirm the diagnosis with an extension officer before acting.
  const caveat = scan.lowConfidence
    ? ''
    : `<p class="muted">Consult an agricultural extension officer before acting on this result.</p>`;

  const unverifiedNote = scan.classOrderVerified
    ? ''
    : `<p class="notice">This scan was recorded while the model's class order was still unverified, so the label may not correspond to the correct condition. It is retained for reference only.</p>`;

  const bars = shown
    .map((score) => {
      const pct = Math.round(score.probability * 100);
      return `<div class="row">
        <div class="row-head"><span>${escapeHtml(CLASS_INFO[score.classCode].displayName)}</span><span>${pct}%</span></div>
        <div class="track"><div class="fill" style="width:${pct}%"></div></div>
      </div>`;
    })
    .join('');

  const symptoms = entry.symptoms.map((s) => `<li>${escapeHtml(s)}</li>`).join('');
  const controls = entry.culturalControls.map((s) => `<li>${escapeHtml(s)}</li>`).join('');

  const image =
    imageDataUri === null
      ? '<p class="muted">The scan photo is no longer available on this device.</p>'
      : `<img class="photo" src="${imageDataUri}" alt="The analysed leaf" />`;

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Roboto, sans-serif; color: #2A211C; background: #FAF6F1; margin: 0; padding: 28px; }
  h1 { font-size: 22px; margin: 6px 0; }
  h2 { font-size: 15px; margin: 22px 0 8px; }
  .brand { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #A94F2C; font-weight: 700; }
  .muted { color: #6B5F58; font-size: 13px; margin: 4px 0; }
  .card { background: #fff; border: 1px solid #E8DED4; border-radius: 12px; padding: 16px; margin-bottom: 14px; }
  .tag { display: inline-block; background: #F2E3DA; color: #7A3419; border-radius: 999px; padding: 4px 12px; font-size: 12px; font-weight: 700; margin: 0 0 4px; }
  .tag.warn { background: #fff; color: #8A6508; border: 1px solid #E8DED4; }
  .notice { background: #fff; border-left: 4px solid #BE2745; padding: 10px 12px; font-size: 12px; color: #6B5F58; }
  .photo { width: 100%; max-width: 320px; border-radius: 12px; }
  .row { margin-bottom: 10px; }
  .row-head { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 4px; }
  .track { background: #E8DED4; border-radius: 999px; height: 8px; overflow: hidden; }
  .fill { background: #A94F2C; height: 8px; }
  ul { margin: 6px 0; padding-left: 18px; font-size: 13px; }
  li { margin-bottom: 4px; }
  .foot { font-size: 11px; color: #6B5F58; border-top: 1px solid #E8DED4; padding-top: 10px; margin-top: 18px; }
</style></head>
<body>
  <p class="brand">Tomato Leaf Doctor</p>
  <p class="muted">Scan report · ${escapeHtml(formatDate(scan.createdAt))}</p>
  ${unverifiedNote}
  <div class="card">${headline}${caveat}</div>
  <div class="card">${image}</div>
  <div class="card">
    <h2>${scan.lowConfidence ? 'Possibilities — not a diagnosis' : 'Top predictions'}</h2>
    ${bars}
  </div>
  <div class="card">
    <h2>${escapeHtml(entry.displayName)} — what to look for</h2>
    <p class="muted">${escapeHtml(entry.whatItIs)}</p>
    <ul>${symptoms}</ul>
    <h2>What you can do now</h2>
    <ul>${controls}</ul>
    <p class="muted">${escapeHtml(GUIDANCE_SCOPE_NOTE)}</p>
  </div>
  <p class="foot">
    This tool distinguishes only between six pest and deficiency conditions and does not detect
    healthy leaves — a healthy leaf will still receive one of the six labels. Results depend on the
    leaf being photographed as a single detached leaf on a dark background, from directly above.
    Confirm any diagnosis with an agricultural extension officer before acting on it.
  </p>
</body></html>`;
}
