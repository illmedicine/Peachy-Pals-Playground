// Reads GITHUB_EVENT_PATH (a push event), filters feat:/fix: commits,
// and writes an HTML body + subject line to env-provided output files.
// Usage: node build-feature-email.mjs

import fs from 'node:fs';
import { execSync } from 'node:child_process';

const eventPath = process.env.GITHUB_EVENT_PATH;
const outHtml = process.env.OUT_HTML || 'email.html';
const outMeta = process.env.OUT_META || 'email.meta.json';

if (!eventPath || !fs.existsSync(eventPath)) {
  console.error('No GITHUB_EVENT_PATH — nothing to build.');
  fs.writeFileSync(outMeta, JSON.stringify({ send: false, reason: 'no-event' }));
  process.exit(0);
}

const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
const rawCommits = Array.isArray(event.commits) ? event.commits : [];

const escapeHtml = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const isFeatureCommit = (title) => /^(feat|feature|fix)(\([^)]+\))?:/i.test(title);

const commits = rawCommits
  .map((c) => {
    const message = String(c.message || '');
    const [title, ...rest] = message.split('\n');
    const body = rest.join('\n').trim();
    return {
      sha: c.id,
      shortSha: (c.id || '').slice(0, 7),
      author: c.author?.name || c.author?.username || 'someone',
      url: c.url || '',
      title: title.trim(),
      body,
    };
  })
  .filter((c) => isFeatureCommit(c.title));

if (commits.length === 0) {
  console.log('No feat:/fix: commits in this push. Skipping email.');
  fs.writeFileSync(outMeta, JSON.stringify({ send: false, reason: 'no-matching-commits' }));
  process.exit(0);
}

// Classify + strip prefix for a friendlier headline
const classify = (title) => {
  const m = title.match(/^(feat|feature|fix)(\([^)]+\))?:\s*(.+)$/i);
  const kind = (m?.[1] || '').toLowerCase().startsWith('f') && !m?.[1].toLowerCase().startsWith('fix') ? 'Feature' : (m?.[1] || '').toLowerCase() === 'fix' ? 'Fix' : 'Update';
  const clean = m?.[3]?.trim() || title;
  return { kind, clean };
};

const totalKind = (() => {
  const kinds = new Set(commits.map((c) => classify(c.title).kind));
  if (kinds.size === 1) return [...kinds][0];
  return 'Update';
})();

const repo = event.repository?.full_name || 'peachy pals playground';
const pusher = event.pusher?.name || event.sender?.login || 'the dev team';
const compare = event.compare || `https://github.com/${repo}/commit/${event.after || ''}`;
const now = new Date();
const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const subject = commits.length === 1
  ? `🍑 Peachy Pals ${totalKind}: ${classify(commits[0].title).clean.slice(0, 90)}`
  : `🍑 Peachy Pals: ${commits.length} ${totalKind.toLowerCase()}${commits.length > 1 ? 's' : ''} just shipped`;

const commitCards = commits.map((c) => {
  const { kind, clean } = classify(c.title);
  const bodyHtml = c.body
    ? `<p style="margin:0.5rem 0 0;color:#555;font-size:0.95rem;line-height:1.55;white-space:pre-wrap">${escapeHtml(c.body)}</p>`
    : '';
  const badgeColor = kind === 'Fix' ? '#26A69A' : '#FF7043';
  return `
    <div style="border-left:4px solid ${badgeColor};background:#fff5ec;padding:1rem 1.25rem;border-radius:10px;margin:0.75rem 0">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap">
        <div>
          <span style="display:inline-block;background:${badgeColor};color:#fff;font-size:0.7rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;padding:0.15rem 0.55rem;border-radius:999px">${kind}</span>
          <span style="margin-left:0.5rem;font-weight:700;color:#333">${escapeHtml(clean)}</span>
        </div>
        <a href="${escapeHtml(c.url)}" style="font-family:'Courier New',monospace;font-size:0.8rem;color:#888;text-decoration:none">${escapeHtml(c.shortSha)}</a>
      </div>
      ${bodyHtml}
    </div>
  `;
}).join('');

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#fff5ec;font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#333;line-height:1.55">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(255,112,67,0.15)">
    <div style="background:linear-gradient(135deg,#FF7043,#F48FB1);padding:1.5rem;text-align:center;color:#fff">
      <img src="https://peachypalsplay.com/images/logo.png" alt="Peachy Pals Playland" style="max-width:90px;height:auto;margin-bottom:0.5rem;background:#fff;padding:0.4rem;border-radius:12px">
      <h1 style="margin:0.5rem 0 0.25rem;font-size:1.4rem">Peachy Pals — What's New</h1>
      <p style="margin:0;opacity:0.95;font-size:0.9rem">${escapeHtml(dateLabel)}</p>
    </div>
    <div style="padding:1.5rem 1.75rem">
      <p style="font-size:1rem;margin-top:0">Hi Cherish,</p>
      <p style="font-size:1rem">${commits.length === 1 ? 'A new update just went live on your site.' : `${commits.length} updates just went live on your site.`} Pushed by <strong>${escapeHtml(pusher)}</strong>.</p>
      ${commitCards}
      <p style="margin-top:1.5rem;font-size:0.9rem;color:#666">
        View the full diff on GitHub: <a href="${escapeHtml(compare)}" style="color:#E64A19">${escapeHtml(compare)}</a>
      </p>
      <p style="font-size:0.9rem;color:#666;margin-top:1rem">With love,<br><strong>The Peachy Pals Dev Team</strong></p>
    </div>
    <div style="background:#fdf6f0;padding:0.9rem 1.75rem;text-align:center;font-size:0.75rem;color:#888">
      <p style="margin:0"><strong>Peachy Pals Playland</strong> · 801 West Ave Suite 201, Cartersville, GA 30120</p>
      <p style="margin:0.25rem 0 0">Automated feature summary from <code>${escapeHtml(repo)}</code>.</p>
    </div>
  </div>
</body></html>`;

const plain = `Peachy Pals — What's New (${dateLabel})\n\n` +
  commits.map((c) => {
    const { kind, clean } = classify(c.title);
    return `[${kind}] ${clean} (${c.shortSha})${c.body ? '\n' + c.body : ''}`;
  }).join('\n\n') +
  `\n\nDiff: ${compare}\n\nWith love,\nThe Peachy Pals Dev Team`;

fs.writeFileSync(outHtml, html);
fs.writeFileSync(outMeta, JSON.stringify({
  send: true,
  subject,
  plainBody: plain,
  commitCount: commits.length,
}));

console.log(`Prepared email for ${commits.length} commit(s): ${subject}`);
