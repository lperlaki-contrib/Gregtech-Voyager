// Make EMI (and JEI) tell Tinkers tools apart by their MATERIALS, so clicking a variant (e.g. the zanite Tinkers pickaxe) shows only
// recipes that output that exact material combination instead of every tconstruct:pickaxe recipe.
//
// Root cause (EMI 1.1.22 + TConstruct 3.11.2): EMI's JEMI layer (JemiPlugin.parseSubtypes) turns every JEI subtype interpreter into an
// EMI default comparison, but asks it with UidContext.Recipe. TConstruct registers ToolSubtypeInterpreter.INGREDIENT for multipart
// tools, which returns "" for any context except Ingredient, so all pickaxes compare equal (EmiRecipes$Manager.byOutput hashes
// outputs with that comparison).
//
// Fix: register TConstruct's own ToolSubtypeInterpreter.ALWAYS (materials string in every context, plain Java, no JS maths) for the
// Tinkers tool items our plan produces, through KubeJS' JEI event. JEI keeps the FIRST interpreter registered per item and ignores
// later ones, so this only works if KubeJS' JEI plugin runs before TConstruct's (check client.log for JEI's "already registered"
// message if variants still match everything).
// The variant stacks (tinkersAssets.js) and the swapped recipe outputs are both built by global.tinkersPartsFor, so their tic_materials
// are identical. Rhino: no spread/destructuring, no const in loops.
// Exception: Tinkers' tool-building display output (materials tconstruct:ui_render#...) compares equal to the plain tool, so
// the generic entry keeps its Tinker Station recipe.
JEIEvents.subtypes((event) => {
    global.tinkersEnsurePlan()
    const Always = Java.loadClass("slimeknights.tconstruct.plugin.jei.util.ToolSubtypeInterpreter").ALWAYS
    const Ctx = Java.loadClass("mezz.jei.api.ingredients.subtypes.UidContext").Ingredient
    const seen = {}
    let n = 0
    Object.keys(global.TINKERS_PLAN).forEach((id) => {
        const parts = global.tinkersPartsFor(id)
        if (!parts || seen[parts.tool]) return
        seen[parts.tool] = true
        try {
            event.registerInterpreter(Item.of(parts.tool).item, (stack) => {
                let key = String(Always.apply(stack, Ctx))
                // the Tinker Station recipe's display output uses placeholder "ui_render" materials: treat it like the plain tool
                // (no materials, key ""), so the generic entry still shows how to build the tool from parts
                return key.indexOf("tconstruct:ui_render") == 0 ? "" : key
            })
            n++
        } catch (e) {
            console.warn("[tinkers tools] cannot register material comparison for " + parts.tool + ": " + e)
        }
    })
    console.info("[tinkers tools] registered material-based JEI/EMI comparison for " + n + " Tinkers tools")
})
