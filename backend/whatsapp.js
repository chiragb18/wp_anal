const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const Chat = require('./models/Chat');
const Message = require('./models/Message');

let client;
let lastQr = null;
let _io = null;
let isReady = false;
let isSyncing = false;
let cachedChats = [];
let syncPromise = null;

// PRO ENGINEER: Performance Queue for Parallel Syncing
const MAX_CONCURRENT_SYNC = 5;

const initializeWhatsApp = (io) => {
    _io = io;
    
    client = new Client({
        authStrategy: new LocalAuth({ clientId: "whatsapp-ai-analyzer-session", dataPath: './.wwebjs_auth' }),
        webVersionCache: { type: 'local' },
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
        }
    });

    client.on('qr', async (qr) => {
        lastQr = await qrcode.toDataURL(qr);
        if (_io) _io.emit('qr', lastQr);
    });

    client.on('loading_screen', (percent, message) => {
        console.log(`[WhatsApp] Loading: ${percent}% - ${message}`);
        if (_io) _io.emit('loading', { percent, message });
    });

    client.on('ready', async () => {
        isReady = true;
        lastQr = null;
        console.log('✅ [WhatsApp] Pro Engine Ready');
        if (_io) _io.emit('ready');
        
        // NON-BLOCKING BACKGROUND SYNC: Emit ready first, then sync silently
        syncAllChats().then(async (chats) => {
            console.log(`🚀 [Sync] Metadata ready. Pre-fetching top chats...`);
            
            // PRO PARALLEL SYNC: Fetch top 10 chats in parallel batches
            const topChats = chats.slice(0, 10);
            const chunks = [];
            for (let i = 0; i < topChats.length; i += MAX_CONCURRENT_SYNC) {
                chunks.push(topChats.slice(i, i + MAX_CONCURRENT_SYNC));
            }

            for (const chunk of chunks) {
                await Promise.all(chunk.map(c => triggerOnDemandMessageSync(c.id, 50).catch(() => {})));
            }
            console.log('✅ [Sync] Initial High-Speed Batch Complete');
        }).catch(err => console.error('Initial sync error:', err));
    });

    client.on('message', async (msg) => {
        try {
            const start = Date.now();
            const chat = await msg.getChat();
            
            // SENIOR: High-speed async resolution of author/sender
            const formatted = await formatMessage(msg, chat);
            
            if (formatted) {
                // Bulk logic: Mirrored DB for accuracy + Instant UI update
                await Message.findOneAndUpdate({ id: formatted.id }, formatted, { upsert: true });
                
                const updatedChat = await Chat.findOneAndUpdate(
                    { id: chat.id._serialized },
                    { 
                        $set: { 
                            messageCount: await Message.countDocuments({ chatId: chat.id._serialized }), 
                            timestamp: new Date(), 
                            unreadCount: chat.unreadCount 
                        } 
                    },
                    { new: true, upsert: true }
                );

                if (_io) {
                    _io.emit('new-message', formatted);
                    _io.emit('chat-update', updatedChat);
                }
                console.log(`⏱️ [Real-time] Group Accuracy Refined: ${Date.now() - start}ms`);
            }
        } catch (e) { console.error('Real-time sync error:', e.message); }
    });

    client.on('authenticated', () => { lastQr = null; if (_io) _io.emit('authenticated'); });
    client.on('auth_failure', () => { if (_io) _io.emit('disconnected'); logoutAndReset(); });
    client.on('disconnected', () => logoutAndReset());

    client.initialize().catch(err => {
        console.error('Init Error:', err.message);
        setTimeout(() => initializeWhatsApp(_io), 10000);
    });
};

