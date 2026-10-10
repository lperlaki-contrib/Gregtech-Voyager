// Tinkers knives. Reuse existing Tinkers sprites; data in data/kubejs/tinkering/*
StartupEvents.registry('item', e => {
    // Load classes inside the factories: they run during Forge's item RegisterEvent. Loading GTToolType here at
    // KubeJS construction triggers its static init before GT's registries are ready and crashes GT (gtceu:sound frozen).
    function tinkersDef(path) {
        var RL = Java.loadClass('net.minecraft.resources.ResourceLocation')
        return Java.loadClass('slimeknights.tconstruct.library.tools.definition.ToolDefinition').create(new RL('kubejs', path))
    }
    function props() {
        var Props = Java.loadClass('net.minecraft.world.item.Item$Properties')
        return new Props().stacksTo(1)
    }

    // gregic's class: damages itself via getCraftingRemainingItem => works as GT crafting knife
    e.createCustom('kubejs:knife', () => {
        var GTItem = Java.loadClass('com.sward.gregictinkering.tools.ModifiableGTToolItem')
        var GTToolType = Java.loadClass('com.gregtechceu.gtceu.api.item.tool.GTToolType')
        return new GTItem(props(), tinkersDef('knife'), GTToolType.KNIFE, false)
    })

    e.createCustom('kubejs:butcher_knife', () => {
        var ModifiableItem = Java.loadClass('slimeknights.tconstruct.library.tools.item.ModifiableItem')
        return new ModifiableItem(props(), tinkersDef('butcher_knife'))
    })

    e.createCustom('kubejs:shovel', () => {
        var ModifiableItem = Java.loadClass('slimeknights.tconstruct.library.tools.item.ModifiableItem')
        return new ModifiableItem(props(), tinkersDef('shovel'))
    })
})

// Tinkers only registers its tool colour handler for its own items; without it GT materials render grey.
if (Platform.isClientEnvironment()) {
    ForgeModEvents.onEvent('net.minecraftforge.client.event.RegisterColorHandlersEvent$Item', event => {
        var ToolModel = Java.loadClass('slimeknights.tconstruct.library.client.model.tools.ToolModel')
        var ids = ['kubejs:knife', 'kubejs:butcher_knife', 'kubejs:shovel']
        ids.forEach(id => {
            ToolModel.registerItemColors(event.getItemColors(), () => Item.of(id).getItem())
        })
    })
}
