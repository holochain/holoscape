const { app } = require('electron')
const path = require('path');
const fs = require('fs')
const Mustache = require('mustache')
const spawn = require('child_process').spawn

const persona = process.env.HOLOSCAPE_PERSONA ? process.env.HOLOSCAPE_PERSONA : "default"

const rootConfigPath = path.join(app.getPath('appData'), 'Holoscape-'+persona)
const configPath = path.join(rootConfigPath, 'conductor-config.toml')
const passphraseSocketPath = path.join(rootConfigPath, 'conductor_login.socket')
const DNA_PORT = process.env.HOLOSCAPE_DNA_PORT ? process.env.HOLOSCAPE_DNA_PORT : 10000
const ADMIN_PORT = process.env.HOLOSCAPE_ADMIN_PORT ? process.env.HOLOSCAPE_ADMIN_PORT : 4435
module.exports = {
  configPath,
  passphraseSocketPath,

  persona: () => {
      return persona
  },


  rootConfigPath: () => {
    return rootConfigPath
  },

  hasConfig: () => {
    return fs.existsSync(configPath)
  },

  adminPort: () => {
    return ADMIN_PORT
  },

  dnaPort: () => {
    return DNA_PORT
  },

  initConfig: (networkConfigToml) => {
    const initialConfigTemplate = fs.readFileSync(path.join(__dirname, 'initial_conductor_config.toml'), 'utf8')
    const persistenceDir = rootConfigPath
    const adminPort = ADMIN_PORT
    const passphraseSocket = passphraseSocketPath
    const config = Mustache.render(initialConfigTemplate, {adminPort,persistenceDir,networkConfigToml,rootConfigPath,passphraseSocket})

    if(!fs.existsSync(rootConfigPath)) {
        fs.mkdirSync(rootConfigPath)
    }
    if(!fs.existsSync(persistenceDir)) {
        fs.mkdirSync(persistenceDir)
    }

    fs.writeFileSync(configPath, config)
  },

  start: (log, onExit) => {
      if(fs.existsSync(passphraseSocketPath)){
        fs.unlinkSync(passphraseSocketPath)
      }

      if (process.platform === "win32") {
        // TODO: dont hardcode conductor-config
        run = spawn(process.env.comspec, ["/c", "wsl", "holochain-linux", "-c", "/mnt/c/github/conductor-config.toml"], {env:{...process.env, RUST_BACKTRACE: 1}})
      } else if (process.platform === "darwin") {
        run = spawn(path.join(__dirname, "./holochain-darwin"), ["-c", configPath], {env:{...process.env, RUST_BACKTRACE: 'full'}})
      } else if (process.platform === "linux") {
        if (process.env.HOLOSCAPE_FLAME_GRAPH==="yes")
        {
          run = spawn("perf", ["record","--call-graph","dwarf",path.join(__dirname, "./holochain-linux"),"-c", configPath], {env:{...process.env, RUST_BACKTRACE: 'full'}})
        }
        else
        {
          run = spawn(path.join(__dirname, "./holochain-linux"), ["-c", configPath], {env:{...process.env, RUST_BACKTRACE: 'full'}})
        }

      }
      else {
        log('error', "unsupported platform: "+process.platform)
        return
      }
      run.stdout.on('data', data => {
        log('info', data.toString())
        if (data.toString().indexOf("Listening on http://127.0.0.1:3000") > -1) {
          mainWindow.loadFile('ui/index.html')
        }
      })
      run.stderr.on('data', data => log('error', data.toString()))
      run.on('exit', (code, signal) => {
        if (signal) {
          log('info', `holochain process terminated due to receipt of signal ${signal}`)
        } else {
          log('info', `holochain process terminated with exit code ${code}`)
        }
        onExit()
      })
      return run
  },

  hasBinaries: () => {
    let holochain, hc

    if (process.platform === "win32") {
      // holochain = "./holochain.exe"
      // hc = "./hc.exe"
      // TODO: check binaries on windows
      return true;
    } else if (process.platform === "darwin") {
      holochain = "./holochain-darwin"
      hc = "./hc-darwin"
    } else if (process.platform === "linux") {
      holochain = "./holochain-linux"
      hc = "./hc-linux"
    }

    return fs.existsSync(path.join(__dirname, holochain)) && fs.existsSync(path.join(__dirname, hc))
  }
}
