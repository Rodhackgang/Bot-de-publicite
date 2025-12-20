const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const TelegramBot = require('node-telegram-bot-api');
const AdmZip = require('adm-zip');
require('dotenv').config();

let client = null;
let isWhatsAppReady = false;
let qrCodeGenerated = false;
let telegramBot = null;

// Initialiser le bot Telegram pour envoyer le QR code
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.CHAT_ID;

if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
  try {
    telegramBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
    console.log('✅ Bot Telegram initialisé pour QR Code WhatsApp');
    console.log(`📬 Chat ID: ${TELEGRAM_CHAT_ID}`);
  } catch (error) {
    console.error('❌ Erreur initialisation Telegram:', error.message);
  }
} else {
  console.warn('⚠️ Variables Telegram manquantes dans .env:');
  console.warn(`   - TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN ? '✅' : '❌'}`);
  console.warn(`   - CHAT_ID: ${TELEGRAM_CHAT_ID ? '✅' : '❌'}`);
  console.warn('   Le QR code ne sera pas envoyé sur Telegram\n');
}

// Chemins des fichiers de session
const SESSION_DIR = path.join(__dirname, 'sessions', 'whatsapp-session');
const SESSION_ZIP = path.join(__dirname, 'sessions', 'whatsapp-session.zip');

