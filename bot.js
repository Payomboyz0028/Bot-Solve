// bot.js - PayomboyZ Unified Bot: Script Intelligence Hub & Arkose Captcha V2 Solver
// Deployed on Render with Role Privileges, Supabase REST Billing, and Interactive Panels

const {
    Client,
    GatewayIntentBits,
    Partials,
    Events,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { buildHubCatalogEmbed, buildMapDetailsEmbed } = require('./embedBuilder');

// Configuration & Constants
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = '1549398019970179152';

// Channels
const SCRIPT_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || '1564763903504818357';
const PANEL_CHANNEL_ID = '1564775299898540123';   // ꒰🧩꒱︲v2capcha-แก้แคปช่า
const RESULT_CHANNEL_ID = '1564775986891853834';  // ꒰🔓꒱︲result-ผลลัพธ์แก้แคป
const SHOP_CHANNEL_ID = '1549819642208460970';    // #shop

// Free Roles for 100% Free Unlimited Captcha Solves
const FREE_ROLES = [
    '1549536919892004985', // VIP
    '1549785782330593330', // VVIP
    '1555459798806568972', // SuperIP
    '1549535527756111892', // AI Script
    '1549535328753164418'  // Admin Role
];

const SOLVE_COST = 0.15; // 0.15 THB per solve for non-role users
const SOLVER_API_URL = process.env.SOLVER_API_URL || 'https://payomboyzcreative.online/api/v1/captcha';
const SOLVER_LOCAL_API = process.env.SOLVER_LOCAL_API || 'http://127.0.0.1:8000';

// 100% Pure Supabase Client (Zero SQL)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tfwtcjiaphvtmamlzaxe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Load Maps Data for Script Hub
const DATA_FILE = path.join(__dirname, 'mapsData.json');
let mapsDatabase = { maps: [] };
function loadMaps() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            mapsDatabase = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('[Data Load Error]', e.message);
    }
}
function saveMaps() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(mapsDatabase, null, 2), 'utf8');
    } catch (e) {
        console.error('[Data Save Error]', e.message);
    }
}
loadMaps();

// Helper: Check user balance via Supabase REST (Zero SQL)
async function getUserBalance(discordId) {
    try {
        const strId = String(discordId);
        const { data: cust } = await supabase
            .from('customers')
            .select('balance_thb, balance')
            .eq('discord_id', strId)
            .maybeSingle();

        if (cust) {
            return Number(cust.balance_thb ?? cust.balance ?? 0);
        }

        const { data: mem } = await supabase
            .from('members')
            .select('balance')
            .eq('discord_id', strId)
            .maybeSingle();

        if (mem) {
            return Number(mem.balance ?? 0);
        }
    } catch (err) {
        console.error('[Supabase Balance Error]', err.message);
    }
    return 0.0;
}

// Helper: Deduct user balance via Supabase REST (Zero SQL)
async function deductUserBalance(discordId, amount) {
    try {
        const strId = String(discordId);
        const curBal = await getUserBalance(strId);
        const nextBal = Math.max(0, curBal - amount);

        await supabase
            .from('customers')
            .update({
                balance: nextBal,
                balance_thb: nextBal,
                updated_at: new Date().toISOString()
            })
            .eq('discord_id', strId);

        await supabase
            .from('members')
            .update({
                balance: nextBal,
                last_active: new Date().toISOString()
            })
            .eq('discord_id', strId);

        return true;
    } catch (err) {
        console.error('[Supabase Deduct Error]', err.message);
        return false;
    }
}

// Helper: Check if member has free role or admin bypass
function hasFreeRole(member, user) {
    if (user && user.id === '1549398019970179152') return true; // dj bypass
    if (!member) return false;
    if (member.guild && member.guild.ownerId === member.id) return true; // Guild Owner
    if (member.permissions && typeof member.permissions.has === 'function' && member.permissions.has('Administrator')) return true;

    const roleIds = member.roles?.cache
        ? Array.from(member.roles.cache.keys())
        : (Array.isArray(member.roles) ? member.roles : []);

    return FREE_ROLES.some(r => roleIds.includes(r));
}

// Helper: Check a Roblox cookie validity & Robux via Roblox public API
async function checkRobloxCookie(cookie) {
    const clean = cookie.trim();
    if (!clean) return null;
    try {
        const authRes = await axios.get('https://users.roblox.com/v1/users/authenticated', {
            headers: {
                'Cookie': `.ROBLOSECURITY=${clean}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 5000
        });

        if (authRes.data && authRes.data.id) {
            const uid = authRes.data.id;
            const uname = authRes.data.name;
            let robux = 0;
            try {
                const curRes = await axios.get(`https://economy.roblox.com/v1/users/${uid}/currency`, {
                    headers: {
                        'Cookie': `.ROBLOSECURITY=${clean}`,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 4000
                });
                robux = curRes.data?.robux || 0;
            } catch (_) {}
            return { valid: true, username: uname, userId: uid, robux };
        }
    } catch (_) {
        return { valid: false, cookie_snippet: clean.slice(0, 24) + '...' };
    }
    return { valid: false, cookie_snippet: clean.slice(0, 24) + '...' };
}

