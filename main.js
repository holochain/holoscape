const { menubar } = require('menubar');
const { app, Menu, BrowserWindow } = require('electron')
const conductor = require('./conductor.js')
const path = require('path');
const { connect } = require('@holochain/hc-web-client')
const mb = menubar();

let holoscape = {}
class Holoscape {
  conductorProcess;
  logWindow;
  logMessages = [];
  quitting = false;
  configWindow;

  init() {
    this.createLogWindow()
    this.createConfigWindow()
    this.bootConductor()
  }

  checkConductorConnection() {
    if(this.conductorProcess && !global.conductor_call) {
      this.connectConductor()
    }
  }

  }

  createLogWindow() {
    let window = new BrowserWindow({
      width:800,
      height:600,
      webPreferences: {
        nodeIntegration: true
      },
      minimizable: false,
      alwaysOnTop: true,
      show: false,
    })
    window.loadURL(path.join('file://', __dirname, 'views/conductor_log.html'))
    //window.webContents.openDevTools()

    let holoscape = this
    window.on('close', (event) => {
      if(!holoscape.quitting) event.preventDefault();
      window.hide();
      holoscape.updateTrayMenu()
    })

    this.logWindow = window
  }

  createConfigWindow() {
    let window = new BrowserWindow({
      width:1200,
      height:800,
      webPreferences: {
        nodeIntegration: true
      },
      minimizable: false,
      alwaysOnTop: true,
      show: false,
    })
    window.loadURL(path.join('file://', __dirname, 'views/conductor_config.html'))
    //window.webContents.openDevTools()

    let holoscape = this
    window.on('close', (event) => {
      if(!holoscape.quitting) event.preventDefault();
      window.hide();
      holoscape.updateTrayMenu()
    })

    this.configWindow = window
  }

  updateTrayMenu(opt) {
    const happMenu = Menu.buildFromTemplate([
      { label: 'Chat'  },
      { label: 'DeepKey'},
    ])
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Install hApp' },
      { label: 'hApps', type: 'submenu', submenu: happMenu },
      { type: 'separator' },
      { label: 'Show log window', type: 'checkbox', checked: this.logWindow.isVisible(), click: ()=>this.showHideLogs() },
      { label: 'Edit conductor config', type: 'checkbox', checked: this.configWindow.isVisible(), enabled: global.conductor_call != null, click: ()=>this.showHideConfig() },
      { type: 'separator' },
      { label: 'Shutdown conductor', visible: this.conductorProcess!=null, click: ()=>this.shutdownConductor() },
      { label: 'Boot conductor', visible: this.conductorProcess==null, click: ()=>this.bootConductor() },
      { label: 'Quit', click: ()=>{this.shutdownConductor(); this.quitting=true; mb.app.quit()} }
    ])
    mb.tray.setToolTip('HoloScape')
    mb.tray.setContextMenu(contextMenu)
  }

  bootConductor() {
    if(this.conductorProcess) this.shutdownConductor()

    const log = (level, message) => {
      if(global.holoscape.quitting) return
      if(level == 'error') console.error(message)
      else console.log(message)
      global.holoscape.logMessages.push({level, message})
      if(global.holoscape.logWindow && global.holoscape.logWindow.webContents) {
        global.holoscape.logWindow.webContents.send('log', {level,message})
      }
    }

    const onExit = () => {
      this.conductorProcess = null
      this.updateTrayMenu()
    }

    let process = conductor.start(log, onExit)

    app.on('before-quit', () => {
      process.kill('SIGINT');
    })
    this.conductorProcess = process
    this.connectConductor()
  }

  shutdownConductor() {
    if(this.conductorProcess) {
      this.conductorProcess.kill('SIGINT')
      this.conductorProcess = null
      global.conductor_call = null
      this.updateTrayMenu()
      mb.tray.setImage('images/Holochain50+alpha.png')
    }
  }

  showHideLogs() {
    if(this.logWindow.isVisible()) {
      this.logWindow.hide()
    } else {
      this.logWindow.show()
    }
  }

  showHideConfig() {
    if(this.configWindow.isVisible()) {
      this.configWindow.hide()
    } else {
      this.configWindow.show()
    }
  }

  connectConductor() {
    connect({url:"ws://localhost:3000"}).then(({call, callZome, close}) => {
      global.conductor_call = call
      mb.tray.setImage('images/HoloScape-system-tray.png')
      this.updateTrayMenu()
    }).catch((error)=> {
      dialog.showErrorBox('Holoscape could not connect to conductor', error)
      global.holoscape.checkConductorConnection()
    })
  }
}

setInterval(()=>{
  console.log('interval')
  try {
    global.holoscape.checkConductorConnection()
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
