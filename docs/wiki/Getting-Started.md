# Getting started

## Requirements

Node.js 18 or newer. No other dependencies.

## Install

```bash
# one-off run
npx github:ksanyok/sitemap-analyzer example.com

# global CLI
npm install -g github:ksanyok/sitemap-analyzer

# as a library in your project
npm install github:ksanyok/sitemap-analyzer
```

## First run

```bash
sitemap-analyzer example.com
```

Each sitemap file found is listed with its type (`index` or `urlset`), number of entries, size and HTTP status, followed by the total number of URLs. Problems from all files follow; repeated problems are shown three times and then summarized.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | No errors (warnings allowed unless `--strict`) |
| 1 | Errors found (or warnings with `--strict`) |
| 2 | Bad arguments or the check could not run |

## More examples

**Validate a specific sitemap or index**

```bash
sitemap-analyzer https://example.com/sitemap_index.xml
```

**Also request the first 100 URLs**

```bash
sitemap-analyzer example.com --check-urls 100
```

**Validate a generated file before deploying**

```bash
sitemap-analyzer --file public/sitemap.xml.gz
```

**Export all URLs**

```bash
sitemap-analyzer example.com --json | jq -r '.urls[].loc' > urls.txt
```

## Without installing anything

Use the [online Sitemap Analyzer](https://promopilot.link/en/tools/sitemap-analyzer.php?utm_source=github&utm_medium=repo&utm_campaign=tools&utm_content=sitemap-analyzer).
