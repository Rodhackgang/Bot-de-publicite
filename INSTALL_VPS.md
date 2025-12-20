# Commandes d'installation pour VPS

## 1. Mettre à jour le système
```bash
sudo apt-get update
sudo apt-get upgrade -y
```

## 2. Installer les dépendances système nécessaires
```bash
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
```

## 3. Installer Chromium (option 1 - via apt)
```bash
sudo apt-get install -y chromium-browser
```

## OU Installer Chromium (option 2 - via snap si apt ne fonctionne pas)
```bash
sudo snap install chromium
```

## 4. Vérifier l'installation de Chromium
```bash
which chromium-browser || which chromium || echo "Chromium non trouvé"
chromium-browser --version || chromium --version || echo "Impossible de vérifier la version"
```

## 5. Installer Node.js (si pas déjà installé)
```bash
# Installer Node.js 18.x ou 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Vérifier la version
node --version
npm --version
```

## 6. Installer les dépendances npm du projet
```bash
cd /chemin/vers/votre/projet/Whatsapp_Pub
npm install
```

## 7. Installer Chromium via Puppeteer (si les autres méthodes échouent)
```bash
cd /chemin/vers/votre/projet/Whatsapp_Pub
npx puppeteer browsers install chromium
```

## 8. Vérifier que tout fonctionne
```bash
# Tester Puppeteer
node -e "const puppeteer = require('puppeteer'); console.log('Puppeteer OK');"

# Tester Venom
node -e "const venom = require('venom-bot'); console.log('Venom OK');"
```

## Notes importantes :

1. **Si vous utilisez Docker** : Ajoutez `--no-sandbox` dans les arguments Puppeteer (déjà fait dans le code)

2. **Permissions** : Assurez-vous que l'utilisateur qui exécute le bot a les permissions nécessaires

3. **Firewall** : Vérifiez que les ports nécessaires sont ouverts

4. **Variables d'environnement** : Créez un fichier `.env` avec :
   ```
   TELEGRAM_BOT_TOKEN_PROBLEME=votre_token
   TELEGRAM_REPORT_CHAT_ID=votre_chat_id
   ```

## Commandes rapides (tout en une fois)
```bash
# Mise à jour système
sudo apt-get update && sudo apt-get upgrade -y

# Installation des dépendances
sudo apt-get install -y wget curl gnupg ca-certificates fonts-liberation \
  libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 libcups2 \
  libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 \
  libwayland-client0 libxcomposite1 libxdamage1 libxfixes3 \
  libxkbcommon0 libxrandr2 xdg-utils libu2f-udev libvulkan1

# Installation de Chromium
sudo apt-get install -y chromium-browser || sudo snap install chromium

# Vérification
chromium-browser --version || chromium --version
```

