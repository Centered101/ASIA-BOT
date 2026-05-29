/*
  ASIA-BOT RFID Attendance Controller
  Production-ready ESP32 sketch for:
  - ESP32 DevKit V1
  - MFRC522 RFID reader
  - SSD1306 OLED 128x32
  - Passive buzzer
  - Local WebServer controller
  - Next.js + Supabase backend

  Required libraries:
  MFRC522, ArduinoJson, Adafruit GFX, Adafruit SSD1306
*/

// ---------------------------------------------------------------------------
// Libraries
// ---------------------------------------------------------------------------
#include <SPI.h>
#include <Wire.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <MFRC522.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"

// ---------------------------------------------------------------------------
// Hardware pins
// ---------------------------------------------------------------------------
#define RC522_SS_PIN 5
#define RC522_RST_PIN 16
#define OLED_SDA_PIN 21
#define OLED_SCL_PIN 22
#define BUZZER_PIN 4
#define LED_PIN 2

// ---------------------------------------------------------------------------
// Device defaults
// ---------------------------------------------------------------------------
#define SERIAL_BAUD 115200
#define WIFI_TIMEOUT_MS 10000
#define AP_SSID "ASIA-BOT-Setup"
#define AP_PASS ""
#define DEFAULT_API_CHECK_URL "https://asia-lb.vercel.app/api/rfid/check"
#define DEFAULT_DEVICE_ID "esp32-rfid-01-demo"
#define DEFAULT_DEVICE_KEY ""

#define OLED_ADDR 0x3C
#define OLED_W 128
#define OLED_H 32

#define MIFARE_DATA_BLOCK 1
#define CACHE_MAX 300
#define SCAN_QUEUE_SIZE 40
#define HTTP_TIMEOUT_MS 12000
#define CARD_DEBOUNCE_MS 900

// ---------------------------------------------------------------------------
// Mode definitions
// ---------------------------------------------------------------------------
enum DeviceMode : uint8_t {
  MODE_IDLE = 0,
  MODE_BIND = 1,
  MODE_SCHOOL = 2,
  MODE_LIBRARY = 3,
  MODE_MEETING = 4,
  MODE_RESET = 5,
  MODE_UPLOAD_HW_UID = 6
};

enum EventType : uint8_t {
  EVENT_CHECK = 0,
  EVENT_BIND = 1,
  EVENT_RESET = 2,
  EVENT_UPLOAD_HW_UID = 3
};

const char *MODE_NAMES[] = {
  "idle", "bind", "school", "library", "meeting", "reset", "upload_hw_uid"
};

const char *MODE_LABELS[] = {
  "Idle", "Bind UID", "School", "Library", "Meeting", "Reset", "Upload HW-UID"
};

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------
MFRC522 rfid(RC522_SS_PIN, RC522_RST_PIN);
MFRC522::MIFARE_Key mifareKey;
Adafruit_SSD1306 oled(OLED_W, OLED_H, &Wire, -1);
WebServer server(80);
Preferences prefs;

QueueHandle_t scanQueue;
SemaphoreHandle_t stateMutex;
SemaphoreHandle_t cacheMutex;
SemaphoreHandle_t httpMutex;

// ---------------------------------------------------------------------------
// Data models
// ---------------------------------------------------------------------------
struct CardCache {
  char uid[40];
  char studentId[20];
  char name[56];
  char nickname[32];
};

struct ScanEvent {
  uint8_t type;
  uint8_t attempts;
  char uid[40];
  char location[16];
  char studentId[20];
  unsigned long createdAt;
};

CardCache cardCache[CACHE_MAX];
int cacheCount = 0;
bool cacheReady = false;

// ---------------------------------------------------------------------------
// Runtime state
// ---------------------------------------------------------------------------
DeviceMode currentMode = MODE_SCHOOL;
String deviceId = DEFAULT_DEVICE_ID;
String deviceKey = DEFAULT_DEVICE_KEY;
String apiCheckUrl = DEFAULT_API_CHECK_URL;
String apiBaseUrl = "";
String wifiSsid = "";
String wifiPass = "";
String bindStudentId = "";

