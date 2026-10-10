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

PlayerEvents.inventoryChanged((event) => {
    var updated = brokenAffixUpdated(event.item)
    var leveled = affixLevelUpdated(updated != null ? updated : event.item)
    if (leveled != null) updated = leveled
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
