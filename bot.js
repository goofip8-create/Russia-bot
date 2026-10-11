/**
 * bot.js — Russia Hak Bot
 * Copyright (c) 2024 Dr/Russia
 * Licensed under the MIT License.
 *
 * ملاحظة: لا يوجد أي رقم هاتف في الكود.
 * يتم تخزين الرقم كـ SHA256 hash فقط.
 */

'use strict';

// ==================== الاستيرادات ====================
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const pino = require('pino');
const crypto = require('crypto');
const NodeCache = require('node-cache');
const axios = require('axios');
const { Boom } = require('@hapi/boom');

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidDecode,
    makeCacheableSignalKeyStore,
    Browsers,
    getContentType,
    proto,
    downloadContentFromMessage
} = require('@whiskeysockets/baileys');

// ==================== الإعدادات ====================
const CONFIG = {
    botName: 'بوت Dr/Russia',
    author: 'Dr/Russia',
    packname: 'Dr/Russia',
    channelLink: 'https://whatsapp.com/channel/0029Vb9FHDD47XeK0xLvSM0c',
    usePairingCode: true,
    MAX_RECONNECT_ATTEMPTS: 15,
    BASE_RECONNECT_DELAY: 5000,
    MAX_PAIRING_RETRIES: 10
};

const DESIGNER = {
    name: 'Dr/Russia',
    nameEn: 'Dr Russia',
    channel: 'https://whatsapp.com/channel/0029Vb9FHDD47XeK0xLvSM0c'
};

// ==================== المجلدات ====================
const SESSION_DIR = path.join(__dirname, 'session');
const TEMP_DIR = path.join(__dirname, 'temp');
const DATA_DIR = path.join(__dirname, 'data');

[TEMP_DIR, DATA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

process.env.TMPDIR = TEMP_DIR;
process.env.TEMP = TEMP_DIR;
process.env.TMP = TEMP_DIR;

// ══════════════════════════════════════════════════════════════
// ═══════════════ البحث عن الفيديو ═══════════════
// ══════════════════════════════════════════════════════════════

function findVideoPath() {
    const candidates = [
        path.join(__dirname, 'video.mp4'),
        path.join(__dirname, 'VID_٢٠٢٦٠٤١٢_١٤٣١٠٢.mp4'),
        path.join(__dirname, 'boot.mp4'),
        path.join(__dirname, 'intro.mp4'),
        path.join(__dirname, 'rus.mp4')
    ];

    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }

    try {
        const files = fs.readdirSync(__dirname);
        for (const f of files) {
            if (f.toLowerCase().endsWith('.mp4')) return path.join(__dirname, f);
        }
    } catch {}

    return null;
}

// ==================== أدوات مساعدة ====================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function readJson(file, fallback = {}) {
    try {
        if (!fs.existsSync(file)) return fallback;
        return JSON.parse(fs.readFileSync(file, 'utf-8')) || fallback;
    } catch {
        return fallback;
    }
}

function writeJson(file, data) {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
}

function hashNumber(num) {
    return crypto.createHash('sha256').update(String(num).replace(/\D/g, '')).digest('hex');
}

// ==================== إعدادات الرسائل ====================
const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        externalAdReply: {
            title: 'قناة Dr/Russia',
            body: 'اضغط للمتابعة',
            mediaType: 1,
            sourceUrl: CONFIG.channelLink
        }
    }
};

// ==================== إدارة الملفات ====================
const FILES = {
    mode: path.join(DATA_DIR, '.sys_mode.dat'),
    owners: path.join(DATA_DIR, '.sys_cache.dat'),
    banned: path.join(DATA_DIR, '.sys_bin.dat'),
    welcome: path.join(DATA_DIR, '.sys_wel.dat'),
    sudo: path.join(DATA_DIR, '.sys_acc.dat'),
    autotyping: path.join(DATA_DIR, '.sys_type.dat'),
    autoread: path.join(DATA_DIR, '.sys_read.dat'),
    warnings: path.join(DATA_DIR, '.sys_warn.dat'),
    muted: path.join(DATA_DIR, '.sys_mute.dat')
};

if (!fs.existsSync(FILES.mode)) writeJson(FILES.mode, { isPublic: true });
if (!fs.existsSync(FILES.owners)) writeJson(FILES.owners, []);
if (!fs.existsSync(FILES.banned)) writeJson(FILES.banned, []);
if (!fs.existsSync(FILES.welcome)) writeJson(FILES.welcome, { groups: {} });
if (!fs.existsSync(FILES.sudo)) writeJson(FILES.sudo, []);
if (!fs.existsSync(FILES.autotyping)) writeJson(FILES.autotyping, { enabled: false });
if (!fs.existsSync(FILES.autoread)) writeJson(FILES.autoread, { enabled: false });
if (!fs.existsSync(FILES.warnings)) writeJson(FILES.warnings, {});
if (!fs.existsSync(FILES.muted)) writeJson(FILES.muted, {});

// ══════════════════════════════════════════════════════════════
// ═══════════ دالة إرسال الفيديو فوق الأوامر ═══════════
// ══════════════════════════════════════════════════════════════

async function sendMenuWithVideo(sock, chatId, message) {
    const videoPath = findVideoPath();

    // 1) رسالة بداية
    await sock.sendMessage(chatId, {
        text: '💀 *جاري التحقق من الأمان...*\n\n⚠️ الرجاء الانتظار...'
    }, { quoted: message });

    await sleep(1200);

    // 2) التحذيرات المرعبة
    const warnings = [
        '⚠️ *دخلت منطقة محظورة* — Authorized Users Only',
        '⚠️ *كل حركاتك مراقبة ومسجلة الآن*',
        '⚠️ *أي محاولة اختراق = حظر دائم فوري*',
        '⚠️ *لا تحاول العبث مع Dr/Russia*',
        '⚠️ *النظام محمي بكلمة سر عسكرية*',
        '⚠️ *IP الخاص بك تم تسجيله*',
        '☠️ *جاري تفعيل نظام الحماية...*'
    ];

    for (const w of warnings) {
        await sock.sendMessage(chatId, { text: w });
        await sleep(900);
    }

    // 3) العد التنازلي
    for (let i = 3; i >= 1; i--) {
        await sock.sendMessage(chatId, {
            text: `╔═══════════════════════╗\n` +
                  `║      *${i}*              ║\n` +
                  `╚═══════════════════════╝`
        });
        await sleep(900);
    }

    // 4) GO
    await sock.sendMessage(chatId, {
        text: `┏━━━━━━━━━━━━━━━━━━━━━┓\n` +
              `┃   ▶▶▶  *G O*  ◀◀◀     ┃\n` +
              `┗━━━━━━━━━━━━━━━━━━━━━┛`
    });
    await sleep(700);

    // 5) الفيديو
    if (videoPath && fs.existsSync(videoPath)) {
        try {
            console.log(chalk.cyan(`🎬 إرسال الفيديو: ${path.basename(videoPath)}`));
            const videoBuffer = fs.readFileSync(videoPath);

            await sock.sendMessage(chatId, {
                video: videoBuffer,
                caption: '⚡ *Dr/Russia SYSTEM* ⚡\n\n💀 *مرحبًا بك في النظام*\n\n📢 قناة: ' + CONFIG.channelLink,
                mimetype: 'video/mp4'
            }, { quoted: message });

            console.log(chalk.green('✅ تم إرسال الفيديو'));
        } catch (err) {
            console.log(chalk.yellow(`⚠️ فشل إرسال الفيديو: ${err.message}`));
        }
    }

    await sleep(1500);

    // 6) القائمة النهائية
    const menu = `╔══════════════════════════════════╗
║  💀 *بوت Dr/Russia* 🇮🇱        ║
║  🎭 *SYSTEM HACKED* ☠️          ║
╚══════════════════════════════════╝

🌹 أهلاً صديقي

📢 *قناتنا:* ${CONFIG.channelLink}

┌─────────────────────────────┐
│  🎯 *الأوامر المتاحة*      │
└─────────────────────────────┘

┣━ 👤 *ru [رقم]*
┃    → جلب بروفايل حقيقي
┃    → مثال: ru 01069679310
┃
┣━ 📸 *ru2* (رد على ميديا)
┃    → سحب View Once
┃    → صورة/فيديو/صوت
┃
┣━ 👑 *الإدارة*
┃    → رفع @شخص — ترقية
┃    → تنزيل @شخص — تخفيض
┃    → طرد @شخص — طرد
┃    → منشن — نداء الجميع
┃
┣━ ⚠️ *التحذيرات*
┃    → تحذير @شخص — 3=طرد
┃    → تحذيرات — عرض
┃    → كتم @شخص — منع الكتابة
┃    → فك_كتم @شخص — إلغاء
┃
┗━ 📋 *اوامر* / *menu*
     → عرض القائمة

┌─────────────────────────────┐
│  ⚡ *الميزات التلقائية*    │
└─────────────────────────────┘

┣━ 🗑️ *Anti-Link*
┃    → حذف الروابط تلقائيًا
┃    → 3 تحذيرات = طرد
┃
┣━ 🤬 *Anti-Badword*
┃    → حذف الشتائم تلقائيًا
┃    → 3 تحذيرات = طرد
┃
┗━ 🔇 *Anti-Spam*
     → كتم تلقائي للمخالفين

╔══════════════════════════════════╗
║  ☠️ *بوت Dr/Russia* 🇮🇱        ║
║  💀 *DESIGNED BY Dr/Russia*    ║
╚══════════════════════════════════╝

📢 *انضم للقناة:* 
${CONFIG.channelLink}

⚠️ *تحذير:* لا تعبث مع Dr/Russia
🔐 *جميع الأرقام محمية ومشفرة*`;

    await sock.sendMessage(chatId, { text: menu }, { quoted: message });
}

