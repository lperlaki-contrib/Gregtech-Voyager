// "Tool -> Tinkers tool" plan, computed ONCE at startup (StartupEvents.postInit = FMLLoadComplete: all registries frozen,
// GT materials initialised) by a single walk over the item registry, then shared through global.* with every script type:
//   server: recipes/tool_recipes.js (output swap, tool inputs), lootbags/tinkers_loot.js (loot + mob gear), tcon/replaced_tool_tags.js
//   client: hideJEI.js, tinkersAssets.js (EMI variants/aliases/hide, material render info + lang), tooltip
//   global.TINKERS_PLAN        id -> { type, mat, volt?, handle?, standIn?, substitute?, gold?, src }   recipe + loot conversions (hidden in EMI/JEI)
//   global.TINKERS_SKIPPED     id -> reason
//   global.TINKERS_AUTO        name -> generated material (kubejs:auto_<name>) data, injected by
//                              server_scripts/tcon/auto_materials.js (data) and client_scripts/tinkersAssets.js (render/lang)
//   global.tinkersPartsFor(id) / tinkersStackFor(id)
// Resolution order for a tool: SPECIAL map -> GT rules -> curated per-mod map (ONLY_NS) -> native Tinkers material (static list of
// materials with head stats) -> gm_construct:<gt> (GT material with TOOL property) -> GENERATED kubejs:auto_<name> from the tool tier.
// Wrapped in a function: top-level names of startup scripts share one scope. Rhino: no spread/destructuring, no const in loops.
(function () {
// Runtime config kubejs/config/tinkers_tools.json (keys documented in tinkers_tools.README.txt next to it). Callers read it ONCE per
// event (recipes, client assets, JEI hide), so changes apply on /reload or a resource reload without restarting.
const CFG_DEFAULTS = { showReplacedTools: false, removeStandInRecipes: true, removeUnmappedToolRecipes: false, craftableGoldenTools: false, convertArmor: true }
let cfgWarned = false
global.tinkersConfig = () => {
    let cfg = {}
    Object.keys(CFG_DEFAULTS).forEach((k) => { cfg[k] = CFG_DEFAULTS[k] })
    try {
        // Path given as a game-dir-relative STRING: KubeJS' type wrapper turns it into a Path. Avoided on purpose:
        // CONFIG.resolve("...") (ambiguous overloads on Windows), java.io.File / java.nio.file.Files (blocked by KubeJS' class
        // filter), readJson (its JsonElement reaches JS wrapped, values as Java Booleans). A missing file throws -> defaults.
        let parsed = JSON.parse(String(Java.loadClass("dev.latvian.mods.kubejs.util.JsonIO").readString("kubejs/config/tinkers_tools.json")))
        Object.keys(CFG_DEFAULTS).forEach((k) => { if (typeof parsed[k] == "boolean") cfg[k] = parsed[k] })
        if (!cfgWarned) console.info("[tinkers tools] config: " + JSON.stringify(cfg))
    } catch (e) {
        if (!cfgWarned) console.warn("[tinkers tools] cannot read kubejs/config/tinkers_tools.json, using defaults " + JSON.stringify(cfg) + ": " + e)
    }
    cfgWarned = true
    return cfg
}
// ---- one-line switches ------------------------------------------------------------------------------------------
// Butcher knife target: [tool id, part slots]. feat/tinkers-knives adds kubejs:butcher_knife; switch it here.
global.TINKERS_BUTCHER_KNIFE = ["kubejs:butcher_knife", "hw"] // small_blade, tool_handle (feat/tinkers-knives)
// Shovel target: [tool id, part slots]. kubejs:shovel (feat/tinkers-knives) = adze_head, tool_handle. Mattock is no longer a shovel.
global.TINKERS_SHOVEL = ["kubejs:shovel", "hw"]
// Tools made from kubejs: materials (Aether skyroot/holystone/zanite/gravitite, AE2 certus_quartz/fluix, IaF dragonbone,
// myrmex chitin), defined on branch feat/tinkers-aether-materials (and followers).
// Set to false if those are not merged (the tools are then left alone).
global.AETHER_TINKERS_MATERIALS = true

// Part slots: h = head material, w = handle material (tconstruct:wood unless the mod has its own), c = casing, e = engine, b = battery.
// Composition follows the GT crafting recipe: plates/ingots/rods of the material -> h (bindings and guards too), the wooden
// stick -> w; tools made entirely of the material (wrench, crowbar, wire cutter) are all h.
// Part order per tool: data/tconstruct/tinkering/tool_definitions + data/gregic_tinkering/tinkering/tool_definitions.
const TINKERS_SPECS = {
    // vanilla-style tools (GT and generic mods)
    pickaxe: ["tconstruct:pickaxe", "hwh"],
    axe: ["tconstruct:hand_axe", "hwh"],
    shovel: global.TINKERS_SHOVEL,
    hoe: ["tconstruct:kama", "hwh"],
    sword: ["tconstruct:sword", "hwh"], // small_blade, tool_handle, tool_handle (guard)
    // GT-only tool types
    mining_hammer: ["tconstruct:sledge_hammer", "hwhh"], // hammer_head, tough_handle, large_plate x2
    spade: ["tconstruct:excavator", "hwhw"], // large_plate, tough_handle, tough_binding, tough_handle
    scythe: ["tconstruct:scythe", "hwhw"], // broad_blade, tough_handle, tough_binding, tough_handle
    butchery_knife: global.TINKERS_BUTCHER_KNIFE,
    cleaver: ["tconstruct:cleaver", "hwhh"], // broad_blade, tough_handle, tough_handle (guard), large_plate (TF giant sword)
    dagger: ["tconstruct:dagger", "hw"], // small_blade, tool_handle (IaF stymphalian dagger)
    knife: ["kubejs:knife", "hw"], // GT crafting knife -> kubejs:knife (gregic GT tool class, feat/tinkers-knives)
    // GT crafting tools -> gregic_tinkering (the mortar stays GT)
    hammer: ["gregic_tinkering:hammer", "hwh"],
    file: ["gregic_tinkering:file", "hwh"],
    saw: ["gregic_tinkering:saw", "hwh"],
    screwdriver: ["gregic_tinkering:screwdriver", "hwh"],
    wire_cutter: ["gregic_tinkering:wire_cutter", "hhh"],
    wrench: ["gregic_tinkering:wrench", "hhh"], // wrench_head, tough_handle, binding
    crowbar: ["gregic_tinkering:crowbar", "hhh"], // crowbar_head, handle, crowbar_head
    plunger: ["gregic_tinkering:plunger", "hwh"],
    mallet: ["gregic_tinkering:soft_mallet", "hwh"], // soft_mallet_head, tool_handle, tool_binding
    // armor: p = plating (the armor material), m = maille (neutral default ARMOR_MAILLE), l = leather cuirass (travelers: leather plating too)
    plate_helmet: ["tconstruct:plate_helmet", "pm"],
    plate_chestplate: ["tconstruct:plate_chestplate", "pm"],
    plate_leggings: ["tconstruct:plate_leggings", "pm"],
    plate_boots: ["tconstruct:plate_boots", "pm"],
    travelers_helmet: ["tconstruct:travelers_helmet", "pl"],
    travelers_chestplate: ["tconstruct:travelers_chestplate", "pl"],
    travelers_leggings: ["tconstruct:travelers_leggings", "pl"],
    travelers_boots: ["tconstruct:travelers_boots", "pl"]
}
// GT electric tools -> gregic powered tools: [head, casing, engine, battery]
const TINKERS_POWERED = {
    drill: "gregic_tinkering:drill",
    chainsaw: "gregic_tinkering:chainsaw",
    wrench: "gregic_tinkering:powered_wrench",
    screwdriver: "gregic_tinkering:powered_screwdriver",
    wirecutter: "gregic_tinkering:powered_wire_cutter",
    buzzsaw: "gregic_tinkering:powered_saw"
}
// engine material = gregic_tinkering:<volt>_electric; battery with the matching power_tier; casing is always steel
const TINKERS_BATTERY = {
    lv: "gregic_tinkering:small_lithium_battery",
    mv: "gregic_tinkering:medium_lithium_battery",
    hv: "gregic_tinkering:large_lithium_battery",
    ev: "gregic_tinkering:small_vanadium_battery",
    iv: "gregic_tinkering:medium_vanadium_battery"
}

// Tinkers materials that have head stats (data/tconstruct/tinkering/materials/stats/*.json). gold, quartz, aluminum
// and several others have NO head stats and cannot be used for tools.
const TCON_HEAD = [
    "amethyst_bronze", "ancient", "blazing_bone", "bone", "bronze", "chorus", "cinderslime", "cobalt", "constantan",
    "copper", "electrum", "fiery", "flint", "hepatizon", "invar", "iron", "ironwood", "knightmetal", "lead",
    "manyullyn", "nahuatl", "necronium", "necrotic_bone", "osmium", "pewter", "pig_iron", "plated_slimewood",
    "queens_slime", "rock", "rose_gold", "scorched_stone", "seared_stone", "silver", "slimesteel", "slimewood",
    "steel", "steeleaf", "treated_wood", "venombone", "whitestone", "wood"
]
// GT materials gm_construct does NOT generate (config/gm_construct-common.toml ignoredGTMaterials).
// Of these only the natively supported Tinkers materials get tools.
const GM_IGNORED = [
    "bronze", "cobalt", "copper", "diamond", "flint", "invar", "iron", "netherite", "polybenzimidazole",
    "polyethylene", "polytetrafluoroethylene", "rose_gold", "rubber", "steel", "silicone_rubber",
    "styrene_butadiene_rubber", "wood"
]
const TCON_NATIVE = ["iron", "copper", "bronze", "steel", "cobalt", "invar", "rose_gold", "flint"]
// gregic_tinkering adds these as plunger-head materials (kubejs/data/gregic_tinkering adds soft_mallet_head stats to them too)
const PLUNGER_MATERIALS = [
    "rubber", "silicone_rubber", "styrene_butadiene_rubber", "polyethylene", "polytetrafluoroethylene", "polybenzimidazole"
]
// Tool material names (from a tier's repair ingredient / vanilla tier) -> Tinkers material, split by provenance:
//   EXACT aliases: the Tinkers material is the same thing (golden -> kubejs:gold is handled in genericMaterial)
//   STAND_IN aliases: no exact Tinkers equivalent; recipes NEVER swap to these (removed or left as the original, config
//   removeStandInRecipes), loot always converts. p.standIn -> p.substitute is set ONLY from this provenance (and SPECIAL flags).
const EXACT_ALIAS = {
    // rock variants: the plain tconstruct:rock is named "Rock" (Tinkers' own stone tools are tconstruct:rock#stone)
    wooden: "wood", planks: "wood", stone: "rock#stone", cobblestone: "rock#stone", cobbled_deepslate: "rock#stone", blackstone: "rock#blackstone"
}
const STAND_IN_ALIAS = { diamond: "cobalt", netherite: "manyullyn" }
// vanilla Tiers enum constant -> material name (data: the tool's actual tier object, not its id)
const VANILLA_TIERS = { WOOD: "wooden", STONE: "stone", IRON: "iron", GOLD: "golden", DIAMOND: "diamond", NETHERITE: "netherite" }
// plain-tool mods where only some items are converted: namespace -> [regex of allowed paths, material from prefix]
const TOOL_SUFFIX = "(pickaxe|axe|shovel|hoe|sword)"
const ONLY_NS = {
    twilightforest: new RegExp("^(ironwood|steeleaf|knightmetal|fiery)_" + TOOL_SUFFIX + "$"),
    iceandfire: new RegExp("^(copper|silver|dragonbone|dragonsteel_fire|dragonsteel_ice|dragonsteel_lightning|myrmex_desert|myrmex_jungle)_" + TOOL_SUFFIX + "$|^dragonbone_sword_(fire|ice|lightning)$"),
    ae2: new RegExp("^(certus_quartz|nether_quartz|fluix)_" + TOOL_SUFFIX + "$"),
    forestry: new RegExp("^bronze_" + TOOL_SUFFIX + "$"),
    aether: new RegExp("^(skyroot|holystone|zanite|gravitite)_" + TOOL_SUFFIX + "$|^valkyrie_(pickaxe|axe|shovel|hoe|lance)$")
}
// namespaces never converted (special abilities / not plain tools); reason is logged
const SKIP_NS = {
    botania: "mana tools (self-repair, terra blade, ...)",
    bloodmagic: "sentient tools (demon will drops need its own weapon class, will-scaled powers)",
    forbidden_arcanus: "draco arcanus / deorum special tools",
    occultism: "ritual tools (iesnium/infused pickaxe)",
    ars_nouveau: "spell sword",
    arsdelight: "spell knife",
    inventorypets: "pet-themed weapons",
    starbunclemania: "star sword",
    voyagercore: "pack machine items",
    industrialforegoing: "infinity tools",
    gregic_tinkering: "already Tinkers",
    tconstruct: "already Tinkers",
    gtceu: "handled by GT rules",
    kubejs: "pack items"
}
const AETHER_MATERIALS = {
    skyroot: "kubejs:skyroot", holystone: "kubejs:holystone", zanite: "kubejs:zanite", gravitite: "kubejs:gravitite",
    valkyrie: "kubejs:valkyrie" // loot-only tools; the lance is a SwordItem
}
// Prefix -> material for the other kubejs: material tools (gated by AETHER_TINKERS_MATERIALS)
const KUBEJS_MATERIALS = {
    certus_quartz: "kubejs:certus_quartz", fluix: "kubejs:fluix", nether_quartz: "tconstruct:quartz",
    dragonbone: "kubejs:dragonbone", myrmex_desert: "kubejs:myrmex_desert_chitin", myrmex_jungle: "kubejs:myrmex_jungle_chitin",
    // feat/tinkers-aether-materials: elemental dragonbone swords are separate materials; lightning dragonsteel is not a GT material
    dragonbone_fire: "kubejs:dragonbone_fire", dragonbone_ice: "kubejs:dragonbone_ice", dragonbone_lightning: "kubejs:dragonbone_lightning",
    dragonsteel_lightning: "kubejs:dragonsteel_lightning"
}
// Unique weapons with their own kubejs: materials (feat/tinkers-aether-materials): id -> [spec key, head material, handle].
// Explicit on purpose (no generic resolver); the handle here is used as is. Gated by AETHER_TINKERS_MATERIALS.
const SPECIAL = {}
// 5th arg: true when the material is only a stand-in (recipes never swap to it)
const addSpecial = (type, mat, handle, ids, standIn) => ids.forEach((id) => { SPECIAL[id] = [type, mat, handle, !!standIn] })
const SKY = "kubejs:skyroot"
const NECRO = "tconstruct:necrotic_bone"
const WOOD = "tconstruct:wood"
addSpecial("sword", "kubejs:aether_candy_cane", SKY, ["aether:candy_cane_sword"])
addSpecial("sword", "kubejs:aether_flaming", SKY, ["aether:flaming_sword"])
addSpecial("sword", "kubejs:aether_holy", SKY, ["aether:holy_sword"])
addSpecial("sword", "kubejs:aether_lightning", SKY, ["aether:lightning_sword"])
addSpecial("sword", "kubejs:aether_vampire", SKY, ["aether:vampire_blade"])
addSpecial("sword", "kubejs:aether_pig_slayer", SKY, ["aether:pig_slayer"])
addSpecial("mining_hammer", "kubejs:aether_hammer_of_kingbdogz", SKY, ["aether:hammer_of_kingbdogz"]) // Aether: 6 attack, 1.6 speed, 250 durability
addSpecial("pickaxe", "kubejs:tf_giant", WOOD, ["twilightforest:giant_pickaxe"])
addSpecial("cleaver", "kubejs:tf_giant", WOOD, ["twilightforest:giant_sword"])
addSpecial("sword", "kubejs:tf_glass", WOOD, ["twilightforest:glass_sword"])
addSpecial("sword", "kubejs:tf_ice", WOOD, ["twilightforest:ice_sword"])
addSpecial("pickaxe", "kubejs:tf_mazebreaker", WOOD, ["twilightforest:mazebreaker_pickaxe"])
addSpecial("axe", "kubejs:gold", WOOD, ["twilightforest:gold_minotaur_axe"])
addSpecial("axe", "tconstruct:cobalt", WOOD, ["twilightforest:diamond_minotaur_axe"], true)
addSpecial("sword", "kubejs:iaf_hippogryph", WOOD, ["iceandfire:hippogryph_sword"])
addSpecial("dagger", "kubejs:iaf_stymphalian", WOOD, ["iceandfire:stymphalian_bird_dagger"])
addSpecial("sword", "kubejs:iaf_amphithere", WOOD, ["iceandfire:amphithere_macuahuitl"])
addSpecial("sword", "kubejs:iaf_ghost", NECRO, ["iceandfire:ghost_sword"])
addSpecial("sword", "kubejs:iaf_dread_thrall", NECRO, ["iceandfire:dread_sword"])
addSpecial("sword", "kubejs:iaf_dread_knight", NECRO, ["iceandfire:dread_knight_sword"])
addSpecial("sword", "kubejs:iaf_dread_queen", NECRO, ["iceandfire:dread_queen_sword"])
addSpecial("axe", "kubejs:iaf_troll", NECRO, ["iceandfire:troll_weapon_axe"])
addSpecial("mining_hammer", "kubejs:iaf_troll", NECRO, ["iceandfire:troll_weapon_hammer"])
addSpecial("sword", "kubejs:iaf_troll", NECRO, [
    "iceandfire:troll_weapon_trunk", "iceandfire:troll_weapon_trunk_frost", "iceandfire:troll_weapon_column",
    "iceandfire:troll_weapon_column_forest", "iceandfire:troll_weapon_column_frost"
])
addSpecial("sword", "kubejs:myrmex_desert_chitin", NECRO, ["iceandfire:myrmex_desert_sword_venom"])
addSpecial("sword", "kubejs:myrmex_jungle_chitin", NECRO, ["iceandfire:myrmex_jungle_sword_venom"])

// Forestry "Survivalist's" bronze tools and the kits that unpack into them (right-click): not obtainable any more (their recipes are
// removed in tool_recipes.js); leftovers in loot become Tinkers bronze tools, and the kits themselves convert in loot too.
// Farmer's Delight knives -> kubejs:knife (recipes and loot). golden/diamond/netherite are stand-ins (recipes removed, loot converts).
addSpecial("knife", "tconstruct:flint", WOOD, ["farmersdelight:flint_knife"])
addSpecial("knife", "tconstruct:iron", WOOD, ["farmersdelight:iron_knife"])
addSpecial("knife", "kubejs:gold", WOOD, ["farmersdelight:golden_knife"])
addSpecial("knife", "tconstruct:cobalt", WOOD, ["farmersdelight:diamond_knife"], true)
addSpecial("knife", "tconstruct:manyullyn", WOOD, ["farmersdelight:netherite_knife"], true)
addSpecial("pickaxe", "tconstruct:bronze", WOOD, ["forestry:bronze_pickaxe", "forestry:kit_pickaxe"])
addSpecial("shovel", "tconstruct:bronze", WOOD, ["forestry:bronze_shovel", "forestry:kit_shovel"])
addSpecial("axe", "tconstruct:bronze", WOOD, ["forestry:bronze_axe", "forestry:axe_kit"])
addSpecial("hoe", "tconstruct:bronze", WOOD, ["forestry:bronze_hoe", "forestry:hoe_kit"])
addSpecial("sword", "tconstruct:bronze", WOOD, ["forestry:bronze_sword", "forestry:sword_kit"])
// Not converted, only hidden in EMI/JEI (they only come from breaking the removed tools): global.TINKERS_HIDE_ONLY
const HIDE_ONLY = [
    "forestry:broken_bronze_pickaxe", "forestry:broken_bronze_shovel", "forestry:broken_axe", "forestry:broken_hoe", "forestry:broken_sword"
]
global.TINKERS_HIDE_ONLY = {}

// Nature's Aura tools (materials: feat/tinkers-aether-materials), wood handles
;["pickaxe", "axe", "shovel", "hoe", "sword"].forEach((t) => {
    addSpecial(t, "kubejs:na_infused_iron", WOOD, ["naturesaura:infused_iron_" + t])
    addSpecial(t, "kubejs:na_sky", WOOD, ["naturesaura:sky_" + t])
    addSpecial(t, "kubejs:na_depth", WOOD, ["naturesaura:depth_" + t])
})

// Where loot-only tools come from: [lang key suffix, English text, ids]. Rendered as EMI info pages on the Tinkers variants
// (client_scripts/tinkersAssets.js). Sources read from the mods' loot tables (jar data/*/loot_tables).
global.TINKERS_LOOT_SOURCES = [
    ["aether_valkyrie", "Dropped by Valkyries and found in Silver Dungeon chests (The Aether).",
        ["aether:valkyrie_pickaxe", "aether:valkyrie_axe", "aether:valkyrie_shovel", "aether:valkyrie_hoe"]],
    ["aether_bronze", "Found in Bronze Dungeon reward chests (The Aether).",
        ["aether:valkyrie_lance", "aether:flaming_sword", "aether:hammer_of_kingbdogz"]],
    ["aether_silver", "Found in Silver Dungeon reward chests (The Aether).", ["aether:holy_sword", "aether:lightning_sword"]],
    ["aether_gold", "Found in Gold Dungeon reward chests (The Aether).", ["aether:vampire_blade", "aether:pig_slayer"]],
    ["aether_present", "Found in Presents (The Aether).", ["aether:candy_cane_sword"]],
    ["tf_giant", "Dropped by Giants (Twilight Forest).", ["twilightforest:giant_pickaxe", "twilightforest:giant_sword"]],
    ["tf_aurora", "Found in Aurora Palace chests (Twilight Forest).", ["twilightforest:glass_sword", "twilightforest:ice_sword"]],
    ["tf_labyrinth", "Found in the Labyrinth vault (Twilight Forest).", ["twilightforest:mazebreaker_pickaxe"]],
    ["tf_minotaur", "Carried or dropped by Minotaurs and Minoshroom (Twilight Forest).",
        ["twilightforest:gold_minotaur_axe", "twilightforest:diamond_minotaur_axe"]],
    ["iaf_dread", "Carried by Dread mobs (Ice and Fire).",
        ["iceandfire:dread_sword", "iceandfire:dread_knight_sword", "iceandfire:dread_queen_sword"]],
    ["iaf_troll", "Carried by Trolls (Ice and Fire).", [
        "iceandfire:troll_weapon_axe", "iceandfire:troll_weapon_hammer", "iceandfire:troll_weapon_trunk",
        "iceandfire:troll_weapon_trunk_frost", "iceandfire:troll_weapon_column", "iceandfire:troll_weapon_column_forest",
        "iceandfire:troll_weapon_column_frost"]],
    ["forestry_mineshaft", "Found in abandoned mineshaft chests (Forestry).",
        ["forestry:bronze_pickaxe", "forestry:bronze_shovel", "forestry:kit_pickaxe", "forestry:kit_shovel"]]
]

// Tools used as ingredients in kubejs scripts (swapping them would make those recipes uncraftable)
const TINKERS_KEEP = [
    "gtceu:tungsten_steel_sword", // voyagercore/helpersandmodules.js
    "gtceu:iron_wrench" // gregify/backpacks.js
]
// Butcher knives and cleavers -> global.TINKERS_BUTCHER_KNIFE (head material per tier, like tinkers_loot.js)
const BUTCHER_STAND_IN = ["hearthandharvest:diamond_cleaver", "hearthandharvest:netherite_cleaver"]
const BUTCHER_SOURCES = {
    "occultism:butcher_knife": "tconstruct:iron", // recipe: iron ingots + sticks
    "hearthandharvest:flint_cleaver": "tconstruct:flint",
    "hearthandharvest:iron_cleaver": "tconstruct:iron",
    "hearthandharvest:golden_cleaver": "kubejs:gold",
    "hearthandharvest:diamond_cleaver": "tconstruct:cobalt",
    "hearthandharvest:netherite_cleaver": "tconstruct:manyullyn"
}

const TT_ForgeRegistries = Java.loadClass("net.minecraftforge.registries.ForgeRegistries")
// GT classes are loaded lazily, inside postInit only (GTToolType static init crashes when touched at script load, see knives.js)
let TT_GTMaterials = null
let TT_PropertyKey = null
let TT_IGTTool = null
const TT_Tiers = Java.loadClass("net.minecraft.world.item.Tiers")
const TT_VOLTS = ["ulv", "lv", "mv", "hv", "ev", "iv"]
const gtClasses = () => {
    if (!TT_GTMaterials) {
        TT_IGTTool = Java.loadClass("com.gregtechceu.gtceu.api.item.IGTTool")
        TT_GTMaterials = Java.loadClass("com.gregtechceu.gtceu.common.data.GTMaterials")
        TT_PropertyKey = Java.loadClass("com.gregtechceu.gtceu.api.data.chemical.material.properties.PropertyKey")
    }
}
// GT material by name or null (GTMaterials.get returns the NULL material for unknown names)
const gtMaterialOf = (name) => {
    try {
        gtClasses()
        let m = TT_GTMaterials.get(name)
        return m && String(m.getName()) == name ? m : null
    } catch (e) {
        return null
    }
}
const TOOL_CLASSES = [
    ["pickaxe", Java.loadClass("net.minecraft.world.item.PickaxeItem")],
    ["axe", Java.loadClass("net.minecraft.world.item.AxeItem")],
    ["shovel", Java.loadClass("net.minecraft.world.item.ShovelItem")],
    ["hoe", Java.loadClass("net.minecraft.world.item.HoeItem")],
    ["sword", Java.loadClass("net.minecraft.world.item.SwordItem")]
]

const gtHasTool = (name) => {
    try {
        let m = gtMaterialOf(name)
        return !!m && m.hasProperty(TT_PropertyKey.TOOL)
    } catch (e) {
        return false
    }
}

// GT tool material: gm_construct:<gt> unless ignored, then tconstruct:<gt> if native. Plungers: gregic plastics only.
const gtMaterial = (gt, type) => {
    // plungers and soft mallets: GT wood/rubber/plastics -> tconstruct:wood / gregic's own rubber and plastic materials
    if (type == "mallet" && gt == "wood") return "tconstruct:wood"
    if (type == "plunger" || type == "mallet") return PLUNGER_MATERIALS.indexOf(gt) >= 0 ? "gregic_tinkering:" + gt : null
    if (GM_IGNORED.indexOf(gt) < 0) return "gm_construct:" + gt
    if (TCON_NATIVE.indexOf(gt) >= 0) return "tconstruct:" + gt
    return null
}

// generic material name (alias -> tconstruct head material -> gm_construct GT tool material)
const isGold = (name) => name == "golden" || name == "gold"
const genericMaterial = (name) => {
    // golden tools: loot-only kubejs:gold (tconstruct:gold has no head stats); null when the kubejs materials are not merged
    if (isGold(name)) return global.AETHER_TINKERS_MATERIALS ? { mat: "kubejs:gold", standIn: false } : null
    let standIn = false
    if (STAND_IN_ALIAS[name]) {
        name = STAND_IN_ALIAS[name]
        standIn = true
    } else if (EXACT_ALIAS[name]) name = EXACT_ALIAS[name]
    if (TCON_HEAD.indexOf(name.split("#")[0]) >= 0) return { mat: "tconstruct:" + name, standIn: standIn }
    if (GM_IGNORED.indexOf(name) < 0 && gtHasTool(name)) return { mat: "gm_construct:" + name, standIn: false }
    return null
}

// Material name candidates from the tier's repair ingredient JSON (works for tag ingredients too, tags are not bound at
// startup): forge:ingots/bronze -> bronze, aether:zanite_gemstone -> zanite, minecraft:planks -> wood.
const TT_INGR_RE = /"(item|tag)"\s*:\s*"([^"]+)"/
const TT_SUFFIX_RE = /_(ingot|gem|gemstone|crystal|shard|scrap|bar|plate)$/
const ingredientName = (ingJson) => {
    let m = TT_INGR_RE.exec(ingJson)
    if (!m) return null
    let path = m[2].split(":")[1]
    if (m[1] == "tag") path = path.split("/").pop()
    if (/planks$/.test(path)) return "wood"
    return path.replace(TT_SUFFIX_RE, "").replace(/^(ingot|gem)_/, "")
}
const sanitize = (n) => String(n).toLowerCase().replace(/[^a-z0-9_]/g, "_")

