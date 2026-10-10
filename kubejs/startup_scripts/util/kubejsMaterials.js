// One compact table for the repetitive data of the kubejs:* Tinkers materials (Aether, AE2, Ice and Fire, Twilight
// Forest, Nature's Aura, gold, valkyrie). From it:
//   - server_scripts/tinkers_special/materials_data.js generates tinkering/materials/definition/<m>.json and the
//     tconstruct:material recipes (recipes/tools/materials/<m>_<n>.json),
//   - client_scripts/kubejsMaterialsAssets.js generates the render info assets/kubejs/tinkering/materials/<m>.json.
// Stats, traits and modifiers stay as static JSON (they are real content, not boilerplate).
//
// Table fields: t = Tinkers tier, s = sortOrder, c = craftable, col = main colour RRGGBB, fb = render fallbacks,
// st = supported-stats profile (kmatStatProfiles), pal = optional hand-picked 7-stop palette (ARGB hex) overriding
// the generated one, spr = texture the parts are filled with (kubejs/assets/kubejs/textures/<spr>.png), r = [[item or "#tag", needed], ...] material recipes (value is always 1; they only allow repair
// and repair kits - part-builder access still depends on c = craftable).
// Names are prefixed kmat/KUBEJS_ to avoid clashes with feat/tinkers-all-tools' global helpers (renderInfo, shade).
// Rhino: no spread/destructuring, no const in loops.

