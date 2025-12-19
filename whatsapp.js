const venom = require('venom-bot');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const TelegramBot = require('node-telegram-bot-api');
const AdmZip = require('adm-zip');
require('dotenv').config();

let whatsappClient = null;
let isWhatsAppReady = false;
let telegramBot = null;

// Initialiser le bot Telegram pour envoyer le QR code
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN_PROBLEME || process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_REPORT_CHAT_ID || process.env.CHAT_ID;

if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
  try {
    telegramBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
    console.log('✅ Bot Telegram initialisé pour QR Code WhatsApp');
    console.log(`📬 Bot Token: ${TELEGRAM_BOT_TOKEN.substring(0, 20)}...`);
    console.log(`📬 Chat ID: ${TELEGRAM_CHAT_ID}`);
  } catch (error) {
    console.error('❌ Erreur initialisation Telegram:', error.message);
  }
} else {
  console.warn('⚠️ Variables Telegram manquantes:');
  console.warn(`   - TELEGRAM_BOT_TOKEN_PROBLEME: ${TELEGRAM_BOT_TOKEN ? '✅' : '❌'}`);
  console.warn(`   - TELEGRAM_REPORT_CHAT_ID: ${TELEGRAM_CHAT_ID ? '✅' : '❌'}`);
}

// Chemins pour les sessions (à la racine du projet)
const sessionName = 'whatsapp-session';
const sessionsDir = path.join(__dirname, 'sessions');
const backupPath = path.join(sessionsDir, 'whatsapp-session-backup.zip');