// ---- generated materials: kubejs:auto_<name>, built from the tool's Tier -------------------------------------------------
const TT_TIER_NAMES = ["minecraft:wood", "minecraft:stone", "minecraft:iron", "minecraft:diamond", "minecraft:netherite"]
// colour for the generated material's tool parts: GT material colour, else this table, else grey
const TT_COLORS = {
    emerald: "17dd62", ruby: "c8203a", sapphire: "2a4bd6", amethyst: "9a5cc6", obsidian: "2a1f3d", bone: "e3dfc9",
    quartz: "e8e3d8", glowstone: "ffd25f", ender: "2b8f7b", slime: "6fcf5b", prismarine: "5fb8a5"
}
global.TINKERS_AUTO = {}
const autoMaterial = (item, name) => {
    let n = sanitize(name)
    let id = "kubejs:auto_" + n
    if (global.TINKERS_AUTO[n]) return id
    let tier = item.getTier()
    let level = Number(tier.getLevel())
    let ing = tier.getRepairIngredient().toJson()
    let ingText = String(ing)
    let color = null
    let source = "default"
    let gm = gtMaterialOf(n)
    if (gm) {
        color = ("000000" + (Number(gm.getMaterialRGB()) & 0xffffff).toString(16)).slice(-6)
        source = "GT"
    } else if (TT_COLORS[n]) {
        color = TT_COLORS[n]
        source = "table"
    } else {
        color = "9a9a9a"
    }
    global.TINKERS_AUTO[n] = {
        id: id,
        name: n,
        level: level,
        uses: Number(tier.getUses()),
        speed: Math.round(Number(tier.getSpeed()) * 100) / 100,
        attack: Math.round(Number(tier.getAttackDamageBonus()) * 100) / 100,
        miningTier: TT_TIER_NAMES[Math.max(0, Math.min(level, 4))],
        // an empty ingredient serialises to [] -> no part-builder recipe (material still usable via tool NBT / loot)
        ingredient: ingText == "[]" || ingText == "{}" ? null : JSON.parse(ingText),
        color: color,
        colorSource: source
    }
    return id
}

