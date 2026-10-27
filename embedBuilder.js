const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getEmoji } = require('./emojiHelper');

/**
 * สร้างหน้าต่างหลักของห้อง (Hub Directory & Interactive Dropdown)
 */
function buildHubCatalogEmbed(client, mapsList) {
    const wingL = getEmoji(client, 'pbg_wing_l', '🪽');
    const wingR = getEmoji(client, 'pbg_wing_r', '🪽');
    const ww = getEmoji(client, 'ww', '🟢');
    const time = getEmoji(client, 'time', '⏰');
    const hit = getEmoji(client, 'emojigg_Hit', '⚔️');
    const fire = getEmoji(client, 'anime_fire', '🔥');

    const embed = new EmbedBuilder()
        .setColor(0x00F0A8) // Cyan Neon / Obsidian
        .setTitle(`${wingL} PAYOMBØYZ SCRIPT INTELLIGENCE DIRECTORY ${wingR}`)
        .setDescription(
            `ศูนย์รวมข้อมูลฟังก์ชั่นสคริปต์และระบบอัจฉริยะ **PayomboyZ Script Hub**\n` +
            `ระบบขับเคลื่อนด้วย **Gemini AI** ตรวจจับการอัปเดตสคริปต์ของทุกแมพแบบเรียลไทม์\n\n` +
            `> ${ww} **สถานะเซิร์ฟเวอร์:** \`ONLINE 100%\`\n` +
            `> ${time} **แมพที่รองรับในฮับ:** \`${mapsList.length} เกม\` (VIP / VVIP)\n` +
            `> ${fire} **สถาปัตยกรรม:** \`Obsidian Glassmorphic 2 + AI Autonomous Reasoner\``
        )
        .addFields(
            {
                name: `${hit} วิธีดูฟังก์ชั่นในแต่ละแมพ`,
                value: `กดเลือกชื่อเกมที่ต้องการจาก **เมนูดรอปดาวน์ด้านล่าง** ระบบจะดึงรายละเอียดฟังก์ชั่น ปุ่มลัด และคำแนะนำของแมพนั้นออกมาให้อ่านทันที`,
                inline: false
            }
        )
        .setFooter({ text: "PAYOMBØYZ SCRIPT HUB • AUTOMATED BY CYBER-AI", iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    // สร้าง Dropdown Menu สูงสุด 25 รายการแรกต่อ 1 แถว (Discord Limit)
    const options = mapsList.slice(0, 25).map(m => ({
        label: m.name.slice(0, 50),
        description: `Place ID: ${m.placeId || 'Universal'} | ระดับ: ${m.tier}`,
        value: m.id || m.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 50),
        emoji: m.tier === 'VVIP' ? '👑' : '⚡'
    }));

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_game_map')
        .setPlaceholder('🎮 เลือกเกมที่ต้องการดูรายละเอียดฟังก์ชั่น...')
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return { embed, row };
}

/**
 * สร้าง Embed แสดงรายละเอียดฟังก์ชั่นของแมพที่ถูกเลือก
 */
function buildMapDetailsEmbed(client, mapData) {
    const wingL = getEmoji(client, 'pbg_wing_l', '🪽');
    const wingR = getEmoji(client, 'pbg_wing_r', '🪽');
    const target = getEmoji(client, 'emoji_48', '🎯');
    const fire = getEmoji(client, 'anime_fire', '🔥');
    const ww = getEmoji(client, 'ww', '🟢');
    const hit = getEmoji(client, 'emojigg_Hit', '⚔️');
    const lightning = getEmoji(client, 'hasake3', '⚡');
    const cat = getEmoji(client, 'catlove', '💖');

    const featureList = (mapData.features && mapData.features.length > 0)
        ? mapData.features.map(f => `• ${f}`).join('\n')
        : '• ฟังก์ชั่นกำลังถูกวิเคราะห์โดย AI...';

    const embed = new EmbedBuilder()
        .setColor(mapData.tier === 'VVIP' ? 0x9D00FF : 0x00A8FF)
        .setTitle(`${wingL} ${mapData.name} ${wingR}`)
        .setDescription(
            `> ${target} **Place ID:** \`${mapData.placeId || 'Universal'}\`\n` +
            `> ${fire} **สิทธิ์การใช้งาน:** \`${mapData.tier}\` (${mapData.zones || 'ทุกโซน'})\n` +
            `> ${ww} **สถานะสคริปต์:** \`${mapData.status || '🟢 ทำงานปกติ (Auto-Update)'}\``
        )
        .addFields(
            {
                name: `${hit} ฟังก์ชั่นการทำงานหลัก (Features List)`,
                value: featureList,
                inline: false
            },
            {
                name: `${lightning} การสั่งการและปุ่มลัด (Controls)`,
                value: `\`${mapData.hotkey || 'ควบคุมผ่านหน้าต่างเมนูหลัก หรือปุ่มลอยข้างจอ'}\``,
                inline: false
            }
        )
        .setFooter({ text: `PayomboyZ Hub • ${mapData.name}`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    return embed;
}

/**
 * สร้าง Embed เมื่อมีการอัปเดตฟังก์ชั่นใหม่ (Changelog Alert)
 */
function buildUpdateAlertEmbed(client, updateData) {
    const wingL = getEmoji(client, 'pbg_wing_l', '🪽');
    const wingR = getEmoji(client, 'pbg_wing_r', '🪽');
    const fire = getEmoji(client, 'anime_fire', '🔥');
    const hit = getEmoji(client, 'emojigg_Hit', '⚔️');
    const ww = getEmoji(client, 'ww', '🟢');
    const happy = getEmoji(client, 'Happy', '✨');
    const sukuna = getEmoji(client, 'Sukuna', '👹');

    const newFeatures = (updateData.new_features && updateData.new_features.length > 0)
        ? updateData.new_features.map(f => `• **${f}**`).join('\n')
        : '• ปรับปรุงโครงสร้างสคริปต์เพื่อความเสถียร';

    const improvements = (updateData.improvements && updateData.improvements.length > 0)
        ? updateData.improvements.map(i => `• ${i}`).join('\n')
        : '• อัปเดตการ Bypass Anti-Cheat';

    const embed = new EmbedBuilder()
        .setColor(0x00FF88) // Cyber Green
        .setTitle(`${wingL} SCRIPT UPDATED: ${updateData.map_name.toUpperCase()} ${wingR}`)
        .setDescription(
            `${fire} **ตรวจพบการอัปเดตสคริปต์ใหม่ลงระบบ PayomboyZ Hub!**\n` +
            `*${updateData.summary_th || 'ทีมงานได้ปล่อยฟังก์ชั่นใหม่และการปรับปรุงความเสถียรเรียบร้อยแล้ว'}*`
        )
        .addFields(
            {
                name: `${hit} ฟังก์ชั่นใหม่ที่เพิ่มเข้ามา (New Features)`,
                value: newFeatures,
                inline: false
            },
            {
                name: `${ww} การปรับปรุง / แก้ไขบั๊ก (Patches)`,
                value: improvements,
                inline: false
            },
            {
                name: `${happy} คำแนะนำการใช้งาน`,
                value: `> \`${updateData.tips || 'รีสตาร์ตหรือรัน Loader สคริปต์ใหม่ในเกมเพื่อรับฟังก์ชั่นล่าสุดทันที'}\``,
                inline: false
            }
        )
        .setFooter({ text: "PAYOMBØYZ SCRIPT INTELLIGENCE • REALTIME CHANGELOG" })
        .setTimestamp();

    return embed;
}

module.exports = {
    buildHubCatalogEmbed,
    buildMapDetailsEmbed,
    buildUpdateAlertEmbed
};
