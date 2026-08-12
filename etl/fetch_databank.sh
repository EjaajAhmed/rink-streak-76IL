#!/usr/bin/env bash
# Download the Hockey Databank CSVs we need into etl/data/.
# Source: https://github.com/rippinrobr/hockey-databank (end-of-season files
# from the Hockey Databank project). Covers 1909 through the 2017-18 season.
set -euo pipefail

BASE="https://raw.githubusercontent.com/rippinrobr/hockey-databank/master"
DIR="$(cd "$(dirname "$0")" && pwd)/data"
mkdir -p "$DIR"

for f in Master.csv Scoring.csv Goalies.csv Teams.csv abbrev.csv; do
  curl -fsSL -o "$DIR/$f" "$BASE/$f"
  echo "downloaded $f -> $DIR/$f"
done
