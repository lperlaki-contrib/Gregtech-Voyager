// Client resources derived from the startup plan (startup_scripts/tinkers/tinkers_plan.js), injected into KubeJS' virtual asset
// pack on every normal resource load: no generated/committed files, no manual reload.
//  1. render info for the generated kubejs:auto_<name> materials (grey_to_color palette from the material colour)
//  2. EMI: each converted tool is listed as its Tinkers variant WITH materials, right after the original item
//     (index/stacks/kubejs_00_tinkers_variants: collapses all Tinkers tools to one entry per kind + craftable variants), search aliases = the original item name (aliases/kubejs_tinkers_variants),
//     and the originals are hidden (index/stacks/kubejs_01_tinkers_hide: filters) unless showReplacedTools (kubejs/config/tinkers_tools.json).
//     EMI only reads these data files from the "emi" namespace (EmiDataLoader skips every other one), hence emi:<path>/kubejs_*.
//     EMI applies index files per file; the variants file is named so it sorts BEFORE the hide file, so the original anchor
//     still exists when the variant is inserted (if the order were reversed, variants are appended at the end of the list).
//  3. lang: material.kubejs.auto_<name> = Title Case name
// Rhino: no spread/destructuring, no const in loops; helpers are function declarations.
// Java classes loaded once at script load (Rhino: no const declarations inside blocks of repeatedly-run event callbacks)
var TA_ForgeRegistries = Java.loadClass("net.minecraftforge.registries.ForgeRegistries")
var TA_IModifiable = Java.loadClass("slimeknights.tconstruct.library.tools.item.IModifiable")
ClientEvents.highPriorityAssets((event) => {
    global.tinkersEnsurePlan() // plan may not be built yet (startup order)
    const plan = global.TINKERS_PLAN
    const autos = global.TINKERS_AUTO
    const GREYS = [0, 63, 102, 140, 178, 216, 255]
    const FACTORS = [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.0]

    function hex2(v) {
        return ("0" + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2)
    }
    function shade(rgb, f, i) {
        let out = "FF"
        for (let c = 0; c < 3; c++) {
            let v = parseInt(rgb.substr(c * 2, 2), 16) * f
            if (i == 6) v = v + (255 - v) * 0.6 // brightest stop lerps towards white
            out += hex2(v)
        }
        return out.toUpperCase()
    }
    function renderInfo(a) {
        let palette = []
        for (let i = 0; i < GREYS.length; i++) palette.push({ color: shade(a.color, FACTORS[i], i), grey: GREYS[i] })
        return {
            color: "FF" + a.color.toUpperCase(),
            fallbacks: ["metal"],
            generator: {
                supported_stats: ["tconstruct:head", "tconstruct:handle", "tconstruct:binding", "tconstruct:repair_kit"],
                transformer: {
                    type: "tconstruct:recolor_sprite",
                    color_mapping: { type: "tconstruct:grey_to_color", palette: palette }
                }
            }
        }
    }
    Object.keys(autos).forEach((n) => event.add("kubejs:tinkering/materials/auto_" + n, renderInfo(autos[n])))

    // ---- EMI ----
    // Index file "00_tinkers_variants" does, in EMI's per-file order (removed -> filters -> added; verified in EmiStackList.bake):
    //   1. filters: drop EVERY Tinkers tool/armor item (all IModifiable items; filters match the registry id, so all material variants
    //      Tinkers puts in the creative tabs go) -
    //   2. added: ONE generic stack per tool kind (plain item, no NBT) + the variants a normal crafting recipe produces
    //      (anchored after the original item). Doing both in one file makes it independent of file order.
    // Loot-only unique tools and (unless craftable) golden tools are listed too, with an info page naming the source; stand-ins
    // (diamond/netherite -> cobalt/manyullyn) are not listed, they would duplicate craftable variants.
    // Tool PARTS (pick_head etc.) are not IModifiable and are left alone (Tinkers lists each part for every material).
    const cfg = global.tinkersConfig()
    const lootOnly = {}
    global.TINKERS_LOOT_SOURCES.forEach((src) => src[2].forEach((id) => { lootOnly[id] = true }))
    if (!global.tinkersToolItems) {
        let ids = []
        TA_ForgeRegistries.ITEMS.getEntries().forEach((e) => {
            if (e.getValue() instanceof TA_IModifiable) ids.push(String(e.getKey().location()))
        })
        global.tinkersToolItems = ids.sort()
    }
    const toolItems = global.tinkersToolItems
    let seen = {}
    let added = []
    let aliases = []
    let hidden = Object.keys(global.TINKERS_HIDE_ONLY)
    let craftable = 0
    let lootListed = 0
    const goldStacks = []
    toolItems.forEach((id) => added.push({ stack: { type: "item", id: id } }))
    Object.keys(plan).forEach((id) => {
        let p = plan[id]
        if (p.armor && !cfg.convertArmor) return // convertArmor=false: armor is left alone everywhere
        let parts = global.tinkersPartsFor(id)
        hidden.push(id)
        // listed: craftable variants (the recipe swap produces exactly this stack) and loot-only unique tools (Valkyrie, Aether
        // dungeon weapons, ...: their info page names the source). Not listed: stand-ins (they would duplicate craftable
        // cobalt/manyullyn tools) and golden tools unless craftable.
        if (p.substitute) return
        let goldLoot = p.gold && !cfg.craftableGoldenTools // golden tools without craftableGoldenTools: loot only, listed + info page
        let key = parts.tool + "|" + parts.mats.join(",")
        if (seen[key]) return
        seen[key] = true
        let stack = {
            type: "item",
            id: parts.tool,
            nbt: "{tic_materials:[" + parts.mats.map((m) => '"' + m + '"').join(",") + "]}"
        }
        added.push({ stack: stack, after: { type: "item", id: id } }) // EMI key is "stack" (EmiData)
        if (goldLoot) goldStacks.push(stack)
        if (lootOnly[id] || goldLoot) lootListed++
        else craftable++
        let ns = id.split(":")[0]
        // GT names are generic ("%s Pickaxe"), so only other mods get an alias (lang key of the original item)
        // the item's own translation key (some mods' keys differ from item.<ns>.<path>, e.g. Ice and Fire armor)
        if (ns != "gtceu") aliases.push({ stacks: stack, text: String(Item.of(id).item.getDescriptionId()) })
    })
    event.add("emi:index/stacks/kubejs_00_tinkers_variants", {
        filters: toolItems.length > 0 ? ["/(" + toolItems.join("|") + ")$/"] : [],
        added: added
    })
    event.add("emi:aliases/kubejs_tinkers_variants", { aliases: aliases })
    console.info("[tinkers tools] EMI index: " + toolItems.length + " Tinkers tool kinds collapsed to one entry each, " + craftable +
        " craftable variants and " + lootListed + " loot-only tools added")

    // Info pages for loot-only tools (no crafting recipe produces the variant, so EMI would only show tconstruct:<tool> recipes)
    if (goldStacks.length > 0) {
        event.add("emi:recipe/additions/kubejs_tinkers_source_golden", { type: "emi:info", stacks: goldStacks, text: ["kubejs.tinkers_source.golden"] })
    }
    global.TINKERS_LOOT_SOURCES.forEach((src) => {
        let stacks = []
        let keys = {}
        src[2].forEach((id) => {
            let parts = plan[id] && (cfg.convertArmor || !plan[id].armor) ? global.tinkersPartsFor(id) : null
            if (!parts) return
            let k = parts.tool + "|" + parts.mats.join(",")
            if (keys[k]) return
            keys[k] = true
            stacks.push({ type: "item", id: parts.tool, nbt: "{tic_materials:[" + parts.mats.map((m) => '"' + m + '"').join(",") + "]}" })
        })
        if (stacks.length > 0) {
            event.add("emi:recipe/additions/kubejs_tinkers_source_" + src[0], {
                type: "emi:info",
                stacks: stacks,
                text: ["kubejs.tinkers_source." + src[0]]
            })
        }
    })
    if (!cfg.showReplacedTools && hidden.length > 0) {
        event.add("emi:index/stacks/kubejs_01_tinkers_hide", { filters: ["/(" + hidden.join("|") + ")$/"] })
    }
})