// Fonction pour créer un backup zip de la session
async function backupSession() {
  try {
    const tokensPath = path.join(__dirname, 'tokens');
    if (!fs.existsSync(tokensPath)) {
      console.log('⚠️ Aucune session à sauvegarder');
      return false;
    }

    console.log('📦 Création du backup de la session...');
    const zip = new AdmZip();
    
    // Ajouter tous les fichiers de la session au zip
    const files = fs.readdirSync(tokensPath);
    files.forEach(file => {
      const filePath = path.join(tokensPath, file);
      if (fs.statSync(filePath).isFile()) {
        zip.addLocalFile(filePath, '', file);
      }
    });

    // Créer le dossier backup s'il n'existe pas
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }

    // Sauvegarder le zip
    zip.writeZip(backupPath);
    console.log(`✅ Backup créé: ${backupPath}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la création du backup:', error);
    return false;
  }
}

// Fonction pour restaurer la session depuis le backup zip
async function restoreSessionFromBackup() {
  try {
    if (!fs.existsSync(backupPath)) {
      console.log('⚠️ Aucun backup trouvé');
      return false;
    }

    console.log('🔄 Restauration de la session depuis le backup...');
    
    const tokensPath = path.join(__dirname, 'tokens');
    
    // Supprimer la session actuelle si elle existe
    if (fs.existsSync(tokensPath)) {
      fs.rmSync(tokensPath, { recursive: true, force: true });
    }

    // Créer le dossier tokens
    fs.mkdirSync(tokensPath, { recursive: true });

    // Extraire le zip
    const zip = new AdmZip(backupPath);
    zip.extractAllTo(tokensPath, true);
    
    console.log('✅ Session restaurée depuis le backup');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la restauration du backup:', error);
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
    console.log(`📬 Envoi vers Chat ID: ${TELEGRAM_CHAT_ID}`);
    
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
    doc.fontSize(24).text('Cursus Bac + 🇧🇫 WhatsApp QR Code', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text('Scannez ce QR code pour connecter WhatsApp', { align: 'center' });
    doc.fontSize(12).fillColor('#666666').text('(Codes OTP de suppression de compte)', { align: 'center' });
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
      caption: '📱 *WhatsApp QR Code - Cursus Bac +*\n\n🔐 Scannez ce QR code pour connecter WhatsApp à la plateforme.\n\n⏰ Ce QR code expire dans quelques minutes.\n\n📝 Ce QR code permettra d\'envoyer les codes OTP de suppression de compte.\n\n— Support Cursus Bac + 🇧🇫',
      parse_mode: 'Markdown'
    });
    
    console.log('✅ QR code PDF envoyé sur Telegram');
    console.log(`📬 Envoyé au Chat ID: ${TELEGRAM_CHAT_ID}`);
    
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

// Initialiser le client WhatsApp avec venom-bot
async function initializeWhatsApp() {
  // Créer le dossier sessions s'il n'existe pas
  if (!fs.existsSync(sessionsDir)) {
    console.log('📂 Création du dossier sessions...');
    fs.mkdirSync(sessionsDir, { recursive: true });
    console.log('✅ Dossier sessions créé:', sessionsDir);
  }
  
  // Vérifier si une session existe
  const tokensPath = path.join(__dirname, 'tokens');
  const hasExistingSession = fs.existsSync(tokensPath) && fs.readdirSync(tokensPath).length > 0;
  const hasBackup = fs.existsSync(backupPath);
  
  // Si pas de session, essayer de restaurer depuis le backup
  if (!hasExistingSession) {
    console.log('⚠️ Aucune session trouvée, tentative de restauration depuis le backup...');
    const restored = await restoreSessionFromBackup();
    if (restored) {
      console.log('✅ Session restaurée depuis le backup, nouvelle tentative de connexion...');
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 [WhatsApp] INITIALISATION DU CLIENT VENOM-BOT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📂 Dossier de session: ${tokensPath}`);
  console.log(`🔍 Session existante: ${hasExistingSession ? '✅ OUI - Connexion automatique' : '❌ NON - Scan QR requis'}`);
  console.log(`💾 Persistance: Illimitée (reconnexion automatique)`);
  console.log(`📦 Backup: ${hasBackup ? '✅ Disponible' : '❌ Aucun'}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  if (hasExistingSession) {
    console.log('🔐 Session WhatsApp détectée');
    console.log('⚡ Reconnexion automatique en cours...');
  } else {
    console.log('📱 Première connexion WhatsApp');
    console.log('⏳ QR Code sera affiché pour scanner...');
  }

  try {
    // Créer le client avec venom-bot
    whatsappClient = await venom.create(
      sessionName,
      // Callback QR Code
      async (base64Qr, asciiQR, attempts, urlCode) => {
        console.log('\n📱 ════════════════════════════════════════════════');
        console.log('   QR CODE WHATSAPP - SCANNEZ POUR CONNECTER');
        console.log('════════════════════════════════════════════════\n');
        console.log(`📊 Tentative: ${attempts}`);
        console.log(`🔗 URL Code: ${urlCode}\n`);
        
        // Afficher le QR code dans le terminal
        console.log(asciiQR);
        
        console.log('\n📱 Instructions:');
        console.log('   1. Ouvrez WhatsApp sur votre téléphone');
        console.log('   2. Menu (⋮) → Appareils connectés');
        console.log('   3. Connecter un appareil');
        console.log('   4. Scannez le QR code ci-dessus OU dans le PDF Telegram\n');
        console.log('💡 Vous ne scannerez qu\'une seule fois!');
        console.log('   La session sera sauvegardée pour les prochains démarrages.\n');
        
        // Envoyer le QR code en PDF sur Telegram
        if (telegramBot && base64Qr) {
          console.log('📤 Envoi du QR code en PDF sur Telegram...');
          try {
            // Convertir base64 en URL de données pour QRCode
            const qrData = urlCode || base64Qr;
            await sendQRCodeToTelegram(qrData);
            console.log('✅ QR code envoyé avec succès sur Telegram');
          } catch (error) {
            console.error('❌ Erreur lors de l\'envoi du QR code sur Telegram:', error.message);
            console.log('⚠️ Le QR code est toujours visible dans le terminal ci-dessus');
          }
        } else if (!telegramBot) {
          console.log('⚠️ Telegram non configuré - Configurez TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID dans .env');
          console.log('📱 Le QR code est affiché dans le terminal ci-dessus');
        }
      },
      // Callback Status
      (statusSession, session) => {
        console.log(`📊 Status Session: ${statusSession}`);
        console.log(`📊 Session: ${session}`);
        
        if (statusSession === 'isLogged') {
          console.log('✅ Session active - Connecté');
        } else if (statusSession === 'notLogged') {
          console.log('⚠️ Session non connectée - QR Code requis');
        } else if (statusSession === 'qrReadSuccess') {
          console.log('✅ QR Code scanné avec succès!');
        } else if (statusSession === 'qrReadFail') {
          console.log('❌ Échec de lecture du QR Code');
        } else if (statusSession === 'chatsAvailable') {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('✅ WhatsApp Client est PRÊT!');
          console.log('📲 Les messages peuvent maintenant être envoyés');
          console.log('🔒 Session sauvegardée - Pas besoin de re-scanner');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          isWhatsAppReady = true;
          
          // Créer un backup après connexion réussie
          backupSession();
        } else if (statusSession === 'browserClose') {
          console.log('⚠️ Navigateur fermé');
          isWhatsAppReady = false;
        } else if (statusSession === 'desconnectedMobile') {
          console.log('⚠️ Déconnecté du mobile');
          isWhatsAppReady = false;
        }
      },
      // Options
      {
        folderNameToken: 'tokens',
        mkdirFolderToken: '',
        headless: 'new',
        devtools: false,
        debug: false,
        logQR: true,
        disableSpins: true,
        disableWelcome: true,
        updatesLog: true,
        autoClose: 0, // Désactiver la fermeture automatique
        createPathFileToken: false
      }
    );

    console.log('✅ Client Venom créé avec succès');
    return whatsappClient;
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation WhatsApp:', error);
    isWhatsAppReady = false;
    
    // Si erreur, essayer de restaurer depuis le backup
    if (!fs.existsSync(tokensPath) || (fs.existsSync(tokensPath) && fs.readdirSync(tokensPath).length === 0)) {
      console.log('🔄 Tentative de restauration depuis le backup...');
      const restored = await restoreSessionFromBackup();
      if (restored) {
        console.log('✅ Backup restauré, nouvelle tentative de connexion...');
        setTimeout(() => {
          initializeWhatsApp();
        }, 2000);
      }
    }
    
    throw error;
  }
}

// Envoyer un message WhatsApp
async function sendWhatsAppMessage(phoneNumber, message) {
  try {
    // Vérifier que le client existe et est prêt
    if (!whatsappClient) {
      console.error('❌ WhatsApp client non initialisé');
      return {
        success: false,
        message: 'WhatsApp client non initialisé. Appelez initializeWhatsApp() d\'abord.'
      };
    }

    if (!isWhatsAppReady) {
      console.error('❌ WhatsApp n\'est pas prêt');
      return {
        success: false,
        message: 'WhatsApp non connecté. Attendez que le client soit prêt ou scannez le QR code.'
      };
    }

    // Formater le numéro (supprimer espaces, tirets, etc.)
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

    // Formater pour WhatsApp (format Venom: [country code][phone number]@c.us)
    const jid = formattedNumber.replace('+', '') + '@c.us';

    console.log(`📤 Envoi WhatsApp à: ${formattedNumber} (${jid})`);
    
    // Envoyer le message avec Venom
    const result = await whatsappClient.sendText(jid, message);

    console.log(`✅ Message WhatsApp envoyé avec succès à ${formattedNumber}`);
    return {
      success: true,
      message: 'Message envoyé',
      result: result
    };

  } catch (error) {
    console.error('❌ Erreur envoi WhatsApp:', error);
    
    // Message d'erreur plus descriptif
    let errorMessage = error.message || 'Erreur inconnue';
    if (error.message?.includes('not authenticated') || error.message?.includes('session')) {
      errorMessage = 'WhatsApp non authentifié. Veuillez scanner le QR code.';
      isWhatsAppReady = false;
    } else if (error.message?.includes('not connected')) {
      errorMessage = 'WhatsApp déconnecté. Reconnexion en cours...';
      isWhatsAppReady = false;
    }
    
    return {
      success: false,
      message: errorMessage
    };
  }
}

// Vérifier si WhatsApp est prêt
function isWhatsAppConnected() {
  return isWhatsAppReady && whatsappClient !== null;
}

// Obtenir le statut de connexion
function getWhatsAppStatus() {
  const tokensPath = path.join(__dirname, 'tokens');
  return {
    isReady: isWhatsAppReady,
    client: whatsappClient ? 'initialized' : 'not initialized',
    sessionSaved: fs.existsSync(tokensPath) && fs.readdirSync(tokensPath).length > 0,
    sessionPath: tokensPath,
    backupExists: fs.existsSync(backupPath)
  };
}

// Déconnecter et supprimer la session (pour re-scanner)
async function resetWhatsAppSession() {
  try {
    console.log('🔄 Réinitialisation de la session WhatsApp...');
    
    if (whatsappClient) {
      try {
        await whatsappClient.logout();
        await whatsappClient.close();
      } catch (e) {
        // Ignorer les erreurs de déconnexion
      }
      whatsappClient = null;
      console.log('✅ Client WhatsApp détruit');
    }
    
    const tokensPath = path.join(__dirname, 'tokens');
    if (fs.existsSync(tokensPath)) {
      fs.rmSync(tokensPath, { recursive: true, force: true });
      console.log('🗑️ Session WhatsApp supprimée:', tokensPath);
    }
    
    // Supprimer aussi le backup
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
      console.log('🗑️ Backup supprimé:', backupPath);
    }
    
    isWhatsAppReady = false;
    
    console.log('✅ Session réinitialisée avec succès');
    
    return {
      success: true,
      message: 'Session réinitialisée. Redémarrez le serveur pour scanner un nouveau QR code.'
    };
  } catch (error) {
    console.error('❌ Erreur lors de la réinitialisation:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

module.exports = {
  initializeWhatsApp,
  sendWhatsAppMessage,
  isWhatsAppConnected,
  getWhatsAppStatus,
  resetWhatsAppSession
};
