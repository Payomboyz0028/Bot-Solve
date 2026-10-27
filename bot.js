const { Client, GatewayIntentBits, Partials, SlashCommandBuilder, Routes, REST } = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const chokidar = require('chokidar');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { buildHubCatalogEmbed, buildMapDetailsEmbed, buildUpdateAlertEmbed } = require('./embedBuilder');
const { analyzeUpdateDiff, analyzeSingleScript, answerScriptQuestion } = require('./geminiAnalyzer');

// Configuration
const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || "1564763903504818357";
const DATA_FILE = path.join(__dirname, 'mapsData.json');
const SCRIPTS_DIR = path.resolve(__dirname, '..'); // Watch parent workspace directory

// Load Maps Data
let mapsDatabase = { maps: [] };
function loadMaps() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            mapsDatabase = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) {
        console.error("[Data Load Error]", e);
    }
}
function saveMaps() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(mapsDatabase, null, 2), 'utf8');
    } catch (e) {
        console.error("[Data Save Error]", e);
    }
}
loadMaps();

// Auto-Sync All Games from payomboyzcreative.online API
async function syncLiveGamesFromAPI() {
    try {
        console.log("📡 Syncing live games from https://payomboyzcreative.online/api/v1/games...");
        const res = await fetch('https://payomboyzcreative.online/api/v1/games');
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success || !Array.isArray(data.games)) return;

        const maps = data.games.map((g, index) => {
            const rawName = g.name || `Game ${index + 1}`;
            const cleanId = rawName
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '_')
                .replace(/_+/g, '_')
                .slice(0, 30);

            let features = [];
            if (g.script_source_value) {
                const src = g.script_source_value;
                const featureMatches = src.match(/--\s*(?:\d+\.|\*|-)?\s*([^\r\n]{10,80})/g);
                if (featureMatches) {
                    const cleaned = featureMatches
                        .map(f => f.replace(/^--\s*(?:\d+\.|\*|-)?\s*/, '').trim())
                        .filter(f => !f.startsWith('==') && !f.startsWith('Target') && !f.startsWith('UniverseId') && !f.startsWith('PlaceId') && !f.startsWith('Features') && !f.includes('Loaded Successfully'))
                        .slice(0, 7);
                    if (cleaned.length > 0) features = cleaned;
                }
            }

            if (features.length === 0) {
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
                category: category,
                tier: tier,
                hotkey: tier === "VVIP" ? "RightControl / Mobile Button" : "RightShift / Mobile Button",
                features: features,
                imageUrl: g.image_url || null,
                coverUrl: g.cover_url || null
            };
        });

        mapsDatabase = { maps, total: maps.length, lastSync: new Date().toISOString() };
        saveMaps();
        console.log(`✅ Synced ${maps.length} live games from API into mapsDatabase.`);
    } catch (err) {
        console.error("[Live Games Sync Error]", err.message);
    }
}

// In-memory File Hashes & Cache
const fileHashMap = new Map();
const previousCodeMap = new Map();

// Map filename patterns to Game Names
const FILE_TO_GAME_MAP = {
    'anime dice': 'Anime Dice',
    'build an ant': 'Build An Ant Empire',
    'anime mine': 'My Anime Mine',
    'warz': 'WarZPVP OPEN BETA',
    'dungeon quest': 'HALLOWEEN Dungeon Quest Reborn',
    'blade ball': 'Blade Ball',
    'forge': '[BOSS]+1 Loot To Forge',
    'starrk': '[STARRK] Dungeon Lootr',
    'hunting': '[HALLOWEEN] Hunting Together',
    'ride a pet': '[EVENT] Ride A Pet',
    'blox fruit': 'Blox Fruits',
    'bfnew': 'Blox Fruits',
    'alliance tower': 'Alliance Tower Defense',
    'anime adventures': 'Anime Adventures',
    'capybara': 'Capybara Vs Plant'
};

function resolveGameFromFilename(filename) {
    const lower = filename.toLowerCase();
    for (const [key, gameName] of Object.entries(FILE_TO_GAME_MAP)) {
        if (lower.includes(key)) return gameName;
    }
    return null;
}

// Client Initialization
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

let pinnedCatalogMessageId = null;

