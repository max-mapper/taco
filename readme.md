# taco

a modular deployment system for unix

![taco.png](taco.png)

### about

taco is a set of compatible command line tools for packaging, building and deploying programs.

eventually this repository will house a higher level CLI tool, `taco`, but for now it is just documentation for the individual taco components

the taco philosophy is:

- use tarballs to package programs
- use separate, well defined tools for transforming or deploying tarballs (do one thing well)
- use unix principles so tools compose nicely (e.g. `taco-pack . | ssh myserver taco-build "npm install"` )
- make it easy for users to customize their deploy pipelines and implement their own tools

### components

each of these is a separate module. you can use them all, or use the ones you like and write your own missing components.

- [`taco-pack`](https://npmjs.org/taco-pack) - creates tarball of a program
- [`taco-build`](https://npmjs.org/taco-build) - takes a tarball, runs a build script inside it, and outputs a tarball
- [`taco-mon`](https://npmjs.org/taco-mon) - deploys your program and runs it with the [mon](https://github.com/tj/mon) process monitor
- [`taco-nginx`](https://npmjs.org/taco-nginx) - updates nginx configuration to route `<package.json name>.*` subdomain traffic to your program, then starts your programs process

if you write a new tool that works well with the taco stack, publish it to npm as `taco-<name>` and send us a pull request adding it to this list. we also encourage you to [open an issue](https://github.com/maxogden/taco/issues) with your idea first to get feedback from the taco community before implementing.

examples of other tools that could be written are `taco-docker`, `taco-upstart`, or `taco-torrent`. 

## example

on client:

make sure your program has a `package.json` with a `name` and a `start` script.

```json
{
  "name": "my-cool-server",
  "scripts": {
    "start": "node server.js"
  }
}
```

then you just pack up your program and pipe the tarball to your server somehow.

here we are using [webcat](http://npmjs.org/webcat) but you can use ssh, rsync, scp, etc:

```
$ taco-pack . | webcat maxogden
```

on server:

```
$ webcat maxogden | taco-build "npm install --production" | taco-mon deploy .
```

here is the full output of deploying [hello-world-server](https://github.com/maxogden/hello-world-server) locally:

```
~/taco 🐈  taco-pack ~/src/js/hello-world-server > server.tar
~/taco 🐈  taco-build "npm install --production" < server.tar > server-built.tar
hat@0.0.3 node_modules/hat
~/taco 🐈  ls -alh *.tar
-rw-r--r--  1 maxogden  staff    21K Apr 20 10:37 server-built.tar
-rw-r--r--  1 maxogden  staff   4.5K Apr 20 10:37 server.tar
~/taco 🐈  taco-mon deploy . < server-built.tar
Finished deploying
~/taco 🐈  taco-mon status
hello-world-server: alive, started just now
~/taco 🐈  tree -L 3
.
├── deploys
│   └── hello-world-server -> ../versions/hello-world-server-1429551456725
├── server-built.tar
├── server.tar
└── versions
    └── hello-world-server-1429551456725
        ├── index.js
        ├── node_modules
        ├── package.json
        ├── readme.md
        ├── taco.log
        ├── taco.mon.pid
        └── taco.pid

5 directories, 8 files
```

## folder structure

taco deployment modules, such as `taco-mon`, should use the following folder structure:

```
versions/
  myapp-1429547612075/
    myapp.pid         # \
    myapp.stderr.log  #  - pids and logs created by taco-mon
    myapp.stdout.log  # /
    package.json # from tarball, must exist for process to be deployable
    # ... and the rest of the process files from the tarball are here too
deployed/
  myapp/ -> ../builds/myapp-1429547612075/ # symlink
```
