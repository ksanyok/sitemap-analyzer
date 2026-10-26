import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { parseSitemap, lintSitemap, analyzeSitemap } from '../src/index.js';

const NS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';
const urlset = (items) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${NS}>\n${items.map((i) => `<url><loc>${i.loc}</loc>${i.lastmod ? `<lastmod>${i.lastmod}</lastmod>` : ''}${i.priority ? `<priority>${i.priority}</priority>` : ''}${i.changefreq ? `<changefreq>${i.changefreq}</changefreq>` : ''}</url>`).join('\n')}\n</urlset>`;
const codes = (list) => list.map((i) => i.code);
const web = (pages) => async (url, init = {}) => {
  const body = pages[url];
  if (body === undefined) return new Response('not found', { status: 404 });
  if (typeof body === 'number') return new Response(null, { status: body });
  return new Response(body, { status: 200 });
};

test('parses a urlset with entities and CDATA', () => {
  const p = parseSitemap(urlset([{ loc: 'https://example.com/a?x=1&amp;y=2', lastmod: '2026-01-02' }, { loc: '<![CDATA[https://example.com/b]]>' }]));
  assert.equal(p.type, 'urlset');
  assert.deepEqual(p.entries.map((e) => e.loc), ['https://example.com/a?x=1&y=2', 'https://example.com/b']);
  assert.deepEqual(p.issues, []);
});

test('detects HTML, missing namespace and raw ampersands', () => {
  assert.ok(codes(parseSitemap('<!doctype html><html></html>').issues).includes('not-sitemap'));
  const c = codes(parseSitemap('<urlset><url><loc>https://example.com/?a=1&b=2</loc></url></urlset>').issues);
  assert.ok(c.includes('namespace'));
  assert.ok(c.includes('unescaped-ampersand'));
});

test('validates entries', () => {
  const p = parseSitemap(urlset([
    { loc: 'https://example.com/ok', lastmod: '2026-05-01T10:00:00+02:00', priority: '0.8', changefreq: 'weekly' },
    { loc: 'https://example.com/ok' },
    { loc: '/relative' },
    { loc: 'https://other.com/x' },
    { loc: 'http://example.com/y' },
    { loc: 'https://example.com/z', lastmod: '01/02/2026', priority: '2', changefreq: 'sometimes' },
    { loc: 'https://example.com/f', lastmod: '2999-01-01' },
  ]));
  const c = codes(lintSitemap(p, { url: 'https://example.com/sitemap.xml', now: new Date('2026-10-01') }));
  for (const code of ['duplicate', 'invalid-url', 'other-host', 'protocol-mismatch', 'invalid-lastmod', 'invalid-priority', 'invalid-changefreq', 'future-lastmod']) assert.ok(c.includes(code), code);
});

test('limits repeated messages and flags identical lastmod', () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ loc: `https://example.com/${i}`, lastmod: '2026-01-01', priority: '5' }));
  const issues = lintSitemap(parseSitemap(urlset(items)));
  assert.equal(issues.filter((i) => i.code === 'invalid-priority').length, 4);
  assert.ok(codes(issues).includes('same-lastmod'));
});

test('discovers sitemaps via robots.txt and follows indexes, including gzip', async () => {
  const index = `<sitemapindex ${NS}><sitemap><loc>https://example.com/s1.xml</loc></sitemap><sitemap><loc>https://example.com/s2.xml.gz</loc></sitemap></sitemapindex>`;
  const r = await analyzeSitemap('example.com', { checkUrls: 3, fetch: web({
    'https://example.com/robots.txt': 'User-agent: *\nSitemap: https://example.com/index.xml',
    'https://example.com/index.xml': index,
    'https://example.com/s1.xml': urlset([{ loc: 'https://example.com/a' }, { loc: 'https://example.com/old' }]),
    'https://example.com/s2.xml.gz': gzipSync(urlset([{ loc: 'https://example.com/b' }])),
    'https://example.com/a': 200, 'https://example.com/old': 301, 'https://example.com/b': 404,
  }) });
  assert.equal(r.discovered.fromRobots, true);
  assert.deepEqual(r.sitemaps.map((s) => s.type), ['sitemapindex', 'urlset', 'urlset']);
  assert.equal(r.totalUrls, 3);
  assert.ok(codes(r.issues).includes('url-redirects'));
  assert.ok(codes(r.issues).includes('url-broken'));
  assert.equal(r.ok, false);
});

test('falls back to /sitemap.xml and reports HTTP errors', async () => {
  const r = await analyzeSitemap('https://example.com/', { fetch: web({}) });
  assert.equal(r.sitemaps[0].url, 'https://example.com/sitemap.xml');
  assert.ok(codes(r.issues).includes('not-in-robots'));
  assert.ok(codes(r.issues).includes('http-error'));
});
