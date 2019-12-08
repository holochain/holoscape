import { ipcRenderer } from 'electron'
//import Vue from 'vue'
//import path from 'path'
//const vuetifyPluginPath = path.join(__dirname, 'plugins', 'vuetify')
//import vuetify from '../plugins/vuetify'
import Vue from 'vue'
import VueChatScroll from 'vue-chat-scroll'
import Vuetify, {VDataTable, VApp, VContainer} from 'vuetify/lib'
import { Ripple } from 'vuetify/lib/directives'

Vue.use(VueChatScroll)
Vue.use(Vuetify,  {
    components: {
      VApp,
      VDataTable,
      VContainer
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
/*
const App = {
    template: '#app-template',
    data: () => ({
      //
    })
  }
  */

 const vuetifyOptions = { theme: {dark:true}}

let configured = false

ipcRenderer.on('conductor-call-set', () => {
    if(configured) return
    configured = true

    const remote = require('electron').remote
    const happUiController = remote.getGlobal('holoscape').happUiController
    const call = remote.getGlobal('conductor_call')

    const refresh = () => {
      call('debug/running_instances')().then((instances)=>{
          instances.map((instance_id) => {
              app.updateStateDump(instance_id)
              Vue.set(app.updateActions, instance_id, false)
              Vue.set(app.refreshDump, instance_id, false)
              app.instances.push(instance_id)
            })
        })
    }

    setInterval(() => {
        for(let instance of app.instances) {
            if(app.refreshDump[instance]) {
                app.updateStateDump(instance)
            }
        }
    }, 1500)

    const fetch_cas = async (address, instance_id) => {
        return await call('debug/fetch_cas')({instance_id, address})
    }

    const updateContent = async (address, instance_id) => {
        Vue.set(app.contents, address, await fetch_cas(address, instance_id))
    }

    const syntaxHighlight = (json) => {
        if (typeof json != 'string') {
            json = JSON.stringify(json, undefined, 2);
        }
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            var cls = 'number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'key';
                } else {
                    cls = 'string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'boolean';
            } else if (/null/.test(match)) {
                cls = 'null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
        });
    }

    var app = new Vue({
        vuetify: new Vuetify(vuetifyOptions)/*{
          icons: {
            iconfont: 'md',  // 'mdi' || 'mdiSvg' || 'md' || 'fa' || 'fa4'
          },
          theme: {
            dark: false,
          },
          themes: {
            light: {
              primary: "#4682b4",
              secondary: "#b0bec5",
              accent: "#8c9eff",
              error: "#b71c1c",
            },
          }
        })*/,
        //render: h => h(App),
        data: {
          instances: [],  
          reduxActions: {},  
          stateDumps: {},
          refreshDump: {},
          contents: {},
          updateActions: {},
          stats: {},
          chainHeaders: [
            {
                text: 'Type',
                align: 'left',
                sortable: false,
                value: 'entry_type',
            },
            { text: 'Address', value: 'entry_address' },
            { text: 'Timestamp', value: 'timestamp' },
            { text: 'Provenances', value: 'provenances' },
          ],
          chainSearch: '',
          updateStateDump: (instance_id) => {
              console.log(`Update state dump with: ${instance_id}`)
              call('debug/state_dump')({instance_id})
                .then((dump) => {
                    console.log("Got state dump: ", dump)
                    Vue.set(app.stateDumps, instance_id, dump)
                })
                .catch((error) => {
                    console.log("Error getting dump:", error)
                })
          },
          refresh: refresh,
          fetch_cas,
          updateContent,
          syntaxHighlight,
          actionTypeToBadge: (actionType) => {
              switch(actionType) {
                  case "SignalZomeFunctionCall": return "info"
                  case "ReturnZomeFunctionResult": return "info"
                  case "ReturnValidationPackage": return "secondary"
                  case "ReturnValidationResult": return "secondary"
                  case "Commit": return "success"
                  case "Publish": return "success"
                  case "HoldAspect": return "danger"
                  case "Query": return "light"
                  case "RespondQuery": return "dark"
                  case "HandleQuery": return "light"
                  case "QueryTimeout": return "warning"
                  default: return "primary"
              }
          },
          sanitizeName: (name) => {
            name = name
                .split('_').join('-')
                .split(' ').join('-')
                .split('&').join('-')
                .split('#').join('-')
                .split('.').join('-')
                .split('$').join('-')
                .toLowerCase()
            return name
          },
          showAction: (action) => {
              window.alert(JSON.stringify(action))
          }
        }
    }).$mount('#app')

    ipcRenderer.on('hc-signal', (event, params) => {
        let { signal, instance_id } = params
        if(!signal) {
            console.log("Got strange signal without 'signal' property:", params)
            return
        }
        if(signal.signal_type == "Stats") {
            
            app.stats = signal.instance_stats
            return
        }

        if(!instance_id) {
            console.log("Got strange signal without 'instance_id' property:", params)
            return
        }

        if(signal.signal_type != "Trace") {
            // Ignoring non-trace signals
            return
        }
        if(!app.reduxActions[instance_id]) {
            Vue.set(app.reduxActions, instance_id, [])
        }
        if(!app.updateActions[instance_id]) {
            return
        }
        if(!signal.action) {
            console.log("Got strange trace signal without 'action' property:", params)
            return
        }

        let actions = app.reduxActions[instance_id]
        actions.push(signal.action)
        while(actions.lenght > 100) {
            actions.shift()
        }
    })

    refresh()
    window.app = app
    window.call = call
})