const toolType = (item) => {
    for (let i = 0; i < TOOL_CLASSES.length; i++) if (item instanceof TOOL_CLASSES[i][1]) return TOOL_CLASSES[i][0]
    return null
}

// ---- ARMOR (config convertArmor) ----------------------------------------------------------------------------------------
// Scope: vanilla + Aether + Twilight Forest + Ice and Fire. Everything else (Botania, Forbidden Arcanus, Ars, Blood Magic, GT suits,
// Ad Astra suits, curios/cosmetics, kubejs items) is skipped with a reason. Classification is by DATA: ArmorItem instance,
// getEquipmentSlot(), getMaterial().getName() (vanilla enum name / mod material name). Ice and Fire dragon scale / tide / troll /
// chitin armor have no stable material name, so those are told apart by the item's Java class (documented fallback).
// plate_* = [<slot>_plating = armor material, maille = ARMOR_MAILLE]. Maille is statless; tconstruct:leather is the neutral default
// (its only trait, Tanned, is irrelevant on armor; iron would add Magnetic, gold/silver add armor traits).
const TT_ArmorItem = Java.loadClass("net.minecraft.world.item.ArmorItem")
const ARMOR_MAILLE = "tconstruct:leather"
// our (kubejs:) armor materials use themselves as maille for a consistent look (their maille traits are empty, see
// data/kubejs/tinkering/materials/traits); exceptions: a secondary material
const ARMOR_MAILLE_FOR = { "kubejs:valkyrie": "tconstruct:gold" }
const ARMOR_SLOT = { head: "helmet", chest: "chestplate", legs: "leggings", feet: "boots" }
const ARMOR_NS = { minecraft: true, aether: true, twilightforest: true, iceandfire: true }
const AETHER_ARMOR = {
    zanite: "kubejs:zanite", gravitite: "kubejs:gravitite", valkyrie: "kubejs:valkyrie", neptune: "kubejs:aether_neptune",
    phoenix: "kubejs:aether_phoenix", obsidian: "kubejs:aether_obsidian", sentry: "kubejs:aether_sentry"
}
const TF_ARMOR = {
    ironwood: "tconstruct:ironwood", fiery: "tconstruct:fiery", steeleaf: "tconstruct:steeleaf", knightly: "tconstruct:knightmetal",
    naga_scale: "kubejs:tf_naga", phantom: "kubejs:tf_phantom", yetiarmor: "kubejs:tf_yeti", arcticarmor: "kubejs:tf_arctic"
}
const IAF_ARMOR_NAME = {
    dragonsteel_fire: "gm_construct:dragonsteel_fire", dragonsteel_ice: "gm_construct:dragonsteel_ice",
    dragonsteel_lightning: "kubejs:dragonsteel_lightning", myrmexdesert: "kubejs:myrmex_desert_chitin", myrmexjungle: "kubejs:myrmex_jungle_chitin"
}
const IAF_ARMOR_CLASS = {
    ItemSilverArmor: "tconstruct:silver", ItemCopperArmor: "tconstruct:copper", ItemScaleArmor: "kubejs:iaf_dragon_scale",
    ItemSeaSerpentArmor: "kubejs:iaf_tide", ItemTrollArmor: "kubejs:iaf_troll", ItemDeathwormArmor: "kubejs:iaf_deathworm"
}
// armor without a crafting recipe: EMI info page instead of a "craftable" variant (client_scripts/tinkersAssets.js reads this list)
global.TINKERS_LOOT_SOURCES = global.TINKERS_LOOT_SOURCES.concat([
    ["aether_armor", "Found as loot in The Aether (dungeon chests and Aether mobs).", [
        "aether:neptune_helmet", "aether:neptune_chestplate", "aether:neptune_leggings", "aether:neptune_boots",
        "aether:valkyrie_helmet", "aether:valkyrie_chestplate", "aether:valkyrie_leggings", "aether:valkyrie_boots",
        "aether:phoenix_helmet", "aether:phoenix_chestplate", "aether:phoenix_leggings", "aether:phoenix_boots",
        "aether:obsidian_helmet", "aether:obsidian_chestplate", "aether:obsidian_leggings", "aether:obsidian_boots", "aether:sentry_boots"]],
    ["tf_phantom_armor", "Carried by Knight Phantoms (Twilight Forest).", ["twilightforest:phantom_helmet", "twilightforest:phantom_chestplate"]]
])

