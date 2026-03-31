#!/usr/bin/env bash
set -euo pipefail

vale sync --config .vale.ini

find . -path './.git' -prune -o -name 'README.md' -path '*/.nurburgdev/*' -print \
  | xargs vale --config .vale.ini
