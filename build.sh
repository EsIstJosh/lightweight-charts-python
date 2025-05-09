#!/usr/bin/env bash

# Define color codes for output formatting
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Define message prefixes
ERROR="${RED}[ERROR]${NC} "
INFO="${CYAN}[INFO]${NC} "
WARNING="${YELLOW}[WARNING]${NC} "

# Initialize flags
BUILD=false
PACKAGE=false
UPLOAD=false

# Parse command-line options
while getopts ":bpu" opt; do
  case ${opt} in
    b )
      BUILD=true
      ;;
    p )
      PACKAGE=true
      ;;
    u )
      UPLOAD=true
      ;;
    \? )
      echo -e "${ERROR}Invalid option: -$OPTARG" >&2
      exit 1
      ;;
  esac
done

# If no options are provided, default to build only
if [ "$OPTIND" -eq 1 ]; then
  BUILD=true
  # PACKAGE remains false (we'll prompt), UPLOAD remains false
fi

# Function to perform the build process
perform_build() {
  echo -e "${INFO}Starting build process..."

  rm -rf dist/bundle.js dist/typings/
  if [[ $? -eq 0 ]]; then
    echo -e "${INFO}Deleted old build artifacts."
  else
    echo -e "${WARNING}Could not delete old dist files, continuing..."
  fi

  npx rollup -c rollup.config.js
  if [[ $? -ne 0 ]]; then
    echo -e "${ERROR}Rollup build failed."
    exit 1
  fi

  cp dist/bundle.js src/general/styles.css lightweight_charts_esistjosh/js
  if [[ $? -eq 0 ]]; then
    echo -e "${INFO}Copied bundle.js and styles.css into Python package."
  else
    echo -e "${ERROR}Failed to copy build outputs into Python package."
    exit 1
  fi

  echo -e "${GREEN}[BUILD SUCCESS]${NC}"
}

# Function to perform packaging and installation
perform_package() {
  echo -e "${INFO}Starting packaging and installation..."

  VENV_PYTHON="/home/linux/lightweight-charts-python/venv/bin/python"

  sudo "$VENV_PYTHON" -m build --sdist
  if [[ $? -ne 0 ]]; then
    echo -e "${ERROR}Failed to build source distribution."
    exit 1
  fi

  sudo "$VENV_PYTHON" -m build --wheel
  if [[ $? -ne 0 ]]; then
    echo -e "${ERROR}Failed to build wheel distribution."
    exit 1
  fi

  sudo "$VENV_PYTHON" -m pip install .
  if [[ $? -ne 0 ]]; then
    echo -e "${ERROR}Failed to install the package."
    exit 1
  fi

  echo -e "${GREEN}[PACKAGE & INSTALL SUCCESS]${NC}"
}

# Function to perform upload
perform_upload() {
  echo -e "${INFO}Starting upload process..."

  OUTPUT_DIR="./output"
  if [ -d "$OUTPUT_DIR" ]; then
    echo -e "${INFO}Removing existing output directory..."
    sudo rm -rf "$OUTPUT_DIR"
    if [[ $? -ne 0 ]]; then
      echo -e "${ERROR}Failed to remove existing output directory."
      exit 1
    fi
  fi

  mkdir -p "$OUTPUT_DIR"
  if [[ $? -ne 0 ]]; then
    echo -e "${ERROR}Failed to create output directory."
    exit 1
  fi

  shopt -s nullglob
  files=(./dist/*.tar.gz ./dist/*.whl)
  shopt -u nullglob

  if [ ${#files[@]} -eq 0 ]; then
    echo -e "${WARNING}No distribution files found in ./dist/. Skipping upload."
    return
  fi

  mv "${files[@]}" "$OUTPUT_DIR"/
  if [[ $? -ne 0 ]]; then
    echo -e "${ERROR}Failed to move distribution files to output directory."
    exit 1
  fi

  "$VENV_PYTHON" -m twine upload "$OUTPUT_DIR"/*
  if [[ $? -ne 0 ]]; then
    echo -e "${ERROR}Failed to upload distributions to PyPI."
    exit 1
  fi

  echo -e "${GREEN}[UPLOAD SUCCESS]${NC}"
}

# Execute build if requested
if [ "$BUILD" = true ]; then
  perform_build

  # If -p was given, package automatically; otherwise prompt
  if [ "$PACKAGE" = true ]; then
    perform_package
  else
    read -p "Do you want to package and install? (y/n): " answer
    case "$answer" in
      [Yy]* )
        perform_package
        ;;
      * )
        echo -e "${INFO}Skipping packaging."
        ;;
    esac
  fi
fi

# Execute upload only if -u was explicitly passed
if [ "$UPLOAD" = true ]; then
  perform_upload
fi