// Fonction pour sauvegarder la session en ZIP
function saveSessionToZip() {
  try {
    if (!fs.existsSync(SESSION_DIR)) {
      console.log('⚠️ Aucun dossier de session à sauvegarder');
      return false;
    }

    console.log('💾 Sauvegarde de la session en ZIP...');
    const zip = new AdmZip();
    
    // Ajouter tous les fichiers du dossier de session au ZIP
    const files = fs.readdirSync(SESSION_DIR);
    files.forEach(file => {
      const filePath = path.join(SESSION_DIR, file);
      if (fs.statSync(filePath).isFile()) {
        zip.addLocalFile(filePath, '', file);
      }
    });

    // Créer le dossier sessions s'il n'existe pas
    const sessionsDir = path.dirname(SESSION_ZIP);
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }

    // Sauvegarder le ZIP
    zip.writeZip(SESSION_ZIP);
    console.log(`✅ Session sauvegardée dans: ${SESSION_ZIP}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde de la session:', error);
    return false;
  }
}

// Fonction pour restaurer la session depuis le ZIP
function restoreSessionFromZip() {
  try {
    if (!fs.existsSync(SESSION_ZIP)) {
      console.log('⚠️ Aucun fichier ZIP de session trouvé');
      return false;
    }

    console.log('📦 Restauration de la session depuis le ZIP...');
    
    // Créer le dossier de session s'il n'existe pas
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    } else {
      // Nettoyer le dossier existant
      const files = fs.readdirSync(SESSION_DIR);
      files.forEach(file => {
        fs.unlinkSync(path.join(SESSION_DIR, file));
      });
    }

    // Extraire le ZIP
    const zip = new AdmZip(SESSION_ZIP);
    zip.extractAllTo(SESSION_DIR, true);
    
    console.log('✅ Session restaurée depuis le ZIP');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la restauration de la session:', error);
    return false;
  }
}

// Fonction pour générer le QR code en PDF et l'envoyer sur Telegram
async function sendQRCodeToTelegram(qrData) {
  if (!telegramBot || !TELEGRAM_CHAT_ID) {
    console.log('⚠️ Telegram non configuré, QR code non envoyé');
    return;
  }

  try {
    console.log('📄 Génération du QR code en PDF...');
    
    // Générer le QR code en image PNG
    const qrImagePath = path.join(__dirname, 'temp_qr.png');
    await QRCode.toFile(qrImagePath, qrData, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    // Créer le PDF
    const pdfPath = path.join(__dirname, 'whatsapp_qr.pdf');
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const writeStream = fs.createWriteStream(pdfPath);
    
    doc.pipe(writeStream);
    
    // En-tête
    doc.fontSize(24).text('Bot de Publicité WhatsApp QR Code', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text('Scannez ce QR code pour connecter WhatsApp', { align: 'center' });
    doc.moveDown(2);
    
    // Ajouter le QR code
    doc.image(qrImagePath, {
      fit: [400, 400],
      align: 'center'
    });
    
    doc.moveDown(2);
    
    // Instructions
    doc.fontSize(12).text('Instructions:', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).list([
      'Ouvrez WhatsApp sur votre téléphone',
      'Menu (⋮) → Appareils connectés',
      'Connecter un appareil',
      'Scannez le QR code ci-dessus'
    ]);
    
    doc.moveDown();
    doc.fontSize(10).fillColor('#666666').text(
      `Généré le: ${new Date().toLocaleString('fr-FR')}`,
      { align: 'center' }
    );
    
    // Finaliser le PDF
    doc.end();
    
    // Attendre que le PDF soit créé
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    console.log('✅ PDF généré:', pdfPath);
    
    // Envoyer sur Telegram
    await telegramBot.sendDocument(TELEGRAM_CHAT_ID, pdfPath, {
      caption: '📱 *WhatsApp QR Code*\n\n🔐 Scannez ce QR code pour connecter WhatsApp.\n\n⏰ Ce QR code expire dans quelques minutes.',
      parse_mode: 'Markdown'
    });
    
    console.log('✅ QR code PDF envoyé sur Telegram');
    
    // Nettoyer les fichiers temporaires
    setTimeout(() => {
      try {
        if (fs.existsSync(qrImagePath)) fs.unlinkSync(qrImagePath);
        if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
        console.log('🗑️ Fichiers temporaires supprimés');
      } catch (cleanupError) {
        console.error('Erreur nettoyage:', cleanupError);
      }
    }, 5000);
    
  } catch (error) {
    console.error('❌ Erreur envoi QR code sur Telegram:', error);
  }
}

// Fonction pour formater un numéro de téléphone en format WhatsApp
function formatToWhatsAppNumber(phoneNumber) {
  // Supprimer espaces, tirets, etc.
  let formattedNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
  
  // Ajouter l'indicatif pays si nécessaire
  if (!formattedNumber.startsWith('+')) {
    if (formattedNumber.startsWith('226')) {
      formattedNumber = '+' + formattedNumber;
    } else if (formattedNumber.startsWith('0')) {
      formattedNumber = '+226' + formattedNumber.substring(1);
    } else {
      formattedNumber = '+226' + formattedNumber;
    }
  }
  
  return formattedNumber;
}

// Fonction pour formater le numéro en ID WhatsApp (format: 226XXXXXXXXX@c.us)
function formatToWhatsAppID(phoneNumber) {
  const formatted = formatToWhatsAppNumber(phoneNumber);
  // Retirer le + et ajouter @c.us
  const numberOnly = formatted.replace('+', '');
  return `${numberOnly}@c.us`;
}

// Fonction pour vérifier si un numéro existe sur WhatsApp
async function checkNumberExists(phoneNumber) {
  try {
    if (!client || !isWhatsAppReady) {
      return false;
    }
    
    const chatId = formatToWhatsAppID(phoneNumber);
    const contact = await client.getNumberId(chatId);
    return contact !== null;
  } catch (error) {
    console.log(`⚠️ Impossible de vérifier le numéro ${phoneNumber}:`, error.message);
    return false;
  }
}

// Initialiser WhatsApp avec whatsapp-web.js
async function initializeWhatsApp() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 [WhatsApp] INITIALISATION DU CLIENT WHATSAPP-WEB.JS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  try {
    // Restaurer la session depuis le ZIP si elle existe
    restoreSessionFromZip();
    
    // Créer le client WhatsApp
    console.log('🔌 Création du client WhatsApp...');
    client = new Client({
      authStrategy: new LocalAuth({
        dataPath: SESSION_DIR
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      }
    });
    
    // Gérer le QR code
    client.on('qr', async (qr) => {
      if (!qrCodeGenerated) {
        console.log('\n📱 ════════════════════════════════════════════════');
        console.log('   QR CODE WHATSAPP - SCANNEZ POUR CONNECTER');
        console.log('════════════════════════════════════════════════\n');
        
        // Afficher le QR code dans le terminal
        qrcode.generate(qr, { small: true });
        
        console.log('\n📱 Instructions:');
        console.log('   1. Ouvrez WhatsApp sur votre téléphone');
        console.log('   2. Menu (⋮) → Appareils connectés');
        console.log('   3. Connecter un appareil');
        console.log('   4. Scannez le QR code ci-dessus\n');
        console.log('💡 Vous ne scannerez qu\'une seule fois!\n');
        
        qrCodeGenerated = true;
        
        // Envoyer le QR code sur Telegram si configuré
        if (telegramBot) {
          await sendQRCodeToTelegram(qr);
        }
      }
    });
    
    // Gérer la connexion
    client.on('ready', () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ WhatsApp Client est PRÊT!');
      console.log('📲 Les messages peuvent maintenant être envoyés');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      isWhatsAppReady = true;
      qrCodeGenerated = false;
      
      // Sauvegarder la session en ZIP après connexion
      setTimeout(() => {
        saveSessionToZip();
      }, 5000); // Attendre 5 secondes pour que la session soit complètement sauvegardée
    });
    
    // Gérer l'authentification
    client.on('authenticated', () => {
      console.log('✅ Authentification réussie');
    });
    
    // Gérer les erreurs de connexion
    client.on('auth_failure', (msg) => {
      console.error('❌ Échec de l\'authentification:', msg);
      isWhatsAppReady = false;
    });
    
    // Gérer les déconnexions
    client.on('disconnected', (reason) => {
      console.log('❌ Déconnecté:', reason);
      isWhatsAppReady = false;
      
      // Sauvegarder la session avant déconnexion
      saveSessionToZip();
    });
    
    // Démarrer le client
    await client.initialize();
    console.log('✅ Client initialisé');
    
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation WhatsApp:', error);
    isWhatsAppReady = false;
    throw error;
  }
}

// Envoyer un message WhatsApp
async function sendWhatsAppMessage(phoneNumber, message) {
  try {
    // Vérifier que WhatsApp est prêt
    if (!isWhatsAppReady || !client) {
      console.error('❌ WhatsApp n\'est pas prêt');
      return {
        success: false,
        message: 'WhatsApp non connecté. Attendez que la connexion soit établie.'
      };
    }

    // Formater le numéro
    const formattedNumber = formatToWhatsAppNumber(phoneNumber);
    const chatId = formatToWhatsAppID(phoneNumber);
    
    console.log(`📤 Envoi WhatsApp à: ${formattedNumber} (${chatId})`);
    
    // Vérifier si le numéro existe sur WhatsApp (optionnel, peut ralentir)
    // On peut essayer d'envoyer directement et gérer l'erreur
    
    // Envoyer le message en utilisant le chatId
    let result;
    try {
      // Essayer d'envoyer avec le chatId d'abord
      result = await client.sendMessage(chatId, message);
    } catch (chatIdError) {
      // Si ça échoue, essayer avec le numéro formaté
      try {
        result = await client.sendMessage(formattedNumber, message);
      } catch (numberError) {
        // Si les deux échouent, vérifier si le numéro existe
        const exists = await checkNumberExists(phoneNumber);
        if (!exists) {
          throw new Error(`Le numéro ${formattedNumber} n'existe pas sur WhatsApp`);
        }
        throw numberError;
      }
    }
    
    console.log(`✅ Message WhatsApp envoyé avec succès à ${formattedNumber}`);
    console.log(`📨 ID du message: ${result.id._serialized || 'N/A'}`);
    
    // Sauvegarder la session après l'envoi (seulement si succès)
    saveSessionToZip();
    
    return {
      success: true,
      message: 'Message envoyé',
      idMessage: result.id._serialized
    };

  } catch (error) {
    const errorMessage = error.message || error.toString();
    console.error('❌ Erreur envoi WhatsApp:', errorMessage);
    
    // Analyser le type d'erreur
    let userMessage = errorMessage;
    if (errorMessage.includes('Evaluation failed')) {
      userMessage = 'Le numéro n\'existe pas sur WhatsApp ou n\'est pas valide';
    } else if (errorMessage.includes('not registered')) {
      userMessage = 'Le numéro n\'est pas enregistré sur WhatsApp';
    } else if (errorMessage.includes('n\'existe pas')) {
      userMessage = 'Le numéro n\'existe pas sur WhatsApp';
    }
    
    return {
      success: false,
      message: userMessage
    };
  }
}

