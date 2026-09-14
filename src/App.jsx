import { useEffect, useState, useRef } from "react";
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

// Maximum points shown on the live sliding tremor graph
const MAX_TREMOR_POINTS = 30;

const RANGE_OPTIONS = [
  { label: "15 min", value: "15m" },
  { label: "1 hour", value: "1h" },
  { label: "6 hours", value: "6h" },
  { label: "24 hours", value: "24h" },
  { label: "7 days", value: "7d" },
];

// Helper to correctly parse ISO UTC timestamps from backend database
function parseTimestamp(dateStr) {
  if (!dateStr) return new Date();
  if (typeof dateStr === "string") {
    let s = dateStr.trim();
    // If backend returns UTC ISO string without explicit 'Z' or timezone offset, append 'Z'
    if (!s.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(s) && !/[+-]\d{4}$/.test(s)) {
      s = s.replace(" ", "T") + "Z";
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatTimeOnly(dateStr) {
  if (!dateStr) return "";
  const d = parseTimestamp(dateStr);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const d = parseTimestamp(dateStr);
  return d.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="ecg-tooltip">
        <div className="ecg-tooltip-time">⏱️ {data.fullTime || data.time}</div>
        <div className="ecg-tooltip-level">
          💧 Level: <strong>{Number(data.level).toFixed(1)}%</strong>
        </div>
        <div className="ecg-tooltip-volume">
          📦 Volume: <strong>{Number(data.volume).toFixed(1)} L</strong>
        </div>
      </div>
    );
  }
  return null;
}

function App() {
  const [tankLevel, setTankLevel] = useState(92);
  const [volume, setVolume] = useState(1840.6);
  const [distance, setDistance] = useState(0);
  const [historyData, setHistoryData] = useState([]);
  const [selectedRange, setSelectedRange] = useState("15m");
  const [alerts, setAlerts] = useState([]);
  const [sensorStatus, setSensorStatus] = useState("online");
  const [loading, setLoading] = useState(true);
  const [lastUpdatedTime, setLastUpdatedTime] = useState("");

  const latestDataRef = useRef({ level: 92, volume: 1840.6 });

  const getLatest = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tanks/${TANK_ID}/latest`
      );
      if (!response.ok) throw new Error("Latest API failed");
      const data = await response.json();

      if (data && typeof data.level_percent !== "undefined") {
        const lvl = Number(data.level_percent || 0);
        const vol = Number(data.volume_liters || 0);
        const dist = Number(data.distance_cm || 0);
        const recordedTime = data.recorded_at;

        if (lvl > 0 || vol > 0) {
          setTankLevel(lvl);
          setVolume(vol);
          setDistance(dist);
          latestDataRef.current = { level: lvl, volume: vol };
        }
        if (recordedTime) {
          setLastUpdatedTime(formatDateTime(recordedTime));
        }

        // Tremor graph live scrolling effect: append new point to right, shift timeline & wave left
        if (recordedTime && (lvl > 0 || vol > 0)) {
          const formattedTime = formatTimeOnly(recordedTime);
          const fullTime = formatDateTime(recordedTime);

          setHistoryData((prevData) => {
            if (prevData.length === 0) return prevData;
            const lastPoint = prevData[prevData.length - 1];

            // Don't add duplicate if timestamp matches exactly
            if (lastPoint && lastPoint.fullTime === fullTime) {
              return prevData;
            }

            const newPoint = {
              time: formattedTime,
              fullTime: fullTime,
              level: lvl,
              volume: vol,
              rawTime: parseTimestamp(recordedTime).getTime(),
            };

            // Shift timeline & values left together by dropping oldest item from start
            const updated = [...prevData, newPoint];
            return updated.slice(-MAX_TREMOR_POINTS);
          });
        }
      }
    } catch (error) {
      console.error("Latest data error:", error);
    }
  };

  const getHistory = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tanks/${TANK_ID}/history?range=${selectedRange}`
      );
      if (!response.ok) throw new Error("History API failed");
      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        // Sort items by timestamp ascending (oldest left -> newest right)
        const sorted = [...data].sort((a, b) => {
          const tA = parseTimestamp(a.recorded_at || a.time).getTime();
          const tB = parseTimestamp(b.recorded_at || b.time).getTime();
          return tA - tB;
        });

        const formatted = sorted.map((item) => {
          const rawTime = item.recorded_at || item.time;
          return {
            time: formatTimeOnly(rawTime),
            fullTime: formatDateTime(rawTime),
            level: Number(item.level_percent ?? item.level ?? 0),
            volume: Number(item.volume_liters ?? item.volume ?? 0),
            rawTime: parseTimestamp(rawTime).getTime(),
          };
        });

        // Limit initial points so tremor movement is crisp and clear
        const sliced = formatted.slice(-MAX_TREMOR_POINTS);
        setHistoryData(sliced);

        // Update latest tank stats from last non-zero history point if needed
        const validPoints = formatted.filter((d) => d.level > 0 || d.volume > 0);
        if (validPoints.length > 0) {
          const lastValid = validPoints[validPoints.length - 1];
          setTankLevel((prev) => (prev === 0 || prev === 92 ? lastValid.level : prev));
          setVolume((prev) => (prev === 0 || prev === 1840.6 ? lastValid.volume : prev));
          setLastUpdatedTime(lastValid.fullTime);
          latestDataRef.current = { level: lastValid.level, volume: lastValid.volume };
        }
      }
    } catch (error) {
      console.error("History error:", error);
    }
  };

  const getAlerts = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tanks/${TANK_ID}/alerts`
      );
      if (!response.ok) throw new Error("Alerts API failed");
      const data = await response.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Alerts error:", error);
    }
  };

  const getStatus = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tanks/${TANK_ID}/status`
      );
      if (!response.ok) throw new Error("Status API failed");
      const data = await response.json();
      setSensorStatus(data.status || "offline");
    } catch (error) {
      console.error("Status error:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        getHistory(),
        getLatest(),
        getAlerts(),
        getStatus(),
      ]);
      setLoading(false);
    };

    loadData();

    // Fast 2-second interval for active streaming tremor graph shift
    const interval = setInterval(() => {
      getLatest();
      getHistory();
      getAlerts();
      getStatus();
    }, 2000);

    return () => clearInterval(interval);
  }, [selectedRange]);

  const level = Math.max(0, Math.min(100, tankLevel));
  const currentVolume = Math.max(0, volume);
  const availableVolume = Math.max(0, TANK_CAPACITY - currentVolume);
  const availableLevel = Math.max(0, 100 - level);

  const activeAlerts = alerts.filter(
    (alert) => String(alert.status).toLowerCase() === "active"
  );
  const systemOnline = sensorStatus === "online";

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="header-title-container">
            <span className="droplet-icon">💧</span>
            <h1 className="header-title">RO Plant Dashboard</h1>
          </div>
          <p className="header-subtitle">
            Tank Monitoring System {lastUpdatedTime ? `· Last sync: ${lastUpdatedTime}` : ""}
          </p>
        </div>

        <div className="header-right">
          <div className="system-status-indicator">
            <span
              className={`status-dot ${
                systemOnline ? "dot-online" : "dot-offline"
              }`}
            ></span>
            <span className={`status-text ${systemOnline ? "text-online" : "text-offline"}`}>
              System {systemOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-content">
        {/* Top 4 Stat Cards */}
        <section className="top-cards-grid">
          {/* Card 1: Tank Level */}
          <div className="stat-card">
            <div className="stat-card-title">Tank Level</div>
            <div className="stat-card-value text-cyan">
              {loading ? "..." : `${level % 1 === 0 ? level : level.toFixed(1)}%`}
            </div>
            <div className="stat-card-subtitle">Current water level</div>
            <div className="card-pill-glow"></div>
          </div>

          {/* Card 2: Water Volume */}
          <div className="stat-card">
            <div className="stat-card-title">Water Volume</div>
            <div className="stat-card-value text-cyan">
              {loading ? "..." : `${currentVolume.toFixed(1)} L`}
            </div>
            <div className="stat-card-subtitle">
              of {TANK_CAPACITY} L capacity
            </div>
            <div className="card-pill-glow"></div>
          </div>

          {/* Card 3: Sensor */}
          <div className="stat-card">
            <div className="stat-card-title">Sensor</div>
            <div
              className={`stat-card-value ${
                systemOnline ? "text-green" : "text-red"
              }`}
            >
              {systemOnline ? "Online" : "Offline"}
            </div>
            <div className="stat-card-subtitle">Ultrasonic sensor</div>
            <div className="card-pill-glow"></div>
          </div>

          {/* Card 4: Tank */}
          <div className="stat-card">
            <div className="stat-card-title">Tank</div>
            <div className="stat-card-value text-white">{TANK_ID === "tank_01" ? "Tank 01" : TANK_ID}</div>
            <div className="stat-card-subtitle">RO purified water</div>
            <div className="card-pill-glow"></div>
          </div>
        </section>

        {/* Section: Water Level History (Streaming Tremor Waveform) */}
        <section className="dashboard-panel history-panel ecg-card">
          <div className="panel-header-centered">
            <div className="panel-title-with-icon">
              <span className="droplet-icon-small">💧</span>
              <h2>Water Level History</h2>
              <span className="live-ecg-badge">TREMOR GRAPH</span>
            </div>
            <p className="panel-subtitle">
              Tank 01 · Streaming live waveform & real-time sliding timeline
            </p>

            <div className="range-selector">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`range-pill ${
                    selectedRange === opt.value ? "pill-active" : ""
                  }`}
                  onClick={() => setSelectedRange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="chart-container ecg-chart-wrapper">
            {historyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={340}>
                <LineChart
                  data={historyData}
                  margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1c2d54"
                    vertical={true}
                  />
                  <XAxis
                    dataKey="time"
                    stroke="#475569"
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    stroke="#475569"
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    tickFormatter={(val) => `${val}%`}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="level"
                    stroke="#38bdf8"
                    strokeWidth={2.8}
                    dot={false}
                    isAnimationActive={true}
                    animationDuration={400}
                    animationEasing="ease-in-out"
                    activeDot={{
                      r: 7,
                      fill: "#00f0ff",
                      stroke: "#050a17",
                      strokeWidth: 2,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="no-data-placeholder">
                Streaming live tremor waveform...
              </div>
            )}
          </div>
        </section>

        {/* Section: Tank Information */}
        <section className="dashboard-panel info-panel">
          <h2 className="panel-title-centered">Tank Information</h2>

          <div className="tank-info-grid">
            <div className="info-box">
              <span className="info-box-label">Tank ID</span>
              <strong className="info-box-value">tank_01</strong>
            </div>

            <div className="info-box">
              <span className="info-box-label">Capacity</span>
              <strong className="info-box-value">{TANK_CAPACITY} L</strong>
            </div>

            <div className="info-box">
              <span className="info-box-label">Available Level</span>
              <strong className="info-box-value">{availableLevel.toFixed(1)}%</strong>
            </div>

            <div className="info-box">
              <span className="info-box-label">Available Volume</span>
              <strong className="info-box-value">{availableVolume.toFixed(1)} L</strong>
            </div>
          </div>
        </section>

        {/* Section: Alerts & Active Alert Banner */}
        <section className="dashboard-panel alerts-panel">
          <div className="panel-header-centered">
            <div className="panel-title-with-icon">
              <span className="alert-icon-header">🚨</span>
              <h2>Alerts</h2>
            </div>
            <p className="panel-subtitle">Tank 01 · Monitoring alerts</p>
          </div>

          {/* Active Alert Banner */}
          {activeAlerts.length > 0 ? (
            <div className="active-alerts-container">
              {activeAlerts.map((alert) => (
                <div key={alert.id} className="active-alert-box">
                  <div className="alert-left-icon">⚠️</div>
                  <div className="alert-body">
                    <div className="alert-type-title">
                      {alert.alert_type ? alert.alert_type.replace("_", " ") : "LOW WATER"}
                    </div>
                    <div className="alert-description">
                      Tank level is {Number(alert.level_percent || 0).toFixed(1)}% ({Number(alert.volume_liters || 0).toFixed(1)} L)
                    </div>
                    <div className="alert-timestamp">
                      Active since {formatDateTime(alert.created_at)}
                    </div>
                  </div>
                  <div className="alert-badge-active">ACTIVE</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-active-alert-box">
              <span className="check-icon">✓</span>
              <span>No active alerts for Tank 01</span>
            </div>
          )}

          {/* Alert History Section */}
          <div className="alert-history-section">
            <h3 className="alert-history-title">Alert History</h3>

            {alerts.length > 0 ? (
              <div className="alert-history-list">
                {alerts.map((alert) => {
                  const isActive = String(alert.status).toLowerCase() === "active";
                  return (
                    <div key={alert.id} className="alert-history-row">
                      <div className="alert-row-col-main">
                        <span className="alert-row-type">
                          {alert.alert_type || "LOW_WATER"}
                        </span>
                        <span className="alert-row-time">
                          {formatDateTime(alert.created_at)}
                        </span>
                      </div>

                      <div className="alert-row-col">
                        <span className="alert-row-val">
                          {Number(alert.level_percent || 0).toFixed(1)}%
                        </span>
                      </div>

                      <div className="alert-row-col">
                        <span className="alert-row-val">
                          {Number(alert.volume_liters || 0).toFixed(1)} L
                        </span>
                      </div>

                      <div className="alert-row-col-status">
                        <span
                          className={`alert-status-text ${
                            isActive ? "status-text-active" : "status-text-resolved"
                          }`}
                        >
                          {isActive ? "ACTIVE" : "RESOLVED"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-alert-history">
                No alert history available.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
