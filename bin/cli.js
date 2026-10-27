#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { analyzeSitemap, parseSitemap, lintSitemap } from '../src/index.js';

const HELP = `Usage: sitemap-analyzer <site | sitemap-url> [options]
       sitemap-analyzer --file sitemap.xml

Finds a site's sitemaps (robots.txt or /sitemap.xml), follows sitemap indexes,
and validates every file against the sitemaps.org protocol and SEO best practice.

Options:
  --check-urls <n>  Also request the first n URLs and report broken or redirecting ones
  --max <n>         Maximum number of sitemap files to read (default: 50)
  --file <path>     Validate a local sitemap (.xml or .xml.gz)
  --list            Print every URL found
  --json            Print the full report as JSON
  --strict          Exit with code 1 on warnings too
  -h, --help        Show this help

Online version (no install): https://promopilot.link/en/tools/sitemap-analyzer.php?utm_source=github&utm_medium=cli&utm_campaign=tools&utm_content=sitemap-analyzer
`;

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const value = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
if (!args.length || flag('-h') || flag('--help')) { process.stdout.write(HELP); process.exit(args.length ? 0 : 2); }

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const ICON = { error: c(31, '✖'), warning: c(33, '!'), info: c(36, 'i') };
const valued = new Set(['--check-urls', '--max', '--file']);
const input = args.find((a, i) => !a.startsWith('-') && !valued.has(args[i - 1]));

try {
  let report;
  if (value('--file')) {
    let buf = readFileSync(value('--file'));
    if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
    const parsed = parseSitemap(buf.toString('utf8'));
    const issues = [...parsed.issues, ...lintSitemap(parsed, { bytes: buf.length })];
    report = { sitemaps: [{ url: value('--file'), type: parsed.type, entries: parsed.entries.length, bytes: buf.length }], totalUrls: parsed.entries.length, urls: parsed.entries, checked: [], issues, ok: !issues.some((i) => i.level === 'error') };
  } else {
    report = await analyzeSitemap(input, { checkUrls: Number(value('--check-urls') || 0), maxSitemaps: Number(value('--max') || 50) });
  }
  if (flag('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const s of report.sitemaps) {
      const kind = s.type === 'sitemapindex' ? 'index' : s.type || 'invalid';
      console.log(`  ${c(1, kind.padEnd(8))} ${s.url}  ${c(2, `${s.entries} entries, ${Math.round(s.bytes / 1024)} KB${s.status ? `, HTTP ${s.status}` : ''}`)}`);
    }
    console.log(`\n${c(1, 'Total URLs:')} ${report.totalUrls}`);
    if (report.checked.length) console.log(`${c(1, 'Checked:')}    ${report.checked.length} URLs, ${report.checked.filter((x) => x.status === 200).length} return 200`);
    if (flag('--list')) for (const u of report.urls) console.log(`  ${u.loc}${u.lastmod ? c(2, `  ${u.lastmod}`) : ''}`);
    console.log('');
    if (!report.issues.length) console.log(c(32, '✔ Sitemaps look good'));
    for (const i of report.issues) console.log(`  ${ICON[i.level]} ${i.message}`);
  }
  const failing = report.issues.filter((i) => i.level === 'error' || (flag('--strict') && i.level === 'warning'));
  process.exit(failing.length ? 1 : 0);
} catch (err) {
  console.error(c(31, `Error: ${err.message}`));
  process.exit(2);
}
