#!/usr/bin/env bash
# Build dist/ (site files only) and deploy to Cloudflare Pages (project: sonify).
# Functions in ./functions are picked up automatically.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir dist
rsync -a --exclude '.git' --exclude '.gitignore' --exclude 'dist' --exclude 'functions' --exclude 'tools' \
  --exclude 'node_modules' --exclude '*.md' --exclude 'wrangler.toml' --exclude '.DS_Store' --exclude 'CNAME' \
  --exclude '.wrangler' --exclude 'video' ./ dist/
WRANGLER="${WRANGLER:-$HOME/GitHub/solarmeditation/node_modules/.bin/wrangler}"
[ -x "$WRANGLER" ] || WRANGLER="npx --yes wrangler@4"
$WRANGLER pages deploy dist --project-name sonify --branch main --commit-dirty=true "$@"