// ══════════════════════════════════════════════════════════════
// ═══════════════════ شاشة البداية ═══════════════════
// ══════════════════════════════════════════════════════════════

async function showBootScreen() {
    console.clear();

    console.log('');
    console.log(chalk.red.bold('████████████████████████████████████████████████████████'));
    console.log(chalk.red.bold('█') + chalk.bgRed.white.bold('     ☠️   W A R N I N G   —   خـــطـــر   ☠️          ') + chalk.red.bold('█'));
    console.log(chalk.red.bold('████████████████████████████████████████████████████████'));
    console.log('');

    await sleep(400);

    const warnings = [
        chalk.red('     ⚠️  دخلت منطقة محظورة — Authorized Users Only'),
        chalk.red('     ⚠️  كل حركاتك مراقبة ومسجلة الآن'),
        chalk.red('     ⚠️  أي محاولة اختراق = حظر دائم فوري'),
        chalk.red('     ⚠️  لا تحاول العبث مع Dr/Russia'),
        chalk.red('     ⚠️  النظام محمي بكلمة سر عسكرية'),
        chalk.red('     ⚠️  IP الخاص بك تم تسجيله'),
        chalk.red('     ☠️  جاري تفعيل نظام الحماية...')
    ];

    for (const w of warnings) {
        console.log(w);
        await sleep(280);
    }

    await sleep(400);

    console.log('');
    console.log(chalk.bgRed.white.bold('       ☠️  التحقق الأمني — SECURITY CHECK  ☠️              '));
    console.log('');

    await sleep(400);

    for (let i = 3; i >= 1; i--) {
        console.log(chalk.red.bold('     ╔══════════════════════════════════════╗'));
        console.log(chalk.red.bold('     ║') + chalk.bgRed.white.bold(`                 ${i}                        `) + chalk.red.bold('║'));
        console.log(chalk.red.bold('     ╚══════════════════════════════════════╝'));
        await sleep(800);
    }

    console.log(chalk.bgGreen.black.bold('           ▶▶▶  G O   —   انطلق  ◀◀◀                       '));
    console.log('');
    await sleep(600);

    const videoPath = findVideoPath();
    if (videoPath) {
        console.log(chalk.green(`     🎬 الفيديو جاهز: ${path.basename(videoPath)}`));
    } else {
        console.log(chalk.yellow('     ⚠️  لم يتم العثور على فيديو'));
        console.log(chalk.gray('     💡 ضع الملف في: ' + __dirname));
    }
    console.log('');
    await sleep(1000);

    console.clear();

    for (let i = 0; i < 4; i++) {
        const rand = Array.from({length: 65}, () =>
            Math.random() > 0.5 ? '1' : '0'
        ).join('');
        console.log(chalk.green.dim('  ' + rand));
        await sleep(70);
    }
    console.log('');

    console.log(chalk.green('╔═══════════════════════════════════════════════════════════╗'));
    console.log(chalk.green('║') + chalk.bgGreen.black.bold('          ☠️  D R / R U S S I A   S Y S T E M  ☠️           ') + chalk.green('║'));
    console.log(chalk.green('╚═══════════════════════════════════════════════════════════╝'));
    console.log('');
    console.log(chalk.cyan('  ┌──────────────────────────────────────────────────────┐'));
    console.log(chalk.cyan('  │') + chalk.white.bold('  👤  المطور     : ') + chalk.yellow.bold('Dr/Russia') + chalk.cyan('             │'));
    console.log(chalk.cyan('  │') + chalk.white.bold('  📢  القناة     : ') + chalk.yellow.bold('Dr/Russia Channel') + chalk.cyan('      │'));
    console.log(chalk.cyan('  │') + chalk.white.bold('  💼  الوظيفة    : ') + chalk.yellow.bold('هكر ومرزية') + chalk.cyan('        │'));
    console.log(chalk.cyan('  └──────────────────────────────────────────────────────┘'));
    console.log('');
    console.log(chalk.green.bold('              ⚡ النظام يعمل بكامل طاقته ⚡'));
    console.log('');
    console.log(chalk.cyan('  📢 انضم للقناة:'));
    console.log(chalk.yellow('  ' + CONFIG.channelLink));
    console.log('');
}

// ==================== قراءة الإدخال ====================
function readLine(prompt) {
    return new Promise((resolve) => {
        process.stdout.write(prompt);
        let input = '';
        let resolved = false;

        const onData = (chunk) => {
            if (resolved) return;
            const str = chunk.toString();
            input += str;
            if (str.includes('\n') || str.includes('\r')) {
                resolved = true;
                process.stdin.removeListener('data', onData);
                process.stdin.pause();
                process.stdout.write('\n');
                resolve(input.trim());
            }
        };

        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', onData);

        setTimeout(() => {
            if (resolved) return;
            resolved = true;
            process.stdin.removeListener('data', onData);
            process.stdin.pause();
            console.log('');
            resolve(input.trim());
        }, 60000);
    });
}

async function askPhoneNumber() {
    const argNumber = process.argv[2];
    if (argNumber && /^\d{10,15}$/.test(argNumber)) {
        console.log(chalk.cyan(`\n📱 تم قراءة الرقم من سطر الأوامر (محمي - لن يظهر)`));
        return argNumber;
    }
    console.log(chalk.cyan('\n📞 يرجى إدخال الرقم الذي سيربط البوت.\n'));
    const answer = await readLine(chalk.greenBright('📱 أدخل رقم واتساب (بدون + أو مسافات): '));
    return answer.replace(/\D/g, '');
}