global.KUBEJS_MATERIALS = {
    aether_candy_cane: { t: 0, s: 40, c: false, col: "FF6B81", fb: ["metal"], st: "tool5", spr: "kubejs:generator/candy_stripes" },
    aether_flaming: { t: 3, s: 41, c: false, col: "FF7A1A", fb: ["metal"], st: "tool5" },
    aether_hammer_of_kingbdogz: { t: 2, s: 46, c: false, col: "8A6A40", fb: ["metal"], st: "tool5" },
    aether_holy: { t: 3, s: 42, c: false, col: "F5E7A1", fb: ["metal"], st: "tool5" },
    aether_lightning: { t: 3, s: 43, c: false, col: "7FD7FF", fb: ["metal"], st: "tool5" },
    aether_pig_slayer: { t: 2, s: 45, c: false, col: "F2A0B0", fb: ["metal"], st: "tool5" },
    aether_vampire: { t: 3, s: 44, c: false, col: "B0203A", fb: ["metal"], st: "tool5" },
    certus_quartz: { t: 2, s: 30, c: true, col: "B6DCF0", fb: ["metal"], st: "tool6", r: [["ae2:certus_quartz_crystal", 1], ["ae2:charged_certus_quartz_crystal", 1]] },
    dragonbone: { t: 3, s: 32, c: true, col: "E6DFC6", fb: ["bone", "rock"], st: "tool6", r: [["iceandfire:dragonbone", 1]] },
    dragonbone_fire: { t: 3, s: 33, c: false, col: "F35B75", fb: ["bone", "rock"], st: "tool6" },
    dragonbone_ice: { t: 3, s: 34, c: false, col: "5BAFF3", fb: ["bone", "rock"], st: "tool6" },
    dragonbone_lightning: { t: 3, s: 35, c: false, col: "9A6BF3", fb: ["bone", "rock"], st: "tool6" },
    dragonsteel_lightning: { t: 4, s: 38, c: false, col: "8A5CF5", fb: ["metal"], st: "tool6" },
    fluix: { t: 2, s: 31, c: true, col: "8F6BD0", fb: ["metal"], st: "tool6", r: [["ae2:fluix_crystal", 1]] },
    gold: { t: 0, s: 41, c: false, col: "FDF55F", fb: ["metal"], st: "tool5", tex: "tconstruct:gold", pal: ["FF000000", "FF752802", "FFB26411", "FFE9B115", "FFFAD64A", "FFFDF55F", "FFFFFDE0"], r: [["#forge:ingots/gold", 1], ["#forge:nuggets/gold", 9]] },
    gravitite: { t: 3, s: 23, c: true, col: "E07AE0", fb: ["metal"], st: "tool6", r: [["aether:enchanted_gravitite", 1]] },
    holystone: { t: 1, s: 21, c: true, col: "B5B9B2", fb: ["rock"], st: "tool4", r: [["aether:holystone", 1]] },
    iaf_amphithere: { t: 2, s: 53, c: false, col: "5FA05F", fb: ["metal"], st: "tool5" },
    iaf_dread_knight: { t: 0, s: 56, c: false, col: "4A5A4A", fb: ["metal"], st: "tool5" },
    iaf_dread_queen: { t: 4, s: 57, c: false, col: "3A6A5A", fb: ["metal"], st: "tool5" },
    iaf_dread_thrall: { t: 0, s: 55, c: false, col: "6A7A5A", fb: ["metal"], st: "tool5" },
    iaf_ghost: { t: 2, s: 54, c: false, col: "BFE9FF", fb: ["metal"], st: "tool5" },
    iaf_hippogryph: { t: 2, s: 51, c: false, col: "C79A5B", fb: ["metal"], st: "tool5" },
    iaf_stymphalian: { t: 2, s: 52, c: false, col: "6E8F7A", fb: ["metal"], st: "tool5" },
    iaf_troll: { t: 2, s: 58, c: false, col: "7A6A5A", fb: ["metal"], st: "tool5" },
    myrmex_desert_chitin: { t: 3, s: 36, c: true, col: "C9A24A", fb: ["bone", "rock"], st: "tool6", r: [["iceandfire:myrmex_desert_chitin", 1]] },
    myrmex_jungle_chitin: { t: 3, s: 37, c: true, col: "4AA65A", fb: ["bone", "rock"], st: "tool6", r: [["iceandfire:myrmex_jungle_chitin", 1]] },
    na_depth: { t: 4, s: 61, c: true, col: "5B3B86", fb: ["metal"], st: "tool5", r: [["naturesaura:depth_ingot", 1]] },
    na_infused_iron: { t: 2, s: 59, c: true, col: "6FCF9F", fb: ["metal"], st: "tool5", r: [["naturesaura:infused_iron", 1]] },
    na_sky: { t: 3, s: 60, c: true, col: "8EC5FF", fb: ["metal"], st: "tool5", r: [["naturesaura:sky_ingot", 1]] },
    skyroot: { t: 0, s: 20, c: true, col: "C9B06B", fb: ["wood", "stick", "primitive"], st: "wood8", pal: ["FF000000", "FF241F13", "FF423A23", "FF645835", "FF887748", "FFA89359", "FFC9B06B"], r: [["aether:skyroot_planks", 1], ["aether:skyroot_stick", 2]] },
    tf_giant: { t: 1, s: 47, c: false, col: "8C8C8C", fb: ["metal"], st: "tool5" },
    tf_glass: { t: 0, s: 48, c: false, col: "DDEEFF", fb: ["metal"], st: "tool5" },
    tf_ice: { t: 0, s: 49, c: false, col: "AEE6FF", fb: ["metal"], st: "tool5" },
    tf_mazebreaker: { t: 3, s: 50, c: false, col: "C8B27A", fb: ["metal"], st: "tool5" },
    valkyrie: { t: 3, s: 39, c: false, col: "E8E4F0", fb: ["metal"], st: "tool5" },
    zanite: { t: 2, s: 22, c: true, col: "7A5CD6", fb: ["metal"], st: "tool6", r: [["aether:zanite_gemstone", 1]] },
    // ---- armor-only materials (feat/tinkers-armor): plating/maille stats + traits in data/kubejs/tinkering/materials ----
    aether_neptune: { t: 2, s: 70, c: false, col: "4FA3E8", fb: ["metal"], st: "tool5" },
    aether_phoenix: { t: 3, s: 71, c: false, col: "F0701A", fb: ["metal"], st: "tool5" },
    aether_obsidian: { t: 3, s: 72, c: false, col: "2A1F3D", fb: ["metal"], st: "tool5" },
    aether_sentry: { t: 1, s: 73, c: false, col: "A8A8B0", fb: ["metal"], st: "tool5" },
    tf_naga: { t: 1, s: 74, c: false, col: "4C9A3C", fb: ["metal"], st: "tool5" },
    tf_yeti: { t: 3, s: 75, c: false, col: "CFE8F5", fb: ["metal"], st: "tool5" },
    tf_arctic: { t: 2, s: 76, c: false, col: "DDE9F0", fb: ["metal"], st: "tool5" },
    tf_phantom: { t: 2, s: 77, c: false, col: "B8C4D8", fb: ["metal"], st: "tool5" },
    iaf_dragon_scale: { t: 2, s: 78, c: false, col: "C0392B", fb: ["metal"], st: "tool5" },
    iaf_tide: { t: 3, s: 79, c: false, col: "2BB3A4", fb: ["metal"], st: "tool5" },
    iaf_deathworm: { t: 1, s: 80, c: false, col: "C9A24A", fb: ["metal"], st: "tool5" }
}

