const { app } = require('electron')
const path = require('path');
const fs = require('fs')
const Mustache = require('mustache')
const spawn = require('child_process').spawn

const log = (level, message) => {
  if(level == 'error') console.error(message)
  else console.log(message)
}

const rootConfigPath = path.join(app.getPath('appData'), 'Holoscape')
const configPath = path.join(rootConfigPath, 'conductor_config.toml')
module.exports = {
  configPath,

  hasConfig: () => {
    return fs.existsSync(configPath)
  },

  initConfig: () => {
    const initialConfigTemplate = fs.readFileSync('initial_conductor_config.toml', 'utf8')
    const persistenceDir = path.join(rootConfigPath, 'persistence')
    const n3hPath = path.join(rootConfigPath, 'n3h')
    const adminPort = 33445
    const config = Mustache.render(initialConfigTemplate, {adminPort,persistenceDir,n3hPath})

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

  start: () => {
      if (process.platform === "win32") {
        run = spawn(path.join(__dirname, "./holochain.exe"), ["-c", "./conductor-config.toml"])
      } else if (process.platform === "darwin") {
        run = spawn(path.join(__dirname, "./run-darwin.sh"), [configPath])
      } else if (process.platform === "linux") {
        run = spawn(path.join(__dirname, "./run-conductor-linux.sh"), [configPath])
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
        quit = true
        app.quit()
      })
  }
}
