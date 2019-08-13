const { menubar } = require('menubar')
const { app, ipcMain, protocol } = require('electron')
const conductor = require('./conductor.js')

const { Holoscape } = require('./holoscape')
const { loadUIinfo, sanitizeUINameForScheme } = require('./happ-ui-controller')

const mb = menubar();
global.mb = mb


protocol.registerSchemesAsPrivileged(
  Object.keys(loadUIinfo()).map( (uiName) => {
    const scheme = `happ-${sanitizeUINameForScheme(uiName)}`
    console.log('Privileging scheme:', scheme)
    return { scheme, privileges: { standard: true, supportFetchAPI: true, secure: true } }
  })
)

setInterval(()=>{
  try {
    global.holoscape.checkConductorConnection()
    global.holoscape.checkConductorPassphraseSocket()
  } catch(e) {
    console.log('Error during connection check:', e)
  }

}, 3000)

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