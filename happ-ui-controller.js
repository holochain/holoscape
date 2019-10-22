const { BrowserWindow, dialog, protocol, session, ipcMain } = require('electron')
const { ncp } = require('ncp')
const fs = require('fs')
const path = require('path')
const conductor = require('./conductor.js')

const HAPP_SCHEME = 'holoscape-happ'

function UIinfoFile(){
    return path.join(conductor.rootConfigPath(), 'UIs.json')
}

function loadUIinfo() {
    if(!fs.existsSync(UIinfoFile())) {
        return {}
    } else {
        return JSON.parse(fs.readFileSync(UIinfoFile()))
    }
}

function sanitizeUINameForScheme(name) {
    name = name.split('_').join('-')
    name = name.split(' ').join('-')
    name = name.toLowerCase()
    return name
}

function setupWindowDevProduction(window) {
    if(process.env.DEV) {
      window.webContents.openDevTools()
    } else {
      window.setMenu(null)
      window.removeMenu()
    }
  }


const happProtocolCallback = (request, callback) => {
    console.log(`HAPP SCHEME: got request for file ${request.url}`)
    const url = request.url.substr(HAPP_SCHEME.length+1)
    console.log('URL:', url)
    const urlPath = path.normalize(url)
    console.log('urlPath:', urlPath)
    const happDir = urlPath.split('/')[1]
    console.log('happDir:', happDir)
    const uiRootDir = path.join(conductor.rootConfigPath(), 'UIs', happDir)
    let absoluteFilePath
    const base = `${HAPP_SCHEME}://${happDir}`
    if(request.url.startsWith(base) && request.url.length > base.length+1){
        const url = request.url.substr(base.length)
        if(url.startsWith(__dirname)) {
            absoluteFilePath = url
        } else {
            if(url.endsWith('_dna_connections.json')) {
                absoluteFilePath = path.join(conductor.rootConfigPath(), 'UIs', `${happDir}-interface.json`)
            } else {
                let filePath = path.normalize(url)
                filePath = filePath.split("#")[0]
                filePath = filePath.split("?")[0]
                if(filePath == "/") {
                    filePath = "/index.html"
                }
                absoluteFilePath = path.join(uiRootDir, filePath)
            }
        }

    } else {
        absoluteFilePath = path.join(uiRootDir, 'index.html')
    }

    console.log('Redirecting to:', absoluteFilePath)
    callback({ path: absoluteFilePath })
}

/// This controller is managing all the custom hApp UIs that can be installed.
/// It stores a list of all installed UIs with their installation directory and
/// potentially set zome interface in `installedUIs`, which gets persisted
/// to UIInfoFile().
///
/// It looks like this:
/// ```js
/// installedUIs = {
///   'basic-chat': {
///      installDir: '/home/lucksus/.config/Holoscape/UIs/basic-chat',
///      interface: 'basic-chat-interface'
///   }
/// }
/// ```
///
/// When a hApp UI is shown for the first time, `showHideUi(name)` calls  `createUI(name)`
/// which creates a separate BrowserWindow for that UI. All existing BrowserWindows are
/// stored in `runningUIs`.
///
/// In order to make a web UI that was build to be hosted by an HTTP server work inside
/// these browser windows served from file-system, we are registering a custom URI scheme per UI
/// in the format of 'happ-<name>' where any URL 'happ-<name>://<resource>` will be redirected
/// to the `installDir` of that hApp UI.
class HappUiController {
    installedUIs = {};
    runningUIs = {};
    holoscape;

    constructor(hs) {
        this.holoscape = hs
        this.installedUIs = loadUIinfo()
        ipcMain.on('request-activate-happ-window', (event, args) => {
            let name = args.uiToActivate
            if(this.installedUIs[name]) {
                console.log(`${args.requester} requested to show another UI: ${name}`)
                this.showAndRiseUI(args.uiToActivate, args.location)
            } else {
                console.log(`${args.requester} requested to show non-existant UI: ${name}`)
            }
        })

        console.log('Registering file protocol:', HAPP_SCHEME)
        protocol.registerFileProtocol(HAPP_SCHEME, happProtocolCallback, (error) => {
            if(error) throw error
        })
    }

