const NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const CHANGEFREQ = new Set(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']);
const W3C_DATE = /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/;

const decode = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&').trim();
const tag = (block, name) => { const m = new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'i').exec(block); return m ? decode(m[1]) : undefined; };

/**
 * Parse a sitemap or sitemap index. Lightweight and dependency-free: it reads the
 * elements defined by sitemaps.org rather than implementing a full XML parser.
 * @param {string} xml
 * @returns {{type: 'urlset'|'sitemapindex'|null, entries: {loc: string, lastmod?: string, changefreq?: string, priority?: string, line: number}[], issues: object[]}}
 */
export function parseSitemap(xml) {
  const issues = [];
  const add = (level, code, message) => issues.push({ level, code, message });
  const text = String(xml).replace(/^﻿/, '');
  const root = /<(?:\w+:)?(urlset|sitemapindex)\b([^>]*)>/i.exec(text);
  if (!root) {
    add('error', 'not-sitemap', /<(!doctype\s+)?html/i.test(text) ? 'The URL returns an HTML page, not an XML sitemap.' : 'No <urlset> or <sitemapindex> root element found.');
    return { type: null, entries: [], issues };
  }
  const type = root[1].toLowerCase();
  if (!root[2].includes(NS)) add('error', 'namespace', `The root element must declare xmlns="${NS}".`);
  if (!/^\s*<\?xml/.test(text)) add('info', 'no-xml-declaration', 'No <?xml version="1.0" encoding="UTF-8"?> declaration.');
  if (/&(?!(amp|lt|gt|quot|apos|#\d+);)/.test(text.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, ''))) add('error', 'unescaped-ampersand', 'Unescaped "&" found; URLs must use &amp; in XML.');
  const item = type === 'urlset' ? 'url' : 'sitemap';
  const entries = [];
  const re = new RegExp(`<(?:\\w+:)?${item}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${item}>`, 'gi');
  for (let m; (m = re.exec(text));) {
    const line = text.slice(0, m.index).split('\n').length;
    entries.push({ loc: tag(m[1], 'loc'), lastmod: tag(m[1], 'lastmod'), changefreq: tag(m[1], 'changefreq'), priority: tag(m[1], 'priority'), line });
  }
  return { type, entries, issues };
}

/**
 * Validate entries of a parsed sitemap against the protocol and common SEO rules.
 * @param {ReturnType<typeof parseSitemap>} parsed
 * @param {{url?: string, bytes?: number, now?: Date}} [context] where the sitemap was found
 */
export function lintSitemap(parsed, context = {}) {
  const out = [];
  const counts = {};
  const add = (level, code, message) => { counts[code] = (counts[code] || 0) + 1; if (counts[code] <= 3) out.push({ level, code, message }); };
  const base = context.url ? new URL(context.url) : null;
  const now = context.now || new Date();
  const seen = new Set();
  if (parsed.entries.length > 50000) add('error', 'too-many-urls', `${parsed.entries.length} entries; a sitemap may contain at most 50,000. Split it and use a sitemap index.`);
  if (context.bytes > 50 * 1024 * 1024) add('error', 'too-large', `Uncompressed size is ${(context.bytes / 1048576).toFixed(1)} MB; the limit is 50 MB.`);
  if (parsed.type && !parsed.entries.length) add('warning', 'empty', 'The sitemap contains no entries.');
  for (const e of parsed.entries) {
    const where = `line ${e.line}`;
    if (!e.loc) { add('error', 'missing-loc', `Entry at ${where} has no <loc>.`); continue; }
    let u;
    try { u = new URL(e.loc); } catch { add('error', 'invalid-url', `"${e.loc}" (${where}) is not an absolute URL.`); continue; }
    if (!/^https?:$/.test(u.protocol)) add('error', 'invalid-url', `"${e.loc}" (${where}) is not an http(s) URL.`);
    if (e.loc.length > 2048) add('error', 'url-too-long', `URL at ${where} is longer than 2048 characters.`);
    if (seen.has(e.loc)) add('warning', 'duplicate', `${e.loc} is listed more than once.`);
    seen.add(e.loc);
    if (base && u.host !== base.host) add('warning', 'other-host', `${e.loc} is on a different host than the sitemap (${base.host}); search engines may ignore it.`);
    else if (base && u.protocol !== base.protocol) add('warning', 'protocol-mismatch', `${e.loc} uses ${u.protocol.slice(0, -1)} while the sitemap is on ${base.protocol.slice(0, -1)}.`);
    if (e.lastmod !== undefined) {
      if (!W3C_DATE.test(e.lastmod)) add('error', 'invalid-lastmod', `lastmod "${e.lastmod}" (${where}) is not a W3C datetime (YYYY-MM-DD or full ISO 8601).`);
      else if (new Date(e.lastmod) - now > 864e5) add('warning', 'future-lastmod', `lastmod ${e.lastmod} (${where}) is in the future.`);
    }
    if (e.changefreq !== undefined && !CHANGEFREQ.has(e.changefreq.toLowerCase())) add('error', 'invalid-changefreq', `changefreq "${e.changefreq}" (${where}) is not a valid value.`);
    if (e.priority !== undefined && !(/^(0(\.\d+)?|1(\.0+)?)$/.test(e.priority))) add('error', 'invalid-priority', `priority "${e.priority}" (${where}) must be between 0.0 and 1.0.`);
  }
  for (const [code, n] of Object.entries(counts)) {
    if (n > 3) { const first = out.find((i) => i.code === code); out.push({ level: first.level, code, message: `…and ${n - 3} more "${code}" problems.` }); }
  }
  const lastmods = parsed.entries.map((e) => e.lastmod).filter(Boolean);
  if (parsed.entries.length >= 10 && lastmods.length === parsed.entries.length && new Set(lastmods).size === 1) {
    out.push({ level: 'warning', code: 'same-lastmod', message: 'Every entry has the same lastmod; search engines ignore lastmod values that are not accurate.' });
  }
  return out;
}
