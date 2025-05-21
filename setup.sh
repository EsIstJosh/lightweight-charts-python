#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# ─── Locate or create Python virtualenv ──────────────────────────────────────
# Preference: ./venv, then ./.venv, else prompt to create ./venv
if [ -x "./venv/bin/python" ]; then
  VENV_PYTHON="./venv/bin/python"
elif [ -x "./.venv/bin/python" ]; then
  VENV_PYTHON="./.venv/bin/python"
else
  read -rp "No Python venv found in './venv' or './.venv'. Create one in './venv'? [Y/n]: " _ans
  if [[ "${_ans:-Y}" =~ ^[Yy]$ ]]; then
    echo "Creating virtualenv in ./venv…"
    sudo python3 -m venv ./venv
    echo "Virtualenv created."
    VENV_PYTHON="./venv/bin/python"
  else
    # fallback to system python3
    VENV_PYTHON="$(command -v python3)"
    echo "Using interpreter: $VENV_PYTHON"
  fi
fi

# ─── Color codes ─────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'   # bright black (gray)
NC='\033[0m'        # No Color

ERROR="${RED}[ERROR]${NC} "
INFO="${CYAN}[INFO]${NC} "
WARNING="${YELLOW}[WARNING]${NC} "

# ─── Helpers ────────────────────────────────────────────────────────────────
humanize(){
  # if no argument is passed, default T to 0
  local T="${1:-0}"
  local M=$((T/60))
  local S=$((T%60))
  (( M>0 )) && printf "%dm%02ds" "$M" "$S" || printf "%ds" "$S"
}

# ─── Actions ────────────────────────────────────────────────────────────────
perform_install(){
  echo -e "${INFO}Running npm install…"
  sudo npm install --force || { echo -e "${ERROR}npm install failed."; return 1; }
  echo -e "${GREEN}[INSTALL SUCCESS]${NC}"
}

perform_build(){
  echo -e "${INFO}Starting build process…"
  rm -rf dist/bundle.js dist/typings/ || echo -e "${WARNING}No old artifacts to clean"
  npx rollup -c rollup.config.js || { echo -e "${ERROR}Rollup build failed."; return 1; }
  cp dist/bundle.js src/general/styles.css lightweight_charts_esistjosh/js/ \
    || { echo -e "${ERROR}Failed to copy build outputs."; return 1; }
  echo -e "${GREEN}[BUILD SUCCESS]${NC}"
}

perform_package(){
  echo -e "${INFO}Starting packaging & installation…"
  sudo "$VENV_PYTHON" -m build --sdist --wheel || { echo -e "${ERROR}Packaging failed."; return 1; }
  sudo "$VENV_PYTHON" -m pip install .       || { echo -e "${ERROR}Installation failed."; return 1; }
  echo -e "${GREEN}[PACKAGE & INSTALL SUCCESS]${NC}"
}

