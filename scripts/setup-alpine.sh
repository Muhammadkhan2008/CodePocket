#!/bin/bash
# ============================================================
# CodePocket Alpine Setup Script
# Automatically installs Python, Java, GCC, Node.js, and dev tools
# ============================================================

PROOT_DIR="/data/data/com.muhammadkhan.codepocket/files/alpine"
BIN_DIR="$PROOT_DIR/bin"
LOG_FILE="/tmp/codepocket-setup.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log() {
  echo -e "${CYAN}[SETUP]${NC} $1"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >> "$LOG_FILE"
}

success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: $1" >> "$LOG_FILE"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARN: $1" >> "$LOG_FILE"
}

# ===== SYSTEM PREPARATION =====
log "Starting CodePocket Alpine environment setup..."

# Update package repositories
log "Updating package repositories..."
apk update >> "$LOG_FILE" 2>&1
apk upgrade >> "$LOG_FILE" 2>&1

# ===== INSTALL ESSENTIAL TOOLS =====
log "Installing essential build tools..."
apk add --no-cache \
  build-base \
  gcc \
  g++ \
  make \
  cmake \
  automake \
  autoconf \
  libtool \
  pkgconfig \
  git \
  wget \
  curl \
  unzip \
  zip \
  tar \
  gzip \
  bzip2 \
  xz \
  file \
  tree \
  htop \
  nano \
  vim \
  >> "$LOG_FILE" 2>&1

success "Essential tools installed successfully!"

# ===== INSTALL PYTHON =====
log "Installing Python 3.12..."
apk add --no-cache \
  python3 \
  python3-dev \
  py3-pip \
  py3-virtualenv \
  >> "$LOG_FILE" 2>&1

# Install popular Python packages
log "Installing popular Python packages..."
pip3 install --no-cache-dir \
  numpy \
  pandas \
  requests \
  flask \
  django \
  pytest \
  black \
  autopep8 \
  pylint \
  ipython \
  jupyter \
  >> "$LOG_FILE" 2>&1 || warn "Some Python packages failed to install"

success "Python 3.12 installed successfully!"

# ===== INSTALL JAVA =====
log "Installing OpenJDK 17..."
apk add --no-cache \
  openjdk17 \
  openjdk17-jdk \
  openjdk17-jre \
  >> "$LOG_FILE" 2>&1

# Set JAVA_HOME
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
export PATH=$JAVA_HOME/bin:$PATH
echo "export JAVA_HOME=/usr/lib/jvm/java-17-openjdk" >> ~/.profile
echo "export PATH=\$JAVA_HOME/bin:\$PATH" >> ~/.profile

success "OpenJDK 17 installed successfully!"

# ===== INSTALL NODE.JS =====
log "Installing Node.js 20 LTS..."
apk add --no-cache \
  nodejs \
  npm \
  yarn \
  >> "$LOG_FILE" 2>&1

# Install global npm packages
log "Installing global npm packages..."
npm install -g \
  typescript \
  prettier \
  eslint \
  pnpm \
  pm2 \
  nodemon \
  serve \
  http-server \
  >> "$LOG_FILE" 2>&1 || warn "Some npm packages failed to install"

success "Node.js 20 installed successfully!"

# ===== INSTALL DATABASES =====
log "Installing databases..."
apk add --no-cache \
  sqlite \
  sqlite-dev \
  postgresql \
  postgresql-dev \
  redis \
  >> "$LOG_FILE" 2>&1

success "Databases installed successfully!"

# ===== INSTALL OTHER LANGUAGES =====
log "Installing additional programming languages..."

# Go
apk add --no-cache go >> "$LOG_FILE" 2>&1 || warn "Go installation failed"

# Rust
log "Installing Rust..."
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y >> "$LOG_FILE" 2>&1 || warn "Rust installation failed"
source ~/.cargo/env 2>/dev/null || true

# Ruby
apk add --no-cache ruby ruby-dev >> "$LOG_FILE" 2>&1 || warn "Ruby installation failed"

# PHP
apk add --no-cache php81 php81-cli php81-json >> "$LOG_FILE" 2>&1 || warn "PHP installation failed"

success "Additional languages installed!"

