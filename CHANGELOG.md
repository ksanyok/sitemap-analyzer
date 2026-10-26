# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-26

### Added
- `sitemap-analyzer` CLI with discovery, `--check-urls`, `--max`, `--list`, local `--file` (.xml/.xml.gz), `--json`, `--strict`
- Sitemap discovery via robots.txt with /sitemap.xml fallback; recursive sitemap index traversal with a configurable limit
- Dependency-free sitemap parser with entity, CDATA and namespace-prefix support; transparent gzip
- Protocol checks: namespace, unescaped ampersands, 50,000 URLs, 50 MB, absolute http(s) URLs, 2,048-character URLs, lastmod, priority, changefreq
- SEO checks: duplicates, foreign hosts, http/https mismatch, future and identical lastmod; optional HEAD checks for redirects and broken URLs
- Library API (`analyzeSitemap`, `discoverSitemaps`, `parseSitemap`, `lintSitemap`) with injectable fetch, and GitHub Action

[1.0.0]: https://github.com/ksanyok/sitemap-analyzer/releases/tag/v1.0.0