String lastUid = "";
String lastResult = "boot";
String lastName = "";
String lastAction = "";
String lastLocation = "school";
String ipText = "";
bool oledReady = false;
bool resetConfirmed = false;
bool apMode = false;
unsigned long lastCardMs = 0;

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------
String jsonEscape(const String &s) {
  String out;
  out.reserve(s.length() + 8);
  for (uint16_t i = 0; i < s.length(); i++) {
    char c = s[i];
    if (c == '"' || c == '\\') {
      out += '\\';
      out += c;
    } else if (c == '\n') {
      out += "\\n";
    } else if (c == '\r') {
      out += "\\r";
    } else {
      out += c;
    }
  }
  return out;
}

String normalizeUid(String uid) {
  uid.trim();
  uid.toUpperCase();
  uid.replace(":", "");
  uid.replace("-", "");
  uid.replace(" ", "");
  return uid;
}

String endpointFor(const char *route) {
  int idx = apiCheckUrl.indexOf("/api/rfid/");
  if (idx >= 0) return apiCheckUrl.substring(0, idx) + "/api/rfid/" + route;
  String base = apiCheckUrl;
  if (base.endsWith("/")) return base + route;
  return base + "/" + route;
}

String locationForMode(DeviceMode mode) {
  if (mode == MODE_LIBRARY) return "library";
  if (mode == MODE_MEETING) return "meeting";
  return "school";
}

void setStateResult(const String &uid, const String &result, const String &name = "", const String &action = "") {
  if (xSemaphoreTake(stateMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
    lastUid = uid;
    lastResult = result;
    lastName = name;
    lastAction = action;
    lastLocation = locationForMode(currentMode);
    xSemaphoreGive(stateMutex);
  }
}

// ---------------------------------------------------------------------------
// Speaker helpers
// ---------------------------------------------------------------------------
void toneOnce(int hz, int ms) {
  tone(BUZZER_PIN, hz, ms);
  delay(ms + 5);
  noTone(BUZZER_PIN);
}

void beepPass() {
  toneOnce(1200, 80);
  delay(30);
  toneOnce(1800, 130);
}

void beepFail() {
  for (int i = 0; i < 3; i++) {
    toneOnce(400, 100);
    delay(60);
  }
}

void beepClick() {
  toneOnce(1500, 45);
}

// ---------------------------------------------------------------------------
// OLED helpers
// ---------------------------------------------------------------------------
void oledShow(const String &l1, const String &l2 = "", const String &l3 = "", const String &l4 = "") {
  if (!oledReady) return;
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(1);
  oled.setCursor(0, 0);
  oled.println(l1.substring(0, 21));
  oled.println(l2.substring(0, 21));
  oled.println(l3.substring(0, 21));
  oled.println(l4.substring(0, 21));
  oled.display();
}

void oledStatus() {
  String modeName = MODE_LABELS[(int)currentMode];
  String pending = String(uxQueueMessagesWaiting(scanQueue));
  oledShow("ASIA-BOT RFID", ipText, modeName + " P:" + pending, lastResult);
}

// ---------------------------------------------------------------------------
// NVS configuration
// ---------------------------------------------------------------------------
void loadConfig() {
  prefs.begin("rfid", true);
  wifiSsid = prefs.getString("ssid", "");
  wifiPass = prefs.getString("pass", "");
  apiCheckUrl = prefs.getString("api", DEFAULT_API_CHECK_URL);
  deviceId = prefs.getString("dev_id", DEFAULT_DEVICE_ID);
  deviceKey = prefs.getString("dev_key", DEFAULT_DEVICE_KEY);
  currentMode = (DeviceMode)prefs.getUChar("mode", MODE_SCHOOL);
  prefs.end();
  apiBaseUrl = endpointFor("");
}

void saveConfig() {
  prefs.begin("rfid", false);
  prefs.putString("ssid", wifiSsid);
  prefs.putString("pass", wifiPass);
  prefs.putString("api", apiCheckUrl);
  prefs.putString("dev_id", deviceId);
  prefs.putString("dev_key", deviceKey);
  prefs.putUChar("mode", (uint8_t)currentMode);
  prefs.end();
  apiBaseUrl = endpointFor("");
}

// ---------------------------------------------------------------------------
// WiFi / AP mode
// ---------------------------------------------------------------------------
bool connectWiFi() {
  if (!wifiSsid.length()) return false;

  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSsid.c_str(), wifiPass.c_str());
  oledShow("WiFi Connecting", wifiSsid);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT_MS) {
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    delay(250);
  }

  digitalWrite(LED_PIN, LOW);
  if (WiFi.status() != WL_CONNECTED) return false;

  apMode = false;
  ipText = WiFi.localIP().toString();
  oledShow("WiFi Connected", ipText, MODE_LABELS[(int)currentMode]);
  return true;
}

