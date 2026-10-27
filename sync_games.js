const fs = require('fs');
const path = require('path');

async function syncAll31Games() {
    try {
        console.log("Fetching live 31 games from https://payomboyzcreative.online/api/v1/games...");
        const res = await fetch('https://payomboyzcreative.online/api/v1/games');
        const data = await res.json();
        if (!data.success || !Array.isArray(data.games)) {
            throw new Error("Invalid API response format");
        }

        console.log(`Fetched ${data.games.length} games.`);

        const maps = data.games.map((g, index) => {
            const rawName = g.name || `Game ${index + 1}`;
            // Clean up name for ID
            const cleanId = rawName
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '_')
                .replace(/_+/g, '_')
                .slice(0, 30);

            // Extract features from script source or fallback
            let features = [];
            if (g.script_source_value) {
                const src = g.script_source_value;
                // Look for -- Features: or --   1. ...
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

            // Category guessing
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

        const outputPath = path.join(__dirname, 'mapsData.json');
        fs.writeFileSync(outputPath, JSON.stringify({ maps, total: maps.length, lastSync: new Date().toISOString() }, null, 2), 'utf8');
        console.log(`Saved ${maps.length} maps into ${outputPath}!`);
        return maps;
    } catch (e) {
        console.error("Error syncing games:", e);
        return [];
    }
}

syncAll31Games();
