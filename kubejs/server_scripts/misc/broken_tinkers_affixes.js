// Tinkers tools at 0 durability stay as items (NBT tic_broken:1b) instead of vanishing, so Apotheosis would keep
// applying their affixes/gems. Apotheosis keeps ALL of that (affixes, sockets, gems, rarity, name) under the single
// NBT key "affix_data": when a Tinkers tool breaks, its affixes are DESTROYED and a lore line explains it. The line is
// removed again once the tool is repaired (the affixes stay gone). The exact lore JSON is remembered in
// "kubejs_affix_lost_lore" so only our own line is removed.
// The changed stack is written back through the player's inventory MENU slot (event.slot is a menu index: hotbar k =
// 36 + k, armor 5-8, offhand 45), and the check also runs on the next use (block break / attack), since a durability
// change alone may not fire inventoryChanged.
// Cost: a few NBT key checks; returns immediately for anything that is not a Tinkers tool with one of the two keys.

// updated copy of the stack, or null if nothing to do
function brokenAffixUpdated(stack) {
    var nbt = stack.nbt
    if (nbt == null || !nbt.contains('tic_materials')) return null
    var broken = nbt.contains('tic_broken') && nbt.getBoolean('tic_broken')
    if (broken && nbt.contains('affix_data')) {
        nbt = nbt.copy()
        var affix = nbt.getCompound('affix_data')
        var r = affix.contains('rarity') ? String(affix.getString('rarity')).replace(/^.*:/, '') : ''
        var rarity = r ? r.charAt(0).toUpperCase() + r.substring(1) + ' ' : ''
        var line = JSON.stringify({ text: 'Its ' + rarity + 'affixes were destroyed when it broke.', color: 'red', italic: true })
        nbt.remove('affix_data')
        var display = nbt.contains('display') ? nbt.getCompound('display') : NBT.compoundTag()
        var lore = display.contains('Lore') ? display.getList('Lore', 8) : NBT.listTag()
        lore.add(NBT.stringTag(line))
        display.put('Lore', lore)
        nbt.put('display', display)
        nbt.putString('kubejs_affix_lost_lore', line)
    } else if (!broken && nbt.contains('kubejs_affix_lost_lore')) {
        // repaired: drop our explanation line again
        nbt = nbt.copy()
        var ours = String(nbt.getString('kubejs_affix_lost_lore'))
        nbt.remove('kubejs_affix_lost_lore')
        if (nbt.contains('display')) {
            var d = nbt.getCompound('display')
            if (d.contains('Lore')) {
                var old = d.getList('Lore', 8)
                var kept = NBT.listTag()
                for (var i = 0; i < old.size(); i++) if (String(old.getString(i)) != ours) kept.add(old.get(i))
                if (kept.size() > 0) d.put('Lore', kept)
                else d.remove('Lore')
            }
            if (d.isEmpty()) nbt.remove('display')
        }
    } else return null
    var out = stack.copy()
    out.nbt = nbt
    return out
}

// Tinkers' Tool Leveling (tleveling): affixed Tinkers tools start at a tool level by Apotheosis rarity, so they level up
// slower than a plain tool (exp needed per level doubles, config/tleveling/common.toml). Setting currentToolLevel grants no
// level-up rewards (those are only given on an actual level-up). Only raises, never lowers.
var AFFIX_MIN_LEVEL = { common: 1, uncommon: 2, rare: 3, epic: 4, mythic: 5, ancient: 6 }
function affixLevelUpdated(stack) {
    var nbt = stack.nbt
    if (nbt == null || !nbt.contains('tic_materials') || !nbt.contains('affix_data')) return null
    var min = AFFIX_MIN_LEVEL[String(nbt.getCompound('affix_data').getString('rarity')).replace(/^.*:/, '')]
    if (!min || (nbt.contains('currentToolLevel') && nbt.getInt('currentToolLevel') >= min)) return null
    nbt = nbt.copy()
    nbt.putInt('currentToolLevel', min)
    var out = stack.copy()
    out.nbt = nbt
    return out
}

