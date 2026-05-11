#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

OWNER=$(gh api user -q '.login' 2>/dev/null || true)
if [ -z "$OWNER" ]; then
  echo "❌ You are not logged into GitHub CLI. Run: gh auth login"
  exit 1
fi

REPO_NAME=$(basename "$(gh repo view --json name -q '.name' 2>/dev/null)")
if [ -z "$REPO_NAME" ]; then
  echo "❌ Could not detect current repo. Make sure you're inside a GitHub repo with gh CLI."
  exit 1
fi

echo "👤 Detected GitHub owner: $OWNER"
echo "📦 Current repo: $OWNER/$REPO_NAME"
echo ""

# Create Scoop bucket repo
echo "📁 Creating scoop-marpeditor repo..."
if gh repo view "$OWNER/scoop-marpeditor" >/dev/null 2>&1; then
  echo "   ✅ scoop-marpeditor already exists"
else
  gh repo create "$OWNER/scoop-marpeditor" --public --description "Scoop bucket for MarpEditor" || true
  echo "   ✅ Created $OWNER/scoop-marpeditor"
fi

# Create Homebrew tap repo
echo "📁 Creating homebrew-marpeditor repo..."
if gh repo view "$OWNER/homebrew-marpeditor" >/dev/null 2>&1; then
  echo "   ✅ homebrew-marpeditor already exists"
else
  gh repo create "$OWNER/homebrew-marpeditor" --public --description "Homebrew tap for MarpEditor" || true
  echo "   ✅ Created $OWNER/homebrew-marpeditor"
fi

echo ""
echo "─────────────────────────────────────────────"
echo "🔐 Now you need to add a Personal Access Token (PAT)"
echo ""
echo "1. Go to: https://github.com/settings/tokens/new"
echo "2. Select scope: 'repo' (full control)"
echo "3. Generate and copy the token"
echo ""
read -rsp "Paste your PAT here (input hidden): " PAT
echo ""
echo ""

echo "🔒 Adding TAP_PUSH_TOKEN secret to $OWNER/$REPO_NAME..."
if echo "$PAT" | gh secret set TAP_PUSH_TOKEN --repo "$OWNER/$REPO_NAME" >/dev/null 2>&1; then
  echo "   ✅ Secret added successfully"
else
  echo "   ❌ Failed to add secret. Make sure you have admin access to the repo."
  exit 1
fi

echo ""
echo "🎉 Done! Your CI will now auto-update Scoop and Homebrew on every release."
echo ""
echo "Users will be able to install via:"
echo ""
echo "  macOS:   brew tap $OWNER/marpeditor && brew install --cask marpeditor"
echo "  Windows: scoop bucket add marpeditor https://github.com/$OWNER/scoop-marpeditor"
echo "           scoop install marpeditor"
