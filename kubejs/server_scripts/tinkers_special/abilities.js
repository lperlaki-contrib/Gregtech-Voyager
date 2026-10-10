// Special-tool abilities for Tinkers tools carrying kubejs:* modifiers (server-side, non-hit part): Aether (skyroot,
// holystone, gravitite, hammer), Ice and Fire ghost blade, Nature's Aura axes / pickaxes. The on-hit abilities live in
// startup_scripts/tinkers_special_hits.js because they need a post-damage Forge event (see that file).
// Sources: aether-1.20.1-1.5.2, iceandfire-2.1.13, NaturesAura-39.4 (see git history for the per-ability citations).
//
// Performance design: one handler per hot event (block broken, block right-clicked, item right-clicked, two loot
// modifiers). Every handler first reads the held stack's NBT; a stack without a "tic_modifiers" list ends there (null
// check + hash lookup). Otherwise the list is walked once (no string building), collecting the kubejs:* ids into a
// small object. No per-tick handlers. All Java.loadClass calls happen once, here at the top.

function tsClass(name) { // null when the owning mod is not installed
    try { return Java.loadClass(name) } catch (e) { return null }
}
var TS_TagKey = Java.loadClass("net.minecraft.tags.TagKey")
var TS_Registries = Java.loadClass("net.minecraft.core.registries.Registries")
var TS_RL = Java.loadClass("net.minecraft.resources.ResourceLocation")
var TS_Enchantments = Java.loadClass("net.minecraft.world.item.enchantment.Enchantments")
var TS_Helper = tsClass("de.ellpeck.naturesaura.Helper")
var TS_NA_API = tsClass("de.ellpeck.naturesaura.api.NaturesAuraAPI")
var TS_NA_LevelData = tsClass("de.ellpeck.naturesaura.api.misc.ILevelData")
var TS_Floating = tsClass("com.aetherteam.aether.entity.block.FloatingBlockEntity")
var TS_Hammer = tsClass("com.aetherteam.aether.entity.projectile.weapon.HammerProjectile")
var TS_IafRegistry = tsClass("com.github.alexthe666.iceandfire.entity.IafEntityRegistry")
var TS_Ghost = tsClass("com.github.alexthe666.iceandfire.entity.EntityGhostSword")

var TS_NO_SKY_DOUBLE_ENTITY = ["minecraft:player", "minecraft:wither", "minecraft:ender_dragon"] // #aether:no_skyroot_double_drops
var TS_LOGS = TS_TagKey.create(TS_Registries.BLOCK, new TS_RL("minecraft:logs"))
var TS_ORES = TS_TagKey.create(TS_Registries.BLOCK, new TS_RL("forge:ores"))
function tsLogs(state) { return state.is(TS_LOGS) }
function tsOres(state) { return state.is(TS_ORES) }
// Tinkers tool families by item id (Nature's Aura pickaxe / handaxe)
function tsIsPick(stack) { return stack.id == "tconstruct:pickaxe" }
function tsIsAxe(stack) { return stack.id == "tconstruct:hand_axe" || stack.id == "tconstruct:broad_axe" }

// ---- shared helpers ----------------------------------------------------------------------------------------------

// tsMods / tsIsSword / tsFull are defined once in startup_scripts/tinkers_special_hits.js and shared through global.
// tsMods(stack): object mapping every kubejs:* modifier id of the stack (without namespace) to true, or null.
var tsMods = global.tsMods
var tsIsSword = global.tsIsSword
var tsFull = global.tsFull

function tsHas(m, id) {
    return m[id] === true
}

function tsIsTool(stack) { // Aether "tools": pickaxe/axe/shovel/hoe family
    return stack.hasTag("tconstruct:modifiable/harvest/primary")
}

