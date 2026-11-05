// index.js - Upgraded Vandeza Fintech Design (Long Polling)
const https = require('https');

// YOUR BOT TOKEN (RETAINED)
const TOKEN = '8410226405:AAEcWtTzMCXOOcseAJ7I8Y75XoChXvqvpus';
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;

let offset = 0;

// Helper to send HTTPS POST requests to Telegram
function sendRequest(method, data) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${BASE_URL}/${method}`);
        const payload = JSON.stringify(data);

        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', (err) => reject(err));
        req.write(payload);
        req.end();
    });
}

// Function to send or edit messages with keyboards
async function sendMessage(chatId, text, replyMarkup = null) {
    const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown' // Essential for professional text formatting
    };
    if (replyMarkup) {
        payload.reply_markup = replyMarkup;
    }
    try {
        await sendRequest('sendMessage', payload);
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Acknowledge callback queries to stop the loading spinner
async function answerCallbackQuery(callbackQueryId, text = null) {
    const payload = { callback_query_id: callbackQueryId };
    if (text) payload.text = text;
    try {
        await sendRequest('answerCallbackQuery', payload);
    } catch (error) {
        console.error('Error answering callback:', error);
    }
}

// The core logic that handles every Telegram interaction
async function handleUpdate(update) {
    // 1. Handling Text Commands (like /start)
    if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text.trim();
        const userName = update.message.from.first_name || 'Valued User';

        if (text === '/start') {
            // MATCHING MOCKUP 1: MAIN MENU
            const welcomeText = `🏛️ *Vandeza*\n\nWelcome to *Vandeza*! 🚀\nYour premier VTU & Payments Hub.`;
            
            // Re-creating the professional 6-button grid using emojis
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '📶 Data & Airtime', callback_data: 'service_data' },
                        { text: '📺 Cable TV', callback_data: 'service_cable' }
                    ],
                    [
                        { text: '💡 Electricity', callback_data: 'service_electricity' },
                        { text: '🌐 Internet', callback_data: 'service_internet' }
                    ],
                    [
                        { text: '💳 Fund Wallet', callback_data: 'menu_fund' },
                        { text: '👤 My Profile', callback_data: 'menu_profile' }
                    ]
                ]
            };

            await sendMessage(chatId, welcomeText, keyboard);
        }
    }

    // 2. Handling Button Clicks (Callback Queries)
    if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;

        // Immediately acknowledge the click
        await answerCallbackQuery(callbackQuery.id);

        if (data === 'service_data') {
            // MATCHING MOCKUP 3: DATA NETWORK SELECT
            const text = `📶 *Select your Network Provider*:\n\nPlease select the mobile network you wish to buy data for:`;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '💛 MTN', callback_data: 'network_mtn' },
                        { text: '❤️ Airtel', callback_data: 'network_airtel' }
                    ],
                    [
                        { text: '💚 GLO', callback_data: 'network_glo' },
                        { text: '🤍 9Mobile', callback_data: 'network_9mobile' }
                    ],
                    [
                        { text: '🔙 Back to Menu', callback_data: 'main_menu' }
                    ]
                ]
            };
            await sendMessage(chatId, text, keyboard);
        } else if (data === 'menu_profile') {
            // MATCHING MOCKUP 6: MY PROFILE
            const firstName = callbackQuery.from.first_name || 'User';
            const lastName = callbackQuery.from.last_name || '';
            const telegramId = callbackQuery.from.id;

            const text = `👤 *Your Profile Details*\n\n` +
                         `*Name:* ${firstName} ${lastName}\n` +
                         `*Telegram ID:* \`${telegramId}\`\n\n` +
                         `*Wallet Balance:* ₦0.00\n` +
                         `*Status:* Active 🟢`;
            
            const keyboard = {
                inline_keyboard: [
                    [ { text: '💳 Fund Wallet', callback_data: 'menu_fund' } ],
                    [ { text: '📊 Transaction History', callback_data: 'history' } ],
                    [ { text: '🔙 Back to Menu', callback_data: 'main_menu' } ]
                ]
            };
            await sendMessage(chatId, text, keyboard);
        } else if (data === 'main_menu') {
            // Helper to return to the welcome screen
            const welcomeText = `🏛️ *Vandeza*\n\nWelcome back to *Vandeza*! 🚀\nYour premier VTU & Payments Hub.`;
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📶 Data & Airtime', callback_data: 'service_data' }, { text: '📺 Cable TV', callback_data: 'service_cable' }],
                    [{ text: '💡 Electricity', callback_data: 'service_electricity' }, { text: '🌐 Internet', callback_data: 'service_internet' }],
                    [{ text: '💳 Fund Wallet', callback_data: 'menu_fund' }, { text: '👤 My Profile', callback_data: 'menu_profile' }]
                ]
            };
            await sendMessage(chatId, welcomeText, keyboard);
        } else {
            // Temporary placeholder for unimplemented features
            await sendMessage(chatId, `🛠️ *Feature Coming Soon*:\nThe selection \`${data}\` is not yet implemented, but it looks great in the design!`);
        }
    }
}

// Long Polling function to fetch updates constantly
async function poll() {
    try {
        const response = await sendRequest('getUpdates', {
            offset: offset,
            timeout: 30 // Wait for up to 30s before returning empty (saves resources)
        });

        if (response && response.ok && response.result) {
            for (const update of response.result) {
                // Confirm processing this update so it is not sent again
                offset = update.update_id + 1;
                handleUpdate(update).catch(err => console.error('Error handling update:', err));
            }
        }
    } catch (error) {
        console.error('Polling error:', error);
    }

    // Immediately start polling again for the next update
    setTimeout(poll, 100); 
}

// Initial script execution
console.log('✅ Vandeza Upgraded Design bot is running on native polling...');
poll();
