import {
  DRYER_MODELS,
  DRYER_STATUS,
  DRYER_ERRORS,
  GRAIN_TYPES,
  MOISTURE_ERRORS,
} from "./constants";

export interface DryerData {
  dryerId: number;
  modelCode: number;
  modelName: string;
  isOnline: boolean;
  statusCode: number;
  statusName: string;
  hotAirTemp: number | null;
  setTemp: number | null;
  errorCode: number;
  errorName: string | null;
  timerSetHours: number | null;
  timerSetMinutes: number | null;
  timerDisplayHours: number | null;
  timerDisplayMinutes: number | null;
  rs485ErrorCount: number;
}

export interface MoistureData {
  meterId: number;
  moistureSetting: number | null;
  moistureSettingTiny: number | null;
  moistureSettingAd: number | null;
  grainType: number | null;
  grainTypeName: string | null;
  mode: string;
  sw2Manual: boolean | null;
  controlSource: string;
  measurementUpdated: boolean | null;
  hasMeasuredSinceBootup: boolean | null;
  displayValue: number | null;
  autoLed: boolean | null;
  grainTemp: number | null;
  errorCode: number;
  errorName: string | null;
  rtcTime: Date | null;
  lastMoistureValue: number | null;
  lastMeasurementGrain: string | null;
  measurementTrigger: "auto" | "manual" | null;
  measurementMode: "AUTO" | "STOP" | null;
  lastMeasurementTime: Date | null;
  measurementInterval: number | null;
  moistureDistribution: number[];
  distributionSampleSize: number | null;
}

function toSigned8(value: number): number {
  return value > 127 ? value - 256 : value;
}

function bcdToDecimal(bcd: number): number {
  return ((bcd >> 4) & 0x0f) * 10 + (bcd & 0x0f);
}

function safeReg(registers: number[], index: number): number | undefined {
  return index < registers.length ? registers[index] : undefined;
}

/**
 * 解析乾燥機主暫存器 (位址 00x0H-00x4H, 5 words)
 */
export function parseDryerRegisters(
  dryerId: number,
  registers: number[]
): DryerData {
  const reg0 = safeReg(registers, 0) ?? 0;
  const reg1 = safeReg(registers, 1);
  const reg2 = safeReg(registers, 2);
  const reg3 = safeReg(registers, 3);
  const reg4 = safeReg(registers, 4);

  const modelCode = reg0 & 0x0f;
  const isOnline = ((reg0 >> 7) & 1) === 1;
  const statusCode = (reg0 >> 8) & 0xff;

  let setTemp: number | null = null;
  let hotAirTemp: number | null = null;
  if (reg1 !== undefined) {
    const setTempRaw = reg1 & 0xff;
    const hotAirTempRaw = (reg1 >> 8) & 0xff;
    setTemp = setTempRaw === 0x80 ? null : setTempRaw;
    hotAirTemp = hotAirTempRaw === 0x80 ? null : toSigned8(hotAirTempRaw);
  }

  const errorCodeRaw = reg2 !== undefined ? reg2 & 0xff : 0;

  let timerSetHours: number | null = null;
  let timerSetMinutes: number | null = null;
  if (reg3 !== undefined) {
    const h = (reg3 >> 8) & 0xff;
    const m = reg3 & 0xff;
    timerSetHours = h === 0xff ? null : h;
    timerSetMinutes = m === 0xff ? null : m;
  }

  let timerDisplayHours: number | null = null;
  let timerDisplayMinutes: number | null = null;
  if (reg4 !== undefined) {
    const h = (reg4 >> 8) & 0xff;
    const m = reg4 & 0xff;
    timerDisplayHours = h === 0xff ? null : h;
    timerDisplayMinutes = m === 0xff ? null : m;
  }

  return {
    dryerId,
    modelCode,
    modelName: DRYER_MODELS[modelCode] ?? "未知機種",
    isOnline,
    statusCode,
    statusName: DRYER_STATUS[statusCode] ?? "未知狀態",
    hotAirTemp,
    setTemp,
    errorCode: errorCodeRaw,
    errorName:
      errorCodeRaw === 0
        ? null
        : (DRYER_ERRORS[errorCodeRaw] ??
          `E-${errorCodeRaw.toString(16).padStart(2, "0").toUpperCase()}`),
    timerSetHours,
    timerSetMinutes,
    timerDisplayHours,
    timerDisplayMinutes,
    rs485ErrorCount: 0,
  };
}

