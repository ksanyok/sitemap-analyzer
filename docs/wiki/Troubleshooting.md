# Troubleshooting

## "The URL returns an HTML page, not an XML sitemap"

The sitemap URL is wrong, or a plugin or CDN serves a page instead. Open the URL in a browser and check robots.txt for the right `Sitemap:` line.

## "No <urlset> or <sitemapindex> root element found"

The file may be an RSS/Atom feed or a text sitemap. This tool validates XML sitemaps only.

## Analysis stops early

Large sites can have hundreds of sitemap files. Raise the limit with `--max 500`.

## URL checks show errors that work in a browser

Some servers answer `HEAD` requests or non-browser clients differently, or rate-limit many parallel requests. Check a smaller sample or verify the URLs in the online tool.

## Still stuck?

Open an [issue](https://github.com/ksanyok/sitemap-analyzer/issues/new/choose) with the command, the output (`--json` if possible) and your Node.js version — or compare with the [online version](https://promopilot.link/en/tools/sitemap-analyzer.php?utm_source=github&utm_medium=repo&utm_campaign=tools&utm_content=sitemap-analyzer).
