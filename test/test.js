var test = require('tape')
var http = require('http')
var rimraf = require('rimraf')
var mkdirp = require('mkdirp')
var child = require('child_process')
var seq = require('seq')
var fs = require('fs')
var request = require('request')
var stdout = require('stdout')
var taco = require('../')
var dir = __dirname + '/deploys'
var repo = __dirname + '/test-server'
var nginxOpts = {
  confDir: '/usr/local/etc/nginx/conf.d',
  pidLocation: '/var/run/nginx.pid',
  conf: '/usr/local/etc/nginx/nginx.conf'
}

function cleanup(cb) {
  fs.exists(dir + '/mongroup.conf', function(exists){
    if (exists) return child.exec('mongroup stop', {cwd: dir}, function(err, stdout, stderr) {
      if (err) throw err
      process.stdout.write(stdout)
      rm()
    })
    rm()
  })
  
  function rm() {
    rimraf(dir, function(err) {
      if (err) return cb(err)
      rimraf(repo + '/.git', function(err) {
        if (err) return cb(err)
        rimraf(nginxOpts.confDir, function(err) {
          if (err) return cb(err)
          mkdirp(nginxOpts.confDir, function(err) {
            if (err) return cb(err)
            cb()
          })
        })
      })
    })
  }
}

test('cleanup', function(t) {
  cleanup(function(err) {
    t.false(err, 'no fatal cleanup errors')
    t.end()
  })
})

test('deploys a simple http server to a.test.local', function(t) {
  var server
  var host = taco({
    dir: dir,
    nginx: nginxOpts,
    host: 'test.local'
  }, function ready(err) {
    t.false(err, 'taco should be ready')
    server = http.createServer(host.handle.bind(host))
    server.listen(8080, function(err) {
      t.false(err, 'host is listening')
      request('http://a.test.local', function(err, resp, body) {
        t.false(err, 'nginx should be running')
        t.true(body.indexOf('num') === -1, 'a.test.local should not be vhosted')
        deploy()
      })
    })
  })
  
  function deploy(){
    seq()
      .seq(function () {
        child.exec('git init', {cwd: repo}, this.ok)
      })
      .seq(function () {
        child.exec('git add .', {cwd: repo}, this.ok)
      })
      .seq(function () {
        child.exec('git commit -m "init"', {cwd: repo}, this.ok)
      })
      .seq(function () {
        child.exec('git remote add origin http://localhost:8080/a.git', {cwd: repo}, this.ok)
      })
      .seq(function () {
        var self = this
        var push = child.spawn('git', ['push', 'origin', 'master'], { cwd: repo })
        push.stdout.pipe(stdout())
        push.stderr.pipe(stdout())
        push.on('exit', function(code) {
          console.log('push exit', code)
          self.ok()
          request('http://a.test.local', function(err, resp, body) {
            t.false(err, 'a.test.local should resolve')
            t.true((body || '').indexOf('num') > -1, 'resp has num')
            done()
          })
        })
      })
      .catch(t.fail)
  }
  
  function done() {
    host.vhosts.nginx.stop()
    host.close()
    server.close()
    t.end()
  }
})

test('cleanup', function(t) {
  cleanup(function(err) {
    t.false(err, 'no fatal cleanup errors')
    t.end()
  })
})
