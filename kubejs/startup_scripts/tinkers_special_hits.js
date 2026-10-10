// On-hit abilities of Tinkers tools carrying kubejs:* modifiers (Aether loot weapons, Ice and Fire, Twilight Forest ice
// sword, gravitite/holystone swords, Nature's Aura blades). Sources: aether-1.20.1-1.5.2, iceandfire-2.1.13,
// twilightforest-4.3.2508, NaturesAura-39.4.
//
// Why a startup script and LivingDamageEvent: KubeJS 2001.6.5 binds ForgeEvents only in startup scripts
// (BuiltinKubeJSForgePlugin.registerBindings: ScriptType.isStartup), and EntityEvents.hurt is not usable for this
// (no damage setter, and it fires before invulnerability frames are applied). Forge's LivingDamageEvent is posted from
// LivingEntity.actuallyHurt, i.e. only after armor/absorption and only when the hit really deals damage (i-frame
// re-hits that are rejected never get here), once per hit - matching Item.hurtEnemy which the original mods use.
// Damage bonuses (holy sword, pig slayer) are data in the modifier JSONs (tconstruct:conditional_melee_damage).
//
// Performance: one listener. A hit by a non-Tinkers weapon ends after: source.actual null/living check, mainHandItem,
// NBT null check and the "tic_modifiers" hash lookup. Otherwise the list is walked once, no string building.
// All Java.loadClass calls happen once, here at the top.

function tshClass(name) { // null when the owning mod is not installed
    try { return Java.loadClass(name) } catch (e) { return null }
}
var TSH_MobType = Java.loadClass("net.minecraft.world.entity.MobType")
var TSH_EnchHelper = Java.loadClass("net.minecraft.world.item.enchantment.EnchantmentHelper")
var TSH_Living = Java.loadClass("net.minecraft.world.entity.LivingEntity")
var TSH_MotionPacket = Java.loadClass("net.minecraft.network.protocol.game.ClientboundSetEntityMotionPacket")
// Ice and Fire classes are loaded lazily on first use: loading mod classes at KubeJS startup can run their static
// initialisers before the mod is ready (cf. the GTToolType crash in registry/tcon/knives.js).
var TSH_IafProvider = undefined
var TSH_IafEvents = undefined
function tshIaf() {
    if (TSH_IafProvider === undefined) {
        TSH_IafProvider = tshClass("com.github.alexthe666.iceandfire.entity.props.EntityDataProvider")
        TSH_IafEvents = tshClass("com.github.alexthe666.iceandfire.event.ServerEvents")
    }
}

var tshSweeping = false // re-entry guard for the hippogryph / soulstrider sweeps

// Object mapping every kubejs:* modifier id of the stack (without namespace) to true, or null if there is none
function tshMods(stack) {
    if (stack == null) return null
    var n = stack.nbt
    if (n == null || !n.contains("tic_modifiers")) return null
    var list = n.getList("tic_modifiers", 10)
    var m = null
    for (var i = 0, size = list.size(); i < size; i++) {
        var name = list.getCompound(i).getString("name")
        if (name.startsWith("kubejs:")) {
            if (m == null) m = {}
            m[name.substring(7)] = true
        }
    }
    return m
}

function tshIsSword(stack) { // Aether/IaF "swords"
    return stack.hasTag("tconstruct:modifiable/melee/sword") || stack.id == "tconstruct:dagger"
}

// EquipmentUtil.isFullStrength. Tinkers' melee (ToolAttackUtil) resets the attack strength ticker BEFORE dealing damage, so
// during LivingDamageEvent a Tinkers hit always reads ~0: the strength is recorded when the swing starts (AttackEntityEvent
// fires before Tinkers' onLeftClickEntity) and read from there.
// Server side only (the event also fires on the client, where a script error crashes the game), never throws.
var TSH_swingStrength = new (Java.loadClass("java.util.WeakHashMap"))() // player -> attack strength at the start of the last swing
ForgeEvents.onEvent("net.minecraftforge.event.entity.player.AttackEntityEvent", function (event) {
    try {
        var p = event.entity
        if (p.level.clientSide) return
        TSH_swingStrength.put(p, p.getAttackStrengthScale(0.5))
    } catch (e) {}
})
function tshFull(e) {
    if (!e.isPlayer()) return true
    var s = TSH_swingStrength.get(e)
    return (s == null ? e.getAttackStrengthScale(0.5) : s) > 0.9 // vanilla's "full swing" threshold (crits, sweeps)
}

// Shared with server_scripts/tinkers_special/abilities.js (startup globals are readable from server scripts)
global.tsMods = tshMods
global.tsIsSword = tshIsSword
global.tsFull = tshFull

function tshKnockback(target, attacker) {
    target.knockback(1.0, attacker.x - target.x, attacker.z - target.z)
}

function tshFreeze(target, ticks) {
    tshIaf()
    if (TSH_IafProvider == null) return
    TSH_IafProvider.getCapability(target).ifPresent(function (data) {
        data.frozenData.setFrozen(target, ticks)
    })
}

