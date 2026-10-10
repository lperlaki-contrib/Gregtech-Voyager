// Crafting a tool yields the Tinkers equivalent instead: the original recipe is kept, only its output is swapped.
// What is converted, and with which materials, is decided once at startup (startup_scripts/tinkers/tinkers_plan.js).
// Shovel -> kubejs:shovel, hoe -> kama; GT crafting tools -> gregic tools; knives (GT, FD) -> kubejs:knife. Only the GT mortar and
// shears stay GT. Armor (cfg convertArmor): iron/gold/mod armor -> Tinkers plate armor, leather -> travelers gear; same stand-in rules. Stand-in recipes (diamond/netherite) are never swapped; golden TOOLS follow craftableGoldenTools, golden armor stays craftable (tinkers_tools.json).
// Recipes that CONSUME a converted tool (Ars glyphs, IF machines, turtles, Blood Magic, ...) would be uncraftable, so that input
// becomes "any Tinkers tool of the converted kind (e.g. any tconstruct:pickaxe), not broken, harvest tier >= the original's"
// as a pure Forge ingredient (forge:difference of partial_nbt, see inputFor); armor: any Tinkers piece of that slot.
// EMI shows example tools of the qualifying tiers. Smelting/melting/recycling recipes and GT machine recipes are not touched.
// Rhino: no spread/destructuring, no const inside for-loops (use forEach callbacks); regexes declared once.
var TR_TieredItem = Java.loadClass("net.minecraft.world.item.TieredItem")
var TR_JsonObject = Java.loadClass("com.google.gson.JsonObject")
var TR_VanillaIngredient = Java.loadClass("net.minecraft.world.item.crafting.Ingredient")
var TR_JsonParser = Java.loadClass("com.google.gson.JsonParser")
var TR_TierSorting = Java.loadClass("net.minecraftforge.common.TierSortingRegistry")
// display examples per harvest level (wood, stone, iron, diamond, netherite tier) so EMI shows the minimum tier
var TR_TIER_EXAMPLES = ["tconstruct:wood", "tconstruct:rock#stone", "tconstruct:iron", "tconstruct:cobalt", "tconstruct:manyullyn"]
var TR_TIER_NAMES = ["minecraft:wood", "minecraft:stone", "minecraft:iron", "minecraft:diamond", "minecraft:netherite"] // their harvest tiers
var TR_TIER_LABELS = ["Wood", "Stone", "Iron", "Diamond", "Netherite"]
var TR_JsonArray = Java.loadClass("com.google.gson.JsonArray")
var TR_ITEM_P = Java.loadClass("java.util.regex.Pattern").compile('"item"\\s*:\\s*"(?<id>[^"]+)"') // named group: Rhino passes group(1) as 1.0 -> group(String)
// recipe types whose tool inputs are left alone: cooking/melting/recycling the original, Tinkers' own, GT machines (not crafting)
var TR_ToolStack = Java.loadClass("slimeknights.tconstruct.library.tools.nbt.ToolStack")
var TR_StringTag = Java.loadClass("net.minecraft.nbt.StringTag")
// upgrade recipes: [original recipe id, original input tool, original output tool, other ingredients]. All shapeless; AE2's
// smithing (template + quartz tool + fluix block) becomes shapeless too: smithing copies the base's NBT and can't swap a part.
var TR_FIERY = "#twilightforest:fiery_vial"
var TR_UPGRADES = [
    ["twilightforest:equipment/fiery_iron_pickaxe", "minecraft:iron_pickaxe", "twilightforest:fiery_pickaxe", [TR_FIERY, TR_FIERY, TR_FIERY, "#forge:rods/blaze", "#forge:rods/blaze"]],
    ["twilightforest:equipment/fiery_iron_sword", "minecraft:iron_sword", "twilightforest:fiery_sword", [TR_FIERY, TR_FIERY, "#forge:rods/blaze"]],
    ["twilightforest:equipment/fiery_fiery_helmet", "minecraft:iron_helmet", "twilightforest:fiery_helmet", [TR_FIERY, TR_FIERY, TR_FIERY, TR_FIERY, TR_FIERY]],
    ["twilightforest:equipment/fiery_fiery_chestplate", "minecraft:iron_chestplate", "twilightforest:fiery_chestplate", [TR_FIERY, TR_FIERY, TR_FIERY, TR_FIERY, TR_FIERY, TR_FIERY, TR_FIERY, TR_FIERY]],
    ["twilightforest:equipment/fiery_fiery_leggings", "minecraft:iron_leggings", "twilightforest:fiery_leggings", [TR_FIERY, TR_FIERY, TR_FIERY, TR_FIERY, TR_FIERY, TR_FIERY, TR_FIERY]],
    ["twilightforest:equipment/fiery_fiery_boots", "minecraft:iron_boots", "twilightforest:fiery_boots", [TR_FIERY, TR_FIERY, TR_FIERY, TR_FIERY]],
    ["iceandfire:ghost_sword", "iceandfire:dragonbone_sword", "iceandfire:ghost_sword", ["iceandfire:ghost_ingot"]]
]
;["pickaxe", "axe", "shovel", "hoe", "sword"].forEach((k) => TR_UPGRADES.push(["ae2:tools/fluix_" + k, "ae2:certus_quartz_" + k, "ae2:fluix_" + k, ["ae2:fluix_upgrade_smithing_template", "ae2:fluix_block"]]))
var TR_SKIP_TYPE = /^(tconstruct:|minecraft:(smelting|blasting|smoking|campfire_cooking)$)|melting|recycl|salvag|repair|^gtceu:(?!.*crafting)/
ServerEvents.recipes((event) => {
    global.tinkersEnsurePlan() // plan may not be built yet (startup order)
    // Forestry Survivalist's tools: the kits (carton + bronze), unpacking a kit into the tool, the tool -> kit recipes and the
    // broken-tool recycling (it would only return bronze for tools nobody can get any more) are removed in one remove call.
    event.remove({
        id: /^forestry:(carpenter\/(kit_\w+|reclaim_bronze_\w+)|axe_kit|hoe_kit|sword_kit|kit_pickaxe|kit_shovel|bronze_(pickaxe|shovel|axe|hoe|sword))$/
    })

    // GT registers its own armor items for materials with an ARMOR property (dragonsteel_fire/ice got one so gm_construct
    // generates Tinkers plating, see registry/gt_materials.js): their armor is Tinkers plate armor, so GT's recipes go.
    // Done inside the single pass below (output filters were unreliable for GT generated recipes): global.TINKERS_HIDE_ONLY ids are removed.
    const hideOnly = global.TINKERS_HIDE_ONLY

    // ONE pass over ALL recipes, no output filter: KubeJS output filters with hundreds of ids were unreliable in playtest
    // ({output: [ids]} missed GT tool recipes; a list of {output: id} filters matched nothing). Per recipe we read the
    // compiled recipe's result item (getOriginalRecipeResult) and do an O(1) plan lookup; the stringified JSON is only a
    // fallback when the result can't be read. Only matching recipes are touched.
    const cfg = global.tinkersConfig() // read once per event
    const plan = global.TINKERS_PLAN
    const unmapped = global.TINKERS_UNMAPPED
    const planIds = Object.keys(plan)
    const t0 = Date.now()
    const RESULT_RE = /"result"\s*:\s*(?:\{[^{}]*?"item"\s*:\s*"([^"]+)"|"([^"]+)")/
    const removeUnmapped = cfg.removeUnmappedToolRecipes

    // ---- tool inputs: id -> Forge ingredient (built once per id) ----
    const OUTPUT_KEYS = ["result", "results", "output", "outputs"]
    const EARLY_MATS = ["tconstruct:wood", "tconstruct:rock#stone", "tconstruct:flint"]
    const inputCache = {}
    let exampleWarned = false
    function inputFor(id) {
        if (inputCache[id]) return inputCache[id]
        let p = plan[id]
        let parts = global.tinkersPartsFor(id)
        let shown = [p.mat] // head materials of the example stacks EMI cycles through
        let lower = [] // harvest tier names below the original's tier (only decides whether a tier requirement exists)
        let enough = [] // harvest tier names at or above it (required)
        if (!p.armor) {
            let item = Item.of(id).item
            // no tier (e.g. some GT crafting tools): any; capped at 4 = netherite, the highest Tinkers harvest tier (GT tools go higher)
            let need = item instanceof TR_TieredItem ? Math.min(item.getTier().getLevel(), 4) : -1
            if (need >= 0) {
                shown = TR_TIER_EXAMPLES.slice(need)
                TR_TierSorting.getSortedTiers().forEach((t) => {
                    let name = TR_TierSorting.getName(t)
                    if (name) (t.getLevel() < need ? lower : enough).push(String(name))
                })
            }
        }
        // Pure Forge ingredient, no script predicate (KubeJS custom predicates were rejected in real crafting):
        //   forge:difference { base: [named examples..., plain tool], subtracted: [broken, plain tool minus qualifying stored tiers] }
        // Built Tinkers tools store their tier in NBT (tic_stats."tconstruct:harvest_tier"), forge:partial_nbt matches it. The named
        // examples (cheapest qualifying material first) are what EMI shows; the plain tool makes any material match.
        // Armor: any Tinkers piece of that slot (armor value is a float stat, not matchable as data), broken ones excluded.
        let needTier = enough.length > 0 && lower.length > 0 // a real tier requirement (not wood level, not armor)
        // the requirement goes into the example's NAME (top of the tooltip; lore would sit below Tinkers' stats):
        // "Any Pickaxe, mining tier Iron or better" / "Any Pickaxe" (tool name via its translation key)
        let label = [{ text: "Any ", color: "gold", italic: false }, { translate: String(Item.of(parts.tool).item.getDescriptionId()) }]
        if (needTier) label.push({ text: ", mining tier " + TR_TIER_LABELS[TR_TIER_EXAMPLES.indexOf(shown[0])] + " or better" })
        let name = JSON.stringify(label)
        // examples: what EMI shows in the slot (cheapest qualifying material first). With a tier requirement they carry their
        // real stored tier (so they survive the subtraction below); all carry a name stating the requirement. They match nothing
        // real (no real tool has that name), matching is done by the plain tool minus the "without qualifying tier" set.
        let base = shown.map((m) => {
            let nbt = { tic_materials: parts.mats.map((x, k) => (k == 0 || (x == p.mat && x != parts.mats[1]) ? m : x)) }
            nbt.display = { Name: name }
            if (needTier) nbt.tic_stats = { "tconstruct:harvest_tier": TR_TIER_NAMES[TR_TIER_EXAMPLES.indexOf(m)] }
            return { type: "forge:partial_nbt", item: parts.tool, nbt: nbt }
        })
        base.push({ item: parts.tool })
        // Tinkers only stores stats that differ from the default and the default harvest tier is wood, so a wooden tool has NO
        // stored tier: "minus lower tiers" let it through. Subtract "tools WITHOUT a stored qualifying tier" instead
        // (plain tool minus the qualifying tiers) - this also removes the plain tool from the EMI display.
        let subtracted = [{ type: "forge:partial_nbt", item: parts.tool, nbt: { tic_broken: true } }]
        if (needTier) {
            subtracted.push({
                type: "forge:difference",
                base: { item: parts.tool },
                subtracted: enough.map((n) => ({ type: "forge:partial_nbt", item: parts.tool, nbt: { tic_stats: { "tconstruct:harvest_tier": n } } }))
            })
        }
        try {
            inputCache[id] = TR_VanillaIngredient.fromJson(TR_JsonParser.parseString(JSON.stringify({ type: "forge:difference", base: base, subtracted: subtracted })))
        } catch (e) {
            if (!exampleWarned) console.warn("[tinkers tools] tool input ingredient failed (first: " + id + "), using the plain tool: " + e)
            exampleWarned = true
            inputCache[id] = Ingredient.of(parts.tool)
        }
        return inputCache[id]
    }
    // replace every {"item": id} object outside the result keys (schema-less recipe types: KubeJS replaceInput can't see them)
    function replaceInJson(node, id, ingJson) {
        let n = 0
        if (node instanceof TR_JsonArray) {
            for (let i = 0; i < node.size(); i++) {
                let el = node.get(i)
                if (el instanceof TR_JsonObject && el.has("item") && String(el.get("item").getAsString()) == id && !el.has("type")) {
                    node.set(i, ingJson.deepCopy())
                    n++
                } else n += replaceInJson(el, id, ingJson)
            }
        } else if (node instanceof TR_JsonObject) {
            node.keySet().toArray().forEach((k) => {
                k = String(k)
                if (OUTPUT_KEYS.indexOf(k) >= 0) return
                let el = node.get(k)
                if (el instanceof TR_JsonObject && el.has("item") && String(el.get("item").getAsString()) == id && !el.has("type")) {
                    node.add(k, ingJson.deepCopy())
                    n++
                } else n += replaceInJson(el, id, ingJson)
            })
        }
        return n
    }
    let inputsReplaced = 0
    const IMPOSTOR_RE = /^computercraft:impostor_(shaped|shapeless)$/
    const impostors = [] // [original id, crafting JSON] re-added after the pass
    global.TINKERS_INPUT_RECIPES = {} // final recipe id -> substituted plan ids (checked by /kubejs custom_command tinkers_input_check)
    const inputRecipes = []
    function substituteInputs(r, j) {
        let type = j.has("type") ? String(j.get("type").getAsString()) : ""
        if (TR_SKIP_TYPE.test(type)) return
        let ids = {}
        let found = false
        let m = TR_ITEM_P.matcher(j.toString())
        while (m.find() && !found) found = !!plan[String(m.group("id"))]
        if (!found) return
        // a plan id somewhere: rescan without the output keys, so a tool recipe's own result does not count as an input
        let probe = j.deepCopy()
        OUTPUT_KEYS.forEach((k) => probe.remove(k))
        m = TR_ITEM_P.matcher(probe.toString())
        while (m.find()) {
            let id = String(m.group("id"))
            if (plan[id] && (cfg.convertArmor || !plan[id].armor)) ids[id] = true
        }
        let edited = false
        let doneIds = []
        Object.keys(ids).forEach((id) => {
            let ing = inputFor(id)
            let done = false
            try {
                done = r.replaceInput(id, ing)
            } catch (e) {}
            if (!done) done = replaceInJson(j, id, ing.toJson()) > 0
            if (done) {
                doneIds.push(id)
                edited = true
                inputsReplaced++
            }
        })
        if (edited) {
            r.save()
            inputRecipes.push(String(r.getId()))
            global.TINKERS_INPUT_RECIPES[String(r.getId())] = doneIds
            // ComputerCraft's impostor recipes (turtle + tool -> turtle with upgrade) never match: they only display the upgrade,
            // the real crafting accepts only the exact upgrade item. Re-add them as normal crafting recipes (same pattern/result).
            let im = IMPOSTOR_RE.exec(type)
            if (im) {
                let copy = j.deepCopy()
                copy.addProperty("type", "minecraft:crafting_" + im[1])
                impostors.push([String(r.getId()), copy])
                delete global.TINKERS_INPUT_RECIPES[String(r.getId())]
                global.TINKERS_INPUT_RECIPES["kubejs:tinkers_input/" + String(r.getId()).replace(":", "/")] = doneIds
            }
        }
    }
    // convertArmor=false: armor plan entries are ignored (original recipes stay untouched)
    function known(id) {
        let pl = plan[id]
        if (pl) return !pl.armor || cfg.convertArmor ? pl : null
        return removeUnmapped && unmapped[id]
    }
    // Aether "repairing" recipes (damaged armor + material -> armor) would output Tinkers armor; the original armor no longer exists
    if (cfg.convertArmor) event.remove({ id: /^aether:.*_(helmet|chestplate|leggings|boots)_repairing$/ })
    function outputOf(r) {
        // cheap rejection first: machine recipes (GT) have no "result" key; skip them before reading/stringifying anything.
        // (GT tool crafting recipes are generated at runtime, so their type can't be checked offline; every crafting-type
        // recipe has a "result" key, so this test is enough.)
        let j = r.json
        if (!j || !j.has("result")) return null
        let out = null
        try {
            let res = r.getOriginalRecipeResult()
            if (res && !res.isEmpty()) out = String(res.getId())
        } catch (e) {}
        if (!out) {
            let rm = RESULT_RE.exec(String(j))
            out = rm ? rm[1] || rm[2] : null
        }
        return out && (known(out) || hideOnly[out]) ? out : null
    }
    let swapped = 0
    const makers = {} // "tool|materials" -> { mat, gt: a gtceu recipe makes it, other: [non-gtceu recipe ids] }
    let visited = 0
    const removeIds = []
    try {
        event.forEachRecipe({ id: /.*/ }, (r) => {
            visited++
            let out = null
            try {
                let j = r.json
                try {
                    if (j) substituteInputs(r, j)
                } catch (e) { // never blocks the output swap below
                    console.warn("[tinkers tools] cannot substitute tool inputs of " + r.getId() + ": " + e)
                }
                out = outputOf(r)
                if (!out) return
                if (hideOnly[out]) { // GT dragonsteel armor: its recipes go
                    removeIds.push(String(r.getId()))
                    return
                }
                if (!plan[out]) { // unmapped plain tool (removeUnmappedToolRecipes)
                    removeIds.push(String(r.getId()))
                    return
                }
                if (plan[out].gold) { // exact kubejs:gold: swap when craftableGoldenTools, else remove (loot still converts)
                    if (!cfg.craftableGoldenTools) {
                        removeIds.push(String(r.getId()))
                        return
                    }
                } else if (plan[out].substitute) { // stand-in (cobalt/manyullyn): NEVER swapped; removed or left as the original
                    if (cfg.removeStandInRecipes) removeIds.push(String(r.getId()))
                    return
                }
                r.replaceOutput(out, global.tinkersStackFor(out))
                swapped++
                // remember who makes this exact Tinkers stack, to drop non-GT duplicates below
                let parts = global.tinkersPartsFor(out)
                let key = parts.tool + "|" + parts.mats.join(",")
                if (!makers[key]) makers[key] = { mat: plan[out].mat, gt: false, other: [] }
                if (String(r.getId()).indexOf("gtceu:") == 0) makers[key].gt = true
                else makers[key].other.push(String(r.getId()))
            } catch (e) {
                console.warn("[tinkers tools] cannot convert recipe " + r.getId() + " (" + out + "): " + e)
            }
        })
    } catch (e) {
        console.error("[tinkers tools] recipe pass failed: " + e)
    }
    console.info("[tinkers tools] swapped outputs of " + swapped + " recipes (visited " + visited + ") in " + (Date.now() - t0) + " ms")
    console.info("[tinkers tools] tool inputs -> any Tinkers tool of that kind and tier: " + inputsReplaced + " inputs in " +
        inputRecipes.length + " recipes: " + inputRecipes.join(", "))
    // Same Tinkers tool from a GT recipe AND another one (e.g. vanilla iron pickaxe + GT's hammer/file recipe): keep only GT's.
    // Not for wood/stone/flint heads: those must stay craftable before the player has GT tools.
    let deduped = 0
    Object.keys(makers).forEach((key) => {
        let mk = makers[key]
        if (!mk.gt || mk.other.length == 0 || EARLY_MATS.indexOf(mk.mat) >= 0) return
        mk.other.forEach((id) => removeIds.push(id))
        deduped += mk.other.length
    })
    console.info("[tinkers tools] removed " + deduped + " non-GT duplicate tool recipes (a GT recipe makes the same tool)")
    // Upgrade recipes (iron pickaxe + fiery vials -> fiery pickaxe, ...): the input must be a Tinkers tool of that kind containing
    // the original's material, and the result is THAT tool with those parts switched to the upgraded material (modifiers kept).
    // Ingredient like inputFor: a named example + the plain tool, minus broken tools and tools without the material.
    let upgraded = 0
    TR_UPGRADES.forEach((u) => {
        let from = plan[u[1]]
        let to = plan[u[2]]
        if (!from || !to || to.substitute || ((from.armor || to.armor) && !cfg.convertArmor)) return
        let fromParts = global.tinkersPartsFor(u[1])
        let toParts = global.tinkersPartsFor(u[2])
        if (fromParts.tool != toParts.tool) return
        let tool = fromParts.tool
        let label = [{ text: "Any ", color: "gold", italic: false }, { translate: String(Item.of(tool).item.getDescriptionId()) },
            { text: " with " }, { translate: "material." + from.mat.replace("#", ".").replace(":", ".") }, { text: " parts" }]
        let ing = TR_VanillaIngredient.fromJson(TR_JsonParser.parseString(JSON.stringify({
            type: "forge:difference",
            base: [{ type: "forge:partial_nbt", item: tool, nbt: { tic_materials: fromParts.mats, display: { Name: JSON.stringify(label) } } }, { item: tool }],
            subtracted: [
                { type: "forge:partial_nbt", item: tool, nbt: { tic_broken: true } },
                { type: "forge:difference", base: { item: tool }, subtracted: { type: "forge:partial_nbt", item: tool, nbt: { tic_materials: [from.mat] } } }
            ]
        })))
        let fromMat = from.mat
        let toMats = toParts.mats
        removeIds.push(u[0])
        event.shapeless(global.tinkersStackFor(u[2]), [ing].concat(u[3]))
            .id("kubejs:tinkers_upgrade/" + u[0].replace(":", "/"))
            .modifyResult((grid, result) => {
                let stack = grid.find(ing)
                if (!stack || stack.isEmpty()) return result
                let out = stack.copy()
                let mats = out.nbt.getList("tic_materials", 8) // 8 = string tags
                for (let i = 0; i < mats.size() && i < toMats.length; i++) {
                    if (String(mats.getString(i)) == fromMat) mats.set(i, TR_StringTag.valueOf(toMats[i]))
                }
                TR_ToolStack.from(out).rebuildStats()
                out.setCount(1)
                return out
            })
        upgraded++
    })
    console.info("[tinkers tools] " + upgraded + " upgrade recipes keep the input tool (parts of the old material -> new material)")
    impostors.forEach((pair) => {
        removeIds.push(pair[0])
        event.custom(pair[1]).id("kubejs:tinkers_input/" + pair[0].replace(":", "/"))
    })
    if (impostors.length > 0) console.info("[tinkers tools] " + impostors.length + " ComputerCraft upgrade recipes re-added as real crafting recipes")
    // Removed, not swapped: stand-in tools (e.g. diamond pickaxe -> cobalt), golden tools (unless craftable), unmapped tools
    // (removeUnmappedToolRecipes), non-GT duplicates, ComputerCraft impostors (re-added above) and GT's dragonsteel armor.
    removeIds.forEach((id) => { delete global.TINKERS_INPUT_RECIPES[id] }) // removed on purpose (stand-ins, gold, impostors)
    if (removeIds.length > 0) {
        event.remove({ id: new RegExp("^(" + removeIds.map((i) => i.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")$") })
        console.info("[tinkers tools] removed " + removeIds.length + " tool recipes (stand-in/golden/unmapped/duplicate/impostor/GT armor): " + removeIds.join(", "))
    }

    // Flint and brick must not skip GT's flint and steel gate (small steel gear + spring)
    event.remove({ id: "tconstruct:tools/building/flint_and_brick" })
    event
        .shapeless("tconstruct:flint_and_brick", [
            "minecraft:flint",
            ["tconstruct:seared_brick", "tconstruct:scorched_brick"],
            "gtceu:small_steel_gear",
            "gtceu:small_steel_spring"
        ])
        .id("kjs:tinkers/flint_and_brick")

    const skipped = Object.keys(global.TINKERS_SKIPPED).sort()
    console.info(`[tinkers tools] converted ${planIds.length} tools/armor pieces`)
    console.info(`[tinkers tools] skipped ${skipped.length}:`)
    skipped.forEach((id) => console.info(`[tinkers tools]   ${id}: ${global.TINKERS_SKIPPED[id]}`))
})
