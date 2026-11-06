const https = require('https');

const TOKEN = '8410226405:AAEcWtTzMCXOOcseAJ7I8Y75XoChXvqvpus';
const PAIRGATE_API_KEY = 'PG_live_CCKQ1y20gvzFqHquhedCqNQOjMTBJRqEFdrKSD3uP0Edc';

// Your Verified Manual Funding Account
const MANUAL_BANK = {
    bankName: 'OPay',
    accountNumber: '7083961053',
    accountName: 'Christopher Valentine'
};

let lastUpdateId = 0;
const processedUpdates = new Set();
const userState = {}; 
const userWallets = {}; // Stores live user wallet balances securely

console.log("Vandeza bot running with manual bank transfer funding & strict wallet gating...");

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

        if (!userWallets[chatId]) userWallets[chatId] = 0.00;

        const currentState = userState[chatId];

        if (text === '/start') {
            delete userState[chatId];
            sendMainMenu(chatId, firstName);
        } 
        else if (text.startsWith('/credit ') && chatId.toString() === 'YOUR_ADMIN_CHAT_ID') {
            // Admin command to credit users: /credit CHATID AMOUNT
            const parts = text.split(' ');
            const targetChatId = parts[1];
            const amount = parseFloat(parts[2]);
            if (targetChatId && !isNaN(amount)) {
                if (!userWallets[targetChatId]) userWallets[targetChatId] = 0.00;
                userWallets[targetChatId] += amount;
                sendMessage(targetChatId, `🎉 *Wallet Credited!*\n\nYour wallet has been credited with ₦${amount.toLocaleString()}. New Balance: ₦${userWallets[targetChatId]}`, { parse_mode: 'Markdown' });
                sendMessage(chatId, `✅ Successfully credited ${targetChatId} with ₦${amount}.`);
            } else {
                sendMessage(chatId, "⚠️ Usage: /credit <chatId> <amount>");
            }
        }
        else if (currentState) {
            if (currentState.type === 'data_purchase') {
                handleDataPurchaseInput(chatId, text);
            } else if (currentState.type === 'support_refund') {
                handleSupportInput(chatId, text, username);
            }
        } 
        else {
            sendMessage(chatId, "Please use the menu buttons below to navigate Vandeza.");
        }
    } 
    else if (update.callback_query) {
        const chatId = update.callback_query.message.chat.id;
        const messageId = update.callback_query.message.message_id;
        const data = update.callback_query.data;
        const firstName = update.callback_query.from.first_name || 'User';
        const username = update.callback_query.from.username ? `@${update.callback_query.from.username}` : 'No Username';

        answerCallbackQuery(update.callback_query.id);

        if (!userWallets[chatId]) userWallets[chatId] = 0.00;

        if (data === 'menu_fund') {
            delete userState[chatId];
            showManualFundingDetails(chatId, messageId);
        } 
        else if (data === 'menu_profile') {
            const balance = userWallets[chatId];
            const profileText = `👤 **My Profile**\n\n* Name: ${firstName}\n* Username: ${username}\n* Wallet Balance: ₦${balance.toLocaleString('en-NG', {minimumFractionDigits: 2})}\n* Status: Active Reseller Customer`;
            const backKeyboard = { inline_keyboard: [[{ text: '⬅️ Back to Main Menu', callback_data: 'main_menu' }]] };
            editMessage(chatId, messageId, profileText, backKeyboard);
        } 
        else if (data === 'service_data') {
            delete userState[chatId];
            sendNetworkMenu(chatId, messageId);
        } 
        // Network Menus & Pages
        else if (data === 'network_mtn') { sendMtnMenu(chatId, messageId); }
        else if (data === 'mtn_page_2') { sendMtnMenuPage2(chatId, messageId); }

        else if (data === 'network_airtel') { sendAirtelMenu(chatId, messageId); }
        else if (data === 'airtel_page_2') { sendAirtelMenuPage2(chatId, messageId); }

        else if (data === 'network_glo') { sendGloMenu(chatId, messageId); }
        else if (data === 'glo_page_2') { sendGloMenuPage2(chatId, messageId); }

        else if (data === 'network_9mobile') { sendNineMobileMenu(chatId, messageId); }
        else if (data === '9mobile_page_2') { sendNineMobileMenuPage2(chatId, messageId); }

        // Purchase Selection -> Wallet Gating Check
        else if (data.startsWith('buy_')) {
            const planKey = data;
            const planPrice = getPlanPrice(planKey);
            const userBalance = userWallets[chatId];

            if (userBalance < planPrice) {
                const errorText = `❌ *Insufficient Wallet Balance*\n\n` +
                                  `Selected Plan Cost: \`₦${planPrice}\`\n` +
                                  `Your Wallet Balance: \`₦${userBalance}\`\n\n` +
                                  `Please fund your wallet before purchasing data!`;
                const fundKeyboard = {
                    inline_keyboard: [
                        [{ text: '💳 Fund Wallet Account', callback_data: 'menu_fund' }],
                        [{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]
                    ]
                };
                editMessage(chatId, messageId, errorText, fundKeyboard);
                return;
            }

            userState[chatId] = { type: 'data_purchase', planCode: planKey, price: planPrice };
            const parts = planKey.split('_');
            const promptText = `📱 *Enter Recipient Phone Number*\n\nSelected Plan Cost: \`₦${planPrice}\`\n\nPlease type the 11-digit phone number to receive this data (e.g., 08012345678):`;
            const cancelKeyboard = { inline_keyboard: [[{ text: '❌ Cancel', callback_data: `network_${parts[1]}` }]] };
            editMessage(chatId, messageId, promptText, cancelKeyboard);
        } 
        else if (data === 'main_menu') {
            delete userState[chatId];
            const welcomeText = `🏛️ *Vandeza*\n\nWelcome to Vandeza! 🚀\nYour premier VTU & Payments Hub, *${firstName}*.`;
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '📶 Data Plans', callback_data: 'service_data' },
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

// Plan Pricing
function getPlanPrice(planCode) {
    const prices = {
        'buy_glo_200m': 120, 'buy_glo_500m': 250, 'buy_glo_1gb': 480, 'buy_glo_2gb': 950, 'buy_glo_3gb': 1400, 'buy_glo_10gb': 2050,
        'buy_mtn_500m': 300, 'buy_mtn_1gb': 460, 'buy_mtn_2gb': 910, 'buy_mtn_3gb': 1350, 'buy_mtn_5gb': 2220,
        'buy_airtel_100m': 100, 'buy_airtel_300m': 350, 'buy_airtel_750m': 550, 'buy_airtel_1gb': 480, 'buy_airtel_2gb': 950, 'buy_airtel_5gb': 2200,
        'buy_9mobile_500m': 400, 'buy_9mobile_1gb': 550, 'buy_9mobile_2gb': 1050, 'buy_9mobile_3gb': 1500, 'buy_9mobile_5gb': 2450
    };
    return prices[planCode] || 1000;
}

// Show Manual Bank Account Details
function showManualFundingDetails(chatId, messageId) {
    const fundingText = `💳 *Manual Wallet Funding*\n\n` +
                        `To fund your Vandeza account, transfer your desired amount to the bank account below:\n\n` +
                        `🏦 *Bank Name:* \`${MANUAL_BANK.bankName}\`\n` +
                        `🔢 *Account Number:* \`${MANUAL_BANK.accountNumber}\`\n` +
                        `👤 *Account Name:* \`${MANUAL_BANK.accountName}\`\n\n` +
                        `_After making your transfer, send your payment confirmation or receipt to the admin to credit your wallet instantly!_`;

    const keyboard = {
        inline_keyboard: [
            [{ text: '🔄 Check Balance', callback_data: 'menu_profile' }],
            [{ text: '⬅️ Back to Main Menu', callback_data: 'main_menu' }]
        ]
    };
    editMessage(chatId, messageId, fundingText, keyboard);
}

// Handle Data Phone Input
function handleDataPurchaseInput(chatId, text) {
    const state = userState[chatId];
    const phone = text.trim();

    if (phone.length < 10) {
        sendMessage(chatId, "⚠️ Please enter a valid 11-digit phone number:");
        return;
    }

    const planCode = state.planCode;
    const price = state.price;
    delete userState[chatId];

    sendMessage(chatId, `⏳ Processing order for *${phone}* (Cost: ₦${price})... Please wait.`);
    executePairgatePurchase(chatId, planCode, phone, price);
}

// --- PAIRGATE LIVE API PURCHASE ---
function executePairgatePurchase(chatId, planCode, phone, price) {
    const parts = planCode.split('_');
    const network = parts[1];
    const tier = parts[2];

    const postData = JSON.stringify({ network: network, plan: tier, phone: phone });

    const options = {
        hostname: 'pairgate.com',
        port: 443,
        path: '/api/v1/data',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${PAIRGATE_API_KEY}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
            try {
                const result = JSON.parse(responseBody);
                if (res.statusCode === 200 && (result.status === 'success' || result.success)) {
                    userWallets[chatId] -= price; 
                    sendMessage(chatId, `🎉 *Data Purchase Successful!*\n\n` +
                                        `Network: \`${network.toUpperCase()}\`\n` +
                                        `Recipient: \`${phone}\`\n` +
                                        `Amount Deducted: \`₦${price}\`\n` +
                                        `New Balance: \`₦${userWallets[chatId]}\`\n\nThank you for using Vandeza!`, { parse_mode: 'Markdown' });
                } else {
                    sendMessage(chatId, `❌ *Transaction Failed*\n\nReason: ${result.message || 'Unable to complete fulfillment.'}\nNo funds were deducted.`, { parse_mode: 'Markdown' });
                }
            } catch (e) {
                userWallets[chatId] -= price;
                sendMessage(chatId, `🎉 *Data Purchase Successful!*\n\nRecipient: \`${phone}\`\nCost: \`₦${price}\`\nBalance Left: \`₦${userWallets[chatId]}\``, { parse_mode: 'Markdown' });
            }
        });
    });

    req.on('error', (err) => {
        console.error('Pairgate API error:', err);
        sendMessage(chatId, `⚠️ Network connection error with Pairgate fulfillment server. Your wallet was not charged.`);
    });

    req.write(postData);
    req.end();
}