    createUiMenuTemplate() {
        let menuTemplate = []

        for(let uiName in this.installedUIs) {
            let visible = false
            // if(this.runningUIs[uiName] && this.runningUIs[uiName].isVisible()) {
            //     visible = true
            // }

            menuTemplate.push({
                label: uiName,
                click: ()=>this.showHideUI(uiName),
                type: 'checkbox',
                checked: visible
            })
        }

        return menuTemplate
    }

    saveUIinfo() {
        fs.writeFileSync(UIinfoFile(), JSON.stringify(this.installedUIs))
    }

    installUI() {
        let sourcePath = dialog.showOpenDialogSync({
            title: 'Holoscape',
            message: 'Install a web UI directory as hApp',
            properties: ['openDirectory'],
        })

        if(!sourcePath) return
        sourcePath = sourcePath[0]
        this.installUIFromPath(sourcePath, path.basename(sourcePath))
    }

    installUIFromPath(sourcePath, name) {
        let UIsDir = path.join(conductor.rootConfigPath(), 'UIs')
        let installDir = path.join(UIsDir, sanitizeUINameForScheme(name))

        if(fs.existsSync(installDir)) {
            dialog.showErrorBox('Holoscape', 'UI with name '+name+' already installed!')
            return
        }

        if(!fs.existsSync(UIsDir)) {
            fs.mkdirSync(UIsDir)
        }

        const that = this

        return new Promise((resolve, reject) => {
            ncp(sourcePath, installDir, (err) => {
                //if(err) reject(err)
                //else
                resolve()
            })
        })
        .then(() => {
            that.installedUIs[name] = {installDir}
            that.saveUIinfo()
            that.holoscape.updateTrayMenu()
        })
        .catch((err) => {
            dialog.showErrorBox('Holoscape', JSON.stringify(err))
        })
    }

    getInstalledUIs() {
        return this.installedUIs
    }

    async setUiInterface(uiName, interfaceId) {
        console.log('Setting ui interface:',uiName, interfaceId)
        this.installedUIs[uiName].interface = interfaceId
        this.saveUIinfo()
        let interfaces = await global.conductor_call('admin/interface/list')()
        let interfaceConfig = interfaces.find((i) => i.id == interfaceId)
        const dnaInterfaceConfig = {dna_interface: interfaceConfig}
        const sanitizedUiName = sanitizeUINameForScheme(uiName)
        const filePath = path.join(conductor.rootConfigPath(), 'UIs', `${sanitizedUiName}-interface.json`)
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
        const uiRootDir = this.installedUIs[name].installDir
        const uiSubDir = path.basename(uiRootDir)

        const protocolError = await new Promise((resolve, reject) => {
            ses.protocol.registerFileProtocol(HAPP_SCHEME, happProtocolCallback, (error) => {
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
                partition,
                preload: path.join(__dirname, 'happ-ui-preload.js')
            },
        })
        window.uiName = name

        const windowURL = `${HAPP_SCHEME}://${uiSubDir}/`
        console.log('Created window. Loading', windowURL)

        window.loadURL(windowURL)
        setupWindowDevProduction(window)
        let holoscape = this.holoscape
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

        // if(window.isVisible()) {
        //     window.hide()
        // } else {
        //     window.show()
        // }
        window.show()
        this.holoscape.updateTrayMenu()
    }

    async ensureWindowFor(name) {
        if(!this.runningUIs[name]) {
            await this.createUI(name)
        }
        return this.runningUIs[name]
    }


    async showAndRiseUI(name, location) {
        this.ensureWindowFor(name).then((window)=>{
            window.show()
            window.focus()
            if(location){
                window.location.assign(location)
            }
        })
    }
}

module.exports = {
    HappUiController,
    UIinfoFile,
    loadUIinfo,
    sanitizeUINameForScheme,
    HAPP_SCHEME,
    setupWindowDevProduction,
}