const syncAllChats = async () => {
    if (!isReady) return cachedChats;
    if (syncPromise) return syncPromise;

    syncPromise = (async () => {
        const start = Date.now();
        isSyncing = true;
        if (_io) _io.emit('syncing');

        try {
            const allChats = await client.getChats();
            
            const processedChats = await Promise.all(allChats.slice(0, 100).map(async (c, idx) => {
                let name = c.name;
                // SENIOR: Aggressively resolve names that the library labels as "Unknown"
                if (!name || name.toLowerCase().includes('unknown')) {
                    try {
                        const contact = await c.getContact();
                        name = contact.name || contact.pushname || contact.number || c.id.user.split('@')[0];
                    } catch (e) { 
                        name = c.id.user ? c.id.user.split('@')[0] : 'Private Session'; 
                    }
                }

                return {
                    id: c.id._serialized,
                    name: name,
                    isGroup: c.isGroup,
                    unreadCount: c.unreadCount || 0,
                    timestamp: c.timestamp ? new Date(c.timestamp * 1000) : new Date()
                };
            }));

            // Metadata Bulk Upsert
            const bulkOps = processedChats.map(c => ({
                updateOne: {
                    filter: { id: c.id },
                    update: { 
                        $set: { 
                            id: c.id,
                            name: c.name,
                            isGroup: c.isGroup,
                            unreadCount: c.unreadCount,
                            timestamp: c.timestamp,
                            lastSyncIST: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                        }
                    },
                    upsert: true
                }
            }));

            if (bulkOps.length > 0) {
                await Chat.bulkWrite(bulkOps, { ordered: false });
            }

            await updateAllMessageCounts();
            cachedChats = processedChats;

            console.log(`🚀 [Accurate Sync] Metadata Ready: ${Date.now() - start}ms`);
            if (_io) {
                _io.emit('sync-complete', { status: 'metadata-ready', count: cachedChats.length });
                _io.emit('deep-sync-complete');
            }
            return cachedChats;
        } catch (error) {
            console.error('[Sync] Error:', error.message);
            return cachedChats;
        } finally {
            isSyncing = false;
            syncPromise = null;
        }
    })();

    return syncPromise;
};

// Accurate background count recalculation
const updateAllMessageCounts = async () => {
    const chats = await Chat.find({}, 'id');
    for (const chat of chats) {
        const count = await Message.countDocuments({ chatId: chat.id });
        await Chat.updateOne({ id: chat.id }, { $set: { messageCount: count } });
    }
};

const resolveSenderName = async (msg, chat) => {
    if (msg.fromMe) return 'Me';
    
    // In groups, the actual sender is msg.author
    // In private chats, msg.author is undefined, but msg.from is the sender
    const senderId = msg.author || msg.from;
    
    try {
        // High-speed shortcut: check data-notifyName if available
        if (msg._data && msg._data.notifyName) return msg._data.notifyName;
        
        // Accurate resolution: get contact (cached by library internally)
        const contact = await client.getContactById(senderId);
        return contact.name || contact.pushname || senderId.split('@')[0];
    } catch (e) {
        return chat.name || senderId.split('@')[0] || 'Unknown';
    }
};

const formatMessage = async (msg, chat) => {
    try {
        const sender = await resolveSenderName(msg, chat);
        let msgDate = msg.timestamp ? new Date(msg.timestamp * 1000) : new Date();
        
        return {
            id: msg.id._serialized,
            chatId: chat.id._serialized,
            chatName: chat.name || chat.id.user,
            sender: sender,
            message: msg.body || '',
            timestamp: msgDate,
            timestampIST: msgDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            type: msg.type,
            hasMedia: msg.hasMedia
        };
    } catch (e) { return null; }
};

const triggerOnDemandMessageSync = async (chatId, limit = 50) => {
    if(!isReady || !client) return;
    const start = Date.now();
    try {
        const chat = await client.getChatById(chatId);
        const messages = await chat.fetchMessages({ limit });

        if (messages.length > 0) {
            // PRO PARALLEL RESOLUTION: Resolve sender names in parallel
            const formatted = (await Promise.all(messages.map(m => formatMessage(m, chat)))).filter(m => m !== null);
            
            const ops = formatted.map(m => ({
                updateOne: {
                    filter: { id: m.id },
                    update: { $set: m },
                    upsert: true
                }
            }));
            await Message.bulkWrite(ops, { ordered: false });
            
            const totalMsgs = await Message.countDocuments({ chatId });
            await Chat.findOneAndUpdate(
                { id: chatId }, 
                { $set: { lastSync: new Date(), messageCount: totalMsgs } }
            );
            console.log(`⏱️ [Sync] ${chatId} | Accuracy Verification: ${Date.now() - start}ms`);
        }
    } catch (e) { console.error(`[Sync] Fail:`, e.message); }
};

const logoutAndReset = async () => {
    isReady = false;
    if (client) {
        try { 
            await client.logout().catch(() => {}); 
            await client.destroy().catch(() => {}); 
        } catch (e) {}
        client = null;
    }
    // SENIOR PERFORMANCE: DO NOT delete database history on logout. 
    // Persist data for instant loading in next session.
    cachedChats = [];
    initializeWhatsApp(_io);
};

module.exports = { 
    initializeWhatsApp, 
    getClient: () => isReady ? client : null, 
    syncAllChats, 
    triggerOnDemandMessageSync,
    getCachedChats: () => cachedChats,
    getLastQr: () => lastQr,
    logoutAndReset,
    getStatus: () => ({ isReady, isSyncing })
};
