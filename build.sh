#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# ─── Configurable Python binary ─────────────────────────────────────────────
VENV_PYTHON="${VENV_PYTHON:-/home/linux/lightweight-charts-python/venv/bin/python}"

# ─── Color codes ─────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'  # No Color

# ─── Message prefixes ───────────────────────────────────────────────────────
ERROR="${RED}[ERROR]${NC} "
INFO="${CYAN}[INFO]${NC} "
WARNING="${YELLOW}[WARNING]${NC} "

# ─── Flags ───────────────────────────────────────────────────────────────────
BUILD=false
PACKAGE=false
UPLOAD=false

# ─── Parse command-line options ─────────────────────────────────────────────
while getopts ":bpu" opt; do
  case "${opt}" in
    b )
      BUILD=true
      ;;
    p )
      PACKAGE=true
      ;;
    u )
      UPLOAD=true
      PACKAGE=true   # ensure package runs before upload
      BUILD=true     # ensure build runs before package
      ;;
    \? )
      echo -e "${ERROR}Invalid option: -$OPTARG" >&2
      exit 1
      ;;
  esac
done

# ─── Default to build if no flags provided ──────────────────────────────────
if ! $BUILD && ! $PACKAGE && ! $UPLOAD; then
  BUILD=true
fi

# ─── Build process ──────────────────────────────────────────────────────────
perform_build() {
  echo -e "${INFO}Starting build process..."
  rm -rf dist/bundle.js dist/typings/ || echo -e "${WARNING}No old artifacts to clean"
  npx rollup -c rollup.config.js || { echo -e "${ERROR}Rollup build failed."; exit 1; }
  cp dist/bundle.js src/general/styles.css lightweight_charts_esistjosh/js/ \
    || { echo -e "${ERROR}Failed to copy build outputs."; exit 1; }
  echo -e "${GREEN}[BUILD SUCCESS]${NC}"
}

# ─── Package & install ───────────────────────────────────────────────────────
perform_package() {
  echo -e "${INFO}Starting packaging & installation..."
  sudo "$VENV_PYTHON" -m build --sdist --wheel \
    || { echo -e "${ERROR}Packaging failed."; exit 1; }
  sudo "$VENV_PYTHON" -m pip install . \
    || { echo -e "${ERROR}Installation failed."; exit 1; }
  echo -e "${GREEN}[PACKAGE & INSTALL SUCCESS]${NC}"
}

# ─── Upload to PyPI ──────────────────────────────────────────────────────────
perform_upload() {
  echo -e "${INFO}Starting upload process..."
  OUTPUT_DIR="./output"
  rm -rf "$OUTPUT_DIR"
  mkdir -p "$OUTPUT_DIR"

  shopt -s nullglob
  files=(dist/*.tar.gz dist/*.whl)
  shopt -u nullglob

  if [ ${#files[@]} -eq 0 ]; then
    echo -e "${WARNING}No distribution files found; skipping upload."
    return
  fi

  mv "${files[@]}" "$OUTPUT_DIR"/ \
    || { echo -e "${ERROR}Failed to move artifacts to ${OUTPUT_DIR}."; exit 1; }

  # ensure twine is available
  "$VENV_PYTHON" -m pip install --upgrade twine >/dev/null

  echo -e "${INFO}Uploading to PyPI…"
  if ! "$VENV_PYTHON" -m twine upload --verbose "$OUTPUT_DIR"/*; then
    echo -e "${ERROR}Twine upload failed. Check credentials and network."
    exit 1
  fi

  echo -e "${GREEN}[UPLOAD SUCCESS]${NC}"
}

# ─── Execution order ─────────────────────────────────────────────────────────
if $BUILD; then
  perform_build
fi

if $PACKAGE; then
  perform_package
fi

if $UPLOAD; then
  perform_upload
fi
