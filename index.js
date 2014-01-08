var vhosts = require('nginx-vhosts')
var mongroup = require('mongroup')
var http = require('http')
var os = require('os')
var fs = require('fs')
var path = require('path')
var cicada = require('cicada')
var wrapCommit = require('cicada/lib/commit')
var runCommand = require('cicada/lib/command')

module.exports = Host

function Host(opts) {
  if (!(this instanceof Host)) return new Host(opts)
  var self = this
  this.opts = opts || {}
  if (typeof opts.checkout === 'undefined') opts.checkout = false
  if (!opts.dir) opts.dir = process.cwd()
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
  this.ci.on('push', function (push) {
    push.accept()
    push.on('exit', function() {
      self.checkout(push, function(err, commit) {
        if (err) return console.error(err)
        console.log('checked out', commit)
      })
    })
  })
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
