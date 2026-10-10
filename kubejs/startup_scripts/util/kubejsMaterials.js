// One compact table for the repetitive data of the kubejs:* Tinkers materials (only kubejs:gold, the vanilla golden tool
// tier). From it:
//   - server_scripts/tinkers_special/materials_data.js generates tinkering/materials/definition/<m>.json and the
//     tconstruct:material recipes (recipes/tools/materials/<m>_<n>.json),
//   - client_scripts/kubejsMaterialsAssets.js generates the render info assets/kubejs/tinkering/materials/<m>.json.
// Stats, traits and modifiers stay as static JSON (they are real content, not boilerplate).
//
// Table fields: t = Tinkers tier, s = sortOrder, c = craftable, col = main colour RRGGBB, fb = render fallbacks,
// st = supported-stats profile (kmatStatProfiles), pal = optional hand-picked 7-stop palette (ARGB hex) overriding
// the generated one, r = [[item or "#tag", needed], ...] material recipes (value is always 1; they only allow repair
// and repair kits - part-builder access still depends on c = craftable).
// Rhino: no spread/destructuring, no const in loops.

// shared palettes (7 stops, ARGB): gold sampled from vanilla golden tools (Tinkers' gold has no tool-head sprites, so our
// golden tool heads are generated from this; Tinkers' own pre-made gold armor sprites are kept)
global.KMAT_GOLD_PALETTE = ["FF000000", "FF6E4A10", "FFA06A12", "FFD99413", "FFE6AF15", "FFF2E04A", "FFFAFC75"]

global.KUBEJS_MATERIALS = {
    gold: { t: 0, s: 41, c: false, col: "FDF55F", fb: ["metal"], st: "tool5", pal: global.KMAT_GOLD_PALETTE, r: [["#forge:ingots/gold", 1], ["#forge:nuggets/gold", 9]] }
}

var kmatStatProfiles = {
    tool5: ["head", "handle", "binding", "repair_kit", "grip"]
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
    var transformer = { type: "tconstruct:recolor_sprite", color_mapping: { type: "tconstruct:grey_to_color", palette: palette } }
    var info = {
        color: "FF" + e.col,
        fallbacks: e.fb,
        generator: { supported_stats: stats, transformer: transformer }
    }
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
