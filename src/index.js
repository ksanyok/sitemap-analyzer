import { gunzipSync } from 'node:zlib';
import { parseSitemap, lintSitemap } from './parse.js';

export { parseSitemap, lintSitemap } from './parse.js';

const UA = 'Mozilla/5.0 (compatible; sitemap-analyzer; +https://github.com/ksanyok/sitemap-analyzer)';

async function download(doFetch, url) {
  const res = await doFetch(url, { redirect: 'follow', headers: { 'user-agent': UA } });
  if (!res.ok) return { status: res.status, text: null };
  let buf = Buffer.from(await res.arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  return { status: res.status, text: buf.toString('utf8'), bytes: buf.length, type: res.headers.get('content-type') };
}

/** Find sitemap URLs for a site: Sitemap: lines in robots.txt, else /sitemap.xml. */
export async function discoverSitemaps(site, options = {}) {
  const doFetch = options.fetch || globalThis.fetch;
  const origin = new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`).origin;
  const robots = await download(doFetch, `${origin}/robots.txt`).catch(() => ({ text: null }));
  const listed = (robots.text || '').split(/\r?\n/).map((l) => /^\s*sitemap\s*:\s*(\S+)/i.exec(l)?.[1]).filter(Boolean);
  return { origin, fromRobots: listed.length > 0, sitemaps: listed.length ? [...new Set(listed)] : [`${origin}/sitemap.xml`] };
}

/**
 * Download and validate a sitemap, following sitemap indexes.
 * @param {string} input a sitemap URL, or a site (domain/URL) to discover sitemaps for
 * @param {{fetch?: typeof fetch, maxSitemaps?: number, checkUrls?: number}} [options]
 */
export async function analyzeSitemap(input, options = {}) {
  const doFetch = options.fetch || globalThis.fetch;
  const max = options.maxSitemaps ?? 50;
  const issues = [];
  let queue;
  let discovered = null;
  if (/\.xml(\.gz)?(\?|$)|sitemap/i.test(new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`).pathname)) {
    queue = [/^https?:\/\//i.test(input) ? input : `https://${input}`];
  } else {
    discovered = await discoverSitemaps(input, { fetch: doFetch });
    queue = [...discovered.sitemaps];
    if (!discovered.fromRobots) issues.push({ level: 'info', code: 'not-in-robots', message: 'robots.txt does not list a sitemap; trying /sitemap.xml.' });
  }
  const sitemaps = [];
  const urls = [];
  const visited = new Set();
  while (queue.length && sitemaps.length < max) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    const entry = { url, status: null, type: null, entries: 0, bytes: 0, issues: [] };
    sitemaps.push(entry);
    try {
      const res = await download(doFetch, url);
      entry.status = res.status;
      if (res.text === null) { entry.issues.push({ level: 'error', code: 'http-error', message: `HTTP ${res.status}` }); continue; }
      entry.bytes = res.bytes;
      const parsed = parseSitemap(res.text);
      entry.type = parsed.type;
      entry.entries = parsed.entries.length;
      entry.issues.push(...parsed.issues, ...lintSitemap(parsed, { url, bytes: res.bytes }));
      if (parsed.type === 'sitemapindex') queue.push(...parsed.entries.map((e) => e.loc).filter(Boolean));
      else urls.push(...parsed.entries);
    } catch (err) {
      entry.issues.push({ level: 'error', code: 'fetch-failed', message: err.message });
    }
  }
  if (queue.length) issues.push({ level: 'info', code: 'limit', message: `Stopped after ${max} sitemaps; ${queue.length} more not checked (raise maxSitemaps).` });
  for (const s of sitemaps) for (const i of s.issues) issues.push({ ...i, sitemap: s.url });

  const checked = [];
  if (options.checkUrls) {
    const sample = urls.slice(0, options.checkUrls);
    await Promise.all(sample.map(async (e) => {
      try {
        const res = await doFetch(e.loc, { method: 'HEAD', redirect: 'manual', headers: { 'user-agent': UA } });
        checked.push({ url: e.loc, status: res.status });
        if (res.status >= 300 && res.status < 400) issues.push({ level: 'warning', code: 'url-redirects', message: `${e.loc} redirects (HTTP ${res.status}); list the final URL instead.` });
        else if (res.status >= 400) issues.push({ level: 'error', code: 'url-broken', message: `${e.loc} returns HTTP ${res.status}.` });
      } catch (err) { checked.push({ url: e.loc, status: null, error: err.message }); }
    }));
  }
  return { input, discovered, sitemaps, totalUrls: urls.length, urls, checked, issues, ok: !issues.some((i) => i.level === 'error') };
}
