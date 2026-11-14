import json
import os
from pathlib import Path
import plistlib
import subprocess
import sys
import tempfile
import unittest

INSTALLER = Path(__file__).with_name('install-tunnel-companion.py')


class TunnelInstallerTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.home = Path(self.directory.name)
        self.bin = self.home / 'bin'
        self.bin.mkdir()
        self.trace = self.home / 'trace.jsonl'
        self.plist = self.home / 'Library/LaunchAgents/dev.divikwu.memocard.tunnel.plist'
        fake = self.bin / 'launchctl'
        fake.write_text(f'''#!{sys.executable}
import json, os, sys
from pathlib import Path
root = Path(os.environ['HOME'])
args = sys.argv[1:]
with (root / 'trace.jsonl').open('a') as f: f.write(json.dumps(args) + '\\n')
running = root / 'running'
if args[0] == 'bootout': running.unlink(missing_ok=True)
if args[0] == 'print': sys.exit(0 if running.exists() else 113)
if args[0] == 'bootstrap':
    fail = root / 'fail-once'
    if fail.exists():
        fail.unlink()
        sys.exit(5)
    running.touch()
''')
        fake.chmod(0o755)
        self.env = dict(os.environ, HOME=str(self.home), PATH=str(self.bin) + os.pathsep + os.environ['PATH'])

    def configure(self):
        for name in ['.config/memocard/.env.tunnel', '.config/memocard/tunnel-profiles/memocard.yaml',
                     '.local/bin/tunnel-client', 'Applications/MemoCardService.app/Contents/MacOS/MemoCardTunnel']:
            p = self.home / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text('private-fixture-value')

    def run_installer(self, *args):
        return subprocess.run([sys.executable, str(INSTALLER), *args], env=self.env,
                              text=True, capture_output=True, timeout=20)

    def test_no_configuration_does_not_install_or_contact_launchd(self):
        result = self.run_installer()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.plist.exists())
        self.assertFalse(self.trace.exists())

    def test_install_associates_bundled_helper_without_copying_credentials(self):
        self.configure()
        result = self.run_installer()
        self.assertEqual(result.returncode, 0, result.stderr)
        data = plistlib.loads(self.plist.read_bytes())
        self.assertEqual(data['AssociatedBundleIdentifiers'], ['dev.divikwu.memocard.service'])
        self.assertEqual(data['ProgramArguments'], [str(self.home / 'Applications/MemoCardService.app/Contents/MacOS/MemoCardTunnel')])
        self.assertTrue(data['RunAtLoad'])
        self.assertTrue(data['KeepAlive'])
        self.assertEqual(self.plist.stat().st_mode & 0o777, 0o600)
        self.assertNotIn('private-fixture-value', self.plist.read_text() + result.stdout + result.stderr)
        calls = [json.loads(line)[0] for line in self.trace.read_text().splitlines()]
        self.assertEqual(calls, ['bootout', 'print', 'bootstrap'])

    def test_bootstrap_failure_restores_previous_plist_and_restarts_it(self):
        self.configure()
        self.plist.parent.mkdir(parents=True)
        previous = plistlib.dumps({'Label': 'previous', 'ProgramArguments': ['/original/helper']})
        self.plist.write_bytes(previous)
        (self.home / 'running').touch()
        (self.home / 'fail-once').touch()
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.plist.read_bytes(), previous)
        self.assertTrue((self.home / 'running').exists())
        self.assertEqual(list(self.plist.parent.iterdir()), [self.plist])

    def test_failed_first_install_does_not_leave_a_broken_login_item(self):
        self.configure()
        (self.home / 'fail-once').touch()
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.plist.exists())
        self.assertFalse((self.home / 'running').exists())

    def test_stop_works_even_if_configuration_was_removed(self):
        (self.home / 'running').touch()
        result = self.run_installer('--stop')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse((self.home / 'running').exists())
        self.assertFalse(self.plist.exists())


if __name__ == '__main__':
    unittest.main()
