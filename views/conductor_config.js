var ipcRenderer = require('electron').ipcRenderer;
const { connect } = require('@holochain/hc-web-client')
const $ = require('jquery')

let configured = false
require('electron').ipcRenderer.on('conductor-call-set', () => {
  if(configured) return

  const call = require('electron').remote.getGlobal('conductor_call')

  var app = new Vue({
    el: '#app',
    data: {
      dnas: [],
      instances: [],
      interfaces: [],
      agents: [],
      bridges: [],
      error: undefined,
      loading: false,
      addInstanceToInterfaceClick: (event) => {
        console.log('add instance!')
        $("#interface-add-instance-modal").modal('show')
        const interfaceId = $(event.target).data('id')
        $('#interface-instance-add-title').text(`Adding an instance to interface ${interfaceId}`)
        $('#interface-instance-data').data('interface-id', interfaceId)
      }
    }
  })

  const refresh = () => {
    call('admin/dna/list')().then((dnas)=>app.dnas = dnas)
    call('admin/instance/list')().then((instances)=>app.instances = instances)
    call('admin/interface/list')().then((interfaces)=>app.interfaces = interfaces)
    call('admin/agent/list')().then((agents)=>app.agents = agents)
    call('adming/bridges/list')().then((bridges)=>app.bridges = bridges)
  }

  refresh()

  $('.error').click(()=>{app.error=undefined})

  $('#add-agent-button').click(()=>{
    const id = $('#agent-id').val()
    const name = $('#agent-name').val()
    app.loading = true
    call('admin/agent/add')({id,name}).then(()=> {
      refresh()
      app.loading = false
      $('.modal').modal('hide')
    }).catch((error)=>{
      app.error = error
      app.loading = false
    })
  })

  $('#install-dna-button').click(()=>{
    const id = $('#dna-id').val()
    const path = document.getElementById("dna-file").files[0].path//$('#dna-file').val()

    const copy = true
    app.loading = true
    call('admin/dna/install_from_file')({id,path,copy})
      .then(() => {
        app.loading = false
        refresh()
        $('.modal').modal('hide')
      })
      .catch((error)=>{
        app.error = error
        app.loading = false
      })
  })

  $('#add-instance-button').click(()=>{
    const id = $('#instance-id').val()
    const dna_id = $('#instance-dna-id').val()
    const agent_id = $('#instance-agent-id').val()
    app.loading = true
    call('admin/instance/add')({id,dna_id,agent_id}).then(()=> {
      app.loading = false
      refresh()
      $('.modal').modal('hide')
    }).catch((error)=>{
      app.error = error
      app.loading = false
    })
  })

  $('#add-interface-button').click(()=>{
    const id = $('#interface-id').val()
    const admin = $('#interface-admin').is(':checked')
    const type = $('#interface-type').val()
    const port = parseInt($('#interface-port').val())
    app.loading = true
    call('admin/interface/add')({id,admin,type,port}).then(()=> {
      app.loading = false
      refresh()
      $('.modal').modal('hide')
    }).catch((error)=>{
      app.error = error
      app.loading = false
    })
  })

  $('#add-interface-instance-button').click(()=>{
    const interface_id = $('#interface-instance-data').data('interface-id')
    const instance_id = $('#interface-instance-id').val()
    app.loading = true
    call('admin/interface/add_instance')({interface_id, instance_id}).then(()=> {
      app.loading = false
      refresh()
      $('.modal').modal('hide')
    }).catch((error)=>{
      app.error = error
      app.loading = false
    })
  })

  $('#add-bridge-button').click(()=>{
    const handle = $('#bridge-handle').val()
    const caller_id = $('#bridge-caller-id').val()
    const callee_id = $('#bridge-callee-id').val()
    app.loading = true
    call('admin/bridge/add')({handle, caller_id, callee_id}).then(()=> {
      app.loading = false
      refresh()
      $('.modal').modal('hide')
    }).catch((error)=>{
      app.error = error
      app.loading = false
    })
  })
  
  configured = true
})