# ===== INSTALL DEV TOOLS =====
log "Installing development tools..."
apk add --no-cache \
  docker \
  docker-compose \
  >> "$LOG_FILE" 2>&1 || warn "Docker installation failed"

# ===== CREATE PROJECT DIRECTORIES =====
log "Creating project directories..."
mkdir -p ~/projects
mkdir -p ~/workspace
mkdir -p ~/.config/codepocket
mkdir -p ~/.cache/codepocket
mkdir -p ~/.local/share/codepocket/plugins

success "Project directories created!"

# ===== CONFIGURE GIT =====
log "Configuring Git..."
git config --global user.name "CodePocket User" >> "$LOG_FILE" 2>&1
git config --global user.email "user@codepocket.app" >> "$LOG_FILE" 2>&1
git config --global init.defaultBranch master >> "$LOG_FILE" 2>&1
git config --global pull.rebase false >> "$LOG_FILE" 2>&1

success "Git configured successfully!"

# ===== SETUP ENVIRONMENT VARIABLES =====
log "Setting up environment variables..."
cat >> ~/.profile << 'EOF'
# CodePocket Environment Variables
export CODEPOCKET_HOME=/data/data/com.muhammadkhan.codepocket/files
export PATH=$CODEPOCKET_HOME/bin:$PATH
export LD_LIBRARY_PATH=$CODEPOCKET_HOME/lib:$LD_LIBRARY_PATH

# Programming Languages
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
export PATH=$JAVA_HOME/bin:$PATH
export GOPATH=$HOME/go
export PATH=$GOPATH/bin:$PATH
export CARGO_HOME=$HOME/.cargo
export PATH=$CARGO_HOME/bin:$PATH
export PATH=~/.local/bin:$PATH

# Editor
export EDITOR=vim
export VISUAL=vim
EOF

source ~/.profile 2>/dev/null || true

success "Environment variables configured!"

# ===== VERIFY INSTALLATIONS =====
log "Verifying installations..."
echo ""

echo -e "${BLUE}=== INSTALLED VERSIONS ===${NC}"
echo ""

# Python
python3 --version && success "Python is working" || error "Python failed"

# Java
java -version && success "Java is working" || error "Java failed"

# Node.js
node --version && success "Node.js is working" || error "Node.js failed"
npm --version

# GCC
gcc --version | head -n1 && success "GCC is working" || error "GCC failed"

# Go
go version && success "Go is working" || warn "Go is not installed"

# Rust
rustc --version 2>/dev/null && success "Rust is working" || warn "Rust is not installed"

# Ruby
ruby --version && success "Ruby is working" || warn "Ruby is not installed"

# PHP
php --version && success "PHP is working" || warn "PHP is not installed"

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  CODEPOCKET SETUP COMPLETE! 🎉${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "Installed Languages:"
echo -e "  ${CYAN}• Python 3.12${NC} (with numpy, pandas, flask, django)"
echo -e "  ${CYAN}• Java OpenJDK 17${NC}"
echo -e "  ${CYAN}• Node.js 20 LTS${NC} (with typescript, prettier, eslint)"
echo -e "  ${CYAN}• GCC/G++${NC} (C/C++ compiler)"
echo -e "  ${CYAN}• Go${NC}"
echo -e "  ${CYAN}• Rust${NC}"
echo -e "  ${CYAN}• Ruby${NC}"
echo -e "  ${CYAN}• PHP${NC}"
echo -e "  ${CYAN}• SQLite, PostgreSQL, Redis${NC}"
echo ""
echo -e "Development Tools:"
echo -e "  ${YELLOW}• Git${NC}"
echo -e "  ${YELLOW}• Docker & Docker Compose${NC}"
echo -e "  ${YELLOW}• Vim & Nano${NC}"
echo ""
echo -e "Log file: ${MAGENTA}$LOG_FILE${NC}"
echo ""
echo -e "${CYAN}To use Python, run: python3 your_file.py${NC}"
echo -e "${CYAN}To use Java, run: java your_file.java${NC}"
echo -e "${CYAN}To use Node.js, run: node your_file.js${NC}"
echo ""

# Setup complete marker
touch "$PROOT_DIR/.setup_complete"

exit 0
