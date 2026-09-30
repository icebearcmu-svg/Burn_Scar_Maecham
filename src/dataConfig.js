export const appConfig = {
  title: 'แพลตฟอร์มแสดงผลพื้นที่เผาไหม้และการฟื้นตัวของพืชพรรณ',
  dataSource: 'Final Model B exports',
};

export const publicDataUrl = (fileName) => `${import.meta.env.BASE_URL}data/${fileName}`;

export const studyBoundary = {
  id: 'maechaem-amphoe-boundary',
  name: 'ขอบเขตอำเภอแม่แจ่ม',
  fileUrl: publicDataUrl('Maecham_Amphoe.zip'),
  visible: true,
  style: {
    color: '#163d2d',
    weight: 3,
    fillColor: '#ffffff',
    fillOpacity: 0,
  },
};

export const severityLayer = {
  id: 'dnbr-severity-2563',
  name: 'ระดับความรุนแรง dNBR (2563)',
  fileUrl: publicDataUrl('MaeCham_ModelB_FinalBurnSeverity_2563.tif'),
  visible: true,
  classes: [
    // BARC-inspired sequential palette: cool colours for lower impact,
    // warm colours for higher burn severity. Pixel classes remain unchanged.
    { value: 1, label: 'ต่ำ', color: '#168f96' },
    { value: 2, label: 'ปานกลาง-ต่ำ', color: '#62c7c9' },
    { value: 3, label: 'ปานกลาง-สูง', color: '#fee21a' },
    { value: 4, label: 'สูง', color: '#bd2b2d' },
  ],
};

export const tambonBoundary = {
  id: 'maechaem-tambon-boundaries',
  name: 'ขอบเขตตำบล',
  fileUrl: publicDataUrl('Maecham_Tambon.zip'),
  visible: true,
  style: {
    color: '#253f4a',
    weight: 1.4,
    fillColor: '#ffffff',
    fillOpacity: 0,
    dashArray: '4 3',
  },
};

export const tambonHighSeverityLayer = {
  id: 'tambon-high-severity',
  name: 'ขนาดพื้นที่เผาไหม้ระดับรุนแรงสูงรายตำบล',
  boundaryFileUrl: publicDataUrl('Maecham_Tambon.zip'),
  dataFileUrl: publicDataUrl('dnbr_high_severity_by_tambon_ModelB_FINAL.csv'),
  dataField: 'High severity area (rai)',
  popupTitle: 'ขนาดพื้นที่เผาไหม้ระดับรุนแรงสูง',
  popupNote: 'dNBR ระดับสูง',
  visible: false,
  classes: [
    { value: 'low', minimum: 0, label: 'ต่ำกว่า 100 ไร่', color: '#fde0dd' },
    { value: 'moderate', minimum: 100, label: '100–499 ไร่', color: '#fa9fb5' },
    { value: 'high', minimum: 500, label: '500–999 ไร่', color: '#c51b8a' },
    { value: 'very-high', minimum: 1000, label: 'ตั้งแต่ 1,000 ไร่', color: '#7a0177' },
  ],
};

export const tambonBurnScarLayer = {
  id: 'tambon-burn-scar-area',
  name: 'ขนาดพื้นที่ร่องรอยเผาไหม้รายตำบล',
  boundaryFileUrl: publicDataUrl('Maecham_Tambon.zip'),
  dataFileUrl: publicDataUrl('burn_scar_area_by_tambon_ModelB_FINAL.csv'),
  dataField: 'Burn scar area (rai)',
  popupTitle: 'ขนาดพื้นที่ร่องรอยเผาไหม้',
  popupNote: 'รวมทุกระดับความรุนแรง',
  visible: false,
  classes: [
    { value: 'low', minimum: 0, label: 'ต่ำกว่า 5,000 ไร่', color: '#fff3d9' },
    { value: 'moderate', minimum: 5000, label: '5,000–9,999 ไร่', color: '#f7c86a' },
    { value: 'high', minimum: 10000, label: '10,000–19,999 ไร่', color: '#e8893c' },
    { value: 'very-high', minimum: 20000, label: 'ตั้งแต่ 20,000 ไร่', color: '#bd4a2b' },
  ],
};

export const landUseLayer = {
  id: 'land-use',
  name: 'การใช้ประโยชน์ที่ดิน',
  fileUrl: publicDataUrl('Landuse_MaeChaem.zip'),
  classField: 'LUL1_CODE',
  visible: false,
  classes: [
    { value: 'U', label: 'ชุมชน (U)', color: '#7f7f7f' },
    { value: 'A', label: 'เกษตรกรรม (A)', color: '#b87916' },
    { value: 'F', label: 'ป่าไม้ (F)', color: '#4daf4a' },
    { value: 'W', label: 'แหล่งน้ำ (W)', color: '#377eb8' },
    { value: 'M', label: 'เบ็ดเตล็ด (M)', color: '#984ea3' },
  ],
};

