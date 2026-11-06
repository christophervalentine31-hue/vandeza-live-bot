const https = require('https');

const TOKEN = '8410226405:AAEcWtTzMCXOOcseAJ7I8Y75XoChXvqvpus';
let lastUpdateId = 0;
const processedUpdates = new Set();
const userState = {};

console.log("Vandeza bot running with all networks (MTN, Airtel, Glo, 9mobile)...");

function pollUpdates() {
    const url = `https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;

    https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                const response = JSON.parse(data);
                if (response.ok && response.result) {
                    for (let update of response.result) {
                        lastUpdateId = update.update_id;
                        
                        if (processedUpdates.has(update.update_id)) continue;
                        processedUpdates.add(update.update_id);
                        
                        if (processedUpdates.size > 150) {
                            const firstKey = processedUpdates.values().next().value;
                            processedUpdates.delete(firstKey);
                        }

                        handleUpdate(update);
                    }
                }
            } catch (e) {
                console.error("Error parsing updates:", e);
            }
            setTimeout(pollUpdates, 1000);
        });
    }).on('error', (err) => {
        console.error("Network error:", err);
        setTimeout(pollUpdates, 5000);
    });
}

function handleUpdate(update) {
    if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        const firstName = update.message.from.first_name || 'User';
        const username = update.message.from.username ? `@${update.message.from.username}` : 'No Username';

        if (userState[chatId]) {
            handleSupportInput(chatId, text, username);
            return;
        }

        if (text === '/start') {
            sendMainMenu(chatId, firstName);
        } else {
            sendMessage(chatId, "Please use the menu buttons below to navigate Vandeza.");
        }
    } 
    else if (update.callback_query) {
        const chatId = update.callback_query.message.chat.id;
        const messageId = update.callback_query.message.message_id;
        const data = update.callback_query.data;
        const username = update.callback_query.from.username ? `@${update.callback_query.from.username}` : 'No Username';

        answerCallbackQuery(update.callback_query.id);

        if (data === 'menu_fund') {
            delete userState[chatId];
            startSupportFlow(chatId);
        } 
        else if (data === 'menu_profile') {
            const profileText = `👤 **My Profile**\n\n* Name: ${update.callback_query.from.first_name}\n* Username: ${username}\n* Wallet Balance: ₦0.00\n* Status: Active Reseller Customer`;
            const backKeyboard = { inline_keyboard: [[{ text: '⬅️ Back to Main Menu', callback_data: 'main_menu' }]] };
            editMessage(chatId, messageId, profileText, backKeyboard);
        } 
        else if (data === 'service_data') {
            sendNetworkMenu(chatId, messageId);
        } 
        // Network Menus
        else if (data === 'network_mtn') {
            sendMtnMenu(chatId, messageId);
        }
        else if (data === 'network_airtel') {
            sendAirtelMenu(chatId, messageId);
        }
        else if (data === 'network_glo') {
            sendGloMenu(chatId, messageId);
        }
        else if (data === 'network_9mobile') {
            sendNineMobileMenu(chatId, messageId);
        }
        // Purchase Handlers
        else if (data.startsWith('buy_glo_') || data.startsWith('buy_mtn_') || data.startsWith('buy_airtel_') || data.startsWith('buy_9mobile_')) {
            const networkPrefix = data.split('_')[1].toUpperCase();
            const orderText = `🚀 *API Order Triggered!*\n\nNetwork: \`${networkPrefix}\`\nSelected Code: \`${data}\`\n\nThis will connect to Pairgate wholesale fulfillment while keeping your markup profit secure!`;
            const backKeyboard = { inline_keyboard: [[{ text: `⬅️ Back to ${networkPrefix} Menu`, callback_data: `network_${data.split('_')[1]}` }]] };
            editMessage(chatId, messageId, orderText, backKeyboard);
        } 
        else if (data === 'main_menu') {
            delete userState[chatId];
            const welcomeText = `🏛️ *Vandeza*\n\nWelcome to Vandeza! 🚀\nYour premier VTU & Payments Hub, *${update.callback_query.from.first_name}*.`;
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
                        { text: '💳 Fund Wallet / Support', callback_data: 'menu_fund' },
                        { text: '👤 My Profile', callback_data: 'menu_profile' }
                    ]
                ]
            };
            editMessage(chatId, messageId, welcomeText, keyboard);
        } 
        else {
            const comingSoonText = `🛠️ **Feature Coming Soon:**\nThe selection \`${data}\` is under configuration, but your fintech hub is live!`;
            const backKeyboard = { inline_keyboard: [[{ text: '⬅️ Back to Main Menu', callback_data: 'main_menu' }]] };
            editMessage(chatId, messageId, comingSoonText, backKeyboard);
        }
    }
}

