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
  #include "mbedtls/base64.h"
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
#define WIFI_TIMEOUT_MS 30000
  #define AP_SSID "ASIA-BOT-Setup"
  #define AP_PASS ""
  #define DEFAULT_API_CHECK_URL "https://asia-lb.vercel.app/api/rfid/check"
  #define DEFAULT_DEVICE_ID "esp32-rfid-01"
  #define DEFAULT_DEVICE_KEY ""
  #define CONTROLLER_AUTH_CACHE_MS 300000

  #define OLED_ADDR 0x3C
  #define OLED_W 128
  #define OLED_H 32

  #define MIFARE_DATA_BLOCK 1
#define SCAN_QUEUE_SIZE 40
  #define WEB_LOG_SIZE 30
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
SemaphoreHandle_t httpMutex;

  // ---------------------------------------------------------------------------
  // Data models
  // ---------------------------------------------------------------------------
struct ScanEvent {
    uint8_t type;
    uint8_t attempts;
    char uid[40];
    char location[16];
    char studentId[20];
    unsigned long createdAt;
  };

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
  String bindCardUid = "";
  String bindStudentName = "";
  String bindStudentMeta = "";
  String bindCardStatus = "";

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
  String webLogs[WEB_LOG_SIZE];
  uint8_t webLogPos = 0;
  bool webLogFull = false;
  String authCacheUser = "";
  String authCachePass = "";
  unsigned long authCacheUntil = 0;

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

  String urlEncode(const String &s) {
    String out;
    const char *hex = "0123456789ABCDEF";
    for (uint16_t i = 0; i < s.length(); i++) {
      uint8_t c = (uint8_t)s[i];
      if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.' || c == '~') {
        out += (char)c;
      } else {
        out += '%';
        out += hex[c >> 4];
        out += hex[c & 0x0F];
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

  String uptimeText() {
    unsigned long sec = millis() / 1000;
    unsigned long min = sec / 60;
    sec %= 60;
    char buf[16];
    snprintf(buf, sizeof(buf), "%02lu:%02lu", min, sec);
    return String(buf);
  }

  void addWebLog(const String &level, const String &message) {
    String line = uptimeText() + " [" + level + "] " + message;
    if (xSemaphoreTake(stateMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      webLogs[webLogPos] = line;
      webLogPos = (webLogPos + 1) % WEB_LOG_SIZE;
      if (webLogPos == 0) webLogFull = true;
      xSemaphoreGive(stateMutex);
    }
    Serial.println(line);
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
    addWebLog(result.startsWith("send_failed") ? "ERROR" : "INFO", "uid=" + uid + " result=" + result);
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

void beepCountdown(uint8_t remainSec) {
  int hz = remainSec <= 5 ? 2200 : remainSec <= 10 ? 1700 : 1200;
  toneOnce(hz, remainSec <= 5 ? 45 : 60);
  if (remainSec <= 5) {
    delay(70);
    toneOnce(hz + 240, 35);
  }
}

  void beepConnectSuccess() {
    toneOnce(1000, 70);
    delay(35);
    toneOnce(1500, 90);
    delay(35);
    toneOnce(2100, 140);
  }

  void beepConnectFail() {
    for (int i = 0; i < 4; i++) {
      toneOnce(520 - i * 70, 90);
      delay(35);
    }
    toneOnce(180, 260);
  }

  // ---------------------------------------------------------------------------
  // OLED helpers
  // ---------------------------------------------------------------------------
void oledShow(const String &l1, const String &l2 = "", const String &l3 = "", const String &l4 = "") {
  if (!oledReady) return;
  oled.invertDisplay(false);
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

void oledSuccess(const String &l1, const String &l2 = "", const String &l3 = "", const String &l4 = "") {
  oledShow("OK " + l1, l2, l3, l4);
  if (!oledReady) return;
  delay(60);
  oled.invertDisplay(true);
  delay(80);
  oled.invertDisplay(false);
}

void oledError(const String &l1, const String &l2 = "", const String &l3 = "", const String &l4 = "") {
  oledShow("ERR " + l1, l2, l3, l4);
  if (!oledReady) return;
  for (int i = 0; i < 3; i++) {
    oled.invertDisplay(true);
    delay(90);
    oled.invertDisplay(false);
    delay(70);
  }
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
  unsigned long lastBeep = 0;
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT_MS) {
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    if (millis() - lastBeep >= 1000) {
      uint8_t remain = (WIFI_TIMEOUT_MS - (millis() - start)) / 1000;
      oledShow("WiFi Connecting", wifiSsid, "Countdown: " + String(remain), "Please wait");
      beepCountdown(remain);
      lastBeep = millis();
    }
      delay(80);
    }

    digitalWrite(LED_PIN, LOW);
    if (WiFi.status() != WL_CONNECTED) {
      oledError("WiFi Failed", wifiSsid, "Open AP setup");
      beepConnectFail();
      return false;
    }

    apMode = false;
    ipText = WiFi.localIP().toString();
  oledSuccess("WiFi Connected", ipText, MODE_LABELS[(int)currentMode]);
    beepConnectSuccess();
    return true;
  }

  void startAccessPoint() {
    WiFi.mode(WIFI_AP_STA);
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
    value.toUpperCase();
    return value;
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

  void stopCardCrypto() {
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
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
    Serial.println("API URL: " + url);
    Serial.println("API BODY: " + body);
    Serial.println("API RESPONSE: " + response);
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

  bool loadStudentBindUid(const String &studentId, String &uidOut, String &nameOut, String &metaOut, String &cardStatusOut, String &messageOut) {
    if (!studentId.length()) {
      messageOut = "missing_student_id";
      return false;
    }

    String url = endpointFor("bind") + "?student_id=" + urlEncode(studentId) + "&device_id=" + urlEncode(deviceId);
    String response = httpRequest("GET", url);
    Serial.println("BIND UID URL: " + url);
    Serial.println("BIND UID RESPONSE: " + response);

    DynamicJsonDocument doc(2048);
    if (deserializeJson(doc, response) != DeserializationError::Ok) {
      messageOut = "json_error";
      return false;
    }

    String status = String(doc["status"] | "error");
    bool ok = status == "ok" || status == "success" || doc["success"].as<bool>();
    if (!ok) {
      messageOut = String(doc["code"] | "");
      if (!messageOut.length()) messageOut = String(doc["message"] | status);
      return false;
    }

    uidOut = String(doc["uid"] | "");
    uidOut.trim();
    uidOut.toUpperCase();
    if (!uidOut.length()) {
      messageOut = "missing_uid";
      return false;
    }

    nameOut = "";
    metaOut = "";
    cardStatusOut = "";
    if (doc["student"].is<JsonObject>()) {
      JsonObject student = doc["student"];
      String first = String(student["first_name"] | "");
      String last = String(student["last_name"] | "");
      String nickname = String(student["nickname"] | "");
      String program = String(student["program"] | "");
      String department = String(student["department"] | "");
      String entryYear = String(student["entry_year"] | "");
      cardStatusOut = String(student["card_status"] | "");
      nameOut = first;
      if (last.length()) nameOut += " " + last;
      if (nickname.length()) nameOut += " (" + nickname + ")";
      metaOut = program;
      if (department.length()) metaOut += " / " + department;
      if (entryYear.length()) metaOut += " / " + entryYear;
    }

    messageOut = "student_uid_loaded";
    return true;
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
            "\",\"card_type\":\"mifare\",\"device_id\":\"" + jsonEscape(deviceId) + "\"";
      if (event.type == EVENT_UPLOAD_HW_UID) body += ",\"force_uid\":true";
      body += "}";
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
      if (event.type == EVENT_CHECK) oledSuccess(action.length() ? action : "Attendance", personName, uid, location);
      else if (event.type == EVENT_BIND) oledSuccess("Bind OK", studentId, uid);
      else if (event.type == EVENT_RESET) oledSuccess("Reset OK", uid);
      else oledSuccess("Upload OK", uid);
    } else {
      beepFail();
      oledError("API Failed", result, uid);
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
          oledError("Bind Mode", "Set student_id", uid);
          beepFail();
        } else {
          if (!bindCardUid.length()) {
            String msg;
            if (loadStudentBindUid(bindStudentId, bindCardUid, bindStudentName, bindStudentMeta, bindCardStatus, msg)) {
              addWebLog("INFO", "โหลด UID ซ้ำก่อนเขียนบัตร " + bindStudentId + " = " + bindCardUid);
            }
          }

          if (!bindCardUid.length()) {
            setStateResult(uid, "missing_uid");
            oledError("Bind Mode", "Load UID first", bindStudentId);
            beepFail();
          } else if (bindCardUid.length() > 16) {
            setStateResult(uid, "uid_too_long");
            oledError("UID Too Long", bindStudentId, bindCardUid);
            beepFail();
          } else {
            bool wrote = writeCardBlock(bindCardUid);
            if (wrote) {
              enqueueEvent(makeEvent(EVENT_BIND, bindCardUid, location, bindStudentId));
              oledShow("Bind Queued", bindStudentId, bindCardUid, "Register UID");
              beepClick();
            } else {
              setStateResult(uid, "write_failed");
              oledError("Write Failed", bindStudentId, bindCardUid);
              beepFail();
            }
          }
        }
      } else if (currentMode == MODE_RESET) {
        if (!resetConfirmed) {
          setStateResult(uid, "reset_not_confirmed");
        oledError("Reset Mode", "Press confirm", uid);
          beepFail();
        } else {
          bool erased = writeCardBlock("");
          if (erased) {
            enqueueEvent(makeEvent(EVENT_RESET, uid, location));
            resetConfirmed = false;
            oledShow("Reset Queued", uid, "Card block erased");
            beepClick();
          } else {
            resetConfirmed = false;
            setStateResult(uid, "erase_failed");
            oledError("Erase Failed", uid, "Try again");
            beepFail();
          }
        }
      } else if (currentMode == MODE_UPLOAD_HW_UID) {
        if (!bindStudentId.length()) {
          setStateResult(hwUid, "missing_student_id");
        oledError("Upload HW UID", "Set student_id", hwUid);
          beepFail();
        } else {
          enqueueEvent(makeEvent(EVENT_UPLOAD_HW_UID, hwUid, location, bindStudentId));
          oledShow("HW UID Queued", bindStudentId, hwUid);
          beepClick();
        }
      } else {
      enqueueEvent(makeEvent(EVENT_CHECK, uid, location));
      setStateResult(uid, "queued");
      oledShow("Queued", uid, location, "P:" + String(uxQueueMessagesWaiting(scanQueue)));
      beepClick();
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

  bool decodeBasicAuth(String &username, String &password) {
    String header = server.header("Authorization");
    if (!header.startsWith("Basic ")) return false;

    String encoded = header.substring(6);
    encoded.trim();
    unsigned char decoded[128];
    size_t decodedLen = 0;
    int rc = mbedtls_base64_decode(
      decoded,
      sizeof(decoded) - 1,
      &decodedLen,
      (const unsigned char *)encoded.c_str(),
      encoded.length()
    );
    if (rc != 0 || decodedLen == 0) return false;

    decoded[decodedLen] = 0;
    String credentials = String((char *)decoded);
    int sep = credentials.indexOf(':');
    if (sep <= 0) return false;

    username = credentials.substring(0, sep);
    password = credentials.substring(sep + 1);
    username.trim();
    return username.length() > 0 && password.length() > 0;
  }

  bool validateControllerAuth(const String &username, const String &password) {
    unsigned long now = millis();
    if (authCacheUntil > now && username == authCacheUser && password == authCachePass) return true;

    String body = "{\"username\":\"" + jsonEscape(username) +
                  "\",\"password\":\"" + jsonEscape(password) +
                  "\",\"device_id\":\"" + jsonEscape(deviceId) + "\"}";
    String response = httpRequest("POST", endpointFor("controller-auth"), body);
    DynamicJsonDocument doc(1024);
    if (deserializeJson(doc, response) != DeserializationError::Ok) return false;

    String status = String(doc["status"] | "error");
    bool ok = status == "ok" || status == "success" || doc["ok"].as<bool>();
    if (ok) {
      authCacheUser = username;
      authCachePass = password;
      authCacheUntil = now + CONTROLLER_AUTH_CACHE_MS;
    }
    return ok;
  }

  bool requireControllerAuth() {
    if (apMode) return true;
    String username;
    String password;
    if (decodeBasicAuth(username, password) && validateControllerAuth(username, password)) return true;
    server.requestAuthentication(BASIC_AUTH, "ASIA-BOT RFID", "ต้องเข้าสู่ระบบก่อนใช้ controller");
    return false;
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
          "\",\"bind_student_id\":\"" + jsonEscape(bindStudentId) +
          "\",\"bind_uid\":\"" + jsonEscape(bindCardUid) +
          "\",\"bind_student_name\":\"" + jsonEscape(bindStudentName) +
          "\",\"bind_student_meta\":\"" + jsonEscape(bindStudentMeta) +
          "\",\"bind_card_status\":\"" + jsonEscape(bindCardStatus) +
          "\",\"pending\":" + String(uxQueueMessagesWaiting(scanQueue)) +
          ",\"ip\":\"" + jsonEscape(ip) +
          "\",\"wifi\":\"" + String(WiFi.status() == WL_CONNECTED ? "connected" : (apMode ? "ap" : "disconnected")) +
          "\",\"resetReady\":" + String(resetConfirmed ? "true" : "false") +
          ",\"oled\":" + String(oledReady ? "true" : "false") + "}";
  }

  const char DASHBOARD_HTML[] PROGMEM = R"HTML(
  <!doctype html><html><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ASIA-BOT RFID Controller</title>
  <link rel="icon" href="https://asia-lb.vercel.app/admin/rfid.ico" type="image/x-icon">
  <link rel="shortcut icon" href="https://asia-lb.vercel.app/admin/rfid.ico" type="image/x-icon">
  <meta name="theme-color" content="#0b0f0d">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Sarabun:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600;1,700&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Kanit:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Source+Code+Pro:ital,wght@0,200..900;1,200..900&display=swap');
  :root{--bg:#0b0f0d;--panel:#111815;--panel2:#0f1512;--line:#26332d;--text:#e5e7eb;--muted:#8b949e;--green:#3ecf8e;--green2:#2aa876;--red:#f87171;--amber:#fbbf24}
  *{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(180deg,#0b0f0d,#090c0b);color:var(--text);font-family:Kanit,Sarabun,Arial,sans-serif}
  .wrap{max-width:1040px;margin:auto;padding:18px}.top{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:12px;border:1px solid var(--line);background:rgba(17,24,21,.88);box-shadow:0 14px 40px rgba(0,0,0,.24);border-radius:8px;position:sticky;top:10px;z-index:5;backdrop-filter:blur(12px)}
  .brand{display:flex;align-items:center;gap:10px;min-width:0}.brand-mark{width:34px;height:34px;border:1px solid #2f5f49;border-radius:8px;background:#0d1411;display:flex;align-items:center;justify-content:center;color:var(--green);box-shadow:0 0 22px rgba(62,207,142,.18)}h1{font-size:17px;margin:0;color:#fff;font-weight:900;line-height:1.1}.subhead{font-size:11px;color:var(--muted);margin-top:2px}.head-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.mono{font-family:'JetBrains Mono','Source Code Pro',monospace}
  #online{border:1px solid var(--line);background:#0d1411;color:var(--green);border-radius:999px;padding:7px 10px;font-size:12px}.admin-link{border:1px solid #2f5f49;background:#102019;color:var(--green);border-radius:7px;padding:8px 10px;font-size:12px;text-decoration:none;font-weight:800;display:inline-flex;gap:7px;align-items:center}.admin-link:hover{background:var(--green);color:#06110c}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:16px 0}
  .card{border:1px solid var(--line);background:linear-gradient(180deg,var(--panel),var(--panel2));border-radius:8px;padding:14px;box-shadow:0 10px 30px rgba(0,0,0,.18)}.label{font-size:11px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.04em}.val{font-size:18px;font-weight:900;word-break:break-word;color:#fff}
  .bar{display:flex;gap:8px;flex-wrap:wrap}.btn{border:1px solid #2f5f49;background:#102019;color:var(--green);border-radius:7px;padding:10px 12px;font-weight:800;cursor:pointer;transition:.15s;display:inline-flex;align-items:center;gap:7px}
  .btn:hover{background:var(--green);border-color:var(--green);color:#06110c}.danger{border-color:#6b3030;color:var(--red);background:#221313}.danger:hover{background:var(--red);border-color:var(--red);color:#180707}.field{display:grid;gap:5px;margin:10px 0}
  input{background:#0b1110;border:1px solid var(--line);color:#fff;border-radius:7px;padding:10px;font-family:'JetBrains Mono',monospace;outline:none}input:focus{border-color:var(--green);box-shadow:0 0 0 3px rgba(62,207,142,.12)}
  .row{display:grid;grid-template-columns:1fr auto;gap:8px}.small{font-size:12px;color:var(--muted);margin-top:14px}.hint{font-size:12px;color:#a7b8af;line-height:1.5;margin:8px 0 0}.section-title{font-size:14px;font-weight:900;color:#fff;margin-bottom:8px}.section-title:before{content:"";display:inline-block;width:6px;height:14px;background:var(--green);border-radius:99px;margin-right:8px;vertical-align:-2px}.warn{display:none;border:1px solid #755f21;background:#191405;color:#ffe59b;border-radius:8px;padding:10px;margin:12px 0;font-size:13px;line-height:1.5}.offline .warn{display:block}.offline .needs-net{opacity:.38;pointer-events:none;filter:grayscale(1)}[data-section]{display:none}[data-section].show{display:block}.mode-active{background:var(--green);border-color:var(--green);color:#06110c}details.card summary{cursor:pointer;list-style:none}details.card summary::-webkit-details-marker{display:none}
  </style></head><body><div class="wrap">
  <div class="top"><div class="brand"><div class="brand-mark"><i class="fa-solid fa-id-card-clip"></i></div><div><h1>ตัวควบคุม RFID ASIA-BOT</h1><div class="subhead">ESP32 Attendance Controller</div></div></div><div class="head-actions"><span class="mono" id="online">...</span><a class="admin-link" href="https://asia-lb.vercel.app/admin" target="_blank"><i class="fa-solid fa-arrow-up-right-from-square"></i>Admin</a></div></div>
  <div class="warn" id="apWarn">ตอนนี้เครื่องอยู่ใน AP Mode / ออฟไลน์ ใช้สำหรับตั้งค่า WiFi และ API เท่านั้น ยังอัพ UID, รีเซ็ตบัตร, โหลดแคช หรือส่งข้อมูลเข้า database ไม่ได้</div>
  <div class="grid">
  <div class="card"><div class="label"><i class="fa-solid fa-sliders"></i> โหมดปัจจุบัน</div><div class="val" id="mode">-</div></div>
  <div class="card"><div class="label"><i class="fa-solid fa-wifi"></i> IP</div><div class="val mono" id="ip">-</div></div>
  <div class="card"><div class="label"><i class="fa-solid fa-id-card"></i> UID ล่าสุด</div><div class="val mono" id="uid">-</div></div>
  <div class="card"><div class="label"><i class="fa-solid fa-circle-info"></i> ผลล่าสุด</div><div class="val" id="result">-</div></div>
  <div class="card"><div class="label"><i class="fa-solid fa-list-check"></i> คิวรอส่ง</div><div class="val" id="pending">-</div></div>
  </div>
  <div class="card">
  <div class="section-title">เลือกโหมดเครื่อง</div>
  <div class="bar">
  <button class="btn" data-mode-btn="0" onclick="mode(0)"><i class="fa-solid fa-pause"></i>พักเครื่อง</button><button class="btn" data-mode-btn="2" onclick="mode(2)"><i class="fa-solid fa-school"></i>เช็กชื่อโรงเรียน</button><button class="btn" data-mode-btn="3" onclick="mode(3)"><i class="fa-solid fa-book-open"></i>เช็กชื่อห้องสมุด</button>
  <button class="btn needs-net" data-mode-btn="4" onclick="mode(4)"><i class="fa-solid fa-users"></i>เช็กชื่อห้องประชุม</button><button class="btn needs-net" data-mode-btn="1" onclick="mode(1)"><i class="fa-solid fa-link"></i>บัตรเขียนได้</button><button class="btn needs-net" data-mode-btn="6" onclick="mode(6)"><i class="fa-solid fa-microchip"></i>บัตรเขียนไม่ได้</button>
  <button class="btn danger needs-net" data-mode-btn="5" onclick="mode(5)"><i class="fa-solid fa-rotate-left"></i>รีเซ็ตบัตร</button></div>
  </div>
  <div class="card" data-section="scan">
  <div class="section-title">พร้อมเช็กชื่อ</div>
  <div class="hint">แตะบัตรที่เครื่อง ระบบจะส่ง UID ไปตรวจที่ฐานข้อมูลทันที</div>
  <div class="hint">สถานที่ปัจจุบัน: <span class="mono" id="scanLoc">-</span></div>
  <div class="hint">นักเรียนล่าสุด: <span id="scanName">-</span></div>
  <div class="hint">ผลล่าสุด: <span id="scanResult">-</span></div>
  <div class="hint">UID ที่อ่านได้: <span class="mono" id="scanUid">-</span></div>
  </div>
  <div class="card" data-section="bind">
  <div class="section-title">ผูกบัตรนักเรียน</div>
  <div class="field"><label class="label">รหัสนักเรียน</label><div class="row"><input id="sid" placeholder="เช่น 3130"><button class="btn needs-net" onclick="student()"><i class="fa-solid fa-cloud-arrow-down"></i>โหลด UID</button></div></div>
  <div class="hint">นักเรียน: <span id="bindName">-</span></div>
  <div class="hint">ข้อมูล: <span id="bindMeta">-</span> · สถานะบัตร: <span id="bindStatus">-</span></div>
  <div class="hint">UID จากฐานข้อมูล: <span class="mono" id="bindUid">-</span></div>
  <div class="bar"><button class="btn needs-net" onclick="bindCard()"><i class="fa-solid fa-id-badge"></i>บัตรเขียนได้: เขียน UID ลงบัตร</button><button class="btn needs-net" onclick="uploadHw()"><i class="fa-solid fa-microchip"></i>บัตรเขียนไม่ได้: ใช้ Hardware UID</button></div>
  <div class="hint">แบบที่ 1: บัตรเขียนได้ → เขียน students.uid ลง memory block ของบัตร</div>
  <div class="hint">แบบที่ 2: บัตรเขียนไม่ได้ → แตะบัตรแล้วใช้ Hardware UID จริงผูกกับนักเรียนแทน</div>
  </div>
  <div class="card" data-section="reset">
  <div class="section-title">รีเซ็ตบัตร</div>
  <div class="bar"><button class="btn danger needs-net" onclick="resetCard()"><i class="fa-solid fa-triangle-exclamation"></i>ยืนยันรีเซ็ตบัตร</button><button class="btn" onclick="mode(0)"><i class="fa-solid fa-xmark"></i>ยกเลิก</button></div>
  <div class="hint">ขั้นตอน: กด “ยืนยันรีเซ็ตบัตร” → แตะบัตรที่ต้องการลบ/ปิดใช้งาน</div>
  </div>
  <div class="card" data-section="tools">
  <div class="section-title">เครื่องมือทดสอบ</div>
  <div class="bar"><button class="btn" onclick="get('/test_oled')"><i class="fa-solid fa-display"></i>ทดสอบจอ OLED</button><button class="btn" onclick="get('/test_speaker')"><i class="fa-solid fa-volume-high"></i>ทดสอบลำโพง</button><button class="btn" onclick="get('/test_led')"><i class="fa-solid fa-lightbulb"></i>ทดสอบไฟ LED</button></div>
  </div>
  <div class="card">
  <div class="section-title">บันทึกการทำงาน</div>
  <div id="logs" class="mono small" style="display:grid;gap:6px;max-height:260px;overflow:auto"></div>
  </div>
  <details class="card"><summary><div class="section-title">ตั้งค่าเครื่อง</div><div class="hint">กดเพื่อแก้ API, Device ID, Device Key หรือ WiFi</div></summary>
  <div class="field"><input id="api" placeholder="https://your-domain.com/api/rfid/check"></div>
  <div class="field"><input id="did" placeholder="device_id"></div>
  <div class="field"><input id="key" placeholder="รหัสลับอุปกรณ์ / device key"></div>
  <div class="field"><input id="ssid" placeholder="ชื่อ WiFi"></div>
  <div class="field"><input id="pass" placeholder="รหัสผ่าน WiFi"></div>
  <button class="btn" onclick="config()">บันทึกการตั้งค่า</button><div class="small">ถ้าเปลี่ยน WiFi เครื่องจะรีสตาร์ทหลังบันทึก</div></details>
  </div><script>
  async function get(u){try{await fetch(u);poll()}catch(e){}}
  function mode(n){get('/mode?set='+n)}
  async function student(){try{let r=await fetch('/set_student?id='+encodeURIComponent(document.getElementById('sid').value));let j=await r.json();poll();return j.status==='ok'}catch(e){return false}}
  async function bindCard(){if(await student())mode(1)}
  async function uploadHw(){if(await student())mode(6)}
  function resetCard(){mode(5);setTimeout(()=>get('/confirm_reset'),200)}
  function config(){let p=new URLSearchParams();['api','did','key','ssid','pass'].forEach(id=>{let v=document.getElementById(id).value;if(v)p.set(id,v)});get('/config?'+p)}
  async function pollLogs(){try{let r=await fetch('/logs');let arr=await r.json();logs.innerHTML=arr.map(x=>'<div style="border-bottom:1px solid #26332d;padding-bottom:4px">'+x+'</div>').join('')}catch(e){}}
  function showModeSections(m){
    document.querySelectorAll('[data-section]').forEach(el=>el.classList.remove('show'));
    if(m===1||m===6)document.querySelector('[data-section="bind"]')?.classList.add('show');
    else if(m===5)document.querySelector('[data-section="reset"]')?.classList.add('show');
    else if(m===0)document.querySelector('[data-section="tools"]')?.classList.add('show');
    else document.querySelector('[data-section="scan"]')?.classList.add('show');
    document.querySelectorAll('[data-mode-btn]').forEach(b=>b.classList.toggle('mode-active',Number(b.dataset.modeBtn)===m));
  }
  function thResult(v){
    const m={
      boot:'เริ่มระบบ',read:'อ่านบัตรแล้ว',queued:'เข้าคิวรอส่ง',ok:'สำเร็จ',
      wifi_reconnect:'กำลังต่อ WiFi ใหม่',mode_changed:'เปลี่ยนโหมดแล้ว',
      student_set:'ตั้งรหัสนักเรียนแล้ว',reset_confirmed:'ยืนยันรีเซ็ตแล้ว',
      missing_student_id:'ยังไม่ได้ใส่รหัสนักเรียน',reset_not_confirmed:'ยังไม่ได้ยืนยันรีเซ็ต',
      json_error:'อ่านข้อมูลตอบกลับไม่ได้',
      unauthorized:'รหัส Device Key ไม่ถูกต้อง',
      unknown_card:'ไม่พบบัตรนี้ในระบบ',
      inactive_card:'บัตรยังไม่พร้อมใช้งาน',
      student_not_found:'ไม่พบนักเรียน',
      missing_uid:'ไม่พบ UID',
      uid_too_long:'UID ยาวเกิน 16 ตัวอักษร',
      student_uid_loaded:'โหลด UID นักเรียนแล้ว',
      write_failed:'เขียน UID ลงบัตรไม่สำเร็จ',
      erase_failed:'ล้าง UID บนบัตรไม่สำเร็จ',
      wifi_disconnected:'WiFi หลุด',
      http_busy:'ระบบส่งข้อมูลกำลังทำงานอยู่',
      http_begin_failed:'เริ่มเชื่อมต่อ API ไม่สำเร็จ'
    };
    if(!v)return '-';
    if(m[v])return m[v];
    if(v.indexOf('send_failed:')===0){
      let code=v.replace('send_failed:','');
      return m[code]||('ส่งข้อมูลไม่สำเร็จ: '+code);
    }
    if(v.indexOf('http_code_')===0)return 'เชื่อมต่อ API ไม่สำเร็จ: '+v;
    return v;
  }
  async function poll(){try{let r=await fetch('/status');let s=await r.json();let off=s.wifi!=='connected';document.body.classList.toggle('offline',off);online.textContent=s.wifi==='connected'?'ออนไลน์':(s.wifi==='ap'?'AP Mode':s.wifi);mode.textContent=s.mode_label;ip.textContent=s.ip;uid.textContent=s.uid||'-';result.textContent=thResult(s.result);pending.textContent=s.pending;bindUid.textContent=s.bind_uid||'-';bindName.textContent=s.bind_student_name||'-';bindMeta.textContent=s.bind_student_meta||'-';bindStatus.textContent=s.bind_card_status||'-';scanLoc.textContent=s.location||'-';scanName.textContent=s.name||'-';scanResult.textContent=thResult(s.result);scanUid.textContent=s.uid||'-';showModeSections(Number(s.mode))}catch(e){document.body.classList.add('offline');online.textContent='ออฟไลน์'}}
  setInterval(poll,1200);setInterval(pollLogs,1500);poll();pollLogs();
  </script></body></html>
  )HTML";

  const char SETUP_HTML[] PROGMEM = R"HTML(
  <!doctype html><html><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ตั้งค่า ASIA-BOT RFID</title>
  <link rel="icon" href="https://asia-lb.vercel.app/admin/rfid.ico" type="image/x-icon">
  <link rel="shortcut icon" href="https://asia-lb.vercel.app/admin/rfid.ico" type="image/x-icon">
  <meta name="theme-color" content="#0b0f0d">
  <style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Kanit:wght@400;700;900&display=swap');
  :root{--bg:#0b0f0d;--panel:#111815;--line:#26332d;--text:#e5e7eb;--muted:#8b949e;--green:#3ecf8e;--amber:#fbbf24}
  *{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(180deg,#0b0f0d,#090c0b);color:var(--text);font-family:Kanit,Arial,sans-serif;display:flex;align-items:center;justify-content:center;padding:18px}
  .box{width:min(580px,100%);border:1px solid var(--line);background:linear-gradient(180deg,var(--panel),#0f1512);border-radius:8px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.35)}
  h1{font-size:24px;margin:0;color:#fff;font-weight:900}h1:before{content:"";display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--green);box-shadow:0 0 18px var(--green);margin-right:10px}.sub{color:#a7b8af;font-size:13px;line-height:1.6;margin:8px 0 16px}
  .warn{border:1px solid #755f21;background:#191405;color:#ffe59b;border-radius:8px;padding:10px;margin-bottom:14px;font-size:13px;line-height:1.5}
  .field{display:grid;gap:5px;margin:10px 0}.label{font-size:12px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.04em}
  input{width:100%;background:#0b1110;border:1px solid var(--line);color:#fff;border-radius:7px;padding:11px;font-family:'JetBrains Mono',monospace;outline:none}input:focus{border-color:var(--green);box-shadow:0 0 0 3px rgba(62,207,142,.12)}
  .btn{width:100%;border:1px solid #2f5f49;background:#102019;color:var(--green);border-radius:7px;padding:12px;font-weight:900;cursor:pointer;margin-top:12px;transition:.15s}
  .btn:hover{background:var(--green);border-color:var(--green);color:#06110c}.mono{font-family:'JetBrains Mono',monospace}.small{font-size:12px;color:var(--muted);margin-top:12px;line-height:1.6}.ok{color:var(--green)}.wifi-list{display:grid;gap:7px;margin:10px 0}.wifi{border:1px solid var(--line);background:#0b1110;color:var(--text);border-radius:7px;padding:10px;text-align:left;cursor:pointer}.wifi:hover{border-color:var(--green);background:#102019}.wifi b{color:var(--green)}.rssi{float:right;color:var(--muted)}
  </style></head><body><div class="box">
  <h1>ตั้งค่าเครื่อง RFID</h1>
  <div class="sub">AP Mode ใช้สำหรับตั้งค่า WiFi, API และรหัสอุปกรณ์เท่านั้น</div>
  <div class="warn">ตอนนี้เครื่องยังไม่ได้ต่ออินเทอร์เน็ต จึงยังไม่สามารถอัพ UID, รีเซ็ตบัตร หรือส่งข้อมูลเข้า database ได้</div>
  <div class="field"><label class="label">API URL</label><input id="api" value="https://asia-lb.vercel.app/api/rfid/check"></div>
  <div class="field"><label class="label">Device ID</label><input id="did" value="esp32-rfid-01"></div>
  <div class="field"><label class="label">Device Key</label><input id="key" placeholder="เช่น asia-rfid-2026-main-gate"></div>
  <button class="btn" onclick="scanWifi()">ค้นหา WiFi ใกล้เคียง</button>
  <div class="wifi-list" id="wifiList"></div>
  <div class="field"><label class="label">ชื่อ WiFi</label><input id="ssid" placeholder="WiFi โรงเรียน / บ้าน"></div>
  <div class="field"><label class="label">รหัสผ่าน WiFi</label><input id="pass" type="password" placeholder="รหัสผ่าน WiFi"></div>
  <button class="btn" onclick="save()">บันทึกและรีสตาร์ทเครื่อง</button>
  <div class="small">หลังรีสตาร์ท ถ้าเชื่อม WiFi สำเร็จ ให้เปิด Serial Monitor หรือดูใน router เพื่อหา IP แล้วเข้า <span class="mono ok">http://&lt;esp32-ip&gt;/</span> เพื่อใช้ controller จริง</div>
  <div class="small mono" id="msg"></div>
  </div><script>
  async function save(){
    let p=new URLSearchParams();
    ['api','did','key','ssid','pass'].forEach(id=>{let v=document.getElementById(id).value.trim();if(v)p.set(id,v)});
    msg.textContent='กำลังบันทึก...';
    try{await fetch('/config?'+p);msg.textContent='บันทึกแล้ว เครื่องกำลังรีสตาร์ท';}
    catch(e){msg.textContent='บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง';}
  }
async function scanWifi(){
  let left=30;
  wifiList.innerHTML='<div class="small" id="scanMsg">กำลังค้นหา WiFi... เหลือ '+left+' วินาที</div>';
  let timer=setInterval(()=>{
    left=Math.max(0,left-1);
    let el=document.getElementById('scanMsg');
    if(el)el.textContent='กำลังค้นหา WiFi... เหลือ '+left+' วินาที';
  },1000);
  try{
    let r=await fetch('/wifi_scan');
    let arr=await r.json();
    clearInterval(timer);
    if(!arr.length){wifiList.innerHTML='<div class="small">ไม่พบ WiFi</div>';return;}
    wifiList.innerHTML=arr.map(w=>'<button class="wifi" onclick="pickWifi(decodeURIComponent(\''+encodeURIComponent(w.ssid)+'\'))"><b>'+w.ssid+'</b><span class="rssi">'+w.rssi+' dBm</span><br><span class="small">'+(w.secure?'มีรหัสผ่าน':'ไม่ล็อก')+'</span></button>').join('');
  }catch(e){clearInterval(timer);wifiList.innerHTML='<div class="small">ค้นหา WiFi ไม่สำเร็จ</div>';}
}
  function pickWifi(s){ssid.value=s;pass.focus();}
  </script></body></html>
  )HTML";

  // ---------------------------------------------------------------------------
  // Web route handlers
  // ---------------------------------------------------------------------------
  void handleRoot() {
    if (!requireControllerAuth()) return;
    cors();
    server.send_P(200, "text/html", apMode ? SETUP_HTML : DASHBOARD_HTML);
  }

  void handleStatus() {
    if (!requireControllerAuth()) return;
    sendJson(200, statusJson());
  }

  void handleLogs() {
    if (!requireControllerAuth()) return;
    String json = "[";
    bool first = true;
    if (xSemaphoreTake(stateMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
      int count = webLogFull ? WEB_LOG_SIZE : webLogPos;
      for (int i = 0; i < count; i++) {
        int idx = (webLogPos - 1 - i + WEB_LOG_SIZE) % WEB_LOG_SIZE;
        if (webLogs[idx].length() == 0) continue;
        if (!first) json += ",";
        first = false;
        json += "\"" + jsonEscape(webLogs[idx]) + "\"";
      }
      xSemaphoreGive(stateMutex);
    }
    json += "]";
    sendJson(200, json);
  }

  void handleWifiScan() {
    if (!requireControllerAuth()) return;
    addWebLog("INFO", "เริ่มค้นหา WiFi");
    if (!apMode && WiFi.status() != WL_CONNECTED) WiFi.mode(WIFI_AP_STA);
    beepClick();
    oledShow("Scanning WiFi", "Please wait...");
    int count = WiFi.scanNetworks(false, true, false, 2300);
    String json = "[";
    for (int i = 0; i < count; i++) {
      if (i > 0) json += ",";
      json += "{\"ssid\":\"" + jsonEscape(WiFi.SSID(i)) + "\"";
      json += ",\"rssi\":" + String(WiFi.RSSI(i));
      json += ",\"secure\":" + String(WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "false" : "true") + "}";
    }
    json += "]";
    WiFi.scanDelete();
  oledSuccess("WiFi Scan Done", String(count) + " networks");
    addWebLog("INFO", "ค้นหา WiFi พบ " + String(count) + " เครือข่าย");
    sendJson(200, json);
  }

  void handleMode() {
    if (!requireControllerAuth()) return;
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
    addWebLog("INFO", "เปลี่ยนโหมดเป็น " + String(MODE_LABELS[(int)currentMode]));
    oledStatus();
    sendJson(200, "{\"status\":\"ok\",\"mode\":" + String(m) + "}");
  }

  void handleSetStudent() {
    if (!requireControllerAuth()) return;
    bindStudentId = server.arg("id");
    bindStudentId.trim();
    bindCardUid = "";
    bindStudentName = "";
    bindStudentMeta = "";
    bindCardStatus = "";

    String msg;
    if (!loadStudentBindUid(bindStudentId, bindCardUid, bindStudentName, bindStudentMeta, bindCardStatus, msg)) {
      setStateResult(lastUid, msg);
      addWebLog("ERROR", "โหลด UID ไม่สำเร็จ: " + bindStudentId + " / " + msg);
      oledError("UID Load Failed", bindStudentId, msg);
      beepFail();
      sendJson(400, "{\"status\":\"error\",\"message\":\"" + jsonEscape(msg) + "\",\"student_id\":\"" + jsonEscape(bindStudentId) + "\"}");
      return;
    }

    setStateResult(lastUid, "student_uid_loaded");
    addWebLog("INFO", "โหลด UID นักเรียน " + bindStudentId + " " + bindStudentName + " = " + bindCardUid);
    oledSuccess("UID Loaded", bindStudentId, bindStudentName, bindCardUid);
    beepPass();
    sendJson(200, "{\"status\":\"ok\",\"student_id\":\"" + jsonEscape(bindStudentId) + "\",\"uid\":\"" + jsonEscape(bindCardUid) + "\",\"name\":\"" + jsonEscape(bindStudentName) + "\",\"meta\":\"" + jsonEscape(bindStudentMeta) + "\",\"card_status\":\"" + jsonEscape(bindCardStatus) + "\"}");
  }

  void handleConfirmReset() {
    if (!requireControllerAuth()) return;
    resetConfirmed = true;
    setStateResult(lastUid, "reset_confirmed");
    addWebLog("WARN", "ยืนยันโหมดรีเซ็ตบัตร");
  oledSuccess("Reset Confirmed", "Tap card now");
    sendJson(200, "{\"status\":\"ok\",\"resetReady\":true}");
  }

void handleTestLed() {
    if (!requireControllerAuth()) return;
    for (int i = 0; i < 4; i++) {
      digitalWrite(LED_PIN, HIGH);
      delay(80);
      digitalWrite(LED_PIN, LOW);
      delay(80);
    }
    sendJson(200, "{\"status\":\"ok\"}");
  }

  void handleTestSpeaker() {
    if (!requireControllerAuth()) return;
    beepPass();
    sendJson(200, "{\"status\":\"ok\"}");
  }

  void handleTestOled() {
  if (!requireControllerAuth()) return;
  oledSuccess("OLED OK", "ASIA-BOT RFID", ipText, MODE_LABELS[(int)currentMode]);
    sendJson(200, "{\"status\":\"ok\"}");
  }

  void handleConfig() {
    if (!requireControllerAuth()) return;
    if (server.hasArg("api")) apiCheckUrl = server.arg("api");
    if (server.hasArg("did")) deviceId = server.arg("did");
    if (server.hasArg("key")) deviceKey = server.arg("key");
    if (server.hasArg("ssid")) wifiSsid = server.arg("ssid");
    if (server.hasArg("pass")) wifiPass = server.arg("pass");
    saveConfig();
    addWebLog("INFO", "บันทึกการตั้งค่าเครื่องและรีสตาร์ท");
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
    const char *headerKeys[] = {"Authorization"};
    server.collectHeaders(headerKeys, 1);
    server.on("/", HTTP_GET, handleRoot);
    server.on("/status", HTTP_GET, handleStatus);
    server.on("/logs", HTTP_GET, handleLogs);
    server.on("/wifi_scan", HTTP_GET, handleWifiScan);
    server.on("/mode", HTTP_GET, handleMode);
    server.on("/set_student", HTTP_GET, handleSetStudent);
    server.on("/confirm_reset", HTTP_GET, handleConfirmReset);
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
  httpMutex = xSemaphoreCreateMutex();
    scanQueue = xQueueCreate(SCAN_QUEUE_SIZE, sizeof(ScanEvent));

    loadConfig();
    if (!connectWiFi()) startAccessPoint();
    setupRoutes();

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
