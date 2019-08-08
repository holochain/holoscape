var ipcRenderer = require('electron').ipcRenderer;
const { connect } = require('@holochain/hc-web-client')
const $ = require('jquery')

connect({url:"ws://localhost:33444"}).then(({call, callZome, close}) => {

    var app = new Vue({
      el: '#app',
      data: {
        dnas: [],
        instances: [],
        interfaces: [],
        agents: [],
        error: undefined,
      }
    })

    const refresh = () => {
      call('admin/dna/list')().then((dnas)=>app.dnas = dnas)
      call('admin/instance/list')().then((instances)=>app.instances = instances)
      call('admin/interface/list')().then((interfaces)=>app.interfaces = interfaces)
      call('admin/agent/list')().then((agents)=>app.agents = agents)
    }

    refresh()

    $('.error').click(()=>{app.error=undefined})

    $('#add-agent-button').click(()=>{
      const id = $('#agent-id').val()
      const name = $('#agent-name').val()
      call('admin/agent/add')({id,name}).then(()=> {
        refresh()
      })
    })

    $('#install-dna-button').click(()=>{
      const id = $('#dna-id').val()
      const path = document.getElementById("dna-file").files[0].path//$('#dna-file').val()

      const copy = true
      call('admin/dna/install_from_file')({id,path,copy})
        .then(() => {
          refresh()
        })
        .catch((error) => {
          app.error = error
        })
    })

    $('#add-instance-button').click(()=>{
      const id = $('#instance-id').val()
      const dna_id = $('#instance-dna-id').val()
      const agent_id = $('#instance-agent-id').val()
      call('admin/instance/add')({id,dna_id,agent_id}).then(()=> {
        refresh()
      }).catch((error) => {
        app.error = error
      })
    })

    $('#add-interface-button').click(()=>{
      const id = $('#interface-id').val()
      const admin = $('#interface-admin').is(':checked')
      const type = $('#interface-type').val()
      const port = parseInt($('#interface-port').val())
      call('admin/interface/add')({id,admin,type,port}).then(()=> {
        refresh()
      }).catch((error) => {
        app.error = error
      })
    })
})
