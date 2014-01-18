var os = require('os')
var fs = require('fs')
var path = require('path')
var child = require('child_process')
var spawn = child.spawn

var basic = require('basic')
var stdout = require('stdout')
var mkdirp = require('mkdirp')
var getport = require('getport')
var through = require('through')
var mongroup = require('mongroup')
var Vhosts = require('nginx-vhosts')
var backend = require('git-http-backend')
var nconf = require('nginx-conf').NginxConfFile

// show debug messages if process.env.DEBUG === tacoa
var debug = require('debug')('taco')

module.exports = Host

function Host(opts, ready) {
  if (!(this instanceof Host)) return new Host(opts, ready)
  var self = this
  
  this.opts = opts || {}
  if (!opts.dir) opts.dir = process.cwd()  
  this.host = opts.host || 'localhost'
  this.repoDir = opts.dir + '/repos'
  this.workDir = opts.dir + '/checkouts'
  
  var uname = process.env['USER']
  var upass = process.env['PASS']
  
  this.auth = basic(function (user, pass, callback) {
    if (user === uname && pass === upass) return callback(null)
    callback(401)
  })
  
  this.handle = function(req, res) {
    if (!uname || !upass) return accept()
    
    self.auth(req, res, function (err) {
      if (err) {
        res.writeHead(err, {'WWW-Authenticate': 'Basic realm="Secure Area"'})
        res.end()
        return
      }
      accept()
    })
    
    function accept() {
      var bs = backend(req.url, onService)
      req.pipe(bs).pipe(res)
    }
    
    function onService(err, service) {
      if (err) return res.end(JSON.stringify({err: err}))
      if (service.action === 'push') {
        service.sideband = service.createBand()
      }
      var repo = req.url.split('/')[1]
      var dir = path.join(self.repoDir, repo)
      res.setHeader('content-type', service.type)
      
      self.init(dir, function(err, sto, ste) {
        if (err || ste) {
          var errObj = {err: err, stderr: ste, stdout: sto}
          return res.end(JSON.stringify(errObj))
        }
        
        var serviceStream = service.createStream()
        var ps = spawn(service.cmd, service.args.concat(dir))
        ps.stdout.pipe(serviceStream).pipe(ps.stdin)
        
        debug('Host.onService spawn ' + service.cmd + ' ' + service.action)
        
        ps.on('exit', function() {
          debug('Host.onService spawn ' + service.cmd + ' ' + service.action + ' finished')
          if (service.action === 'push') {
            self.handlePush({repo: repo, service: service})
          }
        })
        
      })
    }
  }
  
  var needsReload = false
  
  var confPath = opts.nginx.conf || '/etc/nginx/nginx.conf'
  nconf.create(confPath, function(err, conf) {
    if (err) return ready(err)
    if (conf.nginx.http.server_names_hash_bucket_size) return initVhosts(ready)
    conf.nginx.http._add('server_names_hash_bucket_size', '64')
    fs.writeFile(confPath, conf.toString(), function(err) {
      if (err) return ready(err)
      initVhosts(ready)
    })
  })
  
  function initVhosts(cb) {
    self.vhosts = Vhosts(opts.nginx, function running(isRunning) {
      if (!isRunning) {
        self.vhosts.nginx.start(function(err) {
          if (!err) return
          debug('nginx start error ' + err)
          cb(err)
        })
        debug('starting nginx...')
      } else {
        debug('nginx is running')
        cb()
        if (needsReload) {
          self.vhosts.nginx.reload()
          needsReload = false
        }
      }
    })
  }
  
}

Host.prototype.init = function(dir, cb) {
  var self = this
  fs.exists(dir, function(exists) {
    if (exists) return cb()
    mkdirp(dir, function(err) {
      if (err) return cb(err)
      child.exec('git init --bare', {cwd: dir}, cb)
    })
  })
}

Host.prototype.handlePush = function(push) {
  var self = this
  var sideband = push.service.sideband
  self.update(push, function(err) {
    if (err) {
      sideband.write('checkout error ' + err.message + '\n')
      debug('Host.handlePush update err: ' + err)
      return
    }
    var checkoutDir = self.checkoutDir(push.repo)
    sideband.write('received ' + push.repo + '\n')
    sideband.write('running npm install...\n')
    debug('Host.handlePush prepare start for ' + push.repo)
    self.prepare(checkoutDir, sideband, function(err) {
      if (err) {
        sideband.write('prepare err ' + err.message + '\n')
        debug('Host.handlePush prepare err: ' + err)
        return
      }
      debug('Host.handlePush prepare finished')
      var name = self.name(push.repo)
      getport(function(err, port) {
        if (err) {
          sideband.write('ERROR could not get port\n')
          sideband.end()
          debug('Host.handlePush getport err: ' + err)
          return
        }
        debug('Host.handlePush getport finished')
        self.deploy(name, checkoutDir, port, function(err) {
          if (err) debug('Host.handlePush deploy err: ' + err)
          debug('Host.handlePush deploy finished')
          var vhost = name + '.' + self.host
          self.vhosts.write({
            name: name,
            port: port,
            domain: vhost
          }, function(err, stdo, stde) {
            // give nginx time to reload config
            setTimeout(function() {
              if (err) debug('Host.handlePush vhosts.write err: ' + err)
              else debug('Host.handlePush vhosts.write finished')
              
              if (err) sideband.write('deploy err! ' + err + '\n')
              else sideband.write('deployed app at ' + vhost + '\n')
              sideband.end()
            }, 500)
          })
        })
      })
    })
  })
}