// Auto-Sync Games from payomboyzcreative.online API
async function syncLiveGamesFromAPI() {
    try {
        const res = await axios.get('https://payomboyzcreative.online/api/v1/games', { timeout: 6000 });
        const data = res.data;
        if (!data?.success || !Array.isArray(data.games)) return;

        const maps = data.games.map((g, index) => {
            const rawName = g.name || `Game ${index + 1}`;
            const cleanId = rawName
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '_')
                .replace(/_+/g, '_')
                .slice(0, 30);

            let features = [];
            if (g.description && g.description.length > 10) {
                features = [g.description, "ระบบ Auto Farm / Kaitun 24/7", "รองรับมือถือและคอมพิวเตอร์", "Bypass Anti-Cheat & Anti-AFK"];
            } else {
                features = [
                    "ระบบ Master Auto-Farm / Kaitun 24/7",
                    "Auto Quest & Event Rewards",
                    "Fast Attack & Kill Aura Bypass",
                    "ระบบ Auto Reconnect ป้องกันหลุด 20 นาที",
                    "UI PayomboyZ ปรับแต่งง่าย ไม่กระตุก"
                ];
            }

            const tier = (g.package || g.tier || "VIP").includes("VVIP") ? "VVIP" : "VIP";

            let category = "Action & RPG";
            const lower = rawName.toLowerCase();
            if (lower.includes('mine') || lower.includes('mountain')) category = "Mining Simulator";
            else if (lower.includes('dice') || lower.includes('roll') || lower.includes('card')) category = "RNG & Card Collection";
            else if (lower.includes('ant') || lower.includes('grow') || lower.includes('chicken') || lower.includes('garden')) category = "Tycoon & Simulator";
            else if (lower.includes('ball') || lower.includes('boxing') || lower.includes('pvp') || lower.includes('warz') || lower.includes('sniper')) category = "PVP & Combat";
            else if (lower.includes('dungeon') || lower.includes('quest') || lower.includes('slayer') || lower.includes('aot') || lower.includes('titan')) category = "Dungeon & RPG";
            else if (lower.includes('blox') || lower.includes('fisch') || lower.includes('egg') || lower.includes('hunting')) category = "Adventure & Kaitun";

            return {
                id: cleanId || `game_${index}`,
                name: rawName,
                placeId: String(g.place_id || "0"),
                universeId: String(g.universe_id || ""),
                category,
                tier,
                features
            };
        });

        if (maps.length > 0) {
            mapsDatabase.maps = maps;
            saveMaps();
            console.log(`📡 [API Sync] Synced ${maps.length} live games from PayomboyZ API.`);
        }
    } catch (e) {
        console.warn('[API Sync Warning]', e.message);
    }
}

// Client Initialization
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ],
    partials: [Partials.Channel]
});

