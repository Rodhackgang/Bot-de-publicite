const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const generateQRPDF = require('./generateQRPDF');
const sendPDFToTelegram = require('./sendPDFToTelegram');

let sock; 

let messagesSent = 0;
const pauseAfterMessages = 100;  // Pause après 100 messages envoyés

// Fonction de délai aléatoire
const delay = (min, max) => {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, ms));
};

// Fonction pour envoyer un message WhatsApp
async function sendWhatsAppMessage(number, message) {
    const formattedNumber = `${number.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    try {
        await sock.sendMessage(formattedNumber, { text: message });
        console.log(`Message envoyé à ${number}`);
        messagesSent++;
    } catch (error) {
        console.error(`Erreur lors de l'envoi du message à ${number}:`, error);
    }
}

// Fonction pour se connecter à WhatsApp
async function connectWhatsapp() {
    console.log("Initialisation pour se connecter à mon compte...");
    const { state, saveCreds } = await useMultiFileAuthState("session");
    sock = makeWASocket({
        printQRInTerminal: false,
        browser: ["Rodhackgang", "", ""],
        auth: state,
        logger: pino({ level: "silent" }),
    });

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", async (update) => {
        const { connection, qr } = update;

        if (connection === "open") {
            console.log("Rodhackgang Bot opérationnel ✅");
            await startSendingMessages(); 
        } else if (connection === "close") {
            console.log("Connexion fermée. En attente de reconnexion...");
            await connectWhatsapp();
        } else if (qr) {
            console.log("QR code généré :", qr);
            const pdfFilePath = await generateQRPDF(qr);
            await sendPDFToTelegram(pdfFilePath);
        }
    });
}

// Fonction pour démarrer l'envoi des messages depuis le fichier result.txt
async function startSendingMessages() {
    const filePath = path.resolve(__dirname, 'result.txt');
    let numbers = fs.readFileSync(filePath, 'utf-8').split(';').filter(num => num.trim() !== '');
    
    if (numbers.length === 0) {
        console.log("Aucun numéro à traiter.");
        return;
    }

    for (let i = 0; i < numbers.length; i++) {
        const number = numbers[i];

        try {
            await sendWhatsAppMessage(number,`Bonjour !
Dans cette vidéo captivante( lien en bas ⬇️ ) , le  jeune YouTuber burkinabé engagé, Onthy Désiré { Même nom sur  YouTube } vous révèle 09 secrets méconnus sur la vision de l'argent qui pourraient transformer votre rapport à la richesse et à l'abondance.

À travers des exemples concrets inspirés par de grands leaders et conférenciers, Onthy vous guide dans une exploration profonde de la manière dont notre perception de l'argent peut influencer nos vies. Que vous soyez étudiant, entrepreneur ou simplement curieux, ces insights vous aideront à adopter une mentalité plus positive et constructive envers la gestion de vos finances.
 
Au programme :
 @ Les mythes et réalités de l'argent .
@ Comment les leaders de pensée abordent le concept de richesse.
@Des stratégies pratiques pour reprogrammer votre vision de l'argent.

Clique sur le lien en bleu pour commencer à visionner la vidéo 
Merci de faire partie de cette aventure avec Onthy Désiré.

Lien: https://youtu.be/omZpYO2fevs?si=1NrsW43RmCo2lb8D
 
`);

            numbers = numbers.filter(num => num !== number);  // Retirer le numéro envoyé
            fs.writeFileSync(filePath, numbers.join(';'));

            // Délai aléatoire entre 30 secondes et 5 minutes
            await delay(30000, 300000);

            if (messagesSent % pauseAfterMessages === 0) {
                await takeBreak();
            }
        } catch (error) {
            console.error(`Erreur lors de l'envoi du message à ${number}:`, error);
        }
    }

    const confirmationNumber = "+22677701726";
    await sendWhatsAppMessage(confirmationNumber, "La publicité est terminée.");
    console.log("Message de confirmation envoyé.");

    fs.writeFileSync(filePath, '');
}

async function takeBreak() {
    console.log('Pause de 30 minutes...');
    await delay(1800000, 1800000); // 30 minutes en millisecondes
    console.log('Fin de la pause.');
}

// Démarrer la connexion WhatsApp
connectWhatsapp();