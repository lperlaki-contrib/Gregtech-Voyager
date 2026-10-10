// On-demand balance report: compares every converted original (startup plan) with the Tinkers tool/armor it becomes,
// grouped by Tinkers material (one line per material and stat, with the ratio range and the worst tool).
// Run in game: /kubejs custom_command tinkers_stat_check   -> logs/kubejs/server.log
// Compared: durability, attack damage, mining speed (digging tools only: Tinkers halves it on swords on purpose), harvest
// level (capped at 4: Tinkers' highest), armor. GT tools use GT's own per-tool-type totals (IGTTool.getTotal*), not the
// material tier. Not compared: electric GT tools (battery vs durability), attack of hoes (the Tinkers kama is a weapon).
// Nothing runs at startup. Rhino: no spread/destructuring, no const in loops.
var SC_ToolStack = Java.loadClass("slimeknights.tconstruct.library.tools.nbt.ToolStack")
var SC_ToolStats = Java.loadClass("slimeknights.tconstruct.library.tools.stat.ToolStats")
var SC_TieredItem = Java.loadClass("net.minecraft.world.item.TieredItem")
var SC_DiggerItem = Java.loadClass("net.minecraft.world.item.DiggerItem")
var SC_HoeItem = Java.loadClass("net.minecraft.world.item.HoeItem")
var SC_ArmorItem = Java.loadClass("net.minecraft.world.item.ArmorItem")
var SC_IGTTool = Java.loadClass("com.gregtechceu.gtceu.api.item.IGTTool")
var SC_MAINHAND = Java.loadClass("net.minecraft.world.entity.EquipmentSlot").MAINHAND
var SC_ATTACK = Java.loadClass("net.minecraft.world.entity.ai.attributes.Attributes").ATTACK_DAMAGE
var SC_EMPTY = Java.loadClass("net.minecraft.world.item.crafting.Ingredient").EMPTY

ServerEvents.customCommand("tinkers_stat_check", (event) => {
    global.tinkersEnsurePlan()
    let plan = global.TINKERS_PLAN
    let RATIO = 1.5 // flagged when the Tinkers value is more than 1.5x higher or lower
    let groups = {} // "material|stat" -> { lo, hi, worst, worstRatio, n }
    let levels = {} // material -> "orig -> tinkers" harvest level mismatches
    let armorLines = []
    let checked = 0
    let failed = 0
    function r2(x) {
        return Math.round(x * 100) / 100
    }
    function note(mat, stat, id, orig, tin) {
        if (!(orig > 0) || !(tin > 0)) return
        let ratio = tin / orig
        if (ratio <= RATIO && ratio >= 1 / RATIO) return
        let k = mat + "|" + stat
        let g = groups[k] || (groups[k] = { lo: ratio, hi: ratio, worst: id, worstRatio: ratio, n: 0, ex: "" })
        g.n++
        g.lo = Math.min(g.lo, ratio)
        g.hi = Math.max(g.hi, ratio)
        if (Math.abs(Math.log(ratio)) > Math.abs(Math.log(g.worstRatio))) {
            g.worst = id
            g.worstRatio = ratio
            g.ex = r2(orig) + " -> " + r2(tin)
        }
        if (!g.ex) g.ex = r2(orig) + " -> " + r2(tin)
    }
    Object.keys(plan).sort().forEach((id) => {
        let p = plan[id]
        if (p.volt) return
        try {
            let orig = Item.of(id).item.getDefaultInstance()
            let item = orig.getItem()
            let t = SC_ToolStack.copyFrom(global.tinkersStackFor(id))
            t.rebuildStats()
            let st = t.getStats()
            let mat = p.mat + (p.substitute ? " (stand-in)" : "")
            checked++
            if (item instanceof SC_ArmorItem) {
                note(mat, "durability", id, orig.getMaxDamage(), st.get(SC_ToolStats.DURABILITY))
                let tArmor = st.get(SC_ToolStats.ARMOR)
                if (Math.abs(tArmor - item.getDefense()) >= 1) armorLines.push(id + " [" + mat + "]: armor " + item.getDefense() + " -> " + r2(tArmor))
                return
            }
            let gt = item instanceof SC_IGTTool
            let oDur = gt ? item.getTotalMaxDurability(orig) : orig.getMaxDamage()
            note(mat, "durability", id, oDur, st.get(SC_ToolStats.DURABILITY))
            if (!(item instanceof SC_HoeItem)) {
                let oDmg = 0
                if (gt) oDmg = item.getTotalAttackDamage(orig)
                else item.getDefaultAttributeModifiers(SC_MAINHAND).get(SC_ATTACK).forEach((m) => { oDmg += m.getAmount() })
                note(mat, "attack", id, oDmg, st.get(SC_ToolStats.ATTACK_DAMAGE))
            }
            let digger = item instanceof SC_DiggerItem
            if (gt || digger) {
                note(mat, "mining speed", id, gt ? item.getTotalToolSpeed(orig) : item.getTier().getSpeed(), st.get(SC_ToolStats.MINING_SPEED))
            }
            if (gt || item instanceof SC_TieredItem) {
                let oLevel = Math.min(gt ? item.getTotalHarvestLevel(orig) : item.getTier().getLevel(), 4)
                let tLevel = st.get(SC_ToolStats.HARVEST_TIER).getLevel()
                if (oLevel != tLevel) levels[mat] = oLevel + " -> " + tLevel
            }
        } catch (e) {
            failed++
            if (failed <= 5) console.warn("[tinkers stat check] " + id + ": " + e)
        }
    })
    Object.keys(groups).sort().forEach((k) => {
        let g = groups[k]
        let parts = k.split("|")
        console.info("[tinkers stat check] " + parts[0] + " " + parts[1] + ": x" + r2(g.lo) + (g.lo != g.hi ? "..x" + r2(g.hi) : "") +
            " (" + g.n + " tools; worst " + g.worst + " " + g.ex + ")")
    })
    Object.keys(levels).sort().forEach((m) => console.info("[tinkers stat check] " + m + " harvest level " + levels[m]))
    armorLines.forEach((l) => console.info("[tinkers stat check] " + l))
    let summary = "[tinkers stat check] " + checked + " checked (electric GT tools skipped), " + Object.keys(groups).length +
        " material/stat mismatches, " + Object.keys(levels).length + " harvest level, " + armorLines.length + " armor, " + failed + " failed"
    console.info(summary)
    if (event.player) event.player.tell(summary)
})

