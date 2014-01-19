apt-get install -y git build-essential
mkdir /tmp/mon
cd /tmp/mon
curl -L# https://github.com/visionmedia/mon/archive/master.tar.gz | tar zx --strip 1
make install
cd /root
npm install mongroup taco -g
mkdir logs
mkdir pids
if [ ! -f mongroup.conf ]; then
    echo 'taco = DEBUG=taco taco $(cat VHOST)' > mongroup.conf
    echo "logs = logs" >> mongroup.conf
    echo "pids = pids" >> mongroup.conf
fi
mongroup restart taco
