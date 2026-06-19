#!/usr/bin/env node
/**
 * NPort Modbus 連線測試腳本
 *
 * 用法:
 *   node scripts/test-connection.mjs                     # 預設 192.168.127.254:4001
 *   node scripts/test-connection.mjs 192.168.1.100       # 指定 IP
 *   node scripts/test-connection.mjs 60.249.85.56 4001   # 指定 IP + port (公網測試)
 */
import net from "net";

const HOST = process.argv[2] || "192.168.127.254";
const PORT = parseInt(process.argv[3] || "4001");
const DRYER_SLAVE = 0x01;
const MOISTURE_SLAVE = 0x02;

function crc16(buf) {
  let crc = 0xffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) crc = (crc >> 1) ^ 0xa001;
      else crc >>= 1;
    }
  }
  return crc;
}

function buildReadRequest(slaveId, startAddr, qty) {
  const buf = Buffer.alloc(8);
  buf.writeUInt8(slaveId, 0);
  buf.writeUInt8(0x03, 1);
  buf.writeUInt16BE(startAddr, 2);
  buf.writeUInt16BE(qty, 4);
  const c = crc16(buf.subarray(0, 6));
  buf.writeUInt16LE(c, 6);
  return buf;
}

function readRegister(host, port, slaveId, addr) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let buf = Buffer.alloc(0);
    let done = false;
    const finish = (r) => {
      if (!done) {
        done = true;
        socket.removeAllListeners();
        socket.destroy();
        resolve(r);
      }
    };

    socket.setTimeout(5000);
    socket.on("connect", () => {
      socket.setTimeout(5000);
      socket.write(buildReadRequest(slaveId, addr, 1));
    });
    socket.on("data", (data) => {
      buf = Buffer.concat([buf, data]);
      if (buf.length >= 5 && buf[1] & 0x80) {
        finish({ ok: false, error: `Modbus exception 0x${buf[2].toString(16)}` });
        return;
      }
      if (buf.length >= 7 && buf[2] === 2) {
        const dataPart = buf.subarray(0, 5);
        const recvCrc = buf.readUInt16LE(5);
        const calcCrc = crc16(dataPart);
        const val = buf.readUInt16BE(3);
        finish({ ok: recvCrc === calcCrc, val, crc: recvCrc === calcCrc });
      }
    });
    socket.on("timeout", () => finish({ ok: false, error: "timeout" }));
    socket.on("error", (e) => finish({ ok: false, error: e.message }));
    socket.connect(port, host);
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const MODELS = {
  1: "PHS-130", 3: "NP-60HB", 4: "PRO-H", 5: "PRO-300H",
  8: "NP-e", 9: "CPR-165", 10: "PRO-500B", 11: "NPC",
};
const STATUS = {
  0x00: "準備中", 0x01: "停止", 0x03: "入穀", 0x06: "乾燥",
  0x07: "通風乾燥", 0x0a: "乾燥完成", 0xff: "關機/未定位",
};

console.log(`\n🔌 測試 Modbus 連線: ${HOST}:${PORT}\n`);

// Step 1: TCP 連線測試
console.log("1️⃣  TCP 連線測試...");
const tcpOk = await new Promise((resolve) => {
  const s = new net.Socket();
  s.setTimeout(5000);
  s.on("connect", () => { s.destroy(); resolve(true); });
  s.on("timeout", () => { s.destroy(); resolve(false); });
  s.on("error", () => { s.destroy(); resolve(false); });
  s.connect(PORT, HOST);
});

if (!tcpOk) {
  console.log("   ❌ TCP 連線失敗 — 請確認:");
  console.log("      • NPort 是否開機且接上網路");
  console.log("      • IP 地址是否正確");
  console.log("      • Port forwarding 是否設定 (公網測試)");
  console.log("      • 防火牆是否開放 port " + PORT);
  process.exit(1);
}
console.log("   ✅ TCP 連線成功\n");

// Step 2: 乾燥機 Slave 0x01 測試
console.log("2️⃣  乾燥機 (Slave 0x01) 測試...");
let dryerOk = false;
for (let retry = 0; retry < 3; retry++) {
  const r = await readRegister(HOST, PORT, DRYER_SLAVE, 0x0000);
  if (r.ok) {
    const model = r.val & 0xf;
    const power = (r.val >> 7) & 1;
    const status = (r.val >> 8) & 0xff;
    console.log(`   ✅ 第1台: ${MODELS[model] || "?"}, 電源:${power ? "ON" : "OFF"}, 狀態:${STATUS[status] || "0x" + status.toString(16)}`);
    dryerOk = true;
    break;
  }
  if (r.error) console.log(`   ⚠️  嘗試 ${retry + 1}: ${r.error}`);
  await sleep(300);
}
if (!dryerOk) console.log("   ❌ 乾燥機通訊失敗 (3次重試)");

await sleep(200);

// Step 3: 水分計 Slave 0x02 測試
console.log("\n3️⃣  水分計 (Slave 0x02) 測試...");
let moistureOk = false;
for (let retry = 0; retry < 3; retry++) {
  const r = await readRegister(HOST, PORT, MOISTURE_SLAVE, 0x0000);
  if (r.ok) {
    const vr1 = r.val & 0xff;
    const setting = vr1 === 0 ? "未連線" : `${(vr1 / 10).toFixed(1)}%`;
    console.log(`   ✅ 水分設定: ${setting}`);
    moistureOk = true;
    break;
  }
  if (r.error) console.log(`   ⚠️  嘗試 ${retry + 1}: ${r.error}`);
  await sleep(300);
}
if (!moistureOk) console.log("   ❌ 水分計通訊失敗 (3次重試)");

await sleep(200);

// Step 4: 掃描所有乾燥機
if (dryerOk) {
  console.log("\n4️⃣  掃描所有乾燥機...");
  let found = 0;
  for (let dev = 0; dev < 10; dev++) {
    const addr = dev << 4;
    const r = await readRegister(HOST, PORT, DRYER_SLAVE, addr);
    if (r.ok) {
      const model = r.val & 0xf;
      const power = (r.val >> 7) & 1;
      const status = (r.val >> 8) & 0xff;
      if (status !== 0xff || power !== 0) {
        console.log(`   第${dev + 1}台: ${MODELS[model] || "?"} | ${power ? "ON" : "OFF"} | ${STATUS[status] || "0x" + status.toString(16)}`);
        found++;
      }
    }
    await sleep(150);
  }
  console.log(`   共偵測到 ${found} 台\n`);
}

// Summary
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`結果: TCP ${tcpOk ? "✅" : "❌"} | 乾燥機 ${dryerOk ? "✅" : "❌"} | 水分計 ${moistureOk ? "✅" : "❌"}`);
if (tcpOk && dryerOk) {
  console.log("\n✅ 可以部署到 Vercel！下一步:");
  console.log(`   1. 設定 NPORT_HOST=${HOST}`);
  console.log(`   2. 設定 NPORT_DRYER_PORT=${PORT}`);
  console.log("   3. vercel deploy");
}
console.log();
