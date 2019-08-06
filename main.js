const { menubar } = require('menubar');
const { app, Menu } = require('electron')
const conductor = require('./conductor.js')
const mb = menubar();

let holoscape = {}

const bootConductor = () => {
  if(holoscape.conductorProcess) shutdownConductor()

  let process = conductor.start(()=>{
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


});
