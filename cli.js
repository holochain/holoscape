const { spawnSync } = require('child_process')
const path = require('path')
//const { remote } = require('electron')

const rootConfigPath = global.rootConfigPath

function executablePath() {
    let executable;
    if (process.platform === "win32") {
        return process.env.comspec;
    } 
    if (process.platform === "darwin") {
        executable = "./hc-darwin"
    } else if (process.platform === "linux") {
        executable = "./hc-linux"
    } else {
        log('error', "unsupported platform: "+process.platform)
        return
    }

    return path.join(__dirname, executable)
}

function win32Path(filePath) {
    let fp = filePath.replace(/\\/g, "\\\\");
    let wslparams = ["/c", "wsl", "wslpath", "-a", fp]
    let { stdout, stderr, error } = spawnSync(
      process.env.comspec,
      wslparams,
      {cwd: __dirname}
    )
    stderr = stderr? stderr.toString() : "";
    stdout = stdout? stdout.toString() : "";
    console.log("CLI wslpath: got results:")
    console.log("stdout:", stdout)
    console.log("stderr:", stderr)
    fp = stdout.substring(0, stdout.length - 1); // remove 'return' char
    return fp
}

module.exports = {
    win32Path: (filePath) => {
        return win32Path(filePath)
    },
    hash: (filePath, properties) => {
        console.log("CLI: hashing file", filePath)
        if (process.platform === "win32") {
            filePath = win32Path(filePath)
        }
        let params = ["hash", "--path", filePath]
        if (process.platform === "win32") {
            params.unshift("/c", "wsl", "hc-linux")
        }
        if(properties) {
            for(let name in properties) {
                params.push("--property")
                params.push(`${name}=${properties[name]}`)
            }
        }
        let { stdout, stderr, error } = spawnSync(
          executablePath(),
            params,
            {cwd: __dirname}
        )
        stderr = stderr? stderr.toString() : "";
        stdout = stdout? stdout.toString() : "";
        console.log("CLI: got results:")
        console.log("stdout:", stdout)
        console.log("stderr:", stderr)



        if(error) {
            console.log('Error executing hc:', error)
            return {error}
        }

        if(stderr.length > 0) {
            error = stderr
            console.log('Error executing hc (stderr):', error)
            return {error}
        }

        console.log(`hc stdout: ${JSON.stringify(stdout)}`)
        let lines = stdout.split('\n')
        let hash
        for(line of lines) {
            if(line.startsWith('DNA Hash: ')) {
                hash = line.split("Hash: ")[1]
            }
            if(line.startsWith('Error:')) {
                error = line
            }
        }
        return { hash, error }
    }
}
