#!/bin/bash

echo "🚀 Installation des dépendances pour VPS..."

# Mise à jour système
echo "📦 Mise à jour du système..."
sudo apt-get update
sudo apt-get upgrade -y

# Installation des dépendances système
echo "📦 Installation des dépendances système..."
sudo apt-get install -y \
  wget \
  curl \
  gnupg \
  ca-certificates \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libatspi2.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libwayland-client0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  xdg-utils \
  libu2f-udev \
  libvulkan1

# Installation de Chromium
echo "🌐 Installation de Chromium..."
if ! sudo apt-get install -y chromium-browser; then
  echo "⚠️ Installation via apt échouée, tentative avec snap..."
  sudo snap install chromium
fi

# Vérification
echo "✅ Vérification de l'installation..."
if command -v chromium-browser &> /dev/null; then
  echo "✅ Chromium installé: $(chromium-browser --version)"
elif command -v chromium &> /dev/null; then
  echo "✅ Chromium installé: $(chromium --version)"
else
  echo "❌ Chromium non trouvé"
fi

echo "✅ Installation terminée!"