// ---- BlockEvents.broken: holystone tools (1/50 ambrosium shard), Nature's Aura tree / vein mining ------------------
BlockEvents.broken(function (event) {
    var player = event.player
    if (player == null) return
    var tool = player.mainHandItem
    var m = tsMods(tool)
    if (m == null) return
    var state = event.block.blockState
    // Nature's Aura axes / pickaxe (onBlockStartBreak): toggle on (naturesaura:disabled unset) -> Helper.mineRecursively.
    // skyseeker axe: logs radius 1; soulstrider axe: logs radius 6; soulstrider pickaxe: ores radius 5; up to 32/5 blocks
    if (TS_Helper != null && !event.level.clientSide) {
        if (tsIsAxe(tool) && (m.na_skyseeker === true || m.na_soulstrider === true) && tsLogs(state) && TS_Helper.isToolEnabled(tool)) {
            TS_Helper.mineRecursively(event.level, event.block.pos, event.block.pos, tool, m.na_soulstrider === true ? 6 : 1, 32, tsLogs)
            return
        }
        if (tsIsPick(tool) && m.na_soulstrider === true && tsOres(state) && TS_Helper.isToolEnabled(tool)) {
            TS_Helper.mineRecursively(event.level, event.block.pos, event.block.pos, tool, 5, 5, tsOres)
            return
        }
    }
    if (!tsHas(m, "holystone_blessing") || !tsIsTool(tool)) return
    if (state.getDestroySpeed(event.level, event.block.pos) <= 0) return
    if (!tool.isCorrectToolForDrops(state)) return
    if (event.level.random.nextInt(50) != 0) return
    event.block.popItem(Item.of("aether:ambrosium_shard"))
})

// ---- BlockEvents.rightClicked: Botanist pickaxe mossify, gravitite tools float a block (4 durability) -------------
BlockEvents.rightClicked(function (event) {
    var tool = event.item
    var m = tsMods(tool)
    if (m == null) return
    // Botanist's Pickaxe (ItemPickaxe.useOn): BOTANIST_PICKAXE_CONVERSIONS (stone -> mossy), 15 durability, moss recorded
    // in the level data; only the pickaxe
    if (m.na_botanist === true && tsIsPick(tool) && TS_NA_API != null) {
        var conv = TS_NA_API.BOTANIST_PICKAXE_CONVERSIONS.get(event.block.blockState)
        if (conv != null && event.player != null) {
            event.cancel()
            if (event.level.clientSide) return
            event.level.setBlock(event.block.pos, conv, 3)
            TS_NA_LevelData.getLevelData(event.level).addMossStone(event.block.pos)
            var mhand = event.hand
            tool.hurtAndBreak(15, event.player, function (p) { p.broadcastBreakEvent(mhand) })
            event.player.swing(mhand, true)
        }
        return
    }
    if (!tsHas(m, "gravitite_lift") || TS_Floating == null) return
    var player = event.player
    if (player == null || player.crouching || !tsIsTool(tool)) return
    var block = event.block
    var state = block.blockState
    var level = event.level
    if (!(tool.isCorrectToolForDrops(state) || tool.getDestroySpeed(state) > 1.0)) return
    var above = block.up
    if (!(above.blockState.isAir() || above.blockState.canBeReplaced())) return
    if (above.entity != null || block.entity != null) return
    if (state.getDestroySpeed(level, block.pos) < 0) return
    if (block.properties.containsKey("facing")) return
    if (block.hasTag("aether:gravitite_ability_blacklist")) return
    event.cancel()
    if (level.clientSide) return
    var fb = new TS_Floating(level, block.x + 0.5, block.y, block.z + 0.5, state)
    fb.setNatural(false)
    if (block.hasTag("minecraft:anvil")) fb.setHurtsEntities(2.0, 40)
    level.addFreshEntity(fb)
    level.setBlock(block.pos, Block.getBlock("minecraft:air").defaultBlockState(), 3)
    var hand = event.hand
    tool.hurtAndBreak(4, player, function (p) { p.broadcastBreakEvent(hand) })
    player.swing(hand, true)
})

