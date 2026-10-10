// Set bonuses and coverage effects of converted armor (Aether, Twilight Forest, Ice and Fire) on Tinkers armor.
// The originals check item identity (Aether: EquipmentUtil.hasFull*Set = 4 armor items + gloves curio), which Tinkers armor can never
// satisfy, so the same rules are re-implemented here on marker modifiers (data/kubejs/tinkering/modifiers/set_*.json, carried by the
// armor materials' plating traits).
//
// Design (no per-tick handler anywhere):
//  - ONE LivingEquipmentChangeEvent listener recomputes a cached flags object for the player (TAS_FLAGS[uuid]); a player wearing no
//    marker modifier has no entry. Aether sets also need the matching Aether gloves (curio); CurioChangeEvent recomputes too.
//  - Effects use event hooks that already run: LivingHurtEvent (tide Strength, yeti chill), LivingJumpEvent (gravitite),
//    LivingFallEvent (gravitite / valkyrie / sentry), LivingAttackEvent (phoenix fire immunity), plus attribute / infinite-effect
//    changes applied only when the flags change (neptune swim speed, tide water breathing).
//  - Every hot listener starts with `if (TAS_N == 0) return` (nobody wears a marker piece) and then a map lookup by uuid.
// Not reproduced (needs per-tick motion code): valkyrie glide flight, phoenix lava-swim boost and water->obsidian conversion,
// neptune's upward water drift. Everything is documented in the modifiers' descriptions.
// Rhino: no spread/destructuring; Java.loadClass of vanilla/forge classes once at the top, mod classes lazily.

var TAS_Slot = Java.loadClass("net.minecraft.world.entity.EquipmentSlot")
var TAS_SLOTS = [TAS_Slot.HEAD, TAS_Slot.CHEST, TAS_Slot.LEGS, TAS_Slot.FEET]
var TAS_Packet = Java.loadClass("net.minecraft.network.protocol.game.ClientboundSetEntityMotionPacket")
var TAS_MobEffectInstance = Java.loadClass("net.minecraft.world.effect.MobEffectInstance")
var TAS_MobEffects = Java.loadClass("net.minecraft.world.effect.MobEffects")
var TAS_AttrModifier = Java.loadClass("net.minecraft.world.entity.ai.attributes.AttributeModifier")
var TAS_Operation = Java.loadClass("net.minecraft.world.entity.ai.attributes.AttributeModifier$Operation")
// Every handler is wrapped: an exception inside a Forge event (hurt, attack, fall, ...) would cancel or break the event.
function tasSafe(fn) {
    return function (event) {
        try {
            fn(event)
        } catch (e) {
            console.error("[tinkers armor sets] " + e)
        }
    }
}
var TAS_UUID = Java.loadClass("java.util.UUID")
var TAS_ForgeMod = Java.loadClass("net.minecraftforge.common.ForgeMod")
var TAS_NEPTUNE_ID = TAS_UUID.fromString("5f3c2c1e-7a0b-4c55-9a5e-2d8f6a1b0c01")
var TAS_NEPTUNE_BOOST = 0.8 // approximation of NeptuneArmor (+0.016 water acceleration on a 0.02 base)
var TAS_FIRE_SOURCES = ["inFire", "onFire", "lava", "hotFloor"]

// marker modifier -> [flag, pieces needed, required Aether gloves curio (or null)]
var TAS_SETS = {
    set_gravitite: ["grav", 4, "aether:gravitite_gloves"],
    set_valkyrie: ["valk", 4, "aether:valkyrie_gloves"],
    set_neptune: ["nept", 4, "aether:neptune_gloves"],
    set_phoenix: ["phoenix", 4, "aether:phoenix_gloves"],
    set_sentry_boots: ["sentry", 1, null]
}

var TAS_FLAGS = {} // uuid string -> { grav, valk, nept, phoenix, sentry, tide (pieces), yeti (pieces) }
var TAS_N = 0

// counts of kubejs: marker modifiers over the four armor slots, or null
function tasCounts(entity) {
    var c = null
    for (var i = 0; i < 4; i++) {
        var st = entity.getItemBySlot(TAS_SLOTS[i])
        if (st.isEmpty()) continue
        var n = st.nbt
        if (n == null || !n.contains("tic_modifiers")) continue
        var list = n.getList("tic_modifiers", 10)
        for (var j = 0, size = list.size(); j < size; j++) {
            var name = String(list.getCompound(j).getString("name"))
            if (name.indexOf("kubejs:") != 0) continue
            if (c == null) c = {}
            var k = name.substring(7)
            c[k] = (c[k] || 0) + 1
        }
    }
    return c
}

function tasHasCurio(entity, itemId) {
    try {
        var api = Java.loadClass("top.theillusivec4.curios.api.CuriosApi")
        var opt = api.getCuriosInventory(entity).resolve()
        if (!opt.isPresent()) return false
        return opt.get().findFirstCurio(Item.of(itemId).item).isPresent()
    } catch (e) {
        return false
    }
}

function tasSwim(entity, on) {
    try {
        var inst = entity.getAttribute(TAS_ForgeMod.SWIM_SPEED.get())
        if (inst == null) return
        inst.removeModifier(TAS_NEPTUNE_ID)
        if (on) inst.addTransientModifier(new TAS_AttrModifier(TAS_NEPTUNE_ID, "kubejs neptune set", TAS_NEPTUNE_BOOST, TAS_Operation.MULTIPLY_TOTAL))
    } catch (e) {
        console.warn("[tinkers armor] swim speed modifier failed: " + e)
    }
}

