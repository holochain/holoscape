import { ipcRenderer, shell, remote } from 'electron'
import toml from 'toml'
import fs from 'fs'
import getUri from 'get-uri'
import temp from 'temp'
import AdmZip from 'adm-zip'
import getPort from 'get-port'
import path from 'path'
import request from 'request'
import Vue from 'vue'
import Vuetify, {
    VApp, VContainer,
    VRow, VCol, VCard, VCardTitle, VCardSubtitle, 
    VAvatar, VIcon, VBtn,
    VImg, VSpacer, VSimpleTable, VChip,
    VProgressCircular,
} from 'vuetify/lib'
import { Ripple } from 'vuetify/lib/directives'

Vue.use(Vuetify,  {
    components: {
        VApp, VContainer,
        VRow, VCol, VCard, VCardTitle, VCardSubtitle, 
        VAvatar, VIcon, VBtn, VImg, VSpacer, VSimpleTable,
        VChip, VProgressCircular,
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



let configured = false
console.log("root")
const holoscape = remote.getGlobal('holoscape')
const happUiController = holoscape.happUiController
let call = remote.getGlobal('conductor_call')

ipcRenderer.on('conductor-call-set', () => {
    console.log("set")
    if(configured) return
    configured = true
    call = remote.getGlobal('conductor_call')
})

    const interpolateProperties = (properties, variables) => {
        console.log(`Interpolating DNA hash with properties: ${JSON.stringify(properties)}`)
        let {agent_id} = variables
        for(let name in properties) {
            properties[name] = properties[name].replace("${AGENT_ID}", agent_id)
        }
        return properties
    }

    const interpolateDnaHash = (instance, variables) => {
        instance.dna_properties = (instance.dna_properties, variables)
        let {hash, error} = holoscape.hash(instance.tempPath, instance.dna_properties)
        Vue.set(instance, 'interpolatedDnaHash', hash)
        return {hash, error}
    }

    var app = new Vue({
        el: '#app',
        vuetify: new Vuetify({}),
        data: {
          tab: 'happ-store',
          installAsAdmin: {},
          storageOpts: ['lmdb', 'file', 'pickle', 'memory'],
          storageImpl: {},
          file: undefined,
          fileError: undefined,
          canInstall: {},
          installed_agents: [],
          installed_instances: [],
          installed_dnas: [],
          installed_bridges: [],
          used_ports: [],
          happ_index: [],
          selected_happ: undefined,
          expanded_happs: {},
          happ_bundles: {},
          installed_bundles: holoscape.installLog,
          is_installed: {},
          currently_installing: undefined,
          install_progress: undefined,
        },
        methods: {
          async isInstalled(happ) {
              let key = JSON.stringify(happ)
              let installed = this.installed_bundles[key]
              if(!installed) return false
              if(!this.happ_bundles[happ.name]) {
                await this.getBundleFromHappIndex(happ)
              }
              if(!this.happ_bundles[happ.name]) return false

              return true
              // TODO: compare the content of the bundles.
              // The below doesn't work because we stick transient installation info into the bundle
              // object which will be included in the persisted version - that is why we can't easily check
              // for equality here.
              // The real fix is to clean up this mess and pull out a component that is handling exactly one 
              // bundle and don't store install info in the bundle but component properties....
              let downloaded = this.happ_bundles[happ.name]
              return JSON.stringify(downloaded.instances) == JSON.stringify(installed.instances) &&
                JSON.stringify(downloaded.bridges) == JSON.stringify(installed.bridges) &&
                JSON.stringify(downloaded.UIs) == JSON.stringify(installed.UIs)
          },
          toggleExpandHapp(happ) {
            if(!this.happ_bundles[happ.name]) {
                this.getBundleFromHappIndex(happ)
            }  
            app.expanded_happs[happ.name] = !app.expanded_happs[happ.name]
            this.$forceUpdate()
          },
          async loadBundle() {
            if(this.$refs.bundleFile.files.length > 0) {
                app.file = this.$refs.bundleFile.files[0]
                const contents = fs.readFileSync(app.file.path)
                app.fileError = undefined
                app.bundle = undefined
                app.success = false
                try{
                    app.bundle = toml.parse(contents)
                    this.processBundle()
                }catch(e){
                    app.fileError = e
                }

            }
          },
          installedInstanceId(instance) {
            console.log("Checking if instance is installed: ", instance)
            let installed_dna = undefined

            if(instance.dna_properties) {
                // If the bundle wants to have specific DNA properties set,
                // we have to interpolate the resulting DNA hash...
                // But since we have variables that can be used for property value interpolation
                // (currently only the agent id, but more stuff like DeepKey root key id in the future)
                // we have to try all combinations of agent ids and dnas to see if we have the specified
                // installed installed already:
                console.log(`Checking combinations with all agents: ${JSON.stringify(this.installed_agents)}`)
                for(let agent of this.installed_agents) {
                    console.log(`Checking combinations with agent: ${agent}`)
                    let dna_hash = instance.dna_hash
                    if(instance.dna_properties) {
                        console.log(`Interpolating hash for instance ${instance.id} with agent ${agent.public_address}`)
                        let {hash, error} = interpolateDnaHash(instance, {agent_id: agent.public_address})
                        if(error) {
                            Vue.set(instance, 'downloadStatus', 'fileError')
                            Vue.set(instance, 'fileError', error)
                        }
                        console.log(`Hash: ${hash}`)
                        dna_hash = hash
                    }
                    installed_dna = this.installed_dnas.find((dna)=>{return dna.hash==dna_hash})
                    if(installed_dna) break
                }
            } else {
                let dna_hash = instance.dna_hash
                installed_dna = this.installed_dnas.find((dna)=>{return dna.hash==dna_hash})
            }

            if(!installed_dna) return
            console.log("Found DNA:", installed_dna)
            let installed_instance = this.installed_instances.find((i)=>{return i.dna==installed_dna.id})
            console.log("Found instance:", installed_instance)
            return installed_instance.id
          },
          async processBundle(bundle) {
            this.installed_agents = await call('admin/agent/list')()
            this.installed_instances = await call('admin/instance/list')()
            this.installed_dnas = await call('admin/dna/list')()
            this.installed_bridges = await call('admin/bridge/list')()

            let instance_promises
            if(!bundle.instances) instance_promises = [Promise.resolve()]
            else instance_promises = bundle.instances.map(async (instance) => {
                console.log("Processing instance:", instance)
                // Here we are checking if we have an instance with the same DNA installed already.
                // If so, we don't install it again but use the already installed instance ID.
                // BUT: this first check only happens with the bundle doesn't set a property, because
                // setting a property would change the hash anyways. In that case we will have to download the
                // DNA first and then calculate the hash with property and check again if we have a DNA with that
                // hash already.
                // That happens further down...
                let installed_instance_id
                if(!instance.dna_properties) {
                    installed_instance_id = this.installedInstanceId(instance)
                }

                if(installed_instance_id) {
                    Vue.set(instance, 'installedInstanceId', installed_instance_id)
                    this.checkInstallReady(bundle)
                } else {
                    instance.tempPath = temp.path()
                    console.log("Temp path for DNA file:", instance.tempPath)
                    Vue.set(instance, 'downloadStatus', 'pending')
                    let fileStream = fs.createWriteStream(instance.tempPath)
                    console.log("Trying to get URI:", instance.uri)
                    let uri = instance.uri
                    if(uri.startsWith("file:./")) {
                        const bundlePath = this.$refs.bundleFile.files[0].path
                        let parts = uri.split('/')
                        parts[0] = `file://${path.dirname(bundlePath)}`
                        uri = parts.join('/')
                    }
                    await new Promise((resolve) => { getUri(uri, (err, rs) => {
                        if(err) {
                            Vue.set(instance, 'error', err.message)
                            Vue.set(instance, 'downloadStatus', 'error')
                            resolve()
                            return
                        }
                        rs.pipe(fileStream)
                        rs.on('end', () => {
                            fileStream.end()
                            let {hash, error} = holoscape.hash(instance.tempPath)
                            console.log(`FOR INSTANCE ${instance.name}, got: hash = ${hash}, error = ${error}`)
                            if(error) {
                                Vue.set(instance, 'downloadStatus', 'fileError')
                                Vue.set(instance, 'fileError', error)
                            } else if(hash != instance.dna_hash) {
                                Vue.set(instance, 'downloadStatus', 'fileError')
                                Vue.set(instance, 'fileError', {message: 'Hash of found file is different:', hash})
                            } else {
                                Vue.set(instance, 'downloadStatus', 'done')
                            }

                            // Ok, here we do the checking for already installed instances in the case of unique properties
                            // as mentioned above:
                            if(instance.dna_properties) {
                                let installed_instance_id = this.installedInstanceId(instance)
                                if(installed_instance_id) {
                                    Vue.set(instance, 'installedInstanceId', installed_instance_id)
                                }
                            }
                            this.checkInstallReady(bundle)
                            resolve()
                        })
                    })})
                }
              })

              bundle.bridges && bundle.bridges.map((bridge) => {
                let caller_id = bundleInstanceIdToRealId(bridge.caller_id, bundle)
                let callee_id = bundleInstanceIdToRealId(bridge.callee_id, bundle)
                let handle = bridge.handle
                console.log("Checking if bridge is already there:", {caller_id, callee_id, handle})
                if(app.installed_bridges.find((b)=>{
                    return b.caller_id == caller_id
                        && b.callee_id == callee_id
                        && b.handle == handle
                })) {
                    console.log("Found bridge")
                    Vue.set(bridge, 'alreadyInstalled', true)
                } else {
                    console.log("Bridge not found")
                }
              })

              let installedUIs = happUiController.getInstalledUIs()

              let ui_promises
              if(!bundle.UIs) ui_promises = [Promise.resolve()]
              else ui_promises = bundle.UIs.map(async (ui) => {
                console.log("Processing UI:", ui)
                if(ui.name in installedUIs) {
                    Vue.set(ui, 'alreadyInstalled', true)
                    this.checkInstallReady(bundle)
                } else {
                    ui.tempPath = temp.path()
                    console.log("Temp path for UI file:", ui.tempPath)
                    Vue.set(ui, 'downloadStatus', 'pending')
                    let fileStream = fs.createWriteStream(ui.tempPath)
                    let uri = ui.uri
                    if(uri.startsWith("file:./")) {
                        const bundlePath = this.$refs.bundleFile.files[0].path
                        let parts = uri.split('/')
                        parts[0] = `file://${path.dirname(bundlePath)}`
                        uri = parts.join('/')
                    }
                    console.log("Trying to get URI:", uri)
                    await new Promise((resolve) => { getUri(uri, (err, rs) => {
                        if(err) {
                            Vue.set(ui, 'error', err.message)
                            Vue.set(ui, 'downloadStatus', 'error')
                            resolve()
                            return
                        }
                        rs.pipe(fileStream)
                        rs.on('end', () => {
                            fileStream.end()
                            Vue.set(ui, 'downloadStatus', 'done')
                            this.checkInstallReady(bundle)
                            resolve()
                        })
                    })})
                }
              })
              this.$forceUpdate()
              let all_promises = instance_promises.concat(ui_promises)
              await Promise.all(all_promises)
          },
          instanceById(instanceId, bundle) {
            if(!bundle) {
                return
            }
            return bundle.instances.find((instance) => instance.id == instanceId)
          },
          checkInstallReady(bundle) {
            console.log('checkInstallReady')
            let all_instances_ok = bundle.instances.reduce((acc, instance) => {
                let instanceReady = instance.downloadStatus == 'done' || instance.installedInstanceId
                return  instanceReady && acc
            }, true)
            let all_uis_ok = bundle.UIs.reduce((acc, ui) => {
                let uiReady = ui.downloadStatus == 'done' || ui.alreadyInstalled
                return uiReady && acc
            }, true)
            console.log('instances ok', all_instances_ok)
            console.log('UIs ok', all_uis_ok)
            app.canInstall[JSON.stringify(bundle)] = all_instances_ok && all_uis_ok
            this.$forceUpdate()
          },
          async install(happ) {
            let name = happ.name  
            app.currently_installing = name
            app.install_progress = 0
            app.$forceUpdate()
            
            if(!app.happ_bundles[name]) {
                await this.getBundleFromHappIndex(happ)
            }
            if(!app.happ_bundles[name]) {
                console.log("Error getting bundle!")
                app.currently_installing = undefined
                app.$forceUpdate()
                return
            }
            let bundle = app.happ_bundles[name]
            console.log("canInstall during intall:", JSON.stringify(app.canInstall))
            if(!app.canInstall[JSON.stringify(bundle)]) {
                console.log("Can't install bundle with errors")
                app.expanded_happs[name] = true
                app.currently_installing = undefined
                app.$forceUpdate()
                return
            }
            app.install_progress = 1
            for(let i in bundle.instances) {
                let instance = bundle.instances[i]
                if(instance.installedInstanceId) continue
                Vue.set(instance, 'installStatus', 'installing')
                await installInstance(instance)
                Vue.set(instance, 'installStatus', 'installed')
                app.install_progress = 50 / bundle.instances.length * (i+1)
                app.$forceUpdate()
            }

            for(let i in bundle.bridges) {
                let bridge = bundle.bridges[i]
                if(bridge.alreadyInstalled) continue
                Vue.set(bridge, 'installStatus', 'installing')
                await addBridge(bridge, bundle)
                Vue.set(bridge, 'installStatus', 'installed')
                app.install_progress = 50 + (10 / bundle.bridges.length * (i+1))
                app.$forceUpdate()
            }

            for(let i in bundle.UIs) {
                let ui = bundle.UIs[i]
                if(ui.alreadyInstalled) continue
                Vue.set(ui, 'installStatus', 'installing')
                let admin = app.installAsAdmin[name] ? true : false
                await installUi(ui, admin, bundle)
                Vue.set(ui, 'installStatus', 'installed')
                app.install_progress = 60 + (40 / bundle.UIs.length * (i+1))
                app.$forceUpdate()
            }

            app.install_progress = 100
            let key = JSON.stringify(happ)
            holoscape.addToInstallLog(key, bundle)
            app.installed_bundles = holoscape.installLog
            Vue.set(app.is_installed, name, true)
            app.$forceUpdate()

            app.currently_installing = undefined
            app.file = undefined
            app.fileError = undefined
          },
          getHappIndex() {
            request('https://raw.githubusercontent.com/holochain/happ-index/master/index.json', { json: true }, async (err, res, body) => {
                if (err) { return console.log(err); }
                app.happ_index = body
                for(let happ of app.happ_index) {
                    app.is_installed[happ.name] = await app.isInstalled(happ)
                }
                app.$forceUpdate()
            });
          },
          async getBundleFromHappIndex(happMeta) {
              app.selected_happ = happMeta
              let {directory} = happMeta
              let bundleUrl = `https://raw.githubusercontent.com/holochain/happ-index/master/happ-resources/${directory}/bundle.toml`
              this.installed_instances = await call('admin/instance/list')()
              this.installed_dnas = await call('admin/dna/list')()
              this.installed_bridges = await call('admin/bridge/list')()
              await new Promise((resolve)=> {
                request(bundleUrl, { json: true }, async (err, res, body) =>  {
                    if (err) { return console.log(err); }
                    console.log("Got from github:", body)
                    let bundle = toml.parse(body)
                    console.log("happ name:", happMeta.name)
                    console.log("bundle:", bundle)
                    app.happ_bundles[happMeta.name] = bundle
                    if(!this.storageImpl[happMeta.name]) {
                        this.storageImpl[happMeta.name] = this.storageOpts[0]
                    }
                    await this.processBundle(app.happ_bundles[happMeta.name])
                    this.$forceUpdate()
                    resolve()
                  })
              })
          },
          deselect() {
              app.bundle = undefined
              app.selected_happ = undefined
          },
          openExternal(url) {
              shell.openExternal(url)
          }
        }
    })

    const installInstance = async (instance) => {
        console.log('Begin installInstance:', instance.name)
        const agent_id = `${instance.name}-agent`
        console.log('Adding agent', agent_id)
        await call('admin/agent/add')({id: agent_id, name: agent_id})
        console.log('Agent added')
        let installed_agents = await call('admin/agent/list')()
        let agent_address = undefined
        for(let agent of installed_agents) {
            if(agent.id == agent_id) {
                agent_address = agent.public_address
            }
        }

        const dna_id = `${instance.name}-dna`
        const path = instance.tempPath
        console.log('Installing DNA', dna_id)
        let properties = undefined
        console.log('PROPERTIES:', instance.dna_properties)
        if(instance.dna_properties) {
            let variables = {agent_id: agent_address}
            properties = interpolateProperties(instance.dna_properties, variables)
            interpolateDnaHash(instance, variables)
        }
        console.log('PROPERTIES interpolated:', instance.dna_properties)
        await call('admin/dna/install_from_file')({id: dna_id, name: instance.name, path, copy: true, properties})
        console.log('DNA installed')

        const id = `${instance.name}`
        console.log('Adding instance', id)
        const storage = app.storageImpl
        let instance_add_args = {id,dna_id,agent_id,storage}
        console.log("Adding instance with ", JSON.stringify(instance_add_args))
        await call('admin/instance/add')(instance_add_args)
        console.log('Instance added')

        console.log('Starting instance ', id)
        await call('admin/instance/start')({id})
        console.log('Instance started')
    }

    const bundleInstanceIdToRealId = (id, bundle) => {
        // If the specified instance was installed before we have to make sure that use that id.
        // Otherwise the ID we've setup when installing a new instance is the name:
        let bundleInstance = bundle.instances.find((instance)=>instance.id==id)
        return bundleInstance.installedInstanceId ? bundleInstance.installedInstanceId : bundleInstance.name
    }

    window.bundleInstanceIdToRealId = bundleInstanceIdToRealId

    const addBridge = async (bridge, bundle) => {
        console.log('Adding bridge:', bridge)
        let {handle, caller_id, callee_id} = bridge
        caller_id = bundleInstanceIdToRealId(caller_id, bundle)
        callee_id = bundleInstanceIdToRealId(callee_id, bundle)
        await call('admin/bridge/add')({handle, caller_id, callee_id})
        console.log('Bridge added')
    }

    const nextMinPort = () => {
        if(app.used_ports.length > 0) {
            app.used_ports.sort()
            return app.used_ports[app.used_ports.length -1] + 1
        } else {
            return 10000
        }
    }

    const installUi = async (ui, admin, bundle) => {
      console.log(JSON.stringify(ui))
        let extractedPath = temp.path()
        console.log(`Extracting ${ui.name} to ${extractedPath}`)
        var zip = new AdmZip(ui.tempPath)
        zip.extractAllTo(extractedPath)
        console.log(`Extraction done. Installing UI...`)
        await happUiController.installUIFromPath(extractedPath, ui.name)
        console.log(`Done`)

        console.log(`Creating interface for ${ui.name}`)
        let id = `${ui.name}-interface`
        let type = 'websocket'
        let port = await getPort({port: getPort.makeRange(nextMinPort(), 31000)})
        app.used_ports.push(port)
        await call('admin/interface/add')({id,admin,type,port})

        for(let ref of ui.instance_references) {
            console.log(`Applying UI -> instance reference: ${JSON.stringify(ref)}`)
            let instance_id = bundleInstanceIdToRealId(ref.instance_id, bundle)
            let interface_id = id
            let alias = ref.ui_handle
            console.log(`Adding instance '${instance_id}' to interface '${interface_id}'`)
            await call('admin/interface/add_instance')({interface_id, instance_id, alias})
        }

        console.log(`Setting UI '${ui.name}' to use interface '${id}'`)
        await happUiController.setUiInterface(ui.name, id)
        console.log(`Completed install of '${ui.name}'`)
    }

    window.app = app
    window.happUiController = happUiController
    app.getHappIndex()
