// Data for the Tinkers materials generated from tool tiers (global.TINKERS_AUTO, built once at startup in
// startup_scripts/tinkers/tinkers_plan.js). Injected into the virtual KubeJS datapack BEFORE Tinkers' material/stat loaders and the
// recipe manager read the datapacks (ServerEvents.highPriorityData), so no /reload or generated files are needed.
// Per material kubejs:auto_<name>:
//   tinkering/materials/definition  craftable, tier = tool level
//   tinkering/materials/stats       head = tier (uses, speed, attack bonus, mining level); handle/binding neutral (iron's numbers:
//                                   +10% durability, nothing else) so the handle comes from the part, not the head tier
//   recipes/tools/materials         tconstruct:material recipe with the tier's repair ingredient (part builder accepts it)
// Rhino: no spread/destructuring, no const in loops.
ServerEvents.highPriorityData((event) => {
    global.tinkersEnsurePlan() // plan may not be built yet (startup order)
    const autos = global.TINKERS_AUTO
    Object.keys(autos).forEach((n) => {
        let a = autos[n]
        event.addJson("kubejs:tinkering/materials/definition/auto_" + n, {
            craftable: a.ingredient != null,
            hidden: false,
            sortOrder: 40,
            tier: Math.max(0, Math.min(a.level, 4))
        })
        event.addJson("kubejs:tinkering/materials/stats/auto_" + n, {
            stats: {
                "tconstruct:head": {
                    durability: a.uses,
                    melee_attack: a.attack,
                    mining_speed: a.speed,
                    mining_tier: a.miningTier
                },
                "tconstruct:handle": { durability: 0.1, melee_damage: 0.0, melee_speed: 0.0, mining_speed: 0.0 },
                "tconstruct:binding": {}
            }
        })
        if (a.ingredient != null) {
            event.addJson("kubejs:recipes/tools/materials/auto_" + n, {
                type: "tconstruct:material",
                ingredient: a.ingredient,
                material: a.id,
                needed: 1,
                value: 1
            })
        }
    })
    console.info("[tinkers tools] injected data for " + Object.keys(autos).length + " generated materials")
})
