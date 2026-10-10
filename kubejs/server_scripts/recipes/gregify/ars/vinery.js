ServerEvents.recipes((event) => {
    event.recipes.ars_nouveau.enchanting_apparatus(
        ["minecraft:hay_block", "minecraft:string", "minecraft:string", "minecraft:string", "minecraft:hay_block", "minecraft:hay_block", "minecraft:hay_block"], // input items
        "tconstruct:travelers_helmet", // reagent (leather caps convert to Tinkers travelers gear)
        "vinery:straw_hat", // output
        2000, // source cost
        true // keep nbt of reagent, think like a smithing recipe
    )
})
