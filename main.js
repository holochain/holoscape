const { menubar } = require('menubar')
const { app, Menu, BrowserWindow, ipcMain, dialog, protocol, session } = require('electron')
const conductor = require('./conductor.js')
const fs = require('fs')
const path = require('path')
const { connect } = require('@holochain/hc-web-client')
const net = require('net')
const { ncp } = require('ncp')


const mb = menubar();
const UIinfoFile = path.join(conductor.rootConfigPath(), 'UIs.json')

const loadUIinfo = () => {
  if(!fs.existsSync(UIinfoFile)) {
    return {}
  } else {
    return JSON.parse(fs.readFileSync(UIinfoFile))
  }
}

const sanitizeUINameForScheme = (name) => {
  return name.split('_').join('-')
}

protocol.registerSchemesAsPrivileged(
  Object.keys(loadUIinfo()).map( (uiName) => {
    const scheme = `happ-${sanitizeUINameForScheme(uiName)}`
    console.log('Privileging scheme:', scheme)
    return { scheme, privileges: { standard: true, supportFetchAPI: true, secure: true } }
  })
)

class Holoscape {
  conductorProcess;
  conductorPassphraseClient;
  logWindow;
  logMessages = [];
  quitting = false;
  configWindow;
  splash;
  installedUIs = {};
  runningUIs = {};

  async init() {
    this.installedUIs = loadUIinfo()
    this.createLogWindow()
    this.createConfigWindow()
    this.createUiConfigWindow()
    await this.showSplashScreen()
    this.splash.webContents.send('splash-status', "Booting conductor...")
    this.bootConductor()
  }



  saveUIinfo() {
    fs.writeFileSync(UIinfoFile, JSON.stringify(this.installedUIs))
  }

  installUI() {
    let sourcePath = dialog.showOpenDialogSync({
      title: 'Holoscape',
      message: 'Install a web UI directory as hApp',
      properties: ['openDirectory'],
    })

    if(!sourcePath) return
    sourcePath = sourcePath[0]

    let name = path.basename(sourcePath)
    let UIsDir = path.join(conductor.rootConfigPath(), 'UIs')
    let installDir = path.join(UIsDir, name)

    if(fs.existsSync(installDir)) {
      dialog.showErrorBox('Holoscape', 'UI with name '+name+' already installed!')
      return
    }

    if(!fs.existsSync(UIsDir)) {
      fs.mkdirSync(UIsDir)
    }

    const that = this

    new Promise((resolve, reject) => {
      ncp(sourcePath, installDir, (err) => {
        //if(err) reject(err)
        //else 
        resolve()
      })
    })
    .then(() => {
      that.installedUIs[name] = {installDir}
      that.saveUIinfo()
      that.updateTrayMenu()
    })
    .catch((err) => {
      dialog.showErrorBox('Holoscape', JSON.stringify(err))
    })
  }

  getInstalledUIs() {
    return this.installedUIs
  }

  async setUiInterface(uiName, interfaceId) {
    this.installedUIs[uiName].interface = interfaceId
    this.saveUIinfo()
    let interfaces = await global.conductor_call('admin/interface/list')()
    let interfaceConfig = interfaces.find((i) => i.id == interfaceId)
    const dnaInterfaceConfig = {dna_interface: interfaceConfig}
    const filePath = path.join(conductor.rootConfigPath(), 'UIs', `${uiName}-interface.json`)
    fs.writeFileSync(filePath, JSON.stringify(dnaInterfaceConfig))
    const window = this.runningUIs[uiName]
    if(window) {
      window.reload()
    }
  }

  async createUI(name) {
    console.log('Creating UI for', name)
    if(!this.installedUIs[name]){
      console.error('Tried to open unknown UI', name)
      return
    }

    if(this.runningUIs[name]) {
      console.log('Already have UI for', name, '. Showing...')
      this.runningUIs[name].show()
      return
    }

    const partition = `persist:${name}`
    const ses = session.fromPartition(partition)
    const scheme = `happ-${sanitizeUINameForScheme(name)}`
    console.log('Registering protocol scheme', scheme)
    const uiRootDir = this.installedUIs[name].installDir

    const protocolCallback = (request, callback) => {
      console.log(`Inside [${name}], got request for file ${request.url}`)
      const url = request.url.substr(scheme.length+1)
      let absoluteFilePath
      const base = scheme+'://index.html'
      if(request.url.startsWith(base) && request.url.length > base.length+1){
        const url = request.url.substr(base.length)
        if(url.startsWith(__dirname)) {
          absoluteFilePath = url
        } else {
          absoluteFilePath = path.join(uiRootDir, path.normalize(url))
        }
        
      } else {
        absoluteFilePath = path.join(uiRootDir, 'index.html')
      }

      console.log('Redirecting to:', absoluteFilePath)
      callback({ path: absoluteFilePath })
    }

    
    let protocolError = await new Promise((resolve, reject) => {
      protocol.registerFileProtocol(scheme, protocolCallback, (error) => {
        if (error) reject('Failed to register protocol '+error)
        else resolve()
      })
    })
    if(protocolError) {
      console.error('Could not register custom hApp protocol globally: ', protocolError)
      return
    }

    protocolError = await new Promise((resolve, reject) => {
      ses.protocol.registerFileProtocol(scheme, protocolCallback, (error) => {
        if (error) reject('Failed to register protocol '+error)
        else resolve()
      })
    })
    if(protocolError) {
      console.error('Could not register custom hApp protocol in session: ', protocolError)
      return
    }

    let window = new BrowserWindow({
      width:890,
      height:535,
      webPreferences: {
        nodeIntegration: true,
        title: name,
        partition
      },
    })

    const windowURL = `${scheme}://index.html`
    console.log('Created window. Loading', windowURL)

    window.loadURL(windowURL)
    window.webContents.openDevTools()
    let holoscape = this
    window.on('close', (event) => {
      if(!holoscape.quitting) event.preventDefault();
      window.hide();
      holoscape.updateTrayMenu()
    })

    this.runningUIs[name] = window
  }

