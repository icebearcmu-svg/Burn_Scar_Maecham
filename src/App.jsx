import { useEffect, useState } from 'react';
import { GeoJSON, MapContainer, Pane, ScaleControl, TileLayer, useMap } from 'react-leaflet';
import parseGeoraster from 'georaster';
import GeoRasterLayer from 'georaster-layer-for-leaflet';
import shp from 'shpjs';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

import {
  appConfig,
  finalBurnScarOutline,
  forestTypeLayer,
  landUseLayer,
  recoveryLayers,
  severityLayer,
  studyBoundary,
  tambonBoundary,
} from './dataConfig';

function normalizeShapefileResult(result) {
  if (Array.isArray(result)) {
    return {
      type: 'FeatureCollection',
      features: result.flatMap((item) => item.features || []),
    };
  }

  return result;
}

function parseCsv(text) {
  const rows = text.trim().split(/\r?\n/).map((line) => line.split(','));
  const [headers, ...records] = rows;

  return records.filter((record) => record.length === headers.length).map(
    (record) => Object.fromEntries(
      headers.map((header, index) => [header, record[index]]),
    ),
  );
}

function formatNumber(value, digits = 2) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return '–';

  return numericValue.toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

const recoveryLevelThai = {
  'Very poor': 'ต่ำมาก',
  Poor: 'ต่ำ',
  Moderate: 'ปานกลาง',
  Good: 'ดี',
  'Very good': 'ดีมาก',
  Excellent: 'ดีเยี่ยม',
};

const severityThai = {
  Low: 'ต่ำ',
  'Moderate-low': 'ปานกลาง-ต่ำ',
  'Moderate-high': 'ปานกลาง-สูง',
  High: 'สูง',
};

function translateRecoveryLevel(value) {
  return recoveryLevelThai[value] || value || '–';
}

function translateSeverity(value) {
  return severityThai[value] || value || '–';
}

function NorthArrow() {
  const map = useMap();

  useEffect(() => {
    const northArrow = L.control({ position: 'topright' });

    northArrow.onAdd = () => {
      const container = L.DomUtil.create('div', 'north-arrow-control');
      container.setAttribute('role', 'img');
      container.setAttribute('aria-label', 'North arrow');
      container.innerHTML = '<span aria-hidden="true">▲</span><strong>N</strong>';
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);
      return container;
    };

    northArrow.addTo(map);
    return () => northArrow.remove();
  }, [map]);

  return null;
}

function VectorBoundary({
  layerConfig,
  isVisible,
  onError,
  fitMap = false,
  showTambonNames = false,
  showPersistentTambonNames = false,
}) {
  const map = useMap();
  const [boundaryData, setBoundaryData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    if (!isVisible) {
      setBoundaryData(null);
      return undefined;
    }

    async function loadBoundary() {
      try {
        const result = await shp(layerConfig.fileUrl);

        if (!cancelled) {
          setBoundaryData(normalizeShapefileResult(result));
        }
      } catch (error) {
        console.error(error);
        onError(`ไม่สามารถเปิดไฟล์ ${layerConfig.name} ได้`);
      }
    }

    loadBoundary();

    return () => {
      cancelled = true;
    };
  }, [isVisible, layerConfig, onError]);

  useEffect(() => {
    if (fitMap && boundaryData) {
      const boundsLayer = L.geoJSON(boundaryData);

      map.fitBounds(boundsLayer.getBounds(), {
        padding: [24, 24],
      });
    }
  }, [boundaryData, fitMap, map]);

  if (!boundaryData) return null;

  function addTambonName(feature, leafletLayer) {
    const tambonName = feature?.properties?.TAMBON;

    if (!tambonName) return;

    const label = `ตำบล${tambonName}`;

    leafletLayer.bindTooltip(label, {
      sticky: !showPersistentTambonNames,
      permanent: showPersistentTambonNames,
      direction: showPersistentTambonNames ? 'center' : 'top',
      className: showPersistentTambonNames ? 'tambon-label' : 'tambon-tooltip',
    });
    leafletLayer.bindPopup(`<strong>${label}</strong><br/>อำเภอ${feature.properties.AMPHUR || 'แม่แจ่ม'}<br/>จังหวัด${feature.properties.PROVINCE || 'เชียงใหม่'}`);
    leafletLayer.on({
      mouseover: (event) => event.target.setStyle({
        color: '#114c35',
        weight: 2.5,
        fillColor: '#d7f0df',
        fillOpacity: 0.18,
      }),
      mouseout: (event) => event.target.setStyle(layerConfig.style),
    });
  }

  return (
    <GeoJSON
      key={`boundary-${layerConfig.id}-${showPersistentTambonNames}`}
      data={boundaryData}
      pane="boundaryPane"
      style={() => layerConfig.style}
      interactive={showTambonNames}
      onEachFeature={showTambonNames ? addTambonName : undefined}
    />
  );
}

