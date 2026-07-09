#!/usr/bin/env bash
set -euo pipefail

echo "⚙️  Installing Caddy (reverse proxy + TLS)..."
if ! command -v caddy >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    sudo apt-get update
    sudo apt-get install -y caddy
  elif command -v yum >/dev/null 2>&1 || command -v dnf >/dev/null 2>&1; then
    PKG_MGR="yum"
    command -v dnf >/dev/null 2>&1 && PKG_MGR="dnf"
    sudo rpm --import https://rpm.repo.caddyserver.com/localsign.asc
    sudo tee /etc/yum.repos.d/caddy.repo >/dev/null <<'EOF'
[caddy]
name=Caddy
baseurl=https://rpm.repo.caddyserver.com/latest/$basearch/
gpgcheck=1
repo_gpgcheck=1
gpgkey=https://rpm.repo.caddyserver.com/localsign.asc
enabled=1
EOF
    sudo $PKG_MGR install -y caddy
  else
    echo "❌ Supported package manager not found (need apt, yum, or dnf). Install Caddy manually and re-run."
    exit 1
  fi
fi

sudo mkdir -p /var/log/caddy

sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
commandcenter.dafiti.ai {
  reverse_proxy 127.0.0.1:5004
  log {
    output file /var/log/caddy/commandcenter.log
    format json
  }
  encode zstd gzip
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains";
  }
}
EOF

sudo systemctl enable caddy
sudo systemctl restart caddy
