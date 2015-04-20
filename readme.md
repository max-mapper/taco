# taco

a modular deployment system for unix

![taco.png](taco.png)

### about

taco is a set of compatible command line tools for packaging, building and deploying programs.

eventually this repository will house a higher level CLI tool, `taco`, but for now it is just documentation for the individual taco components

the taco philosophy is:

- use tarballs to package programs
- use separate, well defined tools for transforming or deploying tarballs (do one thing well)
- use unix principles so tools compose nicely (e.g. `taco pack . | taco-build "npm install"` )
- make it easy for users to customize their deploy pipelines and implement their own tools

### components

each of these is a separate module. you can use them all, or use the ones you like and write your own missing components. if you write a new tool that works well with the taco stack, publish it to npm as `taco-<name>` and send us a pull request adding it to this list.

- [`taco-pack`](https://npmjs.org/taco-pack) - creates tarball of an application
- [`taco-build`](https://npmjs.org/taco-build) - takes a tarball, runs a build script inside it, and outputs a tarball
- [`taco-mon`](https://npmjs.org/taco-mon) - deploys your program and runs it with the mon process monitor
- [`taco-nginx`](https://npmjs.org/taco-nginx) - updates nginx configuration to route `<package.json name>.*` subdomain traffic to your app, then starts your app process

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

then you just pack up your app and pipe the tarball to your server somehow:

```
$ taco-pack . | webcat maxogden
```

on server:

```
$ webcat maxogden | taco-build "npm install --production" | taco-mon deploy .
```

## folder structure

taco deployment modules, such as `taco-mon`, should use the following folder structure:

```
builds/
  myapp-1429547612075/
    myapp.pid         # \
    myapp.stderr.log  #  - pids and logs created by taco-mon
    myapp.stdout.log  # /
    package.json # from tarball, must exist for process to be deployable
    # ... and the rest of the process files from the tarball are here too
deployed/
  myapp/ -> ../builds/myapp-1429547612075/ # symlink
```
