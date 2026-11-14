#!/usr/bin/env python3
"""Attach an already configured private tunnel to MemoCard's lifecycle."""
import os
from pathlib import Path
import plistlib
import subprocess
import sys
import tempfile
import time

home = Path.home()
config = home / '.config/memocard'
label = 'dev.divikwu.memocard.tunnel'
domain = f'gui/{os.getuid()}'
job = f'{domain}/{label}'
plist = home / f'Library/LaunchAgents/{label}.plist'


def stop_job():
    subprocess.run(['launchctl', 'bootout', job], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    # Allow the job's full ExitTimeOut before replacing its executable or plist.
    for _ in range(110):
        if subprocess.run(['launchctl', 'print', job], stdout=subprocess.DEVNULL,
                          stderr=subprocess.DEVNULL).returncode != 0:
            return
        time.sleep(0.1)
    raise SystemExit('Existing tunnel helper did not stop; installation was not changed.')


def write_plist(contents):
    with tempfile.NamedTemporaryFile(dir=plist.parent, delete=False) as stream:
        temporary = Path(stream.name)
        try:
            stream.write(contents)
            stream.flush()
            temporary.replace(plist)
        finally:
            temporary.unlink(missing_ok=True)


if sys.argv[1:] == ['--stop']:
    stop_job()
    raise SystemExit(0)
if sys.argv[1:]:
    raise SystemExit('Usage: install-tunnel-companion.py [--stop]')

if not all(path.is_file() for path in [
    config / '.env.tunnel', config / 'tunnel-profiles/memocard.yaml',
    home / '.local/bin/tunnel-client',
]):
    print('No configured MemoCard tunnel; no background helper installed.')
    raise SystemExit(0)

helper = home / 'Applications/MemoCardService.app/Contents/MacOS/MemoCardTunnel'
if not helper.is_file():
    raise SystemExit('MemoCard tunnel helper is missing; rebuild the service first.')
logs = home / 'Library/Logs/MemoCard'
plist.parent.mkdir(parents=True, exist_ok=True)
logs.mkdir(parents=True, exist_ok=True)
configuration = {
    'Label': label,
    'ProgramArguments': [str(helper)],
    'AssociatedBundleIdentifiers': ['dev.divikwu.memocard.service'],
    'RunAtLoad': True, 'KeepAlive': True, 'ThrottleInterval': 10, 'ExitTimeOut': 10,
    'ProcessType': 'Background', 'Umask': 0o077,
    'EnvironmentVariables': {'HOME': str(home), 'PATH': '/usr/bin:/bin:/usr/sbin:/sbin'},
    'StandardOutPath': str(logs / 'tunnel-launchd.log'),
    'StandardErrorPath': str(logs / 'tunnel-launchd-error.log'),
}
previous = plist.read_bytes() if plist.exists() else None
stop_job()
write_plist(plistlib.dumps(configuration))
try:
    subprocess.run(['launchctl', 'bootstrap', domain, str(plist)], check=True)
except subprocess.CalledProcessError:
    if previous is None:
        plist.unlink(missing_ok=True)
    else:
        write_plist(previous)
        subprocess.run(['launchctl', 'bootstrap', domain, str(plist)], check=True)
    raise
print('MemoCard tunnel now follows the installed MemoCard service.')