ClientEvents.lang("en_us", (event) => {
    global.TINKERS_LOOT_SOURCES.forEach((src) => event.add("kubejs", "kubejs.tinkers_source." + src[0], src[1]))
    event.add("kubejs", "kubejs.tinkers_source.golden", "Golden tools can't be crafted: they only come from loot (chests, mobs, bartering).")
    global.tinkersEnsurePlan() // plan may not be built yet (startup order)
    const autos = global.TINKERS_AUTO
    Object.keys(autos).forEach((n) => {
        let title = n.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
        event.add("kubejs", "material.kubejs.auto_" + n, title)
    })
})

// One-time lang sanity check after login (I18n is ready then): every material used by the plan needs material.<ns>.<name>.
let langChecked = false
ClientEvents.loggedIn(() => {
    if (langChecked) return
    langChecked = true
    const I18n = Java.loadClass("net.minecraft.client.resources.language.I18n")
    const seen = {}
    let missing = []
    function check(m) {
        if (seen[m]) return
        seen[m] = true
        let p = m.replace("#", ".").split(":") // variants: tconstruct:rock#stone -> material.tconstruct.rock.stone
        if (!I18n.exists("material." + p[0] + "." + p[1])) missing.push(m)
    }
    Object.keys(global.TINKERS_PLAN).forEach((id) => {
        let parts = global.tinkersPartsFor(id)
        parts.mats.forEach(check)
    })
    console.info("[tinkers tools] lang check: " + Object.keys(seen).length + " materials, missing name for " + missing.length +
        (missing.length > 0 ? ": " + missing.join(", ") : ""))
})

// DEBUG (remove before release): after login, log which of our EMI data files the client resource manager exposes.
// EMI reads only emi:<path> files (EmiDataLoader), so each path should list our emi:<path>/kubejs_* files.
var TA_HashMap = Java.loadClass("java.util.HashMap")
ClientEvents.loggedIn(() => {
    try {
        let rm = Client.getResourceManager()
        let paths = ["index/stacks", "aliases", "recipe/additions"]
        for (let i = 0; i < paths.length; i++) {
            let found = []
            // copy into a HashMap: Rhino tries ".keySet" as a map key first, and the returned TreeMap<ResourceLocation, _>
            // throws ClassCastException when it compares that String key
            new TA_HashMap(rm.listResources(paths[i], (rl) => true)).keySet().forEach((rl) => {
                let s = String(rl)
                if (s.indexOf("kubejs") >= 0) found.push(s)
            })
            console.info("[tinkers tools] DEBUG EMI files under " + paths[i] + ": " + found.length + " -> " + found.sort().join(", ").substring(0, 600))
        }
    } catch (e) {
        console.warn("[tinkers tools] DEBUG EMI file listing failed: " + e)
    }
})