// Vérifier si WhatsApp est prêt
function isWhatsAppConnected() {
  return isWhatsAppReady && client !== null;
}

// Obtenir le statut de connexion
async function getWhatsAppStatus() {
  return {
    isReady: isWhatsAppReady,
    isConnected: isWhatsAppConnected(),
    hasClient: client !== null
  };
}

// Déconnecter l'instance (logout) pour forcer un nouveau scan
async function resetWhatsAppSession() {
  try {
    console.log('🔄 Déconnexion de l\'instance WhatsApp...');
    
    if (client) {
      // Sauvegarder avant de déconnecter
      saveSessionToZip();
      
      await client.logout();
      await client.destroy();
      client = null;
    }
    
    // Supprimer le dossier de session et le ZIP
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      console.log('🗑️ Dossier de session supprimé');
    }
    
    if (fs.existsSync(SESSION_ZIP)) {
      fs.unlinkSync(SESSION_ZIP);
      console.log('🗑️ ZIP de session supprimé');
    }
    
    isWhatsAppReady = false;
    qrCodeGenerated = false;
    
    // Relancer l'initialisation pour générer un nouveau QR code
    setTimeout(() => {
      initializeWhatsApp();
    }, 2000);
    
    return {
      success: true,
      message: 'Instance déconnectée. Un nouveau QR code sera généré.'
    };
  } catch (error) {
    console.error('❌ Erreur lors de la réinitialisation:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

// Sauvegarder la session périodiquement
setInterval(() => {
  if (isWhatsAppReady && client) {
    saveSessionToZip();
  }
}, 300000); // Toutes les 5 minutes

module.exports = {
  initializeWhatsApp,
  sendWhatsAppMessage,
  isWhatsAppConnected,
  getWhatsAppStatus,
  resetWhatsAppSession
};
