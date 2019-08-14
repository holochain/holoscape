const { ipcRenderer, remote } = require('electron')

window.activateHappWindow = (otherHappUiName, location) => {
    const uiName = remote.getCurrentWindow().uiName
    console.log("uiName:", uiName)
    ipcRenderer.send('request-activate-happ-window', {
        requester: uiName,
        uiToActivate: otherHappUiName,
        location,
    })
}