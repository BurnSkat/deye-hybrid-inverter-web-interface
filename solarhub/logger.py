from pymodbus.client import ModbusSerialClient
import sqlite3
import time
from telegram import sendTelegramMessage
import os
import dbManager
import json
import glob
import wifiManager
import helper
from datetime import datetime

def start():
   global cursor, conn, config, batteryLimits
   cursor, conn = dbManager.connect("database.db")
   connectToSerialUsbAdapter()

   # Removing Section of faulty data.
   # print("Deleting Section...")
   # start_time = int(datetime(2024, 9, 19, 11, 00).timestamp() * 1000)  # 21.09.2024 12:00 Uhr
   # end_time = int(datetime(2024, 9, 19, 18, 30).timestamp() * 1000)  # 21.09.2024 18:00 Uhr
   # cursor.execute("""
   #    UPDATE logs
   #    SET p_grid = 0, p_load = 0
   #    WHERE timestamp BETWEEN ? AND ?
   # """, (start_time, end_time))
   # conn.commit()
   # print("Updated Section")


   # Test Read/Write of Register
   # zero_export_power_register = 104
   # result = readRegister(zero_export_power_register)
   # print(f"Initial value of register {zero_export_power_register}: {result.registers[0] if result and not result.isError() else 'Error reading register'}")
   # time.sleep(1)
   # writeRegister(zero_export_power_register, 65516) # equals -20 (65516)
   # time.sleep(1)
   # result = readRegister(zero_export_power_register)
   # print(f"Value of register {zero_export_power_register} after writing -20: {result.registers[0] if result and not result.isError() else 'Error reading register'}")


   # Get Config
   config = helper.getConfig()

   # Log Data roughly once per second
   liveValueBuffer = {}
   valueHistory = {}
   prevTime = time.time()
   counter = 0
   publicIpAddress = ""
   while True:
      readLiveValues(liveValueBuffer)
      manageBattery(liveValueBuffer);

      # Append liveValues to valueHistory
      for key, value in liveValueBuffer.items():
         valueHistory.setdefault(key, []).append(value)

      # Save Live Data
      dbManager.emptyTable("live")
      dbManager.addRowToTable("live", liveValueBuffer)
      print(" | ".join(f"{k}: {v}" for k, v in liveValueBuffer.items()))

      # Calculate averages & save historical data every minute
      currentTime = time.time()
      if currentTime - prevTime >= 60:
         prevTime = currentTime
         averages = {name: sum(valueHistory[name]) / len(valueHistory[name]) for name in valueHistory}
         valueHistory = {}
         dbManager.addRowToTable("logs", averages)

      # Check Public IP Address every few runs and update if neccessary
      counter = counter+1
      if counter >= 600: # roughly every 10 Minutes
         counter = 0
         ip = wifiManager.getPublicIpAddress()
         if ip and publicIpAddress != ip:
            publicIpAddress = ip
            sendTelegramMessage(f"Neue Interface-URL: {publicIpAddress}:1213", silent=True, pin=True)

      # Save all changes and wait
      conn.commit()
      time.sleep(0.8)

# Connect to RS485-Adapter
def connectToSerialUsbAdapter():
   global client
   devices = glob.glob('/dev/ttyUSB*')
   if not devices: return False
   port = devices[0]
   client = ModbusSerialClient(method="rtu", port=port, baudrate=9600, timeout=1)
   while True:
      try:
         if client.connect():
            print("Modbus connection successful")
            return client
         else:
            print("Modbus connection failed, retrying in 1 second...")
      except Exception as e:
            print(f"Error during connection attempt: {e}, retrying in 1 second...")
      time.sleep(1)

# Read and Process Live Values
def readLiveValues(buffer):
   registers = config["inverter"]["modbusRegisters"]
   for name in registers:
      address = registers[name]["address"]
      result = readRegister(address)
      if result is None or result.isError(): continue
      val = result.registers[0]
      if registers[name]["isTwosComplement"] and val > 32767: val -= 65536
      buffer[name] = val;
   buffer["timestamp"] = int(time.time()*1000)
   buffer["p_sun"] = max(0, buffer.get("p_string1", 0) + buffer.get("p_string2", 0) + buffer.get("p_gen", 0))
   buffer["p_losses"] = buffer.get("p_sun", 0) + buffer.get("p_batt", 0) + buffer.get("p_grid", 0) - buffer.get("p_load", 0)
   buffer["p_grid_export"] = abs(min(0, buffer.get("p_grid", 0)))
   buffer["p_grid_import"] = max(0, buffer.get("p_grid", 0))

# Check Data, Perform Actions and Send Warning Messages
def manageBattery(buffer):
   battSoC = buffer.get("batt_soc", 0)
   maxSoC = 100*config["battery"]["charge"]["limit"]
   chargeCurrent = config["battery"]["charge"]["maxCurrent"]
   chargeRegister = config["battery"]["charge"]["register"]
   dischargeRegister = config["battery"]["discharge"]["register"]
   minSoC = 100*config["battery"]["discharge"]["limit"]
   dischargeCurrent = config["battery"]["discharge"]["maxCurrent"]

   # Limit Battery SoC
   if battSoC <= minSoC:
      writeRegister(dischargeRegister, 0)
   else:
      writeRegister(dischargeRegister, dischargeCurrent)
   if battSoC >= maxSoC:
      writeRegister(chargeRegister, 0)
   else:
      writeRegister(chargeRegister, chargeCurrent)

   # Send Telegram Messages
   sendOneTimeMessage("⚠️ Batterie bald leer", battSoC <= minSoC+10, battSoC > minSoC+20)
   sendOneTimeMessage("🪫 Batterie leer", battSoC <= minSoC, battSoC > minSoC+10)
   sendOneTimeMessage("🔋 Batterie voll", battSoC >= maxSoC, battSoC < maxSoC-10)

# Sends a One-Time Telegram Message to the User
notifications = {}
def sendOneTimeMessage(message, condition, resetCondition):
   global notifications
   key = hash(message)
   if condition and not (notifications.get(key) or False):
      notifications[key] = True
      sendTelegramMessage(message)
   if resetCondition:
      notifications[key] = False

# Reads the value of a register at the given address
def readRegister(address):
   slaveId = config["inverter"]["slave_id"]
   try:
      result = client.read_holding_registers(address, 1, slave=slaveId, timeout=0.5)
      return result
   except Exception as e:
      print(f"Exception occurred while reading register {address}: {e}")
      return None

# Writes the given value to the given register
registerCache = {}
def writeRegister(address, value, maxAttempts=7):
   global registerCache
   if registerCache.get(address) == value: return
   slaveId = config["inverter"]["slave_id"]
   attemptCounter = 0
   while attemptCounter < maxAttempts:
      try:
         result = client.write_registers(address, [value], slave=slaveId, timeout=0.5)
         if not result.isError():
            registerCache[address] = value
            print(f"Successfully wrote {value} to register {address}")
            break
      except Exception as e:
         print(f"Exception occurred while writing to register {address}: {e}")
      attemptCounter += 1
      time.sleep(0.1)
   else:
      print(f"Failed to write to register {address} after {maxAttempts} attempts.")


### End of File
