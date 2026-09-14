jsx
import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "./App.css";

const API_BASE_URL = "https://ro-tank.onrender.com";
const TANK_ID = "tank_01";
const TANK_CAPACITY = 2000;

function App() {
  const [tankLevel, setTankLevel] = useState(0);
  const [volume, setVolume] = useState(0);
  const [distance, setDistance] = useState(0);
  const [historyData, setHistoryData] = useState([]);
  const [selectedRange, setSelectedRange] = useState("1h");
  const [alerts, setAlerts] = useState([]);
  const [sensorStatus, setSensorStatus] = useState("offline");
  const [loading, setLoading] = useState(true);

  const getLatest = async () => {
    try {
      const response = await fetch(
        API_BASE_URL + "/api/tanks/" + TANK_ID + "/latest"
      );

      if (!response.ok) {
        throw new Error("Latest API failed");
      }

      const data = await response.json();

      setTankLevel(Number(data.level_percent || 0));
      setVolume(Number(data.volume_liters || 0));
      setDistance(Number(data.distance_cm || 0));
    } catch (error) {
      console.error("Latest data error:", error);
    }
  };

  const getHistory = async () => {
    try {
      const response = await fetch(
        API_BASE_URL +
          "/api/tanks/" +
          TANK_ID +
          "/history?range=" +
          selectedRange
      );

      if (!response.ok) {
        throw new Error("History API failed");
      }

      const data = await response.json();

      const formatted = Array.isArray(data)
        ? data.map((item) => ({
            time: new Date(item.recorded_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
            level: Number(item.level_percent || 0),
            volume: Number(item.volume_liters || 0),
          }))
        : [];

      setHistoryData(formatted);
    } catch (error) {
      console.error("History error:", error);
    }
  };

  const getAlerts = async () => {
    try {
      const response = await fetch(
        API_BASE_URL + "/api/tanks/" + TANK_ID + "/alerts"
      );

      if (!response.ok) {
        throw new Error("Alerts API failed");
      }

      const data = await response.json();

      setAlerts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Alerts error:", error);
    }
  };

  const getStatus = async () => {
    try {
      const response = await fetch(
        API_BASE_URL + "/api/tanks/" + TANK_ID + "/status"
      );

      if (!response.ok) {
        throw new Error("Status API failed");
      }

      const data = await response.json();

      setSensorStatus(data.status || "offline");
    } catch (error) {
      console.error("Status error:", error);
      setSensorStatus("offline");
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        getLatest(),
        getHistory(),
        getAlerts(),
        getStatus(),
      ]);

      setLoading(false);
    };

    loadData();

    const interval = setInterval(() => {
      getLatest();
      getHistory();
      getAlerts();
      getStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedRange]);

  const level = Math.max(0, Math.min(100, tankLevel));
  const currentVolume = Math.max(0, volume);
  const availableVolume = Math.max(0, TANK_CAPACITY - currentVolume);

  const activeAlerts = alerts.filter(
    (alert) => alert.status === "active"
  );

  const systemOnline = sensorStatus === "online";

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>RO Plant Monitor</h1>
          <p>Smart Water Tank Monitoring System</p>
        </div>

        <div className="system-status">
          <span
            className={
              systemOnline ? "status-dot online" : "status-dot offline"
            }
          ></span>

          <span>
            System {systemOnline ? "Online" : "Offline"}
          </span>
        </div>
      </header>

      <main className="dashboard">
        <section className="cards">
          <div className="card tank-card">
            <div className="card-title">Tank Level</div>

            <div className="level-value">
              {loading ? "..." : level.toFixed(1) + "%"}
            </div>

            <div className="progress-container">
              <div
                className="progress-bar"
                style={{ width: level + "%" }}
              ></div>
            </div>

            <div className="card-subtitle">
              Tank capacity: {TANK_CAPACITY} L
            </div>
          </div>

          <div className="card">
            <div className="card-title">Available Water</div>

            <div className="big-value">
              {loading ? "..." : currentVolume.toFixed(1) + " L"}
            </div>

            <div className="card-subtitle">
              Current water volume
            </div>
          </div>

          <div className="card">
            <div className="card-title">Remaining Capacity</div>

            <div className="big-value">
              {loading ? "..." : availableVolume.toFixed(1) + " L"}
            </div>

            <div className="card-subtitle">
              Space remaining in tank
            </div>
          </div>

          <div className="card">
            <div className="card-title">Sensor Status</div>

            <div
              className={
                systemOnline
                  ? "big-value status-online"
                  : "big-value status-offline"
              }
            >
              {systemOnline ? "ONLINE" : "OFFLINE"}
            </div>

            <div className="card-subtitle">
              ESP32 ultrasonic sensor
            </div>
          </div>
        </section>

        <section className="main-grid">
          <div className="panel chart-panel">
            <div className="panel-header">
              <div>
                <h2>Tank Level History</h2>
                <p>Live tank level monitoring</p>
              </div>

              <div className="range-buttons">
                <button
                  className={selectedRange === "1h" ? "active" : ""}
                  onClick={() => setSelectedRange("1h")}
                >
                  1H
                </button>

                <button
                  className={selectedRange === "6h" ? "active" : ""}
                  onClick={() => setSelectedRange("6h")}
                >
                  6H
                </button>

                <button
                  className={selectedRange === "24h" ? "active" : ""}
                  onClick={() => setSelectedRange("24h")}
                >
                  24H
                </button>
              </div>
            </div>

            <div className="chart">
              {historyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData}>
                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis dataKey="time" />

                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(value) => value + "%"}
                    />

                    <Tooltip
                      formatter={(value) => [
                        Number(value).toFixed(1) + "%",
                        "Level",
                      ]}
                    />

                    <Line
                      type="monotone"
                      dataKey="level"
                      strokeWidth={3}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty">
                  Waiting for telemetry data...
                </div>
              )}
            </div>
          </div>

          <div className="panel tank-info">
            <h2>Tank Information</h2>

            <div className="info-row">
              <span>Tank ID</span>
              <strong>{TANK_ID}</strong>
            </div>

            <div className="info-row">
              <span>Capacity</span>
              <strong>{TANK_CAPACITY} L</strong>
            </div>

            <div className="info-row">
              <span>Water Height</span>
              <strong>{distance.toFixed(2)} cm</strong>
            </div>

            <div className="info-row">
              <span>Level</span>
              <strong>{level.toFixed(1)}%</strong>
            </div>

            <div className="info-row">
              <span>Volume</span>
              <strong>{currentVolume.toFixed(1)} L</strong>
            </div>
          </div>
        </section>

        <section className="panel alerts-panel">
          <div className="panel-header">
            <div>
              <h2>Alerts</h2>
              <p>Tank monitoring alerts</p>
            </div>

            <div className="alert-count">
              {activeAlerts.length} Active
            </div>
          </div>

          {activeAlerts.length > 0 ? (
            <div className="alerts-list">
              {activeAlerts.map((alert) => (
                <div className="alert-item" key={alert.id}>
                  <div>
                    <strong>{alert.alert_type}</strong>

                    <p>
                      Tank level:{" "}
                      {Number(alert.level_percent || 0).toFixed(1)}%
                    </p>
                  </div>

                  <span className="alert-active">ACTIVE</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-alerts">
              ✓ No active alerts
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Alert History</h2>
              <p>Previously generated alerts</p>
            </div>
          </div>

          {alerts.length > 0 ? (
            <div className="alerts-list">
              {alerts.map((alert) => (
                <div className="alert-item" key={alert.id}>
                  <div>
                    <strong>{alert.alert_type}</strong>

                    <p>
                      {new Date(
                        alert.created_at
                      ).toLocaleString()}
                    </p>
                  </div>

                  <span
                    className={
                      alert.status === "active"
                        ? "alert-active"
                        : "alert-resolved"
                    }
                  >
                    {String(alert.status).toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-alerts">
              No alert history available.
            </div>
          )}
        </section>
      </main>

      <footer>
        RO Plant Digital Twin • ESP32 + MQTT + FastAPI + PostgreSQL
      </footer>
    </div>
  );
}

export default App;