const armorPlan = (id, ns, item) => {
    if (ns == "tconstruct" || ns == "gregic_tinkering") return null
    if (ns == "gtceu" && /^dragonsteel_(fire|ice)_/.test(id.split(":")[1])) { // GT armor generated by the ARMOR property of the dragonsteel GT materials
        global.TINKERS_HIDE_ONLY[id] = true
        return { skip: "GT dragonsteel armor (hidden duplicate)" }
    }
    if (!ARMOR_NS[ns]) return { skip: "armor out of scope (" + ns + ")" }
    let slot = ARMOR_SLOT[String(item.getEquipmentSlot().getName())]
    if (!slot) return null
    let mname = String(item.getMaterial().getName()).split(":").pop()
    let m = null
    let standIn = false
    if (ns == "minecraft") {
        if (mname == "leather") return { type: "travelers_" + slot, mat: "tconstruct:leather", armor: true, src: "armor" } // plating stats: data/tconstruct/.../stats/leather.json
        if (mname == "iron") m = "tconstruct:iron"
        else if (mname == "gold") m = "tconstruct:gold" // exact: Tinkers gold plating (golden trait = piglin neutral)
        else if (mname == "diamond") {
            m = "tconstruct:cobalt"
            standIn = true
        } else if (mname == "netherite") {
            m = "tconstruct:manyullyn"
            standIn = true
        } else return { skip: "vanilla armor kept (" + mname + ")" }
    } else if (ns == "aether") m = AETHER_ARMOR[mname]
    else if (ns == "twilightforest") m = TF_ARMOR[mname]
    else m = IAF_ARMOR_NAME[mname] || IAF_ARMOR_CLASS[String(item.getClass().getSimpleName())]
    if (!m) return { skip: "armor with special mechanics / no mapping (" + ns + ":" + mname + ")" }
    if (/^kubejs:/.test(m) && !global.AETHER_TINKERS_MATERIALS) return { skip: "kubejs Tinkers materials disabled" }
    return { type: "plate_" + slot, mat: m, standIn: standIn, armor: true, src: "armor" }
}

