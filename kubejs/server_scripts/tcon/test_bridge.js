// TEST ONLY (branch test/tinkers-test-chests, merged into playtest/all only; delete this file before release).
// Command bridge for remote testing: once per second the server reads kubejs/bridge/commands.json
//   { "id": "<unique id>", "commands": ["kubejs custom_command tinkers_input_check", "execute as @p at @s run ..."] }
// and runs each command once per new id as the server console (op level, feedback in logs/latest.log). Commands that need a
// player use "execute as @p at @s run ..." or the prefix "player:" (runs it as the first player, like chat). Results go to kubejs/bridge/result.json { id, results: [{command, result}] }
// and the log ("[bridge]"); the last id is read back from result.json, so a restart does not run old commands again.
var TB_COMMANDS = "kubejs/bridge/commands.json"
var TB_RESULT = "kubejs/bridge/result.json"
var TB_lastId = undefined

function tbRead(path) {
    try {
        let text = JsonIO.readString(path)
        return text ? JSON.parse(String(text)) : null
    } catch (e) {
        return null // missing file
    }
}

ServerEvents.tick((event) => {
    let server = event.server
    if (server.tickCount % 20 != 0) return
    if (TB_lastId === undefined) {
        let last = tbRead(TB_RESULT)
        TB_lastId = last && last.id != null ? String(last.id) : null
    }
    let req = tbRead(TB_COMMANDS)
    if (!req || req.id == null || String(req.id) === TB_lastId) return
    TB_lastId = String(req.id)
    let results = []
    let commands = req.commands || []
    commands.forEach((c) => {
        let r
        try {
            let cs = String(c)
            if (cs.indexOf("player:") == 0) {
                // run as the (first) player, like typing it in chat (some mod commands reject the console/execute source)
                let p = server.players.length > 0 ? server.players[0] : null
                r = p ? String(p.runCommand(cs.substring(7))) : "no player online"
            } else r = String(server.runCommand(cs))
        } catch (e) {
            r = "error: " + e
        }
        console.info("[bridge] " + TB_lastId + " /" + c + " -> " + r)
        results.push({ command: String(c), result: r })
    })
    JsonIO.write(TB_RESULT, { id: TB_lastId, results: results })
})
