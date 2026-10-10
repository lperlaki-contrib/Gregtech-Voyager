// Generates the Tinkers modifiers for modded enchantments from global.TINKERS_ENCH_MODIFIERS
// (startup_scripts/util/tinkersEnchantModifiers.js): modifier definitions, tconstruct:modifier recipes (enchanted book
// in the Tinker Station) and the enchantment -> modifier map (Worktable crystals, loot conversion).
// Rhino: no spread/destructuring, no const in loops.
var TEM_ForgeRegistries = Java.loadClass("net.minecraftforge.registries.ForgeRegistries")
var TEM_ResourceLocation = Java.loadClass("net.minecraft.resources.ResourceLocation")

ServerEvents.highPriorityData(function (event) {
    var table = global.TINKERS_ENCH_MODIFIERS
    var map = {}
    Object.keys(table).forEach(function (ench) {
        if (!TEM_ForgeRegistries.ENCHANTMENTS.containsKey(new TEM_ResourceLocation(ench))) {
            console.info("[tinkers enchants] skipping unregistered enchantment " + ench)
            return
        }
        var e = table[ench]
        var mod = global.temModifierId(ench)
        map[ench] = mod
        if (e.m) return
        var path = mod.split(":")[1]
        event.addJson("kubejs:tinkering/modifiers/" + path, {
            level_display: e.max > 1 ? "tconstruct:default" : "tconstruct:no_levels",
            modules: [{ type: "tconstruct:constant_enchantment", level: 1, name: ench }],
            tooltip_display: "always"
        })
        // partial_nbt matches list entries by subset, so {id} finds the enchantment at any level (lvl is a short)
        var slots = {}
        slots[e.ab ? "abilities" : "upgrades"] = 1
        event.addJson("kubejs:recipes/tools/modifiers/enchanted/" + path, {
            type: "tconstruct:modifier",
            allow_crystal: true,
            inputs: [{ type: "forge:partial_nbt", item: "minecraft:enchanted_book", nbt: { StoredEnchantments: [{ id: ench }] } }],
            level: { max: e.max },
            result: mod,
            slots: slots,
            tools: e.tl.map(function (t) {
                return t.charAt(0) == "#" ? { tag: t.substring(1) } : { item: t }
            })
        })
    })
    // Tinkers reads every pack's copy of this file and merges them, so this only adds our entries
    event.addJson("tconstruct:tinkering/enchantments_to_modifiers", map)
})
