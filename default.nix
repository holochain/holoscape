# This is an example of what downstream consumers of holonix should do
# This is also used to dogfood as many commands as possible for holonix
# For example the release process for holonix uses this file
let

 # point this to your local config.nix file for this project
 # example.config.nix shows and documents a lot of the options
 config = import ./config.nix;

 # START HOLONIX IMPORT BOILERPLATE
 holonix = import (
  if ! config.holonix.use-github
  then config.holonix.local.path
  else fetchTarball {
   url = "https://github.com/${config.holonix.github.owner}/${config.holonix.github.repo}/tarball/${config.holonix.github.ref}";
   sha256 = config.holonix.github.sha256;
  }
 ) { config = config; };
 # END HOLONIX IMPORT BOILERPLATE

 # hopefully this won't be needed someday when holonix updates
 newer-pkgs = import (fetchTarball {
  url = "https://github.com/NixOS/nixpkgs/archive/19.09.tar.gz";
  sha256 = "0mhqhq21y5vrr1f30qd2bvydv4bbbslvyzclhw0kdxmkgg3z4c92";
 }) { };

 target-os = if holonix.pkgs.stdenv.isDarwin then "darwin" else "linux";

in
with holonix.pkgs;
{
 dev-shell = stdenv.mkDerivation (holonix.shell // {
  name = "dev-shell";

  shellHook = holonix.pkgs.lib.concatStrings [''
  ln -sf `command -v holochain` holochain-${target-os}
  ln -sf `command -v hc` hc-${target-os}
  npm install
  export PATH="$PATH:$( npm bin )"
  ''
  holonix.shell.shellHook
  ];

  DEV="true";

  buildInputs = [
   holonix.pkgs.unzip
   newer-pkgs.electron_6

   (holonix.pkgs.writeShellScriptBin "holoscape" ''
   electron .
   '')

   (holonix.pkgs.writeShellScriptBin "holoscape-flush" ''
   rm -rf $HOME/.config/holoscape
   rm -rf $HOME/.config/Holoscape-default
   rm -rf ./Holoscape-linux-x64
   rm -rf ./Holoscape-darwin-x64
   rm -rf ./node_modules
   rm -rf ./package-lock.json
   '')
  ]
   ++ holonix.shell.buildInputs
  ;
 });
}
