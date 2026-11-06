const https = require('https');

const TOKEN = '8410226405:AAEcWtTzMCXOOcseAJ7I8Y75XoChXvqvpus';
let lastUpdateId = 0;

// Track user states for support/refund flow (e.g., waiting for bank account number)
const userState = {};

console.log("Vandeza bot is running with Fintech UI & Support Assistant...");

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
    if (update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        const firstName = update.message.from.first_name || 'User';
        const username = update.message.from.username ? `@${update.message.from.username}` : 'No Username';

        // Check if user is in a middle of a support/refund input flow
        if (userState[chatId]) {
            handleSupportInput(chatId, text, username);
            return;
        }

        if (text === '/start') {
            sendMainMenu(chatId, firstName);
        } else if (text === 'support_refund') {
            startSupportFlow(chatId);
        } else {
            sendMessage(chatId, "Please use the menu buttons below to navigate Vandeza.");
        }
    } 
    else if (update.callback_query) {
        const chatId = update.callback_query.message.chat.id;
        const data = update.callback_query.data;
        const username = update.callback_query.from.username ? `@${update.callback_query.from.username}` : 'No Username';

        answerCallbackQuery(update.callback_query.id);

        if (data === 'menu_fund') {
            // Trigger the support & refund assistant flow
            startSupportFlow(chatId);
        } else if (data === 'menu_profile') {
            sendMessage(chatId, `👤 **My Profile**\n\n* Name: ${update.callback_query.from.first_name}\n* Username: ${username}\n* Wallet Balance: ₦0.00\n* Status: Active Reseller Customer`, { parse_mode: 'Markdown' });
        } else {
            sendMessage(chatId, `🛠️ **Feature Coming Soon:**\nThe selection \`${data}\` is under configuration, but your fintech hub is live!`, { parse_mode: 'Markdown' });
        }
    }
}

function sendMainMenu(chatId, name) {
    // Clear any active state when starting fresh
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
        
        // Summary message back to user
        const summary = `🎉 *Refund Request Submitted Successfully!*\n\n` +
                        `Our admin team has received your details for review:\n` +
                        `* Amount: ${state.amount}\n` +
                        `* Account Number: ${state.accountNumber}\n` +
                        `* Bank: ${state.bankName}\n` +
                        `* Account Name: ${state.accountName}\n\n` +
                        `Your refund will be processed shortly. Thank you for using Vandeza!`;
        
        sendMessage(chatId, summary, { parse_mode: 'Markdown' });

        // NOTE: In a future upgrade, you can have this forward directly to your admin chat ID!
        console.log(`NEW REFUND TICKET from ${username} (${chatId}): Amount: ${state.amount}, Acc: ${state.accountNumber}, Bank: ${state.bankName}, Name: ${state.accountName}`);

        // Clear user state
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

    const req = https.request(options, (res) => {
        res.on('data', () => {});
    });
    req.on('error', (e) => {
        console.error('Error sending message:', e);
    });
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

    const req = https.request(options, (res) => {
        res.on('data', () => {});
    });
    req.write(data);
    req.end();
}

pollUpdates();
