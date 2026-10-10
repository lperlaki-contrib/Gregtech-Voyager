// Lang of the enchantment modifiers generated from global.TINKERS_ENCH_MODIFIERS
// (startup_scripts/util/tinkersEnchantModifiers.js). Mapped entries (m) use Tinkers' own modifiers and lang.
function temModName(ns) {
    try {
        return String(Platform.getInfo(ns).getName())
    } catch (e) {
        return ns
    }
}
ClientEvents.lang("en_us", (event) => {
    let table = global.TINKERS_ENCH_MODIFIERS
    Object.keys(table).forEach((ench) => {
        let e = table[ench]
        if (e.m) return
        let key = "modifier." + global.temModifierId(ench).replace(":", ".")
        event.add("kubejs", key, e.n)
        event.add("kubejs", key + ".flavor", "Enchantment from " + temModName(ench.split(":")[0])) // source mod
        event.add("kubejs", key + ".description", e.d)
    })
})

// Modifier icons (Tinker Station, book): the enchanted book sprite, Enchanted Book Redesign's when installed. Tinkers merges
// tinkering/modifier_icons.json from every namespace/pack.
ClientEvents.highPriorityAssets((event) => {
    let book = Platform.isLoaded("enchantedbookredesign") ? "enchantedbookredesign:item/enchanted_book" : "minecraft:item/enchanted_book"
    let icons = {}
    Object.keys(global.TINKERS_ENCH_MODIFIERS).forEach((ench) => {
        if (!global.TINKERS_ENCH_MODIFIERS[ench].m) icons[global.temModifierId(ench)] = book
    })
    event.add("kubejs:tinkering/modifier_icons", icons)
})
