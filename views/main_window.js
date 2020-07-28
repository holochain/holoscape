import { remote, ipcRenderer } from 'electron'
import Vue from 'vue'
import Vuetify, {
    VApp, VNavigationDrawer, VFooter, VContent, 
    VList, VListItem, VListItemContent, VListItemTitle, VListItemSubtitle, VListItemGroup,
    VToolbar, VToolbarTitle,
    VDivider, VTooltip,
    VIcon, VSpacer, VProgressCircular, VChip,
} from 'vuetify/lib'
import { Ripple } from 'vuetify/lib/directives'
import Mousetrap from 'mousetrap'

Vue.use(Vuetify,  {
    components: {
      VApp,
      VNavigationDrawer, 
      VFooter, 
      VContent,
      VList, VListItem, VListItemContent, VListItemTitle, VListItemSubtitle, VListItemGroup,
      VToolbar, VToolbarTitle,
      VDivider,
      VIcon, VSpacer, VProgressCircular,
      VChip, VTooltip,
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


const holoscape = remote.getGlobal('holoscape')
const happUiController = holoscape.happUiController

let app = new Vue({
    el: "#app",
    vuetify: new Vuetify({}),
    data: {
        installedUIs: happUiController.installedUIs,
        activeUI: null,
        instance_stats: {},
    },
    methods: {
        showHappUi: (uiName) => {
            if(app.activeUI == uiName) {
              return
            }
            app.activeUI = uiName
            holoscape.hideViews()
            happUiController.showHappUi(uiName)
        },
      showHappInstall: () => {
        holoscape.showInstallFromFileWindow()
      },
        showHappStore: () => {
          if(app.activeUI == "happ-store") {
            return 
          }
          app.activeUI = "happ-store"
          happUiController.hideAllHappUis()
          holoscape.showInstallBundleView()
        },
        showDebugView: (instance_id) => {
          ipcRenderer.send('show-debug-view', instance_id)
        },
        showHappUiDebugTools: () => {
          let uiName = Object.keys(app.installedUIs)[app.activeUI-1]
          ipcRenderer.send('show-developer-tools', uiName)
        }
    }
})

ipcRenderer.on('happ-added', (event, params) => {
  let {name, ui} = params
  Vue.set(app.installedUIs, name, ui)
})

ipcRenderer.on('ui-activated', (event, params) => {
  let {name} = params
  app.activeUI = Object.keys(app.installedUIs).indexOf(name) + 1
  app.$forceUpdate()
})

ipcRenderer.on('instance-stats', (event, instance_stats) => {
  app.instance_stats = instance_stats
  app.$forceUpdate()
})

window.app = app
window.happUiController = remote.getGlobal('holoscape').happUiController

ipcRenderer.send('main-window-initialized')

Mousetrap.bind('ctrl+shift+i', () => {
  app.showHappUiDebugTools()
})