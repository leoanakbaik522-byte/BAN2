const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');

// Variabel untuk mencegah generate QR berulang
let qrGenerated = false;

async function connectToWhatsApp() {
    try {
        console.log('🚀 Memulai bot WhatsApp...');
        
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');
        
        const sock = makeWASocket({
            printQRInTerminal: false, // Nonaktifkan QR terminal bawaan
            auth: state,
            browser: ['Termux-Bot', 'Chrome', '1.0.0']
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr && !qrGenerated) {
                qrGenerated = true;
                console.log('📲 Scan QR code berikut dengan WhatsApp Anda:');
                
                try {
                    // Generate QR code ke terminal
                    const qrImage = await QRCode.toString(qr, {
                        type: 'terminal',
                        small: true,
                        margin: 1
                    });
                    console.log(qrImage);
                    console.log('📲 Scan QR code di atas atau gunakan link berikut:');
                    console.log('🔗 https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(qr));
                } catch (qrError) {
                    console.log('❌ Error generating QR code:', qrError.message);
                    console.log('📲 Scan QR code manual dari teks berikut:');
                    console.log('QR Code:', qr);
                }
            }
            
            if (connection === 'close') {
                qrGenerated = false; // Reset untuk QR baru
                const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('❌ Koneksi terputus:', lastDisconnect.error?.message || 'Unknown error');
                
                if (shouldReconnect) {
                    console.log('🔄 Mencoba menghubungkan kembali dalam 3 detik...');
                    setTimeout(connectToWhatsApp, 3000);
                }
            } else if (connection === 'open') {
                qrGenerated = false;
                console.log('✅ Bot berhasil terhubung!');
                console.log('📝 Ketik !menu di chat bot untuk melihat perintah');
            }
        });

        sock.ev.on('messages.upsert', async (m) => {
            try {
                const msg = m.messages[0];
                if (!msg.message || msg.key.fromMe) return;
                
                const text = msg.message.conversation || 
                            (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text) || 
                            '';
                
                const sender = msg.key.remoteJid;
                const command = text.toLowerCase().trim();
                
                // Menu command
                if (command === '!menu') {
                    const menu = `
🤖 *BOT WHATSAPP MENU* 🤖

📝 *Perintah Umum:*
!menu - Menampilkan menu ini
!ping - Mengecek status bot
!owner - Info pemilik bot
!info - Info bot

🔧 *Bot ini berjalan di Termux*
                    `;
                    await sock.sendMessage(sender, { text: menu });
                }
                // Ping command
                else if (command === '!ping') {
                    await sock.sendMessage(sender, { text: '🏓 Pong! Bot aktif!' });
                }
                // Info command
                else if (command === '!info') {
                    await sock.sendMessage(sender, { text: '🤖 Bot WhatsApp Termux\n🔧 Dibuat dengan Node.js\n📱 Berjalan di Termux' });
                }
                // Owner command
                else if (command === '!owner') {
                    await sock.sendMessage(sender, { text: '👑 Owner: Termux User\n📞 Hubungi: example@email.com' });
                }
                // Unknown command
                else if (text.startsWith('!')) {
                    await sock.sendMessage(sender, { text: '❌ Perintah tidak dikenali. Ketik !menu untuk bantuan' });
                }
            } catch (error) {
                console.log('Error processing message:', error.message);
            }
        });

        sock.ev.on('creds.update', saveCreds);
        
    } catch (error) {
        console.error('Error:', error.message);
        setTimeout(connectToWhatsApp, 5000);
    }
}

// Handle errors
process.on('uncaughtException', (error) => {
    console.log('Exception:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.log('Rejection:', reason.message);
});

// Start bot
connectToWhatsApp();