// IaF lightning: skipped for a player whose swing animation is past 0.2
function tshStrike(target, attacker) {
    tshIaf()
    if (TSH_IafEvents == null || (attacker.isPlayer() && attacker.attackAnim > 0.2)) return
    var bolt = target.level.createEntity("minecraft:lightning_bolt")
    bolt.addTag(TSH_IafEvents.BOLT_DONT_DESTROY_LOOT)
    bolt.addTag(String(attacker.stringUUID)) // property form: the getStringUUID() call does not resolve in startup scripts
    bolt.moveTo(target.position())
    bolt.spawn()
}

ForgeEvents.onEvent("net.minecraftforge.event.entity.living.LivingDamageEvent", function (event) {
    if (tshSweeping) return
    var src = event.source
    var attacker = src.actual
    if (attacker == null || !attacker.isLiving() || src.immediate != attacker) return
    var tool = attacker.mainHandItem
    var m = tshMods(tool) // null for any non-Tinkers / modifier-less hit: this is where nearly every hit ends
    if (m == null) return
    var target = event.entity
    var level = target.level
    if (level.clientSide) return
    var tt = String(target.type)

    // ---- Aether loot weapons (swords) ----
    if (tshFull(attacker)) {
        // CandyCaneSwordItem.hurtEnemy: target not a player, nextBoolean() -> candy cane
        if (m.aether_candy_cane_drops === true && tt != "minecraft:player" && level.random.nextBoolean()) {
            target.spawnAtLocation(Item.of("aether:candy_cane"))
        }
        // FlamingSwordItem.onLivingDamage: 30 s of fire + 4 s per Fire Aspect level
        if (m.aether_flaming_blade === true) {
            target.setSecondsOnFire(30 + TSH_EnchHelper.getFireAspect(attacker) * 4)
        }
        // HolySwordItem.hurtEnemy: vs undead / inverted heal-harm the sword loses 10 durability (+8.25 damage is data)
        if (m.aether_holy_smite === true && (target.mobType == TSH_MobType.UNDEAD || target.isInvertedHealAndHarm())) {
            tool.hurtAndBreak(10, attacker, function (e) { e.broadcastBreakEvent("main_hand") })
        }
        // LightningSwordItem.hurtEnemy: lightning bolt at the target
        if (m.aether_lightning_strike === true) {
            var abolt = level.createEntity("minecraft:lightning_bolt")
            abolt.setPos(target.x, target.y, target.z)
            abolt.spawn()
        }
        // VampireBladeItem.hurtEnemy: wielder below max health -> heal 1
        if (m.aether_vampiric === true && attacker.health < attacker.maxHealth) attacker.heal(1.0)
    }

    // ---- Ice and Fire ----
    // Myrmex chitin: extra hit (damage dealt + 5) on non-arthropods, a second one on death worms (next tick, like IaF's
    // hurt() right after the hit, so invulnerability frames apply)
    if (m.myrmex_chitin === true) {
        var extra = event.amount + 5.0
        var arthropod = target.mobType == TSH_MobType.ARTHROPOD
        var worm = tt == "iceandfire:deathworm"
        if (!arthropod || worm) {
            target.server.scheduleInTicks(1, function () {
                if (!target.alive) return
                if (!arthropod) target.hurt(level.damageSources().generic(), extra)
                if (worm) target.hurt(level.damageSources().generic(), extra)
            })
        }
    }
    // Dragonsteel (any tool): element ability
    if (m.dragonsteel_flame === true) {
        target.setSecondsOnFire(15)
        tshKnockback(target, attacker)
    }
    if (m.dragonsteel_frost === true) {
        tshFreeze(target, 300)
        target.potionEffects.add("minecraft:slowness", 300, 2)
        tshKnockback(target, attacker)
    }
    if (m.dragonsteel_bolt === true) {
        tshStrike(target, attacker)
        tshKnockback(target, attacker)
    }
    // Elemental dragonbone swords
    if (m.dragonbone_flame === true && tshIsSword(tool)) {
        if (tt == "iceandfire:ice_dragon") target.hurt(level.damageSources().inFire(), 13.5)
        target.setSecondsOnFire(5)
        tshKnockback(target, attacker)
    }
    if (m.dragonbone_frost === true && tshIsSword(tool)) {
        if (tt == "iceandfire:fire_dragon") target.hurt(level.damageSources().freeze(), 13.5)
        tshFreeze(target, 200)
        target.potionEffects.add("minecraft:slowness", 100, 2)
        target.potionEffects.add("minecraft:weakness", 100, 2)
        tshKnockback(target, attacker)
    }
    if (m.dragonbone_bolt === true && tshIsSword(tool)) {
        tshStrike(target, attacker)
        if (tt == "iceandfire:fire_dragon" || tt == "iceandfire:ice_dragon") target.hurt(level.damageSources().lightningBolt(), 9.5)
        tshKnockback(target, attacker)
    }
    // ItemHippogryphSword.hurtEnemy: players only; every hit sweeps (1 + sweepRatio * attack damage, <3 blocks, not
    // allied, knockback 0.4)
    if (m.iaf_hippogryph_slash === true && attacker.isPlayer()) {
        var dmg = 1.0 + TSH_EnchHelper.getSweepingDamageRatio(attacker) * attacker.getAttributeValue("minecraft:generic.attack_damage")
        var list = level.getEntitiesOfClass(TSH_Living, target.boundingBox.inflate(1.0, 0.25, 1.0))
        var rad = 0.017453292
        tshSweeping = true
        try {
            for (var i = 0; i < list.size(); i++) {
                var e = list.get(i)
                if (e == attacker || e == target || attacker.isAlliedTo(e) || attacker.distanceToSqr(e) >= 9.0) continue
                e.knockback(0.4, Math.sin(attacker.yRot * rad), -Math.cos(attacker.yRot * rad))
                e.hurt(level.damageSources().playerAttack(attacker), dmg)
            }
        } finally {
            tshSweeping = false // an exception must never leave the guard set (it would disable every on-hit ability)
        }
        level.playSound(null, attacker.x, attacker.y, attacker.z, "minecraft:entity.player.attack.sweep", "players", 1.0, 1.0)
        attacker.sweepAttack()
    }
    // ItemAmphithereMacuahuitl.hurtEnemy: target flung up and back (motion/2 + 0.6 along the wielder's facing, y 0.8)
    if (m.iaf_amphithere_gust === true) {
        var rot = attacker.yRot * 0.017453292
        var dx = -Math.sin(rot)
        var dz = Math.cos(rot)
        var len = Math.sqrt(dx * dx + dz * dz)
        target.server.scheduleInTicks(1, function () { // after vanilla knockback
            var mo = target.deltaMovement
            target.setDeltaMovement(mo.x() / 2.0 + 0.6 * dx / len, 0.8, mo.z() / 2.0 + 0.6 * dz / len)
            target.hurtMarked = true
        })
    }

    // ---- Twilight Forest ice sword: Frosty II for 10 s unless freeze-immune / creative player ----
    if (m.tf_ice_chill === true && target.canFreeze() && !(target.isPlayer() && target.creative)) {
        target.potionEffects.add("twilightforest:frosty", 200, 2)
    }

    // ---- Gravitite sword (Aether): grounded or swimming target is launched; vanilla knockback runs after this event
    //      and would overwrite the motion, so push next tick ----
    if (m.gravitite_lift === true && tshIsSword(tool) && tshFull(attacker)
        && tt != "aether:aechor_plant" && (target.onGround() || target.isInFluidType())) {
        target.server.scheduleInTicks(1, function () {
            target.push(0, 1, 0)
            if (target.isPlayer()) target.connection.send(new TSH_MotionPacket(target))
        })
    }

    // ---- Holystone sword: 1/25 ambrosium shard at the target (players excluded) ----
    if (m.holystone_blessing === true && tshIsSword(tool) && tshFull(attacker) && !target.isPlayer()
        && level.random.nextInt(25) == 0) {
        target.spawnAtLocation(Item.of("aether:ambrosium_shard"))
    }

    // ---- Nature's Aura blades (ItemSword.hurtEnemy): botanist Slowness III 3 s, skyseeker Levitation III 3 s,
    //      soulstrider wide sweep (0.75 x attack damage, box inflate(2,1,2), within entity reach, knockback 0.4) ----
    if ((m.na_botanist === true || m.na_skyseeker === true || m.na_soulstrider === true) && tshIsSword(tool)) {
        if (m.na_botanist === true) target.potionEffects.add("minecraft:slowness", 60, 2)
        if (m.na_skyseeker === true) target.potionEffects.add("minecraft:levitation", 60, 2)
        if (m.na_soulstrider === true && attacker.isPlayer()) {
            var sdmg = attacker.getAttributeValue("minecraft:generic.attack_damage") * 0.75
            var near = level.getEntitiesOfClass(TSH_Living, target.boundingBox.inflate(2.0, 1.0, 2.0))
            var reach = attacker.getEntityReach()
            var srad = 0.017453292
            tshSweeping = true
            try {
                for (var k = 0; k < near.size(); k++) {
                    var v = near.get(k)
                    if (v == attacker || v == target || attacker.isAlliedTo(v)) continue
                    if (String(v.type) == "minecraft:armor_stand" && v.isMarker()) continue
                    if (attacker.distanceToSqr(v) >= reach * reach) continue
                    v.knockback(0.4, Math.sin(attacker.yRot * srad), -Math.cos(attacker.yRot * srad))
                    v.hurt(level.damageSources().playerAttack(attacker), sdmg)
                }
            } finally {
                tshSweeping = false
            }
            attacker.sweepAttack()
        }
    }
})
