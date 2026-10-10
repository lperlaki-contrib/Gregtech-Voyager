// Mirrors gm_construct's extruder/solidifier part recipes (MV, 20 * mass * cost ticks, gold cast not consumed)
// for the materials gm_construct ignores, which use native tconstruct:<mat> materials.
ServerEvents.recipes((event) => {
    // part -> ingot cost
    const parts = {
        repair_kit: 2, pick_head: 2, hammer_head: 8, small_axe_head: 2, broad_axe_head: 8,
        small_blade: 2, broad_blade: 8, bow_limb: 2, bow_grip: 2, tool_binding: 1,
        tough_binding: 3, adze_head: 2, large_plate: 4, tool_handle: 1, tough_handle: 3, maille: 2,
    }
    const mats = ["iron", "steel", "bronze", "copper", "cobalt", "invar", "rose_gold"]

    mats.forEach((mat) => {
        const mass = GTMaterials.get(mat).getMass()
        Object.keys(parts).forEach((part) => {
            const cost = parts[part]
            const out = Item.of(`tconstruct:${part}`, `{Material:"tconstruct:${mat}"}`)
            const cast = `tconstruct:${part}_cast`
            const duration = 20 * mass * cost

            event.recipes.gtceu.extruder(`kubejs:tinkers_${mat}_${part}_extruder`)
                .itemInputs(`${cost}x #forge:ingots/${mat}`)
                .notConsumable(cast)
                .itemOutputs(out)
                .duration(duration)
                .EUt(128)

            event.recipes.gtceu.fluid_solidifier(`kubejs:tinkers_${mat}_${part}_solidifier`)
                .inputFluids(`gtceu:${mat} ${cost * 144}`)
                .notConsumable(cast)
                .itemOutputs(out)
                .duration(duration)
                .EUt(128)
        })
    })
})
