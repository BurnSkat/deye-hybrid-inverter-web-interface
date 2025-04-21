### ChatGPT (4o) was a helping A LOT creating this file ;)

import os
import subprocess
import time
import re
import socket
import json
import urllib.request
import helper

STARTUP_DELAY = 2*60
CHECK_INTERVAL = 30
AP_TIME = 15*60
WIFI_TIME = 2*60

def start():
   time.sleep(STARTUP_DELAY)
   while True:
      if not isConnectedToWifi():
         print("No Wifi-Connection. Starting AP...")
         startAP()
         time.sleep(AP_TIME)
         stopAP()
         time.sleep(WIFI_TIME)
      time.sleep(CHECK_INTERVAL)

def isConnectedToWifi():
   result = subprocess.run(["iwgetid", "wlan0", "-r"], capture_output=True, text=True)
   return bool(result.stdout.strip())

def getPublicIpAddress():
   try:
      with urllib.request.urlopen("https://api64.ipify.org?format=text", timeout=5) as response:
         return response.read().decode().strip()
   except Exception as e:
      print(f"[WARN] Fehler beim Abrufen der öffentlichen IP: {e}")
      return None

def startAP():
   config = helper.getConfig()
   ssid = config["wifiAP"]["ssid"]
   password = config["wifiAP"]["password"]
   prefix = config["wifiAP"]["prefix"]
   try:
      # Stoppe den NetworkManager vor dem Start des AP
      subprocess.run("sudo systemctl stop NetworkManager", shell=True, check=True)

      # Stoppe den Service, wenn er bereits läuft
      subprocess.run("sudo systemctl stop hostapd", shell=True, check=True)
      subprocess.run("sudo systemctl stop dnsmasq", shell=True, check=True)

      # Erstelle virtuelles Interface, wenn es nicht existiert
      result = subprocess.run("iw dev | grep uap0", shell=True, stdout=subprocess.PIPE)
      if result.returncode != 0:
         subprocess.run("sudo iw dev wlan0 interface add uap0 type __ap", shell=True, check=True)

      # Konfiguriere das virtuelle Interface uap0
      subprocess.run(f"sudo ifconfig uap0 {prefix}.1/24 up", shell=True, check=True)

      # Konfiguriere dnsmasq
      with open("/etc/dnsmasq.conf", "w") as file:
         file.write(
            "interface=uap0\n"
            f"dhcp-range={prefix}.2,{prefix}.20,255.255.255.0,24h\n"
         )

      # Konfiguriere hostapd
      with open("/etc/hostapd/hostapd.conf", "w") as file:
         file.write(
            "interface=uap0\n"
            "driver=nl80211\n"
            f"ssid={ssid}\n"
            "hw_mode=g\n"
            "channel=7\n"
            "wmm_enabled=0\n"
            "macaddr_acl=0\n"
            "ignore_broadcast_ssid=0\n"
         )
         if password and len(password) >= 8:
            file.write(
               "wpa=2\n"
               f"wpa_passphrase={password}\n"
               "wpa_key_mgmt=WPA-PSK\n"
               "wpa_pairwise=TKIP\n"
               "rsn_pairwise=CCMP\n"
            )
         else:
            file.write(
               "auth_algs=1\n"
               "wpa=0\n"
            )

      # Weise hostapd an, die Konfigurationsdatei zu verwenden
      with open("/etc/default/hostapd", "w") as file:
         file.write("DAEMON_CONF=\"/etc/hostapd/hostapd.conf\"\n")

      # Starte die Dienste neu
      subprocess.run("sudo systemctl unmask hostapd", shell=True, check=True)
      subprocess.run("sudo systemctl unmask dnsmasq", shell=True, check=True)
      subprocess.run("sudo systemctl start hostapd", shell=True, check=True)
      subprocess.run("sudo systemctl start dnsmasq", shell=True, check=True)
      print("AP gestartet")

   except subprocess.CalledProcessError as e:
      print(f"Fehler beim Starten des AP: {e}")

def stopAP():
   try:
      # Stoppe den Service, wenn er läuft
      subprocess.run("sudo systemctl stop hostapd", shell=True, check=True)
      subprocess.run("sudo systemctl stop dnsmasq", shell=True, check=True)
      time.sleep(5)

      # Starte den NetworkManager neu, um die Verbindung zu bekannten Netzwerken wiederherzustellen
      subprocess.run("sudo systemctl start NetworkManager", shell=True, check=True)
      time.sleep(5)

      # wlan0 interface neu starten
      subprocess.run("sudo ifconfig wlan0 down", shell=True, check=True)
      time.sleep(5)
      subprocess.run("sudo ifconfig wlan0 up", shell=True, check=True)
      print("AP gestoppt")

   except subprocess.CalledProcessError as e:
      print(f"Fehler beim Stoppen des AP: {e}")



def getAvailableNetworks():
   networks = []
   try:
      result = subprocess.run(['sudo', 'nmcli', '-f', 'SSID,RATE,SIGNAL', 'dev', 'wifi'], capture_output=True, text=True)
      lines = result.stdout.split('\n')
      for line in lines[1:]:
         if line:
            fields = line.split()
            if len(fields) >= 4:
               ssid = " ".join(fields[:-3])
               rate = fields[-3]
               signal = fields[-1]
               networks.append({
                  'SSID': ssid,
                  'RATE': rate,
                  'SIGNAL': signal
               })
   except subprocess.CalledProcessError: pass
   return networks


def connectNewNetwork(ssid, password, staticIp):
   # Lösche alle vorherigen Verbindungen
   connections = subprocess.run(['sudo', 'nmcli', '-t', '-f', 'NAME,UUID', 'connection', 'show'], capture_output=True, text=True).stdout
   for line in connections.splitlines():
      name, uuid = line.split(':')
      try: subprocess.run(['sudo', 'nmcli', 'connection', 'delete', 'uuid', uuid], check=True)
      except subprocess.CalledProcessError: pass

   # Neue WLAN-Verbindung hinzufügen
   try:
      subprocess.run(['sudo', 'nmcli', 'device', 'wifi', 'connect', ssid, 'password', password], check=True)
      print(f"Verbunden mit dem Netzwerk {ssid}")
   except subprocess.CalledProcessError: pass

   # Statische IP setzen
   if re.match(r"^\d{1,3}(\.\d{1,3}){3}$", staticIp):
      time.sleep(3)
      connections = subprocess.run(['sudo', 'nmcli', '-t', '-f', 'NAME,UUID', 'connection', 'show'], capture_output=True, text=True).stdout
      for line in connections.splitlines():
         name, uuid = line.split(':')
         try: subprocess.run(['sudo', 'nmcli', 'connection', 'modify', uuid,
               'ipv4.addresses', f'{staticIp}/24',
               'ipv4.gateway', f'{staticIp.rsplit(".", 1)[0]}.1',
               'ipv4.dns', '8.8.8.8',
               'ipv4.method', 'manual'], check=True)
         except subprocess.CalledProcessError: pass

   # Reboots System
   subprocess.run(['sudo', 'reboot'], check=True)
