const https = require('https');

const TOKEN = '8410226405:AAEcWtTzMCXOOcseAJ7I8Y75XoChXvqvpus';
let lastUpdateId = 0;

console.log("Vandeza bot is running with native polling...");

function pollUpdates() {
    https.get(`https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${lastUpdateId}&timeout=30`, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            try {
                const response = JSON.parse(data);
                if (response.ok && response.result) {
                    for (let update of response.result) {
                        lastUpdateId = update.update_id + 1;
                        handleUpdate(update);
                    }
                }
            } catch (e) {
                console.error("Parse error:", e);
            }
            setTimeout(pollUpdates, 1000);
        });
    }).on('error', (err) => {
        console.error("Network error:", err.message);
        setTimeout(pollUpdates, 5000);
    });
}

function handleUpdate(update) {
    if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        const firstName = update.message.from.first_name || "Valued User";

        if (text === '/start') {
            sendWelcomeMessage(chatId, firstName);
        }
    }
}

function sendWelcomeMessage(chatId, firstName) {
    const message = `Welcome to *Vandeza* 🚀, ${firstName}!\n\nYour fast and reliable plug for instant automated services.\nPlease select an option below to proceed:`;
    
    const replyMarkup = JSON.stringify({
        inline_keyboard: [
            [
                { text: '📺 Cable TV (DStv/GOtv)', callback_data: 'menu_cable' },
                { text: '📱 Data & Airtime', callback_data: 'menu_vtu' }
            ],
            [
                { text: '💳 Fund Wallet', callback_data: 'menu_wallet' },
                { text: '👤 My Profile', callback_data: 'menu_profile' }
            ]
        ]
    });

    const postData = JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup
    });

    const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${TOKEN}/sendMessage`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = https.request(options, (res) => {
        res.on('data', () => {});
    });

    req.on('error', (e) => {
        console.error(`Send error: ${e.message}`);
    });

    req.write(postData);
    req.end();
}

pollUpdates();
