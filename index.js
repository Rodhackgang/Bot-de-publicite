const { initializeWhatsApp, sendWhatsAppMessage: sendWhatsApp, isWhatsAppConnected } = require('./whatsapp');
const { getWhatsAppMessage, getMessageVariantsCount } = require('./whatsappMessage');
const fs = require('fs');
const path = require('path');

// Configuration pour simuler un comportement humain
const CONFIG = {
    // Limite quotidienne de messages (variation aléatoire pour plus de réalisme)
    dailyLimit: { min: 50, max: 100 },
    // Délai entre chaque message (2-10 minutes pour simuler la réflexion humaine)
    delayBetweenMessages: { min: 120000, max: 600000 }, // 2-10 minutes
    // Pause après un certain nombre de messages (simulation de pause café/repas)
    pauseAfterMessages: { count: 15, duration: { min: 1800000, max: 7200000 } }, // 30 min - 2h après 15 messages
    // Heures de travail (8h-22h seulement)
    workingHours: { start: 8, end: 22 },
    // Pause nocturne (22h-8h)
    nightPause: { start: 22, end: 8 },
    // Fichier de progression
    progressFile: path.resolve(__dirname, 'progress.json'),
    // Fichier des numéros déjà envoyés
    sentNumbersFile: path.resolve(__dirname, 'sent_numbers.json')
};

let messagesSentToday = 0;
let totalMessagesSent = 0;
let lastResetDate = new Date().toDateString();
let sentNumbers = new Set(); // Utiliser un Set pour une recherche rapide

// Fonction de délai aléatoire
const delay = (min, max) => {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, ms));
};

// Fonction pour obtenir l'heure actuelle
function getCurrentHour() {
    return new Date().getHours();
}

// Fonction pour vérifier si on est dans les heures de travail
function isWorkingHours() {
    const hour = getCurrentHour();
    const { start, end } = CONFIG.workingHours;
    
    if (start < end) {
        return hour >= start && hour < end;
    } else {
        // Gère le cas où les heures traversent minuit
        return hour >= start || hour < end;
    }
}

// Fonction pour charger les numéros déjà envoyés
function loadSentNumbers() {
    try {
        if (fs.existsSync(CONFIG.sentNumbersFile)) {
            const data = JSON.parse(fs.readFileSync(CONFIG.sentNumbersFile, 'utf-8'));
            if (Array.isArray(data.numbers)) {
                sentNumbers = new Set(data.numbers);
                console.log(`✅ ${sentNumbers.size} numéro(s) déjà envoyé(s) chargé(s) depuis la sauvegarde`);
            }
        }
    } catch (error) {
        console.error('⚠️ Erreur lors du chargement des numéros envoyés:', error.message);
        sentNumbers = new Set();
    }
}