// ---- ItemEvents.rightClicked: NA axe/pickaxe toggle, Kingbdogz hammer throw, Phantasmal Blade projectile -----------
ItemEvents.rightClicked(function (event) {
    var tool = event.item
    var m = tsMods(tool)
    if (m == null) return
    var player = event.player
    if (player == null || player.level.clientSide) return
    // Skyseeker / Soulstrider axes and the Soulstrider pickaxe toggle their area ability when sneak-used
    // (ItemAxe/ItemPickaxe.use -> Helper.toggleToolEnabled, flag naturesaura:disabled in the stack NBT)
    if (TS_Helper != null
        && ((tsIsAxe(tool) && (m.na_skyseeker === true || m.na_soulstrider === true)) || (tsIsPick(tool) && m.na_soulstrider === true))) {
        TS_Helper.toggleToolEnabled(player, tool)
        return
    }
    if (tsHas(m, "aether_hammer_throw") && TS_Hammer != null && !player.cooldowns.isOnCooldown(tool.item)) {
        // HammerOfKingbdogzItem.use: 50 tick cooldown, 1 durability, HammerProjectile
        var hand = event.hand
        if (!player.abilities.instabuild) {
            player.addItemCooldown(tool.item, 50)
            tool.hurtAndBreak(1, player, function (p) { p.broadcastBreakEvent(hand) })
        }
        var proj = new TS_Hammer(player, player.level)
        proj.shoot(player.xRot, player.yRot, 3.0, 1.0)
        player.level.addFreshEntity(proj)
    } else if (tsHas(m, "iaf_ghost_blade") && TS_Ghost != null && !player.cooldowns.isOnCooldown(tool.item)) {
        // ItemGhostSword.spawnGhostSwordEntity (IaF: left-click; here right-click): 10 tick cooldown, 1 durability
        var ghost = new TS_Ghost(TS_IafRegistry.GHOST_SWORD.get(), player.level, player, player.getAttributeValue("minecraft:generic.attack_damage") - 1.0)
        ghost.shootFromRotation(player, player.xRot, player.yRot, 0.0, 1.0, 0.5)
        player.level.addFreshEntity(ghost)
        var hand2 = event.hand
        tool.hurtAndBreak(1, player, function (p) { p.broadcastBreakEvent(hand2) })
        player.addItemCooldown(tool.item, 10)
    }
})

// ---- LootJS: three narrow modifiers -------------------------------------------------------------------------------
LootJS.modifiers(function (event) {
    // Skyroot tools (SkyrootTool.doubleDrops): only the Aether block tables carry the aether:double_drops function, so
    // restrict to aether:blocks/* (LootJS regex must match the whole id); no silk touch, correct tool, double_drops=true
    // -> every stack x2
    event.addLootTableModifier(/^aether:blocks\/.*/).apply(function (ctx) {
        var tool = ctx.tool
        var m = tsMods(tool)
        if (m == null || !tsHas(m, "skyroot_bounty") || !tsIsTool(tool)) return
        var block = ctx.destroyedBlock
        if (block == null || String(block.properties.get("double_drops")) != "true") return
        if (!tool.isCorrectToolForDrops(block.blockState)) return
        if (tool.getEnchantmentLevel(TS_Enchantments.SILK_TOUCH) > 0) return
        var loot = ctx.loot
        for (var i = 0; i < loot.size(); i++) {
            var st = loot.get(i)
            st.setCount(st.getCount() * 2)
        }
    })

    // Skyseeker's Pickaxe (ItemPickaxe.inventoryTick pulls item drops within 4 blocks into the inventory at once): here
    // the drops of a block it breaks go straight to the player. Cheap: tsMods is null for every other tool.
    event.addLootTypeModifier(LootType.BLOCK).apply(function (ctx) {
        var tool = ctx.tool
        var m = tsMods(tool)
        if (m == null || !tsHas(m, "na_skyseeker") || !tsIsPick(tool) || ctx.player == null) return
        var loot = ctx.loot
        for (var i = 0; i < loot.size(); i++) ctx.player.give(loot.get(i).copy())
        loot.clear()
    })

    // Skyroot swords (DoubleDropsModifier): entity kills by a player only (killedByPlayer is a cheap built-in condition,
    // checked before the script runs); duplicate every drop not in #aether:no_skyroot_double_drops
    event.addLootTypeModifier(LootType.ENTITY).killedByPlayer().apply(function (ctx) {
        var killer = ctx.killerEntity
        if (killer == null) return
        var tool = killer.mainHandItem
        var m = tsMods(tool)
        if (m == null || !tsHas(m, "skyroot_bounty") || !tsIsSword(tool)) return
        var victim = ctx.entity
        if (victim == null || TS_NO_SKY_DOUBLE_ENTITY.indexOf(String(victim.type)) >= 0 || !tsFull(killer)) return
        var loot = ctx.loot
        var extra = []
        for (var i = 0; i < loot.size(); i++) {
            var st = loot.get(i)
            if (!st.hasTag("aether:no_skyroot_double_drops")) extra.push(st.copy())
        }
        for (var j = 0; j < extra.length; j++) loot.add(extra[j])
    })
})