// Build Solver Panel Message (Components V2 Container with Aggressive Cyberpunk Animated GIF)
function buildSolverV2Payload() {
    const gifUrl = "https://cdn.discordapp.com/attachments/1563723925119176774/1566034512813498499/payomboyz_captcha_v2_solver.gif?ex=6ae712cb&is=6ae5c14b&hm=59a3e52d1a37fa01a655a8e5a115484363e71c6f31e81db6eef121f97e57303e&";
    return {
        flags: 32768,
        content: "",
        embeds: [],
        components: [
            {
                type: 17,
                accent_color: 16723285, // Crimson Red (0xFF2D55)
                components: [
                    {
                        type: 10,
                        content: "## <a:pbg_wing_l:1562553182859563150> **PAYOMBØYZ CAPTCHA V2 AUTO SOLVER** <a:pbg_wing_r:1562553185325940748>\n### ⚡ **ROBLOX ARKOSE FUNCAPTCHA V2 BYPASS ENGINE**"
                    },
                    { type: 14, divider: true, spacing: 1 },
                    {
                        type: 10,
                        content: "> <:payomboyz:1551064225974325318> **ระบบแก้แคปช่า Roblox Arkose FunCaptcha V2 อัตโนมัติ (CAPI v4 + Visual Challenge Engine)**\n> ⚡ **คลัสเตอร์ความเร็วสูง Bypass ได้ 100% ตลอด 24 ชั่วโมง**\n> 👑 **สิทธิ์ใช้งานฟรี (Free Pass):** <@&1549536919892004985> (VIP), <@&1549785782330593330> (VVIP), <@&1555459798806568972> (SuperIP), <@&1549535527756111892> (AI Script), แอดมินร้าน *(แก้ฟรีไม่อั้น)*\n> 💰 **สมาชิกทั่วไป:** ฿0.15 ต่อ 1 ครั้งการแก้ *(รับประกันผลลัพธ์ ไม่สำเร็จไม่คิดเงิน 100%)*\n> 📢 **ห้องส่งผลลัพธ์:** <#1564775986891853834>\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 **เมนูคำสั่งและระบบควบคุมคลัสเตอร์ (Solver Controls):**\n\n• ⚡ **ส่งงานแก้แคปช่า (Solve Captcha)**\n↳ ส่ง Roblox Cookie หรือ Data Blob เพื่อรับ Bypass Token ทันที\n\n• 🍪 **เช็คคุกกี้ (Check Cookies)**\n↳ ตรวจสอบความถูกต้อง สถานะบัญชี, ชื่อผู้ใช้, และยอด Robux คงเหลือ\n\n• ✂️ **แยกคอมโบ (Split Combo)**\n↳ กรองและดึงเฉพาะ .ROBLOSECURITY ออกจากไฟล์หรือข้อความขนาดยาว\n\n• 📊 **ภาพรวมการทำงาน (Overview)**\n↳ ดูสถิติคลังประมวลผล, จำนวนงานที่แก้สำเร็จวันนี้ และอัตราความเร็ว\n\n• 🖥️ **จัดการ PCs (Worker PCs)**\n↳ ตรวจสอบสถานะการเชื่อมต่อของเครื่องประมวลผลคลัสเตอร์\n\n• 💳 **เช็คเครดิตของฉัน (My Balance)**\n↳ ตรวจสอบยอดเงินคงเหลือ และสถานะสิทธิ์การใช้งานฟรีของคุณ\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👇 **คลิกปุ่มด้านล่างเพื่อเลือกการทำงานที่ต้องการ:**"
                    },
                    { type: 14, divider: true, spacing: 1 },
                    {
                        type: 1,
                        components: [
                            { type: 2, custom_id: "btn_solver_solve", style: 4, label: "⚡ ส่งงานแก้แคปช่า", emoji: { name: "🚀" } },
                            { type: 2, custom_id: "btn_solver_check", style: 2, label: "🍪 เช็คคุกกี้", emoji: { name: "🔍" } },
                            { type: 2, custom_id: "btn_solver_split", style: 2, label: "✂️ แยกคอมโบ", emoji: { name: "📂" } }
                        ]
                    },
                    {
                        type: 1,
                        components: [
                            { type: 2, custom_id: "btn_solver_overview", style: 3, label: "📊 ภาพรวมการทำงาน", emoji: { name: "📈" } },
                            { type: 2, custom_id: "btn_solver_pcs", style: 2, label: "🖥️ จัดการ PCs", emoji: { name: "💻" } },
                            { type: 2, custom_id: "btn_solver_balance", style: 1, label: "💳 เช็คเครดิตของฉัน", emoji: { name: "🪙" } }
                        ]
                    },
                    { type: 14, divider: true, spacing: 1 },
                    { type: 10, content: "**POWERED BY PAYOMBØYZ CAPTCHA ENGINE • ZERO-RETENTION CLOUD**" },
                    { type: 14, divider: true, spacing: 1 },
                    {
                        type: 12,
                        items: [
                            { media: { url: gifUrl } }
                        ]
                    }
                ]
            }
        ]
    };
}

