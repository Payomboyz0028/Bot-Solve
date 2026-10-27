/**
 * PayomboyZ Discord Bot - Custom Emoji Resolver
 * ดึง Custom Emojis จากในดิสคอร์ดของ dj แบบอัตโนมัติ ไม่ต้องกรอก ID เอง
 */

function getEmoji(client, emojiName, fallback = '') {
    if (!client || !client.emojis) return fallback;
    const cleanName = emojiName.replace(/:/g, '').toLowerCase();
    
    // Find in bot emoji cache across all guilds
    const emoji = client.emojis.cache.find(e => e.name.toLowerCase() === cleanName);
    if (emoji) {
        return emoji.toString(); // <a:name:id> หรือ <:name:id>
    }
    
    // Fallback dictionary ถ้ายังไม่ได้ดึง
    const fallbacks = {
        pbg_wing_l: '🪽',
        pbg_wing_r: '🪽',
        ww: '🟢',
        time: '⏰',
        emoji_48: '🎯',
        emojigg_Hit: '⚔️',
        hasake3: '⚡',
        Happy: '✨',
        Sukuna: '👹',
        anime_fire: '🔥',
        nezukovibing: '🌸',
        emojigg_jhu: '👁️',
        catlove: '💖',
        emojigg_ban: '🔨',
        ReimuDance: '💃'
    };

    return fallbacks[cleanName] || fallback;
}

module.exports = { getEmoji };
