sudo apt-get install -y git build-essential

sudo mkdir /tmp/mon
cd /tmp/mon
curl -L# https://github.com/visionmedia/mon/archive/master.tar.gz | sudo tar zx --strip 1
sudo make install

if [ $USERNAME = "root" ]; then
  cd /root
else
  cd /home/$USERNAME
fi

echo $VHOST > VHOST

sudo npm install mongroup taco -g
mkdir logs
mkdir pids

if [ ! -f mongroup.conf ]; then
    echo 'taco = sudo DEBUG=taco taco $(cat VHOST)' > mongroup.conf
    echo "logs = logs" >> mongroup.conf
    echo "pids = pids" >> mongroup.conf
fi

sudo mongroup restart taco
