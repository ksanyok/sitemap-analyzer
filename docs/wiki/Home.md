# Sitemap Analyzer

`sitemap-analyzer` finds a site's sitemaps the way search engines do (the `Sitemap:` lines in robots.txt, then `/sitemap.xml`), follows sitemap indexes and gzipped files, and validates every entry against the sitemaps.org protocol: absolute URLs on the right host and protocol, W3C `lastmod` dates, valid `priority` and `changefreq`, duplicates and the 50,000-URL / 50 MB limits. Optionally it requests the listed URLs and reports the ones that redirect or are broken.

- **[Getting started](Getting-Started)** — install, first run, reading the output
- **[FAQ](FAQ)** — common questions
- **[Troubleshooting](Troubleshooting)** — errors and how to fix them

Prefer a browser? The same check runs online at **[PromoPilot](https://promopilot.link/en/tools/sitemap-analyzer.php?utm_source=github&utm_medium=repo&utm_campaign=tools&utm_content=sitemap-analyzer)** — free, no sign-up.
