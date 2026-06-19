#!/usr/bin/env node
/**
 * 診斷第3台乾燥機 — 掃描所有可能的 device index，找出哪個回傳 52°C
 */
import net from "net";

const HOST = process.argv[2] || "60.249.85.56";
const PORT = parseInt(process.argv[3] || "4001");
const DRYER_SLAVE = 0x01;

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const MODELS = {
  1: "PHS-130", 3: "NP-60HB", 4: "PRO-H", 5: "PRO-300H",
  6: "NP-120HB", 7: "NP-60H/NP-120H", 8: "NP-e", 9: "CPR-165",
  10: "PRO-500B", 11: "NPC", 12: "PHS-320B",
};
const STATUS = {
  0x00: "準備中", 0x01: "停止", 0x02: "停止(預備通風)", 0x03: "入穀",
  0x04: "入穀滿量", 0x05: "排出", 0x06: "乾燥", 0x07: "通風乾燥",
  0x08: "乾燥結束", 0x09: "乾燥暫停", 0x0a: "乾燥完成", 0xff: "關機/未定位",
};

class Session {
  constructor(host, port) {
    this.host = host;
    this.port = port;
    this.socket = null;
    this.connected = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.setTimeout(5000);
      this.socket.on("connect", () => { this.connected = true; resolve(); });
      this.socket.on("error", (e) => reject(e));
      this.socket.on("timeout", () => { this.socket.destroy(); reject(new Error("timeout")); });
      this.socket.on("close", () => { this.connected = false; });
      this.socket.connect(this.port, this.host);
    });
  }

  read(slaveId, addr, qty) {
    return new Promise((resolve) => {
      let buf = Buffer.alloc(0);
      let done = false;
      const finish = (r) => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          this.socket.removeListener("data", onData);
          resolve(r);
        }
      };
      const timer = setTimeout(() => finish({ ok: false, error: "timeout" }), 2000);
      const onData = (data) => {
        buf = Buffer.concat([buf, data]);
        if (buf.length >= 5 && buf[1] & 0x80) {
          finish({ ok: false, error: `exception 0x${buf[2].toString(16)}` });
          return;
        }
        if (buf.length >= 3) {
          const byteCount = buf[2];
          const expected = 3 + byteCount + 2;
          if (buf.length >= expected) {
            const dataPart = buf.subarray(0, 3 + byteCount);
            const recvCrc = buf.readUInt16LE(3 + byteCount);
            const calcCrc = crc16(dataPart);
            const regs = [];
            for (let i = 0; i < byteCount; i += 2) {
              regs.push(buf.readUInt16BE(3 + i));
            }
            finish({ ok: true, crc: recvCrc === calcCrc, registers: regs });
          }
        }
      };
      this.socket.on("data", onData);
      this.socket.write(buildReadRequest(slaveId, addr, qty));
    });
  }

  close() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
    }
  }
}

console.log(`\n🔍 診斷第3台乾燥機: ${HOST}:${PORT}\n`);
console.log("掃描所有 device index (0-15) 的乾燥機暫存器...\n");

const session = new Session(HOST, PORT);
try {
  await session.connect();
  console.log("✅ TCP 連線成功\n");

  console.log("Index | Addr    | Reg0(機型/狀態) | Reg1(熱風) | Reg2(設溫) | 分析");
  console.log("------+---------+-----------------+-----------+-----------+------");

  for (let dev = 0; dev < 16; dev++) {
    const addr = dev << 4;
    const r = await session.read(DRYER_SLAVE, addr, 5);

    if (r.ok && r.registers) {
      const reg0 = r.registers[0];
      const reg1 = r.registers[1];
      const reg2 = r.registers[2];

      const model = reg0 & 0xf;
      const power = (reg0 >> 7) & 1;
      const status = (reg0 >> 8) & 0xff;
      const hotTemp = reg1;
      const setTemp = reg2;

      const modelName = MODELS[model] || `??(${model})`;
      const statusName = STATUS[status] || `0x${status.toString(16)}`;
      const crcTag = r.crc ? "✅" : "⚠️CRC";

      const analysis = [];
      if (hotTemp === 52) analysis.push("🎯 熱風52°C!");
      if (status !== 0xff && power) analysis.push("運轉中");
      if (status === 0xff) analysis.push("離線");

      console.log(
        `  ${dev.toString().padStart(2)}  | 0x${addr.toString(16).padStart(4, "0")} | ` +
        `${modelName.padEnd(10)} ${statusName.padEnd(6)} | ` +
        `${hotTemp.toString().padStart(5)}°C  | ` +
        `${setTemp.toString().padStart(5)}°C  | ` +
        `${crcTag} ${analysis.join(", ")}`
      );
    } else {
      console.log(
        `  ${dev.toString().padStart(2)}  | 0x${addr.toString(16).padStart(4, "0")} | ${r.error || "no data"}`
      );
    }
    await sleep(100);
  }

  // 也試試水分計 device 2
  console.log("\n\n📊 同時檢查水分計 index 2 (第3台)...");
  const mAddr = 2 << 8; // 0x0200
  const mr = await session.read(0x02, mAddr, 12);
  if (mr.ok && mr.registers) {
    const moistureSetting = (mr.registers[0] & 0xff) / 10;
    const grainType = mr.registers[1] & 0xff;
    const lastMoisture = mr.registers[7] !== undefined ? mr.registers[7] / 10 : null;
    const grainTemp = mr.registers[8] !== undefined ? mr.registers[8] / 10 : null;
    console.log(`  水分設定: ${moistureSetting}%`);
    console.log(`  穀種: ${grainType}`);
    console.log(`  最新水分: ${lastMoisture}%`);
    console.log(`  穀溫: ${grainTemp}°C`);
    console.log(`  CRC: ${mr.crc ? "✅" : "⚠️"}`);
    console.log(`  Raw: [${mr.registers.join(", ")}]`);
  } else {
    console.log(`  ❌ ${mr.error || "no data"}`);
  }

} catch (e) {
  console.log(`❌ 連線失敗: ${e.message}`);
} finally {
  session.close();
}

console.log("\n完成。\n");