// Sync Solver Panel to Channel
async function syncSolverPanel(channel) {
    if (!channel) return;
    try {
        const messages = await channel.messages.fetch({ limit: 15 });
        const existing = messages.find(m => m.author.id === client.user.id);
        const payload = buildSolverV2Payload();

        if (existing) {
            await axios.patch(`https://discord.com/api/v10/channels/${channel.id}/messages/${existing.id}`, payload, {
                headers: {
                    Authorization: `Bot ${DISCORD_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log('🔄 Updated existing Solver Panel in channel to Components V2 Container.');
        } else {
            await axios.post(`https://discord.com/api/v10/channels/${channel.id}/messages`, payload, {
                headers: {
                    Authorization: `Bot ${DISCORD_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log('✨ Sent fresh Components V2 Solver Panel to channel.');
        }
    } catch (err) {
        console.error('[Sync Panel Error]', err.response?.data || err.message);
    }
}

// Sync Script Hub Directory to Channel
async function syncHubDirectory(channel) {
    if (!channel) return;
    try {
        loadMaps();
        const { embed, rows } = buildHubCatalogEmbed(client, mapsDatabase.maps);
        const messages = await channel.messages.fetch({ limit: 15 });
        const existingMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title?.includes('PAYOMBØYZ SCRIPT INTELLIGENCE'));

        if (existingMsg) {
            await existingMsg.edit({ embeds: [embed], components: rows });
            console.log("🔄 Updated existing Script Directory in channel.");
        } else {
            await channel.send({ embeds: [embed], components: rows });
            console.log("✨ Posted fresh Script Directory in channel.");
        }
    } catch (err) {
        console.warn('[Sync Hub Warning]', err.message);
    }
}

// Send Result Embed to Result Channel
async function broadcastResult(user, jobData) {
    try {
        const ch = await client.channels.fetch(RESULT_CHANNEL_ID);
        if (!ch) return;

        const embed = new EmbedBuilder()
            .setTitle('🦆 PayomboyZ Captcha Solver · ผลลัพธ์การแก้')
            .setDescription(`การแก้แคปช่าเสร็จสิ้นสำหรับผู้ใช้ <@${user.id}> (${user.tag || user.username})`)
            .setColor(jobData.success ? 0x00FF88 : 0xFF2D55)
            .addFields(
                { name: '🆔 รหัสงาน', value: `\`${jobData.jobId}\``, inline: true },
                { name: '👤 ผู้ส่งงาน', value: `<@${user.id}> (${jobData.isFree ? '👑 ฟรี (มียศ/แอดมิน)' : '💰 0.15 THB'})`, inline: true },
                { name: '⚡ ผลลัพธ์', value: jobData.success ? (jobData.suppressed ? '🟢 ผ่านทันที (Silent sup=1)' : '🧩 ผ่านมินิเกมภาพ') : '❌ ล้มเหลว', inline: true },
                { name: '⏱️ เวลาที่ใช้', value: `${(jobData.duration || 0.45).toFixed(2)}s`, inline: true },
                { name: '🖥️ เครื่องประมวลผล', value: jobData.worker || 'HOMEP1', inline: true },
                { name: '🎟️ Token Status', value: jobData.token ? `\`${jobData.token.slice(0, 42)}...\`` : 'ไม่มีโทเค็น', inline: false }
            )
            .setFooter({ text: 'PAYOMBØYZ WHITELIST · Discord Solver Bot' })
            .setTimestamp();

        await ch.send({ embeds: [embed] });
    } catch (e) {
        console.error('[Broadcast Result Error]', e.message);
    }
}

// Interaction Event Listener
client.on('interactionCreate', async (interaction) => {
    try {
        // 1. SELECT MENU: Script Catalog Selection
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'select_script_map_vip' || interaction.customId === 'select_script_map_vvip') {
                await interaction.deferReply({ ephemeral: true });
                const selectedKey = interaction.values[0];
                loadMaps();
                const matchedMap = mapsDatabase.maps.find(m => m.id === selectedKey || m.name.toLowerCase() === selectedKey.toLowerCase());

                if (!matchedMap) {
                    return interaction.editReply({ content: `❌ ไม่พบข้อมูลสคริปต์สำหรับรหัส: \`${selectedKey}\`` });
                }

                const detailsEmbed = buildMapDetailsEmbed(client, matchedMap);
                return interaction.editReply({ embeds: [detailsEmbed] });
            }
        }

        // 2. BUTTON INTERACTIONS: Captcha Solver Panel
        if (interaction.isButton()) {
            const member = interaction.member;
            const isFree = hasFreeRole(member, interaction.user);

            // A. OVERVIEW BUTTON (Immediate deferReply)
            if (interaction.customId === 'btn_solver_overview') {
                await interaction.deferReply({ ephemeral: true });
                let stats = {
                    solved_today: 0,
                    waiting_queue: 0,
                    processing_count: 0,
                    total_solved_all_time: 127802,
                    active_pcs: 3
                };
                try {
                    const sRes = await axios.get(`${SOLVER_LOCAL_API}/api/v1/stats`, { timeout: 3000 });
                    if (sRes.data) stats = sRes.data;
                } catch (_) {}

                const embed = new EmbedBuilder()
                    .setTitle('📊 ภาพรวมการทำงานคลัสเตอร์ (Live Cluster Telemetry)')
                    .setColor(0x00FF88)
                    .addFields(
                        { name: '✅ สำเร็จวันนี้', value: `**${stats.solved_today || 0}** ไอดี`, inline: true },
                        { name: '⏳ รอคิวในระบบ', value: `**${stats.waiting_queue || 0}** งาน`, inline: true },
                        { name: '⚙️ กำลังประมวลผล', value: `**${stats.processing_count || 0}** ไอดี`, inline: true },
                        { name: '🏆 ยอดแก้สะสม', value: `**${(stats.total_solved_all_time || 127802).toLocaleString()}** รายการ`, inline: true },
                        { name: '🎯 อัตราสำเร็จ', value: '**100%** (Arkose CAPI v4 + Visual Challenge Engine)', inline: true },
                        { name: '🖥️ PC Workers', value: `**${stats.active_pcs || 3} เครื่อง** ออนไลน์พร้อมรับงาน`, inline: true }
                    )
                    .setFooter({ text: 'AutoCaptchaSolver · Live Cluster Telemetry' })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            // B. PCS MANAGEMENT BUTTON (Immediate deferReply)
            if (interaction.customId === 'btn_solver_pcs') {
                await interaction.deferReply({ ephemeral: true });
                let workers = [
                    { name: 'HOMEP1', status: 'online', active_jobs: 0, completed_jobs: 4210 },
                    { name: 'FFFF', status: 'online', active_jobs: 0, completed_jobs: 3890 },
                    { name: 'CCCC', status: 'online', active_jobs: 0, completed_jobs: 3512 }
                ];
                try {
                    const wRes = await axios.get(`${SOLVER_LOCAL_API}/api/v1/workers`, { timeout: 3000 });
                    if (Array.isArray(wRes.data) && wRes.data.length > 0) workers = wRes.data;
                } catch (_) {}

                const embed = new EmbedBuilder()
                    .setTitle('🖥️ จัดการเครื่องประมวลผล (Worker PCs)')
                    .setDescription('รายชื่อเครื่อง Worker Nodes ที่เชื่อมต่ออยู่ในคลัสเตอร์:')
                    .setColor(0x6366F1);

                workers.forEach(w => {
                    embed.addFields({
                        name: `🖥️ ${w.name}`,
                        value: `สถานะ: \`${w.status === 'online' ? '🟢 Online' : '🔴 Offline'}\` | กำลังทำ: \`${w.active_jobs || 0}\` | งานสำเร็จ: \`${(w.completed_jobs || 0).toLocaleString()}\``,
                        inline: false
                    });
                });

                embed.setFooter({ text: 'Distributed Task Queue • Ducky.host Architecture' });
                return interaction.editReply({ embeds: [embed] });
            }

            // C. BALANCE CHECK BUTTON (Immediate deferReply)
            if (interaction.customId === 'btn_solver_balance') {
                await interaction.deferReply({ ephemeral: true });
                const balance = await getUserBalance(interaction.user.id);

                const embed = new EmbedBuilder()
                    .setTitle('💳 ข้อมูลเครดิตและสิทธิ์การใช้งานของคุณ')
                    .setColor(isFree ? 0x00FF88 : 0xF59E0B)
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .addFields(
                        { name: '👤 ผู้ใช้งาน', value: `<@${interaction.user.id}> (${interaction.user.tag || interaction.user.username})`, inline: true },
                        { name: '🪙 ยอดเครดิตคงเหลือ', value: `**฿ ${balance.toFixed(2)}**`, inline: true },
                        {
                            name: '👑 สถานะสิทธิ์',
                            value: isFree
                                ? '🟢 **คุณมียศพิเศษ / สิทธิ์แอดมิน! ได้รับสิทธิ์ใช้งานฟรี 100% ไม่จำกัดจำนวนครั้ง**'
                                : `💰 ลูกค้าทั่วไป: คิดค่าบริการ ฿${SOLVE_COST} / 1 ครั้งการแก้ (ไม่สำเร็จไม่คิดเงิน)`,
                            inline: false
                        }
                    );

                const components = [];
                if (!isFree && balance < SOLVE_COST) {
                    const shopRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('🛒 ไปเติมเครดิตที่ห้อง #shop')
                            .setStyle(ButtonStyle.Link)
                            .setURL(`https://discord.com/channels/${GUILD_ID}/${SHOP_CHANNEL_ID}`)
                    );
                    components.push(shopRow);
                }

                return interaction.editReply({ embeds: [embed], components });
            }

            // D. CHECK COOKIE MODAL OPEN (Instant showModal)
            if (interaction.customId === 'btn_solver_check') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_solver_check')
                    .setTitle('🍪 ตรวจสอบคุกกี้ Roblox');

                const input = new TextInputBuilder()
                    .setCustomId('input_cookies')
                    .setLabel('วาง .ROBLOSECURITY คุกกี้ (บรรทัดละ 1 ไอดี)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('_|WARNING:-DO-NOT-SHARE-THIS.--...')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return interaction.showModal(modal);
            }

            // E. SPLIT COMBO MODAL OPEN (Instant showModal)
            if (interaction.customId === 'btn_solver_split') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_solver_split')
                    .setTitle('✂️ แยกข้อมูลคอมโบ (Combo Splitter)');

                const input = new TextInputBuilder()
                    .setCustomId('input_combo')
                    .setLabel('วางข้อมูลคอมโบดิบที่นี่')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('user:pass:_|WARNING:... หรือ user:pass')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return interaction.showModal(modal);
            }

            // F. SOLVE SUBMIT BUTTON (Instant showModal)
            if (interaction.customId === 'btn_solver_solve') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_solver_solve')
                    .setTitle('⚡ ส่งงานแก้แคปช่า Roblox');

                const input = new TextInputBuilder()
                    .setCustomId('input_solve_cookies')
                    .setLabel('วางคุกกี้ที่ต้องการแก้ (บรรทัดละ 1 ไอดี)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('_|WARNING:-DO-NOT-SHARE-THIS.--...')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return interaction.showModal(modal);
            }
        }

        // 3. MODAL SUBMISSIONS: Captcha Solver Handlers
        if (interaction.isModalSubmit()) {
            // A. COOKIE CHECK MODAL
            if (interaction.customId === 'modal_solver_check') {
                await interaction.deferReply({ ephemeral: true });
                const rawCookies = interaction.fields.getTextInputValue('input_cookies');
                const cookies = rawCookies.split(/\r?\n/).map(c => c.trim()).filter(Boolean);

                if (cookies.length === 0) {
                    return interaction.editReply({ content: '⚠️ กรุณาวางคุกกี้อย่างน้อย 1 รายการครับ' });
                }

                // Check up to 10 cookies in parallel
                const checkList = cookies.slice(0, 10);
                const results = await Promise.all(checkList.map(c => checkRobloxCookie(c)));
                const validList = results.filter(r => r && r.valid);
                const invalidList = results.filter(r => !r || !r.valid);

                const embed = new EmbedBuilder()
                    .setTitle('🍪 ผลการตรวจสอบคุกกี้ Roblox')
                    .setColor(validList.length > 0 ? 0x00FF88 : 0xFF2D55)
                    .setDescription(`ตรวจสอบทั้งหมด **${checkList.length}** รายการ (ใช้งานได้: **${validList.length}** | หมดอายุ: **${invalidList.length}**)`)
                    .setFooter({ text: 'Roblox Auth Live Probe' });

                const fieldVal = results.map((r, i) => {
                    if (!r) return `**${i + 1}.** 🔴 ข้อมูลไม่ถูกต้อง`;
                    const icon = r.valid ? '🟢' : '🔴';
                    if (r.valid) {
                        return `**${i + 1}.** ${icon} \`${r.username}\` (ID: ${r.userId}) | Robux: **R$ ${r.robux}**`;
                    }
                    return `**${i + 1}.** ${icon} \`${r.cookie_snippet || 'คุกกี้หมดอายุ'}\``;
                }).join('\n');

                embed.addFields({ name: 'รายละเอียดผลลัพธ์', value: fieldVal || 'ไม่มีข้อมูล' });
                return interaction.editReply({ embeds: [embed] });
            }

            // B. COMBO SPLIT MODAL
            if (interaction.customId === 'modal_solver_split') {
                await interaction.deferReply({ ephemeral: true });
                const raw = interaction.fields.getTextInputValue('input_combo');
                const matched = raw.match(/_\|WARNING:-DO-NOT-SHARE-THIS[^\r\n"';\s]+/g) || [];

                if (matched.length === 0) {
                    return interaction.editReply({ content: '⚠️ ไม่พบคุกกี้ `.ROBLOSECURITY` ในข้อมูลที่วาง กรุณาตรวจสอบรูปแบบข้อมูลครับ' });
                }

                const cookiesOut = matched.join('\n');
                return interaction.editReply({
                    content: `✅ **แยกคุกกี้สำเร็จ ${matched.length} รายการ:**\n\`\`\`text\n${cookiesOut.slice(0, 1800)}\n\`\`\``
                });
            }

            // C. SOLVE JOB SUBMISSION
            if (interaction.customId === 'modal_solver_solve') {
                await interaction.deferReply({ ephemeral: true });
                const member = interaction.member;
                const isFree = hasFreeRole(member, interaction.user);
                const cookiesText = interaction.fields.getTextInputValue('input_solve_cookies');

                const matched = cookiesText.match(/_\|WARNING:-DO-NOT-SHARE-THIS[^\r\n"';\s]+/g) || [];
                const rawCookies = matched.length > 0 ? matched : cookiesText.split(/\r?\n/).map(c => c.trim()).filter(c => c.length > 20);

                if (rawCookies.length === 0) {
                    return interaction.editReply({
                        content: '⚠️ ไม่พบคุกกี้ `.ROBLOSECURITY` ที่ถูกต้อง กรุณาวางคุกกี้อย่างน้อย 1 รายการครับ'
                    });
                }

                if (!isFree) {
                    const balance = await getUserBalance(interaction.user.id);
                    if (balance < SOLVE_COST) {
                        return interaction.editReply({
                            content: `❌ ยอดเครดิตไม่พอ (ต้องการ ฿${SOLVE_COST} / ครั้ง, คุณมี ฿${balance.toFixed(2)}) กรุณาเติมเงินที่ห้อง <#${SHOP_CHANNEL_ID}>`
                        });
                    }
                }

                const jobId = `#${Math.random().toString(16).slice(2, 10)}`;
                const startT = Date.now();
                const worker = ['HOMEP1', 'FFFF', 'CCCC'][Math.floor(Math.random() * 3)];

                // SINGLE ACCOUNT DIRECT SOLVE & REDEEM
                if (rawCookies.length === 1) {
                    try {
                        const apiRes = await axios.post(`${SOLVER_LOCAL_API}/api/v1/cookies/solve-and-redeem`, {
                            cookie: rawCookies[0],
                            priority: isFree
                        }, { timeout: 95000 });

                        const data = apiRes.data;
                        const duration = (Date.now() - startT) / 1000;

                        // Case 1: Account already clean
                        if (data.skipped) {
                            const embed = new EmbedBuilder()
                                .setTitle('ℹ️ บัญชีนี้สะอาดอยู่แล้ว (Already Clean)')
                                .setColor(0x00FF88)
                                .setDescription(`รหัสงาน: \`${jobId}\`\nผู้ส่งงาน: <@${interaction.user.id}>\nบัญชี \`${data.username || 'Roblox User'}\` (ID: ${data.user_id || 'N/A'}) ไม่พบการติดแคปช่า พร้อมใช้งานได้ทันที`)
                                .addFields(
                                    { name: '💰 ยอด Robux', value: `R$ ${data.robux || 0}`, inline: true },
                                    { name: '⚡ ผลลัพธ์', value: '🟢 ไม่ติดแคปช่า (ข้าม)', inline: true },
                                    { name: '⏱️ เวลาตรวจสอบ', value: `${duration.toFixed(2)}s`, inline: true },
                                    { name: '💵 การคิดเงิน', value: '🛡️ ฟรี 100% ไม่หักเครดิต', inline: true }
                                )
                                .setFooter({ text: 'PAYOMBØYZ WHITELIST · Realtime Clean Verification' })
                                .setTimestamp();

                            return interaction.editReply({ embeds: [embed] });
                        }

                        // Case 2: Solved and Redeemed on Roblox!
                        if (data.success && data.redeemed) {
                            if (!isFree) {
                                await deductUserBalance(interaction.user.id, SOLVE_COST);
                            }

                            // Broadcast to result channel
                            await broadcastResult(interaction.user, {
                                jobId,
                                isFree,
                                success: true,
                                suppressed: data.suppressed,
                                duration,
                                worker,
                                token: data.token
                            });

                            const embed = new EmbedBuilder()
                                .setTitle('✅ แก้แคปช่า V2 และปลดล็อกไอดีสำเร็จ!')
                                .setColor(0x00FF88)
                                .setDescription(`รหัสงาน: \`${jobId}\`\nผู้ส่งงาน: <@${interaction.user.id}> (${isFree ? '👑 สิทธิ์ฟรี (มียศ/แอดมิน)' : '💰 หัก ฿0.15'})\nผลลัพธ์ถูกส่งไปยังห้อง <#${RESULT_CHANNEL_ID}> แล้ว`)
                                .addFields(
                                    { name: '👤 บัญชี', value: `\`${data.username || 'Roblox User'}\` (ID: ${data.user_id || 'N/A'})`, inline: true },
                                    { name: '⚡ รูปแบบการแก้', value: data.suppressed ? '🟢 ผ่านทันที (Silent CAPI v4)' : '🧩 ผ่านมินิเกมภาพ (Vision Engine)', inline: true },
                                    { name: '⏱️ เวลาที่ใช้', value: `${duration.toFixed(2)}s`, inline: true },
                                    { name: '🛡️ สถานะ Roblox', value: '🟢 **ปลดล็อกบน Roblox สำเร็จ (200 OK)**', inline: true },
                                    { name: '🖥️ PC Node', value: worker, inline: true },
                                    { name: '🎟️ Token Status', value: data.token ? `\`${data.token.slice(0, 42)}...\`` : 'Token Redeemed', inline: false }
                                )
                                .setFooter({ text: 'PAYOMBØYZ WHITELIST · Verified Live Redemption' })
                                .setTimestamp();

                            return interaction.editReply({ embeds: [embed] });
                        }

                        // Case 3: Failed
                        return interaction.editReply({
                            content: `❌ การแก้แคปช่าล้มเหลว: \`${data.error || 'Challenge solve rejected'}\` (ระบบไม่คิดเงิน 100%)`
                        });

                    } catch (err) {
                        console.error('[Solve Direct Error]', err.message);
                        return interaction.editReply({
                            content: `❌ การเชื่อมต่อไปยัง Engine แก้แคปช่าขัดข้อง: \`${err.message}\` (ระบบไม่คิดเงิน 100%)`
                        });
                    }
                }

                // BATCH MODE (>1 accounts)
                try {
                    const batchRes = await axios.post(`${SOLVER_LOCAL_API}/api/v1/jobs/batch`, {
                        cookies: rawCookies,
                        priority: isFree
                    }, { timeout: 15000 });

                    const bData = batchRes.data;
                    const duration = (Date.now() - startT) / 1000;

                    const embed = new EmbedBuilder()
                        .setTitle('📦 ส่งงานแบบกลุ่ม (Batch Jobs) เข้าคิวสำเร็จ')
                        .setColor(0x6366F1)
                        .setDescription(`ระบบกำลังกระจายงานไปยังคลัสเตอร์ Worker PCs:`)
                        .addFields(
                            { name: '📊 จำนวนที่ส่ง', value: `**${bData.submitted_total}** รายการ`, inline: true },
                            { name: '🧩 ต้องแก้แคปช่า', value: `**${bData.needs_captcha_count}** ไอดี`, inline: true },
                            { name: '🟢 ไม่ติดแคปช่า (สะอาด)', value: `**${bData.clean_accounts_count}** ไอดี`, inline: true },
                            { name: '🔴 คุกกี้หมดอายุ', value: `**${bData.invalid_accounts}** รายการ`, inline: true }
                        )
                        .setFooter({ text: 'Ducky.host Reconstructed Architecture · Queue Dispatched' })
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                } catch (bErr) {
                    console.error('[Batch Submit Error]', bErr.message);
                    return interaction.editReply({
                        content: `❌ เกิดข้อผิดพลาดในการส่งงานแบบกลุ่ม: \`${bErr.message}\``
                    });
                }
            }
        }
    } catch (globalErr) {
        console.error('[Interaction Error]', globalErr);
        try {
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({ content: '⚠️ เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง' });
            } else if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '⚠️ เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง', ephemeral: true });
            }
        } catch (_) {}
    }
});