Host.prototype.close = function() {
  this.vhosts.nginx.end()
}

Host.prototype.prepare = function(dir, res, cb) {
  var npmi = spawn('npm', ['install'], { cwd : dir }) 
  npmi.stdout.pipe(res, { end: false })
  npmi.stderr.pipe(res, { end: false })
  npmi.on('exit', function (c) {
    if (c !== 0) return cb(new Error('Non-zero exit code: ' + c))
    cb(null, {code: c})
  })
  npmi.on('error', cb)
}

Host.prototype.deploy = function(name, dir, port, cb) {
  var self = this
  var confPath = this.opts.dir + '/mongroup.conf'
  
  fs.readFile(confPath, 'utf8', function(err, conf) {
    if (err) {
      conf = {
        processes: {}
      }
    } else {
      conf = mongroup.parseConfig(conf)
    }
    
    if (!conf.logs) conf.logs = self.opts.dir + '/logs'
    if (!conf.pids) conf.pids = self.opts.dir + '/pids'
    
    if (!conf.processes[name])
      conf.processes[name] = 'cd ' + dir + ' && ' + 'PORT=' + port + ' npm start'
    
    var confString = self.serializeConf(conf)
    
    fs.writeFile(confPath, confString, function(err) {
      if (err) return cb(err)
      
      mkdirp(conf.logs, function(err) {
        if (err) return cb(err)
        mkdirp(conf.pids, function(err) {
          if (err) return cb(err)
          initGroup()
        })
      })
      
    })
    
    function initGroup() {
      var group = new mongroup(conf)
  
      var procs = [name]
  
      group.stop(procs, 'SIGQUIT', function(err) {
        if (err) return cb(err)
        group.start(procs, function(err) {
          if (err) return cb(err)
          cb()
        })
      })
    }
    
  })
  
}

Host.prototype.serializeConf = function(conf) {
  var str = ''
  Object.keys(conf.processes).map(function(name) {
    str += name + ' = ' + conf.processes[name] + '\n'
  })
  Object.keys(conf).map(function(name) {
    if (name === 'processes') return
    str += name + ' = ' + conf[name] + '\n'
  })
  return str
}

Host.prototype.checkoutDir = function(repo) {
  return this.workDir + '/' + this.name(repo)
}

Host.prototype.name = function(repo) {
  return repo.split('.git')[0]
}

Host.prototype.update = function (push, cb) {
  var self = this
  fs.exists(this.checkoutDir(push.repo), function(exists) {
    debug(push.repo + ' exists? ' + exists)
    if (!exists) return self.checkout(push, cb)
    self.pull(push, cb)
  })
}

Host.prototype.checkout = function(push, cb) {
  var self = this
  var dir = this.checkoutDir(push.repo)
  mkdirp(dir, init)

  function init (err) {
    if (err) return cb('mkdirp(' + dir + ') failed')
    debug('mkdirp() ' + dir + ' finished')
    child.exec('git init', {cwd: dir}, function (err, stdo, stde) {
      if (err) return cb(err)
      debug('init() ' + dir + ' finished')
      fetch()
    })
  }

  function fetch () {
    var cmd = [
      'git', 'fetch',
      'file://' + path.resolve(self.repoDir, push.repo),
      push.service.fields.branch
    ].join(' ')
    
    child.exec(cmd, { cwd : dir }, function (err) {
      if (err) return cb(err)
      debug('fetch() ' + dir + ' finished')
      checkout()
    })
  }

  function checkout () {
    var cmd = [
      'git', 'checkout', '-b', push.service.fields.branch, push.service.fields.head
    ].join(' ')
    
    child.exec(cmd, { cwd : dir }, function(err, stdo, stde) {
      cb(err, stdo, stde)
    })
  }
  
}

Host.prototype.pull = function (push, cb) {
  var self = this
  var dir = this.checkoutDir(this.name(push.repo))
  push.id = push.commit + '.' + Date.now()
  var cmd = [
    'git', 'pull',
    'file://' + path.resolve(self.repoDir, push.repo),
    push.service.fields.branch
  ].join(' ')
  debug('Host.pull ' + dir + ': ' + cmd)
  child.exec(cmd, { cwd : dir }, function (err) {
    debug('Host.pull ' + dir + ' done: ' + err)
    if (err) return cb(err)
    cb(null)
  })
}
