// priority: -100
// Replaced tools (startup plan, startup_scripts/tinkers/tinkers_plan.js) can no longer be obtained (recipes swapped, loot converted),
// so they are taken out of EVERY item tag: tag ingredients (e.g. #forge:tools/knives, GT crafting-tool tags) then list only the
// Tinkers tools in EMI, and nothing tag-based accepts a leftover original. Runs last (priority -100) so later tag additions can't
// put them back. Kept in tags: stand-ins whose original recipe stays (removeStandInRecipes=false), armor when convertArmor=false.
ServerEvents.tags("item", (event) => {
    global.tinkersEnsurePlan()
    const cfg = global.tinkersConfig()
    const plan = global.TINKERS_PLAN
    const ids = Object.keys(global.TINKERS_HIDE_ONLY || {})
    Object.keys(plan).forEach((id) => {
        let p = plan[id]
        if (p.armor && !cfg.convertArmor) return
        if (p.substitute && !cfg.removeStandInRecipes) return
        ids.push(id)
    })
    if (ids.length == 0) return
    // one regex = one pass over all tags (instead of one pass per id)
    event.removeAllTagsFrom(new RegExp("^(" + ids.map((i) => i.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")$"))
    console.info("[tinkers tools] removed " + ids.length + " replaced tools from all item tags")
})
