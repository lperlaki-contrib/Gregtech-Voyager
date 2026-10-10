// Tools found in world loot or held by spawned mobs become Tinkers tools, using the plan computed at startup
// (startup_scripts/tinkers/tinkers_plan.js, global.TINKERS_PLAN). Armor (plan entries with armor=true, config convertArmor) converts too, in loot and on spawned mobs' armor slots. Stand-in tools (diamond/netherite/...) always
// convert here, even though their recipes are removed or left alone.
// Plain Item.of(id, {tic_materials}) is enough: ItemStack.setTag -> verifyTagAfterLoad -> ToolStack.verifyTag rebuilds stats.
// Hot paths: the loot filter and the spawn handler are O(1) map lookups (no regex over the id list).
// Rhino: no spread/destructuring.

// returns the Tinkers stack for a tool stack, or null. Keeps count, custom name and Apotheosis affix_data. Enchantments are copied too: Tinkers
// blocks adding enchantments (anvil/table: isBookEnchantable/canApplyAtEnchantingTable) but keeps unknown NBT, and vanilla
// enchantment lookups read the stack NBT, so they should still work (untested in-game).
global.toTinkersTool = (stack) => {
    const t = global.tinkersStackFor(stack.id)
    if (!t) return null
    t.setCount(stack.count)
    try {
        let src = stack.nbt
        let tag = t.nbt
        if (src && tag) {
            if (src.contains("Enchantments")) tag.put("Enchantments", src.get("Enchantments"))
            // Apotheosis affixes (loot/mob gear we don't override) keep their data
            if (src.contains("affix_data")) tag.put("affix_data", src.get("affix_data"))
            let disp = src.getCompound("display")
            if (disp.contains("Name")) {
                let nd = NBT.compoundTag()
                nd.putString("Name", disp.getString("Name"))
                tag.put("display", nd)
            }
        }
    } catch (e) {}
    return t
}

var TL_armorOn = global.tinkersConfig().convertArmor
var TL_EquipmentSlot = Java.loadClass("net.minecraft.world.entity.EquipmentSlot")
var TL_SLOTS = [TL_EquipmentSlot.MAINHAND, TL_EquipmentSlot.HEAD, TL_EquipmentSlot.CHEST, TL_EquipmentSlot.LEGS, TL_EquipmentSlot.FEET]
// Mobs keep bows and crossbows: skeleton/pillager AI (AbstractSkeleton.reassessWeaponGoal, Pillager/RangedCrossbowAttackGoal) only
// shoots with a BowItem/CrossbowItem, and Tinkers launchers are plain ProjectileWeaponItems (ModifiableLauncherItem). They are
// converted when the mob DROPS them instead (EntityEvents.drops below), so players still only end up with Tinkers bows.
var TL_MOB_KEEPS = { bow: true, crossbow: true }

LootJS.modifiers((event) => {
    // LootJS matches table-id regexes with Matcher.matches() (WHOLE id), so patterns must consume the full id (.*).
    global.tinkersEnsurePlan() // plan may not be built yet (startup order)
    const all = global.TINKERS_PLAN
    console.info("[tinkers tools] loot: converting " + Object.keys(all || {}).length + " tool ids")
    // O(1) map lookup only (no DAMAGEABLE pre-filter: Forestry kits are plan entries but not damageable). Applies to every loot
    // table including our own bags, which list the original items; converted stacks are not in the plan, so nothing converts twice.
    TL_armorOn = global.tinkersConfig().convertArmor // cached for the spawn handler (re-read on every /reload)
    const filter = ItemFilter.custom((stack) => {
        let pl = all[String(stack.id)]
        return !!pl && (TL_armorOn || !pl.armor)
    })
    event
        .addLootTableModifier(/.*/)
        .modifyLoot(filter, (stack) => global.toTinkersTool(stack) || stack)
})

EntityEvents.spawned((event) => {
    const e = event.entity
    if (!e.isLiving() || e.isPlayer()) return
    // slot 0 = main hand, 1-4 = armor (skipped when armor conversion is off)
    for (let i = 0; i < 5; i++) {
        if (i > 0 && !TL_armorOn) return
        let slot = TL_SLOTS[i]
        let st = e.getItemBySlot(slot)
        if (st.empty) continue
        let p = global.TINKERS_PLAN[String(st.id)]
        if (!p || (i > 0 ? !p.armor : (p.armor && !TL_armorOn) || TL_MOB_KEEPS[p.type])) continue
        let t = global.toTinkersTool(st)
        if (t) e.setItemSlot(slot, t)
    }
})

// Mob drops (equipment drops such as a skeleton's bow, items mobs picked up, offhand shields): converted like loot. Not players
// (their own inventory stays as it is).
EntityEvents.drops((event) => {
    if (event.entity.isPlayer()) return
    event.drops.forEach((ie) => {
        let st = ie.item
        let p = global.TINKERS_PLAN[String(st.id)]
        if (!p || (p.armor && !TL_armorOn)) return
        let t = global.toTinkersTool(st)
        if (t) ie.setItem(t)
    })
})