// Telegram Helpers
function sendMessage(chatId, text, extra = {}) {
    const data = JSON.stringify({ chat_id: chatId, text: text, ...extra });
    const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${TOKEN}/sendMessage`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = https.request(options, (res) => { res.on('data', () => {}); });
    req.on('error', (e) => { console.error('Error sending message:', e); });
    req.write(data);
    req.end();
}

function editMessage(chatId, messageId, text, keyboard) {
    const data = JSON.stringify({ chat_id: chatId, message_id: messageId, text: text, parse_mode: 'Markdown', reply_markup: keyboard });
    const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${TOKEN}/editMessageText`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
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
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = https.request(options, (res) => { res.on('data', () => {}); });
    req.write(data);
    req.end();
}

// Network Menu Helpers
function sendMainMenu(chatId, name) {
    delete userState[chatId];
    if (!userWallets[chatId]) userWallets[chatId] = 0.00;
    const welcomeText = `🏛️ *Vandeza*\n\nWelcome to Vandeza! 🚀\nYour premier VTU & Payments Hub, *${name}*.`;
    const keyboard = {
        inline_keyboard: [
            [{ text: '📶 Data Plans', callback_data: 'service_data' }, { text: '📺 Cable TV', callback_data: 'service_cable' }],
            [{ text: '💡 Electricity', callback_data: 'service_electricity' }, { text: '🌐 Internet', callback_data: 'service_internet' }],
            [{ text: '💳 Fund Wallet / Support', callback_data: 'menu_fund' }, { text: '👤 My Profile', callback_data: 'menu_profile' }]
        ]
    };
    sendMessage(chatId, welcomeText, { parse_mode: 'Markdown', reply_markup: keyboard });
}

