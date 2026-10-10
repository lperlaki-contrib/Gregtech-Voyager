// Lang of the enchantment modifiers generated from global.TINKERS_ENCH_MODIFIERS
// (startup_scripts/util/tinkersEnchantModifiers.js). Mapped entries (m) use Tinkers' own modifiers and lang.
ClientEvents.lang("en_us", (event) => {
    let table = global.TINKERS_ENCH_MODIFIERS
    Object.keys(table).forEach((ench) => {
        let e = table[ench]
        if (e.m) return
        let key = "modifier." + global.temModifierId(ench).replace(":", ".")
        event.add("kubejs", key, e.n)
        event.add("kubejs", key + ".flavor", "Enchanted by the book.")
        event.add("kubejs", key + ".description", e.d)
    })
})
