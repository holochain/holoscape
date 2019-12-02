const { menubar } = require('menubar')
const { app, ipcMain, protocol } = require('electron')
const conductor = require('./conductor.js')
const path = require('path')
const { Holoscape, systemTrayIconEmpty, systemTrayIconFull } = require('./holoscape')
const { loadUIinfo, sanitizeUINameForScheme, HAPP_SCHEME } = require('./happ-ui-controller')
const TOML = require('@iarna/toml')

const mb = menubar({
  showDockIcon: true, 
  browserWindow: {icon: systemTrayIconFull()},
  icon: systemTrayIconFull(),
  tooltip: 'Holoscape - The Holochain run-time'
});
global.mb = mb


/// We want hApp UIs to be able to use localStorage/sessionStorage.
/// Chromium doesn't allow that for every source.
/// Since we are using custom URI schemes to redirect UIs' resources to
/// their respective directory under .config/Holoscape/UIs, we have
/// to register those hApp specific URI schemes here to be privileged.
console.log('Registering scheme as priviliged:', HAPP_SCHEME)
protocol.registerSchemesAsPrivileged([{
  scheme: HAPP_SCHEME,
  privileges: { standard: true, supportFetchAPI: true, secure: true }
}])

/// Here, we install a 3s interval to check the IPC connections to the conductor
/// since we
///  a) don't know how long it takes to boot the conductor (depending on conductor-config and system resources)
///  b) might shutdown and reboot the conductor after Holoscape start-up
setInterval(()=>{
  try {
    global.holoscape.checkConductorConnection()
    global.holoscape.checkConductorPassphraseSocket()
  } catch(e) {
    console.log('Error during connection check:', e)
  }

}, 3000)

/// We don't want a closed window to shutdown the app as lifecycle is controlled
/// through the system tray icon/menu.
app.on('window-all-closed', e => {
  if(!global.holoscape.quitting) e.preventDefault()
})

app.on('before-quit', e => {
  if(!global.holoscape.quitting) {
    global.holoscape.quit()
  }
})

mb.on('ready', async () => {
  mb.tray.setImage(systemTrayIconEmpty())
  global.holoscape = new Holoscape()
  await global.holoscape.showSplashScreen()

  if(!conductor.hasBinaries()) {
    global.holoscape.splash.webContents.send('missing-binaries')
    return
  }

  if(!conductor.hasConfig()) {
      console.log("No conductor config found. Initializing...")
      await new Promise((resolve)=>setTimeout(resolve, 1000))
      global.holoscape.splash.webContents.send('request-network-config')
      let config = await new Promise( (resolve, reject) => {
          ipcMain.on('network-config-set', (event, config) => {
              resolve(config)
          })
      } )
      const type = config.type
      // apply defaults
      switch(type) {
      case "sim1h":
          config = {
              dynamo_url: config.dynamo_url || "http://localhost:8000"
          }
          break
      case "sim2h":
          config = {
              sim2h_url: config.sim2h_url || "wss://localhost:9000"
          }
          break
      case "lib3h":
          let network_id = config.network_id
          network_id = {
              nickname: network_id.nickname || "holochain-testnet",
              id: "HcMFakeAddr"
          }
          config = {
              network_id: network_id,
              bootstrap_nodes: config.bootstrap_nodes,
              transport_configs: [{type: "websocket", data:"Unencrypted"}],
              work_dir: "",
              log_level: "d",
              bind_url: "ws://0.0.0.0",
              dht_gossip_interval: 3000,
              dht_timeout_threshold: 1000,
              dht_custom_config: [],
          }
          break
      case "memory":
          config = {
              network_id: {
                  nickname: "holoscape-in-memory",
                  id: "HcMFakeAddr"
              },
              bootstrap_nodes: [],
              transport_configs: [{type: "memory", data:""}],
              work_dir: "",
              log_level: "d",
              bind_url: "none:",
              dht_gossip_interval: 3000,
              dht_timeout_threshold: 1000,
              dht_custom_config: [],
          }
      }
    config.type = type
    const networkConfigToml = TOML.stringify({network: config})
    console.log(networkConfigToml)
    conductor.initConfig(networkConfigToml)
  }

  if(!conductor.hasConfig()) {
    console.error("Could not initialize conductor config in", conductor.configPath)
    app.quit()
    return
  }

  global.rootConfigPath = conductor.rootConfigPath()

  global.logMessages = []
  global.holoscape.init()
});

ipcMain.on('quit', () => {
  process.exit()
})