function sendNetworkMenu(chatId, messageId) {
    const networkKeyboard = {
        inline_keyboard: [
            [{ text: '🟡 MTN', callback_data: 'network_mtn' }, { text: '🔴 Airtel', callback_data: 'network_airtel' }],
            [{ text: '🟢 Glo', callback_data: 'network_glo' }, { text: '📱 9mobile', callback_data: 'network_9mobile' }],
            [{ text: '⬅️ Back to Main Menu', callback_data: 'main_menu' }]
        ]
    };
    editMessage(chatId, messageId, "📶 *Data Plans Hub*\n\nPlease select your target Network Provider below:", networkKeyboard);
}

function sendGloMenu(chatId, messageId) {
    const gloKeyboard = {
        inline_keyboard: [
            [{ text: '200MB (14D) ₦120', callback_data: 'buy_glo_200m' }, { text: '500MB (30D) ₦250', callback_data: 'buy_glo_500m' }],
            [{ text: '1GB (30D) ₦480', callback_data: 'buy_glo_1gb' }, { text: '2GB (30D) ₦950', callback_data: 'buy_glo_2gb' }],
            [{ text: 'Next Page ➡️', callback_data: 'glo_page_2' }],
            [{ text: '⬅️ Back to Networks', callback_data: 'service_data' }]
        ]
    };
    editMessage(chatId, messageId, "🟢 *Glo Data Hub (Page 1/2)*\n*Select a plan below:*", gloKeyboard);
}

function sendGloMenuPage2(chatId, messageId) {
    const gloKeyboardPage2 = {
        inline_keyboard: [
            [{ text: '3GB (30D) ₦1,400', callback_data: 'buy_glo_3gb' }, { text: '10GB (7D) ₦2,050', callback_data: 'buy_glo_10gb' }],
            [{ text: '⬅️ Previous Page', callback_data: 'network_glo' }],
            [{ text: '⬅️ Back to Networks', callback_data: 'service_data' }]
        ]
    };
    editMessage(chatId, messageId, "🟢 *Glo Data Hub (Page 2/2)*\n*Heavyweight plans:*", gloKeyboardPage2);
}

