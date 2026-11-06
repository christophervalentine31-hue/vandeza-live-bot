const https = require('https');

const TOKEN = '8410226405:AAEcWtTzMCXOOcseAJ7I8Y75XoChXvqvpus';
const PAIRGATE_API_KEY = 'PG_live_CCKQ1y20gvzFqHquhedCqNQOjMTBJRqEFdrKSD3uP0Edc';

let lastUpdateId = 0;
const processedUpdates = new Set();
const userState = {};
const userWallets = {}; // Stores user balances securely in memory

console.log("Vandeza bot running with strict wallet balance security enforcement...");

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
            handleActiveState(chatId, text, username);
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

        // Initialize wallet if new user
        if (!userWallets[chatId]) {
            userWallets[chatId] = 0.00; // Default new users to ₦0.00 balance
        }

        if (data === 'menu_fund') {
            delete userState[chatId];
            startSupportFlow(chatId);
        } 
        else if (data === 'menu_profile') {
            const balance = userWallets[chatId];
            const profileText = `👤 **My Profile**\n\n* Name: ${update.callback_query.from.first_name}\n* Username: ${username}\n* Wallet Balance: ₦${balance.toLocaleString('en-NG', {minimumFractionDigits: 2})}\n* Status: Active Reseller Customer`;
            const backKeyboard = { inline_keyboard: [[{ text: '⬅️ Back to Main Menu', callback_data: 'main_menu' }]] };
            editMessage(chatId, messageId, profileText, backKeyboard);
        } 
        else if (data === 'service_data') {
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

        // Purchase Selection Trigger -> Check Wallet & Prompt for Phone Number
        else if (data.startsWith('buy_')) {
            const planKey = data; // e.g. buy_glo_500m
            const planPrice = getPlanPrice(planKey);
            const userBalance = userWallets[chatId];

            // SECURITY CHECK: Reject if balance is insufficient
            if (userBalance < planPrice) {
                const errorText = `❌ *Insufficient Wallet Balance*\n\n` +
                                  `Selected Plan Price: \`₦${planPrice}\`\n` +
                                  `Your Wallet Balance: \`₦${userBalance}\`\n\n` +
                                  `Please fund your wallet using the support menu before purchasing data!`;
                const fundKeyboard = {
                    inline_keyboard: [
                        [{ text: '💳 Fund Wallet / Support', callback_data: 'menu_fund' }],
                        [{ text: '⬅️ Back to Menu', callback_data: 'main_menu' }]
                    ]
                };
                editMessage(chatId, messageId, errorText, fundKeyboard);
                return;
            }

            userState[chatId] = { step: 'awaiting_phone', planCode: planKey, price: planPrice };
            const parts = planKey.split('_');
            const net = parts[1].toUpperCase();
            const promptText = `📱 *Enter Recipient Phone Number*\n\nSelected Plan Cost: \`₦${planPrice}\`\n\nPlease type the 11-digit phone number to receive this data (e.g., 08012345678):`;
            const cancelKeyboard = { inline_keyboard: [[{ text: '❌ Cancel', callback_data: `network_${parts[1]}` }]] };
            editMessage(chatId, messageId, promptText, cancelKeyboard);
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

// Map each plan code to its retail price
function getPlanPrice(planCode) {
    const prices = {
        // Glo
        'buy_glo_200m': 120, 'buy_glo_500m': 250, 'buy_glo_1gb': 480, 'buy_glo_2gb': 950, 'buy_glo_3gb': 1400, 'buy_glo_10gb': 2050,
        // MTN
        'buy_mtn_500m': 300, 'buy_mtn_1gb': 460, 'buy_mtn_2gb': 910, 'buy_mtn_3gb': 1350, 'buy_mtn_5gb': 2220,
        // Airtel
        'buy_airtel_100m': 100, 'buy_airtel_300m': 350, 'buy_airtel_750m': 550, 'buy_airtel_1gb': 480, 'buy_airtel_2gb': 950, 'buy_airtel_5gb': 2200,
        // 9mobile
        'buy_9mobile_500m': 400, 'buy_9mobile_1gb': 550, 'buy_9mobile_2gb': 1050, 'buy_9mobile_3gb': 1500, 'buy_9mobile_5gb': 2450
    };
    return prices[planCode] || 1000; // default safety price
}

function handleActiveState(chatId, text, username) {
    const state = userState[chatId];

    if (state.step === 'awaiting_phone') {
        const phone = text.trim();
        if (phone.length < 10) {
            sendMessage(chatId, "⚠️ Please enter a valid 11-digit phone number:");
            return;
        }
        state.phone = phone;
        const planCode = state.planCode;
        const price = state.price;
        delete userState[chatId]; // Clear state

        sendMessage(chatId, `⏳ Processing order for *${phone}* (Cost: ₦${price})... Please wait.`);
        executePairgatePurchase(chatId, planCode, phone, price);
    } 
    else {
        handleSupportInput(chatId, text, username);
    }
}

// --- PAIRGATE LIVE API PURCHASE & WALLET DEDUCTION ---
function executePairgatePurchase(chatId, planCode, phone, price) {
    const parts = planCode.split('_');
    const network = parts[1]; // mtn, glo, airtel, 9mobile
    const tier = parts[2];

    const postData = JSON.stringify({
        network: network,
        plan: tier,
        phone: phone
    });

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
                    // Deduct from user wallet only upon successful API delivery
                    userWallets[chatId] -= price;

                    sendMessage(chatId, `🎉 *Data Purchase Successful!*\n\n` +
                                        `Network: \`${network.toUpperCase()}\`\n` +
                                        `Recipient: \`${phone}\`\n` +
                                        `Amount Deducted: \`₦${price}\`\n` +
                                        `New Balance: \`₦${userWallets[chatId]}\`\n\nThank you for using Vandeza!`, { parse_mode: 'Markdown' });
                } else {
                    sendMessage(chatId, `❌ *Transaction Failed*\n\nReason: ${result.message || 'Unable to complete fulfillment.'}\nNo funds were deducted from your wallet.`, { parse_mode: 'Markdown' });
                }
            } catch (e) {
                // If API response parse fails but status code is OK, deduct and succeed
                userWallets[chatId] -= price;
                sendMessage(chatId, `🎉 *Data Purchase Successful!*\n\nRecipient: \`${phone}\`\nCost: \`₦${price}\`\nBalance Left: \`₦${userWallets[chatId]}\``, { parse_mode: 'Markdown' });
            }
        });
    });

    req.on('error', (err) => {
        console.error('Pairgate API error:', err);
        sendMessage(chatId, `⚠️ Network connection error with Pairgate fulfillment server. Your wallet was not charged. Please try again.`);
    });

    req.write(postData);
    req.end();
}

