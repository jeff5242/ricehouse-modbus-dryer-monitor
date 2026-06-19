# Moxa NPort 5150 配置指南

## 硬體接線

### 乾燥機 Modbus 基板 → NPort 5150 (Port 1)
```
乾燥機通訊基板 RS-485        NPort 5150 DB9
  D+ (Data+) ──────────── Pin 4 (D+)
  D- (Data-) ──────────── Pin 8 (D-)
  GND        ──────────── Pin 5 (GND)
```

### 水分計 Modbus 基板 → NPort 5150 (Port 2) 或第二台 NPort
```
水分計通訊基板 RS-485        NPort 5150 DB9
  D+ (Data+) ──────────── Pin 4 (D+)
  D- (Data-) ──────────── Pin 8 (D-)
  GND        ──────────── Pin 5 (GND)
```

> 注意: NPort 5150 只有 1 個串口。若需同時連接乾燥機和水分計兩塊基板，需要 **2 台 NPort 5150** 或使用 NPort 5250（2 埠版本）。

## NPort 網路配置

### 1. 初始設定（透過 NPort Administrator）

1. 下載 [NPort Administrator](https://www.moxa.com/en/support/product-support/software-and-documentation/search?psid=50535)
2. 將 NPort 與電腦接到同一個區域網路
3. 開啟 NPort Administrator → 搜尋 → 找到 NPort 設備
4. 設定 IP 位址:

| 設備 | IP | 用途 |
|------|-----|------|
| NPort #1 (乾燥機) | 192.168.1.101 | 乾燥機 Modbus 基板 |
| NPort #2 (水分計) | 192.168.1.102 | 水分計 Modbus 基板 |

### 2. 串口設定

進入 NPort Web Console (`http://192.168.1.101`) → Serial Settings:

| 參數 | 值 |
|------|-----|
| Baud Rate | 9600 (或 19200，依基板 DIP 設定) |
| Data Bits | 8 |
| Parity | None |
| Stop Bits | **2** |
| Flow Control | None |
| Interface | RS-485 2-wire |
| ADDC | Enable |

### 3. 操作模式設定

進入 Operating Settings:

| 參數 | 值 |
|------|-----|
| Operation Mode | **TCP Server** |
| Local TCP Port | **4001** (乾燥機) / **4002** (水分計) |
| Max Connection | 1 |
| Inactivity Timeout | 0 (不斷線) |
| Force Transmit | 50ms |

### 4. 安全設定

進入 Accessible IP Settings:
- 啟用 **Accessible IP List**
- 只加入 Vercel 的 IP 範圍（或暫時允許所有來測試）

## 路由器 Port Forwarding

在工廠路由器設定:

| 外部 Port | 內部 IP | 內部 Port | 備註 |
|-----------|---------|-----------|------|
| 4001 | 192.168.1.101 | 4001 | 乾燥機 NPort |
| 4002 | 192.168.1.102 | 4002 | 水分計 NPort |

## 驗證連線

從外部電腦測試 TCP 連線:

```bash
# 測試乾燥機 NPort
nc -v YOUR_FACTORY_IP 4001

# 或用 Python 測試 Modbus
python3 -c "
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(5)
s.connect(('YOUR_FACTORY_IP', 4001))
# 發送 Modbus RTU 讀取指令 (slave=0x80, addr=0x0000, qty=5)
s.send(bytes([0x80, 0x03, 0x00, 0x00, 0x00, 0x05, 0x9B, 0xDD]))
data = s.recv(256)
print('收到:', data.hex())
s.close()
"
```
