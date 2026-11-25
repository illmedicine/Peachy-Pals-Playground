// Builds the "What's new" email and writes an HTML body + metadata (subject, plain text).
//
// Two modes:
//   - Push (default): summarizes the feat:/fix: commits in GITHUB_EVENT_PATH's push event.
//   - Digest: when SINCE=YYYY-MM-DD is set, summarizes every commit since that date.
// Usage: node build-feature-email.mjs

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const outHtml = process.env.OUT_HTML || 'email.html';
const outMeta = process.env.OUT_META || 'email.meta.json';
const since = (process.env.SINCE || '').trim();
const repo = process.env.GITHUB_REPOSITORY || 'illmedicine/Peachy-Pals-Playground';

const skip = (reason) => {
  console.log(`Skipping email: ${reason}`);
  fs.writeFileSync(outMeta, JSON.stringify({ send: false, reason }));
  process.exit(0);
};

const escapeHtml = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const prettyDate = (d, withYear = true) => d.toLocaleDateString('en-US',
  withYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });

// Commit bodies are hard-wrapped and end with trailers; turn them into readable paragraphs
const cleanBody = (body) => String(body || '')
  .split('\n')
  .filter((line) => !/^(co-authored-by|signed-off-by):/i.test(line.trim()))
  .join('\n')
  .trim();

const paragraphsOf = (body) => cleanBody(body)
  .split(/\n\s*\n/)
  .map((p) => p.split('\n').map((l) => l.trim()).filter(Boolean))
  .filter((lines) => lines.length);

const BULLET = /^[-*•]\s/;
const isList = (lines) => BULLET.test(lines[0]);
// A bullet's wrapped continuation lines belong to that bullet
const listItems = (lines) => lines.reduce((items, l) => {
  if (BULLET.test(l) || !items.length) items.push(l.replace(BULLET, ''));
  else items[items.length - 1] += ' ' + l;
  return items;
}, []);

const bodyToHtml = (body) => paragraphsOf(body).map((lines) => isList(lines)
  ? `<ul style="margin:0.5rem 0 0;padding-left:1.2rem;color:#555;font-size:0.95rem;line-height:1.55">${listItems(lines).map((i) => `<li style="margin-bottom:0.3rem">${escapeHtml(i)}</li>`).join('')}</ul>`
  : `<p style="margin:0.5rem 0 0;color:#555;font-size:0.95rem;line-height:1.55">${escapeHtml(lines.join(' '))}</p>`
).join('');

const bodyToText = (body) => paragraphsOf(body)
  .map((lines) => isList(lines) ? listItems(lines).map((i) => '- ' + i).join('\n') : lines.join(' '))
  .join('\n\n');

const classify = (title) => {
  const m = title.match(/^(\w+)(\([^)]+\))?:\s*(.+)$/);
  const type = (m?.[1] || '').toLowerCase();
  const kind = type === 'feat' || type === 'feature' ? 'Feature' : type === 'fix' ? 'Fix' : 'Update';
  return { kind, clean: (m?.[3] || title).trim() };
};

const KIND_COLOR = { Feature: '#FF7043', Fix: '#26A69A', Update: '#66BB6A' };

// ---- Collect commits ----
let commits = [];
let intro = '';
let subject = '';
let headerDate = prettyDate(new Date());
let footerLink = `https://github.com/${repo}/commits/main`;

if (since) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) skip(`SINCE must look like YYYY-MM-DD (got "${since}")`);
  const raw = execFileSync('git', ['log', `--since=${since}`, '--no-merges', '--format=%H%x1f%aI%x1f%B%x1e'], { encoding: 'utf8' });
  commits = raw.split('\x1e').map((r) => r.trim()).filter(Boolean).map((r) => {
    const [sha, iso, message] = r.split('\x1f');
    const [title, ...rest] = message.split('\n');
    return { sha, date: new Date(iso), title: title.trim(), body: rest.join('\n') };
  });
  if (!commits.length) skip(`no commits since ${since}`);
  const [y, mo, d] = since.split('-').map(Number);
  const sinceLabel = prettyDate(new Date(y, mo - 1, d));
  const counts = { Feature: 0, Fix: 0, Update: 0 };
  commits.forEach((c) => counts[classify(c.title).kind]++);
  const parts = [
    counts.Feature && `${counts.Feature} new feature${counts.Feature > 1 ? 's' : ''}`,
    counts.Fix && `${counts.Fix} fix${counts.Fix > 1 ? 'es' : ''}`,
    counts.Update && `${counts.Update} other update${counts.Update > 1 ? 's' : ''}`
  ].filter(Boolean).join(', ');
  headerDate = `${sinceLabel} – ${prettyDate(new Date())}`;
  intro = `Here's everything that went live on peachypalsplay.com since ${sinceLabel}: ${parts}. Newest changes are listed first in each section.`;
  subject = `🍑 Peachy Pals: everything new since ${sinceLabel} (${commits.length} updates)`;
} else {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) skip('no push event');
  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  commits = (Array.isArray(event.commits) ? event.commits : []).map((c) => {
    const [title, ...rest] = String(c.message || '').split('\n');
    return { sha: c.id || '', date: new Date(c.timestamp || Date.now()), title: title.trim(), body: rest.join('\n') };
  }).filter((c) => classify(c.title).kind !== 'Update');
  if (!commits.length) skip('no feat:/fix: commits in this push');
  if (event.compare) footerLink = event.compare;
  intro = commits.length === 1 ? 'A new update just went live on your site.' : `${commits.length} updates just went live on your site.`;
  const kinds = new Set(commits.map((c) => classify(c.title).kind));
  const kindWord = kinds.size === 1 ? [...kinds][0] : 'Update';
  subject = commits.length === 1
    ? `🍑 Peachy Pals ${kindWord}: ${classify(commits[0].title).clean.slice(0, 90)}`
    : `🍑 Peachy Pals: ${commits.length} ${kindWord.toLowerCase()}s just shipped`;
}

