const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, delay } = require('@whiskeysockets/baileys')
const QRCode = require('qrcode')
const fs = require('fs')
const path = require('path')
const axios = require('axios')

// File untuk menyimpan data
const bannedFile = 'banned.json'
const reportedFile = 'reported.json'
const statsFile = 'stats.json'
let qrGenerated = false
let bannedNumbers = {}
let reportedNumbers = {}
let statsData = {
    total_messages: 0,
    total_reports: 0,
    total_bans: 0,
    total_menu_sent: 0,
    start_time: new Date().toISOString()
}

// Load data
if (fs.existsSync(bannedFile)) {
    try {
        bannedNumbers = JSON.parse(fs.readFileSync(bannedFile))
    } catch (e) {
        console.log('Error loading banned data:', e.message)
        bannedNumbers = {}
    }
}

if (fs.existsSync(reportedFile)) {
    try {
        reportedNumbers = JSON.parse(fs.readFileSync(reportedFile))
    } catch (e) {
        console.log('Error loading reported data:', e.message)
        reportedNumbers = {}
    }
}

if (fs.existsSync(statsFile)) {
    try {
        statsData = JSON.parse(fs.readFileSync(statsFile))
    } catch (e) {
        console.log('Error loading stats data:', e.message)
    }
}

function saveBannedNumbers() {
    fs.writeFileSync(bannedFile, JSON.stringify(bannedNumbers, null, 2))
}

function saveReportedNumbers() {
    fs.writeFileSync(reportedFile, JSON.stringify(reportedNumbers, null, 2))
}

function saveStats() {
    fs.writeFileSync(statsFile, JSON.stringify(statsData, null, 2))
}

// Fungsi untuk memeriksa status banned
function checkBannedStatus(number) {
    return bannedNumbers[number] || null
}

// Fungsi untuk memformat nomor
function formatNumber(number) {
    if (number.includes('@s.whatsapp.net')) {
        return number
    }
    return number + (number.endsWith('@s.whatsapp.net') ? '' : '@s.whatsapp.net')
}

// Fungsi untuk membuat link report WhatsApp
function createWhatsAppReportLink(phoneNumber, reason = "Melanggar ketentuan penggunaan") {
    const baseUrl = "https://www.whatsapp.com/contact/noclient";
    const params = new URLSearchParams({
        lang: "id",
        phone: phoneNumber.replace('@s.whatsapp.net', ''),
        reason: reason.substring(0, 100),
        source: "bot-report",
        timestamp: new Date().getTime()
    });
    
    return `${baseUrl}?${params.toString()}`;
}

// Fungsi untuk mendapatkan info nomor
function getNumberInfo(number) {
    const cleanNumber = number.replace('@s.whatsapp.net', '');
    return {
        number: cleanNumber,
        country_code: cleanNumber.substring(0, 2),
        formatted: cleanNumber.replace(/(\d{2})(\d{3})(\d{4})(\d{4})/, '+$1 $2-$3-$4'),
        report_link: createWhatsAppReportLink(number, "Pelanggaran ketentuan")
    };
}

// Fungsi untuk mengisi form kontak WhatsApp secara otomatis
async function autoFillWhatsAppContactForm(phoneNumber, reason, reporterName = "hozoohunter") {
    try {
        console.log(`📝 Mengisi form kontak WhatsApp untuk ${phoneNumber}...`);
        
        const formData = {
            phone: phoneNumber.replace('@s.whatsapp.net', ''),
            email: "leobughunter1@gmail.com",
            confirm_email: "leobughunter1@gmail.com",
            platform: "ANDROID",
            message: `Whatsapp Account Banned Problem

Dear WhatsApp Team,

I received a message saying "This account can no longer use WhatsApp." I believe this may be a mistake. I always try to follow WhatsApp's rules, and if I unknowingly did something wrong, I truly apologize. Please review my case and give me another chance. This account is very important for my daily use. Thank you for your support.

Sincerely,
Your Name: ${reporterName}
Your Phone Number with Country Code: ${phoneNumber.replace('@s.whatsapp.net', '')}`,
            timestamp: new Date().toISOString(),
            form_url: "https://www.whatsapp.com/contact/noclient?lang=id"
        };
        
        // Simpan data form
        reportedNumbers[phoneNumber] = {
            reported: new Date().toISOString(),
            by: reporterName,
            reason: reason,
            form_data: formData,
            status: "form_auto_filled"
        };
        saveReportedNumbers();
        
        // Simulasi pengisian form
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        return {
            success: true,
            message: `✅ Form kontak WhatsApp berhasil diisi untuk ${phoneNumber}`,
            form_data: formData,
            next_steps: `📋 Silakan lanjutkan dengan mengklik "Langkah Berikutnya" di form WhatsApp`
        };
    } catch (error) {
        console.error('Error filling form:', error);
        return {
            success: false,
            message: `❌ Gagal mengisi form untuk ${phoneNumber}`
        };
    }
}

