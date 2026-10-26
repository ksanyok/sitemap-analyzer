# FAQ

## Do priority and changefreq matter?

Google ignores both. Bing may use them as hints. They are still validated because invalid values make the file non-compliant for other consumers.

## Does lastmod matter?

Yes — Google uses `lastmod` when it is consistently accurate. Setting every URL to today's date teaches search engines to ignore it, which is why the tool warns when all entries share one value.

## Can a sitemap list URLs on another domain?

Only if the other host is verified in the same Search Console account or the sitemap is referenced from that host's robots.txt. Otherwise those URLs are ignored, so the tool warns about them.

## What should not be in a sitemap?

Redirects, 404s, noindex pages, URLs blocked by robots.txt and non-canonical duplicates. Use `--check-urls` to find the first two.

## How large can a sitemap be?

50,000 URLs and 50 MB uncompressed per file. Larger sites split into several files and list them in a sitemap index (up to 50,000 sitemaps).
