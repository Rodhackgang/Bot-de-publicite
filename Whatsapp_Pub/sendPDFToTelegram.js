const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function sendPDFToTelegram(pdfFilePath) {
    const telegramBotToken = "5875852328:AAG_kbpGKMi2OHTeCFqJn7Rwfc4xlw-H11g"; // Remplacez par votre token de bot Telegram
    const chatId = "1965073915"; // Remplacez par l'ID du chat Telegram

    // Créer une instance de FormData
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', fs.createReadStream(pdfFilePath)); // Utiliser un flux de lecture pour le fichier PDF

    try {
        const response = await axios.post(
            `https://api.telegram.org/bot${telegramBotToken}/sendDocument`,
            formData, {
                headers: formData.getHeaders(), // Utiliser les en-têtes générés par formData
            }
        );
        console.log("PDF envoyé avec succès au bot Telegram:", response.data.result.chat);
    } catch (error) {
        console.error("Erreur lors de l'envoi du PDF au bot Telegram:", error);
    }
}

module.exports = sendPDFToTelegram;


/*
 const botToken = '5875852328:AAG_kbpGKMi2OHTeCFqJn7Rwfc4xlw-H11g';
    const chatId = '1965073915';
*/