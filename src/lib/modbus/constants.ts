// === 乾燥機機種代碼 ===
export const DRYER_MODELS: Record<number, string> = {
  0b0001: "PHS-130",
  0b0011: "NP-60HB",
  0b0100: "PRO-H(HB)/PRO-200H(HB)",
  0b0101: "PRO-300H(HB)",
  0b0110: "NP-120HB",
  0b0111: "NP-60H/NP-120H",
  0b1000: "NP-e",
  0b1001: "CPR-165",
  0b1010: "PRO-500B/PRO-600HB",
  0b1011: "NPC/SUPER-100C",
  0b1100: "PHS-320B",
};

// === 乾燥機狀態碼 ===
export const DRYER_STATUS: Record<number, string> = {
  0x00: "準備中",
  0x01: "停止",
  0x02: "停止(預備通風)",
  0x03: "入穀",
  0x04: "入穀滿量",
  0x05: "排出",
  0x06: "乾燥",
  0x07: "通風乾燥",
  0x08: "乾燥結束",
  0x09: "乾燥暫停",
  0x0a: "乾燥完成",
  0xff: "未知",
};

// === 乾燥機錯誤碼 ===
export const DRYER_ERRORS: Record<number, string> = {
  0x01: "風壓開關異常",
  0x03: "熱風檢知器異常",
  0x04: "燃燒機壓力開關異常",
  0x05: "熱風超出設定5°C",
  0x06: "燃燒機熄火",
  0x07: "異常過熱",
  0x09: "點火前受光",
  0x11: "底座馬達過載",
  0x12: "升降機馬達過載",
  0x13: "排塵機馬達過載",
  0x14: "排風機馬達過載",
  0x15: "迴轉閥馬達過載",
  0x16: "均分馬達過載",
  0x17: "迴轉閥/底馬迴轉異常",
  0x80: "SW3設定錯誤",
};

// === 穀物種類 ===
export const GRAIN_TYPES: Record<number, string> = {
  1: "稻穀",
  2: "小麥",
  3: "大麥",
  4: "玉米",
  5: "油菜籽",
  6: "點檢",
};

// === 水分計錯誤碼 ===
export const MOISTURE_ERRORS: Record<number, string> = {
  0x31: "通訊異常(測定→操作)",
  0x32: "通訊異常(操作→測定)",
  0x33: "水份計無法正確測定",
  0x34: "滾輪電極異常",
  0x35: "取料不良",
  0x36: "穀物選擇鈕異常",
  0x37: "水份設定異常",
  0x38: "滾輪電極周邊異常",
  0x39: "溫度檢知器異常",
  0x40: "EEPROM異常",
};

// === Modbus 通訊參數 (依現場實測確認) ===
export const MODBUS_DRYER_SLAVE_ID = 0x01;
export const MODBUS_MOISTURE_SLAVE_ID = 0x02;
export const MODBUS_MAX_READ_WORDS = 12;
export const RS485_BUS_INTERVAL_MS = 50;
export const DEFAULT_RETRY_COUNT = 3;

// === 暫存器地址位移 ===
export const DRYER_DEVICE_SHIFT = 4; // 00x0H → x 在十位, deviceIndex << 4
export const MOISTURE_DEVICE_SHIFT = 8; // 0x00H → x 在百位, deviceIndex << 8

// === 暫存器數量 ===
export const DRYER_REGISTER_COUNT = 5; // 00x0H-00x4H
export const MOISTURE_REGISTER_COUNT = 16; // 0x00H-0x0FH (含微調)