// Deploy or Refresh Directory in Channel
async function syncHubDirectory(channel) {
    if (!channel) return;
    loadMaps();
    const { embed, rows } = buildHubCatalogEmbed(client, mapsDatabase.maps);

    // Look for previous bot message to edit instead of spamming
    try {
        const messages = await channel.messages.fetch({ limit: 15 });
        const existingMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title?.includes('PAYOMBØYZ SCRIPT INTELLIGENCE'));

        if (existingMsg) {
            await existingMsg.edit({ embeds: [embed], components: rows });
            pinnedCatalogMessageId = existingMsg.id;
            console.log("🔄 Updated existing Directory Embed with all 31 maps in channel.");
        } else {
            const newMsg = await channel.send({ embeds: [embed], components: rows });
            pinnedCatalogMessageId = newMsg.id;
            console.log("✨ Posted fresh Directory Embed with all 31 maps in channel.");
        }
    } catch (err) {
        console.error("[Sync Channel Error]", err);
    }
}

// Ready Event
client.once('ready', async () => {
    console.log(`\n=============================================================`);
    console.log(`⚡ PAYOMBØYZ SCRIPT INTELLIGENCE BOT ONLINE: ${client.user.tag}`);
    console.log(`📡 Connected Channel: ${CHANNEL_ID}`);
    console.log(`🧠 AI Engine: Gemini 2.5 Flash / 1.5 Flash Active`);
    console.log(`=============================================================`);

    const guilds = client.guilds.cache;
    console.log(`🏰 Joined Guilds (${guilds.size}):`);
    if (guilds.size === 0) {
        console.log(`⚠️  บอทยังไม่ได้ถูกเชิญเข้าเซิร์ฟเวอร์ Discord!`);
        console.log(`👉 คลิกเพื่อเชิญบอทเข้าดิส: https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&integration_type=0&scope=bot+applications.commands`);
    } else {
        guilds.forEach(g => console.log(`   - ${g.name} (ID: ${g.id})`));
    }

    // Sync live 31 games from website on startup
    await syncLiveGamesFromAPI();

    // Auto-refresh every 30 minutes
    setInterval(async () => {
        await syncLiveGamesFromAPI();
    }, 30 * 60 * 1000);

    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (channel) {
            await syncHubDirectory(channel);
            console.log(`✅ ซิงค์หน้าสารบัญลงห้อง #${channel.name} สำเร็จ!`);
        } else {
            console.warn(`[Warning] Could not access channel ${CHANNEL_ID}. Check bot permissions.`);
        }
    } catch (err) {
        console.error("[Channel Fetch Error]", err.message);
        if (err.message.includes("Missing Access")) {
            console.log(`👉 โปรดเชิญบอทเข้าเซิร์ฟเวอร์ หรือตรวจสอบสิทธิ์ของบอทในห้อง ${CHANNEL_ID}:`);
            console.log(`   https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&integration_type=0&scope=bot+applications.commands\n`);
        }
    }

    // Register Slash Commands
    registerSlashCommands();

    // Start Realtime File Watcher
    startScriptWatcher();

    // Auto-retry polling until directory message is successfully deployed
    const pollInterval = setInterval(async () => {
        if (pinnedCatalogMessageId) {
            clearInterval(pollInterval);
            return;
        }
        try {
            const ch = await client.channels.fetch(CHANNEL_ID).catch(() => null);
            if (ch) {
                await syncHubDirectory(ch);
                if (pinnedCatalogMessageId) {
                    console.log(`\n🚀 [SUCCESS] Pinned catalog panel successfully deployed to #${ch.name}!`);
                    clearInterval(pollInterval);
                }
            }
        } catch (e) {}
    }, 4000);
});

// Auto-sync when invited to a new server
client.on('guildCreate', async (guild) => {
    console.log(`🎉 บอทถูกเพิ่มเข้าเซิร์ฟเวอร์ใหม่: ${guild.name} (${guild.id})`);
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (channel) {
            await syncHubDirectory(channel);
            console.log(`✅ ซิงค์หน้าสารบัญอัตโนมัติลงห้อง #${channel.name}`);
        }
    } catch (e) {
        console.error("[GuildCreate Sync Error]", e.message);
    }
});

