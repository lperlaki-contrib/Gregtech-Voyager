// Tags for kubejs:knife / kubejs:butcher_knife / kubejs:shovel (recipes: converted tool recipes, feat/tinkers-all-tools, and the
// Tinker Station via data/kubejs/recipes/*_building.json)
ServerEvents.tags('item', event => {
    var both = ['kubejs:knife', 'kubejs:butcher_knife']
    // Tinkers modifier eligibility (copied from dagger / sword)
    var tcTags = ['multipart', 'durability', 'harvest', 'small', 'bonus_slots', 'melee/weapon']
    tcTags.forEach(t => event.add('tconstruct:modifiable/' + t, both))
    event.add('tconstruct:modifiable/melee/primary', 'kubejs:butcher_knife')

    // GT knife + FD knife (+ gregic crafting tool => damaged when used in crafting)
    event.add('gtceu:tools/crafting_knives', 'kubejs:knife')
    event.add('gregic_tinkering:modifiable/crafting_tool', 'kubejs:knife')
    event.add('forge:tools/knives', both)
    event.add('farmersdelight:tools/knives', both)
    event.add('farmersdelight:straw_harvesters', both)

    // butcher knife: occultism tallow loot modifiers, hearth&harvest cutting recipes, GT butchery tag
    event.add('occultism:tools/knives', 'kubejs:butcher_knife')
    event.add('minecraft:swords', 'kubejs:butcher_knife')
    event.add('hearthandharvest:cleavers', 'kubejs:butcher_knife')
    event.add('forge:tools/butchery_knives', 'kubejs:butcher_knife')
    event.add('gtceu:tools/butchery_knives', 'kubejs:butcher_knife')
})

ServerEvents.tags('item', event => {
    var shovelTags = ['multipart', 'durability', 'harvest', 'harvest/primary', 'small', 'bonus_slots']
    shovelTags.forEach(t => event.add('tconstruct:modifiable/' + t, 'kubejs:shovel'))
    event.add('minecraft:shovels', 'kubejs:shovel')
    event.add('forge:tools/shovels', 'kubejs:shovel')

    // Tinkers' Leveling only levels items in tleveling:levelable (its default list is Tinkers' own tools)
    event.add('tleveling:levelable', ['kubejs:knife', 'kubejs:butcher_knife', 'kubejs:shovel', 'gregic_tinkering:drill', 'gregic_tinkering:chainsaw'])
})
