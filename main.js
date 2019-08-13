const { menubar } = require('menubar')
const { app, ipcMain, protocol } = require('electron')
const conductor = require('./conductor.js')

const { Holoscape } = require('./holoscape')
const { loadUIinfo, sanitizeUINameForScheme } = require('./happ-ui-controller')

const mb = menubar();
global.mb = mb


/// We want hApp UIs to be able to use localStorage/sessionStorage.
/// Chromium doesn't allow that for every source.
/// Since we are using custom URI schemes to redirect UIs' resources to
/// their respective directory under .config/Holoscape/UIs, we have
/// to register those hApp specific URI schemes here to be privileged.
///
/// There is one drawback to this approach:
/// We can only register schemes as priviliged before the 'ready' event.
/// That means we have to register all hApp UIs' schemes here on start-up.
/// When installing a new UI, it won't be able to use localStorage before
/// Holoscape restarts.
/// TODO: find a better way that does not have this drawback.
protocol.registerSchemesAsPrivileged(
  Object.keys(loadUIinfo()).map( (uiName) => {
    const scheme = `happ-${sanitizeUINameForScheme(uiName)}`
    console.log('Privileging scheme:', scheme)
    return { scheme, privileges: { standard: true, supportFetchAPI: true, secure: true } }
  })
)

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

mb.on('ready', () => {
  mb.tray.setImage('images/Holochain50+alpha.png')

  if(!conductor.hasConfig()) {
    console.log("No conductor config found. Initializing...")
    conductor.initConfig()
  }

  if(!conductor.hasConfig()) {
    console.error("Could not initialize conductor config in", conductor.configPath)
    app.quit()
    return
  }

  global.logMessages = []
  global.holoscape = new Holoscape()
  global.holoscape.init()
});

ipcMain.on('quit', () => {
  process.exit()
})