// ---- Render ----
const card = (c) => {
  const { kind, clean } = classify(c.title);
  const color = KIND_COLOR[kind];
  return `
    <div style="border-left:4px solid ${color};background:#fff5ec;padding:1rem 1.25rem;border-radius:10px;margin:0.75rem 0">
      <div>
        <span style="display:inline-block;background:${color};color:#fff;font-size:0.7rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;padding:0.15rem 0.55rem;border-radius:999px">${kind}</span>
        <span style="margin-left:0.4rem;font-size:0.8rem;color:#888">${escapeHtml(prettyDate(c.date, false))}</span>
      </div>
      <div style="margin-top:0.35rem;font-weight:700;color:#333;font-size:1.02rem">${escapeHtml(clean)}</div>
      ${bodyToHtml(c.body)}
      <div style="margin-top:0.5rem"><a href="https://github.com/${escapeHtml(repo)}/commit/${escapeHtml(c.sha)}" style="font-family:'Courier New',monospace;font-size:0.75rem;color:#999;text-decoration:none">${escapeHtml(c.sha.slice(0, 7))}</a></div>
    </div>`;
};

const sections = since
  ? [['Feature', '✨ New features'], ['Fix', '🛠️ Fixes'], ['Update', '🔧 Other updates']]
      .map(([kind, heading]) => {
        const items = commits.filter((c) => classify(c.title).kind === kind);
        return items.length ? `<h2 style="font-size:1.1rem;color:#E64A19;margin:1.5rem 0 0.25rem">${heading}</h2>${items.map(card).join('')}` : '';
      }).join('')
  : commits.map(card).join('');

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#fff5ec;font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#333;line-height:1.55">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(255,112,67,0.15)">
    <div style="background:linear-gradient(135deg,#FF7043,#F48FB1);padding:1.5rem;text-align:center;color:#fff">
      <img src="https://peachypalsplay.com/images/logo.png" alt="Peachy Pals Playland" style="max-width:90px;height:auto;margin-bottom:0.5rem;background:#fff;padding:0.4rem;border-radius:12px">
      <h1 style="margin:0.5rem 0 0.25rem;font-size:1.4rem">Peachy Pals — What's New</h1>
      <p style="margin:0;opacity:0.95;font-size:0.9rem">${escapeHtml(headerDate)}</p>
    </div>
    <div style="padding:1.5rem 1.75rem">
      <p style="font-size:1rem;margin-top:0">Hi Cherish,</p>
      <p style="font-size:1rem">${escapeHtml(intro)}</p>
      ${sections}
      <p style="margin-top:1.5rem;font-size:0.9rem;color:#666">Technical details: <a href="${escapeHtml(footerLink)}" style="color:#E64A19">${escapeHtml(footerLink)}</a></p>
      <p style="font-size:0.9rem;color:#666;margin-top:1rem">With love,<br><strong>The Peachy Pals Dev Team</strong></p>
    </div>
    <div style="background:#fdf6f0;padding:0.9rem 1.75rem;text-align:center;font-size:0.75rem;color:#888">
      <p style="margin:0"><strong>Peachy Pals Playland</strong> · 801 West Ave Suite 201, Cartersville, GA 30120</p>
      <p style="margin:0.25rem 0 0">Automated update summary.</p>
    </div>
  </div>
</body></html>`;

const plain = `Peachy Pals — What's New (${headerDate})\n\nHi Cherish,\n\n${intro}\n\n` +
  commits.map((c) => {
    const { kind, clean } = classify(c.title);
    const body = bodyToText(c.body);
    return `[${kind}] ${clean} (${prettyDate(c.date, false)})${body ? '\n' + body : ''}`;
  }).join('\n\n') +
  `\n\nTechnical details: ${footerLink}\n\nWith love,\nThe Peachy Pals Dev Team`;

fs.writeFileSync(outHtml, html);
fs.writeFileSync(outMeta, JSON.stringify({ send: true, subject, plainBody: plain, commitCount: commits.length }));
console.log(`Prepared email for ${commits.length} commit(s): ${subject}`);
