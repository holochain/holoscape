const { spawnSync } = require('child_process')
const path = require('path')
const { remote } = require('electron')

const rootConfigPath = remote.getGlobal('rootConfigPath')

function executablePath() {
    let executable;
    if (process.platform === "win32") {
        executable = "./hc.exe"
    } else if (process.platform === "darwin") {
        executable = "./hc-darwin"
    } else if (process.platform === "linux") {
        executable = "./hc-linux"
    } else {
        log('error', "unsupported platform: "+process.platform)
        return
    }

    return path.join(__dirname, executable)
}

module.exports = {
    hash: (filePath, properties) => {
        console.log("CLI: hashing file", filePath)
        let params = ["hash", "--path", filePath]
        if(properties) {
            for(let name in properties) {
                params.push("--property")
                params.push(`${name}=${properties[name]}`)
            }
        }
        let { stdout, stderr, error } = spawnSync(
            executablePath(), 
            params,
            {cwd: rootConfigPath}
        )
        stderr = stderr.toString()
        stdout = stdout.toString()
        console.log("CLI: got results:")
        console.log("stdout:", stdout)
        console.log("stderr:", stderr)

        if(error) {
            console.log('Error executing hc:', error)
            return {error}
        }
        
        if(stderr.length > 0) {
            error = stderr
            console.log('Error executing hc:', error)
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