void startAccessPoint() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);
  apMode = true;
  ipText = WiFi.softAPIP().toString();
  oledShow("AP MODE", AP_SSID, ipText);
}

void reconnectWiFiIfNeeded() {
  if (apMode) return;
  if (WiFi.status() == WL_CONNECTED) return;
  setStateResult(lastUid, "wifi_reconnect");
  connectWiFi();
}

// ---------------------------------------------------------------------------
// HTTP client helpers
// ---------------------------------------------------------------------------
bool beginHttp(HTTPClient &http, WiFiClientSecure &secureClient, const String &url) {
  if (url.startsWith("https://")) {
    secureClient.setInsecure();
    return http.begin(secureClient, url);
  }
  return http.begin(url);
}

String httpRequest(const String &method, const String &url, const String &body = "") {
  if (WiFi.status() != WL_CONNECTED) return "{\"status\":\"error\",\"message\":\"wifi_disconnected\"}";
  if (xSemaphoreTake(httpMutex, pdMS_TO_TICKS(HTTP_TIMEOUT_MS + 3000)) != pdTRUE) {
    return "{\"status\":\"error\",\"message\":\"http_busy\"}";
  }

  WiFiClientSecure secureClient;
  HTTPClient http;
  String response = "";

  if (!beginHttp(http, secureClient, url)) {
    xSemaphoreGive(httpMutex);
    return "{\"status\":\"error\",\"message\":\"http_begin_failed\"}";
  }

  http.setTimeout(HTTP_TIMEOUT_MS);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.addHeader("Content-Type", "application/json");
  if (deviceKey.length()) http.addHeader("x-device-key", deviceKey);

  int code = method == "POST" ? http.POST(body) : http.GET();
  if (code > 0) response = http.getString();
  else response = "{\"status\":\"error\",\"message\":\"http_code_" + String(code) + "\"}";

  http.end();
  xSemaphoreGive(httpMutex);
  return response;
}

// ---------------------------------------------------------------------------
// RFID low-level helpers
// ---------------------------------------------------------------------------
String hardwareUid() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

bool authBlock(byte block) {
  return rfid.PCD_Authenticate(
    MFRC522::PICC_CMD_MF_AUTH_KEY_A,
    block,
    &mifareKey,
    &(rfid.uid)
  ) == MFRC522::STATUS_OK;
}

String readCardBlock() {
  if (!authBlock(MIFARE_DATA_BLOCK)) return "";
  byte buffer[18];
  byte size = sizeof(buffer);
  MFRC522::StatusCode status = rfid.MIFARE_Read(MIFARE_DATA_BLOCK, buffer, &size);
  if (status != MFRC522::STATUS_OK) return "";

  String value = "";
  for (byte i = 0; i < 16; i++) {
    char c = (char)buffer[i];
    if (c >= 32 && c <= 126) value += c;
  }
  value.trim();
  return normalizeUid(value);
}

bool writeCardBlock(const String &value) {
  if (!authBlock(MIFARE_DATA_BLOCK)) return false;
  byte data[16];
  memset(data, 0, sizeof(data));
  String shortValue = value.substring(0, 16);
  for (uint8_t i = 0; i < shortValue.length() && i < 16; i++) {
    data[i] = shortValue[i];
  }
  return rfid.MIFARE_Write(MIFARE_DATA_BLOCK, data, 16) == MFRC522::STATUS_OK;
}

String makeBindUid(const String &studentId, const String &hwUid) {
  String uid = studentId + "-" + hwUid;
  uid.toUpperCase();
  return uid.substring(0, 16);
}

