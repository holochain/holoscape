import { remote, ipcRenderer } from 'electron'
import Vue from 'vue'
import Vuetify, {
    VApp, VNavigationDrawer, VFooter, VContent, 
    VList, VListItem, VListItemContent, VListItemTitle, VListItemSubtitle, VListItemGroup,
    VToolbar, VToolbarTitle,
    VDivider,
    VIcon
} from 'vuetify/lib'
import { Ripple } from 'vuetify/lib/directives'

Vue.use(Vuetify,  {
    components: {
      VApp,
      VNavigationDrawer, 
      VFooter, 
      VContent,
      VList, VListItem, VListItemContent, VListItemTitle, VListItemSubtitle, VListItemGroup,
      VToolbar, VToolbarTitle,
      VDivider,
      VIcon,
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
        showHappStore: () => {
          if(app.activeUI == "happ-store") {
            return 
          }
          app.activeUI = "happ-store"
          happUiController.hideAllHappUis()
          holoscape.showInstallBundleView()
        }
    }
})

ipcRenderer.on('happ-added', (event, params) => {
  let {name, ui} = params
  Vue.set(app.installedUIs, name, ui)
})

window.app = app
window.happUiController = remote.getGlobal('holoscape').happUiController