function sendMainMenu(chatId, name) {
    delete userState[chatId];
    const welcomeText = `🏛️ *Vandeza*\n\nWelcome to Vandeza! 🚀\nYour premier VTU & Payments Hub, *${name}*.`;
    
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
                { text: '💳 Fund Wallet / Support', callback_data: 'menu_fund' },
                { text: '👤 My Profile', callback_data: 'menu_profile' }
            ]
        ]
    };

    sendMessage(chatId, welcomeText, { parse_mode: 'Markdown', reply_markup: keyboard });
}

function sendNetworkMenu(chatId, messageId) {
    const networkKeyboard = {
        inline_keyboard: [
            [
                { text: '🟡 MTN', callback_data: 'network_mtn' },
                { text: '🔴 Airtel', callback_data: 'network_airtel' }
            ],
            [
                { text: '🟢 Glo', callback_data: 'network_glo' },
                { text: '📱 9mobile', callback_data: 'network_9mobile' }
            ],
            [
                { text: '⬅️ Back to Main Menu', callback_data: 'main_menu' }
            ]
        ]
    };
    editMessage(chatId, messageId, "📶 *Data & Airtime Service*\n\nPlease select your target Network Provider below:", networkKeyboard);
}

// GLO Menu
function sendGloMenu(chatId, messageId) {
    const gloKeyboard = {
        inline_keyboard: [
            [
                { text: 'Glo 500MB (₦300)', callback_data: 'buy_glo_500m' }, 
                { text: 'Glo 1GB (₦310)', callback_data: 'buy_glo_1gb' }      
            ],
            [
                { text: 'Glo 2GB (₦600)', callback_data: 'buy_glo_2gb' },     
                { text: 'Glo 3GB (₦1,250)', callback_data: 'buy_glo_3gb' }    
            ],
            [
                { text: 'Glo 5GB (₦1,350)', callback_data: 'buy_glo_5gb' }    
            ],
            [
                { text: '⬅️ Back to Networks', callback_data: 'service_data' }
            ]
        ]
    };
    editMessage(chatId, messageId, "🟢 *Glo Network Selected*\n\nChoose your preferred GLO data plan below:", gloKeyboard);
}

// MTN Menu (Market Hook & Marked up tiers)
function sendMtnMenu(chatId, messageId) {
    const mtnKeyboard = {
        inline_keyboard: [
            [
                { text: 'MTN 500MB (₦150)', callback_data: 'buy_mtn_500m' },
                { text: 'MTN 1GB (₦290)', callback_data: 'buy_mtn_1gb' }
            ],
            [
                { text: 'MTN 2GB (₦580)', callback_data: 'buy_mtn_2gb' },
                { text: 'MTN 3GB (₦870)', callback_data: 'buy_mtn_3gb' }
            ],
            [
                { text: 'MTN 5GB (₦1,450)', callback_data: 'buy_mtn_5gb' }
            ],
            [
                { text: '⬅️ Back to Networks', callback_data: 'service_data' }
            ]
        ]
    };
    editMessage(chatId, messageId, "🟡 *MTN Network Selected*\n\nChoose your preferred MTN data plan below:", mtnKeyboard);
}

// Airtel Menu
function sendAirtelMenu(chatId, messageId) {
    const airtelKeyboard = {
        inline_keyboard: [
            [
                { text: 'Airtel 100MB (₦100)', callback_data: 'buy_airtel_100m' },
                { text: 'Airtel 300MB (₦300)', callback_data: 'buy_airtel_300m' }
            ],
            [
                { text: 'Airtel 750MB (₦500)', callback_data: 'buy_airtel_750m' },
                { text: 'Airtel 1GB (₦320)', callback_data: 'buy_airtel_1gb' }
            ],
            [
                { text: 'Airtel 2GB (₦620)', callback_data: 'buy_airtel_2gb' },
                { text: 'Airtel 5GB (₦1,500)', callback_data: 'buy_airtel_5gb' }
            ],
            [
                { text: '⬅️ Back to Networks', callback_data: 'service_data' }
            ]
        ]
    };
    editMessage(chatId, messageId, "🔴 *Airtel Network Selected*\n\nChoose your preferred Airtel data plan below:", airtelKeyboard);
}

