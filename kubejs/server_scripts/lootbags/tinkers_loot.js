// Tools found in world loot or held by spawned mobs become Tinkers tools, using the plan computed at startup
// (startup_scripts/tinkers/tinkers_plan.js, global.TINKERS_PLAN). Armor (plan entries with armor=true, config convertArmor) converts too, in loot and on spawned mobs' armor slots. Stand-in tools (diamond/netherite/...) always
// convert here, even though their recipes are removed or left alone.
// Plain Item.of(id, {tic_materials}) is enough: ItemStack.setTag -> verifyTagAfterLoad -> ToolStack.verifyTag rebuilds stats.
// Hot paths: the loot filter and the spawn handler are O(1) map lookups (no regex over the id list).
// Rhino: no spread/destructuring.

// returns the Tinkers stack for a tool stack, or null. Keeps count, custom name and Apotheosis affix_data.
// Enchantments become Tinkers modifiers: Tinkers tools ignore the vanilla Enchantments NBT (they only report enchantments
// granted by modifiers), so each enchantment is looked up in Tinkers' enchantment -> modifier map (vanilla mapping plus
// ours, server_scripts/tinkers_special/enchant_modifiers_data.js) and added with ToolStack.addModifier, which uses no
// slots (slots are only spent by modifier recipes). Level = enchantment level, capped at the enchantment's max level
// (Apotheosis raises some) and at TL_MOD_CAP; enchantments sharing a modifier (fortune/looting -> luck) take the max.
// Unmapped enchantments (curses, anvil/table-only ones) stay in the Enchantments NBT, where they are inert.
var TL_ModifierManager = Java.loadClass("slimeknights.tconstruct.library.modifiers.ModifierManager")
var TL_ToolStack = Java.loadClass("slimeknights.tconstruct.library.tools.nbt.ToolStack")
var TL_IModifiable = Java.loadClass("slimeknights.tconstruct.library.tools.item.IModifiable")
var TL_ListTag = Java.loadClass("net.minecraft.nbt.ListTag")
var TL_EnchantmentHelper = Java.loadClass("net.minecraft.world.item.enchantment.EnchantmentHelper")
var TL_MOD_CAP = { "tconstruct:luck": 3 } // Tinkers' own recipes stop luck at 3
var TL_unmapped = {} // enchantment id -> times seen without a modifier (logged on first sight)

function tlConvertEnchantments(src, t) {
    let levels = {}
    let order = []
    let rest = new TL_ListTag()
    let it = src.getAllEnchantments().entrySet().iterator()
    while (it.hasNext()) {
        let en = it.next()
        let ench = en.getKey()
        let lvl = Math.min(en.getValue(), ench.getMaxLevel())
        let mod = TL_ModifierManager.INSTANCE.get(ench)
        if (mod == null) {
            let id = String(TL_EnchantmentHelper.getEnchantmentId(ench))
            TL_unmapped[id] = (TL_unmapped[id] || 0) + 1
            if (TL_unmapped[id] == 1) console.info("[tinkers tools] no modifier for enchantment " + id + ", kept as raw NBT")
            rest.add(TL_EnchantmentHelper.storeEnchantment(TL_EnchantmentHelper.getEnchantmentId(ench), en.getValue()))
            continue
        }
        let mid = String(mod.getId())
        if (TL_MOD_CAP[mid]) lvl = Math.min(lvl, TL_MOD_CAP[mid])
        if (!(mid in levels)) order.push(mod.getId())
        levels[mid] = Math.max(levels[mid] || 0, lvl)
    }
    if (rest.size() > 0) t.nbt.put("Enchantments", rest)
    if (order.length == 0 || !(t.getItem() instanceof TL_IModifiable)) return
    let tool = TL_ToolStack.from(t)
    order.forEach((id) => {
        let lvl = levels[String(id)]
        if (lvl > 0) tool.addModifier(id, lvl)
    })
    tool.rebuildStats()
}

global.toTinkersTool = (stack) => {
    const t = global.tinkersStackFor(stack.id)
    if (!t) return null
    t.setCount(stack.count)
    try {
        let src = stack.nbt
        let tag = t.nbt
        if (src && tag) {
            // Apotheosis affixes (loot/mob gear we don't override) keep their data
            if (src.contains("affix_data")) tag.put("affix_data", src.get("affix_data"))
            let disp = src.getCompound("display")
            if (disp.contains("Name")) {
                let nd = NBT.compoundTag()
                nd.putString("Name", disp.getString("Name"))
                tag.put("display", nd)
            }
        }
        if (stack.isEnchanted()) tlConvertEnchantments(stack, t)
    } catch (e) {
        console.warn("[tinkers tools] converting " + stack.id + ": " + e)
    }
    return t
}

var TL_armorOn = global.tinkersConfig().convertArmor
var TL_EquipmentSlot = Java.loadClass("net.minecraft.world.entity.EquipmentSlot")
var TL_SLOTS = [TL_EquipmentSlot.MAINHAND, TL_EquipmentSlot.HEAD, TL_EquipmentSlot.CHEST, TL_EquipmentSlot.LEGS, TL_EquipmentSlot.FEET]

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
        if (!p || (i > 0 ? !p.armor : p.armor && !TL_armorOn)) continue
        let t = global.toTinkersTool(st)
        if (t) e.setItemSlot(slot, t)
    }
})