/**
 * 解析水分計暫存器 (位址 0x00H-0x0FH, 最多 16 words)
 *
 * 暫存器對照 (文件: 大橋米MODBUS R2):
 *   0x00H: VR1 水分設定值 [0-7]
 *   0x01H: 穀物選擇[0-2], SW1[3], SW2[4], 控制權[5], 更新旗標[6], 已量測[7], 七段百位[8-15]
 *   0x02H: 七段十位[0-7], 七段個位[8-15]
 *   0x03H: 錯誤碼[0-6], AUTO_LED[7], 穀溫[8-15]
 *   0x04H: 月[0-7](BCD), 年[8-15](BCD)
 *   0x05H: 時[0-7](BCD), 日[8-15](BCD)
 *   0x06H: 秒[0-7](BCD), 分[8-15](BCD)
 *   0x07H: 水分值[0-9], 間隔[10], 作種[11-13], 觸發[14], 模式[15]
 *   0x08H-0x0BH: 水分分布 (每 4bit = 一個區間計數)
 *   0x0CH: 量測日[0-7](BCD), 量測月[8-15](BCD)
 *   0x0DH: 量測分[0-7](BCD), 量測時[8-15](BCD)
 *   0x0EH: 量測年[0-7](BCD)
 *   0x0FH: VR1 AD值[0-7], 微調 AD值[8-15]
 */
export function parseMoistureRegisters(
  meterId: number,
  registers: number[]
): MoistureData {
  const reg0 = safeReg(registers, 0);
  const reg1 = safeReg(registers, 1);
  const reg2 = safeReg(registers, 2);
  const reg3 = safeReg(registers, 3);
  const reg7 = safeReg(registers, 7);
  const regF = safeReg(registers, 15);

  // 0x00H: 水分設定值
  let moistureSetting: number | null = null;
  if (reg0 !== undefined) {
    const vr1 = reg0 & 0xff;
    moistureSetting = vr1 === 0 ? null : vr1 / 10;
  }

  // 0x01H: 面板狀態
  let grainType: number | null = null;
  let grainTypeName: string | null = null;
  let mode = "未知";
  let sw2Manual: boolean | null = null;
  let controlSource = "未知";
  let measurementUpdated: boolean | null = null;
  let hasMeasuredSinceBootup: boolean | null = null;
  if (reg1 !== undefined) {
    const gt = reg1 & 0x07;
    grainType = gt > 0 && gt <= 6 ? gt : null;
    grainTypeName = GRAIN_TYPES[gt] ?? null;
    mode = ((reg1 >> 3) & 1) === 0 ? "AUTO" : "STOP";
    sw2Manual = ((reg1 >> 4) & 1) === 1;
    controlSource = ((reg1 >> 5) & 1) === 0 ? "CS-R" : "外部";
    measurementUpdated = ((reg1 >> 6) & 1) === 1;
    hasMeasuredSinceBootup = ((reg1 >> 7) & 1) === 1;
  }

  // 0x01H[8-15] + 0x02H: 七段顯示器數值
  let displayValue: number | null = null;
  if (reg1 !== undefined && reg2 !== undefined) {
    const hundreds = (reg1 >> 8) & 0xff;
    const tens = reg2 & 0xff;
    const ones = (reg2 >> 8) & 0xff;
    if (hundreds !== 0xff && tens !== 0xff && ones !== 0xff) {
      displayValue = hundreds * 100 + tens * 10 + ones;
    }
  }

  // 0x03H: 錯誤碼 + AUTO LED + 穀溫
  let autoLed: boolean | null = null;
  let grainTemp: number | null = null;
  let errorCode = 0;
  if (reg3 !== undefined) {
    errorCode = reg3 & 0x7f;
    autoLed = ((reg3 >> 7) & 1) === 1;
    const grainTempRaw = (reg3 >> 8) & 0xff;
    grainTemp = toSigned8(grainTempRaw);
    if (grainTemp < -55 || grainTemp > 125) grainTemp = null;
  }

  // 0x04H-0x06H: RTC 時鐘
  const rtcTime = parseRtcTime(registers, 4);

  // 0x07H: 最近量測結果
  let lastMoistureValue: number | null = null;
  let measurementInterval: number | null = null;
  let lastMeasurementGrain: string | null = null;
  let measurementTrigger: "auto" | "manual" | null = null;
  let measurementMode: "AUTO" | "STOP" | null = null;
  if (reg7 !== undefined) {
    const moistureRaw = reg7 & 0x3ff;
    lastMoistureValue = moistureRaw === 0 ? null : moistureRaw / 10;
    measurementInterval = ((reg7 >> 10) & 1) === 0 ? 15 : 30;
    const measGrain = (reg7 >> 11) & 0x07;
    lastMeasurementGrain = GRAIN_TYPES[measGrain] ?? null;
    measurementTrigger = ((reg7 >> 14) & 1) === 0 ? "manual" : "auto";
    measurementMode = ((reg7 >> 15) & 1) === 0 ? "AUTO" : "STOP";
  }

  // 0x08H-0x0BH: 水分分布
  const moistureDistribution: number[] = [];
  let distributionSampleSize: number | null = null;
  for (let i = 8; i <= 11; i++) {
    const word = safeReg(registers, i);
    if (word !== undefined) {
      moistureDistribution.push(word & 0x0f);
      moistureDistribution.push((word >> 4) & 0x0f);
      moistureDistribution.push((word >> 8) & 0x0f);
      moistureDistribution.push((word >> 12) & 0x0f);
    }
  }
  // 0x0BH [12-15] 是間距設定 (13=100粒, 6=50粒)
  if (moistureDistribution.length >= 16) {
    const sampleCode = moistureDistribution.pop()!;
    distributionSampleSize = sampleCode === 13 ? 100 : sampleCode === 6 ? 50 : null;
  }

  // 0x0CH-0x0EH: 最近量測時間
  const lastMeasurementTime = parseMeasurementTime(registers);

  // 0x0FH: 微調旋鈕 AD 值
  let moistureSettingTiny: number | null = null;
  let moistureSettingAd: number | null = null;
  if (regF !== undefined) {
    moistureSettingAd = regF & 0xff;
    moistureSettingTiny = (regF >> 8) & 0xff;
  }

  return {
    meterId,
    moistureSetting,
    moistureSettingTiny,
    moistureSettingAd,
    grainType,
    grainTypeName,
    mode,
    sw2Manual,
    controlSource,
    measurementUpdated,
    hasMeasuredSinceBootup,
    displayValue,
    autoLed,
    grainTemp,
    errorCode,
    errorName:
      errorCode === 0
        ? null
        : (MOISTURE_ERRORS[errorCode] ?? `E${errorCode}`),
    rtcTime,
    lastMoistureValue,
    lastMeasurementGrain,
    measurementTrigger,
    measurementMode,
    lastMeasurementTime,
    measurementInterval,
    moistureDistribution,
    distributionSampleSize,
  };
}

