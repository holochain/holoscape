const { menubar } = require('menubar')
const { app, ipcMain, protocol } = require('electron')
const conductor = require('./conductor.js')
const path = require('path')
const { Holoscape, systemTrayIconEmpty } = require('./holoscape')
const { loadUIinfo, sanitizeUINameForScheme, HAPP_SCHEME } = require('./happ-ui-controller')

const mb = menubar();
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

mb.on('ready', async () => {
  mb.tray.setImage(systemTrayIconEmpty())
  global.holoscape = new Holoscape()
  await global.holoscape.showSplashScreen()

  if(!conductor.hasConfig()) {
      console.log("No conductor config found. Initializing...")
      global.holoscape.splash.webContents.send('request-network-config')
      const config = await new Promise( (resolve, reject) => {
          ipcMain.on('network-config-set', (event, config) => {
              resolve(config)
          })
      } )
      let networkConfigToml = "";
      if (config.type == "sim1h") {
          const url = config.dynamo_url == "" ? "http://localhost:8000" : config.dynamo_url
          networkConfigToml = `
type="sim1h"
dynamo_url = '${url}'
`
      }
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
