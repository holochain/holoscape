import { ipcRenderer, shell } from 'electron'
import Convert from 'ansi-to-html'
let convert = new Convert({newline: true});
import $ from 'jquery'
import Vue from 'vue'
import Vuetify, {
    VApp, VContainer,
    VRow, VCol, VCard, VCardTitle, VCardSubtitle, 
    VAvatar, VIcon, VBtn,
    VImg, VSpacer, VSimpleTable, VChip,
    VProgressCircular,
    VDialog, VForm, VTextField,
} from 'vuetify/lib'
import { Ripple } from 'vuetify/lib/directives'

Vue.use(Vuetify,  {
    components: {
        VApp, VContainer,
        VRow, VCol, VCard, VCardTitle, VCardSubtitle, 
        VAvatar, VIcon, VBtn, VImg, VSpacer, VSimpleTable,
        VChip, VProgressCircular,
        VDialog, VForm, VTextField,
    },
    directives: {
      Ripple,
    },
      icons: {
        iconfont: 'md',  // 'mdi' || 'mdiSvg' || 'md' || 'fa' || 'fa4'
      },
      theme: {
        dark: true,
      },
      themes: {
        light: {
          primary: "#4682b4",
          secondary: "#b0bec5",
          accent: "#8c9eff",
          error: "#b71c1c",
        },
      },
})


let app = new Vue({
    el: '#app',
    vuetify: new Vuetify({}),
    data: {
        status: "Initializing...",
        logs: require('electron').remote.getGlobal('holoscape').logMessages,
        network_type: "sim2h",
        sim2h_url: 'wss://sim2h.holochain.org:9000',
        disclaimer: false,
        missing_binaries_modal: false,
        passphrase_modal: false,
        network_modal: false,
        passphrase: "",
        show_passphrase: false,
    },
    methods: {
        openExternal(url) {
            shell.openExternal(url)
        },
        network_config_submit(){
            let config = {
                type: this.network_type
            }
            switch(config.type) {
                case "sim1h":
                    config.dynamo_url = $('#dynamo-url').val()
                    break;
                case "sim2h":
                    config.sim2h_url = $('#sim2h-url').val()
                    break;
                case "lib3h":
                    config.network_id = {nickname: $('#lib3h-network-name').val()}
                    const bootstrap = $('#lib3h-bootstrap-url').val()
                    let nodes = []
                    if (bootstrap != "") {
                        nodes = [bootstrap]
                    }
                    config.bootstrap_nodes = nodes
                    break;
            }
            ipcRenderer.send('network-config-set', config)
            this.network_modal = false
        },
        quit() {
            ipcRenderer.send('quit')
        },
        pass_submit() {
            ipcRenderer.send('passphrase-set', this.passphrase)
            this.passphrase_modal = false
        }
    }
})

ipcRenderer.on('log', (event,store) => {
   let {level, message} = store
   message = convert.toHtml(message)
   app.logs.push({level, message})
   while(app.logs.length > 20) {
     app.logs.shift()
   }
});

ipcRenderer.on('splash-status', (event, message) => {
    console.log(message)
    app.status = message
});



//-------------------------------------------------------------------
// Binaries check
ipcRenderer.on('missing-binaries', (event, message) => {
   app.missing_binaries_modal = true
})

//-------------------------------------------------------------------
// Network config management
ipcRenderer.on('request-network-config', (event, message) => {
   app.network_type = 'sim2h'
   $('#sim2h-url').val("wss://sim2h.holochain.org:9000")
   app.network_modal = true
})


$('#set-network-type-button').click(app.network_config_submit)

$('#sim1h-type').click(()=>{app.network_type="sim1h"})
$('#sim2h-type').click(()=>{app.network_type="sim2h"})
$('#lib3h-type').click(()=>{app.network_type="lib3h"})
$('#memory-type').click(()=>{app.network_type="memory"})

//-------------------------------------------------------------------
// Passphrase management
ipcRenderer.on('request-passphrase', (event, message) => {
    app.passphrase_modal = true
})



$('#passphrase').on('keyup', (event) => {
    if (event.keyCode === 13) {
        submit()
    }

    if (event.keyCode === 27) {
        cancel()
    }
})
