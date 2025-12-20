const axios = require('axios');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Configuration GREEN-API
const GREEN_API_ID_INSTANCE = process.env.GREEN_API_ID_INSTANCE || '';
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN_INSTANCE || '';
// Construire l'URL de l'API: https://{4 premiers chiffres}.api.greenapi.com
const GREEN_API_BASE_NUMBER = GREEN_API_ID_INSTANCE.toString().slice(0, 4);
const GREEN_API_URL = process.env.GREEN_API_URL || `https://${GREEN_API_BASE_NUMBER}.api.greenapi.com`;

let isWhatsAppReady = false;
let qrCodeGenerated = false;
let telegramBot = null;
let qrCheckInterval = null;
let stateCheckInterval = null;

// Initialiser le bot Telegram pour envoyer le QR code (utiliser le bot de signalement)
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

// États possibles de l'instance GREEN-API
const InstanceState = {
  NOT_AUTHORIZED: 'notAuthorized',
  AUTHORIZED: 'authorized',
  BLOCKED: 'blocked',
  SLEEP_MODE: 'sleepMode',
  STARTING: 'starting'
};

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

// Obtenir l'état de l'instance GREEN-API
async function getInstanceState() {
  try {
    const response = await axios.get(
      `${GREEN_API_URL}/waInstance${GREEN_API_ID_INSTANCE}/getStateInstance/${GREEN_API_TOKEN}`
    );
    return response.data.stateInstance;
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de l\'état:', error.response?.data || error.message);
    return null;
  }
}

// Obtenir le QR code depuis GREEN-API
async function getQRCode() {
  try {
    const response = await axios.get(
      `${GREEN_API_URL}/waInstance${GREEN_API_ID_INSTANCE}/qr/${GREEN_API_TOKEN}`
    );
    // GREEN-API retourne soit {qrCode: "..."} soit directement le QR code en string
    const qrCode = response.data.qrCode || response.data;
    return qrCode;
  } catch (error) {
    console.error('❌ Erreur lors de la récupération du QR code:', error.response?.data || error.message);
    return null;
  }
}

// Vérifier périodiquement l'état et gérer le QR code si nécessaire
async function checkStateAndHandleQR() {
  const state = await getInstanceState();
  
  if (state === InstanceState.NOT_AUTHORIZED || state === InstanceState.STARTING) {
    if (!qrCodeGenerated) {
      console.log('\n📱 ════════════════════════════════════════════════');
      console.log('   QR CODE WHATSAPP - SCANNEZ POUR CONNECTER');
      console.log('════════════════════════════════════════════════\n');
      
      const qrData = await getQRCode();
      if (qrData) {
        qrCodeGenerated = true;
        const qrUrl = typeof qrData === 'string' ? qrData : (qrData.qrCode || qrData);
        
        // Afficher le QR code dans le terminal
        qrcode.generate(qrUrl, { small: true });
        
        console.log('\n📱 Instructions:');
        console.log('   1. Ouvrez WhatsApp sur votre téléphone');
        console.log('   2. Menu (⋮) → Appareils connectés');
        console.log('   3. Connecter un appareil');
        console.log('   4. Scannez le QR code ci-dessus OU dans le PDF Telegram\n');
        console.log('💡 Vous ne scannerez qu\'une seule fois!');
        console.log('   La session sera sauvegardée automatiquement.\n');
        console.log(`🔗 Ou utilisez cette URL: https://qr.green-api.com/waInstance${GREEN_API_ID_INSTANCE}/`);
        
        // Envoyer le QR code en PDF sur Telegram
        if (telegramBot) {
          console.log('📤 Envoi du QR code en PDF sur Telegram...');
          await sendQRCodeToTelegram(qrUrl);
        } else {
          console.log('⚠️ Telegram non configuré - Configurez TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID dans .env');
        }
      }
    }
    isWhatsAppReady = false;
  } else if (state === InstanceState.AUTHORIZED) {
    if (!isWhatsAppReady) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ WhatsApp Client est PRÊT!');
      console.log('📲 Les messages peuvent maintenant être envoyés');
      console.log('🔒 Instance autorisée - Pas besoin de re-scanner');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      isWhatsAppReady = true;
      qrCodeGenerated = false;
    }
  } else if (state === InstanceState.BLOCKED) {
    console.error('❌ Instance bloquée');
    isWhatsAppReady = false;
  } else if (state === InstanceState.SLEEP_MODE) {
    console.log('😴 Instance en mode veille');
    isWhatsAppReady = false;
  }
}