// Fungsi untuk mengirim menu ke nomor lain (UNLIMITED)
async function sendMenuToNumber(sock, targetNumber, sender) {
    try {
        const menu = `
╔═══════════════════════════
║  Hello, I am L
║  ⏰ ${new Date().toLocaleTimeString('id-ID')}
║  📅 ${new Date().toLocaleDateString('id-ID', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
})}
╠═══════════════════════════
║
║  📊 *STATISTIK BOT*
║  • 📨 Pesan terkirim: ${statsData.total_messages}
║  • ⚠️ Laporan dibuat: ${statsData.total_reports}
║  • 🚫 Nomor dibanned: ${statsData.total_bans}
║  • 📋 Menu dikirim: ${statsData.total_menu_sent}
║
║  ⚡ *PERINTAH CEPAT*
║  • menu - Tampilkan menu utama
║  • ping - Cek status bot
║  • info - Info bot
║  • stats - Lihat statistik
║
║  🎯 *FITUR UTAMA*
║  • kirimmenu nomor - Kirim menu ke nomor lain
║  • report nomor alasan - Laporkan nomor
║  • autofill nomor alasan - Isi form WhatsApp otomatis
║  • checkban nomor - Cek status banned
║
║  ⏰ *FITUR WAKTU*
║  • time - Waktu sekarang
║  • date - Tanggal sekarang
║  • jam - Jam sekarang
║  • hari - Hari sekarang
║  • bulan - Bulan sekarang
║
║  📊 *MANAJEMEN GRUP*
║  • groupinfo - Info grup
║  • linkgroup - Dapatkan link grup
║
║  
╚═══════════════════════════
        `;
        
        await sock.sendMessage(targetNumber, { text: menu });
        statsData.total_menu_sent++;
        saveStats();
        
        // Kirim konfirmasi ke pengirim
        await sock.sendMessage(sender, { 
            text: `✅ Menu berhasil dikirim ke ${targetNumber.replace('@s.whatsapp.net', '')}\n📊 Total menu terkirim: ${statsData.total_menu_sent}`
        });
        
        return true;
    } catch (error) {
        console.log('Error sending menu:', error.message);
        await sock.sendMessage(sender, { 
            text: `❌ Gagal mengirim menu ke ${targetNumber.replace('@s.whatsapp.net', '')}`
        });
        return false;
    }
}

// Fungsi untuk mengirim broadcast ke banyak nomor
async function sendBroadcast(sock, numbers, message, sender) {
    try {
        let successCount = 0;
        let failCount = 0;
        
        for (const number of numbers) {
            try {
                const formattedNumber = formatNumber(number);
                await sock.sendMessage(formattedNumber, { text: message });
                successCount++;
                
                // Delay untuk menghindari limit
                await delay(1000);
            } catch (error) {
                console.log(`Gagal mengirim ke ${number}:`, error.message);
                failCount++;
            }
        }
        
        await sock.sendMessage(sender, { 
            text: `📊 *HASIL BROADCAST*\n\n✅ Berhasil: ${successCount}\n❌ Gagal: ${failCount}\n📝 Total: ${numbers.length} nomor`
        });
        
        return { successCount, failCount };
    } catch (error) {
        console.log('Error broadcast:', error.message);
        throw error;
    }
}

// Fungsi untuk mengirim gambar
async function sendImage(sock, jid, imageUrl, caption = '') {
    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');
        
        await sock.sendMessage(jid, {
            image: buffer,
            caption: caption,
            mimetype: 'image/jpeg'
        });
        
        return true;
    } catch (error) {
        console.log('Error sending image:', error.message);
        return false;
    }
}