// Apotheosis gems that raise enchantment levels (Earth: sharpness/protection/fortune, Inferno, Endersurge) act through Forge's
// GetEnchantmentLevelEvent. That already reaches Tinkers modifiers that report an enchantment (luck = fortune, haste =
// efficiency, our kubejs:ench_*), but Tinkers' sharpness and protection don't report one, so the gem would do nothing.
// For exactly those (the tool has the mapped modifier but reports level 0 for the enchantment), the gem bonus is added as
// slotless levels of the Tinkers modifier and remembered in "kubejs_gem_mods" {modifier: levels}, so removing or swapping
// a gem takes them back. must_exist is kept: the tool needs the modifier itself (our own gem levels don't count).
var GEM_ForgeRegistries = Java.loadClass('net.minecraftforge.registries.ForgeRegistries')
var GEM_ModifierManager = Java.loadClass('slimeknights.tconstruct.library.modifiers.ModifierManager')
var GEM_ModifierId = Java.loadClass('slimeknights.tconstruct.library.modifiers.ModifierId')
var GEM_ToolStack = Java.loadClass('slimeknights.tconstruct.library.tools.nbt.ToolStack')
var GEM_EnchHelper = Java.loadClass('net.minecraft.world.item.enchantment.EnchantmentHelper')
var GEM_SocketHelper = null
function gemModsUpdated(stack) {
    var nbt = stack.nbt
    if (nbt == null || !nbt.contains('tic_materials')) return null
    var had = nbt.contains('kubejs_gem_mods') ? nbt.getCompound('kubejs_gem_mods') : null
    if (!nbt.contains('affix_data') && had == null) return null
    if (GEM_SocketHelper == null) GEM_SocketHelper = Java.loadClass('dev.shadowsoffire.apotheosis.adventure.socket.SocketHelper')
    var tool = GEM_ToolStack.copyFrom(stack)
    var mods = tool.getModifiers()
    // candidates: enchantments whose Tinkers modifier the tool has (minus our gem levels) but does not report
    var list = NBT.listTag()
    var cand = []
    GEM_ForgeRegistries.ENCHANTMENTS.getValues().forEach(function (ench) {
        var mod = GEM_ModifierManager.INSTANCE.get(ench)
        if (mod == null) return
        var mid = String(mod.getId())
        var own = had != null && had.contains(mid) ? had.getInt(mid) : 0
        if (mods.getLevel(mod.getId()) - own <= 0 || stack.getEnchantmentLevel(ench) > 0) return
        list.add(GEM_EnchHelper.storeEnchantment(GEM_EnchHelper.getEnchantmentId(ench), 1))
        cand.push([ench, mid])
    })
    // gem bonus per candidate: Apotheosis adds to a pre-filled map (Java Integers: built from NBT, not from JS numbers)
    var want = {}
    if (cand.length > 0 && nbt.contains('affix_data')) {
        var map = GEM_EnchHelper.deserializeEnchantments(list)
        GEM_SocketHelper.getGems(stack).getEnchantmentLevels(map)
        cand.forEach(function (c) {
            var bonus = map.get(c[0]) - 1
            if (bonus > 0) want[c[1]] = Math.max(want[c[1]] || 0, bonus)
        })
    }
    // compare with what we added before
    var same = true
    var keys = {}
    Object.keys(want).forEach(function (k) { keys[k] = true })
    if (had != null) had.getAllKeys().forEach(function (k) { keys[String(k)] = true })
    Object.keys(keys).forEach(function (k) {
        if ((want[k] || 0) != (had != null && had.contains(k) ? had.getInt(k) : 0)) same = false
    })
    if (same) return null
    Object.keys(keys).forEach(function (k) {
        var id = GEM_ModifierId.tryParse(k)
        var old = had != null && had.contains(k) ? had.getInt(k) : 0
        if (old > 0) tool.removeModifier(id, old)
        if (want[k]) tool.addModifier(id, want[k])
    })
    tool.rebuildStats()
    var out = tool.createStack()
    var tag = out.nbt.copy()
    var rec = NBT.compoundTag()
    Object.keys(want).forEach(function (k) { rec.putInt(k, want[k]) })
    if (Object.keys(want).length > 0) tag.put('kubejs_gem_mods', rec)
    else tag.remove('kubejs_gem_mods')
    out.nbt = tag
    return out
}

PlayerEvents.inventoryChanged((event) => {
    var updated = brokenAffixUpdated(event.item)
    var leveled = affixLevelUpdated(updated != null ? updated : event.item)
    if (leveled != null) updated = leveled
    var gems = null
    try {
        gems = gemModsUpdated(updated != null ? updated : event.item)
    } catch (e) {
        console.warn('[apotheosis tinkers] gem modifiers for ' + event.item.id + ': ' + e)
    }
    if (gems != null) updated = gems
    if (updated != null) event.player.inventoryMenu.getSlot(event.slot).set(updated)
})

// next use of a just-broken tool in the main hand
function brokenAffixCheckHand(player) {
    if (player == null) return
    var updated = brokenAffixUpdated(player.mainHandItem)
    if (updated != null) player.setMainHandItem(updated)
}
BlockEvents.broken((event) => brokenAffixCheckHand(event.player))
EntityEvents.hurt((event) => {
    var src = event.source.player
    if (src != null) brokenAffixCheckHand(src)
})
