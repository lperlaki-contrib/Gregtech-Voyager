// Smithing upgrades of Tinkers tools (tool_recipes.js, e.g. AE2 fluix template + certus quartz tool + fluix block): vanilla's
// smithing result is not the upgraded input tool, so while a smithing table is open the result slot is set to the BASE tool
// with its parts switched (certus -> fluix; durability, modifiers, name and affixes kept).
// ponytail: set on the player tick after vanilla fills the slot; two clicks inside the same tick could still take vanilla's result.
var SU_SmithingMenu = Java.loadClass("net.minecraft.world.inventory.SmithingMenu")
var SU_ItemStack = Java.loadClass("net.minecraft.world.item.ItemStack")
PlayerEvents.tick((event) => {
    let menu = event.player.containerMenu
    if (!(menu instanceof SU_SmithingMenu)) return
    let slot = menu.getSlot(3) // 0 template, 1 base, 2 addition, 3 result
    let res = slot.getItem()
    if (res.isEmpty() || !global.TINKERS_SMITHING_UPGRADES) return
    let base = menu.getSlot(1).getItem()
    let u = global.TINKERS_SMITHING_UPGRADES[String(menu.getSlot(0).getItem().id) + "|" + String(base.id)]
    if (!u) return
    let out = global.tinkersUpgradeStack(base, u.from, u.to)
    if (SU_ItemStack.isSameItemSameTags(res, out)) return
    // DEBUG (remove after the fluix test): vanilla's result and what the slot now holds
    console.info("[tinkers smithing] vanilla " + res.nbt + " -> " + out.nbt)
    slot.set(out)
})
