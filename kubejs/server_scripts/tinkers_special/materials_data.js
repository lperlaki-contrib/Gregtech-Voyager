// Generates the repetitive datapack JSON of the kubejs:* Tinkers materials from global.KUBEJS_MATERIALS
// (startup_scripts/util/kubejsMaterials.js): material definitions and tconstruct:material recipes.
// Stats, traits and modifiers remain static JSON under data/kubejs/tinkering.
ServerEvents.highPriorityData(function (event) {
    var table = global.KUBEJS_MATERIALS
    Object.keys(table).forEach(function (id) {
        var e = table[id]
        event.addJson("kubejs:tinkering/materials/definition/" + id, global.kmatDefinition(e))
        global.kmatRecipes(id, e).forEach(function (r) {
            event.addJson("kubejs:recipes/tools/materials/" + r[0], r[1])
        })
    })
})
