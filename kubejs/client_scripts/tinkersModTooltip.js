// Tinkers tools made from another mod's materials (see startup_scripts/tinkers/tinkers_plan.js) get a blue italic line naming
// that mod, like EMI's mod-name line, so they still "feel" like the original tool. GT materials are skipped (they are everywhere).
// Only the head material (first tic_materials entry; plating for plate shields) is checked; the regex result is memoised per material id, so a tooltip
// costs one NBT read + one map lookup. Rhino: no spread/destructuring.
ItemEvents.tooltip((event) => {
    const memo = {}
    const ORIGIN = [
        [/^kubejs:na_/, "Nature's Aura"],
        [/^kubejs:(skyroot|holystone|zanite|gravitite|valkyrie|aether_\w+)$/, "The Aether"],
        [/^kubejs:(dragonbone|myrmex|dragonsteel|iaf_)|^gm_construct:dragonsteel_/, "Ice and Fire"],
        [/^kubejs:(certus_quartz|fluix)$|^tconstruct:quartz$/, "Applied Energistics 2"],
        [/^tconstruct:(ironwood|steeleaf|knightmetal|fiery)$|^kubejs:tf_/, "Twilight Forest"],
        [/^kubejs:eo_/, "Enderman Overhaul"]
    ]
    // every Tinkers tool item the plan converts to (all tools and armor, knives, gregic tools, travelers gear), built once per tooltip event
    global.tinkersEnsurePlan() // plan may not be built yet (startup order)
    const seen = {}
    Object.keys(global.TINKERS_PLAN).forEach((id) => {
        seen[global.tinkersPartsFor(id).tool] = true
    })
    const tools = Object.keys(seen)
    event.addAdvanced(tools, (item, advanced, text) => {
        const nbt = item.nbt
        if (!nbt || !nbt.contains("tic_materials")) return
        const mats = nbt.getList("tic_materials", 8)
        if (mats.size() == 0) return
        // plate shields: the plating (index 1) is the defining material, index 0 is the wooden core
        const head = String(mats.getString(item.id == "tconstruct:plate_shield" && mats.size() > 1 ? 1 : 0))
        let mod = memo[head]
        if (mod === undefined) {
            mod = null
            for (let i = 0; i < ORIGIN.length; i++) {
                if (ORIGIN[i][0].test(head)) {
                    mod = ORIGIN[i][1]
                    break
                }
            }
            memo[head] = mod
        }
        if (mod) text.add(1, Text.of("§9§o" + mod))
    })
})
