const { menubar } = require('menubar');
const { app, Menu, BrowserWindow } = require('electron')
const conductor = require('./conductor.js')
const path = require('path');
const mb = menubar();

let holoscape = {}

global.logMessages = []

const log = (level, message) => {
  if(level == 'error') console.error(message)
  else console.log(message)
  global.logMessages.push({level, message})
  if(holoscape.logWindow && holoscape.logWindow.webContents) {
    holoscape.logWindow.webContents.send('log', {level,message})
  }
}

const bootConductor = () => {
  if(holoscape.conductorProcess) shutdownConductor()

  let process = conductor.start(log, ()=>{
    //onExit:
    holoscape.conductorProcess = null
    updateTrayMenu()
  })
  app.on('before-quit', () => {
    process.kill('SIGINT');
  })
  holoscape.conductorProcess = process
  updateTrayMenu()
}

const shutdownConductor = () => {
  if(holoscape.conductorProcess) {
    holoscape.conductorProcess.kill('SIGINT')
    holoscape.conductorProcess = null
    updateTrayMenu()
  }
}

const updateTrayMenu = (opt) => {
    const happMenu = Menu.buildFromTemplate([
      { label: 'Chat'  },
      { label: 'DeepKey'},
    ])
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Install hApp' },
      { label: 'hApps', type: 'submenu', submenu: happMenu },
      { type: 'separator' },
      { label: 'HC admin (Settings)' },
      { type: 'separator' },
      { label: 'Shutdown conductor', visible: holoscape.conductorProcess!=null, click: ()=>shutdownConductor() },
      { label: 'Boot conductor', visible: holoscape.conductorProcess==null, click: ()=>bootConductor() },
      { label: 'Quit', click: ()=>{app.quit()} }
    ])
    mb.tray.setToolTip('HoloScape')
    mb.tray.setContextMenu(contextMenu)

}

app.on('window-all-closed', e => e.preventDefault() )

mb.on('ready', () => {
  mb.tray.setImage('images/HoloScape-system-tray.png')

  if(!conductor.hasConfig()) {
    console.log("No conductor config found. Initializing...")
    conductor.initConfig()
  }

  if(!conductor.hasConfig()) {
    console.error("Could not initialize conductor config in", conductor.configPath)
    app.quit()
    return
  }

  bootConductor()
  updateTrayMenu()


  let window = new BrowserWindow({
    width:800,
    height:600,
    webPreferences: {
      nodeIntegration: true
    },
    minimizable: false,
    alwaysOnTop: true,
  })
  window.loadURL(path.join('file://', __dirname, 'views/conductor_log.html'))
  //window.webContents.openDevTools()
  window.on('close', (event) => {
    event.preventDefault();
    window.hide();
  })
  holoscape.logWindow = window
});