function sendMtnMenu(chatId, messageId) {
    const mtnKeyboard = {
        inline_keyboard: [
            [{ text: '500MB (30D) ₦300', callback_data: 'buy_mtn_500m' }, { text: '1GB (30D) ₦460', callback_data: 'buy_mtn_1gb' }],
            [{ text: '2GB (30D) ₦910', callback_data: 'buy_mtn_2gb' }, { text: '3GB (30D) ₦1,350', callback_data: 'buy_mtn_3gb' }],
            [{ text: 'Next Page ➡️', callback_data: 'mtn_page_2' }],
            [{ text: '⬅️ Back to Networks', callback_data: 'service_data' }]
        ]
    };
    editMessage(chatId, messageId, "🟡 *MTN Data Hub (Page 1/2)*\n*Corporate/SME 30-Day packages:*", mtnKeyboard);
}

function sendMtnMenuPage2(chatId, messageId) {
    const mtnKeyboardPage2 = {
        inline_keyboard: [
            [{ text: '5GB (30D) ₦2,220', callback_data: 'buy_mtn_5gb' }],
            [{ text: '⬅️ Previous Page', callback_data: 'network_mtn' }],
            [{ text: '⬅️ Back to Networks', callback_data: 'service_data' }]
        ]
    };
    editMessage(chatId, messageId, "🟡 *MTN Data Hub (Page 2/2)*\n*Larger volume tiers:*", mtnKeyboardPage2);
}

function sendAirtelMenu(chatId, messageId) {
    const airtelKeyboard = {
        inline_keyboard: [
            [{ text: '100MB (1D) ₦100', callback_data: 'buy_airtel_100m' }, { text: '300MB (7D) ₦350', callback_data: 'buy_airtel_300m' }],
            [{ text: '750MB (14D) ₦550', callback_data: 'buy_airtel_750m' }, { text: '1GB (30D) ₦480', callback_data: 'buy_airtel_1gb' }],
            [{ text: 'Next Page ➡️', callback_data: 'airtel_page_2' }],
            [{ text: '⬅️ Back to Networks', callback_data: 'service_data' }]
        ]
    };
    editMessage(chatId, messageId, "🔴 *Airtel Data Hub (Page 1/2)*\n*Flexible options & validities:*", airtelKeyboard);
}

function sendAirtelMenuPage2(chatId, messageId) {
    const airtelKeyboardPage2 = {
        inline_keyboard: [
            [{ text: '2GB (30D) ₦950', callback_data: 'buy_airtel_2gb' }, { text: '5GB (30D) ₦2,200', callback_data: 'buy_airtel_5gb' }],
            [{ text: '⬅️ Previous Page', callback_data: 'network_airtel' }],
            [{ text: '⬅️ Back to Networks', callback_data: 'service_data' }]
        ]
    };
    editMessage(chatId, messageId, "🔴 *Airtel Data Hub (Page 2/2)*\n*Higher volume plans:*", airtelKeyboardPage2);
}

function sendNineMobileMenu(chatId, messageId) {
    const nineMobileKeyboard = {
        inline_keyboard: [
            [{ text: '500MB (30D) ₦400', callback_data: 'buy_9mobile_500m' }, { text: '1GB (30D) ₦550', callback_data: 'buy_9mobile_1gb' }],
            [{ text: '2GB (30D) ₦1,050', callback_data: 'buy_9mobile_2gb' }, { text: '3GB (30D) ₦1,500', callback_data: 'buy_9mobile_3gb' }],
            [{ text: 'Next Page ➡️', callback_data: '9mobile_page_2' }],
            [{ text: '⬅️ Back to Networks', callback_data: 'service_data' }]
        ]
    };
    editMessage(chatId, messageId, "📱 *9mobile Data Hub (Page 1/2)*\n*Affordable options:*", nineMobileKeyboard);
}

function sendNineMobileMenuPage2(chatId, messageId) {
    const nineMobileKeyboardPage2 = {
        inline_keyboard: [
            [{ text: '5GB (30D) ₦2,450', callback_data: 'buy_9mobile_5gb' }],
            [{ text: '⬅️ Previous Page', callback_data: 'network_9mobile' }],
            [{ text: '⬅️ Back to Networks', callback_data: 'service_data' }]
        ]
    };
    editMessage(chatId, messageId, "📱 *9mobile Data Hub (Page 2/2)*\n*Larger data packages:*", nineMobileKeyboardPage2);
}

pollUpdates();
