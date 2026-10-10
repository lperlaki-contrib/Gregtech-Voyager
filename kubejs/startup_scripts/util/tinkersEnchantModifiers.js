// One table for the modded enchantments that become Tinkers modifiers. From it:
//   - server_scripts/tinkers_special/enchant_modifiers_data.js generates the modifiers (kubejs:ench_<name>, one
//     tconstruct:constant_enchantment module each), their tconstruct:modifier recipes (input: an enchanted book carrying
//     the enchantment, +1 level per book) and tconstruct:tinkering/enchantments_to_modifiers.json (Tinkers merges that
//     file across packs; it drives the Worktable book -> crystal conversion and global.toTinkersTool's loot conversion),
//   - client_scripts/tinkersEnchantLang.js generates the modifier lang.
// Entries whose enchantment is not registered are skipped (mod missing or enchantment removed).
//
// Table fields: m = existing Tinkers modifier (mapping only, nothing generated); otherwise n = name, d = description
// (both copied from the owning mod's lang), max = enchantment max level, ab = costs an ability slot (else an upgrade),
// tl = tools allowed ("#tag" or item id).
// Every enchantment here was checked against its mod's code: it reads the level through ItemStack.getEnchantmentLevel /
// EnchantmentHelper.getItemEnchantmentLevel / getEnchantmentLevel(ench, entity), which Forge routes to Tinkers' modifier
// enchantments, and it does not require a vanilla item class. icy_thorns and rebounding run from doPostHurt, called by
// vanilla's enchantment iteration (Forge patches it to getAllEnchantments).
// Left out: apotheosis:tempting (needs a HoeItem), ars_nouveau:mana_boost/mana_regen (need ItemStack.isEnchanted(), raw
// NBT), ars_nouveau:reactive (no books, spell set by the apparatus), ars_elemental:mirror_shield (Enchanter's Shield
// only), twilightforest:destruction (Block and Chain only), forbidden_arcanus:permafrost (Edelwood bucket only),
// forbidden_arcanus:indestructible and damage:disjunction (not registered in this version, lang only).
// Rhino: no spread/destructuring, no const in loops.

var TEM_MELEE = ["#tconstruct:modifiable/melee"]
var TEM_DURABLE = ["#tconstruct:modifiable/durability"]

global.TINKERS_ENCH_MODIFIERS = {
    // mappings onto existing Tinkers modifiers
    "apotheosis:bane_of_illagers": { m: "tconstruct:killager" },
    "apotheosis:magic_protection": { m: "tconstruct:magic_protection" }, // not registered in Apotheosis 7.4.8, skipped until it is
    "ars_elemental:soulbound": { m: "tconstruct:soulbound" },

    // weapons (handlers read the killer's main hand)
    "apotheosis:capturing": { n: "Capturing", d: "Makes mobs have a chance to drop their spawn egg.", max: 5, ab: true, tl: TEM_MELEE },
    "apotheosis:knowledge": { n: "Knowledge of the Ages", d: "Enemy drops are directly converted to experience.", max: 3, ab: true, tl: TEM_MELEE },
    "apotheosis:scavenger": { n: "Scavenger", d: "Mobs killed may roll their loot tables twice.", max: 3, ab: true, tl: TEM_MELEE },
    "farmersdelight:backstabbing": { n: "Backstabbing", d: "Amplifies damage when striking a target from behind.", max: 3, tl: TEM_MELEE },

    // harvest tools
    "apotheosis:miners_fervor": { n: "Miner's Fervor", d: "You will mine very fast, but never instantly.", max: 5, ab: true, tl: ["#tconstruct:modifiable/harvest"] },
    "apotheosis:earths_boon": { n: "Boon of the Earth", d: "Ores may be found when mining stone.", max: 3, tl: ["#tconstruct:modifiable/harvest/stone"] },
    "apotheosis:chainsaw": { n: "Chainsaw", d: "Trees will be annihilated.", max: 1, ab: true, tl: ["tconstruct:hand_axe", "tconstruct:broad_axe"] },
    "apotheosis:natures_blessing": { n: "Nature's Blessing", d: "Hoes may be used to bonemeal crops.", max: 3, tl: ["tconstruct:kama", "tconstruct:scythe"] },

    // any tool or armor with durability
    "apotheosis:life_mending": { n: "Life-Mending", d: "Consumes received healing to repair items.", max: 3, ab: true, tl: TEM_DURABLE },
    "naturesaura:aura_mending": { n: "Nature's Mend", d: "Repairs tools using Aura.", max: 1, tl: TEM_DURABLE },

    // armor
    "apotheosis:berserkers_fury": { n: "Berserker's Fury", d: "Become enraged when taking damage.", max: 3, ab: true, tl: ["#tconstruct:modifiable/armor/chestplate"] },
    "apotheosis:icy_thorns": { n: "Icy Thorns", d: "Slows attackers.", max: 3, tl: ["#tconstruct:modifiable/armor/chestplate"] },
    "apotheosis:rebounding": { n: "Rebounding", d: "Melee attackers may find themselves much further away.", max: 3, tl: ["#tconstruct:modifiable/armor/chestplate", "#tconstruct:modifiable/armor/leggings"] },
    "apotheosis:stable_footing": { n: "Stable Footing", d: "Negates the mining speed penalty for flying.", max: 1, tl: ["#tconstruct:modifiable/armor/boots"] }
}

// kubejs:ench_<path> for a generated entry, or the mapped Tinkers modifier
global.temModifierId = (ench) => {
    var e = global.TINKERS_ENCH_MODIFIERS[ench]
    return e.m || "kubejs:ench_" + ench.split(":")[1]
}