void stopCardCrypto() {
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------
int findCacheIndex(const String &uid) {
  String n = normalizeUid(uid);
  int found = -1;
  if (xSemaphoreTake(cacheMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
    for (int i = 0; i < cacheCount; i++) {
      if (n == String(cardCache[i].uid)) {
        found = i;
        break;
      }
    }
    xSemaphoreGive(cacheMutex);
  }
  return found;
}

String cacheNameAt(int idx) {
  if (idx < 0 || idx >= cacheCount) return "";
  String name = String(cardCache[idx].name);
  String nick = String(cardCache[idx].nickname);
  if (nick.length()) name += " (" + nick + ")";
  return name;
}

bool reloadCache() {
  String response = httpRequest("GET", endpointFor("cache"));
  DynamicJsonDocument doc(32768);
  DeserializationError err = deserializeJson(doc, response);
  if (err) {
    setStateResult(lastUid, "cache_json_error");
    return false;
  }

  JsonArray arr;
  if (doc.is<JsonArray>()) arr = doc.as<JsonArray>();
  else if (doc["data"].is<JsonArray>()) arr = doc["data"].as<JsonArray>();
  else return false;

  if (xSemaphoreTake(cacheMutex, pdMS_TO_TICKS(1000)) != pdTRUE) return false;
  cacheCount = 0;
  for (JsonObject item : arr) {
    if (cacheCount >= CACHE_MAX) break;
    String uid = normalizeUid(String(item["uid"] | ""));
    if (!uid.length()) continue;
    String sid = String(item["student_id"] | "");
    String name = String(item["name"] | "");
    String nick = String(item["nickname"] | "");
    uid.toCharArray(cardCache[cacheCount].uid, sizeof(cardCache[cacheCount].uid));
    sid.toCharArray(cardCache[cacheCount].studentId, sizeof(cardCache[cacheCount].studentId));
    name.toCharArray(cardCache[cacheCount].name, sizeof(cardCache[cacheCount].name));
    nick.toCharArray(cardCache[cacheCount].nickname, sizeof(cardCache[cacheCount].nickname));
    cacheCount++;
  }
  cacheReady = true;
  xSemaphoreGive(cacheMutex);

  setStateResult(lastUid, "cache_loaded");
  oledShow("Cache Loaded", String(cacheCount) + " cards", ipText);
  return true;
}

// ---------------------------------------------------------------------------
// Queue helpers
// ---------------------------------------------------------------------------
bool enqueueEvent(const ScanEvent &event) {
  return xQueueSend(scanQueue, &event, pdMS_TO_TICKS(100)) == pdTRUE;
}

ScanEvent makeEvent(EventType type, const String &uid, const String &location, const String &studentId = "") {
  ScanEvent event;
  memset(&event, 0, sizeof(event));
  event.type = type;
  event.attempts = 0;
  event.createdAt = millis();
  uid.toCharArray(event.uid, sizeof(event.uid));
  location.toCharArray(event.location, sizeof(event.location));
  studentId.toCharArray(event.studentId, sizeof(event.studentId));
  return event;
}

// ---------------------------------------------------------------------------
// Backend operations
// ---------------------------------------------------------------------------
bool postJsonAndHandle(const String &url, const String &body, String &result, String &personName, String &action) {
  String response = httpRequest("POST", url, body);
  DynamicJsonDocument doc(4096);
  if (deserializeJson(doc, response) != DeserializationError::Ok) {
    result = "json_error";
    return false;
  }

  String status = String(doc["status"] | "error");
  bool ok = status == "ok" || status == "success" || doc["success"].as<bool>();
  String errorText = String(doc["code"] | "");
  if (!errorText.length()) errorText = String(doc["message"] | "");
  if (!errorText.length()) errorText = status;
  result = ok ? "ok" : errorText;
  personName = String(doc["name"] | "");
  action = String(doc["action"] | "");
  if (!action.length()) action = String(doc["legacy_action"] | "");

  if (!personName.length() && doc["student"].is<JsonObject>()) {
    JsonObject student = doc["student"];
    personName = String(student["first_name"] | "");
    String last = String(student["last_name"] | "");
    if (last.length()) personName += " " + last;
  }

  return ok;
}

bool processEvent(ScanEvent &event) {
  String uid = String(event.uid);
  String location = String(event.location);
  String studentId = String(event.studentId);
  String url;
  String body;

  if (event.type == EVENT_CHECK) {
    url = endpointFor("check");
    body = "{\"uid\":\"" + jsonEscape(uid) +
           "\",\"location\":\"" + jsonEscape(location) +
           "\",\"device_id\":\"" + jsonEscape(deviceId) + "\"}";
  } else if (event.type == EVENT_BIND || event.type == EVENT_UPLOAD_HW_UID) {
    url = endpointFor("bind");
    body = "{\"student_id\":\"" + jsonEscape(studentId) +
           "\",\"uid\":\"" + jsonEscape(uid) +
           "\",\"card_type\":\"mifare\",\"device_id\":\"" + jsonEscape(deviceId) + "\"}";
  } else {
    url = endpointFor("reset");
    body = "{\"uid\":\"" + jsonEscape(uid) +
           "\",\"status\":\"inactive\",\"device_id\":\"" + jsonEscape(deviceId) + "\"}";
  }

  String result;
  String personName;
  String action;
  bool ok = postJsonAndHandle(url, body, result, personName, action);
  setStateResult(uid, ok ? result : "send_failed:" + result, personName, action);

  if (ok) {
    beepPass();
    if (event.type == EVENT_CHECK) oledShow(action.length() ? action : "Attendance", personName, uid, location);
    else if (event.type == EVENT_BIND) oledShow("Bind OK", studentId, uid);
    else if (event.type == EVENT_RESET) oledShow("Reset OK", uid);
    else oledShow("Upload OK", uid);
    if (event.type == EVENT_BIND || event.type == EVENT_RESET || event.type == EVENT_UPLOAD_HW_UID) reloadCache();
  } else {
    beepFail();
    oledShow("API Failed", result, uid);
  }

  return ok;
}

// ---------------------------------------------------------------------------
// FreeRTOS tasks
// ---------------------------------------------------------------------------
void httpTask(void *param) {
  ScanEvent event;
  while (true) {
    reconnectWiFiIfNeeded();
    if (xQueueReceive(scanQueue, &event, pdMS_TO_TICKS(500)) == pdTRUE) {
      bool ok = processEvent(event);
      if (!ok && event.attempts < 5) {
        event.attempts++;
        vTaskDelay(pdMS_TO_TICKS(1200 + event.attempts * 900));
        enqueueEvent(event);
      }
    }
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

void rfidTask(void *param) {
  while (true) {
    if (currentMode == MODE_IDLE) {
      vTaskDelay(pdMS_TO_TICKS(120));
      continue;
    }

    if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
      vTaskDelay(pdMS_TO_TICKS(45));
      continue;
    }

    unsigned long now = millis();
    if (now - lastCardMs < CARD_DEBOUNCE_MS) {
      stopCardCrypto();
      vTaskDelay(pdMS_TO_TICKS(80));
      continue;
    }
    lastCardMs = now;

    String hwUid = hardwareUid();
    String blockUid = readCardBlock();
    String uid = blockUid.length() ? blockUid : hwUid;
    String location = locationForMode(currentMode);
    setStateResult(uid, "read");

    if (currentMode == MODE_BIND) {
      if (!bindStudentId.length()) {
        setStateResult(uid, "missing_student_id");
        oledShow("Bind Mode", "Set student_id", uid);
        beepFail();
      } else {
        String customUid = makeBindUid(bindStudentId, hwUid);
        bool wrote = writeCardBlock(customUid);
        String useUid = wrote ? normalizeUid(customUid) : hwUid;
        enqueueEvent(makeEvent(EVENT_BIND, useUid, location, bindStudentId));
        oledShow("Bind Queued", bindStudentId, useUid, wrote ? "MIFARE" : "HW-UID");
        beepClick();
      }
    } else if (currentMode == MODE_RESET) {
      if (!resetConfirmed) {
        setStateResult(uid, "reset_not_confirmed");
        oledShow("Reset Mode", "Press confirm", uid);
        beepFail();
      } else {
        enqueueEvent(makeEvent(EVENT_RESET, uid, location));
        resetConfirmed = false;
        oledShow("Reset Queued", uid);
        beepClick();
      }
    } else if (currentMode == MODE_UPLOAD_HW_UID) {
      if (!bindStudentId.length()) {
        setStateResult(hwUid, "missing_student_id");
        oledShow("Upload HW UID", "Set student_id", hwUid);
        beepFail();
      } else {
        enqueueEvent(makeEvent(EVENT_UPLOAD_HW_UID, hwUid, location, bindStudentId));
        oledShow("HW UID Queued", bindStudentId, hwUid);
        beepClick();
      }
    } else {
      int idx = findCacheIndex(uid);
      if (cacheReady && idx < 0) {
        setStateResult(uid, "cache_not_found");
        oledShow("Unknown Card", uid, "Reload cache?");
        beepFail();
      } else {
        String name = idx >= 0 ? cacheNameAt(idx) : "";
        enqueueEvent(makeEvent(EVENT_CHECK, uid, location));
        setStateResult(uid, "queued", name);
        oledShow("Queued", name.length() ? name : uid, location, "P:" + String(uxQueueMessagesWaiting(scanQueue)));
        beepClick();
      }
    }

    stopCardCrypto();
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

// ---------------------------------------------------------------------------
// Web server helpers
// ---------------------------------------------------------------------------
void cors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type,x-device-key");
}

void sendJson(int code, const String &json) {
  cors();
  server.send(code, "application/json", json);
}

void sendText(int code, const String &text, const String &type = "text/plain") {
  cors();
  server.send(code, type, text);
}

String statusJson() {
  String modeName = MODE_NAMES[(int)currentMode];
  String modeLabel = MODE_LABELS[(int)currentMode];
  String ip = apMode ? WiFi.softAPIP().toString() : WiFi.localIP().toString();
  return "{\"device_id\":\"" + jsonEscape(deviceId) +
         "\",\"mode\":" + String((int)currentMode) +
         ",\"mode_name\":\"" + jsonEscape(modeName) +
         "\",\"mode_label\":\"" + jsonEscape(modeLabel) +
         "\",\"uid\":\"" + jsonEscape(lastUid) +
         "\",\"result\":\"" + jsonEscape(lastResult) +
         "\",\"name\":\"" + jsonEscape(lastName) +
         "\",\"action\":\"" + jsonEscape(lastAction) +
         "\",\"location\":\"" + jsonEscape(locationForMode(currentMode)) +
         "\",\"cacheCount\":" + String(cacheCount) +
         ",\"cacheReady\":" + String(cacheReady ? "true" : "false") +
         ",\"pending\":" + String(uxQueueMessagesWaiting(scanQueue)) +
         ",\"ip\":\"" + jsonEscape(ip) +
         "\",\"wifi\":\"" + String(WiFi.status() == WL_CONNECTED ? "connected" : (apMode ? "ap" : "disconnected")) +
         "\",\"resetReady\":" + String(resetConfirmed ? "true" : "false") +
         ",\"oled\":" + String(oledReady ? "true" : "false") + "}";
}

const char DASHBOARD_HTML[] PROGMEM = R"HTML(
<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ASIA-BOT RFID</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Kanit:wght@400;700;900&display=swap');
*{box-sizing:border-box}body{margin:0;background:#0d0d0d;color:#e8ffe8;font-family:Kanit,Arial,sans-serif}
.wrap{max-width:980px;margin:auto;padding:18px}.top{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
h1{font-size:24px;margin:0;color:#1ED760;font-weight:900}.mono{font-family:'JetBrains Mono',monospace}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:16px 0}
.card{border:1px solid #1e3a29;background:#111;border-radius:8px;padding:12px}.label{font-size:11px;color:#7a9b84}.val{font-size:18px;font-weight:900;word-break:break-word}
.bar{display:flex;gap:8px;flex-wrap:wrap}.btn{border:1px solid #1ED760;background:#102316;color:#1ED760;border-radius:7px;padding:10px 12px;font-weight:800;cursor:pointer}
.btn:hover{background:#1ED760;color:#071108}.danger{border-color:#ff5b5b;color:#ff7777;background:#241010}.field{display:grid;gap:5px;margin:10px 0}
input{background:#070707;border:1px solid #254630;color:white;border-radius:7px;padding:10px;font-family:'JetBrains Mono',monospace}
.row{display:grid;grid-template-columns:1fr auto;gap:8px}.small{font-size:12px;color:#89a68f;margin-top:14px}
</style></head><body><div class="wrap">
<div class="top"><h1>ASIA-BOT RFID Controller</h1><span class="mono" id="online">...</span></div>
<div class="grid">
<div class="card"><div class="label">MODE</div><div class="val" id="mode">-</div></div>
<div class="card"><div class="label">IP</div><div class="val mono" id="ip">-</div></div>
<div class="card"><div class="label">LAST UID</div><div class="val mono" id="uid">-</div></div>
<div class="card"><div class="label">RESULT</div><div class="val" id="result">-</div></div>
<div class="card"><div class="label">CACHE</div><div class="val" id="cache">-</div></div>
<div class="card"><div class="label">PENDING</div><div class="val" id="pending">-</div></div>
</div>
<div class="card"><div class="label">MODES</div><div class="bar">
<button class="btn" onclick="mode(0)">Idle</button><button class="btn" onclick="mode(1)">Bind</button><button class="btn" onclick="mode(2)">School</button>
<button class="btn" onclick="mode(3)">Library</button><button class="btn" onclick="mode(4)">Meeting</button><button class="btn danger" onclick="mode(5)">Reset</button>
<button class="btn" onclick="mode(6)">Upload HW</button></div></div>
<div class="card">
<div class="field"><label class="label">STUDENT ID FOR BIND</label><div class="row"><input id="sid" placeholder="3130"><button class="btn" onclick="student()">Set</button></div></div>
<div class="bar"><button class="btn danger" onclick="get('/confirm_reset')">Confirm Reset</button><button class="btn" onclick="get('/reload')">Reload Cache</button><button class="btn" onclick="get('/test_oled')">Test OLED</button><button class="btn" onclick="get('/test_speaker')">Test Speaker</button><button class="btn" onclick="get('/test_led')">Test LED</button></div>
</div>
<div class="card"><div class="label">CONFIG</div>
<div class="field"><input id="api" placeholder="https://your-domain.com/api/rfid/check"></div>
<div class="field"><input id="did" placeholder="device_id"></div>
<div class="field"><input id="key" placeholder="device key"></div>
<div class="field"><input id="ssid" placeholder="WiFi SSID"></div>
<div class="field"><input id="pass" placeholder="WiFi Password"></div>
<button class="btn" onclick="config()">Save Config</button><div class="small">WiFi changes restart after save.</div></div>
</div><script>
async function get(u){try{await fetch(u);poll()}catch(e){}}
function mode(n){get('/mode?set='+n)}
function student(){get('/set_student?id='+encodeURIComponent(document.getElementById('sid').value))}
function config(){let p=new URLSearchParams();['api','did','key','ssid','pass'].forEach(id=>{let v=document.getElementById(id).value;if(v)p.set(id,v)});get('/config?'+p)}
async function poll(){try{let r=await fetch('/status');let s=await r.json();online.textContent=s.wifi;mode.textContent=s.mode_label;ip.textContent=s.ip;uid.textContent=s.uid||'-';result.textContent=s.result;cache.textContent=s.cacheCount;pending.textContent=s.pending}catch(e){online.textContent='offline'}}
setInterval(poll,1200);poll();
</script></body></html>
)HTML";

// ---------------------------------------------------------------------------
// Web route handlers
// ---------------------------------------------------------------------------
void handleRoot() {
  cors();
  server.send_P(200, "text/html", DASHBOARD_HTML);
}

void handleStatus() {
  sendJson(200, statusJson());
}

void handleMode() {
  if (!server.hasArg("set")) {
    sendJson(400, "{\"status\":\"error\",\"message\":\"missing_set\"}");
    return;
  }
  int m = server.arg("set").toInt();
  if (m < 0 || m > 6) {
    sendJson(400, "{\"status\":\"error\",\"message\":\"invalid_mode\"}");
    return;
  }
  currentMode = (DeviceMode)m;
  saveConfig();
  resetConfirmed = false;
  setStateResult(lastUid, "mode_changed");
  oledStatus();
  sendJson(200, "{\"status\":\"ok\",\"mode\":" + String(m) + "}");
}

void handleSetStudent() {
  bindStudentId = server.arg("id");
  bindStudentId.trim();
  setStateResult(lastUid, "student_set");
  oledShow("Student ID", bindStudentId);
  sendJson(200, "{\"status\":\"ok\",\"student_id\":\"" + jsonEscape(bindStudentId) + "\"}");
}

void handleConfirmReset() {
  resetConfirmed = true;
  setStateResult(lastUid, "reset_confirmed");
  oledShow("Reset Confirmed", "Tap card now");
  sendJson(200, "{\"status\":\"ok\",\"resetReady\":true}");
}

void handleReload() {
  bool ok = reloadCache();
  sendJson(ok ? 200 : 500, "{\"status\":\"" + String(ok ? "ok" : "error") + "\",\"cacheCount\":" + String(cacheCount) + "}");
}

void handleTestLed() {
  for (int i = 0; i < 4; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(80);
    digitalWrite(LED_PIN, LOW);
    delay(80);
  }
  sendJson(200, "{\"status\":\"ok\"}");
}

void handleTestSpeaker() {
  beepPass();
  sendJson(200, "{\"status\":\"ok\"}");
}

void handleTestOled() {
  oledShow("OLED OK", "ASIA-BOT RFID", ipText, MODE_LABELS[(int)currentMode]);
  sendJson(200, "{\"status\":\"ok\"}");
}

void handleConfig() {
  if (server.hasArg("api")) apiCheckUrl = server.arg("api");
  if (server.hasArg("did")) deviceId = server.arg("did");
  if (server.hasArg("key")) deviceKey = server.arg("key");
  if (server.hasArg("ssid")) wifiSsid = server.arg("ssid");
  if (server.hasArg("pass")) wifiPass = server.arg("pass");
  saveConfig();
  sendJson(200, "{\"status\":\"ok\",\"restart_required\":true}");
  delay(500);
  ESP.restart();
}

void handleNotFound() {
  if (server.method() == HTTP_OPTIONS) {
    sendText(204, "");
    return;
  }
  sendJson(404, "{\"status\":\"error\",\"message\":\"not_found\"}");
}

void setupRoutes() {
  server.on("/", HTTP_GET, handleRoot);
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/mode", HTTP_GET, handleMode);
  server.on("/set_student", HTTP_GET, handleSetStudent);
  server.on("/confirm_reset", HTTP_GET, handleConfirmReset);
  server.on("/reload", HTTP_GET, handleReload);
  server.on("/test_led", HTTP_GET, handleTestLed);
  server.on("/test_speaker", HTTP_GET, handleTestSpeaker);
  server.on("/test_oled", HTTP_GET, handleTestOled);
  server.on("/config", HTTP_GET, handleConfig);
  server.onNotFound(handleNotFound);
  server.enableCORS(true);
  server.begin();
}

// ---------------------------------------------------------------------------
// Setup / loop
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(SERIAL_BAUD);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
  oledReady = oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);
  if (oledReady) oledShow("ASIA-BOT RFID", "Booting...");

  SPI.begin();
  rfid.PCD_Init();
  for (byte i = 0; i < 6; i++) mifareKey.keyByte[i] = 0xFF;

  stateMutex = xSemaphoreCreateMutex();
  cacheMutex = xSemaphoreCreateMutex();
  httpMutex = xSemaphoreCreateMutex();
  scanQueue = xQueueCreate(SCAN_QUEUE_SIZE, sizeof(ScanEvent));

  loadConfig();
  if (!connectWiFi()) startAccessPoint();
  setupRoutes();

  if (!apMode) reloadCache();

  xTaskCreatePinnedToCore(rfidTask, "rfidTask", 8192, NULL, 2, NULL, 1);
  xTaskCreatePinnedToCore(httpTask, "httpTask", 12288, NULL, 1, NULL, 0);

  beepPass();
  oledStatus();
  Serial.println("ASIA-BOT RFID controller ready: http://" + ipText);
}

void loop() {
  server.handleClient();
  static unsigned long lastUi = 0;
  if (millis() - lastUi > 2500) {
    lastUi = millis();
    oledStatus();
  }
  delay(5);
}
