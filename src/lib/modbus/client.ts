import net from "net";
import {
  RS485_BUS_INTERVAL_MS,
  MODBUS_MAX_READ_WORDS,
} from "./constants";

const CONNECT_TIMEOUT = 8000;
const READ_TIMEOUT = 3000;
const CONNECT_MAX_RETRIES = 3;

function crc16(buffer: Buffer): number {
  let crc = 0xffff;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >> 1) ^ 0xa001;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc;
}

function buildReadRequest(
  slaveId: number,
  startAddress: number,
  quantity: number
): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeUInt8(slaveId, 0);
  buf.writeUInt8(0x03, 1);
  buf.writeUInt16BE(startAddress, 2);
  buf.writeUInt16BE(quantity, 4);
  const crc = crc16(buf.subarray(0, 6));
  buf.writeUInt16LE(crc, 6);
  return buf;
}

function parseReadResponse(slaveId: number, response: Buffer): number[] {
  if (response.length < 5) {
    throw new Error(`回應太短: ${response.length} bytes`);
  }

  if (response[0] !== slaveId) {
    throw new Error(
      `Slave ID 不符: 預期 0x${slaveId.toString(16)}, 收到 0x${response[0].toString(16)}`
    );
  }

  if (response[1] & 0x80) {
    const exceptionCode = response[2];
    const exceptionMessages: Record<number, string> = {
      0x02: "非法資料位址",
      0x03: "非法資料值",
      0x09: "CRC 錯誤",
    };
    throw new Error(
      `Modbus 例外: ${exceptionMessages[exceptionCode] ?? `code 0x${exceptionCode.toString(16)}`}`
    );
  }

  if (response[1] !== 0x03) {
    throw new Error(`非預期的 function code: 0x${response[1].toString(16)}`);
  }

  const byteCount = response[2];
  const expectedLength = 3 + byteCount + 2;
  if (response.length < expectedLength) {
    throw new Error(
      `資料不完整: 預期 ${expectedLength} bytes, 收到 ${response.length}`
    );
  }

  const dataPart = response.subarray(0, 3 + byteCount);
  const receivedCrc = response.readUInt16LE(3 + byteCount);
  const calculatedCrc = crc16(dataPart);
  if (receivedCrc !== calculatedCrc) {
    throw new Error(
      `CRC 驗證失敗: 收到 0x${receivedCrc.toString(16)}, 計算 0x${calculatedCrc.toString(16)}`
    );
  }

  const registers: number[] = [];
  for (let i = 0; i < byteCount; i += 2) {
    registers.push(response.readUInt16BE(3 + i));
  }

  return registers;
}

export interface SoftReadResult {
  registers: number[];
  crcOk: boolean;
}

function parseReadResponseSoft(slaveId: number, response: Buffer): SoftReadResult {
  if (response.length < 5) {
    throw new Error(`回應太短: ${response.length} bytes`);
  }

  if (response[0] !== slaveId) {
    throw new Error(
      `Slave ID 不符: 預期 0x${slaveId.toString(16)}, 收到 0x${response[0].toString(16)}`
    );
  }

  if (response[1] & 0x80) {
    const exceptionCode = response[2];
    const exceptionMessages: Record<number, string> = {
      0x02: "非法資料位址",
      0x03: "非法資料值",
      0x09: "CRC 錯誤",
    };
    throw new Error(
      `Modbus 例外: ${exceptionMessages[exceptionCode] ?? `code 0x${exceptionCode.toString(16)}`}`
    );
  }

  if (response[1] !== 0x03) {
    throw new Error(`非預期的 function code: 0x${response[1].toString(16)}`);
  }

  const byteCount = response[2];
  const expectedLength = 3 + byteCount + 2;
  if (response.length < expectedLength) {
    throw new Error(
      `資料不完整: 預期 ${expectedLength} bytes, 收到 ${response.length}`
    );
  }

  const dataPart = response.subarray(0, 3 + byteCount);
  const receivedCrc = response.readUInt16LE(3 + byteCount);
  const calculatedCrc = crc16(dataPart);

  const registers: number[] = [];
  for (let i = 0; i < byteCount; i += 2) {
    registers.push(response.readUInt16BE(3 + i));
  }

  return { registers, crcOk: receivedCrc === calculatedCrc };
}

export interface ModbusConnection {
  host: string;
  port: number;
}