// returns null (not a tool we care about), { skip: reason } or { type, mat, volt }
const planFor = (id, item) => {
    // locals: let + unique names (Rhino treats const as function-scoped)
    let parts = id.split(":")
    let ns = parts[0]
    let path = parts[1]
    if (SPECIAL[id]) {
        if (!global.AETHER_TINKERS_MATERIALS && /^kubejs:/.test(SPECIAL[id][1])) return { skip: "kubejs Tinkers materials disabled" }
        return { type: SPECIAL[id][0], mat: SPECIAL[id][1], handle: SPECIAL[id][2], standIn: SPECIAL[id][3], src: "special" }
    }
    if (TINKERS_KEEP.indexOf(id) >= 0) return { skip: "kept: used as an ingredient in a kubejs recipe" }
    if (item instanceof TT_ArmorItem) return armorPlan(id, ns, item)
    if (BUTCHER_SOURCES[id]) {
        if (!global.AETHER_TINKERS_MATERIALS && /^kubejs:/.test(BUTCHER_SOURCES[id])) return { skip: "kubejs Tinkers materials disabled" }
        return { type: "butchery_knife", mat: BUTCHER_SOURCES[id], standIn: BUTCHER_STAND_IN.indexOf(id) >= 0, src: "special" }
    }

    // GT tools by CLASS (IGTTool), not by id: tool type name, material and electric tier come from the item itself
    // (api/item/IGTTool: getToolType().name, getMaterial().getName(), isElectric(), getElectricTier()).
    // Only gtceu's own tools: gregic_tinkering's ModifiableGTToolItem also implements IGTTool (isElectric true, tier 0, material NULL)
    // and is already a Tinkers tool.
    if (ns == "gtceu" && TT_IGTTool && item instanceof TT_IGTTool) {
        let gName = String(item.getMaterial().getName())
        if (gName == "" || gName == "null") return null
        let gElec = !!item.isElectric()
        let gVolt = gElec ? TT_VOLTS[Number(item.getElectricTier())] || "lv" : null
        if (gElec && !TINKERS_BATTERY[gVolt]) return { skip: "no gregic battery for voltage " + gVolt }
        // electric type names carry the voltage ("lv_drill", "hv_wirecutter"); buzzsaw has none
        let gType = String(item.getToolType().name).replace(/^(lv|mv|hv|ev|iv)_/, "")
        if (gElec ? !TINKERS_POWERED[gType] : !TINKERS_SPECS[gType]) return null // mortar, shears: stay GT
        // GT diamond/netherite have no Tinkers or gm_construct material: same stand-ins as vanilla (cobalt/manyullyn), so the
        // tools still convert (loot) and their recipes follow removeStandInRecipes
        let gStand = STAND_IN_ALIAS[gName]
        let gMat = gStand ? "tconstruct:" + gStand : gtMaterial(gName, gElec ? "powered" : gType)
        if (!gMat) return { skip: "no Tinkers material for GT material " + gName }
        return { type: gType, mat: gMat, volt: gVolt, standIn: !!gStand, src: "gt api" }
    }

    let tType = toolType(item)
    if (SKIP_NS[ns]) return tType ? { skip: SKIP_NS[ns] } : null
    if (!tType) return null
    if (ONLY_NS[ns]) {
        let om = ONLY_NS[ns].exec(path)
        if (!om) return { skip: "special tool (" + ns + ")" }
        if (ns == "aether") {
            if (!global.AETHER_TINKERS_MATERIALS || !Platform.isLoaded("aether")) return { skip: "Aether Tinkers materials disabled" }
            return { type: tType, mat: AETHER_MATERIALS[om[1] || "valkyrie"], src: "curated" }
        }
        if (ns == "ae2" || ns == "iceandfire") {
            if (!global.AETHER_TINKERS_MATERIALS && ns == "ae2") return { skip: "kubejs Tinkers materials disabled" }
            let kn = om[1] || "dragonbone_" + om[3] // dragonbone_sword_<element> -> elemental dragonbone material
            let km = KUBEJS_MATERIALS[kn]
            if (!km && /^dragonsteel_/.test(kn)) km = "gm_construct:" + kn
            if (km && /^kubejs:/.test(km) && !global.AETHER_TINKERS_MATERIALS) return { skip: "kubejs Tinkers materials disabled" }
            if (km) return { type: tType, mat: km, src: "curated" }
            // copper / silver fall through to the generic resolver
        }
        let oMat = genericMaterial(om[1])
        return oMat ? { type: tType, mat: oMat.mat, standIn: oMat.standIn, src: "curated" } : { skip: "no Tinkers material " + om[1] }
    }
    // generic, by DATA: (a) vanilla Tiers constants are compared as objects (tier.name()); (b) other tiers use the repair ingredient
    // JSON (tags are readable as JSON even though unbound at startup). (c) LIMITATION / fallback: only when the ingredient name does
    // not resolve (empty or odd ingredient) is the tool's id prefix used ("emerald_pickaxe" -> emerald).
    let prefixName = path.replace(/_(pickaxe|axe|shovel|hoe|sword)$/, "")
    let tier = null
    try {
        tier = item.getTier()
    } catch (e) {}
    let vanillaTier = !!tier && tier instanceof TT_Tiers
    let ingName = null
    try {
        ingName = ingredientName(String(tier.getRepairIngredient().toJson()))
    } catch (e) {}
    // name-derived material first; for tools sitting on a vanilla Tiers constant only an EXACT result counts here (a modded
    // copper_/flint_ tool on Tiers.STONE must become copper/flint, not rock), stand-ins wait for the tier mapping below
    let cands = [ingName, prefixName]
    for (let i = 0; i < cands.length; i++) {
        let nr = cands[i] ? genericMaterial(cands[i]) : null
        if (nr && !(vanillaTier && nr.standIn)) return { type: tType, mat: nr.mat, standIn: nr.standIn, src: i == 0 ? "generic tier" : "prefix fallback" }
    }
    if (vanillaTier) {
        let vr = genericMaterial(VANILLA_TIERS[String(tier.name())])
        if (vr) return { type: tType, mat: vr.mat, standIn: vr.standIn, src: "vanilla tier" }
        return { skip: "unknown vanilla tier " + prefixName }
    }
    if (isGold(ingName) || isGold(prefixName)) return { skip: "golden tool but kubejs:gold is disabled (no generated gold material)" }
    try {
        return { type: tType, mat: autoMaterial(item, ingName || prefixName), auto: true, src: "auto" }
    } catch (e) {
        return { skip: "cannot read tier (" + e + ")" }
    }
}