var kmatStatProfiles = {
    tool4: ["head", "handle", "binding", "repair_kit"],
    tool5: ["head", "handle", "binding", "repair_kit", "grip"],
    tool6: ["head", "handle", "binding", "repair_kit", "limb", "grip"],
    wood8: ["head", "handle", "binding", "repair_kit", "limb", "grip", "shield_core", "arrow_shaft"]
}
var kmatArmorStats = ["armor_plating", "plating_helmet", "plating_chestplate", "plating_leggings", "plating_boots", "maille", "armor_maille"]
var kmatGreys = [0, 63, 102, 140, 178, 216, 255]
var kmatFactors = [0, 0.18, 0.33, 0.5, 0.68, 0.84, 1.0]

function kmatHex2(v) {
    var s = v.toString(16).toUpperCase()
    return s.length < 2 ? "0" + s : s
}

// 7-stop grey_to_color palette (ARGB hex strings): dark-to-bright multiples of the colour, brightest stop lightened 35%
function kmatPalette(col) {
    var rgb = [parseInt(col.substr(0, 2), 16), parseInt(col.substr(2, 2), 16), parseInt(col.substr(4, 2), 16)]
    var out = []
    for (var i = 0; i < kmatGreys.length; i++) {
        var s = "FF"
        for (var c = 0; c < 3; c++) {
            var v = i == 6 ? Math.floor(rgb[c] + (255 - rgb[c]) * 0.35) : Math.floor(rgb[c] * kmatFactors[i])
            s += kmatHex2(v)
        }
        out.push(s)
    }
    return out
}

// assets/<ns>/tinkering/materials/<m>.json
function kmatRenderInfo(e) {
    var pal = e.pal ? e.pal : kmatPalette(e.col)
    var palette = []
    for (var i = 0; i < pal.length; i++) palette.push({ color: pal[i], grey: kmatGreys[i] })
    var stats = []
    var prof = kmatStatProfiles[e.st]
    for (var j = 0; j < prof.length; j++) stats.push("tconstruct:" + prof[j])
    for (var a = 0; a < kmatArmorStats.length; a++) stats.push("tconstruct:" + kmatArmorStats[a])
    // spr: fill the parts with a texture instead of recolouring (Tinkers' grey_to_sprite, like its ice material); dark greys
    // stay shaded by tinting the texture
    var transformer = e.spr
        ? { type: "tconstruct:grey_to_sprite", palette: [{ grey: 0, color: "FF000000" }, { grey: 63, path: e.spr, color: "FF6E6E6E" },
            { grey: 140, path: e.spr, color: "FFB4B4B4" }, { grey: 216, path: e.spr }] }
        : { type: "tconstruct:recolor_sprite", color_mapping: { type: "tconstruct:grey_to_color", palette: palette } }
    var info = {
        color: "FF" + e.col,
        fallbacks: e.fb,
        generator: { supported_stats: stats, transformer: transformer }
    }
    // tex: reuse another material's pre-generated sprites where they exist (e.g. kubejs:gold -> tconstruct:gold repair kit)
    if (e.tex) info.texture = e.tex
    return info
}

// data/<ns>/tinkering/materials/definition/<m>.json
function kmatDefinition(e) {
    return { craftable: e.c, hidden: false, sortOrder: e.s, tier: e.t }
}

// data/<ns>/recipes/tools/materials/<m>_<n>.json, returned as [[name, json], ...]
function kmatRecipes(id, e) {
    var out = []
    var rs = e.r ? e.r : []
    for (var i = 0; i < rs.length; i++) {
        out.push([id + "_" + i, {
            type: "tconstruct:material",
            ingredient: rs[i][0].charAt(0) == "#" ? { tag: rs[i][0].substring(1) } : { item: rs[i][0] },
            material: "kubejs:" + id,
            needed: rs[i][1],
            value: 1
        }])
    }
    return out
}

global.kmatRenderInfo = kmatRenderInfo
global.kmatDefinition = kmatDefinition
global.kmatRecipes = kmatRecipes
