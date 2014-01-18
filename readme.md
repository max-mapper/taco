# taco

a taco themed PaaS for node.js servers. warning: still alpha-quality

![taco.png](taco.png)

[![NPM](https://nodei.co/npm/taco.png)](https://nodei.co/npm/taco/)

## features

the main goal of taco is to fully automate and configure everything so that from the time
when you create your server you never have to manually `ssh` in and configure things from
the server shell.

- git based deploy (`git push taco master` to deploy)
- easy use with compute providers. installs onto a fresh ubuntu server
- keep apps running. process monitoring + logging with [mon](https://github.com/visionmedia/mon) and [mongroup](https://github.com/visionmedia/node-mongroup)
- nginx powered virtual hosts (subdomain routing to multiple apps)
- runs `npm install` and `npm start` on your app to build + deploy it

### wishlist

feel free to open an issue for these and declare that you want to work on them, then send a PR :)

- docker support
- web admin ui
- automated domain registration + dns configuration
- support other compute providers via http://npmjs.org/pkgcloud integration
- cli client for things like `taco logs`, `taco restart appname` etc
- automatic server provisioning using e.g. the digital ocean API

## quickstart

taco is designed to install onto a brand new ubuntu 13.04 64bit install

here's the easiest way to try it out from scratch:

- get a digital ocean account, add your ssh key
- create a new ubuntu 13.04 droplet, make sure it includes your ssh key
- buy some domain name and set up two A records pointing at the droplets IP:

```
*.yourdomain.com -> IP
yourdomain.com -> IP
```

- install and run these on your local machine:

```
npm install taco install-node-on-ubuntu install-nginx-on-ubuntu -g
install-nginx-on-ubuntu root@yourdomain.com
install-node-on-ubuntu root@yourdomain.com
install-taco-on-ubuntu root@yourdomain.com yourdomain.com
```

- deploy your first app.

- apps must have `npm install` and `npm start` as the only two setup steps
- they must also listen on `process.env.PORT`

here is an example app: https://github.com/maxogden/hello-world-server.git

to deploy the example:

```
git clone https://github.com/maxogden/hello-world-server.git
cd hello-world-server
git remote add mydomain http://mydomain.com:8080/hello.git
```

right now taco listens for git pushes on :8080

the end of the remote url should be `app-subdomain.git`, so in this case the app
will deploy to `hello.mydomain.com`

now you just need to push:

```
git push origin mydomain
Counting objects: 38, done.
Delta compression using up to 4 threads.
Compressing objects: 100% (26/26), done.
Writing objects: 100% (38/38), 3.45 KiB | 0 bytes/s, done.
Total 38 (delta 4), reused 0 (delta 0)
remote: received hello.git
remote: running npm install...
remote: npm http GET https://registry.npmjs.org/hat/0.0.3
remote: npm http 304 https://registry.npmjs.org/hat/0.0.3
remote: hat@0.0.3 node_modules/hat
remote: deployed app at hello.yourdomain.com
To http://mydomain.com:8080/hello.git
 * [new branch]      master -> master
```

## API

### var host = require('taco')(opts, ready)

Create a new taco instance.

taco expects these minimum values in the `opts` object:

- `opts.dir`: base path to host
- `opts.host`: vhost (http host) to route incoming requests with
- `opts.nginx`: nginx options object, gets passed to the `nginx-vhosts` module
- `opts.nginx.conf`: path to nginx configuration file
- `opts.nginx.confDir`: path to a folder where new nginx config files can be created
- `opts.nginx.pidLocation`: path to the nginx pid file

`ready` will be called when taco is ready to handle requests

### host.handle(req, res)

Handle an incoming HTTP request/response.

## run the server

```
sudo DEBUG=* USER=admin PASS=pass taco foo.com /usr/local/etc/nginx/conf.d/ /usr/local/etc/nginx/nginx.conf /var/run/nginx.pid
```

## why not heroku/dokku/flynn/deis/etc?

taco doesn't implement all the bells and whistles needed to deploy 'application stacks' like LAMP or Rails. all you get is support for node programs that can be configured + started using `npm install` and `npm start`.

anything that can't be installed from npm (e.g. non in-process databases) needs more complexity, and the existing PaaS platforms are probably what you want. taco has no complex backing services http://12factor.net/backing-services