// /kubejs custom_command tinkers_input_check: every recipe whose tool input became "any Tinkers tool of that tier"
// (tool_recipes.js) must still exist after loading (a mod that can't read the new ingredient JSON drops the recipe with one
// log error), and its ingredient must accept the cheapest example tool and reject a wooden one when a higher tier is needed.
// Mod-specific machine logic (Ars, Blood Magic, Occultism, ...) is not covered: spot-test those in game.
ServerEvents.customCommand("tinkers_input_check", (event) => {
    let recipes = global.TINKERS_INPUT_RECIPES || {}
    let rm = event.server.getRecipeManager()
    let missing = []
    let wrong = []
    let opaque = []
    let ok = 0
    Object.keys(recipes).sort().forEach((rid) => {
        try {
            let opt = rm.byKey(rid)
            if (!opt.isPresent()) {
                missing.push(rid)
                return
            }
            let recipe = opt.get()
            let tools = {}
            recipes[rid].forEach((pid) => { tools[global.tinkersPartsFor(pid).tool] = true })
            let tested = 0
            recipe.getIngredients().forEach((ing) => {
                let items = ing.getStacks().toArray() // KubeJS hides vanilla getItems() from scripts
                if (items.length == 0 || !tools[String(items[0].id)]) return
                let good = items[0].copy() // first example = cheapest qualifying material
                SC_ToolStack.from(good).rebuildStats()
                let bad = Item.of(String(items[0].id), { tic_materials: ["tconstruct:wood", "tconstruct:wood", "tconstruct:wood"] })
                SC_ToolStack.from(bad).rebuildStats()
                // only inputs with a tier requirement must reject a wooden tool (their example names say "mining tier"; armor and
                // "any pickaxe" inputs accept every tool of the kind). .nbt: KubeJS name (getTag is hidden)
                let needsMore = String(items[0].nbt).indexOf("mining tier") >= 0
                let okGood = ing.test(good)
                let okBad = needsMore && ing.test(bad)
                if (!okGood || okBad) {
                    wrong.push(rid + (okGood ? "" : " | rejects example " + String(good.nbt).substring(0, 160)) + (okBad ? " | accepts wooden" : "") +
                        " | examples " + items.length)
                }
                tested++
            })
            if (tested == 0) opaque.push(rid)
            else ok++
        } catch (e) {
            wrong.push(rid + " (" + e + ")")
        }
    })
    // recipes with a slot nothing can fill (e.g. a tag that only held tools replaced_tool_tags.js removed); blank shaped
    // slots are the shared Ingredient.EMPTY and are skipped
    let emptySlots = []
    rm.getRecipes().forEach((recipe) => {
        try {
            let ings = recipe.getIngredients()
            for (let i = 0; i < ings.size(); i++) {
                let ing = ings.get(i)
                if (ing !== SC_EMPTY && ing.getStacks().toArray().length == 0) {
                    emptySlots.push(String(recipe.getId()))
                    return
                }
            }
        } catch (e) {
            // mod recipes that can't list their ingredients
        }
    })
    emptySlots.sort().forEach((r) => console.warn("[tinkers input check] EMPTY INPUT (nothing can fill a slot): " + r))
    missing.forEach((r) => console.warn("[tinkers input check] MISSING (removed by another script, or failed to load): " + r))
    wrong.forEach((r) => console.warn("[tinkers input check] tier check wrong: " + r))
    opaque.forEach((r) => console.info("[tinkers input check] not inspectable (mod recipe hides its ingredients), spot-test: " + r))
    let summary = "[tinkers input check] " + ok + " ok, " + missing.length + " missing, " + emptySlots.length + " empty input, " + wrong.length + " wrong, " + opaque.length + " not inspectable"
    console.info(summary)
    if (event.player) event.player.tell(summary)
})