function BurnScarOutline({ layerConfig, isVisible, onError }) {
  const [outlineData, setOutlineData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    if (!isVisible) {
      setOutlineData(null);
      return undefined;
    }

    async function loadOutline() {
      try {
        const response = await fetch(layerConfig.fileUrl);

        if (!response.ok) {
          throw new Error(`Cannot load: ${layerConfig.fileUrl}`);
        }

        const result = await response.json();

        if (!cancelled) {
          setOutlineData(result);
        }
      } catch (error) {
        console.error(error);
        onError(`ไม่สามารถเปิดไฟล์ ${layerConfig.name} ได้`);
      }
    }

    loadOutline();

    return () => {
      cancelled = true;
    };
  }, [isVisible, layerConfig, onError]);

  if (!outlineData) return null;

  return (
    <GeoJSON
      data={outlineData}
      pane="burnScarOutlinePane"
      style={() => layerConfig.style}
      interactive={false}
    />
  );
}

function ForestTypeVector({ layerConfig, isVisible, onError }) {
  const [forestData, setForestData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    if (!isVisible) {
      setForestData(null);
      return undefined;
    }

    async function loadForestType() {
      try {
        const result = await shp(layerConfig.fileUrl);

        if (!cancelled) {
          setForestData(normalizeShapefileResult(result));
        }
      } catch (error) {
        console.error(error);
        onError(`ไม่สามารถเปิดไฟล์ ${layerConfig.name} ได้`);
      }
    }

    loadForestType();

    return () => {
      cancelled = true;
    };
  }, [isVisible, layerConfig, onError]);

  if (!forestData) return null;

  const colorByClass = Object.fromEntries(
    layerConfig.classes.map((item) => [item.value, item.color]),
  );

  const labelByClass = Object.fromEntries(
    layerConfig.classes.map((item) => [item.value, item.label]),
  );

  function styleForestFeature(feature) {
    const classId = Number(feature.properties[layerConfig.classField]);

    return {
      color: '#ffffff',
      weight: 0.25,
      fillColor: colorByClass[classId] || '#cccccc',
      fillOpacity: 0.68,
    };
  }

  function addForestPopup(feature, layer) {
    const classId = Number(feature.properties[layerConfig.classField]);
    const forestName = labelByClass[classId] || feature.properties.TYPE_ENG;

    layer.bindPopup(
      `<strong>ประเภทป่าไม้</strong><br>${forestName}<br>รหัสชั้นข้อมูล: ${classId}`,
    );
  }

  return (
    <GeoJSON
      data={forestData}
      pane="forestTypePane"
      style={styleForestFeature}
      onEachFeature={addForestPopup}
    />
  );
}

function LandUseVector({ layerConfig, isVisible, onError }) {
  const [landUseData, setLandUseData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    if (!isVisible) {
      setLandUseData(null);
      return undefined;
    }

    async function loadLandUse() {
      try {
        const result = await shp(layerConfig.fileUrl);

        if (!cancelled) {
          setLandUseData(normalizeShapefileResult(result));
        }
      } catch (error) {
        console.error(error);
        onError(`ไม่สามารถเปิดไฟล์ ${layerConfig.name} ได้`);
      }
    }

    loadLandUse();

    return () => {
      cancelled = true;
    };
  }, [isVisible, layerConfig, onError]);

  if (!landUseData) return null;

  const colorByClass = Object.fromEntries(
    layerConfig.classes.map((item) => [item.value, item.color]),
  );

  function styleLandUseFeature(feature) {
    const classCode = feature.properties[layerConfig.classField];

    return {
      color: '#ffffff',
      weight: 0.12,
      fillColor: colorByClass[classCode] || '#cccccc',
      // Keep class colours identical to the Land Use legend for report maps.
      fillOpacity: 1,
    };
  }

  function addLandUsePopup(feature, layer) {
    const { LU_DES_EN: englishName, LU_DES_TH: thaiName, LU_CODE: code } = feature.properties;

    layer.bindPopup(
      `<strong>การใช้ประโยชน์ที่ดิน</strong><br>${thaiName || englishName || 'ไม่ระบุ'}<br>รหัส: ${code || '–'}`,
    );
  }

  return (
    <GeoJSON
      data={landUseData}
      pane="landUsePane"
      style={styleLandUseFeature}
      onEachFeature={addLandUsePopup}
    />
  );
}