global.TINKERS_PLAN = {} // every converted id (recipes + loot, hidden in EMI/JEI)
global.TINKERS_SKIPPED = {}
global.TINKERS_UNMAPPED = {}
const UNMAPPED_RE = /^(no Tinkers material|unknown vanilla tier|cannot read tier|golden tool but)/

// One registry walk, once. Built lazily on first use (client asset generation can run before postInit during the
// first resource reload) and at postInit at the latest; every consumer calls global.tinkersEnsurePlan() first.
const PARTS_CACHE = {}
let planBuilt = false
let builtWithGt = false
const clearObj = (o) => Object.keys(o).forEach((k) => { delete o[k] })
// Builds the plan once. A build made before GT is loadable (client assets can run very early) still serves consumers, but is
// rebuilt at postInit (final = true) when GT classes are available then. Maps are cleared in place: scripts hold references.
const buildPlan = (final) => {
    if (planBuilt && !(final && !builtWithGt)) return
    if (planBuilt) {
        console.info("[tinkers tools] plan: rebuilding at postInit (first build ran without GT classes)")
        clearObj(global.TINKERS_PLAN)
        clearObj(global.TINKERS_SKIPPED)
        clearObj(global.TINKERS_UNMAPPED)
        clearObj(global.TINKERS_HIDE_ONLY)
        clearObj(global.TINKERS_AUTO)
        clearObj(PARTS_CACHE)
    }
    planBuilt = true
    let t0 = Date.now()
    let keys = TT_ForgeRegistries.ITEMS.getKeys()
    let errors = 0
    let bySrc = {}
    let standIns = 0
    let golds = 0
    try {
        gtClasses() // lazily, now that GT is initialised
        builtWithGt = !!TT_IGTTool
    } catch (e) {
        builtWithGt = false
        console.error("[tinkers tools] cannot load GT classes, GT tools stay GT" + (final ? "" : " (retrying at postInit)") + ": " + e)
    }
    keys.forEach((rl) => {
        let id = String(rl)
        let p = null
        if (HIDE_ONLY.indexOf(id) >= 0) global.TINKERS_HIDE_ONLY[id] = true
        try {
            p = planFor(id, TT_ForgeRegistries.ITEMS.getValue(rl))
        } catch (e) {
            // one bad item must not leave the whole plan empty; log the first few
            if (errors++ < 10) console.error("[tinkers tools] plan failed for " + id + ": " + e)
            return
        }
        if (!p) return
        if (p.skip) {
            global.TINKERS_SKIPPED[id] = p.skip
            // plain tools with no Tinkers material (not the special-ability skips): removeUnmappedToolRecipes candidates
            if (UNMAPPED_RE.test(p.skip)) global.TINKERS_UNMAPPED[id] = true
        }
        else {
            // provenance only: stand-in tools (diamond -> cobalt, netherite -> manyullyn) never get their recipes swapped
            if (p.standIn) p.substitute = true
            // by resolved material, not by name: "rose_gold" contains the word gold but is an exact Tinkers material
            if (p.mat == "kubejs:gold") p.gold = true // tools only: golden ARMOR (tconstruct:gold plating) stays craftable
            bySrc[p.src || "other"] = (bySrc[p.src || "other"] || 0) + 1
            if (p.substitute) standIns++
            if (p.gold) golds++
            global.TINKERS_PLAN[id] = p
        }
    })
    let autos = Object.keys(global.TINKERS_AUTO)
    if (errors > 0) console.error("[tinkers tools] plan: " + errors + " items failed (first 10 logged above)")
    console.info("[tinkers tools] plan: walked " + keys.size() + " items in " + (Date.now() - t0) + " ms, converted " +
        Object.keys(global.TINKERS_PLAN).length + ", skipped " + Object.keys(global.TINKERS_SKIPPED).length + ", generated materials " + autos.length)
    console.info("[tinkers tools] converted by source: " + Object.keys(bySrc).map((k) => k + "=" + bySrc[k]).join(", ") +
        "; stand-ins " + standIns + ", gold " + golds)
    autos.forEach((n) => {
        let a = global.TINKERS_AUTO[n]
        console.info("[tinkers tools] generated " + a.id + ": uses " + a.uses + ", speed " + a.speed + ", attack " + a.attack +
            ", tier " + a.miningTier + ", colour #" + a.color + " (" + a.colorSource + ")")
    })
}
global.tinkersEnsurePlan = () => buildPlan(false)
StartupEvents.postInit(() => buildPlan(true))