function sendMainMenu(chatId, name) {
    delete userState[chatId];
    if (!userWallets[chatId]) userWallets[chatId] = 0.00;
    
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

// --- GLO PAGINATED MENU ---
function sendGloMenu(chatId, messageId) {
    const gloKeyboard = {
        inline_keyboard: [
            [
                { text: '200MB (14D) ₦120', callback_data: 'buy_glo_200m' }, 
                { text: '500MB (30D) ₦250', callback_data: 'buy_glo_500m' }      
            ],
            [
                { text: '1GB (30D) ₦480', callback_data: 'buy_glo_1gb' },     
                { text: '2GB (30D) ₦950', callback_data: 'buy_glo_2gb' }    
            ],
            [
                { text: 'Next Page ➡️', callback_data: 'glo_page_2' }
            ],
            [
                { text: '⬅️ Back to Networks', callback_data: 'service_data' }
            ]
        ]
    };
    editMessage(chatId, messageId, "🟢 *Glo Data Hub (Page 1/2)*\n*Select a plan below:*", gloKeyboard);
}

function sendGloMenuPage2(chatId, messageId) {
    const gloKeyboardPage2 = {
        inline_keyboard: [
            [
                { text: '3GB (30D) ₦1,400', callback_data: 'buy_glo_3gb' },
                { text: '10GB (7D) ₦2,050', callback_data: 'buy_glo_10gb' }
            ],
            [
                { text: '⬅️ Previous Page', callback_data: 'network_glo' }
            ],
            [
                { text: '⬅️ Back to Networks', callback_data: 'service_data' }
            ]
        ]
    };
    editMessage(chatId, messageId, "🟢 *Glo Data Hub (Page 2/2)*\n*Heavyweight plans:*", gloKeyboardPage2);
}

// --- MTN PAGINATED MENU ---
function sendMtnMenu(chatId, messageId) {
    const mtnKeyboard = {
        inline_keyboard: [
            [
                { text: '500MB (30D) ₦300', callback_data: 'buy_mtn_500m' },
                { text: '1GB (30D) ₦460', callback_data: 'buy_mtn_1gb' }
            ],
            [
                { text: '2GB (30D) ₦910', callback_data: 'buy_mtn_2gb' },
                { text: '3GB (30D) ₦1,350', callback_data: 'buy_mtn_3gb' }
            ],
            [
                { text: 'Next Page ➡️', callback_data: 'mtn_page_2' }
            ],
            [
                { text: '⬅️ Back to Networks', callback_data: 'service_data' }
            ]
        ]
    };
    editMessage(chatId, messageId, "🟡 *MTN Data Hub (Page 1/2)*\n*Corporate/SME 30-Day packages:*", mtnKeyboard);
}

function sendMtnMenuPage2(chatId, messageId) {
    const mtnKeyboardPage2 = {
        inline_keyboard: [
            [
                { text: '5GB (30D) ₦2,220', callback_data: 'buy_mtn_5gb' }
            ],
            [
                { text: '⬅️ Previous Page', callback_data: 'network_mtn' }
            ],
            [
                { text: '⬅️ Back to Networks', callback_data: 'service_data' }
            ]
        ]
    };
    editMessage(chatId, messageId, "🟡 *MTN Data Hub (Page 2/2)*\n*Larger volume tiers:*", mtnKeyboardPage2);
}

// --- AIRTEL PAGINATED MENU ---
function sendAirtelMenu(chatId, messageId) {
    const airtelKeyboard = {
        inline_keyboard: [
            [
                { text: '100MB (1D) ₦100', callback_data: 'buy_airtel_100m' },
                { text: '300MB (7D) ₦350', callback_data: 'buy_airtel_300m' }
            ],
            [
                { text: '750MB (14D) ₦550', callback_data: 'buy_airtel_750m' },
                { text: '1GB (30D) ₦480', callback_data: 'buy_airtel_1gb' }
            ],
            [
                { text: 'Next Page ➡️', callback_data: 'airtel_page_2' }
            ],
            [
                { text: '⬅️ Back to Networks', callback_data: 'service_data' }
            ]
        ]
    };
    editMessage(chatId, messageId, "🔴 *Airtel Data Hub (Page 1/2)*\n*Flexible options & validities:*", airtelKeyboard);
}

function sendAirtelMenuPage2(chatId, messageId) {
    const airtelKeyboardPage2 = {
        inline_keyboard: [
            [
                { text: '2GB (30D) ₦950', callback_data: 'buy_airtel_2gb' },
                { text: '5GB (30D) ₦2,200', callback_data: 'buy_airtel_5gb' }
            ],
            [
                { text: '⬅️ Previous Page', callback_data: 'network_airtel' }
            ],
            [
                { text: '⬅️ Back to Networks', callback_data: 'service_data' }
            ]
        ]
    };
    editMessage(chatId, messageId, "🔴 *Airtel Data Hub (Page 2/2)*\n*Higher volume plans:*", airtelKeyboardPage2);
}

// --- 9MOBILE PAGINATED MENU ---
function sendNineMobileMenu(chatId, messageId) {
    const nineMobileKeyboard = {
        inline_keyboard: [
            [
                { text: '500MB (30D) ₦400', callback_data: 'buy_9mobile_500m' },
                { text: '1GB (30D) ₦550', callback_data: 'buy_9mobile_1gb' }
            ],
            [
                { text: '2GB (30D) ₦1,050', callback_data: 'buy_9mobile_2gb' },
                { text: '3GB (30D) ₦1,500', callback_data: 'buy_9mobile_3gb' }
            ],
            [
                { text: 'Next Page ➡️', callback_data: '9mobile_page_2' }
            ],
            [
                { text: '⬅️ Back to Networks', callback_data: 'service_data' }
            ]
        ]
    };
    editMessage(chatId, messageId, "📱 *9mobile Data Hub (Page 1/2)*\n*Affordable options:*", nineMobileKeyboard);
}

function sendNineMobileMenuPage2(chatId, messageId) {
    const nineMobileKeyboardPage2 = {
        inline_keyboard: [
            [
                { text: '5GB (30D) ₦2,450', callback_data: 'buy_9mobile_5gb' }
            ],
            [
                { text: '⬅️ Previous Page', callback_data: 'network_9mobile' }
            ],
            [
                { text: '⬅️ Back to Networks', callback_data: 'service_data' }
            ]
        ]
    };
    editMessage(chatId, messageId, "📱 *9mobile Data Hub (Page 2/2)*\n*Larger data packages:*", nineMobileKeyboardPage2);
}

// --- SUPPORT / REFUND FLOW ---
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
