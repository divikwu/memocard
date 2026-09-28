#!/usr/bin/env bash
set -euo pipefail
memocard_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$memocard_root"
pnpm --filter @memocard/ui build
mkdir -p apps/apple/Resources/Web
rsync -a --delete apps/ui/dist/ apps/apple/Resources/Web/
python3 scripts/generate-project.py
memocard_platform="${1:-mac}"
memocard_args=(-project apps/apple/MemoCard.xcodeproj -configuration Debug -derivedDataPath build/apple)
if [[ "$memocard_platform" == mac ]]; then
  memocard_args+=(-scheme MemoCardMac -destination 'platform=macOS')
  if [[ -n "${MEMOCARD_TEAM_ID:-}" ]]; then
    memocard_args+=("DEVELOPMENT_TEAM=$MEMOCARD_TEAM_ID" 'CODE_SIGN_IDENTITY=Apple Development')
  else
    memocard_args+=('CODE_SIGN_IDENTITY=-')
  fi
elif [[ "$memocard_platform" == ios ]]; then
  memocard_args+=(-scheme MemoCardiOS)
  if [[ -n "${MEMOCARD_IOS_UDID:-}" && -n "${MEMOCARD_TEAM_ID:-}" ]]; then
    memocard_args+=(-destination "id=$MEMOCARD_IOS_UDID" "DEVELOPMENT_TEAM=$MEMOCARD_TEAM_ID" -allowProvisioningUpdates)
  else
    memocard_args+=(-destination 'generic/platform=iOS Simulator' 'CODE_SIGNING_ALLOWED=NO')
  fi
else
  echo 'Usage: build-apple.sh mac|ios' >&2
  exit 2
fi
xcodebuild "${memocard_args[@]}" build
