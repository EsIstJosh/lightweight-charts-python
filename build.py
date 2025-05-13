import os
import shutil
import subprocess

# Terminal color codes for output
GREEN = '\033[0;32m'
RED = '\033[0;31m'
CYAN = '\033[0;36m'
NC = '\033[0m'

def log_info(message):
    print(f"{CYAN}[INFO]{NC} {message}")

def log_error(message):
    print(f"{RED}[ERROR]{NC} {message}")

def log_success(message):
    print(f"{GREEN}[SUCCESS]{NC} {message}")

# 1. Remove old build files
dist_paths = ['dist/bundle.js', 'dist/typings']
for path in dist_paths:
    if os.path.exists(path):
        if os.path.isfile(path):
            os.remove(path)
        elif os.path.isdir(path):
            shutil.rmtree(path)
log_info("Deleted old build files.")

# 2. Run Rollup
log_info("Running Rollup...")
try:
    subprocess.run(['npx', 'rollup', '-c', 'rollup.config.js'], check=True, shell=True)
    log_success("Rollup build completed successfully.")
except subprocess.CalledProcessError:
    log_error("Rollup build failed.")
    exit(1)

# 3. Copy files to the Python package
log_info("Copying files to the Python package...")
try:
    shutil.copy('dist/bundle.js', 'lightweight_charts/js/')
    shutil.copy('src/general/styles.css', 'lightweight_charts/js/')
    log_success("Copied files to the Python package.")
except FileNotFoundError as e:
    log_error(f"File copy failed: {e}")
    exit(1)

log_success("[BUILD SUCCESS]")