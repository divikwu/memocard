#!/usr/bin/env bash
set -euo pipefail
memocard_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$memocard_root"

pnpm --filter @memocard/ui build
mkdir -p apps/apple/Resources/Web
rsync -a --delete apps/ui/dist/ apps/apple/Resources/Web/
python3 scripts/generate-project.py

memocard_xcode_args=(-project apps/apple/MemoCard.xcodeproj -scheme MemoCardService -configuration Release -destination 'platform=macOS' -derivedDataPath build/service-apple)
if [[ -n "${MEMOCARD_TEAM_ID:-}" ]]; then
  memocard_xcode_args+=("DEVELOPMENT_TEAM=$MEMOCARD_TEAM_ID" 'CODE_SIGN_IDENTITY=Apple Development')
else
  memocard_xcode_args+=('CODE_SIGN_IDENTITY=-')
fi
xcodebuild "${memocard_xcode_args[@]}" build

swift build --package-path packages/local-service --configuration release --scratch-path build/service-cli
memocard_stage="$memocard_root/build/local-service"
rm -rf "$memocard_stage"
mkdir -p "$memocard_stage/bin"
cp -R build/service-apple/Build/Products/Release/MemoCardService.app "$memocard_stage/MemoCardService.app"
cp build/service-cli/release/memocard "$memocard_stage/bin/memocard"
echo "Built $memocard_stage/MemoCardService.app and $memocard_stage/bin/memocard"