  showHideUI(name) {
    let window = this.runningUIs[name]
    if(!window) {
      this.createUI(name).then(() => {
        window = this.runningUIs[name]
        window.show()
      })
      return
    }

    if(window.isVisible()) {
      window.hide()
    } else {
      window.show()
    }
    this.updateTrayMenu()
  }

  showSplashScreen() {
    let window = new BrowserWindow({
      width:890,
      height:535,
      webPreferences: {
        nodeIntegration: true
      },
      minimizable: false,
      alwaysOnTop: true,
      frame: false,
      transparent: true,
    })
    window.loadURL(path.join('file://', __dirname, 'views/splash.html'))
    //window.webContents.openDevTools()
    this.splash = window

    return new Promise((resolve) => {
      window.webContents.on('did-finish-load', ()=>{
          resolve()
      })
    })
  }

  checkConductorConnection() {
    if(this.conductorProcess && !global.conductor_call) {
      this.connectConductor()
    }
  }

  checkConductorPassphraseSocket() {
    if(this.conductorProcess && !this.conductorPassphraseClient) {
      this.connectPassphraseSocket()
    }
  }

  connectPassphraseSocket() {
    if(!fs.existsSync(conductor.passphraseSocketPath)) {
      console.log('Passphrase socket not found (yet)')
      return
    }

    let client
    try{
      client = net.createConnection(conductor.passphraseSocketPath)
    } catch(e) {
      console.log('Error trying to connect to passphrase socket:', e)
    }


    const that = this
    client.on("connect", () => {
      that.conductorPassphraseClient = client
    })

    client.on("data", async (data) => {
      let splashWasVisible = that.splash.isVisible()
      if(!splashWasVisible) {
        that.splash.show()
      }

      that.splash.webContents.send('request-passphrase', "Booting conductor...")
      that.splash.webContents.send('splash-status', "Prompting for passphrase...")
      let passphrase = await new Promise((resolve)=>{
        ipcMain.on('passphrase-set', (event, message)=>{
          resolve(message)
        })
      })

      client.write(""+passphrase+"\n")

      that.splash.webContents.send('splash-status', "Unlocking keystore...")
      if(!splashWasVisible) {
        that.splash.hide()
      }
    });
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

  createUiConfigWindow() {
    let window = new BrowserWindow({
      width:1200,
      height:800,
      webPreferences: {
        nodeIntegration: true
      },
      show: false,
    })
    window.loadURL(path.join('file://', __dirname, 'views/ui_config.html'))
    //window.webContents.openDevTools()

    let holoscape = this
    window.on('close', (event) => {
      if(!holoscape.quitting) event.preventDefault();
      window.hide();
      holoscape.updateTrayMenu()
    })

    this.uiConfigWindow = window
  }

  updateTrayMenu(opt) {
    let menuTemplate = []
    
    for(let uiName in this.installedUIs) {
      let visible = false
      if(this.runningUIs[uiName] && this.runningUIs[uiName].isVisible()) {
        visible = true
      }

      menuTemplate.push({
        label: uiName,
        click: ()=>this.showHideUI(uiName),
        type: 'checkbox', 
        checked: visible
      })
    }
    
    const happMenu = Menu.buildFromTemplate(menuTemplate)
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Install UI', click: ()=>this.installUI() },
      { label: 'UIs', type: 'submenu', submenu: happMenu },
      { label: 'Edit UI config', type: 'checkbox', checked: this.uiConfigWindow.isVisible(), enabled: global.conductor_call != null, click: ()=>this.showHideUiConfig() },
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
      mb.tray.setImage('images/Holochain50+alpha.png')
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
      this.conductorPassphraseClient = null
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

  showHideUiConfig() {
    if(this.uiConfigWindow.isVisible()) {
      this.uiConfigWindow.hide()
    } else {
      this.uiConfigWindow.show()
    }
  }

  connectConductor() {
    connect({url:"ws://localhost:33444"}).then(({call, callZome, close}) => {
      global.conductor_call = call
      mb.tray.setImage('images/HoloScape-system-tray.png')
      this.updateTrayMenu()
      this.splash.hide()
      this.configWindow.webContents.send('conductor-call-set')
      this.uiConfigWindow.webContents.send('conductor-call-set')
    }).catch((error)=> {
      console.error('Holoscape could not connect to conductor', error)
      global.holoscape.checkConductorConnection()
    })
  }
}

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