function tasBreathing(entity, on) {
    if (on) {
        entity.addEffect(new TAS_MobEffectInstance(TAS_MobEffects.WATER_BREATHING, -1, 0, false, false, true))
    } else {
        var cur = entity.getEffect(TAS_MobEffects.WATER_BREATHING)
        if (cur != null && cur.isInfiniteDuration()) entity.removeEffect(TAS_MobEffects.WATER_BREATHING)
    }
}

function tasRecompute(entity) {
    if (entity == null || !entity.isPlayer() || entity.level.clientSide) return
    var key = String(entity.stringUUID)
    var prev = TAS_FLAGS[key]
    var c = tasCounts(entity)
    var f = null
    if (c != null) {
        f = { grav: false, valk: false, nept: false, phoenix: false, sentry: false, tide: c.tide_attuned || 0, yeti: c.tf_yeti_chill || 0 }
        var any = f.tide > 0 || f.yeti > 0
        Object.keys(TAS_SETS).forEach(function (m) {
            var d = TAS_SETS[m]
            if ((c[m] || 0) >= d[1] && (d[2] == null || tasHasCurio(entity, d[2]))) {
                f[d[0]] = true
                any = true
            }
        })
        if (!any) f = null
    }
    if (f == null && prev === undefined) return
    if (f == null) {
        delete TAS_FLAGS[key]
        TAS_N--
    } else {
        if (prev === undefined) TAS_N++
        TAS_FLAGS[key] = f
    }
    if (!!(f && f.nept) != !!(prev && prev.nept)) tasSwim(entity, !!(f && f.nept))
    if (!!(f && f.tide > 0) != !!(prev && prev.tide > 0)) tasBreathing(entity, !!(f && f.tide > 0))
}

ForgeEvents.onEvent("net.minecraftforge.event.entity.living.LivingEquipmentChangeEvent", tasSafe(function (event) {
    var sl = event.slot
    if (sl != TAS_Slot.HEAD && sl != TAS_Slot.CHEST && sl != TAS_Slot.LEGS && sl != TAS_Slot.FEET) return
    tasRecompute(event.entity)
}))
try {
    ForgeEvents.onEvent("top.theillusivec4.curios.api.event.CurioChangeEvent", tasSafe(function (event) {
        tasRecompute(event.entity)
    }))
} catch (e) {
    console.info("[tinkers armor] Curios not present, Aether set gloves are not checked on curio changes")
}
ForgeEvents.onEvent("net.minecraftforge.event.entity.player.PlayerEvent$PlayerLoggedOutEvent", tasSafe(function (event) {
    var key = String(event.entity.stringUUID)
    if (TAS_FLAGS[key] !== undefined) {
        delete TAS_FLAGS[key]
        TAS_N--
    }
}))
// Death creates a new entity (attribute modifiers and effects are gone, but with keepInventory the armor stays), so the cached flags
// would make tasRecompute skip re-applying neptune/tide: forget them first, then recompute against the respawned entity.
ForgeEvents.onEvent("net.minecraftforge.event.entity.player.PlayerEvent$PlayerRespawnEvent", tasSafe(function (event) {
    var key = String(event.entity.stringUUID)
    if (TAS_FLAGS[key] !== undefined) {
        delete TAS_FLAGS[key]
        TAS_N--
    }
    tasRecompute(event.entity)
}))

// ---- hooks ---------------------------------------------------------------------------------------------------------------------
ForgeEvents.onEvent("net.minecraftforge.event.entity.living.LivingHurtEvent", tasSafe(function (event) {
    if (TAS_N == 0) return
    var src = event.source
    var atk = src.actual
    if (atk == null) return
    // attacker: Tide set, Strength while wet = +3 per piece worn (Strength I-IV), melee only
    if (atk.isPlayer() && src.immediate == atk) {
        var fa = TAS_FLAGS[String(atk.stringUUID)]
        if (fa !== undefined && fa.tide > 0 && atk.isInWaterRainOrBubble()) event.amount = event.amount + 3.0 * fa.tide
    }
    // victim: Yeti fur chills the attacker (TF EntityEvents.entityHurts: Frosty, 5 ticks per piece + 5, amplifier = pieces)
    var v = event.entity
    if (v.isPlayer() && atk.isLiving()) {
        var fv = TAS_FLAGS[String(v.stringUUID)]
        if (fv !== undefined && fv.yeti > 0) atk.potionEffects.add("twilightforest:frosted", 5 * fv.yeti + 5, fv.yeti)
    }
}))

ForgeEvents.onEvent("net.minecraftforge.event.entity.living.LivingEvent$LivingJumpEvent", tasSafe(function (event) {
    if (TAS_N == 0) return
    var e = event.entity
    if (!e.isPlayer() || e.level.clientSide) return
    var f = TAS_FLAGS[String(e.stringUUID)]
    if (f === undefined || !f.grav) return
    e.push(0, 1, 0) // GravititeArmor.boostedJump
    e.connection.send(new TAS_Packet(e))
}))

ForgeEvents.onEvent("net.minecraftforge.event.entity.living.LivingFallEvent", tasSafe(function (event) {
    if (TAS_N == 0) return
    var e = event.entity
    if (!e.isPlayer()) return
    var f = TAS_FLAGS[String(e.stringUUID)]
    if (f !== undefined && (f.grav || f.valk || f.sentry)) event.canceled = true // AbilityHooks.ArmorHooks.fallCancellation
}))

ForgeEvents.onEvent("net.minecraftforge.event.entity.living.LivingAttackEvent", tasSafe(function (event) {
    if (TAS_N == 0) return
    var e = event.entity
    if (!e.isPlayer()) return
    var f = TAS_FLAGS[String(e.stringUUID)]
    if (f === undefined || !f.phoenix) return
    if (TAS_FIRE_SOURCES.indexOf(String(event.source.getMsgId())) >= 0) {
        event.canceled = true // PhoenixArmor.extinguishUser
        e.clearFire()
    }
}))
