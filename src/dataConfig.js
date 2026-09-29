export const appConfig = {
  title: 'แพลตฟอร์มพื้นที่เผาไหม้และการฟื้นตัว อำเภอแม่แจ่ม',
  dataSource: 'Final Model B recovery exports from Cell 14',
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
    { value: 1, label: 'ต่ำ', color: '#fee08b' },
    { value: 2, label: 'ปานกลาง-ต่ำ', color: '#fdae61' },
    { value: 3, label: 'ปานกลาง-สูง', color: '#f46d43' },
    { value: 4, label: 'สูง', color: '#d73027' },
  ],
};

export const tambonBoundary = {
  id: 'maechaem-tambon-boundaries',
  name: 'ขอบเขตตำบล',
  fileUrl: publicDataUrl('Maecham_Tambon.zip'),
  visible: true,
  style: {
    color: '#557363',
    weight: 1,
    fillColor: '#ffffff',
    fillOpacity: 0,
    dashArray: '3 3',
  },
};

export const landUseLayer = {
  id: 'land-use',
  name: 'การใช้ประโยชน์ที่ดิน',
  fileUrl: publicDataUrl('Landuse_MaeChaem.zip'),
  classField: 'LUL1_CODE',
  visible: false,
  classes: [
    { value: 'U', label: 'ชุมชน (U)', color: '#7f7f7f' },
    { value: 'A', label: 'เกษตรกรรม (A)', color: '#00a6a6' },
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
    fileUrl: publicDataUrl('MaeCham_BRR_RecoveryClass_2563.tif'),
    opacity: 0.96,
    classes: recoveryClasses,
  },
  {
    id: 'brr-recovery-2564',
    name: 'ชั้นการฟื้นตัว BRR (2564)',
    fileUrl: publicDataUrl('MaeCham_BRR_RecoveryClass_2564.tif'),
    opacity: 0.96,
    classes: recoveryClasses,
  },
  {
    id: 'brr-recovery-2565',
    name: 'ชั้นการฟื้นตัว BRR (2565)',
    fileUrl: publicDataUrl('MaeCham_BRR_RecoveryClass_2565.tif'),
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
    { value: 4, label: 'ป่ารุ่นสอง', color: '#e7298a' },
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
