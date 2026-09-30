import { useEffect, useRef, useState } from 'react';
import {
  GeoJSON,
  MapContainer,
  Pane,
  ScaleControl,
  TileLayer,
  useMap,
} from 'react-leaflet';
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
  publicDataUrl,
  recoveryLayers,
  severityLayer,
  studyBoundary,
  tambonBoundary,
  tambonBurnScarLayer,
  tambonHighSeverityLayer,
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

function recoveryPillClass(value) {
  if (value === 'Excellent' || value === 'Very good') return 'recovery-pill is-strong';
  if (value === 'Good') return 'recovery-pill is-good';
  if (value === 'Moderate') return 'recovery-pill is-medium';
  return 'recovery-pill is-low';
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

function MapReference({ mapRef }) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;

    return () => {
      if (mapRef.current === map) mapRef.current = null;
    };
  }, [map, mapRef]);

  return null;
}

function VectorBoundary({
  layerConfig,
  isVisible,
  onError,
  fitMap = false,
  onBoundsReady = null,
  showTambonNames = false,
  showPersistentTambonNames = false,
  isInteractive = showTambonNames,
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
    if (boundaryData) {
      const boundsLayer = L.geoJSON(boundaryData);
      const bounds = boundsLayer.getBounds();

      if (fitMap) {
        map.fitBounds(bounds, {
          padding: [24, 24],
        });
      }

      onBoundsReady?.(bounds);
    }
  }, [boundaryData, fitMap, map, onBoundsReady]);

  if (!boundaryData) return null;

  function addTambonName(feature, leafletLayer) {
    const tambonName = feature?.properties?.TAMBON;

    if (!tambonName) return;

    const label = `ตำบล${tambonName}`;

    leafletLayer.bindTooltip(label, {
      sticky: !showPersistentTambonNames,
      permanent: showPersistentTambonNames,
      direction: showPersistentTambonNames ? 'center' : 'top',
      pane: showPersistentTambonNames ? 'tambonLabelPane' : 'tooltipPane',
      className: showPersistentTambonNames ? 'tambon-label' : 'tambon-tooltip',
    });

    // Persistent labels already identify every tambon. Suppress the click popup
    // in that mode so the same name does not appear twice on the map.
    if (!showPersistentTambonNames) {
      leafletLayer.bindPopup(
        `<div class="tambon-popup-content">
          <span class="tambon-popup-mark" aria-hidden="true">⌖</span>
          <p>ขอบเขตตำบล</p>
          <strong>${label}</strong>
          <span>อำเภอ${feature.properties.AMPHUR || 'แม่แจ่ม'} · จังหวัด${feature.properties.PROVINCE || 'เชียงใหม่'}</span>
        </div>`,
        { className: 'tambon-popup' },
      );
    }

    const highlightTambon = (target) => target.setStyle({
      color: '#0b6146',
      weight: 3.2,
      fillColor: '#c7edd5',
      fillOpacity: 0.14,
    });

    const resetTambonStyle = (target) => target.setStyle(layerConfig.style);

    leafletLayer.on({
      mouseover: (event) => highlightTambon(event.target),
      mouseout: (event) => {
        if (!event.target.isPopupOpen()) resetTambonStyle(event.target);
      },
      popupopen: (event) => highlightTambon(event.target),
      popupclose: (event) => resetTambonStyle(event.target),
    });
  }

  return (
    <GeoJSON
      key={`boundary-${layerConfig.id}-${showPersistentTambonNames}-${isInteractive}`}
      data={boundaryData}
      pane="boundaryPane"
      style={() => layerConfig.style}
      interactive={isInteractive}
      onEachFeature={showTambonNames && isInteractive ? addTambonName : undefined}
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
    const forestColor = colorByClass[classId] || '#8a9a91';

    layer.bindPopup(
      `<div class="thematic-popup-content">
        <span class="thematic-popup-swatch" style="background:${forestColor}"></span>
        <p>ประเภทป่าไม้</p>
        <strong>${forestName}</strong>
        <span class="thematic-popup-code">รหัสชั้นข้อมูล · ${classId}</span>
      </div>`,
      { className: 'thematic-popup' },
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
    const classCode = feature.properties[layerConfig.classField];
    const landUseColor = colorByClass[classCode] || '#8a9a91';

    layer.bindPopup(
      `<div class="thematic-popup-content">
        <span class="thematic-popup-swatch" style="background:${landUseColor}"></span>
        <p>การใช้ประโยชน์ที่ดิน</p>
        <strong>${thaiName || englishName || 'ไม่ระบุ'}</strong>
        <span class="thematic-popup-code">รหัสชั้นข้อมูล · ${code || '–'}</span>
      </div>`,
      { className: 'thematic-popup' },
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

function TambonBurnAreaVector({ layerConfig, isVisible, onError }) {
  const [tambonData, setTambonData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    if (!isVisible) {
      setTambonData(null);
      return undefined;
    }

    async function loadTambonBurnArea() {
      try {
        const [boundaryResult, tableResponse] = await Promise.all([
          shp(layerConfig.boundaryFileUrl),
          fetch(layerConfig.dataFileUrl),
        ]);

        if (!tableResponse.ok) {
          throw new Error(`Cannot load: ${layerConfig.dataFileUrl}`);
        }

        const areaByTambon = new Map(
          parseCsv(await tableResponse.text()).map((row) => [
            row.Tambon,
            Number(row[layerConfig.dataField]),
          ]),
        );

        const boundaryData = normalizeShapefileResult(boundaryResult);
        const joinedData = {
          ...boundaryData,
          features: boundaryData.features.map((feature) => ({
            ...feature,
            properties: {
              ...feature.properties,
              burnArea: areaByTambon.get(feature.properties.TAMBON) ?? 0,
            },
          })),
        };

        if (!cancelled) setTambonData(joinedData);
      } catch (error) {
        console.error(error);
        onError(`ไม่สามารถเปิดชั้นข้อมูล ${layerConfig.name} ได้`);
      }
    }

    loadTambonBurnArea();

    return () => {
      cancelled = true;
    };
  }, [isVisible, layerConfig, onError]);

  if (!tambonData) return null;

  function getSeverityStyle(area) {
    return [...layerConfig.classes]
      .reverse()
      .find((item) => area >= item.minimum)?.color || layerConfig.classes[0].color;
  }

  function styleFeature(feature) {
    const area = Number(feature.properties.burnArea) || 0;

    return {
      color: '#6a1b5b',
      weight: 1.7,
      fillColor: getSeverityStyle(area),
      fillOpacity: area ? 0.78 : 0.2,
    };
  }

  function addSeverityPopup(feature, layer) {
    const tambonName = feature.properties.TAMBON || 'ไม่ระบุ';
    const area = Number(feature.properties.burnArea) || 0;
    const fillColor = getSeverityStyle(area);

    layer.bindPopup(
      `<div class="thematic-popup-content">
        <span class="thematic-popup-swatch" style="background:${fillColor}"></span>
        <p>${layerConfig.popupTitle}</p>
        <strong>ตำบล${tambonName}</strong>
        <span class="thematic-popup-code">${formatNumber(area)} ไร่ · ${layerConfig.popupNote}</span>
      </div>`,
      { className: 'thematic-popup' },
    );
  }

  return (
    <GeoJSON
      data={tambonData}
      pane="tambonBurnAreaPane"
      style={styleFeature}
      onEachFeature={addSeverityPopup}
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

function RecoverySwipeLayer({ layerConfig, side, position }) {
  const map = useMap();
  const layerRef = useRef(null);
  const positionRef = useRef(position);
  const updateClipRef = useRef(null);

  useEffect(() => {
    positionRef.current = position;
    updateClipRef.current?.();
  }, [position]);

  useEffect(() => {
    const layer = L.tileLayer.wms('http://127.0.0.1:8081/geoserver/maechaem/wms', {
      layers: layerConfig.wmsLayerName,
      styles: 'brr_recovery',
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      opacity: layerConfig.opacity ?? 0.96,
      zIndex: side === 'left' ? 625 : 624,
    });

    layerRef.current = layer;
    layer.addTo(map);

    const updateClip = () => {
      const container = layer.getContainer();
      if (!container) return;

      // Tile containers are translated while panning and zooming. Convert the
      // map's screen bounds to layer coordinates on every map movement so the
      // clipping edge remains fixed under the divider.
      const northWest = map.containerPointToLayerPoint([0, 0]);
      const southEast = map.containerPointToLayerPoint(map.getSize());
      const splitAt = northWest.x + ((southEast.x - northWest.x) * positionRef.current) / 100;

      container.style.clip = side === 'left'
        ? `rect(${northWest.y}px, ${splitAt}px, ${southEast.y}px, ${northWest.x}px)`
        : `rect(${northWest.y}px, ${southEast.x}px, ${southEast.y}px, ${splitAt}px)`;
    };

    updateClipRef.current = updateClip;
    layer.on('load', updateClip);
    map.on('move zoom resize', updateClip);
    updateClip();

    return () => {
      layer.off('load', updateClip);
      map.off('move zoom resize', updateClip);
      layerRef.current = null;
      updateClipRef.current = null;
      map.removeLayer(layer);
    };
  }, [layerConfig, map, side]);

  return null;
}

function RecoverySwipeDivider({ position }) {
  const map = useMap();
  const dividerRef = useRef(null);

  useEffect(() => {
    const divider = L.DomUtil.create('div', 'recovery-swipe-divider', map.getContainer());
    divider.setAttribute('aria-hidden', 'true');
    divider.innerHTML = '<span>↔</span>';
    dividerRef.current = divider;

    return () => {
      divider.remove();
      dividerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    if (dividerRef.current) {
      // The divider lives inside Leaflet's map container, matching the exact
      // pixel coordinate used to clip the WMS tile containers.
      dividerRef.current.style.left = `${position}%`;
    }
  }, [position]);

  return null;
}

function RecoverySwipeControl({ leftLayer, rightLayer, position, onPositionChange }) {

  return (
    <section className="recovery-swipe-control" aria-label="เปรียบเทียบแผนที่แบบเลื่อน">
      <span className="recovery-comparison-status">เปรียบเทียบการฟื้นตัว: BRR</span>
      <div className="swipe-year-labels">
        <strong>{leftLayer.name}</strong>
        <strong>{rightLayer.name}</strong>
      </div>
      <input
        aria-label="เลื่อนเพื่อเปรียบเทียบแผนที่"
        type="range"
        min="0"
        max="100"
        value={position}
        onChange={(event) => onPositionChange(Number(event.target.value))}
      />
      <p>เลื่อนแถบแบ่งตรงกลางเพื่อเปรียบเทียบชั้นการฟื้นตัวระหว่างสองปี</p>
    </section>
  );
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
  const [activeIndex, setActiveIndex] = useState(null);

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
  const latestRow = data[data.length - 1];
  const activeRow = activeIndex === null ? null : data[activeIndex];
  const tooltipX = activeRow
    ? Math.min(Math.max(xAt(activeIndex) - 64, padding.left), width - 150)
    : 0;
  const tooltipHeight = 28 + series.length * 18;

  return (
    <article className="chart-card">
      <div className="chart-card-heading">
        <h3>{title}</h3>
        <span>ล่าสุด {latestRow['Year (B.E.)']}</span>
      </div>

      <svg
        className="trend-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title} ชี้จุดบนเส้นกราฟเพื่อดูค่า`}
        onMouseLeave={() => setActiveIndex(null)}
      >
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
                <g key={`${item.key}-${row['Year (B.E.)']}`}>
                  <circle
                    className={activeIndex === index ? 'chart-active-point' : undefined}
                    cx={xAt(index)}
                    cy={yAt(row[item.key])}
                    r={activeIndex === index ? '5.5' : '4'}
                    fill={item.color}
                  />
                  <circle
                    className="chart-hover-target"
                    cx={xAt(index)}
                    cy={yAt(row[item.key])}
                    r="13"
                    onMouseEnter={() => setActiveIndex(index)}
                  />
                </g>
              ))}
            </g>
          );
        })}

        {activeRow && (
          <g className="chart-tooltip">
            <line
              className="chart-hover-guide"
              x1={xAt(activeIndex)}
              x2={xAt(activeIndex)}
              y1={padding.top}
              y2={height - padding.bottom}
            />
            <rect x={tooltipX} y="8" width="142" height={tooltipHeight} rx="8" />
            <text x={tooltipX + 11} y="28" className="chart-tooltip-year">
              ปี {activeRow['Year (B.E.)']}
            </text>
            {series.map((item, index) => (
              <text
                key={item.key}
                x={tooltipX + 11}
                y={47 + index * 18}
                className="chart-tooltip-value"
                fill={item.color}
              >
                {item.label} {formatNumber(activeRow[item.key])}{suffix}
              </text>
            ))}
          </g>
        )}
      </svg>

      <div className="chart-key">
        {series.map((item) => (
          <span key={item.key}>
            <i style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
        <span className="chart-key-hint">ชี้จุดบนเส้นเพื่อดูค่า</span>
      </div>
    </article>
  );
}

function TambonAreaRanking({ tambonBurnScar, tambonHighSeverity }) {
  const [view, setView] = useState('total');
  const isTotalView = view === 'total';
  const valueField = isTotalView ? 'Burn scar area (rai)' : 'High severity area (rai)';
  const rows = [...(isTotalView ? tambonBurnScar : tambonHighSeverity)]
    .sort((left, right) => Number(right[valueField]) - Number(left[valueField]));
  const maximum = Math.max(...rows.map((row) => Number(row[valueField])), 1);
  const topRow = rows[0];

  return (
    <article className={`table-card tambon-ranking-card ${isTotalView ? 'is-total' : 'is-high'}`}>
      <div className="table-card-heading">
        <div>
          <h3>เปรียบเทียบขนาดพื้นที่เผาไหม้รายตำบล</h3>
          <p>{isTotalView ? 'รวมร่องรอยเผาไหม้ทุกระดับความรุนแรง' : 'เฉพาะพื้นที่ที่มีค่า dNBR ระดับสูง'}</p>
        </div>
        <span>ผลจาก Model B</span>
      </div>

      <div className="ranking-switch" aria-label="เลือกมุมมองการจัดอันดับ">
        <button
          type="button"
          className={isTotalView ? 'is-selected' : undefined}
          aria-pressed={isTotalView}
          onClick={() => setView('total')}
        >
          ร่องรอยเผาไหม้รวม
        </button>
        <button
          type="button"
          className={!isTotalView ? 'is-selected' : undefined}
          aria-pressed={!isTotalView}
          onClick={() => setView('high')}
        >
          ระดับรุนแรงสูง
        </button>
      </div>

      {topRow && (
        <p className="ranking-summary">
          อันดับ 1: <strong>ตำบล{topRow.Tambon}</strong> {formatNumber(topRow[valueField])} ไร่
        </p>
      )}

      <div className="ranking-bars" role="list" aria-label="จัดอันดับขนาดพื้นที่รายตำบล">
        {rows.map((row, index) => {
          const value = Number(row[valueField]);

          return (
            <div className="ranking-bar-row" key={row.Tambon} role="listitem">
              <span className="ranking-number">{index + 1}</span>
              <strong>ตำบล{row.Tambon}</strong>
              <div className="ranking-bar-track" aria-label={`${formatNumber(value)} ไร่`}>
                <i style={{ width: `${(value / maximum) * 100}%` }} />
              </div>
              <span className="ranking-value">{formatNumber(value)} <small>ไร่</small></span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function RecoveryDashboard({ annual, severity, classAreas, tambonHighSeverity, tambonBurnScar, errorMessage }) {
  const latestYear = '2568';
  const latestClassAreas = classAreas.filter((row) => row['Year (B.E.)'] === latestYear);
  const latestAnnual = annual.find((row) => row['Year (B.E.)'] === latestYear);
  const peakAnnual = annual.length
    ? annual.reduce((highest, row) => (
      Number(row['Mean BRR (%)']) > Number(highest['Mean BRR (%)']) ? row : highest
    ))
    : null;
  const highestSeverity = severity.length
    ? severity.reduce((highest, row) => (
      Number(row['Mean BRR (%) in 2568']) > Number(highest['Mean BRR (%) in 2568']) ? row : highest
    ))
    : null;
  const mostAffectedTambon = tambonHighSeverity.length
    ? tambonHighSeverity.reduce((highest, row) => (
      Number(row['High severity area (rai)']) > Number(highest['High severity area (rai)']) ? row : highest
    ))
    : null;

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

      <div className="dashboard-highlights" aria-label="ตัวเลขสรุปสำคัญ">
        <article className="highlight-card highlight-brr">
          <span>BRR เฉลี่ยล่าสุด · ปี 2568</span>
          <strong>{latestAnnual ? `${formatNumber(latestAnnual['Mean BRR (%)'])}%` : '–'}</strong>
          <small>{translateRecoveryLevel(latestAnnual?.['Recovery level'])}</small>
        </article>
        <article className="highlight-card highlight-peak">
          <span>BRR เฉลี่ยสูงสุดที่ติดตาม</span>
          <strong>{peakAnnual ? `${formatNumber(peakAnnual['Mean BRR (%)'])}%` : '–'}</strong>
          <small>ปี พ.ศ. {peakAnnual?.['Year (B.E.)'] || '–'}</small>
        </article>
        <article className="highlight-card highlight-severity">
          <span>กลุ่มความรุนแรงที่ฟื้นตัวดีที่สุด · ปี 2568</span>
          <strong>{highestSeverity ? `${formatNumber(highestSeverity['Mean BRR (%) in 2568'])}%` : '–'}</strong>
          <small>ระดับ{translateSeverity(highestSeverity?.['dNBR severity'])}</small>
        </article>
        <article className="highlight-card highlight-tambon">
          <span>ตำบลที่มีขนาดพื้นที่เผาไหม้ระดับรุนแรงสูงสุด</span>
          <strong>{mostAffectedTambon ? `ตำบล${mostAffectedTambon.Tambon}` : '–'}</strong>
          <small>{mostAffectedTambon ? `${formatNumber(mostAffectedTambon['High severity area (rai)'])} ไร่ · dNBR ระดับสูง` : '–'}</small>
        </article>
      </div>

      <aside className="research-insight" aria-label="ข้อค้นพบสำคัญ">
        <div className="research-insight-title">
          <span aria-hidden="true">✦</span>
          <div>
            <p>HIGHLIGHTS FROM FINAL MODEL B</p>
            <h3>ข้อค้นพบสำคัญ</h3>
          </div>
        </div>
        <ul>
          <li>ปี 2568 มีค่า BRR เฉลี่ย {latestAnnual ? `${formatNumber(latestAnnual['Mean BRR (%)'])}%` : '–'} อยู่ในระดับ{translateRecoveryLevel(latestAnnual?.['Recovery level'])}</li>
          <li>ค่า BRR เฉลี่ยสูงสุดของช่วงติดตามอยู่ในปี {peakAnnual?.['Year (B.E.)'] || '–'} ที่ {peakAnnual ? `${formatNumber(peakAnnual['Mean BRR (%)'])}%` : '–'}</li>
          <li>ในปี 2568 พื้นที่รอยไหม้ระดับ{translateSeverity(highestSeverity?.['dNBR severity'])}มีค่า BRR เฉลี่ยสูงสุดที่ {highestSeverity ? `${formatNumber(highestSeverity['Mean BRR (%) in 2568'])}%` : '–'}</li>
          <li>ตำบลที่มีขนาดพื้นที่เผาไหม้ระดับรุนแรงสูงมากที่สุดคือ{mostAffectedTambon ? `ตำบล${mostAffectedTambon.Tambon} ${formatNumber(mostAffectedTambon['High severity area (rai)'])} ไร่` : '–'}</li>
        </ul>
      </aside>

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
                  <tr className={row['Year (B.E.)'] === latestYear ? 'latest-data-row' : undefined} key={row['Year (B.E.)']}>
                    <td>{row['Year (B.E.)']}</td>
                    <td>{formatNumber(row['Mean NDVI'])}</td>
                    <td>{formatNumber(row['Mean NBR'])}</td>
                    <td>{formatNumber(row['Mean BRR (%)'])}%</td>
                    <td><span className={recoveryPillClass(row['Recovery level'])}>{translateRecoveryLevel(row['Recovery level'])}</span></td>
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
                    <td><span className={recoveryPillClass(row['Recovery level'])}>{translateRecoveryLevel(row['Recovery level'])}</span></td>
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
                    <td><span className={recoveryPillClass(row['Recovery level'])}>{translateRecoveryLevel(row['Recovery level'])}</span></td>
                    <td>{formatNumber(row['Area (rai)'])}</td>
                    <td>{formatNumber(row['Percent of Model B forest burn scar'])}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <TambonAreaRanking
        tambonBurnScar={tambonBurnScar}
        tambonHighSeverity={tambonHighSeverity}
      />
    </section>
  );
}

const thunderforestApiKey = import.meta.env.VITE_THUNDERFOREST_API_KEY;
const cartoApiKey = import.meta.env.VITE_CARTO_BASEMAPS_API_KEY;

const baseMaps = {
  light: {
    label: 'Light background',
    url: null,
    attribution: '',
  },
  streets: {
    label: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  stadiaOsmBright: {
    label: 'Stadia OSM Bright',
    url: 'https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://stadiamaps.com/attribution/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    maxZoom: 20,
  },
  stadiaAlidadeSatellite: {
    label: 'Stadia Alidade Satellite',
    url: 'https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg',
    attribution: '&copy; CNES, Distribution Airbus DS, &copy; Airbus DS, &copy; PlanetObserver (Contains Copernicus Data) | &copy; <a href="https://stadiamaps.com/attribution/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    maxZoom: 20,
  },
  darkGray: {
    label: 'Dark Gray Canvas',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
  satellite: {
    label: 'Satellite imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
  ...(thunderforestApiKey ? {
    thunderforestOpenCycle: {
      label: 'Thunderforest OpenCycleMap',
      url: `https://api.thunderforest.com/cycle/{z}/{x}/{y}{r}.png?apikey=${thunderforestApiKey}`,
      attribution: '&copy; <a href="https://www.thunderforest.com/" target="_blank">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 22,
    },
  } : {}),
  ...(cartoApiKey ? {
    cartoDarkMatter: {
      label: 'CARTO Dark Matter',
      url: `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${cartoApiKey}`,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attribution/">CARTO</a>',
      maxZoom: 20,
    },
  } : {}),
};

function LandingPage({ onEnter }) {
  return (
    <main className="landing-shell">
      <div className="landing-orb landing-orb-one" />
      <div className="landing-orb landing-orb-two" />

      <section className="landing-content">
        <div className="landing-copy">
          <p className="landing-eyebrow">SPATIAL ANALYSIS PLATFORM · MAE CHAEM</p>
          <h1>
            <span>พื้นที่เผาไหม้และการฟื้นตัว</span>
            <span>ของพืชพรรณ</span>
          </h1>
          <p className="landing-subtitle">
            แสดงผลรอยไหม้ ระดับความรุนแรง และแนวโน้มการฟื้นตัวในอำเภอแม่แจ่ม จังหวัดเชียงใหม่
          </p>

          <div className="landing-badges" aria-label="Project details">
            <span>Model B ขั้นสุดท้าย</span>
            <span>ติดตาม พ.ศ. 2563–2568</span>
            <span>BRR · NDVI · NBR</span>
          </div>

          <button className="enter-platform-button" type="button" onClick={onEnter}>
            เข้าสู่แผนที่และผลการวิเคราะห์
            <span aria-hidden="true">→</span>
          </button>

        </div>

        <div className="landing-map-card" aria-label="Mae Chaem research platform cover graphic">
          <div className="map-card-topline">
            <span>อำเภอแม่แจ่ม จังหวัดเชียงใหม่</span>
            <i>●</i>
          </div>
          <div className="map-card-grid" />
          <div className="map-card-shape" />
          <div className="map-card-pin">⌖</div>
          <div className="map-card-caption">
            <strong>ขอบเขตรอยไหม้สุดท้าย</strong>
          </div>
          <div className="map-card-scale"><span /> 10 km</div>
        </div>
      </section>
    </main>
  );
}

function App() {
  const mapRef = useRef(null);
  const [showBoundary, setShowBoundary] = useState(studyBoundary.visible);
  const [showTambon, setShowTambon] = useState(tambonBoundary.visible);
  const [showTambonLabels, setShowTambonLabels] = useState(false);
  const [showBurnScarOutline, setShowBurnScarOutline] = useState(
    finalBurnScarOutline.visible,
  );
  const [showForestType, setShowForestType] = useState(forestTypeLayer.visible);
  const [showLandUse, setShowLandUse] = useState(landUseLayer.visible);
  const [showTambonHighSeverity, setShowTambonHighSeverity] = useState(
    tambonHighSeverityLayer.visible,
  );
  const [showTambonBurnScar, setShowTambonBurnScar] = useState(
    tambonBurnScarLayer.visible,
  );
  const [showSeverity, setShowSeverity] = useState(severityLayer.visible);
  const [selectedRecoveryLayerId, setSelectedRecoveryLayerId] = useState(null);
  const [baseMapId, setBaseMapId] = useState('streets');
  const [showLanding, setShowLanding] = useState(true);
  const [isLegendPanelOpen, setIsLegendPanelOpen] = useState(true);
  const [isBrrComparison, setIsBrrComparison] = useState(false);
  const [comparisonLeftLayerId, setComparisonLeftLayerId] = useState('brr-recovery-2563');
  const [comparisonRightLayerId, setComparisonRightLayerId] = useState('brr-recovery-2568');
  const [swipePosition, setSwipePosition] = useState(50);
  const [errorMessage, setErrorMessage] = useState('');
  const [studyBounds, setStudyBounds] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    annual: [],
    severity: [],
    classAreas: [],
    tambonHighSeverity: [],
    tambonBurnScar: [],
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

        const [annual, severity, classAreas, tambonHighSeverity, tambonBurnScar] = await Promise.all([
          // These files are direct exports from the confirmed final Model B Cell 14 run.
          loadCsv(publicDataUrl('annual_recovery_ModelB_FINAL.csv')),
          loadCsv(publicDataUrl('brr_2568_by_severity_ModelB_FINAL.csv')),
          loadCsv(publicDataUrl('recovery_class_area_2563_2568_ModelB_FINAL.csv')),
          // This table is the saved Cell 10 Model B result: dNBR severity by tambon.
          loadCsv(publicDataUrl('dnbr_high_severity_by_tambon_ModelB_FINAL.csv')),
          loadCsv(publicDataUrl('burn_scar_area_by_tambon_ModelB_FINAL.csv')),
        ]);

        if (!cancelled) {
          setDashboardData({ annual, severity, classAreas, tambonHighSeverity, tambonBurnScar, error: '' });
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
      setIsBrrComparison(false);
      setShowSeverity(false);
      setShowTambonHighSeverity(false);
      setShowTambonBurnScar(false);
      setShowBurnScarOutline(false);
    }
  }

  function handleBrrComparisonToggle(isChecked) {
    setIsBrrComparison(isChecked);

    if (isChecked) {
      setSelectedRecoveryLayerId(null);
      setShowForestType(false);
      setShowLandUse(false);
      setShowSeverity(false);
      setShowTambonHighSeverity(false);
      setShowTambonBurnScar(false);
      setShowBurnScarOutline(false);
    }
  }

  function handleForestTypeToggle(isChecked) {
    setShowForestType(isChecked);

    if (isChecked) {
      // Keep thematic layers from competing for the same click target.
      setIsBrrComparison(false);
      setShowLandUse(false);
      setShowTambonHighSeverity(false);
      setShowTambonBurnScar(false);
    }
  }

  function handleLandUseToggle(isChecked) {
    setShowLandUse(isChecked);

    if (isChecked) {
      setIsBrrComparison(false);
      setShowTambonHighSeverity(false);
      setShowTambonBurnScar(false);
    }
  }

  function handleTambonHighSeverityToggle(isChecked) {
    setShowTambonHighSeverity(isChecked);

    if (isChecked) {
      setShowTambonBurnScar(false);
      setShowForestType(false);
      setShowLandUse(false);
      setShowSeverity(false);
      setSelectedRecoveryLayerId(null);
      setIsRecoveryComparison(false);
      setIsBrrComparison(false);
    }
  }

  function handleTambonBurnScarToggle(isChecked) {
    setShowTambonBurnScar(isChecked);

    if (isChecked) {
      setShowTambonHighSeverity(false);
      setShowForestType(false);
      setShowLandUse(false);
      setShowSeverity(false);
      setSelectedRecoveryLayerId(null);
      setIsRecoveryComparison(false);
      setIsBrrComparison(false);
    }
  }

  function handleStudyAreaReset() {
    if (!mapRef.current || !studyBounds) return;

    mapRef.current.fitBounds(studyBounds, { padding: [24, 24] });
  }

  const comparisonLeftLayer = recoveryLayers.find(
    (layer) => layer.id === comparisonLeftLayerId,
  );
  const comparisonRightLayer = recoveryLayers.find(
    (layer) => layer.id === comparisonRightLayerId,
  );
  const isMapComparison = isBrrComparison;


  if (showLanding) {
    return <LandingPage onEnter={() => setShowLanding(false)} />;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-decoration" aria-hidden="true" />
        <div className="topbar-identity">
          <span className="topbar-mark" aria-hidden="true"><i /></span>
          <div>
            <p className="eyebrow">ระบบแสดงผลการวิเคราะห์เชิงพื้นที่</p>
            <h1>{appConfig.title}</h1>
          </div>
        </div>
        <div className="header-actions">
          <span className="header-location">MAE CHAEM · CHIANG MAI</span>
          <button className="home-button" type="button" onClick={() => setShowLanding(true)}>
            หน้าแรก
          </button>
          <span className="status-badge">ข้อมูลในเครื่อง</span>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <h2>ชั้นข้อมูล</h2>

          <label className="basemap-picker">
            <span>Basemap</span>
            <select
              value={baseMapId}
              onChange={(event) => setBaseMapId(event.target.value)}
            >
              {Object.entries(baseMaps).map(([id, baseMap]) => (
                <option value={id} key={id}>{baseMap.label}</option>
              ))}
            </select>
          </label>

          <section className="layer-group">
            <h3>ขอบเขตพื้นที่</h3>
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
          </section>

          <section className="layer-group">
            <h3>ข้อมูลพื้นที่และร่องรอยเผาไหม้</h3>
          <label className="layer-toggle">
            <input
              type="checkbox"
              checked={showForestType}
              onChange={(event) => handleForestTypeToggle(event.target.checked)}
            />
            <span>{forestTypeLayer.name}</span>
          </label>

          <label className="layer-toggle">
            <input
              type="checkbox"
              checked={showLandUse}
              onChange={(event) => handleLandUseToggle(event.target.checked)}
            />
            <span>{landUseLayer.name}</span>
          </label>

          <label className="layer-toggle">
            <input
              type="checkbox"
              checked={showTambonBurnScar}
              onChange={(event) => handleTambonBurnScarToggle(event.target.checked)}
            />
            <span>{tambonBurnScarLayer.name}</span>
          </label>

          <label className="layer-toggle sub-layer-toggle">
            <input
              type="checkbox"
              checked={showTambonHighSeverity}
              onChange={(event) => handleTambonHighSeverityToggle(event.target.checked)}
            />
            <span>{tambonHighSeverityLayer.name}</span>
          </label>
          <p className="layer-help">เลือกแสดงได้ครั้งละหนึ่งมุมมอง เพื่อเปรียบเทียบพื้นที่รวมกับพื้นที่รุนแรงสูง</p>
          </section>

          <section className="layer-group">
            <h3>ขอบเขตและความรุนแรง</h3>
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
              onChange={(event) => {
                setShowSeverity(event.target.checked);
                if (event.target.checked) {
                  setShowTambonHighSeverity(false);
                  setShowTambonBurnScar(false);
                }
              }}
            />
            <span>{severityLayer.name}</span>
          </label>
          </section>

          <section className="recovery-layer-picker">
            <h2>ชั้นการฟื้นตัว</h2>
            <p className="layer-help">
              พื้นที่ป่าภายในขอบเขตรอยไหม้สุดท้าย — เลือกแสดงได้ครั้งละหนึ่งปี
              แผนที่ ตาราง และกราฟ final ครอบคลุมปี 2563–2568
            </p>

            {recoveryLayers.map((layer) => (
              <label className="layer-toggle" key={layer.id}>
                <input
                  type="checkbox"
                  checked={selectedRecoveryLayerId === layer.id}
                  disabled={isMapComparison}
                  onChange={(event) => handleRecoveryLayerToggle(
                    layer.id,
                    event.target.checked,
                  )}
                />
                <span>{layer.name}</span>
              </label>
            ))}

            <label className="layer-toggle brr-comparison-toggle">
              <input
                type="checkbox"
                checked={isBrrComparison}
                onChange={(event) => handleBrrComparisonToggle(event.target.checked)}
              />
              <span>เปรียบเทียบชั้นการฟื้นตัว BRR แบบเลื่อน</span>
            </label>
            <p className="layer-help">เลือกปีทางซ้ายและขวา แล้วเลื่อนแถบตรงกลางบนแผนที่เพื่อเปรียบเทียบ</p>

            {isBrrComparison && (
              <div className="comparison-year-selects">
                <label>
                  <span>ชั้นข้อมูลก่อน</span>
                  <select
                    value={comparisonLeftLayerId}
                    onChange={(event) => setComparisonLeftLayerId(event.target.value)}
                  >
                    {recoveryLayers.map((layer) => (
                      <option key={layer.id} value={layer.id}>{layer.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>ชั้นข้อมูลหลัง</span>
                  <select
                    value={comparisonRightLayerId}
                    onChange={(event) => setComparisonRightLayerId(event.target.value)}
                  >
                    {recoveryLayers.map((layer) => (
                      <option key={layer.id} value={layer.id}>{layer.name}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

          </section>

          <p className="sidebar-hint">
            คำอธิบายสีของชั้นข้อมูลที่เปิดอยู่แสดงในแผงด้านขวาของแผนที่
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
            <MapReference mapRef={mapRef} />
            <ScaleControl position="bottomright" imperial={false} />
            <NorthArrow />

            <Pane name="forestTypePane" style={{ zIndex: 660 }} />
            <Pane name="landUsePane" style={{ zIndex: 350 }} />
            <Pane name="tambonBurnAreaPane" style={{ zIndex: 650 }} />
            <Pane name="severityPane" style={{ zIndex: 400 }} />
            <Pane name="recoveryPane" style={{ zIndex: 625 }} />
            <Pane name="burnScarOutlinePane" style={{ zIndex: 550 }} />
            <Pane
              name="boundaryPane"
              style={{
                zIndex: 670,
                // Keep administrative boundaries visible above thematic colours,
                // while allowing clicks to pass through to the active data layer.
                pointerEvents: showForestType || showLandUse || showTambonHighSeverity || showTambonBurnScar ? 'none' : 'auto',
              }}
            />
            <Pane name="tambonLabelPane" style={{ zIndex: 680, pointerEvents: 'none' }} />

            {baseMaps[baseMapId].url && (
              <TileLayer
                attribution={baseMaps[baseMapId].attribution}
                url={baseMaps[baseMapId].url}
                maxZoom={baseMaps[baseMapId].maxZoom ?? 19}
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

            <TambonBurnAreaVector
              layerConfig={tambonHighSeverityLayer}
              isVisible={showTambonHighSeverity}
              onError={setErrorMessage}
            />

            <TambonBurnAreaVector
              layerConfig={tambonBurnScarLayer}
              isVisible={showTambonBurnScar}
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
                isVisible={!isMapComparison && selectedRecoveryLayerId === layer.id}
                onError={setErrorMessage}
                pane="recoveryPane"
              />
            ))}

            {isBrrComparison && (
              <>
                <RecoverySwipeDivider position={swipePosition} />
                <RecoverySwipeLayer
                  layerConfig={comparisonRightLayer}
                  side="right"
                  position={swipePosition}
                />
                <RecoverySwipeLayer
                  layerConfig={comparisonLeftLayer}
                  side="left"
                  position={swipePosition}
                />
              </>
            )}

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
              onBoundsReady={setStudyBounds}
            />

            <VectorBoundary
              layerConfig={tambonBoundary}
              isVisible={showTambon}
              onError={setErrorMessage}
              showTambonNames
              showPersistentTambonNames={showTambonLabels}
              isInteractive={!showForestType && !showLandUse && !showTambonHighSeverity && !showTambonBurnScar}
            />
          </MapContainer>

          <button
            className="map-reset-button"
            type="button"
            onClick={handleStudyAreaReset}
            disabled={!studyBounds}
            title="กลับไปดูขอบเขตอำเภอแม่แจ่มทั้งหมด"
          >
            <span aria-hidden="true">⌖</span>
            ดูพื้นที่ศึกษา
          </button>

          {isMapComparison && (
            <RecoverySwipeControl
              leftLayer={comparisonLeftLayer}
              rightLayer={comparisonRightLayer}
              position={swipePosition}
              onPositionChange={setSwipePosition}
            />
          )}

          <aside className={`map-legend-panel ${isLegendPanelOpen ? 'is-open' : 'is-collapsed'}`}>
            <button
              className="map-legend-toggle"
              type="button"
              onClick={() => setIsLegendPanelOpen((current) => !current)}
              aria-expanded={isLegendPanelOpen}
            >
              <span>คำอธิบายแผนที่</span>
              <span aria-hidden="true">{isLegendPanelOpen ? '−' : '+'}</span>
            </button>

            {isLegendPanelOpen && (
              <div className="map-legend-content">
                {showForestType && (
                  <LayerLegend
                    title="ประเภทป่าไม้"
                    classes={forestTypeLayer.classes}
                  />
                )}

                {showLandUse && (
                  <LayerLegend
                    title="การใช้ประโยชน์ที่ดิน"
                    classes={landUseLayer.classes}
                  />
                )}

                {showSeverity && (
                  <LayerLegend
                    title="ระดับความรุนแรง dNBR"
                    classes={severityLayer.classes}
                  />
                )}

                {showTambonHighSeverity && (
                  <LayerLegend
                    title="ขนาดพื้นที่เผาไหม้ระดับรุนแรงสูง (dNBR)"
                    classes={tambonHighSeverityLayer.classes}
                  />
                )}

                {showTambonBurnScar && (
                  <LayerLegend
                    title="ขนาดพื้นที่ร่องรอยเผาไหม้"
                    classes={tambonBurnScarLayer.classes}
                  />
                )}

                {(selectedRecoveryLayerId || isBrrComparison) && (
                  <>
                    <LayerLegend
                      title="ชั้นการฟื้นตัว BRR"
                      classes={recoveryLayers[0].classes}
                    />
                    <p className="legend-method-note">
                      เกณฑ์ BRR อ้างอิง Schepers et al. (2014) และ Veraverbeke et al. (2011)
                      อ้างถึงใน สุยะ และ ศรไชย (2566)
                    </p>
                  </>
                )}

                {!showForestType && !showLandUse && !showSeverity && !showTambonHighSeverity && !showTambonBurnScar && !selectedRecoveryLayerId && !isBrrComparison && (
                  <p className="legend-empty">เลือกชั้นข้อมูลเพื่อแสดงคำอธิบายสี</p>
                )}

                {(showForestType || showLandUse || showSeverity || showTambonHighSeverity || showTambonBurnScar || selectedRecoveryLayerId || isBrrComparison) && (
                  <p className="legend-source-note">
                    แหล่งข้อมูล: ผลวิเคราะห์จากแบบจำลอง Model B ขั้นสุดท้าย
                  </p>
                )}
              </div>
            )}
          </aside>
        </section>
      </section>

      <RecoveryDashboard
        annual={dashboardData.annual}
        severity={dashboardData.severity}
        classAreas={dashboardData.classAreas}
        tambonHighSeverity={dashboardData.tambonHighSeverity}
        tambonBurnScar={dashboardData.tambonBurnScar}
        errorMessage={dashboardData.error}
      />
    </main>
  );
}

export default App;
