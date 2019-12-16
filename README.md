# Holoscape

[![Project](https://img.shields.io/badge/project-holochain-blue.svg?style=flat-square)](http://holochain.org/)
[![Chat](https://img.shields.io/badge/chat-chat%2eholochain%2enet-blue.svg?style=flat-square)](https://chat.holochain.org)

[![Twitter Follow](https://img.shields.io/twitter/follow/holochain.svg?style=social&label=Follow)](https://twitter.com/holochain)

A complete end-user deployment of a Holochain conductor with UI for administration and a run-time for hApp UIs.

![](images/Splash_screenshot-0.0.5.png)
![](images/MainWindow_screenshot-0.0.5.png)

## Why?

Holoscape makes using hApps a piece of cake.

As a hApp user:
* You install Holoscape which comes with all the Holochain binaries and sets up and maintains your Holochain conductor config (so you don't neede to know what that even means)
* It runs in the background with a system tray icon to access all configuration dialogs
* You install hApps through [hApp Bundles](example-bundles) with just a few clicks
* You open hApp UIs through the system tray menu
* DNA instances keep running in the conductor even when you close a hApp UI

As a hApp developer:
* Getting your hApp deployed has become **a lot easier**
* You have your user install Holoscape
* You put all your DNAs and UIs into a [hApp bundle](example-bundles)
* You share the hApp bundle with your users

But there is more...
During development of your hApp and DNAiew_screenshot.png)
(*so it doubles as a holoscope...*)

## Setup for development

```
$ git clone https://github.com/holochain/holoscape.git
$ cd holoscape
# Run all commands for this project while cd'd in this directory
```

Holoscape needs both binaries ouf the [holochain-rust](https://github.com/holochain/holochain-rust) repository: `hc` and `holochain`.

Depending on the OS, it expects to find either `hc-linux` and `holochain-linux` or `hc-darwin` and `holochain-darwin` in the application directory (the root of the repository during development).

For development you can either build those yourself or get them through nix-shell like this:

``` shell
$ nix-shell https://github.com/holochain/holoscape/archive/develop.tar.gz --run holoscape
```

To flush all holoscape data with the nix shell:

```shell
$ nix-shell https://github.com/holochain/holoscape/archive/develop.tar.gz --run holoscape-flush

## Run for development
```
npm start
```

### Personas
Persona's allow you to run multiple instances of Holoscape.  This is useful for a few reasons:
- Networks: Because each Holoscape instance is configured to communicate over one network, you can use this run instances on different networks.
- Testing: this makes it easy to spin up multiple nodes on the same network for testing purposes.

You can select personas setting the `HOLOSCAPE_PERSONA` environment variable at startup.  Note that the **first** time you launch Holoscape with a new persona you **must** also use the `HOLOSCAPE_ADMIN_PORT` environment to specify a unique port for the instance of Holoscape to communicate with it's conductor, like this:

``` shell
HOLOSCAPE_PERSONA=my_persona HOLOSCAPE_ADMIN_PORT=4436
```
Note that this value is set in the conductor config file which on linux systems you will find at `~/.config/Holoscape-<persona>/conductor-config.toml`.

## Releasing
A stand-alone Electron package can be built with
```
npm run build-linux
```
or
```
npm run build-mac
```

The build script expects above mentioned binaries (`holochain-<platform>` and `hc-<platform>`) to be present in the root directory and puts them into the final package with everything else.
In order to have Linux builds be portable across all Linux distributions, releases need to have a static build of those binaries. There is a branch in [holochain-rust/static-holoscape-build](https://github.com/holochain/holochain-rust/tree/static-holoscape-build) that gets tracked and automatically build and statically linked. Binaries can be downloaded here: https://hydra.holo.host/jobset/holochain-rust/static-holoscape-build.

## Contribute
Holochain is an open source project.  We welcome all sorts of participation and are actively working on increasing surface area to accept it.  Please see our [contributing guidelines](/CONTRIBUTING.md) for our general practices and protocols on participating in the community, as well as specific expectations around things like code formatting, testing practices, continuous integration, etc.

## License
[![License: GPL v3](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](http://www.gnu.org/licenses/gpl-3.0)

Copyright (C) 2019, Holochain Foundation

This program is free software: you can redistribute it and/or modify it under the terms of the license p
rovided in the LICENSE file (GPLv3).  This program is distributed in the hope that it will be useful, bu
t WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
 PURPOSE.

**Note:** We are considering other 'looser' licensing options (like MIT license) but at this stage are using GPL while we're getting the matter sorted out.  See [this article](https://medium.com/holochain/licensing-needs-for-truly-p2p-software-a3e0fa42be6c) for some of our thinking on licensing for distributed application frameworks.