perform_upload(){
  echo -e "${INFO}Starting upload process…"
  OUTPUT_DIR="./output"; rm -rf "$OUTPUT_DIR"; mkdir -p "$OUTPUT_DIR"
  shopt -s nullglob
  files=(dist/*.tar.gz dist/*.whl); shopt -u nullglob

  if (( ${#files[@]} == 0 )); then
    echo -e "${WARNING}No artifacts to upload."; return 0
  fi

  mv "${files[@]}" "$OUTPUT_DIR"/ || { echo -e "${ERROR}Move failed."; return 1; }
  "$VENV_PYTHON" -m pip install --upgrade twine >/dev/null

  echo -e "${INFO}Uploading to PyPI…"
  "$VENV_PYTHON" -m twine upload --verbose "$OUTPUT_DIR"/* || { echo -e "${ERROR}Twine upload failed."; return 1; }
  echo -e "${GREEN}[UPLOAD SUCCESS]${NC}"
}

# ── Legacy flags support ────────────────────────────────────────────────────
if [ $# -gt 0 ]; then
  INSTALL=false; BUILD=false; PACKAGE=false; UPLOAD=false

  # note the added 'i' in the getopts string
  while getopts ":ibpu" opt; do
    case "$opt" in
      i) INSTALL=true ;;
      b) BUILD=true   ;;
      p) PACKAGE=true ;;
      u) UPLOAD=true; PACKAGE=true; BUILD=true ;;
      \?) echo -e "${ERROR}Invalid option -$OPTARG"; exit 1 ;;
    esac
  done
  # default to build if nothing
  if ! $INSTALL && ! $BUILD && ! $PACKAGE && ! $UPLOAD; then BUILD=true; fi

  # run in this order: install → build → package → upload
  install_dur=0; build_dur=0; package_dur=0; upload_dur=0
  $INSTALL && { t0=$(date +%s); perform_install; t1=$(date +%s); install_dur=$((t1-t0)); }
  $BUILD   && { t0=$(date +%s); perform_build;   t1=$(date +%s); build_dur=$((t1-t0));   }
  $PACKAGE && { t0=$(date +%s); perform_package; t1=$(date +%s); package_dur=$((t1-t0)); }
  $UPLOAD  && { t0=$(date +%s); perform_upload;  t1=$(date +%s); upload_dur=$((t1-t0));  }

  echo -e "${GREEN}Done!${NC}"
  (( install_dur>0 )) && echo "Install: $(humanize $install_dur)"
  (( build_dur>0 ))   && echo "Build:   $(humanize $build_dur)"
  (( package_dur>0 )) && echo "Package: $(humanize $package_dur)"
  (( upload_dur>0 ))  && echo "Upload:  $(humanize $upload_dur)"
  echo "Total:   $(humanize $((install_dur+build_dur+package_dur+upload_dur)))"
  exit 0
fi

# ── Interactive menu ────────────────────────────────────────────────────────
  echo -e "${CYAN}╔══════════════════════════════════╗${NC}"
  echo -e "${CYAN}║   Welcome to the Build Script    ║${NC}"
  echo -e "${CYAN}╠══════════════════════════════════╣${NC}"

  if [ -d node_modules ]; then
  echo -e "${GRAY}║ 0) npm install (-i) ${GREEN}[INSTALLED]${GRAY}  ║${NC}"
  else
  echo -e "${CYAN}║ 0) npm install (-i)            ║${NC}"
  fi

echo -e "${CYAN}║ 1) Build (rollup) (-b)           ║${NC}"
echo -e "${CYAN}║ 2) Package & Install (pip) (-p)  ║${NC}"
echo -e "${CYAN}║ 3) Upload to PyPI (-u)           ║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════╝${NC}"

# <-- updated prompt below -->
read -rp "Select option [0-3] or [Enter]: " opt
  
# interactive durations
install_dur=0; build_dur=0; package_dur=0; upload_dur=0

# 0 → install
if [[ "$opt" == "0" ]]; then
  t0=$(date +%s); perform_install; t1=$(date +%s)
  install_dur=$((t1-t0))
fi

# full flow (Enter): install if needed
if [[ -z "$opt" ]]; then
  if [ ! -d node_modules ]; then
    t0=$(date +%s); perform_install; t1=$(date +%s)
    install_dur=$((t1-t0))
    fi
fi

# build? on 1 or Enter
if [[ "$opt" == "1" || -z "$opt" ]]; then
  t0=$(date +%s); perform_build; t1=$(date +%s)
  build_dur=$((t1-t0))
fi

# package? on 2 or Enter
if [[ "$opt" == "2" || -z "$opt" ]]; then
  t0=$(date +%s); perform_package; t1=$(date +%s)
  package_dur=$((t1-t0))
fi

# upload only on 3
if [[ "$opt" == "3" ]]; then
  t0=$(date +%s); perform_upload; t1=$(date +%s)
  upload_dur=$((t1-t0))
fi

echo -e "${GREEN}Done!${NC}"
(( install_dur>0 )) && echo "Install: $(humanize "$install_dur")"
(( build_dur>0 ))   && echo "Build:   $(humanize "$build_dur")"
(( package_dur>0 )) && echo "Package: $(humanize "$package_dur")"
(( upload_dur>0 ))  && echo "Upload:  $(humanize "$upload_dur")"
echo "Total:   $(humanize "$((install_dur+build_dur+package_dur+upload_dur))")"
