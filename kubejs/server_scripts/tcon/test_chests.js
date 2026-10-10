// TEST ONLY (branch test/tinkers-test-chests, merged into playtest/all only; delete this file before release).
var TC_ToolStack = Java.loadClass("slimeknights.tconstruct.library.tools.nbt.ToolStack")
// /kubejs custom_command tinkers_test_chests: Sophisticated Storage netherite chests in a row east of the player, filled with
// PAIRS (left: the item with our modifiers, right: what to compare it with), 4 pairs per row of 12 with a gap, each section on
// a new row:
//   1. tools/weapons and 2. armor made from our materials (kubejs:* and dragonsteel: Aether, Twilight Forest, Ice and Fire, AE2,
//      Nature's Aura abilities and set bonuses) | the original item they replace (same material; the Tinkers version of a
//      material always carries its ability)
//   3. our knives | the original knife
//   3a. bows, crossbows, shields | the original
//   3b. powered tools, one per GT tool type and voltage: gregic Tinkers version | GT's original, both fully charged
//   4. one tool per enchantment modifier (tinkersEnchantModifiers.js) at max level | the same Tinkers tool without it
//   5. vanilla tools enchanted like loot (level 30) through the real loot conversion | the original enchanted item
//   6. Apotheosis random affix loot, 2 per rarity | the same item without its affixes
//   7. supplies to test the modifiers (spawn eggs, food, healing, upgrade/smithing/socketing materials, modded books)
// Test only.
var TC_ModifierId = Java.loadClass("slimeknights.tconstruct.library.modifiers.ModifierId")
var TC_EnchHelper = Java.loadClass("net.minecraft.world.item.enchantment.EnchantmentHelper")
var TC_ForgeRegistries = Java.loadClass("net.minecraftforge.registries.ForgeRegistries")
var TC_ResourceLocation = Java.loadClass("net.minecraft.resources.ResourceLocation")
var TC_GTCap = Java.loadClass("com.gregtechceu.gtceu.api.capability.GTCapabilityHelper")
var TC_CHEST = "sophisticatedstorage:netherite_chest"
var TC_RANGED = ["bow", "crossbow", "shield"] // plan types of feat/tinkers-ranged
var TC_ROW = 12 // netherite chest: 132 slots, 12 per row
var TC_LOOT_TOOLS = ["minecraft:iron_sword", "minecraft:iron_pickaxe", "minecraft:iron_axe", "minecraft:golden_sword",
    "minecraft:golden_pickaxe", "minecraft:diamond_sword", "minecraft:diamond_pickaxe", "minecraft:diamond_shovel",
    "minecraft:iron_helmet", "minecraft:diamond_chestplate", "minecraft:iron_boots"]