function ClassRaster({ layerConfig, isVisible, onError, pane }) {
  const map = useMap();

  useEffect(() => {
    if (!isVisible) return undefined;

    let rasterLayer;
    let cancelled = false;

    async function loadRaster() {
      try {
        const response = await fetch(layerConfig.fileUrl);

        if (!response.ok) {
          throw new Error(`Cannot load: ${layerConfig.fileUrl}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const georaster = await parseGeoraster(arrayBuffer);

        if (cancelled) return;

        const colorByClass = Object.fromEntries(
          layerConfig.classes.map((item) => [item.value, item.color]),
        );

        rasterLayer = new GeoRasterLayer({
          georaster,
          opacity: layerConfig.opacity ?? 0.82,
          pane,
          resolution: 256,
          pixelValuesToColorFn: (values) => {
            const classValue = Number(values[0]);
            return classValue === 0 ? null : colorByClass[classValue] || null;
          },
        });

        rasterLayer.addTo(map);
      } catch (error) {
        console.error(error);
        onError(`ไม่สามารถเปิดไฟล์ ${layerConfig.name} ได้`);
      }
    }

    loadRaster();

    return () => {
      cancelled = true;

      if (rasterLayer) {
        map.removeLayer(rasterLayer);
      }
    };
  }, [isVisible, layerConfig, map, onError, pane]);

  return null;
}

function LayerLegend({ title, classes }) {
  return (
    <section className="legend-section">
      <h2>{title}</h2>

      <div className="legend">
        {classes.map((item) => (
          <div className="legend-row" key={item.value}>
            <span
              className="legend-color"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function LineChart({ title, data, series, suffix = '' }) {
  if (!data.length) return null;

  const width = 680;
  const height = 270;
  const padding = { top: 28, right: 28, bottom: 45, left: 54 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const values = data.flatMap((row) => series.map((item) => Number(row[item.key])));
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const paddingValue = Math.max((maximum - minimum) * 0.15, 0.02);
  const lowerBound = minimum - paddingValue;
  const upperBound = maximum + paddingValue;
  const valueRange = upperBound - lowerBound || 1;
  const ticks = Array.from({ length: 5 }, (_, index) => (
    lowerBound + ((upperBound - lowerBound) * index) / 4
  ));

  const xAt = (index) => (
    padding.left + (data.length === 1 ? chartWidth / 2 : (chartWidth * index) / (data.length - 1))
  );
  const yAt = (value) => (
    padding.top + chartHeight - ((Number(value) - lowerBound) / valueRange) * chartHeight
  );

  return (
    <article className="chart-card">
      <h3>{title}</h3>

      <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        {ticks.map((tick) => {
          const y = yAt(tick);

          return (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                className="chart-grid-line"
              />
              <text x={padding.left - 8} y={y + 4} className="chart-axis-label" textAnchor="end">
                {formatNumber(tick, suffix === '%' ? 0 : 2)}{suffix}
              </text>
            </g>
          );
        })}

        {data.map((row, index) => (
          <text
            key={row['Year (B.E.)']}
            x={xAt(index)}
            y={height - 16}
            className="chart-axis-label"
            textAnchor="middle"
          >
            {row['Year (B.E.)']}
          </text>
        ))}

        {series.map((item) => {
          const points = data.map((row, index) => `${xAt(index)},${yAt(row[item.key])}`).join(' ');

          return (
            <g key={item.key}>
              <polyline
                points={points}
                className="chart-line"
                stroke={item.color}
              />
              {data.map((row, index) => (
                <circle
                  key={`${item.key}-${row['Year (B.E.)']}`}
                  cx={xAt(index)}
                  cy={yAt(row[item.key])}
                  r="4"
                  fill={item.color}
                />
              ))}
            </g>
          );
        })}
      </svg>

      <div className="chart-key">
        {series.map((item) => (
          <span key={item.key}>
            <i style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </article>
  );
}

function RecoveryDashboard({ annual, severity, classAreas, errorMessage }) {
  const latestYear = '2568';
  const latestClassAreas = classAreas.filter((row) => row['Year (B.E.)'] === latestYear);

  return (
    <section className="dashboard">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow dark-eyebrow">ผลการฟื้นตัวจาก Model B รอบสุดท้าย</p>
          <h2>สรุปและแนวโน้มการฟื้นตัว</h2>
        </div>
        <span>ช่วงติดตาม: 2563–2568</span>
      </div>

      {errorMessage && <p className="dashboard-error">{errorMessage}</p>}

      <div className="chart-grid">
        <LineChart
          title="ค่าเฉลี่ย BRR รายปีที่ติดตาม"
          data={annual}
          series={[{ key: 'Mean BRR (%)', label: 'BRR เฉลี่ย', color: '#1565c0' }]}
          suffix="%"
        />
        <LineChart
          title="แนวโน้ม NDVI และ NBR รายปีที่ติดตาม"
          data={annual}
          series={[
            { key: 'Mean NDVI', label: 'NDVI เฉลี่ย', color: '#2e7d32' },
            { key: 'Mean NBR', label: 'NBR เฉลี่ย', color: '#6d4c41' },
          ]}
        />
      </div>

      <div className="table-grid">
        <article className="table-card">
          <h3>การฟื้นตัวรายปี</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ปี (พ.ศ.)</th>
                  <th>NDVI</th>
                  <th>NBR</th>
                  <th>BRR</th>
                  <th>ระดับการฟื้นตัว</th>
                </tr>
              </thead>
              <tbody>
                {annual.map((row) => (
                  <tr key={row['Year (B.E.)']}>
                    <td>{row['Year (B.E.)']}</td>
                    <td>{formatNumber(row['Mean NDVI'])}</td>
                    <td>{formatNumber(row['Mean NBR'])}</td>
                    <td>{formatNumber(row['Mean BRR (%)'])}%</td>
                    <td>{translateRecoveryLevel(row['Recovery level'])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="table-card">
          <h3>ค่าเฉลี่ย BRR ปี 2568 จำแนกตามระดับ dNBR</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ระดับความรุนแรง</th>
                  <th>พื้นที่ (ไร่)</th>
                  <th>BRR เฉลี่ย</th>
                  <th>ระดับการฟื้นตัว</th>
                </tr>
              </thead>
              <tbody>
                {severity.map((row) => (
                  <tr key={row['Severity code']}>
                    <td>{translateSeverity(row['dNBR severity'])}</td>
                    <td>{formatNumber(row['Area (rai)'])}</td>
                    <td>{formatNumber(row['Mean BRR (%) in 2568'])}%</td>
                    <td>{translateRecoveryLevel(row['Recovery level'])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="table-card">
          <h3>พื้นที่ตามชั้นการฟื้นตัว ปี 2568</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ชั้นการฟื้นตัว</th>
                  <th>พื้นที่ (ไร่)</th>
                  <th>ร้อยละ</th>
                </tr>
              </thead>
              <tbody>
                {latestClassAreas.map((row) => (
                  <tr key={row['Recovery code']}>
                    <td>{translateRecoveryLevel(row['Recovery level'])}</td>
                    <td>{formatNumber(row['Area (rai)'])}</td>
                    <td>{formatNumber(row['Percent of Model B forest burn scar'])}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}

const baseMaps = {
  light: {
    label: 'พื้นหลังสีอ่อน',
    url: null,
    attribution: '',
  },
  streets: {
    label: 'แผนที่ถนน (OpenStreetMap)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  darkGray: {
    label: 'แผนที่พื้นหลังสีเทาเข้ม',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
  satellite: {
    label: 'ภาพถ่ายดาวเทียม',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
};

function App() {
  const [showBoundary, setShowBoundary] = useState(studyBoundary.visible);
  const [showTambon, setShowTambon] = useState(tambonBoundary.visible);
  const [showTambonLabels, setShowTambonLabels] = useState(false);
  const [showBurnScarOutline, setShowBurnScarOutline] = useState(
    finalBurnScarOutline.visible,
  );
  const [showForestType, setShowForestType] = useState(forestTypeLayer.visible);
  const [showLandUse, setShowLandUse] = useState(landUseLayer.visible);
  const [showSeverity, setShowSeverity] = useState(severityLayer.visible);
  const [selectedRecoveryLayerId, setSelectedRecoveryLayerId] = useState(null);
  const [baseMapId, setBaseMapId] = useState('light');
  const [errorMessage, setErrorMessage] = useState('');
  const [dashboardData, setDashboardData] = useState({
    annual: [],
    severity: [],
    classAreas: [],
    error: '',
  });

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardData() {
      try {
        async function loadCsv(url) {
          const response = await fetch(url);

          if (!response.ok) throw new Error(`Cannot load: ${url}`);
          return parseCsv(await response.text());
        }

        const [annual, severity, classAreas] = await Promise.all([
          // These files are direct exports from the confirmed final Model B Cell 14 run.
          loadCsv('/data/annual_recovery_ModelB_FINAL.csv'),
          loadCsv('/data/brr_2568_by_severity_ModelB_FINAL.csv'),
          loadCsv('/data/recovery_class_area_2563_2568_ModelB_FINAL.csv'),
        ]);

        if (!cancelled) {
          setDashboardData({ annual, severity, classAreas, error: '' });
        }
      } catch (error) {
        console.error(error);

        if (!cancelled) {
          setDashboardData((current) => ({
            ...current,
            error: 'ไม่สามารถอ่านตาราง recovery ที่ export ไว้ได้',
          }));
        }
      }
    }

    loadDashboardData();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleRecoveryLayerToggle(layerId, isChecked) {
    setSelectedRecoveryLayerId(isChecked ? layerId : null);

    if (isChecked) {
      setShowSeverity(false);
      setShowBurnScarOutline(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">ระบบแสดงผลการวิเคราะห์เชิงพื้นที่</p>
          <h1>{appConfig.title}</h1>
        </div>
        <span className="status-badge">ข้อมูลในเครื่อง</span>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <h2>ชั้นข้อมูล</h2>

          <label className="basemap-picker">
            <span>แผนที่ฐาน</span>
            <select
              value={baseMapId}
              onChange={(event) => setBaseMapId(event.target.value)}
            >
              {Object.entries(baseMaps).map(([id, baseMap]) => (
                <option value={id} key={id}>{baseMap.label}</option>
              ))}
            </select>
          </label>

          <label className="layer-toggle">
            <input
              type="checkbox"
              checked={showBoundary}
              onChange={(event) => setShowBoundary(event.target.checked)}
            />
            <span>{studyBoundary.name}</span>
          </label>

          <label className="layer-toggle">
            <input
              type="checkbox"
              checked={showTambon}
              onChange={(event) => setShowTambon(event.target.checked)}
            />
            <span>{tambonBoundary.name}</span>
          </label>
          <p className="layer-help">ชี้หรือคลิกในขอบเขตตำบลเพื่อดูชื่อตำบล</p>
          <label className="layer-toggle sub-layer-toggle">
            <input
              type="checkbox"
              checked={showTambonLabels}
              disabled={!showTambon}
              onChange={(event) => setShowTambonLabels(event.target.checked)}
            />
            <span>แสดงชื่อตำบลบนแผนที่</span>
          </label>

          <label className="layer-toggle">
            <input
              type="checkbox"
              checked={showForestType}
              onChange={(event) => setShowForestType(event.target.checked)}
            />
            <span>{forestTypeLayer.name}</span>
          </label>

          <label className="layer-toggle">
            <input
              type="checkbox"
              checked={showLandUse}
              onChange={(event) => setShowLandUse(event.target.checked)}
            />
            <span>{landUseLayer.name}</span>
          </label>

          <label className="layer-toggle">
            <input
              type="checkbox"
              checked={showBurnScarOutline}
              onChange={(event) => setShowBurnScarOutline(event.target.checked)}
            />
            <span>{finalBurnScarOutline.name}</span>
          </label>

          <label className="layer-toggle">
            <input
              type="checkbox"
              checked={showSeverity}
              onChange={(event) => setShowSeverity(event.target.checked)}
            />
            <span>{severityLayer.name}</span>
          </label>

          <hr />

          <section className="recovery-layer-picker">
            <h2>ชั้นการฟื้นตัว</h2>
            <p className="layer-help">
              พื้นที่ป่าภายในขอบเขตรอยไหม้สุดท้าย — เลือกแสดงได้ครั้งละหนึ่งปี
              แผนที่มีปี 2563–2565; ตารางและกราฟ final ครอบคลุมปี 2563–2568
            </p>

            {recoveryLayers.map((layer) => (
              <label className="layer-toggle" key={layer.id}>
                <input
                  type="checkbox"
                  checked={selectedRecoveryLayerId === layer.id}
                  onChange={(event) => handleRecoveryLayerToggle(
                    layer.id,
                    event.target.checked,
                  )}
                />
                <span>{layer.name}</span>
              </label>
            ))}
          </section>

          <hr />

          {showForestType && (
            <LayerLegend
              title="คำอธิบายประเภทป่าไม้"
              classes={forestTypeLayer.classes}
            />
          )}

          {showLandUse && (
            <LayerLegend
              title="คำอธิบายการใช้ประโยชน์ที่ดิน"
              classes={landUseLayer.classes}
            />
          )}

          {selectedRecoveryLayerId && (
            <LayerLegend
              title="คำอธิบายชั้นการฟื้นตัว BRR"
              classes={recoveryLayers[0].classes}
            />
          )}

          <LayerLegend
            title="คำอธิบายระดับความรุนแรง dNBR"
            classes={severityLayer.classes}
          />

          <p className="data-note">
            แสดงผลวิเคราะห์จากไฟล์ final ที่ export จาก Model B Cell 14
          </p>
        </aside>

        <section className="map-panel">
          {errorMessage && <div className="error-message">{errorMessage}</div>}

          <MapContainer
            center={[18.5, 98.3]}
            zoom={10}
            className="map"
            zoomControl
          >
            <ScaleControl position="bottomright" imperial={false} />
            <NorthArrow />

            <Pane name="forestTypePane" style={{ zIndex: 300 }} />
            <Pane name="landUsePane" style={{ zIndex: 350 }} />
            <Pane name="severityPane" style={{ zIndex: 400 }} />
            <Pane name="recoveryPane" style={{ zIndex: 625 }} />
            <Pane name="burnScarOutlinePane" style={{ zIndex: 550 }} />
            <Pane name="boundaryPane" style={{ zIndex: 650 }} />

            {baseMaps[baseMapId].url && (
              <TileLayer
                attribution={baseMaps[baseMapId].attribution}
                url={baseMaps[baseMapId].url}
                maxZoom={19}
              />
            )}

            <ForestTypeVector
              layerConfig={forestTypeLayer}
              isVisible={showForestType}
              onError={setErrorMessage}
            />

            <LandUseVector
              layerConfig={landUseLayer}
              isVisible={showLandUse}
              onError={setErrorMessage}
            />

            <ClassRaster
              layerConfig={severityLayer}
              isVisible={showSeverity}
              onError={setErrorMessage}
              pane="severityPane"
            />

            {recoveryLayers.map((layer) => (
              <ClassRaster
                key={layer.id}
                layerConfig={layer}
                isVisible={selectedRecoveryLayerId === layer.id}
                onError={setErrorMessage}
                pane="recoveryPane"
              />
            ))}

            <BurnScarOutline
              layerConfig={finalBurnScarOutline}
              isVisible={showBurnScarOutline}
              onError={setErrorMessage}
            />

            <VectorBoundary
              layerConfig={studyBoundary}
              isVisible={showBoundary}
              onError={setErrorMessage}
              fitMap
            />

            <VectorBoundary
              layerConfig={tambonBoundary}
              isVisible={showTambon}
              onError={setErrorMessage}
              showTambonNames
              showPersistentTambonNames={showTambonLabels}
            />
          </MapContainer>
        </section>
      </section>

      <RecoveryDashboard
        annual={dashboardData.annual}
        severity={dashboardData.severity}
        classAreas={dashboardData.classAreas}
        errorMessage={dashboardData.error}
      />
    </main>
  );
}

export default App;