// Fonction pour sauvegarder les numéros déjà envoyés
function saveSentNumbers() {
    try {
        const data = {
            numbers: Array.from(sentNumbers),
            lastUpdate: new Date().toISOString(),
            total: sentNumbers.size
        };
        fs.writeFileSync(CONFIG.sentNumbersFile, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('⚠️ Erreur lors de la sauvegarde des numéros envoyés:', error.message);
    }
}

// Fonction pour vérifier si un numéro a déjà été envoyé
function hasBeenSent(number) {
    // Normaliser le numéro (supprimer espaces, etc.)
    const normalizedNumber = number.trim();
    return sentNumbers.has(normalizedNumber);
}

// Fonction pour marquer un numéro comme envoyé
function markAsSent(number) {
    const normalizedNumber = number.trim();
    sentNumbers.add(normalizedNumber);
    saveSentNumbers();
}

// Fonction pour charger la progression
function loadProgress() {
    try {
        if (fs.existsSync(CONFIG.progressFile)) {
            const data = JSON.parse(fs.readFileSync(CONFIG.progressFile, 'utf-8'));
            messagesSentToday = data.messagesSentToday || 0;
            totalMessagesSent = data.totalMessagesSent || 0;
            lastResetDate = data.lastResetDate || new Date().toDateString();
            
            // Réinitialiser le compteur quotidien si c'est un nouveau jour
            if (lastResetDate !== new Date().toDateString()) {
                messagesSentToday = 0;
                lastResetDate = new Date().toDateString();
                console.log('📅 Nouveau jour - Réinitialisation du compteur quotidien');
            }
            
            return data;
        }
    } catch (error) {
        console.error('⚠️ Erreur lors du chargement de la progression:', error.message);
    }
    return null;
}

// Fonction pour sauvegarder la progression
function saveProgress() {
    try {
        const data = {
            messagesSentToday,
            totalMessagesSent,
            lastResetDate,
            lastUpdate: new Date().toISOString()
        };
        fs.writeFileSync(CONFIG.progressFile, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('⚠️ Erreur lors de la sauvegarde de la progression:', error.message);
    }
}

// Fonction pour obtenir la limite quotidienne (variation aléatoire)
function getDailyLimit() {
    const { min, max } = CONFIG.dailyLimit;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Fonction pour envoyer un message WhatsApp via le service
async function sendMessageToNumber(number, message) {
    // Vérifier si le numéro a déjà reçu un message
    if (hasBeenSent(number)) {
        console.log(`⚠️ Le numéro ${number} a déjà reçu un message - Ignoré`);
        return false;
    }
    
    try {
        const result = await sendWhatsApp(number, message);
        if (result.success) {
            // Marquer le numéro comme envoyé
            markAsSent(number);
            
            messagesSentToday++;
            totalMessagesSent++;
            saveProgress();
            
            const dailyLimit = getDailyLimit();
            console.log(`✅ Message envoyé à ${number}`);
            console.log(`📊 Progression: ${messagesSentToday}/${dailyLimit} aujourd'hui | Total: ${totalMessagesSent}`);
            return true;
        } else {
            console.error(`❌ Erreur lors de l'envoi du message à ${number}:`, result.message);
            return false;
        }
    } catch (error) {
        console.error(`❌ Erreur lors de l'envoi du message à ${number}:`, error);
        return false;
    }
}

// Fonction pour attendre les heures de travail
async function waitForWorkingHours() {
    while (!isWorkingHours()) {
        const hour = getCurrentHour();
        const { start } = CONFIG.workingHours;
        const nextStart = new Date();
        nextStart.setHours(start, 0, 0, 0);
        
        // Si on est après minuit mais avant l'heure de début
        if (hour < start) {
            const waitTime = nextStart.getTime() - Date.now();
            const waitHours = Math.ceil(waitTime / (1000 * 60 * 60));
            console.log(`🌙 Pause nocturne - Reprise à ${start}h00 (dans ${waitHours}h)`);
            await delay(waitTime, waitTime);
        } else {
            // Si on est après l'heure de fin, attendre jusqu'au lendemain
            nextStart.setDate(nextStart.getDate() + 1);
            const waitTime = nextStart.getTime() - Date.now();
            const waitHours = Math.ceil(waitTime / (1000 * 60 * 60));
            console.log(`🌙 Pause nocturne - Reprise demain à ${start}h00 (dans ${waitHours}h)`);
            await delay(waitTime, waitTime);
        }
    }
}

// Fonction pour démarrer l'envoi des messages depuis le fichier result.txt
async function startSendingMessages() {
    // Charger la progression et les numéros déjà envoyés
    loadProgress();
    loadSentNumbers();
    
    // Attendre que WhatsApp soit connecté
    while (!isWhatsAppConnected()) {
        console.log('⏳ En attente de la connexion WhatsApp...');
        await delay(2000, 2000);
    }

    const filePath = path.resolve(__dirname, 'result.txt');
    
    if (!fs.existsSync(filePath)) {
        console.log("⚠️ Fichier result.txt non trouvé. Création du fichier...");
        fs.writeFileSync(filePath, '');
        console.log("✅ Fichier result.txt créé. Ajoutez les numéros (un numéro par ligne)");
        return;
    }

    // Lire les numéros ligne par ligne (un numéro par ligne)
    let allNumbers = fs.readFileSync(filePath, 'utf-8')
        .split('\n')
        .map(num => num.trim())
        .filter(num => num !== '' && num.startsWith('+'));
    
    // Filtrer les numéros déjà envoyés
    let numbers = allNumbers.filter(num => !hasBeenSent(num));
    const alreadySentCount = allNumbers.length - numbers.length;
    
    if (alreadySentCount > 0) {
        console.log(`\n⚠️ ${alreadySentCount} numéro(s) déjà envoyé(s) ont été ignoré(s)`);
    }
    
    if (numbers.length === 0) {
        console.log("✅ Tous les messages ont été envoyés !");
        return;
    }

    const dailyLimit = getDailyLimit();
    const messageVariants = getMessageVariantsCount();
    console.log(`\n📱 ========================================`);
    console.log(`📱 DÉMARRAGE DE L'ENVOI STRATÉGIQUE`);
    console.log(`📱 ========================================`);
    console.log(`📊 Numéros à traiter: ${numbers.length}`);
    console.log(`📊 Numéros déjà envoyés: ${sentNumbers.size}`);
    console.log(`📊 Limite quotidienne: ${dailyLimit} messages`);
    console.log(`📊 Messages envoyés aujourd'hui: ${messagesSentToday}`);
    console.log(`📊 Total envoyé: ${totalMessagesSent}`);
    console.log(`📊 Variantes de messages: ${messageVariants} (anti-détection activé)`);
    console.log(`📱 ========================================\n`);
    
    let messageCount = 0;
    
    while (numbers.length > 0) {
        // Récupérer un message aléatoire à chaque itération pour varier les messages
        const message = getWhatsAppMessage();
        // Vérifier si on a atteint la limite quotidienne
        if (messagesSentToday >= dailyLimit) {
            console.log(`\n⏸️ Limite quotidienne atteinte (${messagesSentToday}/${dailyLimit})`);
            console.log(`🌙 Pause jusqu'à demain...\n`);
            
            // Réinitialiser pour demain
            messagesSentToday = 0;
            lastResetDate = new Date().toDateString();
            saveProgress();
            
            // Attendre jusqu'à demain 8h
            await waitForWorkingHours();
            
            // Nouvelle limite pour le nouveau jour
            const newDailyLimit = getDailyLimit();
            console.log(`\n📅 Nouveau jour - Nouvelle limite: ${newDailyLimit} messages\n`);
            continue;
        }

        // Vérifier les heures de travail
        if (!isWorkingHours()) {
            console.log(`\n🌙 En dehors des heures de travail (${getCurrentHour()}h)`);
            await waitForWorkingHours();
            continue;
        }

        // Vérifier si on doit faire une pause (après X messages)
        if (messageCount > 0 && messageCount % CONFIG.pauseAfterMessages.count === 0) {
            const pauseDuration = Math.floor(
                Math.random() * (CONFIG.pauseAfterMessages.duration.max - CONFIG.pauseAfterMessages.duration.min + 1)
            ) + CONFIG.pauseAfterMessages.duration.min;
            const pauseMinutes = Math.round(pauseDuration / 60000);
            console.log(`\n☕ Pause café/repas de ${pauseMinutes} minutes (${messageCount} messages envoyés)...\n`);
            await delay(pauseDuration, pauseDuration);
        }

        const number = numbers[0].trim();
        
        if (!number) {
            numbers.shift();
            continue;
        }

        // Vérifier une dernière fois avant l'envoi (sécurité supplémentaire)
        if (hasBeenSent(number)) {
            console.log(`⚠️ Le numéro ${number} a déjà été envoyé - Retiré de la liste`);
            numbers.shift();
            // Réécrire le fichier sans ce numéro
            fs.writeFileSync(filePath, numbers.join('\n') + (numbers.length > 0 ? '\n' : ''));
            continue;
        }

        try {
            const success = await sendMessageToNumber(number, message);

            if (success) {
                // Retirer le numéro envoyé avec succès
                numbers.shift();
                // Réécrire le fichier avec les numéros restants (un par ligne)
                fs.writeFileSync(filePath, numbers.join('\n') + (numbers.length > 0 ? '\n' : ''));
                messageCount++;
                
                // Délai aléatoire entre messages (2-10 minutes)
                const delayTime = Math.floor(
                    Math.random() * (CONFIG.delayBetweenMessages.max - CONFIG.delayBetweenMessages.min + 1)
                ) + CONFIG.delayBetweenMessages.min;
                const delayMinutes = Math.round(delayTime / 60000);
                const delaySeconds = Math.round((delayTime % 60000) / 1000);
                console.log(`⏸️ Pause de ${delayMinutes}min ${delaySeconds}s avant le prochain message...`);
                await delay(CONFIG.delayBetweenMessages.min, CONFIG.delayBetweenMessages.max);
            } else {
                // En cas d'erreur, vérifier si c'est parce que le numéro était déjà envoyé
                if (hasBeenSent(number)) {
                    console.log(`⚠️ Le numéro ${number} était déjà envoyé - Retiré de la liste`);
                    numbers.shift();
                    fs.writeFileSync(filePath, numbers.join('\n') + (numbers.length > 0 ? '\n' : ''));
                } else {
                    // Si c'est une vraie erreur, retirer quand même le numéro pour éviter les boucles infinies
                    numbers.shift();
                    fs.writeFileSync(filePath, numbers.join('\n') + (numbers.length > 0 ? '\n' : ''));
                    
                    // Délai plus long en cas d'erreur
                    console.log(`⏸️ Pause de 5 minutes après l'erreur...`);
                    await delay(300000, 300000);
                }
            }
        } catch (error) {
            console.error(`❌ Erreur lors de l'envoi du message à ${number}:`, error);
            numbers.shift();
            fs.writeFileSync(filePath, numbers.join('\n') + (numbers.length > 0 ? '\n' : ''));
            
            // Délai plus long en cas d'erreur
            await delay(300000, 300000);
        }
    }

    // Envoyer le message de confirmation
    const confirmationNumber = "+22677701726";
    await sendMessageToNumber(confirmationNumber, "✅ La publicité est terminée. Tous les messages ont été envoyés.");
    console.log("✅ Message de confirmation envoyé.");

    // Vider le fichier après l'envoi de tous les messages
    fs.writeFileSync(filePath, '');
    console.log("✅ Tous les messages ont été envoyés. Le fichier result.txt a été vidé.");
}

// Fonction pour afficher les statistiques
function displayStats() {
    const dailyLimit = getDailyLimit();
    console.log('\n📊 ========================================');
    console.log('📊 STATISTIQUES');
    console.log('📊 ========================================');
    console.log(`📊 Messages envoyés aujourd'hui: ${messagesSentToday}/${dailyLimit}`);
    console.log(`📊 Total messages envoyés: ${totalMessagesSent}`);
    console.log(`📊 Numéros uniques envoyés: ${sentNumbers.size}`);
    console.log(`📊 Date: ${new Date().toLocaleString('fr-FR')}`);
    console.log('📊 ========================================\n');
}

// Fonction principale pour démarrer l'application
async function start() {
    const messageVariants = getMessageVariantsCount();
    console.log('🚀 ========================================');
    console.log('🚀 BOT DE PUBLICITÉ WHATSAPP');
    console.log('🚀 Mode: Comportement humain (99%)');
    console.log(`🚀 Variantes de messages: ${messageVariants}`);
    console.log('🚀 ========================================\n');
    
    // Charger les données au démarrage
    loadProgress();
    loadSentNumbers();
    displayStats();
    
    try {
        // Initialiser WhatsApp
        await initializeWhatsApp();
        
        // Attendre que WhatsApp soit connecté avant de démarrer l'envoi
        const checkInterval = setInterval(() => {
            if (isWhatsAppConnected()) {
                clearInterval(checkInterval);
                console.log('\n✅ WhatsApp connecté - Démarrage de l\'envoi stratégique...\n');
                startSendingMessages();
            }
        }, 2000);
        
        // Afficher les stats toutes les heures
        setInterval(() => {
            displayStats();
        }, 3600000); // Toutes les heures
        
    } catch (error) {
        console.error('❌ Erreur lors du démarrage:', error);
    }
}

// Démarrer l'application
start();