// supplies: [item, count] or [id, count, nbt]
var TC_SUPPLIES = [
    // targets: undead (Holy, Smite), arthropods, illagers (Bane of Illagers), pigs/piglins (Pig Slayer), animals (Capturing,
    // Scavenger, Knowledge, butcher knife), a husk for backstab tests (doesn't burn)
    ["minecraft:zombie_spawn_egg", 16], ["minecraft:husk_spawn_egg", 16], ["minecraft:skeleton_spawn_egg", 16],
    ["minecraft:spider_spawn_egg", 16], ["minecraft:vindicator_spawn_egg", 16], ["minecraft:pillager_spawn_egg", 16],
    ["minecraft:pig_spawn_egg", 16], ["minecraft:piglin_spawn_egg", 16], ["minecraft:hoglin_spawn_egg", 16],
    ["minecraft:cow_spawn_egg", 16], ["minecraft:sheep_spawn_egg", 16], ["minecraft:chicken_spawn_egg", 16],
    // survival: food, healing (Life-Mending repairs from healing), regeneration, totem
    ["minecraft:cooked_beef", 64], ["minecraft:golden_apple", 16], ["minecraft:enchanted_golden_apple", 4], ["minecraft:totem_of_undying", 2],
    ["minecraft:potion", 4, { Potion: "minecraft:strong_healing" }], ["minecraft:splash_potion", 8, { Potion: "minecraft:strong_healing" }],
    ["minecraft:potion", 4, { Potion: "minecraft:long_regeneration" }], ["minecraft:experience_bottle", 64],
    // blocks: stone/ores (Miner's Fervor, Boon of the Earth, hammers), dirt/sand/gravel (shovel, Elementium-like column),
    // saplings + bone meal (Chainsaw on grown trees), seeds (Nature's Blessing), obsidian (giant pickaxe)
    ["minecraft:stone", 64], ["minecraft:deepslate", 64], ["minecraft:dirt", 64], ["minecraft:sand", 64], ["minecraft:gravel", 64],
    ["minecraft:oak_sapling", 16], ["minecraft:bone_meal", 64], ["minecraft:wheat_seeds", 32], ["minecraft:obsidian", 16],
    // upgrade recipes: fiery (Twilight Forest), fluix smithing (AE2), ghost sword (Ice and Fire)
    ["twilightforest:fiery_blood", 16], ["twilightforest:fiery_tears", 16], ["minecraft:blaze_rod", 16],
    ["ae2:fluix_upgrade_smithing_template", 4], ["ae2:fluix_block", 8], ["iceandfire:ghost_ingot", 4], ["minecraft:smithing_table", 1],
    // Apotheosis sockets: sigils + the enchantment-level gems (Earth, Inferno, Endersurge)
    ["apotheosis:sigil_of_socketing", 16], ["apotheosis:sigil_of_withdrawal", 8],
    ["apotheosis:gem", 1, { gem: "apotheosis:overworld/earth", rarity: "apotheosis:mythic" }],
    ["apotheosis:gem", 1, { gem: "apotheosis:the_nether/inferno", rarity: "apotheosis:mythic" }],
    ["apotheosis:gem", 1, { gem: "apotheosis:the_end/endersurge", rarity: "apotheosis:mythic" }],
    // Tinkers: station and a worktable (enchanted book -> crystal)
    ["tconstruct:tinker_station", 1], ["tconstruct:modifier_worktable", 1]
]
var TC_ENCH_BASE = { // first allowed-tools entry -> the plan id whose Tinkers tool carries it
    "#tconstruct:modifiable/melee": "minecraft:iron_sword",
    "#tconstruct:modifiable/harvest": "minecraft:iron_pickaxe",
    "#tconstruct:modifiable/harvest/stone": "minecraft:iron_pickaxe",
    "tconstruct:hand_axe": "minecraft:iron_axe",
    "tconstruct:kama": "minecraft:iron_hoe",
    "#tconstruct:modifiable/durability": "minecraft:iron_pickaxe",
    "#tconstruct:modifiable/armor/chestplate": "minecraft:iron_chestplate",
    "#tconstruct:modifiable/armor/leggings": "minecraft:iron_leggings",
    "#tconstruct:modifiable/armor/boots": "minecraft:iron_boots"
}
// fully charged copy (GT electric capability; gregic_tinkering exposes the same one on its Tinkers tools)
function tcCharged(stack) {
    try {
        let e = TC_GTCap.getElectricItem(stack)
        if (e != null) e.charge(e.getMaxCharge(), e.getTier(), true, false)
    } catch (err) {
        console.warn("[tinkers test chests] charging " + stack.id + ": " + err)
    }
    return stack
}
ServerEvents.customCommand("tinkers_test_chests", (event) => {
    let player = event.player
    if (!player) return
    global.tinkersEnsurePlan()
    let plan = global.TINKERS_PLAN
    let tools = []
    let armor = []
    let knives = []
    let seen = {}
    Object.keys(plan).sort().forEach((id) => {
        let parts = global.tinkersPartsFor(id)
        if (!parts || TC_RANGED.indexOf(plan[id].type) >= 0) return // own section below
        let ours = parts.mats.some((m) => m.indexOf("kubejs:") == 0 || m.indexOf("dragonsteel") >= 0)
        let knife = parts.tool == "kubejs:knife" || parts.tool == "kubejs:butcher_knife"
        if (!ours && !(knife && knives.length < 2)) return
        let key = parts.tool + "|" + parts.mats.join(",")
        if (seen[key]) return
        seen[key] = true
        let pair = [global.tinkersStackFor(id), Item.of(id)]
        if (!ours) knives.push(pair)
        else if (plan[id].armor) armor.push(pair)
        else tools.push(pair)
    })
    // bows, crossbows, shields (feat/tinkers-ranged): every converted one | its original
    let ranged = []
    Object.keys(plan).sort().forEach((id) => {
        let p = plan[id]
        if (TC_RANGED.indexOf(p.type) < 0) return
        let parts = global.tinkersPartsFor(id)
        let key = parts.tool + "|" + parts.mats.join(",")
        if (seen[key]) return
        seen[key] = true
        ranged.push([global.tinkersStackFor(id), Item.of(id)])
    })
    // powered tools: one per GT tool type and voltage, the gregic Tinkers version | GT's original, both fully charged
    let powered = []
    let poweredSeen = {}
    Object.keys(plan).sort().forEach((id) => {
        let p = plan[id]
        if (!p.volt || poweredSeen[p.type + "|" + p.volt]) return
        poweredSeen[p.type + "|" + p.volt] = true
        powered.push([tcCharged(global.tinkersStackFor(id)), tcCharged(Item.of(id))])
    })
    let enchanted = []
    let table = global.TINKERS_ENCH_MODIFIERS || {}
    Object.keys(table).forEach((ench) => {
        let e = table[ench]
        let baseId = TC_ENCH_BASE[e.tl ? e.tl[0] : "#tconstruct:modifiable/melee"]
        let stack = baseId ? global.tinkersStackFor(baseId) : null
        if (!stack) return
        try {
            let tool = TC_ToolStack.from(stack)
            tool.addModifier(TC_ModifierId.tryParse(global.temModifierId(ench)), e.max || 1)
            tool.rebuildStats()
            stack.setHoverName(Text.translate("modifier." + global.temModifierId(ench).replace(":", ".")).gold()) // modifier name
            enchanted.push([stack, global.tinkersStackFor(baseId)])
        } catch (err) {
            console.warn("[tinkers test chests] " + ench + ": " + err) // modifier missing (enchantment not registered)
        }
    })
    let level = player.level
    let rand = player.getRandom()
    let loot = []
    TC_LOOT_TOOLS.forEach((id) => {
        try {
            let orig = TC_EnchHelper.enchantItem(rand, Item.of(id), 30, false)
            let conv = global.toTinkersTool(orig.copy())
            if (conv) loot.push([conv, orig])
        } catch (err) {
            console.warn("[tinkers test chests] enchanted " + id + ": " + err)
        }
    })
    let affixed = []
    try {
        let LootController = Java.loadClass("dev.shadowsoffire.apotheosis.adventure.loot.LootController")
        let RarityRegistry = Java.loadClass("dev.shadowsoffire.apotheosis.adventure.loot.RarityRegistry")
        for (let r = 0; r < 6; r++) {
            for (let n = 0; n < 2; n++) {
                let item = LootController.createRandomLootItem(rand, RarityRegistry.byOrdinal(r).get(), player, level)
                if (!item || item.isEmpty()) continue
                item = global.toTinkersTool(item) || item // vanilla affix entries (e.g. iron armor) convert like real loot
                let plain = item.copy()
                if (plain.nbt) {
                    let tag = plain.nbt.copy()
                    tag.remove("affix_data")
                    plain.nbt = tag
                }
                affixed.push([item, plain])
            }
        }
    } catch (err) {
        console.warn("[tinkers test chests] Apotheosis affix loot: " + err)
    }

    // supplies (single items, not pairs) + one enchanted book per enchantment modifier (Tinker Station / Worktable tests)
    let supplies = []
    TC_SUPPLIES.forEach((sup) => {
        try {
            let st = sup[2] ? Item.of(sup[0], sup[1], sup[2]) : Item.of(sup[0], sup[1])
            if (!st.isEmpty()) supplies.push([st, null])
        } catch (err) {
            console.warn("[tinkers test chests] supply " + sup[0] + ": " + err)
        }
    })
    Object.keys(table).forEach((ench) => {
        supplies.push([Item.of("minecraft:enchanted_book", 1, { StoredEnchantments: [{ id: ench, lvl: 1 }] }), null])
    })

    // place: pairs at columns 0/3/6/9 of a row, sections start on a new row, a full chest continues in the next one
    let chestBlock = TC_ForgeRegistries.BLOCKS.getValue(new TC_ResourceLocation(TC_CHEST))
    let origin = player.blockPosition()
    let chests = 0
    let inv = null
    let size = 0
    let slot = 0
    let items = 0
    function nextChest() {
        let pos = origin.offset(2 + chests * 2, 0, 0)
        level.setBlock(pos, chestBlock.defaultBlockState(), 3)
        inv = level.getBlockEntity(pos).getStorageWrapper().getInventoryHandler()
        size = inv.getSlots()
        slot = 0
        chests++
    }
    nextChest()
    
    ;[tools, armor, knives, ranged, powered, enchanted, loot, affixed].forEach((section) => {
        if (slot % TC_ROW != 0) slot += TC_ROW - (slot % TC_ROW) // new row
        section.forEach((pair) => {
            if (slot % TC_ROW > TC_ROW - 2) slot += TC_ROW - (slot % TC_ROW) // pair must fit in the row
            if (slot + 1 >= size) nextChest()
            inv.setStackInSlot(slot, pair[0])
            if (pair[1]) inv.setStackInSlot(slot + 1, pair[1])
            items += 2
            slot += 3
        })
    })
    if (slot % TC_ROW != 0) slot += TC_ROW - (slot % TC_ROW)
    supplies.forEach((sup) => {
        if (slot >= size) nextChest()
        inv.setStackInSlot(slot, sup[0])
        slot++
        items++
    })
    let msg = "[tinkers test chests] " + items + " items (" + tools.length + " tools, " + armor.length + " armor, " + knives.length +
        " knives, " + ranged.length + " bows/shields, " + powered.length + " powered, " + enchanted.length + " enchant modifiers, " + loot.length + " enchanted loot, " + affixed.length +
        " affix loot, " + supplies.length + " supplies) in " + chests + " chests east of you; left = ours, right = compare"
    console.info(msg)
    player.tell(msg)
})
