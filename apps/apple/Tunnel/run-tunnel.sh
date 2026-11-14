#!/bin/sh
set -eu
memocard_config="$HOME/.config/memocard"
set -a
. "$memocard_config/.env.tunnel"
set +a
exec "$HOME/.local/bin/tunnel-client" run \
  --profile-dir "$memocard_config/tunnel-profiles" \
  --profile memocard