export class ModbusSession {
  private socket: net.Socket | null = null;
  private connected = false;
  private readonly conn: ModbusConnection;

  constructor(conn: ModbusConnection) {
    this.conn = conn;
  }

  async connect(): Promise<void> {
    for (let attempt = 0; attempt < CONNECT_MAX_RETRIES; attempt++) {
      try {
        await this.connectOnce();
        return;
      } catch (err) {
        this.close();
        if (attempt < CONNECT_MAX_RETRIES - 1) {
          await sleep(1000);
        } else {
          throw err;
        }
      }
    }
  }

  private connectOnce(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.setTimeout(CONNECT_TIMEOUT);

      this.socket.on("connect", () => {
        this.connected = true;
        resolve();
      });

      this.socket.on("error", (err) => {
        this.connected = false;
        reject(new Error(`TCP 連線失敗: ${err.message}`));
      });

      this.socket.on("timeout", () => {
        this.socket?.destroy();
        this.connected = false;
        reject(new Error(`TCP 連線逾時: ${this.conn.host}:${this.conn.port}`));
      });

      this.socket.on("close", () => {
        this.connected = false;
      });

      this.socket.connect(this.conn.port, this.conn.host);
    });
  }

  async readRegisters(
    slaveId: number,
    startAddress: number,
    quantity: number
  ): Promise<number[]> {
    if (!this.socket || !this.connected) {
      throw new Error("未連線");
    }

    return new Promise((resolve, reject) => {
      let responseBuffer = Buffer.alloc(0);
      let settled = false;
      const timer = setTimeout(() => {
        settle(() => reject(new Error("讀取逾時")));
      }, READ_TIMEOUT);

      const settle = (fn: () => void) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          this.socket?.removeListener("data", onData);
          fn();
        }
      };

      const onData = (data: Buffer) => {
        responseBuffer = Buffer.concat([responseBuffer, data]);

        if (responseBuffer.length >= 5 && responseBuffer[1] & 0x80) {
          settle(() => {
            try {
              parseReadResponse(slaveId, responseBuffer);
              resolve([]);
            } catch (err) {
              reject(err);
            }
          });
          return;
        }

        if (responseBuffer.length >= 3) {
          const expectedBytes = responseBuffer[2];
          const expectedTotal = 3 + expectedBytes + 2;
          if (responseBuffer.length >= expectedTotal) {
            settle(() => {
              try {
                resolve(parseReadResponse(slaveId, responseBuffer));
              } catch (err) {
                reject(err);
              }
            });
          }
        }
      };

      this.socket!.on("data", onData);
      this.socket!.write(buildReadRequest(slaveId, startAddress, quantity));
    });
  }

  async readRegistersWithRetry(
    slaveId: number,
    startAddress: number,
    quantity: number,
    maxRetries = 2
  ): Promise<number[]> {
    const effectiveQty = Math.min(quantity, MODBUS_MAX_READ_WORDS);
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.readRegisters(slaveId, startAddress, effectiveQty);
      } catch {
        if (attempt < maxRetries - 1) {
          await sleep(RS485_BUS_INTERVAL_MS * 2);
        }
      }
    }
    throw new Error(`讀取失敗 (${maxRetries} 次重試): addr=0x${startAddress.toString(16)}`);
  }

  async readRegistersSoft(
    slaveId: number,
    startAddress: number,
    quantity: number
  ): Promise<SoftReadResult> {
    if (!this.socket || !this.connected) {
      throw new Error("未連線");
    }

    return new Promise((resolve, reject) => {
      let responseBuffer = Buffer.alloc(0);
      let settled = false;
      const timer = setTimeout(() => {
        settle(() => reject(new Error("讀取逾時")));
      }, READ_TIMEOUT);

      const settle = (fn: () => void) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          this.socket?.removeListener("data", onData);
          fn();
        }
      };

      const onData = (data: Buffer) => {
        responseBuffer = Buffer.concat([responseBuffer, data]);

        if (responseBuffer.length >= 5 && responseBuffer[1] & 0x80) {
          settle(() => {
            try {
              resolve(parseReadResponseSoft(slaveId, responseBuffer));
            } catch (err) {
              reject(err);
            }
          });
          return;
        }

        if (responseBuffer.length >= 3) {
          const expectedBytes = responseBuffer[2];
          const expectedTotal = 3 + expectedBytes + 2;
          if (responseBuffer.length >= expectedTotal) {
            settle(() => {
              try {
                resolve(parseReadResponseSoft(slaveId, responseBuffer));
              } catch (err) {
                reject(err);
              }
            });
          }
        }
      };

      this.socket!.on("data", onData);
      this.socket!.write(buildReadRequest(slaveId, startAddress, quantity));
    });
  }

  async readRegistersWithVote(
    slaveId: number,
    startAddress: number,
    quantity: number,
    maxAttempts = 5,
    minAgreement = 2
  ): Promise<number[]> {
    const effectiveQty = Math.min(quantity, MODBUS_MAX_READ_WORDS);
    const voteCounts = new Map<string, { count: number; registers: number[] }>();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await this.readRegistersSoft(
          slaveId,
          startAddress,
          effectiveQty
        );

        if (result.crcOk) {
          return result.registers;
        }

        if (result.registers.length > 0) {
          const key = result.registers.join(",");
          const entry = voteCounts.get(key);
          const newCount = (entry?.count ?? 0) + 1;
          voteCounts.set(key, { count: newCount, registers: result.registers });

          if (newCount >= minAgreement) {
            return result.registers;
          }
        }
      } catch {
        // timeout or structural error
      }

      if (attempt < maxAttempts - 1) {
        await sleep(RS485_BUS_INTERVAL_MS);
      }
    }

    throw new Error(
      `多數決讀取失敗 (${maxAttempts} 次嘗試): addr=0x${startAddress.toString(16)}`
    );
  }

  close(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
      this.connected = false;
    }
  }
}

