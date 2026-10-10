GTCEuStartupEvents.registry("gtceu:material", e => {
    GTMaterials.Carbon.setProperty(PropertyKey.TOOL, ToolProperty.Builder.of(12, 6, 64, 1).build()) 
    //harvestSpeed, attackDamage, durability, harvestLevel
    // GTMaterials.VanadiumSteel.setProperty(PropertyKey.TOOL, ToolProperty.Builder.of(10, 8, 3200, 4).build())
    GTMaterials.get("energetic_alloy").setProperty(PropertyKey.TOOL, ToolProperty.Builder.of(16, 4, 1440, 4).build())
    GTMaterials.get("pink_steel").setProperty(PropertyKey.TOOL, ToolProperty.Builder.of(4, 6, 5640, 3).build())
    GTMaterials.get("pearlic_steel").setProperty(PropertyKey.TOOL, ToolProperty.Builder.of(8, 6, 1440, 3).build())
    GTMaterials.get("energetic_pearlic_alloy").setProperty(PropertyKey.TOOL, ToolProperty.Builder.of(4, 16, 3600, 4).build())

    // Ad Astra metals (ingots come from voyagercore, no TOOL there). Progression desh < ostrum < calorite, slotted around GT titanium (7,3,1600,3) / tungsten steel (8,4,2560,4)
    GTMaterials.get("desh").setProperty(PropertyKey.TOOL, ToolProperty.Builder.of(7, 4, 1800, 3).build()) // Moon, ~HV: titanium-class, a bit tougher hitting
    GTMaterials.get("ostrum").setProperty(PropertyKey.TOOL, ToolProperty.Builder.of(8, 5, 2800, 4).build()) // Mars/Venus, ~EV: just above tungsten steel
    GTMaterials.get("calorite").setProperty(PropertyKey.TOOL, ToolProperty.Builder.of(9, 6, 4200, 4).build()) // Mercury/Glacio, ~IV: top of pre-endgame, below pink steel durability

    // GTMaterials.get("lunarium").setProperty(PropertyKey.TOOL, ToolProperty.Builder.of(12, 12, 1200, 4).build())


    //durabilityMultiplier, [helmetProtection, chestplateProtection, leggingsProtection, bootsProtection]
    //Toughness & Knockback Resistance are optional.
})