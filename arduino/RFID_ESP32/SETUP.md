# ASIA-BOT RFID ESP32 Setup

## 1. Hardware Wiring

### MFRC522 RFID

| RC522 | ESP32 |
| --- | --- |
| SDA | GPIO 5 |
| SCK | GPIO 18 |
| MOSI | GPIO 23 |
| MISO | GPIO 19 |
| RST | GPIO 16 |
| 3.3V | 3.3V |
| GND | GND |

### OLED SSD1306 128x32

| OLED | ESP32 |
| --- | --- |
| SDA | GPIO 21 |
| SCL | GPIO 22 |
| VCC | 3.3V |
| GND | GND |

### Passive Buzzer

| Buzzer | ESP32 |
| --- | --- |
| + | GPIO 4 |
| - | GND |

## 2. Arduino IDE Setup

Install board package:

```txt
https://espressif.github.io/arduino-esp32/package_esp32_index.json
```

Arduino IDE:

```txt
File > Preferences > Additional Boards Manager URLs
```

Then install:

```txt
Tools > Board > Boards Manager > esp32 by Espressif Systems
```

Recommended board settings:

```txt
Board: ESP32 Dev Module
Upload Speed: 921600 or 115200
CPU Frequency: 240MHz
Flash Frequency: 80MHz
Flash Mode: QIO
Partition Scheme: Default 4MB with spiffs
Core Debug Level: None
Port: your ESP32 COM port
```

## 3. Required Libraries

Install from Arduino Library Manager:

```txt
MFRC522
ArduinoJson
Adafruit GFX Library
Adafruit SSD1306
```

Built-in with ESP32 core:

```txt
WiFi
HTTPClient
WebServer
Preferences
SPI
Wire
```

## 4. Open And Upload

Open this file in Arduino IDE:

```txt
arduino/RFID_ESP32/RFID_ESP32.ino
```

Click Upload.

If upload fails, hold `BOOT` while Arduino IDE shows `Connecting...`, then release.

Open Serial Monitor:

```txt
Baud: 115200
```

## 5. First Boot WiFi Setup

If ESP32 cannot connect WiFi within 10 seconds, it opens AP mode:

```txt
SSID: ASIA-BOT-Setup
Password: none
URL: http://192.168.4.1
```

Connect phone/laptop to `ASIA-BOT-Setup`, open:

```txt
http://192.168.4.1
```

Fill config:

```txt
API URL: https://your-domain.com/api/rfid/check
Device ID: esp32-rfid-01
Device Key: same key as rfid_devices.device_key or RFID_STATION_SECRET
WiFi SSID: your WiFi
WiFi Password: your WiFi password
```

Click Save Config. ESP32 will restart.

## 6. Backend Device Auth

If using `RFID_STATION_SECRET` in Next.js env:

```env
RFID_STATION_SECRET=your-secret
```

Set ESP32 `Device Key` to the same value.

If using `rfid_devices` table:

```sql
insert into public.rfid_devices (device_id, device_key, name, location, status)
values ('esp32-rfid-01', 'your-secret', 'Main Gate', 'school', 'active')
on conflict (device_id) do update
set device_key = excluded.device_key,
    name = excluded.name,
    location = excluded.location,
    status = 'active';
```

## 7. Test ESP32 Routes

After ESP32 joins WiFi, Serial Monitor shows:

```txt
ASIA-BOT RFID controller ready: http://<esp-ip>
```

Open:

```txt
http://<esp-ip>/
```

Test JSON status:

```txt
http://<esp-ip>/status
```

Expected fields:

```json
{
  "device_id": "esp32-rfid-01",
  "mode": 2,
  "mode_name": "school",
  "uid": "",
  "result": "boot",
  "cacheCount": 0,
  "pending": 0,
  "ip": "192.168.x.x"
}
```

## 8. Mode Usage

| Mode | URL | Description |
| --- | --- | --- |
| Idle | `/mode?set=0` | Stop scanning |
| Bind | `/mode?set=1` | Bind card to student |
| School | `/mode?set=2` | Attendance school |
| Library | `/mode?set=3` | Attendance library |
| Meeting | `/mode?set=4` | Attendance meeting |
| Reset | `/mode?set=5` | Reset card |
| Upload HW UID | `/mode?set=6` | Bind using hardware UID |

Bind card:

```txt
http://<esp-ip>/set_student?id=3130
http://<esp-ip>/mode?set=1
tap card
```

Reset card:

```txt
http://<esp-ip>/mode?set=5
http://<esp-ip>/confirm_reset
tap card
```

Reload cache:

```txt
http://<esp-ip>/reload
```

## 9. Troubleshooting

If OLED is blank:

```txt
Check SDA GPIO21, SCL GPIO22, VCC 3.3V, address 0x3C
```

If RFID does not read:

```txt
Use 3.3V only, not 5V
Check SDA GPIO5, RST GPIO16
Keep wires short
```

If backend returns unauthorized:

```txt
Check Device Key equals RFID_STATION_SECRET or rfid_devices.device_key
Check device_id equals rfid_devices.device_id
```

If cache is 0:

```txt
Check /api/rfid/cache returns active cards
Check Supabase rfid_cards.status = active
Check students exist for student_id
```