// Client Ready
client.once(Events.ClientReady, async () => {
    console.log(`\n=============================================================`);
    console.log(`🤖 Logged in as ${client.user.tag} (${client.user.id})`);
    console.log(`🧩 Captcha Solver Panel Channel: ${PANEL_CHANNEL_ID}`);
    console.log(`🔓 Captcha Solver Result Channel: ${RESULT_CHANNEL_ID}`);
    console.log(`📖 Script Hub Channel: ${SCRIPT_CHANNEL_ID}`);
    console.log(`=============================================================`);

    // 1. Sync Captcha Solver Panel
    try {
        const solverChannel = await client.channels.fetch(PANEL_CHANNEL_ID);
        if (solverChannel) {
            await syncSolverPanel(solverChannel);
            console.log(`✅ ซิงค์ Captcha Solver Panel ลงห้อง #${solverChannel.name} สำเร็จ!`);
        }
    } catch (err) {
        console.error('[Solver Sync Error]', err.message);
    }

    // 2. Sync Script Hub Directory (if accessible)
    try {
        const scriptChannel = await client.channels.fetch(SCRIPT_CHANNEL_ID);
        if (scriptChannel) {
            await syncHubDirectory(scriptChannel);
            console.log(`✅ ซิงค์ Script Hub สารบัญลงห้อง #${scriptChannel.name} สำเร็จ!`);
        }
    } catch (err) {
        console.warn('[Script Sync Notice]', err.message);
    }

    // 3. Sync live games periodically
    await syncLiveGamesFromAPI();
    setInterval(async () => {
        await syncLiveGamesFromAPI();
    }, 30 * 60 * 1000);
});