// Initialiser le client WhatsApp avec GREEN-API
async function initializeWhatsApp() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 [WhatsApp] INITIALISATION DU CLIENT GREEN-API');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`🌐 API URL: ${GREEN_API_URL}`);
  console.log(`🆔 Instance ID: ${GREEN_API_ID_INSTANCE}`);
  console.log(`💾 Persistance: Illimitée (reconnexion automatique)`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  try {
    // Vérifier l'état initial
    const initialState = await getInstanceState();
    console.log(`📊 État initial: ${initialState}`);
    
    if (initialState === InstanceState.AUTHORIZED) {
      console.log('🔐 Instance déjà autorisée - Connexion automatique');
      isWhatsAppReady = true;
    } else {
      console.log('📱 Instance non autorisée - QR Code requis');
      isWhatsAppReady = false;
      // Obtenir le QR code immédiatement
      await checkStateAndHandleQR();
    }
    
    // Vérifier l'état toutes les 5 secondes
    if (stateCheckInterval) {
      clearInterval(stateCheckInterval);
    }
    stateCheckInterval = setInterval(async () => {
      await checkStateAndHandleQR();
    }, 5000);
    
    // Vérifier le QR code toutes les 30 secondes si non autorisé
    if (qrCheckInterval) {
      clearInterval(qrCheckInterval);
    }
    qrCheckInterval = setInterval(async () => {
      const state = await getInstanceState();
      if (state === InstanceState.NOT_AUTHORIZED || state === InstanceState.STARTING) {
        qrCodeGenerated = false; // Réinitialiser pour permettre la récupération d'un nouveau QR code
        await checkStateAndHandleQR();
      }
    }, 30000);
    
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation WhatsApp:', error);
    isWhatsAppReady = false;
    throw error;
  }
}

// Envoyer un message WhatsApp via GREEN-API
async function sendWhatsAppMessage(phoneNumber, message) {
  try {
    // Vérifier que WhatsApp est prêt
    if (!isWhatsAppReady) {
      // Vérifier l'état avant d'échouer
      const state = await getInstanceState();
      if (state !== InstanceState.AUTHORIZED) {
        console.error('❌ WhatsApp n\'est pas prêt (État:', state, ')');
        return {
          success: false,
          message: 'WhatsApp non connecté. Attendez que l\'instance soit autorisée ou scannez le QR code.'
        };
      } else {
        isWhatsAppReady = true;
      }
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

    // Formater pour GREEN-API (format: [country code][phone number]@c.us)
    const chatId = formattedNumber.replace('+', '') + '@c.us';

    console.log(`📤 Envoi WhatsApp à: ${formattedNumber} (${chatId})`);
    
    // Envoyer le message via GREEN-API
    const response = await axios.post(
      `${GREEN_API_URL}/waInstance${GREEN_API_ID_INSTANCE}/sendMessage/${GREEN_API_TOKEN}`,
      {
        chatId: chatId,
        message: message
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Message WhatsApp envoyé avec succès à ${formattedNumber}`);
    console.log(`📨 ID du message: ${response.data.idMessage || 'N/A'}`);
    
    return {
      success: true,
      message: 'Message envoyé',
      idMessage: response.data.idMessage
    };

  } catch (error) {
    console.error('❌ Erreur envoi WhatsApp:', error.response?.data || error.message);
    
    // Si l'instance n'est pas autorisée, vérifier l'état et générer un QR code
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log('⚠️ Instance non autorisée, vérification de l\'état...');
      isWhatsAppReady = false;
      qrCodeGenerated = false;
      await checkStateAndHandleQR();
    }
    
    // Message d'erreur plus descriptif
    let errorMessage = error.response?.data?.error || error.message || 'Erreur inconnue';
    if (error.response?.status === 401) {
      errorMessage = 'Instance non autorisée. Veuillez scanner le QR code.';
    } else if (error.response?.status === 403) {
      errorMessage = 'Accès refusé. Vérifiez vos identifiants.';
    }
    
    return {
      success: false,
      message: errorMessage
    };
  }
}

// Vérifier si WhatsApp est prêt
function isWhatsAppConnected() {
  return isWhatsAppReady;
}

// Obtenir le statut de connexion
async function getWhatsAppStatus() {
  const state = await getInstanceState();
  return {
    isReady: isWhatsAppReady,
    state: state,
    apiUrl: GREEN_API_URL,
    idInstance: GREEN_API_ID_INSTANCE,
    isAuthorized: state === InstanceState.AUTHORIZED
  };
}

// Déconnecter l'instance (logout) pour forcer un nouveau scan
async function resetWhatsAppSession() {
  try {
    console.log('🔄 Déconnexion de l\'instance WhatsApp...');
    
    // Arrêter les intervalles
    if (stateCheckInterval) {
      clearInterval(stateCheckInterval);
      stateCheckInterval = null;
    }
    if (qrCheckInterval) {
      clearInterval(qrCheckInterval);
      qrCheckInterval = null;
    }
    
    try {
      // Appeler l'endpoint logout de GREEN-API
      await axios.get(
        `${GREEN_API_URL}/waInstance${GREEN_API_ID_INSTANCE}/logout/${GREEN_API_TOKEN}`
      );
      console.log('✅ Instance déconnectée avec succès');
    } catch (error) {
      console.log('⚠️ Erreur lors de la déconnexion (peut-être déjà déconnectée):', error.response?.data || error.message);
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

module.exports = {
  initializeWhatsApp,
  sendWhatsAppMessage,
  isWhatsAppConnected,
  getWhatsAppStatus,
  resetWhatsAppSession
};