const recoveryClasses = [
  { value: 1, label: 'ฟื้นตัวต่ำมาก', color: '#b2182b' },
  { value: 2, label: 'ฟื้นตัวต่ำ', color: '#ef8a62' },
  { value: 3, label: 'ฟื้นตัวปานกลาง', color: '#fddbc7' },
  { value: 4, label: 'ฟื้นตัวดี', color: '#d1e5f0' },
  { value: 5, label: 'ฟื้นตัวดีมาก', color: '#67a9cf' },
  { value: 6, label: 'ฟื้นตัวดีเยี่ยม', color: '#2166ac' },
];

export const recoveryLayers = [
  {
    id: 'brr-recovery-2563',
    name: 'ชั้นการฟื้นตัว BRR (2563)',
    wmsLayerName: 'maechaem:brr_recovery_2563',
    fileUrl: publicDataUrl('MaeCham_BRR_RecoveryClass_2563.tif'),
    opacity: 0.96,
    classes: recoveryClasses,
  },
  {
    id: 'brr-recovery-2564',
    name: 'ชั้นการฟื้นตัว BRR (2564)',
    wmsLayerName: 'maechaem:brr_recovery_2564',
    fileUrl: publicDataUrl('MaeCham_BRR_RecoveryClass_2564.tif'),
    opacity: 0.96,
    classes: recoveryClasses,
  },
  {
    id: 'brr-recovery-2565',
    name: 'ชั้นการฟื้นตัว BRR (2565)',
    wmsLayerName: 'maechaem:brr_recovery_2565',
    fileUrl: publicDataUrl('MaeCham_BRR_RecoveryClass_2565.tif'),
    opacity: 0.96,
    classes: recoveryClasses,
  },
  {
    id: 'brr-recovery-2566',
    name: 'ชั้นการฟื้นตัว BRR (2566)',
    wmsLayerName: 'maechaem:brr_recovery_2566',
    fileUrl: publicDataUrl('MaeCham_BRR_RecoveryClass_2566.tif'),
    opacity: 0.96,
    classes: recoveryClasses,
  },
  {
    id: 'brr-recovery-2567',
    name: 'ชั้นการฟื้นตัว BRR (2567)',
    wmsLayerName: 'maechaem:brr_recovery_2567',
    fileUrl: publicDataUrl('MaeCham_BRR_RecoveryClass_2567.tif'),
    opacity: 0.96,
    classes: recoveryClasses,
  },
  {
    id: 'brr-recovery-2568',
    name: 'ชั้นการฟื้นตัว BRR (2568)',
    wmsLayerName: 'maechaem:brr_recovery_2568',
    fileUrl: publicDataUrl('MaeCham_BRR_RecoveryClass_2568.tif'),
    opacity: 0.96,
    classes: recoveryClasses,
  },
];

export const forestTypeLayer = {
  id: 'forest-type',
  name: 'ประเภทป่าไม้',
  fileUrl: publicDataUrl('Maecham_ForestType.zip'),
  classField: 'Class_ID',
  visible: false,
  classes: [
    { value: 1, label: 'ป่าดิบเขา', color: '#1b9e77' },
    { value: 2, label: 'ป่าดิบแล้ง', color: '#d95f02' },
    { value: 3, label: 'ป่าเต็งรัง', color: '#7570b3' },
    { value: 4, label: 'ป่าที่ฟื้นฟูตามธรรมชาติ', color: '#e7298a' },
    { value: 5, label: 'ทุ่งหญ้า', color: '#66a61e' },
    { value: 6, label: 'ป่าเบญจพรรณ', color: '#e6ab02' },
    { value: 7, label: 'ป่าไผ่', color: '#a6761d' },
    { value: 8, label: 'ป่าสน', color: '#1f78b4' },
    { value: 9, label: 'พื้นที่นอกเขตป่า', color: '#bdbdbd' },
    { value: 10, label: 'สวนป่าสัก', color: '#fb9a99' },
    {
      value: 11,
      label: 'พืชพรรณบนลานหิน',
      color: '#6a3d9a',
    },
  ],
};

export const finalBurnScarOutline = {
  id: 'final-burn-scar-outline-2563',
  name: 'ขอบเขตรอยไหม้สุดท้าย (2563)',
  fileUrl: publicDataUrl('MaeCham_ModelB_FinalBurnScar_2563.geojson'),
  visible: true,
  style: {
    color: '#7a0019',
    weight: 1.2,
    fillOpacity: 0,
  },
};