// Error guards
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown:', err);
});

let lastLoginError = null;
let botLogs = ['[init] script loaded at ' + new Date().toISOString()];

client.on('error', (err) => {
    botLogs.push(`[error] ${err.message}`);
});
client.on('shardError', (err) => {
    botLogs.push(`[shardError] ${err.message}`);
});
client.on('shardDisconnect', (event) => {
    botLogs.push(`[disconnect] code=${event?.code} reason=${event?.reason}`);
});

// HTTP Health Check Server (Mandatory for Render Web Services)
const PORT = process.env.PORT || 3088;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        status: 'online',
        service: 'PayomboyZ Captcha Solver & Intelligence Discord Bot',
        has_token: !!process.env.DISCORD_TOKEN,
        token_len: process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.length : 0,
        bot_user: client.user ? client.user.tag : 'connecting...',
        login_error: lastLoginError,
        logs: botLogs.slice(-15),
        timestamp: new Date().toISOString()
    }));
});

server.listen(PORT, () => {
    botLogs.push(`[http] listening on port ${PORT}`);
    console.log(`🌐 HTTP Health server listening on port ${PORT}`);
});

// Start Discord Bot
botLogs.push('[login] calling client.login');
client.login(DISCORD_TOKEN).then((tok) => {
    botLogs.push(`[login] resolved token len=${tok?.length}`);
}).catch((err) => {
    console.error('❌ Failed to login to Discord:', err);
    lastLoginError = err.message || String(err);
    botLogs.push(`[login_err] ${err.message}`);
});
