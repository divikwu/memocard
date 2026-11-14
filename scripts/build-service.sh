#!/usr/bin/env bash
set -euo pipefail
memocard_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$memocard_root"
if [[ -z "${MEMOCARD_TEAM_ID:-}" && -f "$HOME/.config/memocard/service-signing-team" ]]; then
  MEMOCARD_TEAM_ID="$(cat "$HOME/.config/memocard/service-signing-team")"
fi

if [[ "${MEMOCARD_USE_PREBUILT_UI:-0}" != 1 ]]; then
  pnpm --filter @memocard/ui build
elif [[ ! -s apps/ui/dist/index.html ]]; then
  echo 'MEMOCARD_USE_PREBUILT_UI=1 requires a successful Web build in apps/ui/dist.' >&2
  exit 1
fi
mkdir -p apps/apple/Resources/Web
rsync -a --delete apps/ui/dist/ apps/apple/Resources/Web/
python3 scripts/generate-project.py

# Keep Release permissions declared in Service.entitlements without Xcode's debug entitlement.
memocard_xcode_args=(-project apps/apple/MemoCard.xcodeproj -scheme MemoCardService -configuration Release -destination 'platform=macOS' -derivedDataPath build/service-apple 'CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO')
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
memocard_app="$memocard_stage/MemoCardService.app"
for memocard_arch in arm64 x86_64; do
  swiftc -O -target "$memocard_arch-apple-macos14.0" apps/apple/Tunnel/TunnelCompanion.swift apps/apple/Tunnel/main.swift \
    -o "$memocard_stage/MemoCardTunnel.$memocard_arch"
done
lipo -create "$memocard_stage/MemoCardTunnel.arm64" "$memocard_stage/MemoCardTunnel.x86_64" \
  -output "$memocard_app/Contents/MacOS/MemoCardTunnel"
rm "$memocard_stage/MemoCardTunnel.arm64" "$memocard_stage/MemoCardTunnel.x86_64"
cp apps/apple/Tunnel/run-tunnel.sh "$memocard_app/Contents/Resources/run-tunnel.sh"
memocard_signing_identity=-
if [[ -n "${MEMOCARD_TEAM_ID:-}" ]]; then
  # Use the exact certificate selected by Xcode, even with multiple teams installed.
  memocard_certificates="$(mktemp -d)"
  trap 'rm -rf "$memocard_certificates"' EXIT
  codesign --display --extract-certificates="$memocard_certificates/cert" "$memocard_app"
  memocard_fingerprint="$(openssl x509 -inform DER -in "$memocard_certificates/cert0" -noout -sha1 -fingerprint)"
  memocard_signing_identity="${memocard_fingerprint#*=}"
  memocard_signing_identity="${memocard_signing_identity//:/}"
fi
codesign --force --options runtime --sign "$memocard_signing_identity" \
  --identifier dev.divikwu.memocard.service.tunnel "$memocard_app/Contents/MacOS/MemoCardTunnel"
codesign --force --sign "$memocard_signing_identity" \
  --preserve-metadata=identifier,entitlements,flags,runtime "$memocard_app"
codesign --verify --deep --strict "$memocard_app"
cp build/service-cli/release/memocard "$memocard_stage/bin/memocard"
echo "Built $memocard_stage/MemoCardService.app and $memocard_stage/bin/memocard"
