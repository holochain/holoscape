const { menubar } = require('menubar');
const { app, Menu } = require('electron')
const conductor = require('./conductor.js')
const mb = menubar();

mb.on('ready', () => {
  if(!conductor.hasConfig()) {
    console.log("No conductor config found. Initializing...")
    conductor.initConfig()
  }

  if(!conductor.hasConfig()) {
    console.error("Could not initialize conductor config in", conductor.configPath)
    app.quit()
    return
  }

  conductor.start()


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
    { label: 'Quit', click: ()=>{app.quit()} }
  ])
  mb.tray.setToolTip('HoloScape')
  mb.tray.setContextMenu(contextMenu)
  mb.tray.setImage('images/HoloScape-system-tray.png')
});
