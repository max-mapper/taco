var os = require('os')
var fs = require('fs')
var http = require('http')
var path = require('path')
var spawn = require('child_process').spawn

var stdout = require('stdout')
var through = require('through')
var Vhosts = require('nginx-vhosts')
var mongroup = require('mongroup')
var sidebandEncode = require('git-side-band-message')
var mkdirp = require('mkdirp')
var getport = require('getport')
var cicada = require('cicada')
var wrapCommit = require('cicada/lib/commit')

module.exports = Host

function Host(opts) {
  if (!(this instanceof Host)) return new Host(opts)
  var self = this
  this.opts = opts || {}
  if (typeof opts.checkout === 'undefined') opts.checkout = false
  if (!opts.dir) opts.dir = process.cwd()
  this.host = opts.host || 'localhost'
  this.repoDir = opts.dir + '/repos'
  this.workDir = opts.dir + '/checkouts'
  var ciOpts = {
    repodir: this.repoDir,
    workdir: function(commit) {
      var dir = self.checkoutDir(commit.repo)
      return dir
    },
    bare: true
  }
  this.ci = cicada(ciOpts)
  this.server = http.createServer(this.ci.handle)
  this.vhosts = Vhosts(opts.nginx, function running(isRunning) {
    if (!isRunning) {
      self.vhosts.nginx.start(function(err) {
        if (err) console.log('nginx start error', err)
      })
      console.log('starting nginx...')
    } else {
      console.log('nginx is running')
    }
  })
  this.ci.on('push', function (push) {
    var response, done
    push.accept()
    push.on('response', function(res, cb) {
      response = res
      done = cb
    })
    push.on('service-end', function() {
      var tmpStr = ''
      var respLog = through(function(ch) {
        var str = ch.toString()
        tmpStr += str
        if (str.indexOf('\n') === -1) return
        tmpStr = tmpStr.slice(0, tmpStr.length - 1)
        response.write(sidebandEncode(tmpStr))
        tmpStr = ''
      }, null, { end: false })
      // respLog.pipe(stdout())
      self.checkout(push, function(err, commit) {
        if (err) return respLog.write('checkout error ' + err.message + '\n')
        respLog.write('checked out ' + commit.repo + '\n')
        self.prepare(commit.dir, respLog, function(err) {
          if (err) return respLog.write('prepare err ' + err.message + '\n')
          var name = self.name(commit.repo)
          getport(function(err, port) {
            if (err) {
              respLog.write('ERROR could not get port\n')
              respLog.end()
              return
            }
            self.deploy(name, commit.dir, port, function(err) {
              self.vhosts.write({
                name: name,
                port: port,
                domain: name + '.' + self.host
              }, function(err, stdout, stderr) {
                // give nginx time to reload config
                setTimeout(function() {
                  respLog.write('deployed! err: ' + err + '\n')
                  respLog.end()
                  done()
                }, 500)
              })
            })
          })
        })
      })
    })
  })
}

Host.prototype.close = function() {
  this.server.close()
  this.vhosts.end()
}

Host.prototype.prepare = function(dir, res, cb) {
  var npmi = spawn('npm', ['install'], { cwd : dir }) 
  npmi.stdout.pipe(res)
  npmi.stderr.pipe(res)
  npmi.on('exit', function (c) {
    if (c !== 0) return cb({error: true, code: c})
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
        processes: {},
        logs: self.opts.dir + '/logs',
        pids: self.opts.dir + '/pids'
      }
    } else {
      conf = mongroup.parseConfig(conf)
    }
    
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

Host.prototype.checkout = function (push, cb) {
  var self = this
  var name = this.name(push.repo)
  fs.exists(this.checkoutDir(name), function(exists) {
    if (!exists) return self.ci.checkout(push, cb)
    self.pull(push, cb)
  })
}

Host.prototype.pull = function (push, cb) {
  var self = this
  var dir = this.checkoutDir(this.name(push.repo))
  push.id = push.commit + '.' + Date.now()
  var cmd = [
    'git', 'pull',
    'file://' + path.resolve(self.ci.repos.dirMap(push.repo)),
    push.branch
  ]
  runCommand(cmd, { cwd : dir }, function (err) {
    if (err) return cb(err)
    var c = wrapCommit({
      id : push.id,
      dir : dir,
      repo : push.repo,
      branch : push.branch,
      hash : push.commit
    })
    cb(null, c)
  })
}