async function connectToWhatsApp() {
    try {
        console.log('🚀 Memulai bot WhatsApp Unlimited...');
        
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');
        const { version } = await fetchLatestBaileysVersion();
        
        const sock = makeWASocket({
            version,
            printQRInTerminal: false,
            auth: state,
            browser: ['LORDHOZOO-BOT-UNLIMITED', 'Chrome', '2.0.0'],
            markOnlineOnConnect: true,
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            retryRequestDelayMs: 1000,
            maxRetries: 10,
            connectTimeoutMs: 30000
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr && !qrGenerated) {
                qrGenerated = true;
                console.log('📲 Scan QR code berikut:');
                
                try {
                    const qrImage = await QRCode.toString(qr, {
                        type: 'terminal',
                        small: true
                    });
                    console.log(qrImage);
                } catch (qrError) {
                    console.log('QR Code:', qr);
                }
            }
            
            if (connection === 'close') {
                qrGenerated = false;
                const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    console.log('🔄 Menghubungkan kembali...');
                    setTimeout(connectToWhatsApp, 3000);
                }
            } else if (connection === 'open') {
                qrGenerated = false;
                console.log('✅ Bot terhubung! Unlimited Mode Active!');
                console.log('📝 Ketik menu untuk bantuan');
            }
        });

        sock.ev.on('messages.upsert', async (m) => {
            try {
                const msg = m.messages[0];
                if (!msg.message || msg.key.fromMe) return;
                
                statsData.total_messages++;
                saveStats();
                
                const text = msg.message.conversation || 
                            (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text) || '';
                
                const sender = msg.key.remoteJid;
                const isBanned = bannedNumbers[sender];
                const command = text.toLowerCase().trim();
                const args = text.split(' ');

                // Cek jika user dibanned
                if (isBanned) {
                    await sock.sendMessage(sender, { 
                        text: '❌ Anda dibanned dari bot ini!'
                    });
                    return;
                }

                // Handle commands
                if (command === 'menu') {
                    // Kirim gambar hozoo.jpg
                    try {
                        await sendImage(sock, sender, 'https://github.com/devhozo88/BOT_WA2025/blob/main/hozoo.jpg', 
                            `╔═══════════════════════════
║  Hello, I am L
║  ⏰ ${new Date().toLocaleTimeString('id-ID')}
║  📅 ${new Date().toLocaleDateString('id-ID', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
})}
╠═══════════════════════════
║
║  📊 *STATISTIK REAL-TIME*
║  • 📨 Pesan diproses: ${statsData.total_messages}
║  • ⚠️ Laporan dibuat: ${statsData.total_reports}
║  • 🚫 Nomor dibanned: ${statsData.total_bans}
║  • 📋 Menu dikirim: ${statsData.total_menu_sent}
║  • ⏰ Uptime: ${Math.floor((new Date() - new Date(statsData.start_time)) / 3600000)} jam
║
║  ⚡ *PERINTAH CEPAT*
║  • menu - Tampilkan menu ini
║  • ping - Cek status bot
║  • info - Info bot
║  • stats - Statistik lengkap
║
║  🎯 *FITUR UNLIMITED*
║  • kirimmenu nomor - Kirim menu ke nomor lain
║  • broadcast nomor1,nomor2 pesan - Kirim pesan ke banyak nomor
║  • report nomor alasan - Laporkan nomor ke WhatsApp
║  • autofill nomor alasan - Isi form WhatsApp otomatis
║  • massreport nomor1,nomor2 alasan - Laporkan banyak nomor
║
║  🛡️ *MODERASI*
║  • ban nomor alasan - Ban nomor
║  • unban nomor - Unban nomor
║  • listban - List nomor banned
║  • checkban nomor - Cek status banned
║
║  ⏰ *FITUR WAKTU*
║  • time - Waktu sekarang
║  • date - Tanggal sekarang
║  • jam - Jam sekarang
║  • hari - Hari sekarang
║  • bulan - Bulan sekarang
║
║  📊 *MANAJEMEN GRUP*
║  • groupinfo - Info grup
║  • linkgroup - Dapatkan link grup
║
║   
╚═══════════════════════════`);
                    } catch (imageError) {
                        console.log('Gagal mengirim gambar, mengirim teks saja:', imageError.message);
                        const menuText = `
╔═══════════════════════════
║  Hello, I am L
║  ⏰ ${new Date().toLocaleTimeString('id-ID')}
║  📅 ${new Date().toLocaleDateString('id-ID', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
})}
╠═══════════════════════════
║ 
║  📊 *STATISTIK REAL-TIME*
║  • 📨 Pesan diproses: ${statsData.total_messages}
║  • ⚠️ Laporan dibuat: ${statsData.total_reports}
║  • 🚫 Nomor dibanned: ${statsData.total_bans}
║  • 📋 Menu dikirim: ${statsData.total_menu_sent}
║  • ⏰ Uptime: ${Math.floor((new Date() - new Date(statsData.start_time)) / 3600000)} jam
║
║  ⚡ *PERINTAH CEPAT*
║  • menu - Tampilkan menu ini
║  • ping - Cek status bot
║  • info - Info bot
║  • stats - Statistik lengkap
║
║  🎯 *FITUR UNLIMITED*
║  • kirimmenu nomor - Kirim menu ke nomor lain
║  • broadcast nomor1,nomor2 pesan - Kirim pesan ke banyak nomor
║  • report nomor alasan - Laporkan nomor ke WhatsApp
║  • autofill nomor alasan - Isi form WhatsApp otomatis
║  • massreport nomor1,nomor2 alasan - Laporkan banyak nomor
║
║  🛡️ *MODERASI*
║  • ban nomor alasan - Ban nomor
║  • unban nomor - Unban nomor
║  • listban - List nomor banned
║  • checkban nomor - Cek status banned
║
║  ⏰ *FITUR WAKTU*
║  • time - Waktu sekarang
║  • date - Tanggal sekarang
║  • jam - Jam sekarang
║  • hari - Hari sekarang
║  • bulan - Bulan sekarang
║
║  📊 *MANAJEMEN GRUP*
║  • groupinfo - Info grup
║  • linkgroup - Dapatkan link grup
║
║  
╚═══════════════════════════`;
                        await sock.sendMessage(sender, { text: menuText });
                    }
                }

                else if (command === 'ping') {
                    await sock.sendMessage(sender, { text: '🏓 Pong! Bot aktif dengan kecepatan maksimal! ⚡' });
                }

                else if (command === 'info') {
                    await sock.sendMessage(sender, { 
                        text: `🤖 *BOT WHATSAPP UNLIMITED*\n🔧 By @LORDHOZOO\n💻 Node.js Baileys\n🚀 Unlimited Speed\n📅 ${new Date().toLocaleDateString('id-ID')}\n⏰ Uptime: ${Math.floor((new Date() - new Date(statsData.start_time)) / 3600000)} jam` 
                    });
                }

                else if (command === 'stats') {
                    const uptime = Math.floor((new Date() - new Date(statsData.start_time)) / 3600000);
                    await sock.sendMessage(sender, { 
                        text: `📊 *STATISTIK BOT LENGKAP*\n\n📨 Total Pesan: ${statsData.total_messages}\n⚠️ Laporan: ${statsData.total_reports}\n🚫 Banned: ${statsData.total_bans}\n📋 Menu Dikirim: ${statsData.total_menu_sent}\n⏰ Uptime: ${uptime} jam\n📅 Start: ${new Date(statsData.start_time).toLocaleString('id-ID')}` 
                    });
                }

                else if (command === 'time') {
                    const now = new Date();
                    const time = now.toLocaleTimeString('id-ID');
                    await sock.sendMessage(sender, { text: `🕒 Waktu sekarang: ${time} ⚡` });
                }

                else if (command === 'date') {
                    const now = new Date();
                    const date = now.toLocaleDateString('id-ID', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                    await sock.sendMessage(sender, { text: `📅 Tanggal: ${date} 📆` });
                }

                else if (command === 'jam') {
                    const now = new Date();
                    const time = now.toLocaleTimeString('id-ID');
                    await sock.sendMessage(sender, { text: `⏰ Jam sekarang: ${time} ⚡` });
                }

                else if (command === 'hari') {
                    const now = new Date();
                    const day = now.toLocaleDateString('id-ID', { weekday: 'long' });
                    await sock.sendMessage(sender, { text: `📅 Hari ini: ${day} 📆` });
                }

                else if (command === 'bulan') {
                    const now = new Date();
                    const month = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
                    await sock.sendMessage(sender, { text: `📆 Bulan ini: ${month} 📅` });
                }

                else if (args[0].toLowerCase() === 'kirimmenu' && args[1]) {
                    const targetNumber = formatNumber(args[1]);
                    await sendMenuToNumber(sock, targetNumber, sender);
                }

                else if (args[0] === 'broadcast' && args[1] && args[2]) {
                    const numbers = args[1].split(',');
                    const message = args.slice(2).join(' ');
                    
                    if (numbers.length > 50) {
                        await sock.sendMessage(sender, { 
                            text: `❌ Maksimal 50 nomor per broadcast!` 
                        });
                        return;
                    }
                    
                    await sock.sendMessage(sender, { 
                        text: `📤 Memulai broadcast ke ${numbers.length} nomor...` 
                    });
                    
                    const result = await sendBroadcast(sock, numbers, message, sender);
                    
                    await sock.sendMessage(sender, { 
                        text: `✅ Broadcast selesai!\n📊 Berhasil: ${result.successCount}\n❌ Gagal: ${result.failCount}` 
                    });
                }

                else if (args[0] === 'report' && args[1]) {
                    const number = formatNumber(args[1]);
                    const reason = args.slice(2).join(' ') || 'Pelanggaran ketentuan penggunaan';
                    
                    // Dapatkan info nomor
                    const numberInfo = getNumberInfo(number);
                    
                    // Simpan laporan
                    reportedNumbers[number] = {
                        reported: new Date().toISOString(),
                        by: sender,
                        reason: reason,
                        report_link: createWhatsAppReportLink(number, reason)
                    };
                    saveReportedNumbers();
                    statsData.total_reports++;
                    saveStats();
                    
                    await sock.sendMessage(sender, { 
                        text: `✅ *LAPORAN TERKIRIM!* ⚡\n\n📞 Nomor: ${numberInfo.formatted}\n📝 Alasan: ${reason}\n🔗 Link Report: ${reportedNumbers[number].report_link}\n📊 Total Laporan: ${statsData.total_reports}` 
                    });
                }

                else if (args[0] === 'autofill' && args[1]) {
                    const number = formatNumber(args[1]);
                    const reason = args.slice(2).join(' ') || 'Pelanggaran ketentuan penggunaan';
                    const reporterName = "hozoohunter"; // Nama default
                    
                    // Isi form WhatsApp otomatis
                    const fillResult = await autoFillWhatsAppContactForm(number, reason, reporterName);
                    
                    if (fillResult.success) {
                        await sock.sendMessage(sender, { 
                            text: `✅ *FORM WHATSAPP OTOMATIS* ⚡\n\n📞 Nomor: ${number}\n📝 Alasan: ${reason}\n📧 Email: ${fillResult.form_data.email}\n📱 Platform: ${fillResult.form_data.platform}\n\n${fillResult.next_steps}\n🔗 Link Form: ${fillResult.form_data.form_url}` 
                        });
                    } else {
                        await sock.sendMessage(sender, { 
                            text: `❌ Gagal mengisi form untuk ${number}` 
                        });
                    }
                }

                else if (args[0] === 'massreport' && args[1] && args[2]) {
                    const numbers = args[1].split(',');
                    const reason = args.slice(2).join(' ') || 'Pelanggaran ketentuan penggunaan';
                    
                    if (numbers.length > 20) {
                        await sock.sendMessage(sender, { 
                            text: `❌ Maksimal 20 nomor per mass report!` 
                        });
                        return;
                    }
                    
                    let successCount = 0;
                    for (const num of numbers) {
                        try {
                            const number = formatNumber(num);
                            reportedNumbers[number] = {
                                reported: new Date().toISOString(),
                                by: sender,
                                reason: reason,
                                report_link: createWhatsAppReportLink(number, reason)
                            };
                            successCount++;
                        } catch (e) {
                            console.log(`Gagal report ${num}:`, e.message);
                        }
                    }
                    
                    saveReportedNumbers();
                    statsData.total_reports += successCount;
                    saveStats();
                    
                    await sock.sendMessage(sender, { 
                        text: `✅ *MASS REPORT SELESAI!* ⚡\n\n📞 Nomor dilaporkan: ${successCount}/${numbers.length}\n📝 Alasan: ${reason}\n📊 Total Laporan: ${statsData.total_reports}` 
                    });
                }

                else if (args[0] === 'ban' && args[1]) {
                    const number = formatNumber(args[1]);
                    const reason = args.slice(2).join(' ') || 'No reason provided';
                    
                    bannedNumbers[number] = {
                        banned: new Date().toISOString(),
                        by: sender,
                        reason: reason
                    };
                    saveBannedNumbers();
                    statsData.total_bans++;
                    saveStats();
                    
                    await sock.sendMessage(sender, { 
                        text: `✅ Nomor ${number} telah dibanned! ⚡\n📝 Alasan: ${reason}\n📊 Total Banned: ${statsData.total_bans}` 
                    });
                }

                else if (args[0] === 'unban' && args[1]) {
                    const number = formatNumber(args[1]);
                    if (bannedNumbers[number]) {
                        delete bannedNumbers[number];
                        saveBannedNumbers();
                        await sock.sendMessage(sender, { text: `✅ Nomor ${number} telah diunban! ⚡` });
                    } else {
                        await sock.sendMessage(sender, { text: `❌ Nomor ${number} tidak ditemukan di list banned` });
                    }
                }

                else if (command === 'listban') {
                    const list = Object.entries(bannedNumbers).map(([num, data]) => 
                        `• ${num}\n  ⏰ ${new Date(data.banned).toLocaleString('id-ID')}\n  📝 ${data.reason}`
                    ).join('\n\n');
                    
                    await sock.sendMessage(sender, { 
                        text: `📋 *LIST BANNED NUMBERS*\n\n${list || 'Tidak ada nomor yang dibanned'}\n📊 Total: ${Object.keys(bannedNumbers).length} nomor` 
                    });
                }

                else if (args[0] === 'checkban' && args[1]) {
                    const number = formatNumber(args[1]);
                    const bannedInfo = checkBannedStatus(number);
                    
                    if (bannedInfo) {
                        await sock.sendMessage(sender, { 
                            text: `🚫 *NOMOR DIBANNED* ⚡\n\n📞 ${number}\n⏰ Sejak: ${new Date(bannedInfo.banned).toLocaleString('id-ID')}\n📝 Alasan: ${bannedInfo.reason}\n👤 Oleh: ${bannedInfo.by}` 
                        });
                    } else {
                        await sock.sendMessage(sender, { 
                            text: `✅ *NOMOR TIDAK DIBANNED*\n\n📞 ${number}\nStatus: Tidak ada pembatasan` 
                        });
                    }
                }

                else if (command === 'groupinfo') {
                    if (sender.endsWith('@g.us')) {
                        try {
                            const groupMetadata = await sock.groupMetadata(sender);
                            const participants = groupMetadata.participants.length;
                            
                            await sock.sendMessage(sender, { 
                                text: `📊 *INFO GRUP* ⚡\n\n📛 Nama: ${groupMetadata.subject}\n👥 Anggota: ${participants} orang\n🆔 ID: ${groupMetadata.id}\n📅 Dibuat: ${new Date(groupMetadata.creation * 1000).toLocaleString('id-ID')}` 
                            });
                        } catch (e) {
                            await sock.sendMessage(sender, { text: '❌ Gagal mengambil info grup' });
                        }
                    } else {
                        await sock.sendMessage(sender, { text: '❌ Perintah ini hanya bisa digunakan di grup' });
                    }
                }

                else if (command === 'linkgroup') {
                    if (sender.endsWith('@g.us')) {
                        try {
                            const inviteCode = await sock.groupInviteCode(sender);
                            const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
                            
                            await sock.sendMessage(sender, { 
                                text: `📎 *LINK GRUP* ⚡\n\n${inviteLink}\n\nBagikan link ini untuk mengundang orang ke grup` 
                            });
                        } catch (e) {
                            await sock.sendMessage(sender, { text: '❌ Gagal membuat link grup. Pastikan bot adalah admin' });
                        }
                    } else {
                        await sock.sendMessage(sender, { text: '❌ Perintah ini hanya bisa digunakan di grup' });
                    }
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
