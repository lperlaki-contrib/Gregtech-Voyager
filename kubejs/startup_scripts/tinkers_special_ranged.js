// Abilities of converted bows and shields (Tinkers longbow / plate shield carrying kubejs:* modifiers, see tinkers_plan.js).
// Sources: twilightforest-4.3.2508 (TripleBowItem.releaseUsing, Ice/Seeker/EnderBowItem.customArrow, events/ToolEvents),
// aether-1.20.1-1.5.2 (PhoenixBowItem.customArrow), endermanoverhaul-1.0.4 (mixins/common/LivingEntityMixin.blockUsingShield).
//
// The mods' mechanics hang on the ARROW, not on the bow class, so they are reused as is:
//   ender swap   -> arrow persistent data "twilightforest:ender" (TF's ProjectileImpactEvent handler does the swap)
//   phoenix fire -> Aether's PhoenixArrow capability (setPhoenixArrow + fire time 20, as the Phoenix Bow without Flame)
//   ice / seeker -> TF's IceArrow / SeekerArrow entities: the Tinkers arrow is swapped for one (full NBT copy, so damage, crit,
//                   pickup and Tinkers' projectile modifiers in ForgeCaps carry over; Forge's own EntityJoinLevelEvent handler
//                   replaces item entities the same way). Seeker arrows deal half damage, like TF's (base damage 1 vs 2).
//   tri-shot     -> two extra copies, 2/3 speed, +-0.15 vertical, not pickable (TripleBowItem)
// Corrupted shield: ShieldBlockEvent; a blocked melee attacker is teleported (1 in 4, ModUtils.teleportTarget, range 32) unless
// it is in endermanoverhaul's cant_be_teleported tag. Original: players only.
//
// Startup script: KubeJS binds ForgeEvents only here. Each handler runs server side only and never throws (an exception in a
// Forge event handler can crash the game). Rhino: no spread/destructuring, no const in loops; mod classes loaded lazily.
var TSR_AbstractArrow = Java.loadClass("net.minecraft.world.entity.projectile.AbstractArrow")
var TSR_CompoundTag = Java.loadClass("net.minecraft.nbt.CompoundTag")
var TSR_Pickup = Java.loadClass("net.minecraft.world.entity.projectile.AbstractArrow$Pickup")
var TSR_DONE = "kubejs:tinkers_arrow" // persistent-data flag: replacement / extra arrow, never handled again

function tsrClass(name) { // null when the owning mod is not installed
    try { return Java.loadClass(name) } catch (e) { return null }
}
var TSR_C = null
function tsrClasses() { // first use only: loading mod classes at script load can run their static init too early
    if (TSR_C == null) {
        var aetherCaps = tsrClass("com.aetherteam.aether.capability.AetherCapabilities")
        var eoTags = tsrClass("tech.alexnijjar.endermanoverhaul.common.tags.ModEntityTypeTags")
        TSR_C = {
            ice: tsrClass("twilightforest.entity.projectile.IceArrow"),
            seeker: tsrClass("twilightforest.entity.projectile.SeekerArrow"),
            phoenixCap: aetherCaps == null ? null : aetherCaps.PHOENIX_ARROW_CAPABILITY,
            eoUtils: tsrClass("tech.alexnijjar.endermanoverhaul.common.ModUtils"),
            eoNoTeleport: eoTags == null ? null : eoTags.CANT_BE_TELEPORTED
        }
    }
    return TSR_C
}

// dst loaded from src's NBT (new UUID), flagged as handled
function tsrCopy(src, dst) {
    var tag = new TSR_CompoundTag()
    src.saveWithoutId(tag)
    tag.remove("UUID")
    dst.load(tag)
    dst.getPersistentData().putBoolean(TSR_DONE, true)
    return dst
}

ForgeEvents.onEvent("net.minecraftforge.event.entity.EntityJoinLevelEvent", function (event) {
    var arrow = event.entity
    if (!(arrow instanceof TSR_AbstractArrow)) return // every other entity ends here
    try {
        var level = event.level
        if (level.clientSide || event.loadedFromDisk()) return
        if (arrow.getPersistentData().getBoolean(TSR_DONE)) return
        var owner = arrow.getOwner()
        if (owner == null || !owner.isLiving()) return
        // a bow fires in releaseUsing, while the bow is still the use item
        var bow = owner.getUseItem()
        var m = global.tsMods(bow.isEmpty() ? owner.mainHandItem : bow)
        if (m == null) return
        var c = null
        if (m.tf_ender_swap === true) {
            arrow.getPersistentData().putBoolean("twilightforest:ender", true)
        } else if (m.aether_phoenix_fire === true) {
            c = tsrClasses()
            var cap = c.phoenixCap == null ? null : arrow.getCapability(c.phoenixCap).resolve().orElse(null)
            if (cap != null) {
                cap.setPhoenixArrow(true)
                cap.setFireTime(20)
            }
        } else if (m.tf_triple_shot === true) {
            var mo = arrow.deltaMovement
            for (var i = -1; i <= 1; i += 2) {
                var extra = tsrCopy(arrow, arrow.getType().create(level))
                extra.setDeltaMovement(mo.x() * 2.0 / 3.0, mo.y() * 2.0 / 3.0 + 0.15 * i, mo.z() * 2.0 / 3.0)
                extra.setPos(extra.x, extra.y + 0.025, extra.z)
                extra.pickup = TSR_Pickup.CREATIVE_ONLY
                level.addFreshEntity(extra)
            }
        } else if (m.tf_ice_arrows === true || m.tf_seeker_arrows === true) {
            c = tsrClasses()
            var seeker = m.tf_seeker_arrows === true
            var Cls = seeker ? c.seeker : c.ice
            if (Cls == null) return
            var repl = tsrCopy(arrow, new Cls(level, owner))
            if (seeker) repl.setBaseDamage(arrow.getBaseDamage() * 0.5)
            event.setCanceled(true)
            level.addFreshEntity(repl)
        }
    } catch (e) {
        console.error("[tinkers ranged] arrow ability failed: " + e)
    }
})

ForgeEvents.onEvent("net.minecraftforge.event.entity.living.ShieldBlockEvent", function (event) {
    try {
        var blocker = event.entity
        if (blocker.level.clientSide || !blocker.isPlayer()) return
        var attacker = event.damageSource.directEntity
        if (attacker == null || !attacker.isLiving()) return
        var m = global.tsMods(blocker.getUseItem())
        if (m == null || m.eo_corrupted_ward !== true) return
        if (blocker.level.random.nextInt(4) != 0) return
        var c = tsrClasses()
        if (c.eoUtils == null || (c.eoNoTeleport != null && attacker.getType().is(c.eoNoTeleport))) return
        c.eoUtils.teleportTarget(blocker.level, attacker, 32)
    } catch (e) {
        console.error("[tinkers ranged] corrupted ward failed: " + e)
    }
})
