import { ipcRenderer } from 'electron'
import Vue from 'vue'
import VueChatScroll from 'vue-chat-scroll'
import Vuetify, {VDataTable, VApp, VContainer, VChip, VToolbarTitle, VSpacer, VTextField} from 'vuetify/lib'
import { Ripple } from 'vuetify/lib/directives'
import _ from 'underscore'

Vue.use(VueChatScroll)
Vue.use(Vuetify,  {
    components: {
      VApp,
      VDataTable,
      VContainer,
      VChip,
      VToolbarTitle, 
      VSpacer, 
      VTextField
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

const vuetifyOptions = { theme: {dark:true}}

let configured = false
let single_instance = undefined

ipcRenderer.on('set-single-instance', (event, instance_id) => {
    console.log("single instance:", instance_id)
    single_instance = instance_id
})

ipcRenderer.on('conductor-call-set', () => {
    if(configured) return
    configured = true

    const remote = require('electron').remote
    const happUiController = remote.getGlobal('holoscape').happUiController
    const call = remote.getGlobal('conductor_call')

    const refresh = () => {
      call('debug/running_instances')().then((instances)=>{
          app.instances = []
          instances.map((instance_id) => {
              if(single_instance && instance_id != single_instance) {
                  return
              }
              app.updateStateDump(instance_id)
              app.updateSourceChain(instance_id)
              app.updateHeldAspects(instance_id)
              app.updateValidationQueues(instance_id)
              if(!app.instances.includes(instance_id)) {
                app.instances.push(instance_id)
              }
            })
        })
    }

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
        vuetify: new Vuetify(vuetifyOptions),
        data: {
          instances: [],  
          reduxActions: {},  
          stateDumps: {},
          sourceChains: {},
          holdingMaps: {},
          validationQueues: {},
          contents: {},
          stats: {},
          chainHeaders: [
            {
                text: 'Type',
                align: 'left',
                sortable: false,
                value: 'header.entry_type',
            },
            { text: 'Address', value: 'header.entry_address' },
            { text: '', value: 'data-table-expand' },
            { text: 'Timestamp', value: 'header.timestamp' },
            { text: 'Provenances', value: 'header.provenances' },
          ],
          queueHeaders: [
            {
                text: 'Entry Address',
                align: 'left',
                sortable: false,
                value: 'address',
            },
            { text: '', value: 'data-table-expand' },
            {
                text: 'Workflow Type',
                align: 'left',
                sortable: false,
                value: 'workflow',
            },
            {
                text: 'Delay',
                align: 'left',
                sortable: false,
                value: 'timeout',
            },
            {
                text: 'Dependencies',
                align: 'left',
                sortable: false,
                value: 'dependencies',
            },
          ],
          heldHeaders: [
            {
                text: 'Entry Address',
                align: 'left',
                sortable: false,
                value: 'address',
            },
            {
                text: 'Type',
                align: 'left',
                sortable: false,
                value: 'type',
            },
            {
                text: 'Content',
                align: 'left',
                sortable: false,
                value: 'content',
            },
          ],
          chainSearch: '',
          queueSearch: '',
          heldSearch: '',
          updateStateDump: (instance_id) => {
              //console.log(`Update state dump with: ${instance_id}`)
              call('debug/state_dump')({instance_id, source_chain: false, held_aspects: false, queued_holding_workflows: false})
                .then((dump) => {
                    //console.log("Got state dump: ", dump)
                    Vue.set(app.stateDumps, instance_id, dump)
                })
                .catch((error) => {
                    console.log("Error getting dump:", error)
                })
          },
          updateSourceChain: (instance_id) => {
            //console.log(`Update source chain state dump with: ${instance_id}`)
            call('debug/state_dump')({instance_id, source_chain: true, held_aspects: false, queued_holding_workflows: false})
              .then((dump) => {
                  //console.log("Got state dump: ", dump)
                  Vue.set(app.sourceChains, instance_id, dump.source_chain.map( i => i[0]))
                  //dump.source_chain = undefined
                  //Vue.set(app.stateDumps, instance_id, dump)
              })
              .catch((error) => {
                  console.log("Error getting dump:", error)
              })
          },
          updateHeldAspects: (instance_id) => {
            //console.log(`Update state dump with: ${instance_id}`)
            call('debug/state_dump')({instance_id, source_chain: false, held_aspects: true, queued_holding_workflows: false})
              .then((dump) => {
                  //console.log("Got holding map state dump: ", dump)
                  Vue.set(app.holdingMaps, instance_id, dump.held_aspects)
                  //dump.held_aspects = undefined
                  //Vue.set(app.stateDumps, instance_id, dump)
              })
              .catch((error) => {
                  console.log("Error getting dump:", error)
              })
          },
          updateValidationQueues: (instance_id) => {
            //console.log(`Update state dump with: ${instance_id}`)
            call('debug/state_dump')({instance_id, source_chain: false, held_aspects: false, queued_holding_workflows: true})
              .then((dump) => {
                  //console.log("Got validation queue state dump: ", dump)
                  Vue.set(app.validationQueues, instance_id, dump.queued_holding_workflows)
                  //dump.held_aspects = undefined
                  //Vue.set(app.stateDumps, instance_id, dump)
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
        let { signal, instance_id, instance_stats } = params
        if(instance_stats) {
            if(JSON.stringify(instance_stats) != JSON.stringify(app.stats)) {
                console.log("updating stats")
                app.stats = instance_stats
            }
            return
        }

        if(!signal) {
            console.log("Got strange signal without 'signal' property:", params)
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

        switch(signal.action.action_type) {
            case "Commit":
                _.debounce(app.updateSourceChain(instance_id), 1000, true)
                break
            case "HoldAspect":
                _.debounce(app.updateHeldAspects(instance_id), 1000, true)
                break
            case "QueueHoldingWorkflow":
            case "RemoveQueuedHoldingWorkflow":
                _.debounce(app.updateValidationQueues(instance_id), 1000, true)
                break
            case "Prune":
                break
            default:
                _.debounce(app.updateStateDump(instance_id), 1000, true)
                break
        }

        if(!app.reduxActions[instance_id]) {
            Vue.set(app.reduxActions, instance_id, [])
        }

        if(!signal.action) {
            console.log("Got strange trace signal without 'action' property:", params)
            return
        }

        let actions = app.reduxActions[instance_id]
        actions.push(signal.action)
        while(actions.length > 100) {
            actions.shift()
        }
    })

    refresh()
    window.app = app
    window.call = call
})

ipcRenderer.send('debug-window-initialized')