// Natural Language AI Question Answering in Chat
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const isTargetChannel = message.channelId === CHANNEL_ID;
    const isMentioned = message.mentions.has(client.user.id);

    // Respond if mentioned OR if user asks a question in the script channel
    if (!isTargetChannel && !isMentioned) return;

    const content = message.content.trim();
    if (!content) return;

    // Check if user is asking about scripts or maps
    const lower = content.toLowerCase();
    const queryKeywords = ['แมพ', 'สคริป', 'ทำไรได้', 'มีอะไรบ้าง', 'มีฟังชั่น', 'ฟังก์ชั่น', 'ช่วย', 'วิธีใช้', 'bot', 'script', 'map', 'what', 'how'];
    const hasScriptIntent = isMentioned || queryKeywords.some(kw => lower.includes(kw));

    if (!hasScriptIntent) return;

    loadMaps();

    // 1. Direct map match check
    const matchedMap = mapsDatabase.maps.find(m => {
        const mName = m.name.toLowerCase();
        const mKey = m.id.toLowerCase();
        return lower.includes(mName) || lower.includes(mKey) || mName.split(' ').some(w => w.length > 3 && lower.includes(w));
    });

    if (matchedMap) {
        // Send specific map embed
        const detailsEmbed = buildMapDetailsEmbed(client, matchedMap);
        await message.reply({
            content: `**[ PAYOMBØYZ AI INTELLIGENCE ]** ข้อมูลสคริปต์แมพ **${matchedMap.name}**`,
            embeds: [detailsEmbed]
        });
        return;
    }

    // 2. Fallback to Gemini AI natural language response
    try {
        await message.channel.sendTyping();
        const aiAnswer = await answerScriptQuestion(content, mapsDatabase.maps);
        if (aiAnswer) {
            await message.reply({
                content: `**[ PAYOMBØYZ AI ADVISOR ]**\n${aiAnswer}\n\n*💡 เคล็ดลับ: สามารถเลือกดูฟังก์ชั่นทุกแมพได้จากกล่องสารบัญด้านบน หรือพิมพ์ \`/map\`*`
            });
        }
    } catch (err) {
        console.error("[Message Create AI Error]", err);
    }
});

// Dropdown Interaction Handler (View Map Features)
client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('select_game_map')) {
            const selectedId = interaction.values[0];
            loadMaps();
            const mapData = mapsDatabase.maps.find(m => m.id === selectedId || m.name.toLowerCase().replace(/[^a-z0-9]/g, '_').includes(selectedId));

            if (!mapData) {
                return interaction.reply({ content: "❌ ไม่พบข้อมูลสคริปต์ของแมพนี้ในฐานข้อมูล", ephemeral: true });
            }

            const detailsEmbed = buildMapDetailsEmbed(client, mapData);
            // Reply ephemerally so the channel stays 100% clean and non-cluttered!
            return interaction.reply({ embeds: [detailsEmbed], ephemeral: true });
        }
    }

    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;
        if (commandName === 'refresh_hub') {
            await interaction.deferReply({ ephemeral: true });
            const channel = await client.channels.fetch(CHANNEL_ID);
            await syncHubDirectory(channel);
            return interaction.editReply("✅ รีเฟรชหน้าไดเรกทอรีสคริปต์ในห้องเรียบร้อยแล้ว!");
        }

        if (commandName === 'map') {
            const query = interaction.options.getString('name').toLowerCase();
            loadMaps();
            const match = mapsDatabase.maps.find(m => m.name.toLowerCase().includes(query) || m.placeId.includes(query));
            if (match) {
                const embed = buildMapDetailsEmbed(client, match);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            return interaction.reply({ content: `❌ ไม่พบข้อมูลเกมที่ตรงกับ "${query}"`, ephemeral: true });
        }
    }
});

