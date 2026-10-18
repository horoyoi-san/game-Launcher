"""Compatibility entry point for the launcher's embedded Thai beta text tool."""
import os
import runpy
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(ROOT, 'internal', 'language-service', 'thai_text.py')
if '--dispatch-root' not in sys.argv[1:]:
    sys.argv.extend(['--dispatch-root', os.path.join(ROOT, 'server')])
runpy.run_path(SCRIPT, run_name='__main__')
