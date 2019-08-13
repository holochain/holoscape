const { app, Menu, BrowserWindow, ipcMain } = require('electron')
const fs = require('fs')
const path = require('path')
const { connect } = require('@holochain/hc-web-client')
const net = require('net')
const conductor = require('./conductor.js')
const { HappUiController, sanitizeUINameForScheme } = require('./happ-ui-controller')

class Holoscape {
    conductorProcess;
    conductorPassphraseClient;
    logWindow;
    logMessages = [];
    quitting = false;
    configWindow;
    splash;
    happUiController;
  
    async init() {
      this.happUiController = new HappUiController()
      this.createLogWindow()
      this.createConfigWindow()
      this.createUiConfigWindow()
      await this.showSplashScreen()
      this.splash.webContents.send('splash-status', "Booting conductor...")
      this.bootConductor()
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
      window.webContents.openDevTools()
  
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
      window.webContents.openDevTools()
  
      let holoscape = this
      window.on('close', (event) => {
        if(!holoscape.quitting) event.preventDefault();
        window.hide();
        holoscape.updateTrayMenu()
      })
  
      this.uiConfigWindow = window
    }
  
    updateTrayMenu(opt) {
      const happMenu = Menu.buildFromTemplate(this.happUiController.createUiMenuTemplate())
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

module.exports = {
    Holoscape,
    sanitizeUINameForScheme,
}
  