// 9mobile Menu
function sendNineMobileMenu(chatId, messageId) {
    const nineMobileKeyboard = {
        inline_keyboard: [
            [
                { text: '9mobile 500MB (₦350)', callback_data: 'buy_9mobile_500m' },
                { text: '9mobile 1GB (₦500)', callback_data: 'buy_9mobile_1gb' }
            ],
            [
                { text: '9mobile 2GB (₦950)', callback_data: 'buy_9mobile_2gb' },
                { text: '9mobile 3GB (₦1,400)', callback_data: 'buy_9mobile_3gb' }
            ],
            [
                { text: '⬅️ Back to Networks', callback_data: 'service_data' }
            ]
        ]
    };
    editMessage(chatId, messageId, "📱 *9mobile Network Selected*\n\nChoose your preferred 9mobile data plan below:", nineMobileKeyboard);
}

function startSupportFlow(chatId) {
    userState[chatId] = { step: 'awaiting_amount' };
    const msg = `🤝 *Vandeza Support & Overfunding Assistant*\n\n` +
                `Wallet deposits are strictly locked for automated service purchases (Data, Airtime, Bills).\n\n` +
                `If you mistakenly overfunded your account and need a manual refund, let's collect your safe bank details.\n\n` +
                `*Step 1/3:* Please enter the *exact amount* you mistakenly transferred (e.g., ₦5000):`;
    sendMessage(chatId, msg, { parse_mode: 'Markdown' });
}

function handleSupportInput(chatId, text, username) {
    const state = userState[chatId];

    if (state.step === 'awaiting_amount') {
        state.amount = text;
        state.step = 'awaiting_account_number';
        sendMessage(chatId, `✅ Amount recorded: *${text}*\n\n*Step 2/3:* Please enter your 10-digit *Bank Account Number*:`, { parse_mode: 'Markdown' });
    } 
    else if (state.step === 'awaiting_account_number') {
        state.accountNumber = text;
        state.step = 'awaiting_bank_name';
        sendMessage(chatId, `✅ Account Number recorded.\n\n*Step 3/3:* Please enter your *Bank Name* (e.g., OPay, Moniepoint, Access):`, { parse_mode: 'Markdown' });
    } 
    else if (state.step === 'awaiting_bank_name') {
        state.bankName = text;
        state.step = 'awaiting_account_name';
        sendMessage(chatId, `✅ Bank Name recorded.\n\nFinally, please enter your exact *Account Name* as registered on your bank account:`, { parse_mode: 'Markdown' });
    } 
    else if (state.step === 'awaiting_account_name') {
        state.accountName = text;
        const summary = `🎉 *Refund Request Submitted Successfully!*\n\n` +
                        `Our admin team has received your details for review:\n` +
                        `* Amount: ${state.amount}\n` +
                        `* Account Number: ${state.accountNumber}\n` +
                        `* Bank: ${state.bankName}\n` +
                        `* Account Name: ${state.accountName}\n\n` +
                        `Your refund will be processed shortly. Thank you for using Vandeza!`;
        sendMessage(chatId, summary, { parse_mode: 'Markdown' });
        console.log(`NEW REFUND TICKET from ${username} (${chatId}): Amount: ${state.amount}, Acc: ${state.accountNumber}, Bank: ${state.bankName}, Name: ${state.accountName}`);
        delete userState[userState[chatId] ? chatId : '']; // clear
        delete userState[chatId];
    }
}

function sendMessage(chatId, text, extra = {}) {
    const data = JSON.stringify({ chat_id: chatId, text: text, ...extra });
    const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${TOKEN}/sendMessage`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };
    const req = https.request(options, (res) => { res.on('data', () => {}); });
    req.on('error', (e) => { console.error('Error sending message:', e); });
    req.write(data);
    req.end();
}

function editMessage(chatId, messageId, text, keyboard) {
    const data = JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
    const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${TOKEN}/editMessageText`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };
    const req = https.request(options, (res) => { res.on('data', () => {}); });
    req.on('error', (e) => { console.error('Error editing message:', e); });
    req.write(data);
    req.end();
}

function answerCallbackQuery(callbackQueryId) {
    const data = JSON.stringify({ callback_query_id: callbackQueryId });
    const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${TOKEN}/answerCallbackQuery`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };
    const req = https.request(options, (res) => { res.on('data', () => {}); });
    req.write(data);
    req.end();
}

pollUpdates();
