// Smithing upgrades of Tinkers tools (tool_recipes.js, e.g. AE2 fluix template + certus quartz tool + fluix block): vanilla smithing
// copies the base tool's NBT onto the result, so the result would still be the certus tool. While a smithing table is open, the
// result slot is replaced by the upgraded tool (certus parts -> fluix, modifiers kept).
// ponytail: fixed on the player tick after vanilla fills the slot; two clicks inside the same tick could still take the unfixed tool.
var SU_SmithingMenu = Java.loadClass("net.minecraft.world.inventory.SmithingMenu")
var SU_ToolStack = Java.loadClass("slimeknights.tconstruct.library.tools.nbt.ToolStack")
PlayerEvents.tick((event) => {
    let menu = event.player.containerMenu
    if (!(menu instanceof SU_SmithingMenu)) return
    let slot = menu.getSlot(3) // 0 template, 1 base, 2 addition, 3 result
    let res = slot.getItem()
    if (res.isEmpty() || !global.TINKERS_SMITHING_UPGRADES) return
    let u = global.TINKERS_SMITHING_UPGRADES[String(menu.getSlot(0).getItem().id) + "|" + String(res.id)]
    if (!u) return
    let mats = SU_ToolStack.from(res).getMaterials()
    for (let i = 0; i < mats.size(); i++) {
        if (String(mats.get(i).getVariant()) == u.from) {
            let out = global.tinkersUpgradeStack(res, u.from, u.to)
            // DEBUG (remove after the fluix test): what went in and what the slot now holds
            console.info("[tinkers smithing] " + res.id + " " + res.nbt + " -> " + out.nbt)
            slot.set(out)
            return
        }
    }
})