// handle/binding material by id prefix (the original recipes' stick substitute), checked before the namespace rules
const HANDLE_BY_PREFIX = [
    ["twilightforest:fiery_", "tconstruct:blazing_bone"] // original recipe uses blaze rods
]
const HANDLE_BY_NS = (id) => {
    for (let i = 0; i < HANDLE_BY_PREFIX.length; i++) if (id.indexOf(HANDLE_BY_PREFIX[i][0]) == 0) return HANDLE_BY_PREFIX[i][1]
    if (id.indexOf("aether:") == 0) return "kubejs:skyroot"
    if (/^iceandfire:(dragon|myrmex)/.test(id)) return "tconstruct:necrotic_bone"
    return "tconstruct:wood"
}

// { tool, mats } for a converted tool id, or null
global.tinkersPartsFor = (id) => {
    id = String(id)
    const p = global.TINKERS_PLAN[id]
    if (!p) return null
    if (PARTS_CACHE[id]) return PARTS_CACHE[id]
    let tool
    let slots
    if (p.volt) {
        tool = TINKERS_POWERED[p.type]
        slots = "hceb"
    } else {
        tool = TINKERS_SPECS[p.type][0]
        slots = TINKERS_SPECS[p.type][1]
    }
    // handle/binding: SPECIAL's handle, else by namespace (no recipes exist at startup), else wood
    const handle = p.handle || HANDLE_BY_NS(String(id))
    const mats = slots.split("").map((s) => {
        if (s == "h" || s == "p") return p.mat
        if (s == "m") return ARMOR_MAILLE_FOR[p.mat] || (p.mat.indexOf("kubejs:") == 0 ? p.mat : ARMOR_MAILLE)
        if (s == "l") return "tconstruct:leather"
        if (s == "c") return "tconstruct:steel"
        if (s == "e") return "gregic_tinkering:" + p.volt + "_electric"
        if (s == "b") return TINKERS_BATTERY[p.volt]
        return handle
    })
    PARTS_CACHE[id] = { tool: tool, mats: mats }
    return PARTS_CACHE[id]
}

global.tinkersStackFor = (id) => {
    const parts = global.tinkersPartsFor(id)
    return parts ? Item.of(parts.tool, { tic_materials: parts.mats }) : null
}
})()