// ==================== دوال الصلاحيات ====================
function cleanNumber(jid) {
    return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

function isOwner(jid, sock) {
    const num = cleanNumber(jid);
    const hash = hashNumber(num);
    const owners = readJson(FILES.owners, []);
    if (owners.includes(hash)) return true;

    if (sock?.user?.id) {
        const botNum = cleanNumber(sock.user.id);
        const botHash = hashNumber(botNum);
        if (owners.includes(botHash)) return true;
    }
    return false;
}

function isSudo(jid) {
    const num = cleanNumber(jid);
    const hash = hashNumber(num);
    const sudo = readJson(FILES.sudo, []);
    return sudo.includes(hash);
}

function isOwnerOrSudo(jid, sock) {
    return isOwner(jid, sock) || isSudo(jid);
}

function isBanned(jid) {
    const num = cleanNumber(jid);
    const hash = hashNumber(num);
    const banned = readJson(FILES.banned, []);
    return banned.includes(hash);
}

function getMode() {
    return readJson(FILES.mode, { isPublic: true }).isPublic;
}

function setMode(isPublic) {
    writeJson(FILES.mode, { isPublic: Boolean(isPublic) });
}

async function checkAdmin(sock, chatId, senderId) {
    try {
        const meta = await sock.groupMetadata(chatId);
        const participants = meta.participants || [];
        const senderNum = cleanNumber(senderId);
        const botNum = cleanNumber(sock.user?.id || '');

        const hasAdmin = (num) => participants.some(p => {
            const pNum = cleanNumber(p.id);
            return pNum === num && (p.admin === 'admin' || p.admin === 'superadmin');
        });

        return {
            isSenderAdmin: hasAdmin(senderNum),
            isBotAdmin: hasAdmin(botNum),
            meta
        };
    } catch {
        return { isSenderAdmin: false, isBotAdmin: false, meta: null };
    }
}

// ==================== نظام التحذيرات ====================
function getWarnings(groupId, userId) {
    const data = readJson(FILES.warnings, {});
    return data?.[groupId]?.[userId] || 0;
}

function setWarnings(groupId, userId, count) {
    const data = readJson(FILES.warnings, {});
    if (!data[groupId]) data[groupId] = {};
    data[groupId][userId] = count;
    writeJson(FILES.warnings, data);
}

function addWarning(groupId, userId) {
    const current = getWarnings(groupId, userId);
    const next = current + 1;
    setWarnings(groupId, userId, next);
    return next;
}

function resetWarnings(groupId, userId) {
    const data = readJson(FILES.warnings, {});
    if (data?.[groupId]?.[userId]) {
        delete data[groupId][userId];
        writeJson(FILES.warnings, data);
    }
}

// ==================== نظام الكتم ====================
function isMuted(groupId, userId) {
    const data = readJson(FILES.muted, {});
    return data?.[groupId]?.[userId] === true;
}

function setMuted(groupId, userId, muted) {
    const data = readJson(FILES.muted, {});
    if (!data[groupId]) data[groupId] = {};
    if (muted) {
        data[groupId][userId] = true;
    } else {
        delete data[groupId][userId];
    }
    writeJson(FILES.muted, data);
}

// ==================== كشف الروابط ====================
function containsLink(text) {
    if (!text) return false;
    const linkRegex = /(https?:\/\/|www\.|chat\.whatsapp\.com|wa\.me|t\.me|telegram\.me)/i;
    return linkRegex.test(text);
}

// ==================== نظام الترحيب ====================
async function isWelcomeOn(groupId) {
    const data = readJson(FILES.welcome, { groups: {} });
    return data.groups?.[groupId]?.enabled === true;
}

async function getWelcome(groupId) {
    const data = readJson(FILES.welcome, { groups: {} });
    return data.groups?.[groupId]?.message || null;
}

async function setWelcome(groupId, enabled, message = null) {
    const data = readJson(FILES.welcome, { groups: {} });
    if (!data.groups) data.groups = {};
    if (!data.groups[groupId]) data.groups[groupId] = {};
    data.groups[groupId].enabled = enabled;
    if (message !== null) data.groups[groupId].message = message;
    writeJson(FILES.welcome, data);
}

// ==================== Autotyping / Autoread ====================
function getAutotyping() {
    return readJson(FILES.autotyping, { enabled: false }).enabled;
}
function setAutotyping(v) {
    writeJson(FILES.autotyping, { enabled: Boolean(v) });
}
function getAutoread() {
    return readJson(FILES.autoread, { enabled: false }).enabled;
}
function setAutoread(v) {
    writeJson(FILES.autoread, { enabled: Boolean(v) });
}

// ==================== smsg ====================
function smsg(conn, m) {
    if (!m) return m;
    const M = proto.WebMessageInfo;

    if (m.key) {
        m.id = m.key.id;
        m.isBaileys = m.id?.startsWith('BAE5') && m.id.length === 16;
        m.chat = m.key.remoteJid;
        m.fromMe = m.key.fromMe;
        m.isGroup = m.chat?.endsWith('@g.us');
        m.sender = conn.decodeJid(
            (m.fromMe && conn.user?.id) ||
            m.participant ||
            m.key.participant ||
            m.chat || ''
        );
        if (m.isGroup) m.participant = conn.decodeJid(m.key.participant) || '';
    }

    if (m.message) {
        m.mtype = getContentType(m.message);
        m.msg = m.mtype === 'viewOnceMessage'
            ? m.message[m.mtype].message[getContentType(m.message[m.mtype].message)]
            : m.message[m.mtype];

        m.body =
            m.message.conversation ||
            m.msg?.caption ||
            m.msg?.text || '';

        const ctx = m.msg?.contextInfo;
        let quoted = (m.quoted = ctx?.quotedMessage || null);
        m.mentionedJid = ctx?.mentionedJid || [];

        if (m.quoted) {
            let type = getContentType(quoted);
            m.quoted = m.quoted[type];
            if (type === 'productMessage') {
                type = getContentType(m.quoted);
                m.quoted = m.quoted[type];
            }
            if (typeof m.quoted === 'string') m.quoted = { text: m.quoted };
            m.quoted.mtype = type;
            m.quoted.id = ctx.stanzaId;
            m.quoted.chat = ctx.remoteJid || m.chat;
            m.quoted.sender = conn.decodeJid(ctx.participant || '');
            m.quoted.fromMe = m.quoted.sender === conn.decodeJid(conn.user?.id || '');
            m.quoted.text =
                m.quoted.text ||
                m.quoted.caption ||
                m.quoted.conversation || '';
            m.quoted.mentionedJid = ctx.mentionedJid || [];
            m.quoted.download = () => conn.downloadMediaMessage(m.quoted);
        }
    }

    if (m.msg?.url) m.download = () => conn.downloadMediaMessage(m.msg);

    m.text =
        m.msg?.text ||
        m.msg?.caption ||
        m.message?.conversation ||
        m.msg?.contentText || '';

    m.reply = (text, chatId = m.chat, options = {}) =>
        conn.sendMessage(chatId, { text, ...options }, { quoted: m });

    return m;
}

// ==================== الترحيب ====================
async function handleJoinEvent(sock, groupId, participants) {
    try {
        const enabled = await isWelcomeOn(groupId);
        if (!enabled) return;

        const customMessage = await getWelcome(groupId);
        const meta = await sock.groupMetadata(groupId);
        const groupName = meta.subject || 'المجموعة';
        const groupDesc = meta.desc || 'لا يوجد وصف';
        const memberCount = meta.participants.length;

        for (const participant of participants) {
            try {
                const participantString = typeof participant === 'string'
                    ? participant : (participant.id || String(participant));

                const fakeName = `عضو-${String(memberCount).padStart(3, '0')}`;

                const timeString = new Date().toLocaleString('ar-EG', {
                    month: '2-digit', day: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', hour12: true
                });

                let message;
                if (customMessage) {
                    message = customMessage
                        .replace(/{user}/g, `@${fakeName}`)
                        .replace(/{group}/g, groupName)
                        .replace(/{description}/g, groupDesc);
                } else {
                    message = `╭╼━≪• عضو جديد •≫━╾╮\n` +
                        `┃ مرحبًا: @${fakeName} 👋\n` +
                        `┃ عدد الأعضاء: #${memberCount}\n` +
                        `┃ الوقت: ${timeString} ⏰\n` +
                        `╰━━━━━━━━━━━━━━━╯\n\n` +
                        `*@${fakeName}* مرحبًا بك في *${groupName}*! 🎉\n\n` +
                        `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ${CONFIG.botName}*\n` +
                        `📢 *قناتنا:* ${CONFIG.channelLink}`;
                }

                await sock.sendMessage(groupId, {
                    text: message,
                    mentions: [participantString],
                    ...channelInfo
                });
            } catch (err) {
                console.error('❌ خطأ ترحيب:', err.message);
            }
        }
    } catch (err) {
        console.error('❌ خطأ handleJoinEvent:', err.message);
    }
}

// ══════════════════════════════════════════════════════════════
// ═══════════════ معالج الرسائل ═══════════════
// ══════════════════════════════════════════════════════════════

async function handleMessages(sock, chatUpdate) {
    try {
        const { messages, type } = chatUpdate;
        if (type !== 'notify') return;

        const message = messages[0];
        if (!message?.message) return;

        if (Object.keys(message.message)[0] === 'ephemeralMessage') {
            message.message = message.message.ephemeralMessage.message;
        }

        const chatId = message.key.remoteJid;
        const senderId = message.key.participant || message.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const fromMe = message.key.fromMe;

        const m = smsg(sock, message);

        if (getAutoread()) {
            try { await sock.readMessages([message.key]); } catch {}
        }

        const rawText = (
            message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() || ''
        );

        const lower = rawText.toLowerCase().trim();

        if (isBanned(senderId) && !fromMe && !lower.startsWith('.الغاء')) return;

        const isPublic = getMode();
        const ownerOrSudo = fromMe || isOwnerOrSudo(senderId, sock);

        const parts = rawText.split(/\s+/);
        let cmd = parts[0];
        if (cmd.startsWith('.')) cmd = cmd.substring(1);
        const args = parts.slice(1);
        const cmdLower = cmd.toLowerCase();

        const knownCommands = [
            'بينج', 'حالة', 'الحالة', 'قائمة', 'الاوامر', 'الأوامر', 'اوامر', 'menu', 'help',
            'المالك', 'owner', 'قناة', 'channel',
            'معرف', 'jid', 'id',
            'ru', 'russia', 'روسيا', 'بروفايل', 'صورة', 'ru2', 'russia2', 'روسيا2',
            'رفع', 'ارفع', 'promote', 'تنزيل', 'نزل', 'demote',
            'طرد', 'kick', 'منشن', 'tagall', 'معلومات', 'groupinfo', 'مشرفين', 'adminlist',
            'ترحيب', 'welcome',
            'واسطد', 'wasted', 'ملصق', 'sticker', 's', 'عرض', 'vv', 'viewonce',
            'نكتة', 'joke', 'اقتباس', 'quote',
            'وضع', 'mode', 'كتابة', 'autotyping', 'قراءة', 'autoread',
            'حظر', 'ban', 'الغاء', 'unban', 'سودو', 'sudo', 'اعادة', 'restart',
            'تحذير', 'warn', 'تحذيرات', 'warnings', 'مسح_تحذيرات',
            'كتم', 'mute', 'فك_كتم', 'فك_الكتم', 'unmute', 'المكتومين', 'muted'
        ];

        if (!cmd) return;

        // المراقبة التلقائية
        if (isGroup && !fromMe && !ownerOrSudo) {
            const adminCheck = await checkAdmin(sock, chatId, senderId);

            if (!adminCheck.isSenderAdmin) {
                const senderHash = hashNumber(senderId);

                if (isMuted(chatId, senderHash)) {
                    try { await sock.sendMessage(chatId, { delete: message.key }); } catch {}

                    const muteJokes = [
                        `🤐 *عضو محمي* في الحبس! اكتب بس من بعيد 🚫`,
                        `🔇 *عضو محمي* اتكتم! ده مش مكانك 🚫`,
                        `😶 *عضو محمي* معلش بقى... صوتك مقطوع 🎤❌`,
                        `📢 *عضو محمي* الروم مش سامعك... اتكتمت! 🤫`,
                        `⛔ *عضو محمي* كتمتك ومفيش كلام تاني 🚫`
                    ];
                    await sock.sendMessage(chatId, {
                        text: muteJokes[Math.floor(Math.random() * muteJokes.length)],
                        ...channelInfo
                    });
                    return;
                }

                if (containsLink(rawText)) {
                    try { await sock.sendMessage(chatId, { delete: message.key }); } catch {}

                    const linkWarnings = [
                        '🔗📵 *يالا بينا!* ممنوع نشر روابط هنا. خد تحذيرك الأول! ⚠️',
                        '🚫🔗 *بلاش روابط!* أنا مش ناقص. تحذير!',
                        '😠 *رابط إيه ده؟!* خد تحذير وهات غيرها! ⚠️',
                        '📛 *الرابط محذوف!* قدامك تحذيرين وهتطير! 🚪'
                    ];
                    const count = addWarning(chatId, senderHash);

                    await sock.sendMessage(chatId, {
                        text: `${linkWarnings[Math.floor(Math.random() * linkWarnings.length)]}\n\n⚠️ *عدد التحذيرات:* ${count}/3\n🔐 *العضو: محمي*`,
                        ...channelInfo
                    });

                    if (count >= 3) {
                        await sock.sendMessage(chatId, {
                            text: `☠️ *عضو محمي* تجاوز الحد! طرد فوري! 🚪👋`,
                            ...channelInfo
                        });
                        try { await sock.groupParticipantsUpdate(chatId, [senderId], 'remove'); } catch {}
                        resetWarnings(chatId, senderHash);
                    }
                    return;
                }

                const badWords = [
                    'كلب', 'حمار', 'خرا', 'قحبة', 'زبالة', 'غبي', 'خول',
                    'نيك', 'كس', 'زب', 'عاهرة', 'شرموط', 'خنزير', 'حقير',
                    'أهبل', 'بليد', 'تافه', 'معتوه', 'مجنون', 'سافل'
                ];

                const hasBadWord = badWords.some(w => rawText.toLowerCase().includes(w.toLowerCase()));

                if (hasBadWord) {
                    try { await sock.sendMessage(chatId, { delete: message.key }); } catch {}

                    const badWarnings = [
                        '🤬 *ألفاظك مش مقبولة!* خد تحذير واستهدى! ⚠️',
                        '😡 *لسانك طويل!* تحذير — عدّل كلامك! ⚠️',
                        '📛 *ألفاظك محذوفة!* خلاص كفاية كده! 🚫',
                        '👊 *مش عاجبني كلامك!* خد تحذير وهات غيرها! ⚠️'
                    ];
                    const count = addWarning(chatId, senderHash);

                    await sock.sendMessage(chatId, {
                        text: `${badWarnings[Math.floor(Math.random() * badWarnings.length)]}\n\n⚠️ *عدد التحذيرات:* ${count}/3\n🔐 *العضو: محمي*`,
                        ...channelInfo
                    });

                    if (count >= 3) {
                        await sock.sendMessage(chatId, {
                            text: `☠️ *عضو محمي* خلصت التحذيرات! باي باي! 🚪👋`,
                            ...channelInfo
                        });
                        try { await sock.groupParticipantsUpdate(chatId, [senderId], 'remove'); } catch {}
                        resetWarnings(chatId, senderHash);
                    }
                    return;
                }
            }
        }

        if (!knownCommands.includes(cmdLower)) {
            if (['hi', 'hello', 'hey', 'اهلا', 'السلام عليكم'].includes(lower) && !isGroup) {
                await sock.sendMessage(chatId, {
                    text: `👋 أهلاً! اكتب .قائمة لعرض الأوامر.\n\n📢 قناتنا: ${CONFIG.channelLink}`
                }, { quoted: m });
            }
            return;
        }

        if (!isPublic && !ownerOrSudo) return;

        console.log(chalk.cyan(`📝 ${isGroup ? 'مجموعة' : 'خاص'}: ${cmdLower}`));

        if (getAutotyping()) {
            try { await sock.sendPresenceUpdate('composing', chatId); } catch {}
        }

        const ctx = {
            sock, chatId, senderId, message: m,
            args, isGroup, fromMe, ownerOrSudo,
            rawText
        };

        await executeCommand(cmdLower, ctx);

        if (getAutotyping()) {
            try { await sock.sendPresenceUpdate('paused', chatId); } catch {}
        }

    } catch (err) {
        console.error('❌ خطأ handleMessages:', err.message);
    }
}

// ══════════════════════════════════════════════════════════════
// ═══════════════ منفّذ الأوامر ═══════════════
// ══════════════════════════════════════════════════════════════

async function executeCommand(cmd, ctx) {
    const { sock, chatId, senderId, message, args, isGroup, fromMe, ownerOrSudo } = ctx;
    const send = (text) => sock.sendMessage(chatId, { text, ...channelInfo }, { quoted: message });

    switch (cmd) {

        // ═══════════ القائمة الرئيسية ═══════════
        case 'قائمة':
        case 'الاوامر':
        case 'الأوامر':
        case 'اوامر':
        case 'menu':
        case 'help': {
            await sendMenuWithVideo(sock, chatId, message);
            break;
        }

        // ═══════════ قناة Dr/Russia ═══════════
        case 'قناة':
        case 'channel':
        case 'القناة': {
            await send(
                `📢 *قناة Dr/Russia*\n\n` +
                `🔗 ${CONFIG.channelLink}\n\n` +
                `💀 *انضم للمتابعة والاطلاع على الجديد*`
            );
            break;
        }

        // ═══════════ ru ═══════════
        case 'ru':
        case 'russia':
        case 'روسيا':
        case 'بروفايل':
        case 'صورة': {
            const ctxInfo = message.message?.extendedTextMessage?.contextInfo;
            const mentioned = ctxInfo?.mentionedJid || [];
            const quotedSender = ctxInfo?.participant;

            let target = null;

            if (mentioned.length > 0) target = mentioned[0];
            else if (quotedSender) target = quotedSender;
            else if (args && args.length > 0) {
                let maybeNumber = String(args[0]).replace(/\D/g, '');

                if (maybeNumber.length === 11 && maybeNumber.startsWith('0')) {
                    maybeNumber = '20' + maybeNumber.substring(1);
                } else if (maybeNumber.length === 10 && !maybeNumber.startsWith('20')) {
                    maybeNumber = '20' + maybeNumber;
                }

                if (maybeNumber.length >= 10 && maybeNumber.length <= 15) {
                    target = `${maybeNumber}@s.whatsapp.net`;
                }
            }

            if (!target) {
                return send(
                    `📖 *أمر ru*\n\n` +
                    `• منشن: ru @شخص\n` +
                    `• رقم: ru 01069679310\n` +
                    `• رد: رد واكتب ru\n\n` +
                    `⚡ *Dr/Russia*`
                );
            }

            try {
                try { await sock.sendPresenceUpdate('composing', chatId); } catch {}

                let pfpUrl = null;
                try { pfpUrl = await sock.profilePictureUrl(target, 'image'); } catch {}

                if (!pfpUrl) {
                    await send(`⚠️ العضو لا يملك صورة بروفايل.`);
                    return;
                }

                const response = await axios.get(pfpUrl, {
                    responseType: 'arraybuffer',
                    timeout: 10000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });

                await sock.sendMessage(chatId, {
                    image: Buffer.from(response.data),
                    caption: `👤 *صورة بروفايل*\n\n⚡ *Dr/Russia*\n📢 ${CONFIG.channelLink}`,
                    mentions: [target],
                    ...channelInfo
                }, { quoted: message });

            } catch (err) {
                await send(`❌ فشل: ${err.message}`);
            }
            break;
        }

        // ═══════════ ru2 ═══════════
        case 'ru2':
        case 'russia2':
        case 'روسيا2': {
            const ctxInfo = message.message?.extendedTextMessage?.contextInfo;
            if (!ctxInfo?.quotedMessage) {
                return send(
                    `📸 *أمر ru2*\n\n` +
                    `• ارد على صورة/فيديو/صوت\n` +
                    `• أو على View Once\n\n` +
                    `⚡ *Dr/Russia*`
                );
            }

            try {
                let inner = ctxInfo.quotedMessage;

                if (inner.viewOnceMessage) inner = inner.viewOnceMessage.message;
                else if (inner.viewOnceMessageV2) inner = inner.viewOnceMessageV2.message;
                else if (inner.viewOnceMessageV2Extension) inner = inner.viewOnceMessageV2Extension.message;
                else if (inner.ephemeralMessage) inner = inner.ephemeralMessage.message;

                const type = Object.keys(inner)[0];
                const caption = inner[type]?.caption || '';

                if (type === 'imageMessage') {
                    const stream = await downloadContentFromMessage(inner.imageMessage, 'image');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

                    await sock.sendMessage(chatId, {
                        image: buffer,
                        caption: caption || '📷 صورة',
                        ...channelInfo
                    }, { quoted: message });
                }
                else if (type === 'videoMessage') {
                    const stream = await downloadContentFromMessage(inner.videoMessage, 'video');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

                    await sock.sendMessage(chatId, {
                        video: buffer,
                        caption: caption || '🎥 فيديو',
                        mimetype: inner.videoMessage.mimetype || 'video/mp4',
                        ...channelInfo
                    }, { quoted: message });
                }
                else if (type === 'audioMessage') {
                    const stream = await downloadContentFromMessage(inner.audioMessage, 'audio');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

                    await sock.sendMessage(chatId, {
                        audio: buffer,
                        mimetype: inner.audioMessage.mimetype || 'audio/mp4',
                        ptt: inner.audioMessage.ptt || false,
                        ...channelInfo
                    }, { quoted: message });
                }
                else {
                    await send(`⚠️ نوع غير مدعوم: ${type}`);
                }
            } catch (err) {
                await send(`❌ فشل السحب: ${err.message}`);
            }
            break;
        }

        // ═══════════ تحذير ═══════════
        case 'تحذير':
        case 'warn': {
            if (!isGroup) return send('❌ للمجموعات فقط.');

            const admin = await checkAdmin(sock, chatId, senderId);
            if (!admin.isSenderAdmin && !fromMe && !ownerOrSudo) return send('❌ لازم تكون أدمن.');
            if (!admin.isBotAdmin && !fromMe) return send('❌ لازم البوت يكون أدمن.');

            const ctxInfo = message.message?.extendedTextMessage?.contextInfo;
            const mentioned = ctxInfo?.mentionedJid || [];
            const quoted = ctxInfo?.participant;

            let target = mentioned[0] || quoted;
            if (!target) return send(`⚠️ منشن شخص أو ارد على رسالته.`);

            const targetHash = hashNumber(target);
            const count = addWarning(chatId, targetHash);

            const warnMessages = [
                `⚠️ *تحذير رسمي!*\n\n📍 المخالف: 🔐 عضو محمي\n📊 التحذيرات: *${count}/3*\n\n_لو وصلت 3 هتطير!_ 🚪`,
                `🚨 *إنذار أحمر!*\n\n🎯 🔐 عضو محمي\n⚠️ تحذير رقم: *${count}/3*`,
                `📛 *تحذير من Dr/Russia!*\n\n👤 🔐 عضو محمي\n📈 الوصول: *${count}/3*`
            ];

            await sock.sendMessage(chatId, {
                text: warnMessages[Math.floor(Math.random() * warnMessages.length)],
                mentions: [target],
                ...channelInfo
            }, { quoted: message });

            if (count >= 3) {
                await sleep(1500);
                await sock.sendMessage(chatId, {
                    text: `☠️ *خلصت اللعبة!*\n\n👋 🔐 عضو محمي وصل 3 تحذيرات!\n🚪 طرد فوري...`,
                    ...channelInfo
                });
                try { await sock.groupParticipantsUpdate(chatId, [target], 'remove'); } catch {}
                resetWarnings(chatId, targetHash);
            }
            break;
        }

        case 'تحذيرات':
        case 'warnings': {
            if (!isGroup) return send('❌ للمجموعات فقط.');

            const ctxInfo = message.message?.extendedTextMessage?.contextInfo;
            const mentioned = ctxInfo?.mentionedJid || [];
            const quoted = ctxInfo?.participant;

            let target = mentioned[0] || quoted || senderId;
            const targetHash = hashNumber(target);
            const count = getWarnings(chatId, targetHash);

            await send(
                `${count === 0 ? '✅' : count === 1 ? '⚠️' : count === 2 ? '🔴' : '☠️'} *التحذيرات*\n\n` +
                `👤 العضو: 🔐 محمي\n` +
                `📊 العدد: *${count}/3*`
            );
            break;
        }

        // ═══════════ كتم ═══════════
        case 'كتم':
        case 'mute': {
            if (!isGroup) return send('❌ للمجموعات فقط.');

            const admin = await checkAdmin(sock, chatId, senderId);
            if (!admin.isSenderAdmin && !fromMe && !ownerOrSudo) return send('❌ لازم تكون أدمن.');
            if (!admin.isBotAdmin && !fromMe) return send('❌ لازم البوت يكون أدمن.');

            const ctxInfo = message.message?.extendedTextMessage?.contextInfo;
            const mentioned = ctxInfo?.mentionedJid || [];
            const quoted = ctxInfo?.participant;

            let target = mentioned[0] || quoted;
            if (!target) return send(`⚠️ منشن شخص أو ارد على رسالته.`);

            if (cleanNumber(senderId) === cleanNumber(target)) return send('😂 متكتمش نفسك!');

            const targetHash = hashNumber(target);
            setMuted(chatId, targetHash, true);

            const jokes = [
                `🤐 *تم الكتم!*\n\n👤 🔐 عضو محمي\n🔇 صوتك قطعناه!`,
                `🔇 *ششششش!*\n\n🎤 🔐 عضو محمي خلاص اتكتم!`,
                `📢➡️🔇 *وداعًا!*\n\n🎯 🔐 عضو محمي خلاص اتخرس!`,
                `😶 *الكتم الرسمي!*\n\n👤 🔐 عضو محمي صار مكتوم!`
            ];

            await sock.sendMessage(chatId, {
                text: jokes[Math.floor(Math.random() * jokes.length)],
                ...channelInfo
            }, { quoted: message });
            break;
        }

        case 'فك_كتم':
        case 'فك_الكتم':
        case 'unmute': {
            if (!isGroup) return send('❌ للمجموعات فقط.');

            const admin = await checkAdmin(sock, chatId, senderId);
            if (!admin.isSenderAdmin && !fromMe && !ownerOrSudo) return send('❌ لازم تكون أدمن.');
            if (!admin.isBotAdmin && !fromMe) return send('❌ لازم البوت يكون أدمن.');

            const ctxInfo = message.message?.extendedTextMessage?.contextInfo;
            const mentioned = ctxInfo?.mentionedJid || [];
            const quoted = ctxInfo?.participant;

            let target = mentioned[0] || quoted;
            if (!target) return send(`⚠️ منشن شخص.`);

            const targetHash = hashNumber(target);
            setMuted(chatId, targetHash, false);

            const jokes = [
                `🔊 *تم فك الكتم!*\n\n👤 🔐 عضو محمي\n🎤 اتفضل اتكلم!`,
                `🎤 *صوت رجع!*\n\n🎯 🔐 عضو محمي فك الكتم!`,
                `✅ *فكيت الكتم!*\n\n👤 🔐 عضو محمي\n🗣️ اتكلم براحتك!`
            ];

            await sock.sendMessage(chatId, {
                text: jokes[Math.floor(Math.random() * jokes.length)],
                ...channelInfo
            }, { quoted: message });
            break;
        }

        case 'المكتومين':
        case 'muted': {
            if (!isGroup) return send('❌ للمجموعات فقط.');

            const admin = await checkAdmin(sock, chatId, senderId);
            if (!admin.isSenderAdmin && !fromMe && !ownerOrSudo) return send('❌ للمشرفين فقط.');

            const data = readJson(FILES.muted, {});
            const groupMuted = data[chatId] || {};
            const mutedList = Object.keys(groupMuted);

            if (mutedList.length === 0) return send('✅ لا يوجد أحد مكتوم!');

            const text = `🔇 *قائمة المكتومين (${mutedList.length})*\n\n` +
                mutedList.map((u, i) => `${i + 1}. 🔐 عضو محمي`).join('\n');
            await send(text);
            break;
        }

        // ═══════════ رفع/تنزيل ═══════════
        case 'رفع':
        case 'ارفع':
        case 'promote': {
            if (!isGroup) return send('❌ للمجموعات فقط.');

            const admin = await checkAdmin(sock, chatId, senderId);
            if (!admin.isSenderAdmin && !fromMe && !ownerOrSudo) return send('❌ لازم تكون أدمن.');
            if (!admin.isBotAdmin && !fromMe) return send('❌ لازم البوت يكون أدمن.');

            const ctxInfo = message.message?.extendedTextMessage?.contextInfo;
            const mentioned = ctxInfo?.mentionedJid || [];
            const quoted = ctxInfo?.participant;

            let targets = mentioned.length > 0 ? mentioned : (quoted ? [quoted] : [sock.user.id]);

            try {
                const meta = admin.meta || await sock.groupMetadata(chatId);
                const toPromote = [];

                for (const t of targets) {
                    const tNum = cleanNumber(t);
                    const existing = meta.participants.find(p => cleanNumber(p.id) === tNum);
                    if (!existing?.admin) toPromote.push(t);
                }

                if (toPromote.length === 0) return send(`⚠️ أدمن بالفعل.`);

                await sock.groupParticipantsUpdate(chatId, toPromote, 'promote');

                await sock.sendMessage(chatId, {
                    text: `✅ *تم الرفع بنجاح*\n\n• 🔐 ${toPromote.length} عضو`,
                    mentions: toPromote,
                    ...channelInfo
                }, { quoted: message });

            } catch (err) {
                await send(`❌ فشل: ${err.message}`);
            }
            break;
        }

        case 'تنزيل':
        case 'نزل':
        case 'demote': {
            if (!isGroup) return send('❌ للمجموعات فقط.');

            const admin = await checkAdmin(sock, chatId, senderId);
            if (!admin.isSenderAdmin && !fromMe && !ownerOrSudo) return send('❌ لازم تكون أدمن.');
            if (!admin.isBotAdmin && !fromMe) return send('❌ لازم البوت يكون أدمن.');

            const ctxInfo = message.message?.extendedTextMessage?.contextInfo;
            const mentioned = ctxInfo?.mentionedJid || [];
            const quoted = ctxInfo?.participant;

            try {
                const meta = admin.meta || await sock.groupMetadata(chatId);
                let targets = mentioned.length > 0 ? mentioned : (quoted ? [quoted] : []);

                if (targets.length === 0) {
                    const senderNum = cleanNumber(senderId);
                    const botNum = cleanNumber(sock.user.id);
                    targets = meta.participants
                        .filter(p => p.admin)
                        .filter(p => cleanNumber(p.id) !== senderNum && cleanNumber(p.id) !== botNum)
                        .map(p => p.id);
                }

                if (targets.length === 0) return send('⚠️ لا يوجد أدمن لتنزيلهم.');

                await sock.groupParticipantsUpdate(chatId, targets, 'demote');

                await sock.sendMessage(chatId, {
                    text: `✅ *تم التنزيل*\n\n• 🔐 ${targets.length} عضو`,
                    mentions: targets,
                    ...channelInfo
                }, { quoted: message });

            } catch (err) {
                await send(`❌ فشل: ${err.message}`);
            }
            break;
        }

        // ═══════════ أساسي ═══════════
        case 'بينج':
        case 'ping': {
            const t = Date.now();
            await send(`🏓 بونج! ${Date.now() - t}ميلي ثانية`);
            break;
        }

        case 'حالة':
        case 'الحالة':
        case 'alive': {
            const up = process.uptime();
            const h = Math.floor(up / 3600);
            const mn = Math.floor((up % 3600) / 60);
            const s = Math.floor(up % 60);
            await send(
                `✅ *البوت يعمل!*\n\n` +
                `⏰ التشغيل: ${h}س ${mn}د ${s}ث\n` +
                `🔐 الحالة: متصل ومحمي\n` +
                `📢 القناة: ${CONFIG.channelLink}`
            );
            break;
        }

        case 'المالك':
        case 'owner': {
            await send(
                `╔════════════════════════════════════╗\n` +
                `║  👤 *معلومات المطور*                ║\n` +
                `╚════════════════════════════════════╝\n\n` +
                `📛 *الاسم:* ${DESIGNER.name}\n` +
                `💼 *الوظيفة:* هكر ومرزية\n` +
                `📢 *القناة:* ${DESIGNER.channel}\n\n` +
                `🔐 *الاتصال محمي*`
            );
            break;
        }

        // ═══════════ المجموعة ═══════════
        case 'ترحيب':
        case 'welcome': {
            if (!isGroup) return send('❌ للمجموعات فقط.');
            const admin = await checkAdmin(sock, chatId, senderId);
            if (!admin.isSenderAdmin && !fromMe) return send('❌ للمشرفين فقط.');

            const sub = (args[0] || '').toLowerCase();
            if (!sub) {
                const enabled = await isWelcomeOn(chatId);
                return send(`📋 *حالة الترحيب:* ${enabled ? '✅ مفعّل' : '❌ معطّل'}`);
            }
            if (sub === 'تشغيل' || sub === 'on') {
                await setWelcome(chatId, true);
                return send('✅ تم تفعيل الترحيب.');
            }
            if (sub === 'إيقاف' || sub === 'off') {
                await setWelcome(chatId, false);
                return send('❌ تم تعطيل الترحيب.');
            }
            break;
        }

        case 'طرد':
        case 'kick': {
            if (!isGroup) return send('❌ للمجموعات فقط.');
            const admin = await checkAdmin(sock, chatId, senderId);
            if (!admin.isSenderAdmin && !fromMe) return send('❌ للمشرفين فقط.');
            if (!admin.isBotAdmin) return send('❌ اجعل البوت مشرفًا.');

            const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (!mentioned.length) return send('⚠️ أشر إلى عضو.');

            try {
                await sock.groupParticipantsUpdate(chatId, mentioned, 'remove');
                await send(`✅ تم طرد ${mentioned.length} عضو.`);
            } catch (err) {
                await send(`❌ فشل: ${err.message}`);
            }
            break;
        }

        case 'منشن':
        case 'tagall': {
            if (!isGroup) return send('❌ للمجموعات فقط.');
            const admin = await checkAdmin(sock, chatId, senderId);
            if (!admin.isSenderAdmin && !fromMe) return send('❌ للمشرفين فقط.');

            try {
                const meta = await sock.groupMetadata(chatId);
                const mentions = meta.participants.map(p => p.id);
                const textArg = args.join(' ') || 'نداء للجميع';
                const text = `📢 *${textArg}*\n\n${mentions.map(() => `🔐 عضو محمي`).join('\n')}\n\n📢 ${CONFIG.channelLink}`;
                await sock.sendMessage(chatId, { text, mentions }, { quoted: message });
            } catch (err) {
                await send(`❌ فشل: ${err.message}`);
            }
            break;
        }

        case 'معلومات':
        case 'groupinfo': {
            if (!isGroup) return send('❌ للمجموعات فقط.');
            try {
                const meta = await sock.groupMetadata(chatId);
                await send(
                    `📊 *معلومات المجموعة*\n\n` +
                    `📛 *الاسم:* ${meta.subject}\n` +
                    `👥 *الأعضاء:* ${meta.participants.length}\n` +
                    `📝 *الوصف:* ${meta.desc || 'لا يوجد'}`
                );
            } catch (err) {
                await send(`❌ فشل: ${err.message}`);
            }
            break;
        }

        case 'مشرفين':
        case 'adminlist': {
            if (!isGroup) return send('❌ للمجموعات فقط.');
            try {
                const meta = await sock.groupMetadata(chatId);
                const admins = meta.participants.filter(p => p.admin);
                const text = `👑 *المشرفون (${admins.length})*\n\n` +
                    admins.map((p, i) => `${i + 1}. 🔐 محمي`).join('\n');
                await sock.sendMessage(chatId, { text }, { quoted: message });
            } catch (err) {
                await send(`❌ فشل: ${err.message}`);
            }
            break;
        }

        // ═══════════ ترفيه ═══════════
        case 'واسطد':
        case 'wasted': {
            const ctxInfo = message.message?.extendedTextMessage?.contextInfo;
            let target = ctxInfo?.mentionedJid?.[0] || ctxInfo?.participant;
            if (!target) return send('⚠️ أشر إلى شخص.');

            try {
                let pfp = 'https://i.imgur.com/2wzGhpF.jpeg';
                try {
                    const url = await sock.profilePictureUrl(target, 'image');
                    if (url) pfp = url;
                } catch {}

                const response = await axios.get(
                    `https://some-random-api.com/canvas/overlay/wasted?avatar=${encodeURIComponent(pfp)}`,
                    { responseType: 'arraybuffer', timeout: 15000 }
                );

                await sock.sendMessage(chatId, {
                    image: Buffer.from(response.data),
                    caption: `⚰️ *Wasted*\n\nRest in pieces!`,
                    mentions: [target],
                    ...channelInfo
                }, { quoted: message });
            } catch (err) {
                await send(`❌ فشل: ${err.message}`);
            }
            break;
        }

        case 'نكتة':
        case 'joke': {
            const jokes = [
                'لماذا لا يلعب الحاسوب كرة القدم؟ لأنه يخاف من الفيروسات! 😂',
                'قال المبرمج لزوجته: أحبك من 0 إلى 1! ❤️',
                'لماذا يكره المبرمج الشمس؟ لأنها تُسبب Bugs! 🐛',
                'ما هو طعام المبرمج المفضل؟ Cookies! 🍪'
            ];
            await send(`😂 ${jokes[Math.floor(Math.random() * jokes.length)]}`);
            break;
        }

        case 'اقتباس':
        case 'quote': {
            const quotes = [
                '«العلم نور والجهل ظلام»',
                '«من جدّ وجد ومن زرع حصد»',
                '«الصبر مفتاح الفرج»',
                '«الوقت كالسيف إن لم تقطعه قطعك»'
            ];
            await send(`💭 ${quotes[Math.floor(Math.random() * quotes.length)]}`);
            break;
        }

        case 'ملصق':
        case 'sticker':
        case 's': {
            const ctxInfo = message.message?.extendedTextMessage?.contextInfo;
            if (!ctxInfo?.quotedMessage) return send('⚠️ رد على صورة أو فيديو.');

            try {
                const quoted = ctxInfo.quotedMessage;
                const type = Object.keys(quoted)[0];
                if (!['imageMessage', 'videoMessage'].includes(type)) return send('⚠️ صيغة غير مدعومة.');

                const stream = await downloadContentFromMessage(quoted[type], type === 'imageMessage' ? 'image' : 'video');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

                await sock.sendMessage(chatId, { sticker: buffer }, { quoted: message });
            } catch (err) {
                await send(`❌ فشل: ${err.message}`);
            }
            break;
        }

        case 'عرض':
        case 'vv':
        case 'viewonce': {
            const ctxInfo = message.message?.extendedTextMessage?.contextInfo;
            if (!ctxInfo?.quotedMessage) return send('⚠️ رد على view once.');

            try {
                let inner = ctxInfo.quotedMessage;
                if (inner.viewOnceMessage) inner = inner.viewOnceMessage.message;
                else if (inner.viewOnceMessageV2) inner = inner.viewOnceMessageV2.message;

                const type = Object.keys(inner)[0];
                if (!['imageMessage', 'videoMessage'].includes(type)) return send('⚠️ ليست view once.');

                const stream = await downloadContentFromMessage(inner[type], type === 'imageMessage' ? 'image' : 'video');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

                if (type === 'imageMessage') {
                    await sock.sendMessage(chatId, { image: buffer, caption: '👁️' }, { quoted: message });
                } else {
                    await sock.sendMessage(chatId, { video: buffer, caption: '👁️' }, { quoted: message });
                }
            } catch (err) {
                await send(`❌ فشل: ${err.message}`);
            }
            break;
        }

        // ═══════════ المالك ═══════════
        case 'وضع':
        case 'mode': {
            if (!ownerOrSudo) return send('❌ للمالك فقط.');
            const arg = (args[0] || '').toLowerCase();
            const isPub = (arg === 'public' || arg === 'عام');
            const isPriv = (arg === 'private' || arg === 'خاص');
            if (!isPub && !isPriv) return send(`📋 الوضع: ${getMode() ? 'عام' : 'خاص'}`);
            setMode(isPub);
            await send(`✅ الوضع: *${isPub ? 'عام' : 'خاص'}*`);
            break;
        }

        case 'كتابة':
        case 'autotyping': {
            if (!ownerOrSudo) return send('❌ للمالك فقط.');
            const arg = (args[0] || '').toLowerCase();
            if (arg === 'on' || arg === 'تشغيل') { setAutotyping(true); return send('✅ مفعّل'); }
            if (arg === 'off' || arg === 'إيقاف') { setAutotyping(false); return send('❌ معطّل'); }
            return send(`📋 ${getAutotyping() ? 'مفعّلة' : 'معطّلة'}`);
        }

        case 'قراءة':
        case 'autoread': {
            if (!ownerOrSudo) return send('❌ للمالك فقط.');
            const arg = (args[0] || '').toLowerCase();
            if (arg === 'on' || arg === 'تشغيل') { setAutoread(true); return send('✅ مفعّل'); }
            if (arg === 'off' || arg === 'إيقاف') { setAutoread(false); return send('❌ معطّل'); }
            return send(`📋 ${getAutoread() ? 'مفعّلة' : 'معطّلة'}`);
        }

        case 'حظر':
        case 'ban': {
            if (!ownerOrSudo) return send('❌ للمالك فقط.');
            const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const ctxInfo = message.message?.extendedTextMessage?.contextInfo;
            let target = mentioned[0] || ctxInfo?.participant;
            if (!target) return send('⚠️ أشر إلى عضو.');

            const targetHash = hashNumber(target);
            const banned = readJson(FILES.banned, []);
            if (!banned.includes(targetHash)) banned.push(targetHash);
            writeJson(FILES.banned, banned);
            await send(`🚫 تم الحظر`);
            break;
        }

        case 'الغاء':
        case 'unban': {
            if (!ownerOrSudo) return send('❌ للمالك فقط.');
            const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const ctxInfo = message.message?.extendedTextMessage?.contextInfo;
            let target = mentioned[0] || ctxInfo?.participant;
            if (!target) return send('⚠️ أشر إلى عضو.');

            const targetHash = hashNumber(target);
            const banned = readJson(FILES.banned, []).filter(b => b !== targetHash);
            writeJson(FILES.banned, banned);
            await send(`✅ تم رفع الحظر`);
            break;
        }

        case 'سودو':
        case 'sudo': {
            if (!isOwner(senderId, sock) && !fromMe) return send('❌ للمالك فقط.');
            const sub = (args[0] || '').toLowerCase();
            const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const ctxInfo = message.message?.extendedTextMessage?.contextInfo;
            let target = mentioned[0] || ctxInfo?.participant;

            if (sub === 'قائمة' || sub === 'list') {
                const list = readJson(FILES.sudo, []);
                return send(`👑 *السودو (${list.length})*\n\n${list.map(() => `• 🔐 محمي`).join('\n') || 'لا يوجد'}`);
            }
            if (!target) return send('⚠️ الاستخدام: .سودو اضافة/ازالة/قائمة');

            const targetHash = hashNumber(target);
            let sudo = readJson(FILES.sudo, []);

            if (sub === 'اضافة' || sub === 'add') {
                if (!sudo.includes(targetHash)) sudo.push(targetHash);
                writeJson(FILES.sudo, sudo);
                return send(`✅ تم الإضافة`);
            }
            if (sub === 'ازالة' || sub === 'remove') {
                sudo = sudo.filter(s => s !== targetHash);
                writeJson(FILES.sudo, sudo);
                return send(`✅ تم الإزالة`);
            }
            return send('⚠️ الاستخدام: .سودو اضافة/ازالة/قائمة');
        }

        case 'معرف':
        case 'jid': {
            await send(`🔐 *المعرف محفوظ للأمان*`);
            break;
        }

        case 'اعادة':
        case 'restart': {
            if (!ownerOrSudo) return send('❌ للمالك فقط.');
            await send('🔄 جاري إعادة التشغيل...');
            setTimeout(() => process.exit(0), 1000);
            break;
        }

        default: {
            // لا رد
        }
    }
}

// ==================== بدء البوت ====================
let reconnectAttempts = 0;
let isShuttingDown = false;
let pendingPhoneNumber = null;
let pairingRequested = false;
let pairingRetries = 0;

async function startBot() {
    try {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
        const logger = pino({ level: 'silent' });
        const msgRetryCounterCache = new NodeCache();

        const sock = makeWASocket({
            version,
            logger,
            printQRInTerminal: false,
            browser: Browsers.ubuntu('Chrome'),
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger)
            },
            markOnlineOnConnect: true,
            syncFullHistory: false,
            generateHighQualityLinkPreview: true,
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            getMessage: async () => ''
        });

        sock.decodeJid = (jid) => {
            if (!jid) return jid;
            if (/:\d+@/gi.test(jid)) {
                const d = jidDecode(jid) || {};
                return d.user && d.server ? `${d.user}@${d.server}` : jid;
            }
            return jid;
        };

        sock.ev.on('creds.update', saveCreds);

        if (CONFIG.usePairingCode && !state.creds.registered && !pendingPhoneNumber) {
            pendingPhoneNumber = await askPhoneNumber();
            if (!pendingPhoneNumber || pendingPhoneNumber.length < 10) {
                console.error(chalk.red('❌ رقم غير صالح.'));
                process.exit(1);
            }

            const phoneHash = hashNumber(pendingPhoneNumber);
            const owners = readJson(FILES.owners, []);
            if (!owners.includes(phoneHash)) {
                owners.push(phoneHash);
                writeJson(FILES.owners, owners);
            }
        }

        async function requestPairingCode() {
            if (pairingRequested || !pendingPhoneNumber || state.creds.registered) return;
            pairingRequested = true;

            try {
                console.log(chalk.cyan(`\n⏳ جاري طلب كود الربط...`));
                const code = await sock.requestPairingCode(pendingPhoneNumber);
                const formatted = code?.match(/.{1,4}/g)?.join('-') || code;

                console.log('\n' + chalk.bgGreen.black(` 🔑 كود الربط: ${formatted} `) + '\n');
                console.log(chalk.yellow('📲 الإعدادات → الأجهزة المرتبطة → ربط جهاز\n'));

            } catch (err) {
                console.error(chalk.red('❌ فشل:'), err.message);
                pairingRetries++;
                if (pairingRetries < CONFIG.MAX_PAIRING_RETRIES) {
                    pairingRequested = false;
                    const waitMs = Math.min(2000 * pairingRetries, 15000);
                    setTimeout(() => {
                        if (!state.creds.registered) requestPairingCode();
                    }, waitMs);
                }
            }
        }

        sock.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                const mek = chatUpdate.messages[0];
                if (!mek?.message) return;

                if (Object.keys(mek.message)[0] === 'ephemeralMessage') {
                    mek.message = mek.message.ephemeralMessage.message;
                }

                if (mek.key?.remoteJid === 'status@broadcast') return;
                if (mek.key.id?.startsWith('BAE5') && mek.key.id.length === 16) return;

                await handleMessages(sock, chatUpdate);
            } catch (err) {
                console.error('❌ messages.upsert:', err.message);
            }
        });

        sock.ev.on('group-participants.update', async (update) => {
            try {
                const { id, participants, action } = update;
                if (!id.endsWith('@g.us')) return;
                if (action === 'add') await handleJoinEvent(sock, id, participants);
            } catch (err) {
                console.error('❌ group-participants.update:', err.message);
            }
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (connection === 'connecting') {
                console.log(chalk.yellow('🔄 جاري الاتصال...'));
                if (pendingPhoneNumber && !pairingRequested && !state.creds.registered) {
                    setTimeout(() => {
                        if (!state.creds.registered && !pairingRequested) requestPairingCode();
                    }, 3000);
                }
            }

            if (qr && pendingPhoneNumber && !pairingRequested && !state.creds.registered) {
                setTimeout(() => {
                    if (!state.creds.registered && !pairingRequested) requestPairingCode();
                }, 1500);
            }

            if (connection === 'open') {
                reconnectAttempts = 0;
                pairingRequested = false;
                pairingRetries = 0;

                console.clear();
                console.log('');
                console.log(chalk.green('╔═══════════════════════════════════════════════════════════╗'));
                console.log(chalk.green('║') + chalk.bgGreen.black.bold('          ✅  D R / R U S S I A   O N L I N E  ✅          ') + chalk.green('║'));
                console.log(chalk.green('╚═══════════════════════════════════════════════════════════╝'));
                console.log('');
                console.log(chalk.green('  🤖 البوت    : ') + chalk.yellow('بوت Dr/Russia'));
                console.log(chalk.green('  🔐 الحالة   : ') + chalk.yellow('متصل ومحمي 🔒'));
                console.log(chalk.green('  ⏰ الوقت    : ') + chalk.yellow(new Date().toLocaleString('ar-EG')));

                const vp = findVideoPath();
                if (vp) {
                    console.log(chalk.green('  🎬 الفيديو  : ') + chalk.yellow(path.basename(vp)));
                } else {
                    console.log(chalk.yellow('  🎬 الفيديو  : ') + chalk.red('غير موجود'));
                }

                console.log('');
                console.log(chalk.cyan('  📢 القناة: ' + CONFIG.channelLink));
                console.log('');
                console.log(chalk.gray('  📝 اكتب .قائمة لعرض الأوامر'));
                console.log('');
            }

            if (connection === 'close') {
                if (isShuttingDown) return;

                const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;

                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    console.log(chalk.red('\n🚪 تم تسجيل الخروج.'));
                    try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); } catch {}
                    process.exit(0);
                }

                if (statusCode === DisconnectReason.restartRequired) return startBot();

                if (!state.creds.registered && pendingPhoneNumber) {
                    pairingRequested = false;
                    setTimeout(() => startBot(), 3000);
                    return;
                }

                if (reconnectAttempts >= CONFIG.MAX_RECONNECT_ATTEMPTS) {
                    process.exit(1);
                }

                reconnectAttempts++;
                const waitMs = Math.min(
                    CONFIG.BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1),
                    120000
                );
                console.log(chalk.yellow(`⏳ إعادة الاتصال #${reconnectAttempts} بعد ${waitMs / 1000}ث...`));
                setTimeout(() => startBot(), waitMs);
            }
        });

    } catch (err) {
        console.error(chalk.bgRed('\n❌ فشل بدء البوت:'));
        console.error(err);
        setTimeout(() => startBot(), 5000);
    }
}

// ==================== معالجات الإشارات ====================
process.on('SIGINT', () => {
    isShuttingDown = true;
    console.log(chalk.yellow('\n🛑 إيقاف...'));
    process.exit(0);
});

process.on('SIGTERM', () => {
    isShuttingDown = true;
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    console.error(chalk.bgRed('\n❌ Uncaught Exception:'), err.message);
});

process.on('unhandledRejection', (err) => {
    console.error(chalk.bgRed('\n❌ Unhandled Rejection:'), err);
});

const keepAlive = setInterval(() => {}, 1 << 30);

// ==================== تشغيل ====================
(async () => {
    try {
        await showBootScreen();
        await startBot();
    } catch (err) {
        console.error(chalk.bgRed('\n❌ خطأ فادح:'), err);
    }
})();
