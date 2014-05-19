# how to run tests

install nginx
install mon https://github.com/visionmedia/mon

add `test.local` and `a.test.local` to your `/etc/hosts` for `localhost`

verify these nginx settings are correct (they are assumed in the tests):

```
var nginxOpts = {
  confDir: '/usr/local/etc/nginx/conf.d',
  pidLocation: '/var/run/nginx.pid',
  conf: '/usr/local/etc/nginx/nginx.conf'
}
```

for `confDir` you should have an `include` directive in the `http` section of your nginx config, more info here https://github.com/maxogden/nginx-vhosts#nginx-vhosts


run the tests with `sudo npm test`
