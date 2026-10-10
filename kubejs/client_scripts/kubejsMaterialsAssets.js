// Generates the Tinkers render info (assets/kubejs/tinkering/materials/<m>.json) of the kubejs:* materials from
// global.KUBEJS_MATERIALS (startup_scripts/util/kubejsMaterials.js). Lang and colour files stay static.
// Also hides, in EMI, every Tinkers material item (repair kits and all tool parts) of the loot-only (c: false) kubejs
// materials: Tinkers lists a stack per material for each part in its creative tabs, but those materials cannot be built.
// Index file 02_kmat_hide_kits uses "removed" with exact stacks {type, id, nbt}; Tinkers' part stacks carry only
// {Material:"<id>"} (IMaterialItem.MATERIAL_TAG = "Material"). The part list is every registered IMaterialItem.
var KMAT_ForgeRegistries = Java.loadClass("net.minecraftforge.registries.ForgeRegistries")
var KMAT_IMaterialItem = Java.loadClass("slimeknights.tconstruct.library.tools.part.IMaterialItem")
var kmatPartIds = null

function kmatPartItemIds() {
    if (kmatPartIds == null) {
        var ids = []
        KMAT_ForgeRegistries.ITEMS.getEntries().forEach(function (e) {
            if (e.getValue() instanceof KMAT_IMaterialItem) ids.push(String(e.getKey().location()))
        })
        kmatPartIds = ids.sort()
    }
    return kmatPartIds
}

ClientEvents.highPriorityAssets(function (event) {
    var table = global.KUBEJS_MATERIALS
    var ids = Object.keys(table)
    ids.forEach(function (id) {
        event.add("kubejs:tinkering/materials/" + id, global.kmatRenderInfo(table[id]))
    })

    var parts = kmatPartItemIds()
    var removed = []
    ids.forEach(function (id) {
        if (table[id].c) return
        var nbt = '{Material:"kubejs:' + id + '"}'
        parts.forEach(function (part) {
            removed.push({ type: "item", id: part, nbt: nbt })
        })
    })
    event.add("emi:index/stacks/kubejs_02_kmat_hide_kits", { removed: removed })

    // Twilight Forest ironwood armor converts to tconstruct:ironwood, whose stock render info has no plating stats (missing plating textures).
    // Copy of the jar's assets/tconstruct/tinkering/materials/ironwood.json with the plating stats added to supported_stats.
    event.add("tconstruct:tinkering/materials/ironwood", {
        "color": "FFB9B3AC",
        "fallbacks": [
            "wood",
            "stick",
            "primitive"
        ],
        "generator": {
            "supported_stats": [
                "tconstruct:head",
                "tconstruct:handle",
                "tconstruct:binding",
                "tconstruct:repair_kit",
                "tconstruct:limb",
                "tconstruct:grip",
                "tconstruct:armor_plating",
                "tconstruct:plating_helmet",
                "tconstruct:plating_chestplate",
                "tconstruct:plating_leggings",
                "tconstruct:plating_boots",
                "tconstruct:plating_shield",
                "tconstruct:maille",
                "tconstruct:armor_maille",
                "tconstruct:shield_core",
                "tconstruct:ingot"
            ],
            "transformer": {
                "type": "tconstruct:recolor_sprite",
                "color_mapping": {
                    "type": "tconstruct:grey_to_color",
                    "palette": [
                        {
                            "color": "FF000000",
                            "grey": 0
                        },
                        {
                            "color": "FF1C1713",
                            "grey": 63
                        },
                        {
                            "color": "FF433B27",
                            "grey": 102
                        },
                        {
                            "color": "FF6C645C",
                            "grey": 140
                        },
                        {
                            "color": "FF887E71",
                            "grey": 178
                        },
                        {
                            "color": "FFB9B3AC",
                            "grey": 216
                        },
                        {
                            "color": "FF9AE43E",
                            "grey": 255
                        }
                    ]
                }
            }
        }
    })
})
