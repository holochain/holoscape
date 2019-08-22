# hApp Bundle Definition

In order to get to a complete and working Holochain application (hApp) setup, several moving parts have to be put together and configured correctly. A hApp consists at least of one UI and one DNA.

In order to run a DNA, a Holochain conductor needs to be configured to:
1. know about that DNA (i.e. it's hash, where the DNA file is located and how it should be referred to)
2. have an agent configuration that wraps the cryptographic keys and identity of the agent running the DNA
3. combine the two in an *instance* that also defines what storage back-end to use

This just gets us to a running DNA instance, but if we want to use it, we need some kind of user interface and of course a connection between this UI and the DNA.

For that reason, the Holochain conductor implements interfaces which also need to be setup in the conductor config. Each interface config selects which instances are made available through this interface.

If we have this, now we only need to instantiate our UI and point it to the interface.

----

Prior to the introduction of hApp bundles and an end-user facing tool like Holoscape, all of this was had to be done manually.

## Problem: instance IDs

The main problem that lead to the introduction of hApp bundles was this:
UI code has to hard-code the name / ID of the instances it calls zome functions of. As long as the hApp is run by the hApp developer who sets up a conductor config just for the purpose of running this one hApp, this is not problematic.
But without anything that decouples it, this means there is an implict dependency between the UI code and the conductor config of the executing context. The former is controlled by the hApp developer, the latter by the user.

Ultimately, the intention is to make hApps easily usable, so that end-users can install a new hApp without having to understand details
about the Holochain conductor config **and** naming decisions of the hApp developer.

## Enter: hApp Bundles

A Holochain hApp bundle defintion is similar to a piece of conductor config, but operating on a slightly higher level by introducing a few implicit assumptions. One of these assumptions is that every UI will get its own dedicated interface where the instances are named the way the UI expects them to be named, as declared in the bundle.

Any Holochain deployment, like Holoscape, can read these bundle definitions and use them to adjust its conductor config accordingly to provide everything the hApp needs to work. 
The very basic, first step is to install all dependent DNAs mentioned in the bundle and instantiate them.  But this should only happen if we don't have an instance already running the same DNA (we don't want the Identity Manager or the hApp-store to be reinstalled for each app that uses it, or bridges to it - as long as the using hApps all reference the same version/hash of those dependencies, they should call into the same instance).

A working example of a bundle can be found [here](personas-and-chat/chat.toml) 

### Instances

The very basic element of a hApp thus is the definition of an instance.
```toml
[[instances]]
name = "Personas & Profiles"
id = "__personas"
dna_hash = "QmVjrWf3mqULnk4SVwP7k9StFXWz9egpss6qEcCtVMi3FY"
uri = "https://github.com/holochain/personas-profiles/releases/download/0.1.8/personas-profiles.dna.json"
```

The field `name` is what will be used for display to users in the install process, as well as the ID within the conductor config if the bundle install process should setup a new instan because no instance with the same DNA was found.

`id` is an identifier that used only within the bundle to reference this instance in *bridges* or *UI*s.

The hash provided in `dna_hash` will be used to compare the actual file against before installing. Holoscape won't proceed with the installation should the actual file hash and this field differ.

The `uri` should point to a valid DNA file with the correct hash. This can either be link to a remote resource as in this example, or a `file:` protocol URI. If the bundle file is deployed together with its resources, a relative file path can be set like this:
```toml
uri = "file:./personas-profiles.dna.json"
```

### Bridges
A bridge connects a calling instance to a callee that offers zome functions. The calling DNA uses a handle (=local variable name) to refer to a particular bridged callee - similar to how UIs have to hard-code a reference to instances they call.

```toml
[[bridges]]
handle = "p-p-bridge"
caller_id = "__basic-chat"
callee_id = "__personas"
```

In this example, `handle` is a string that is hard-coded in the Basic Chat DNA (i.e. the caller). Both, `caller_id` and `callee_id` are set using bundle internal IDs as described above. When installing the bundle, Holoscape will resolve these bundle internal IDs with either the ID set when adding a new instance, or the correct ID of that already installed instance (with the same DNA).

### UIs

In the context of Holoscape, the assumptions of what a UI is are simply:
* a directory containing a web technology based front-end
* that includes a file `index.html` as the entry point
* and that instantiates `hc-web-client` without parameters to trigger the automatic look-up for a zome-interface connection through a virtual file `_dna_connections.json`.

For deployment through hApp bundles, another assumption gets added:
* UIs are compressed into one zip file

The UI section in a hApp bundle might look like this:

```toml
[[UIs]]
name = "Personas"
uri = "file:./personas-ui.zip"
# Not yet implemented, but might come soon:
# ui-bundle-hash = "Qm34abcde...."

[[UIs.instance_references]]
ui_handle = "personas-profiles"
instance_id = "__personas"
```

The `name` field is again what the user will see during and after installation. Holoscape will add a menu item to its system tray menu with that name, which will open this hApp UI.

The `uri` has to point to a zip file and can, again, be an http link or a (relative or absolute) file path.

Each UI can have a list of `instance_reference`s. An `instance_reference` pulls in a given instance via its bundle-local `instance_id`.  That has to be a string that is used in this bundle to identify an instance. Again, this will be resolved correctly to a potentially already installed instance with an arbitrary ID. The concrete ID doesn't matter to the UI since it uses it own handle, defined through `ui_handle` anyway. This is the string that gets hard-coded within the UI code.

## Deployment

So, a bundle serves as a manifest for a hApp and refers to all its parts by URI.
This means hApps could now be deployed either
* by just sending the hApp bundle toml file alone and have the bundle reference files served somewhere
* or in conjunction with all the DNAs and UIs in one self-contained archive, using relative file paths 