/**
 * 解析 RTC 時鐘 (0x04H-0x06H)
 * 0x04H: [0-7]=月(BCD), [8-15]=年(BCD)
 * 0x05H: [0-7]=時(BCD), [8-15]=日(BCD)
 * 0x06H: [0-7]=秒(BCD), [8-15]=分(BCD)
 */
function parseRtcTime(
  registers: number[],
  baseIndex: number
): Date | null {
  const r4 = safeReg(registers, baseIndex);
  const r5 = safeReg(registers, baseIndex + 1);
  const r6 = safeReg(registers, baseIndex + 2);
  if (r4 === undefined) return null;

  const monthBcd = r4 & 0xff;
  if (monthBcd === 0) return null;

  const year = 2000 + bcdToDecimal((r4 >> 8) & 0xff);
  const month = bcdToDecimal(monthBcd);
  const day = r5 !== undefined ? bcdToDecimal((r5 >> 8) & 0xff) : 1;
  const hour = r5 !== undefined ? bcdToDecimal(r5 & 0xff) : 0;
  const minute = r6 !== undefined ? bcdToDecimal((r6 >> 8) & 0xff) : 0;
  const second = r6 !== undefined ? bcdToDecimal(r6 & 0xff) : 0;

  return new Date(year, month - 1, day, hour, minute, second);
}

/**
 * 解析最近量測時間 (0x0CH-0x0EH)
 * 0x0CH: [0-7]=日(BCD), [8-15]=月(BCD)
 * 0x0DH: [0-7]=分(BCD), [8-15]=時(BCD)
 * 0x0EH: [0-7]=年(BCD)
 */
function parseMeasurementTime(registers: number[]): Date | null {
  const rC = safeReg(registers, 12);
  const rD = safeReg(registers, 13);
  const rE = safeReg(registers, 14);
  if (rC === undefined) return null;

  const monthBcd = (rC >> 8) & 0xff;
  if (monthBcd === 0) return null;

  const month = bcdToDecimal(monthBcd);
  const day = bcdToDecimal(rC & 0xff);
  const hour = rD !== undefined ? bcdToDecimal((rD >> 8) & 0xff) : 0;
  const minute = rD !== undefined ? bcdToDecimal(rD & 0xff) : 0;
  const year = rE !== undefined ? 2000 + bcdToDecimal(rE & 0xff) : new Date().getFullYear();

  return new Date(year, month - 1, day, hour, minute);
}
