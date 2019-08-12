const { app } = require('electron')
const path = require('path');
const fs = require('fs')
const Mustache = require('mustache')
const spawn = require('child_process').spawn

const rootConfigPath = path.join(app.getPath('appData'), 'Holoscape')
const configPath = path.join(rootConfigPath, 'conductor-config.toml')
const passphraseSocketPath = path.join(rootConfigPath, 'conductor_login.socket')
module.exports = {
  configPath,
  passphraseSocketPath,

  rootConfigPath: () => {
    return rootConfigPath
  },

  hasConfig: () => {
    return fs.existsSync(configPath)
  },

  initConfig: () => {
    const initialConfigTemplate = fs.readFileSync('initial_conductor_config.toml', 'utf8')
    const persistenceDir = rootConfigPath
    const n3hPath = path.join(rootConfigPath, 'n3h')
    const adminPort = 33444
    const passphraseSocket = passphraseSocketPath
    const config = Mustache.render(initialConfigTemplate, {adminPort,persistenceDir,n3hPath,passphraseSocket})

    if(!fs.existsSync(rootConfigPath)) {
        fs.mkdirSync(rootConfigPath)
    }
    if(!fs.existsSync(persistenceDir)) {
        fs.mkdirSync(persistenceDir)
    }
    if(!fs.existsSync(n3hPath)) {
        fs.mkdirSync(n3hPath)
    }

    fs.writeFileSync(configPath, config)
  },

  start: (log, onExit) => {
      if(fs.existsSync(passphraseSocketPath)){
        fs.unlinkSync(passphraseSocketPath)
      }

      if (process.platform === "win32") {
        run = spawn(path.join(__dirname, "./holochain.exe"), ["-c", "./conductor-config.toml"], {env:{...process.env, RUST_BACKTRACE: 1}})
      } else if (process.platform === "darwin") {
        run = spawn(path.join(__dirname, "./run-darwin.sh"), [configPath], {env:{...process.env, RUST_BACKTRACE: 1}})
      } else if (process.platform === "linux") {
        run = spawn(path.join(__dirname, "./holochain-linux"), ["-c", configPath], {env:{...process.env, RUST_BACKTRACE: 1}})
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
  }
}
