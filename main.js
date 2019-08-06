const { menubar } = require('menubar');
const { app, Menu } = require('electron')
const mb = menubar();

mb.on('ready', () => {
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
