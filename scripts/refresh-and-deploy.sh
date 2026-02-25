#!/bin/bash
set -e
cd "$(dirname "$0")/.."

SCRIPTS=(
  generate-stripe-data.py
  generate-sharon-data.py
  generate-james-data.py
  generate-campaign-data.py
  generate-drm-data.py
  generate-facilities-data.py
  generate-ramp-data.py
  generate-givecloud-data.py
  generate-board-data.py
  generate-data-quality.py
  generate-prospect-data.py
  generate-pledge-data.py
  generate-silence-alerts.py
  generate-ask-list.py
  generate-financial-data.py
  generate-project-tracker.py
)

for script in "${SCRIPTS[@]}"; do
  echo "=== Running $script ==="
  python3 "scripts/$script" || echo "WARNING: $script failed, continuing..."
done

echo "=== Building ==="
npm run build

echo "=== Deploying to GitHub Pages ==="
DEPLOY_DIR=$(mktemp -d)
gh repo clone Jewish-Federation-of-San-Diego/jfsd-ui "$DEPLOY_DIR" -- --branch gh-pages --depth 1 2>/dev/null

rm -rf "$DEPLOY_DIR/assets"
cp -r dist/* "$DEPLOY_DIR/"
mkdir -p "$DEPLOY_DIR/data"
cp public/data/*.json "$DEPLOY_DIR/data/"

cd "$DEPLOY_DIR"
git add -A
if git diff --cached --quiet; then
  echo "No changes to deploy"
else
  git commit -m "chore: daily data refresh $(date +%Y-%m-%d)"
  git push origin gh-pages
  echo "Deployed successfully"
fi

rm -rf "$DEPLOY_DIR"
