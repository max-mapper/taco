mkdir /tmp/mon
cd /tmp/mon
curl -L# https://github.com/visionmedia/mon/archive/master.tar.gz | tar zx --strip 1
make install
apt-get install -y git
npm install mongroup taco -g
echo "taco = taco" > /root/mongroup.conf
