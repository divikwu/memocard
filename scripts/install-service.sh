#!/usr/bin/env bash
set -euo pipefail
memocard_root="$(cd "$(dirname "$0")/.." && pwd)"
memocard_user_home="$(cd ~ && pwd)"
memocard_source="$memocard_root/build/local-service"
memocard_apps="$memocard_user_home/Applications"
memocard_bin="$memocard_user_home/.local/bin"

[[ -d "$memocard_source/MemoCardService.app" && -x "$memocard_source/bin/memocard" ]] || {
  echo '请先运行 pnpm build:service。' >&2
  exit 2
}
mkdir -p "$memocard_apps" "$memocard_bin"
/usr/bin/codesign --verify --deep --strict "$memocard_source/MemoCardService.app"
python3 "$memocard_root/scripts/install-tunnel-companion.py" --stop
rm -rf "$memocard_apps/MemoCardService.app"
cp -R "$memocard_source/MemoCardService.app" "$memocard_apps/MemoCardService.app"
cp "$memocard_source/bin/memocard" "$memocard_bin/memocard"
chmod 755 "$memocard_bin/memocard"
/usr/bin/codesign --verify --deep --strict "$memocard_apps/MemoCardService.app"
python3 "$memocard_root/scripts/install-tunnel-companion.py"
echo "Installed $memocard_apps/MemoCardService.app and $memocard_bin/memocard"