// Realtime Script Watcher with Gemini AI Diff Engine
function startScriptWatcher() {
    console.log(`📂 Watching script directory: ${SCRIPTS_DIR} for file modifications...`);

    // Pre-hash existing files
    try {
        const files = fs.readdirSync(SCRIPTS_DIR);
        for (const file of files) {
            if (file.endsWith('.lua') || file.endsWith('.luau') || file.endsWith('.txt')) {
                const fullPath = path.join(SCRIPTS_DIR, file);
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const hash = crypto.createHash('md5').update(content).digest('hex');
                    fileHashMap.set(file, hash);
                    previousCodeMap.set(file, content);
                } catch (_) {}
            }
        }
    } catch (e) {
        console.error("[Watcher Init Error]", e);
    }

    const watcher = chokidar.watch(SCRIPTS_DIR, {
        ignored: [/(^|[\/\\])\../, '**/node_modules/**', '**/PayomboyZ-DiscordBot/**', '**/.git/**'],
        persistent: true,
        depth: 0,
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 1500,
            pollInterval: 100
        }
    });

    watcher.on('change', async (filePath) => {
        const filename = path.basename(filePath);
        if (!filename.endsWith('.lua') && !filename.endsWith('.luau') && !filename.endsWith('.txt')) return;
        if (filename.includes('bak') || filename.includes('test_')) return;

        let content = '';
        try {
            content = fs.readFileSync(filePath, 'utf8');
        } catch (e) {
            return;
        }

        const newHash = crypto.createHash('md5').update(content).digest('hex');
        const prevHash = fileHashMap.get(filename);

        if (prevHash === newHash) return; // Unchanged content
        fileHashMap.set(filename, newHash);

        const oldCode = previousCodeMap.get(filename) || '';
        previousCodeMap.set(filename, content);

        const gameName = resolveGameFromFilename(filename) || filename.replace(/\.(lua|luau|txt)$/, '');
        console.log(`\n🔔 [SCRIPT MODIFIED] ${filename} -> Detected Game: ${gameName}`);
        console.log(`🧠 Invoking Gemini AI to analyze new functions & diff...`);

        try {
            const updateAnalysis = await analyzeUpdateDiff(gameName, oldCode, content);
            if (updateAnalysis && updateAnalysis.has_changes) {
                // Update local maps database with new features
                const existingMap = mapsDatabase.maps.find(m => m.name.toLowerCase() === gameName.toLowerCase());
                if (existingMap && updateAnalysis.new_features && updateAnalysis.new_features.length > 0) {
                    for (const nf of updateAnalysis.new_features) {
                        if (!existingMap.features.includes(nf)) {
                            existingMap.features.unshift(nf);
                        }
                    }
                    if (existingMap.features.length > 8) existingMap.features = existingMap.features.slice(0, 8);
                    saveMaps();
                }

                // Post Announcement to Discord Channel
                const channel = await client.channels.fetch(CHANNEL_ID);
                if (channel) {
                    const alertEmbed = buildUpdateAlertEmbed(client, updateAnalysis);
                    await channel.send({ embeds: [alertEmbed] });
                    console.log(`✅ [Alert Posted] Successfully notified update for ${gameName} in #${channel.name}`);

                    // Refresh directory message
                    await syncHubDirectory(channel);
                }
            }
        } catch (err) {
            console.error("[Watcher AI Error]", err);
        }
    });
}

// Slash Commands Registration
async function registerSlashCommands() {
    if (!TOKEN) return;
    const commands = [
        new SlashCommandBuilder()
            .setName('map')
            .setDescription('ดูรายละเอียดฟังก์ชั่นสคริปต์ของเกมที่ต้องการ')
            .addStringOption(opt => opt.setName('name').setDescription('ชื่อแมพ หรือ Place ID').setRequired(true)),
        new SlashCommandBuilder()
            .setName('refresh_hub')
            .setDescription('รีเฟรชหน้าไดเรกทอรีของ Script Hub ในห้องนี้')
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        console.log("Registering slash commands...");
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log("✅ Slash commands registered.");
    } catch (e) {
        console.warn("[Slash Commands Warning]", e.message);
    }
}

// Error guards to ensure 24/7 uptime
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown:', err);
});

// Optional Lightweight HTTP Server for Cloud Hosting Health Checks (Render / Koyeb)
const PORT = process.env.PORT || 3000;
try {
    http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('PayomboyZ Bot is Online & Watching Scripts.');
    }).listen(PORT, () => {
        console.log(`🌐 Cloud Health Check Server running on port ${PORT}`);
    });
} catch (e) {
    // Port might be in use locally; non-fatal
}

// Login
if (!TOKEN || TOKEN === "YOUR_DISCORD_BOT_TOKEN_HERE") {
    console.log("\n⚠️ [DISCORD_TOKEN MISSING]");
    console.log("โปรดใส่ Discord Bot Token ของคุณในไฟล์ PayomboyZ-DiscordBot/.env เพื่อเริ่มทำงาน\n");
} else {
    client.login(TOKEN);
}
