#!/usr/bin/env bash
#
# JFSD Dashboard — Refresh Data & Deploy to GitHub Pages
#
# Usage:
#   ./scripts/refresh-and-deploy.sh              # Full refresh + deploy
#   ./scripts/refresh-and-deploy.sh --data-only   # Refresh data, no deploy
#   ./scripts/refresh-and-deploy.sh --deploy-only  # Just deploy (skip refresh)
#   ./scripts/refresh-and-deploy.sh --source NAME  # Refresh single source + deploy
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="$PROJECT_DIR/data"
LOG_FILE="$PROJECT_DIR/scripts/refresh.log"

# Parse args
DATA_ONLY=false
DEPLOY_ONLY=false
SOURCE_ARG=""

for arg in "$@"; do
    case "$arg" in
        --data-only)  DATA_ONLY=true ;;
        --deploy-only) DEPLOY_ONLY=true ;;
        --source)     shift; SOURCE_ARG="--source $1" ;;
        --source=*)   SOURCE_ARG="--source ${arg#*=}" ;;
    esac
done

log() {
    echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

cd "$PROJECT_DIR"

echo "═══════════════════════════════════════════════" | tee "$LOG_FILE"
log "JFSD Dashboard Refresh & Deploy"
log "Project: $PROJECT_DIR"
log "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════" | tee -a "$LOG_FILE"

# ── Step 1: Refresh Data ──────────────────────────────────────────────────
if [ "$DEPLOY_ONLY" = false ]; then
    log ""
    log "Step 1: Refreshing data..."
    log ""
    
    if python3 "$SCRIPT_DIR/refresh-data.py" $SOURCE_ARG 2>&1 | tee -a "$LOG_FILE"; then
        log ""
        log "✓ Data refresh complete"
    else
        log ""
        log "⚠ Data refresh completed with errors (see above)"
        # Continue anyway — partial data is better than no data
    fi
else
    log "Skipping data refresh (--deploy-only)"
fi

# ── Step 2: Git Commit & Push ─────────────────────────────────────────────
if [ "$DATA_ONLY" = false ]; then
    log ""
    log "Step 2: Committing changes..."
    
    cd "$PROJECT_DIR"
    
    # Check if there are changes
    if git diff --quiet data/ 2>/dev/null && git diff --cached --quiet data/ 2>/dev/null; then
        log "  No data changes to commit"
    else
        git add data/
        TIMESTAMP="$(date '+%Y-%m-%d %H:%M')"
        git commit -m "data: refresh dashboard data — $TIMESTAMP" --no-verify 2>&1 | tee -a "$LOG_FILE"
        
        log "  Pushing to origin..."
        git push origin main 2>&1 | tee -a "$LOG_FILE" || {
            log "  ⚠ Push failed — trying with current branch"
            BRANCH="$(git rev-parse --abbrev-ref HEAD)"
            git push origin "$BRANCH" 2>&1 | tee -a "$LOG_FILE"
        }
        log "  ✓ Changes committed and pushed"
    fi
    
    # ── Step 3: Deploy to GitHub Pages ────────────────────────────────────
    log ""
    log "Step 3: Deploying to GitHub Pages..."
    
    cd "$PROJECT_DIR"
    
    # Build first if there's a build step
    if [ -f "package.json" ] && grep -q '"build"' package.json 2>/dev/null; then
        log "  Building..."
        npm run build 2>&1 | tee -a "$LOG_FILE"
        
        # If build outputs to dist/, copy data + admin pages there
        if [ -d "dist" ]; then
            cp -r data/ dist/data/
            log "  Copied data/ to dist/"
            
            # Copy admin reference pages
            mkdir -p dist/admin
            for f in h2-capabilities.html h2-ecosystem.html system-architecture.html \
                     development-data-overview.html hubspot-marketing-overview.html \
                     fc-report-midcentury.html fc-report-warhol.html; do
                [ -f "$f" ] && cp "$f" dist/admin/
            done
            [ -f "admin/index.html" ] && cp admin/index.html dist/admin/
            cp -r charts/ dist/charts/ 2>/dev/null || true
            log "  Copied admin pages + charts to dist/"
            
            npx gh-pages -d dist 2>&1 | tee -a "$LOG_FILE"
        else
            npx gh-pages -d . 2>&1 | tee -a "$LOG_FILE"
        fi
    else
        npx gh-pages -d . 2>&1 | tee -a "$LOG_FILE"
    fi
    
    log "  ✓ Deployed to GitHub Pages"
fi

# ── Summary ───────────────────────────────────────────────────────────────
log ""
echo "═══════════════════════════════════════════════" | tee -a "$LOG_FILE"
log "Done! $(date '+%Y-%m-%d %H:%M:%S')"

# Count updated files
UPDATED=$(find "$DATA_DIR" -name "*.json" -newer "$LOG_FILE" -o -name "*.json" -newermt "5 minutes ago" 2>/dev/null | wc -l | tr -d ' ')
log "Updated $UPDATED JSON files"

if [ "$DATA_ONLY" = false ]; then
    log "Dashboard: https://jewish-federation-of-san-diego.github.io/jfsd-ui/"
fi
echo "═══════════════════════════════════════════════" | tee -a "$LOG_FILE"