export async function readModbusRegisters(
  conn: ModbusConnection,
  slaveId: number,
  startAddress: number,
  quantity: number
): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let responseBuffer = Buffer.alloc(0);
    let settled = false;

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;
        cleanup();
        fn();
      }
    };

    socket.setTimeout(CONNECT_TIMEOUT);

    socket.on("connect", () => {
      socket.setTimeout(READ_TIMEOUT);
      const request = buildReadRequest(slaveId, startAddress, quantity);
      socket.write(request);
    });

    socket.on("data", (data) => {
      responseBuffer = Buffer.concat([responseBuffer, data]);
      if (responseBuffer.length >= 5 && responseBuffer[1] & 0x80) {
        settle(() => {
          try {
            parseReadResponse(slaveId, responseBuffer);
            resolve([]);
          } catch (err) {
            reject(err);
          }
        });
        return;
      }
      if (responseBuffer.length >= 3) {
        const expectedBytes = responseBuffer[2];
        const expectedTotal = 3 + expectedBytes + 2;
        if (responseBuffer.length >= expectedTotal) {
          settle(() => {
            try {
              const registers = parseReadResponse(slaveId, responseBuffer);
              resolve(registers);
            } catch (err) {
              reject(err);
            }
          });
        }
      }
    });

    socket.on("timeout", () => {
      settle(() => reject(new Error(`連線逾時: ${conn.host}:${conn.port}`)));
    });

    socket.on("error", (err) => {
      settle(() => reject(new Error(`TCP 錯誤: ${err.message}`)));
    });

    socket.on("close", () => {
      settle(() => reject(new Error("連線意外關閉")));
    });

    socket.connect(conn.port, conn.host);
  });
}

export async function readRegisterWithRetry(
  conn: ModbusConnection,
  slaveId: number,
  address: number,
  maxRetries = 2
): Promise<number | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const [value] = await readModbusRegisters(conn, slaveId, address, 1);
      return value;
    } catch {
      if (attempt < maxRetries - 1) {
        await sleep(RS485_BUS_INTERVAL_MS * 2);
      }
    }
  }
  return null;
}

export async function readRegistersWithFallback(
  conn: ModbusConnection,
  slaveId: number,
  startAddress: number,
  quantity: number,
  maxRetries = 2
): Promise<number[]> {
  const effectiveQty = Math.min(quantity, MODBUS_MAX_READ_WORDS);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await readModbusRegisters(
        conn,
        slaveId,
        startAddress,
        effectiveQty
      );
    } catch {
      if (attempt < maxRetries - 1) {
        await sleep(RS485_BUS_INTERVAL_MS * 2);
      }
    }
  }

  throw new Error(`批量讀取失敗: addr=0x${startAddress.toString(16)}, qty=${effectiveQty}`);
}

export function deviceAddress(
  baseAddress: number,
  deviceIndex: number,
  shift: number
): number {
  return baseAddress | (deviceIndex << shift);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
