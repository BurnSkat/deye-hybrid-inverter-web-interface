import dbManager
import json
import wifiManager
import helper

def request(path, params):
   liveDataJson = dbManager.query("SELECT * FROM live")
   liveData = json.loads(liveDataJson)

   # Live Data
   if path.startswith('live/'):
      action = path[len('live/'):]
      if action == "raw":
         return liveDataJson
      if action == "solar_power":
         return liveData[0]["p_sun"]
      if action == "load_power":
         return liveData[0]["p_load"]
      if action == "batt_soc":
         return liveData[0]["batt_soc"]
      if action == "t_dctemp":
         return liveData[0]["t_dctemp"]
      if action == "t_actemp":
         return liveData[0]["t_actemp"]
      if action == "batt_socalt":
         return liveData[0]["bat_socalt"]
      if action == "p_totalin":
         return liveData[0]["p_totalin"]
      if action == "summary":
         answer = "Die Solaranlage produziert gerade " + str(liveData[0]["p_sun"]) + " Watt und der Verbrauch liegt bei " + str(liveData[0]["p_load"]) + " Watt. Die Batterie ist zu " + str(liveData[0]["batt_soc"]) + " Prozent geladen."
         return answer

   # Historical Data
   if path.startswith('historical/'):
      action = path[len('historical/'):]
      if action == "raw":
         start = params.get("start", 0);
         end = params.get("end", 0);
         blockLength = params.get("blockLength", 0);
         queryString = f"""
            SELECT
              MIN(timestamp) AS timestamp_start,
              MAX(timestamp) AS timestamp_end,
              AVG(batt_soc) AS batt_soc,
              AVG(p_sun) AS p_sun,
              AVG(p_string1) AS p_string1,
              AVG(p_string2) AS p_string2,
              AVG(p_gen) AS p_gen,
              AVG(p_load) AS p_load,
              AVG(p_losses) AS p_losses,
              AVG(p_grid) AS p_grid,
              AVG(p_grid_import) AS p_grid_import,
              AVG(p_grid_export) AS p_grid_export,
              AVG(p_inverter) AS p_inverter,
              AVG(p_batt) AS p_batt,
              AVG(t_dctemp) AS t_dctemp,
              AVG(t_actemp) AS t_actemp,
              AVG(bat_socalt) AS bat_socalt,
              AVG(p_totalin) AS p_totalin
           FROM
              logs
           WHERE
              timestamp BETWEEN {start} AND {end}
           GROUP BY
              FLOOR((timestamp - {start}) / {blockLength})
           ORDER BY
              timestamp_start
         """
         data = dbManager.query(queryString)
         return data
      if action == "peak":
         start = params.get("start", 0);
         end = params.get("end", 0);
         key = params.get("key", 0);
         queryString = f"""
            SELECT
               MAX({key}) AS max,
               MIN({key}) AS min
            FROM logs
            WHERE timestamp BETWEEN {start} AND {end};
         """
         data = dbManager.query(queryString)
         return json.dumps(json.loads(data)[0])
      if action == "oldest":
         queryString = """
            SELECT *
               FROM logs
            ORDER BY timestamp ASC
            LIMIT 1;
         """
         data = dbManager.query(queryString)
         return json.dumps(json.loads(data)[0])



   # Config
   if path == "config":
      config_data = helper.getConfig(False)
      return json.dumps(config_data)

   # Get Wifi Networks
   if path == "networks":
      networks = wifiManager.getAvailableNetworks()
      return json.dumps(networks)

   # Fallback Answer
   return ("Invalid API Request: " + path)
