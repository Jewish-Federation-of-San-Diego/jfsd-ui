#!/usr/bin/env python3
"""
refresh-data.py — Orchestrator for all JFSD-UI data generators.

Runs each generate-*.py script in sequence, captures output, and reports results.
Partial failures don't stop the pipeline — every source gets attempted.

Usage:
    python3 refresh-data.py                    # Run all generators
    python3 refresh-data.py --source stripe    # Run one generator
    python3 refresh-data.py --source stripe,ramp  # Run multiple
    python3 refresh-data.py --fast             # Skip slow generators (donor_data, hubspot)
"""

import subprocess
import sys
import time
import json
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / "public" / "data"

# Generator registry: name → script → output file → estimated time
GENERATORS = [
    # Fast generators (< 30s each)
    {"name": "campaign",    "script": "generate-campaign-data.py",   "output": "campaign-tracker.json",    "slow": False},
    {"name": "stripe",      "script": "generate-stripe-data.py",     "output": "stripe.json",              "slow": False},
    {"name": "ramp",        "script": "generate-ramp-data.py",       "output": "ramp-analytics.json",      "slow": False},
    {"name": "givecloud",   "script": "generate-givecloud-data.py",  "output": "givecloud.json",           "slow": False},
    {"name": "facilities",  "script": "generate-facilities-data.py", "output": "facilities.json",          "slow": False},
    {"name": "financial",   "script": "generate-financial-data.py",  "output": "financial-statements.json","slow": False},
    {"name": "board",       "script": "generate-board-data.py",      "output": "board-reporting.json",     "slow": False},
    {"name": "donor-health","script": "generate-sharon-data.py",     "output": "sharon-donor-health.json", "slow": False},
    {"name": "ap-expense",  "script": "generate-james-data.py",      "output": "james-ap-expense.json",    "slow": False},
    {"name": "data-quality","script": "generate-data-quality.py",    "output": "data-quality.json",        "slow": False},
    {"name": "project",     "script": "generate-project-tracker.py", "output": "project-tracker.json",     "slow": False},
    
    # Medium generators (30-60s)
    {"name": "drm",         "script": "generate-drm-data.py",        "output": "drm-portfolio.json",       "slow": False},
    {"name": "pledge",      "script": "generate-pledge-data.py",     "output": "pledge-management.json",   "slow": False},
    {"name": "prospect",    "script": "generate-prospect-data.py",   "output": "prospect-research.json",   "slow": False},
    {"name": "ask-list",    "script": "generate-ask-list.py",        "output": "weekly-ask-list.json",     "slow": False},
    {"name": "silence",     "script": "generate-silence-alerts.py",  "output": "silence-alerts.json",      "slow": False},
]

def run_generator(gen: dict, verbose: bool = True) -> dict:
    """Run a single generator script and return result."""
    script_path = SCRIPT_DIR / gen["script"]
    output_path = DATA_DIR / gen["output"]
    
    if not script_path.exists():
        return {"name": gen["name"], "status": "skip", "reason": f"Script not found: {gen['script']}", "time": 0}
    
    # Get file size before
    size_before = output_path.stat().st_size if output_path.exists() else 0
    
    start = time.time()
    try:
        # Run from workspace root so relative paths in sf-query.js resolve correctly
        workspace_root = SCRIPT_DIR.parent.parent.parent.parent  # ~/clawd
        result = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True, text=True, timeout=300,
            cwd=str(workspace_root)
        )
        elapsed = time.time() - start
        
        # Get file size after
        size_after = output_path.stat().st_size if output_path.exists() else 0
        
        if result.returncode == 0:
            status = "ok"
            # Validate JSON
            try:
                with open(output_path) as f:
                    data = json.load(f)
                records = len(data) if isinstance(data, list) else "object"
            except Exception:
                records = "?"
            
            msg = f"✅ {gen['name']:15s} {elapsed:5.1f}s  {size_after:>10,}B  ({records} records)"
        else:
            status = "error"
            err_preview = (result.stderr or result.stdout or "unknown error")[:200]
            msg = f"❌ {gen['name']:15s} {elapsed:5.1f}s  ERROR: {err_preview}"
        
        if verbose:
            print(msg, file=sys.stderr)
        
        return {
            "name": gen["name"],
            "status": status,
            "time": round(elapsed, 1),
            "size_before": size_before,
            "size_after": size_after,
            "error": result.stderr[:500] if result.returncode != 0 else None,
        }
        
    except subprocess.TimeoutExpired:
        elapsed = time.time() - start
        msg = f"⏱️ {gen['name']:15s} {elapsed:5.1f}s  TIMEOUT (300s limit)"
        if verbose:
            print(msg, file=sys.stderr)
        return {"name": gen["name"], "status": "timeout", "time": round(elapsed, 1)}
    
    except Exception as e:
        elapsed = time.time() - start
        msg = f"💥 {gen['name']:15s} {elapsed:5.1f}s  EXCEPTION: {str(e)[:200]}"
        if verbose:
            print(msg, file=sys.stderr)
        return {"name": gen["name"], "status": "exception", "time": round(elapsed, 1), "error": str(e)[:500]}


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Refresh JFSD-UI dashboard data")
    parser.add_argument("--source", type=str, help="Comma-separated list of sources to refresh")
    parser.add_argument("--fast", action="store_true", help="Skip slow generators")
    parser.add_argument("--quiet", action="store_true", help="Minimal output")
    args = parser.parse_args()
    
    # Filter generators
    generators = GENERATORS
    if args.source:
        names = [s.strip() for s in args.source.split(",")]
        generators = [g for g in generators if g["name"] in names]
        if not generators:
            print(f"No matching generators for: {args.source}", file=sys.stderr)
            print(f"Available: {', '.join(g['name'] for g in GENERATORS)}", file=sys.stderr)
            sys.exit(1)
    
    if args.fast:
        generators = [g for g in generators if not g["slow"]]
    
    # Run
    verbose = not args.quiet
    total_start = time.time()
    
    if verbose:
        print(f"\n{'='*60}", file=sys.stderr)
        print(f"JFSD-UI Data Refresh — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", file=sys.stderr)
        print(f"Running {len(generators)} generators...", file=sys.stderr)
        print(f"{'='*60}\n", file=sys.stderr)
    
    results = []
    for gen in generators:
        r = run_generator(gen, verbose=verbose)
        results.append(r)
    
    total_time = time.time() - total_start
    
    # Summary
    ok = sum(1 for r in results if r["status"] == "ok")
    errors = sum(1 for r in results if r["status"] in ("error", "timeout", "exception"))
    skipped = sum(1 for r in results if r["status"] == "skip")
    total_bytes = sum(r.get("size_after", 0) for r in results)
    
    if verbose:
        print(f"\n{'='*60}", file=sys.stderr)
        print(f"Complete: {ok}/{len(results)} succeeded, {errors} errors, {skipped} skipped", file=sys.stderr)
        print(f"Total time: {total_time:.1f}s | Total data: {total_bytes:,}B", file=sys.stderr)
        print(f"{'='*60}\n", file=sys.stderr)
    
    # Write refresh manifest
    manifest = {
        "refreshedAt": datetime.now().isoformat(),
        "totalTime": round(total_time, 1),
        "results": results,
        "summary": {"ok": ok, "errors": errors, "skipped": skipped, "totalBytes": total_bytes},
    }
    manifest_path = DATA_DIR / "refresh-manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    
    # Output summary as JSON for callers
    print(json.dumps(manifest["summary"]))
    
    # Exit with error code if anything failed
    sys.exit(1 if errors > 0 else 0)


if __name__ == "__main__":
    main()
