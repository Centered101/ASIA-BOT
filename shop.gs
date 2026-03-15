// ═══════════════════════════════════════════════════════════════════════
//  ASIA-BOT — Shop API  (Code_shop.gs)
//  ผู้พัฒนา: Centered101  |  v4.0  |  2025
//
//  ▸ GAS Project แยกต่างหาก (API_SHOP ใน config-students.js)
//  ▸ มี doGet() เป็นของตัวเอง — ไม่ต้องเชื่อมกับ Code.gs เดิม
//  ▸ ดึงข้อมูลนักเรียนจาก Spreadsheet เดิมผ่าน STUDENT_SS_ID
//
//  Spreadsheet:  สินค้า | ออเดอร์ | ชำระเงิน_Logs
//  Payment:      Stripe PromptPay
// ═══════════════════════════════════════════════════════════════════════

// ── 🔑 Keys & IDs — อัปเดตก่อน Deploy ───────────────────────────────
const STRIPE_SECRET_KEY =
  ""; // Stripe Dashboard → Developers → API keys

// ── 📧 Notification ────────────────────────────────────────────────────
const NOTIFY_EMAIL = "centered101@outlook.com"; // email แจ้งเตือน
// LINE Messaging API (ต่างจาก LINE Notify — ใช้ token จาก LINE Developers Console)
const LINE_TOKEN = "";
const LINE_USER = ""; // User ID ของ admin
const SHOP_LABEL = "สหกรณ์โรงเรียน ASIA-BOT";

// Spreadsheet ID ของ Shop (ดูจาก URL: /spreadsheets/d/{ID}/edit)
const SHOP_SS_ID = ""; // ← ใส่ ID ของ Spreadsheet Shop ใหม่

// ── ชื่อ Sheet ────────────────────────────────────────────────────────
const SHOP_SHEET_NAME = "สินค้า";
const ORDERS_SHEET_NAME = "ออเดอร์";
const PAY_LOG_SHEET = "ชำระเงิน_Logs";
const SHOP_DATA_START = 2; // แถวข้อมูลเริ่มที่ 2

// ── schema สินค้า ─────────────────────────────────────────────────────
//   A     B      C       D       E       F        G      H     I
//   id  | tag  | stock | name  | price | images | unit  | cat | cpst
const SHOP_COLUMNS = [
  { key: "id", label: "id", width: 120 },
  { key: "tag", label: "tag", width: 90 },
  { key: "stock", label: "stock", width: 80 },
  { key: "name", label: "name", width: 200 },
  { key: "price", label: "price", width: 80 },
  { key: "images", label: "images", width: 200 },
  { key: "unit", label: "unit", width: 90 },
  { key: "cat", label: "cat", width: 140 },
  { key: "cpst", label: "cpst", width: 90 },
];

// ── schema ออเดอร์ ────────────────────────────────────────────────────
const ORDER_COLUMNS = [
  { key: "order_id", label: "Order ID", width: 175 },
  { key: "order_ts", label: "เวลา", width: 160 },
  { key: "student_id", label: "รหัสนักเรียน", width: 125 },
  { key: "student_name", label: "ชื่อนักเรียน", width: 175 },
  { key: "items_json", label: "รายการ (JSON)", width: 350 },
  { key: "total", label: "ยอดรวม", width: 90 },
  { key: "pi_id", label: "PaymentIntent ID", width: 240 },
  { key: "status", label: "สถานะ", width: 100 },
  { key: "delivery_mode", label: "รับ/ส่ง", width: 100 },
  { key: "delivery_loc", label: "สถานที่", width: 160 },
  { key: "delivery_slot", label: "ช่วงเวลา", width: 130 },
];

// ── schema ชำระเงิน_Logs ──────────────────────────────────────────────
const PAY_LOG_COLUMNS = [
  { key: "log_ts", label: "เวลา", width: 160 },
  { key: "order_id", label: "Order ID", width: 175 },
  { key: "student_id", label: "รหัสนักเรียน", width: 125 },
  { key: "total", label: "ยอดรวม", width: 90 },
  { key: "pi_id", label: "PaymentIntent ID", width: 240 },
  { key: "stripe_status", label: "Stripe Status", width: 130 },
  { key: "status", label: "ผลลัพธ์", width: 100 },
  { key: "note", label: "หมายเหตุ", width: 260 },
];

// ═══// ═══════════════════════════════════════════════════════════════════════
//  ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════

// JSONP callback name — ตั้งใน doGet แล้ว shopRes อ่าน
let _jsonpCb = "";

function doGet(e) {
  // Guard: เมื่อกด Run ใน Editor จะไม่มี e หรือ e.parameter
  const params = e && e.parameter ? e.parameter : {};
  _jsonpCb = params.callback || ""; // จับ ?callback=jQuery... จาก jQuery JSONP
  const action = (params.action || "").toLowerCase();

  console.log("╔══ doGet ══════════════════════════════════════════");
  console.log("║  action  :", action || "(ว่าง — อาจกด Run ใน Editor)");
  console.log("║  params  :", JSON.stringify(params));
  console.log("╚═══════════════════════════════════════════════════");

  try {
    switch (action) {
      case "get_products":
        return handleGetProducts(e);
      case "create_order":
        return handleCreateOrder(e);
      case "check_payment":
        return handleCheckPayment(e);
      case "cancel_order":
        return handleCancelOrder(e);
      default:
        console.log("[doGet] unknown action:", action);
        return shopRes({
          status: "ok",
          message: "ASIA-BOT Shop API v4.0 🛒",
          action,
        });
    }
  } catch (err) {
    console.error("[doGet] UNCAUGHT ERROR:", err.message, err.stack);
    return shopRes({ status: "error", message: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  ACTION: get_products
// ═══════════════════════════════════════════════════════════════════════

function handleGetProducts(e) {
  console.log("[get_products] เริ่มต้น");

  try {
    const sheet = getOrCreateShopSheet();
    const lastRow = sheet.getLastRow();
    console.log(
      "[get_products] lastRow =",
      lastRow,
      "| DATA_START =",
      SHOP_DATA_START,
    );

    if (lastRow < SHOP_DATA_START) {
      console.log("[get_products] Sheet ว่าง — คืน data: []");
      return shopRes({ status: "success", data: [], count: 0 });
    }

    const numRows = lastRow - SHOP_DATA_START + 1;
    const rows = sheet
      .getRange(SHOP_DATA_START, 1, numRows, SHOP_COLUMNS.length)
      .getValues();
    console.log("[get_products] อ่านได้", rows.length, "แถวดิบ");

    const data = rows
      .map((r, i) => {
        const obj = shopRowToObj(r);
        delete obj.cpst; // ซ่อนต้นทุน
        obj.stock = parseInt(obj.stock || 0);
        obj.price = parseFloat(obj.price || 0);
        return obj;
      })
      .filter((p) => {
        const ok = p.id && p.name;
        if (!ok) console.log("[get_products] กรองแถวว่าง:", JSON.stringify(p));
        return ok;
      });

    console.log("[get_products] ✅ ส่งสินค้า", data.length, "รายการ");
    return shopRes({ status: "success", count: data.length, data });
  } catch (err) {
    console.error("[get_products] ❌ ERROR:", err.message, err.stack);
    return shopRes({ status: "error", message: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  ACTION: create_order
// ═══════════════════════════════════════════════════════════════════════

function handleCreateOrder(e) {
  const params = e && e.parameter ? e.parameter : {};
  const studentId = (params.student_id || "").trim();
  const studentName = (params.student_name || "").trim();
  const itemsRaw = (params.items || "").trim();
  const total = parseFloat(params.total || "0");
  const deliveryMode = (params.delivery_mode || "pickup").trim();
  const deliveryLoc = (params.delivery_loc || "สหกรณ์").trim();
  const deliverySlot = (params.delivery_slot || "").trim();

  console.log("[create_order] ── รับ params ──────────────────────");
  console.log("[create_order]  student_id    :", studentId);
  console.log("[create_order]  student_name  :", studentName);
  console.log("[create_order]  total         :", total);
  console.log("[create_order]  delivery_mode :", deliveryMode);
  console.log("[create_order]  delivery_loc  :", deliveryLoc);
  console.log("[create_order]  delivery_slot :", deliverySlot);
  console.log("[create_order]  items (raw)   :", itemsRaw.substring(0, 120));

  try {
    // ── validate ────────────────────────────────────────────────────
    if (!studentId)
      return shopRes({ status: "error", message: "ไม่มี student_id" });
    if (!itemsRaw)
      return shopRes({ status: "error", message: "ไม่มีรายการสินค้า" });
    if (total <= 0)
      return shopRes({
        status: "error",
        message: "ยอดรวมไม่ถูกต้อง: " + total,
      });

    let items;
    try {
      items = JSON.parse(itemsRaw);
      console.log("[create_order] parse items สำเร็จ:", items.length, "รายการ");
    } catch (parseErr) {
      console.error("[create_order] ❌ parse items ล้มเหลว:", parseErr.message);
      return shopRes({ status: "error", message: "items JSON ไม่ถูกต้อง" });
    }
    if (!Array.isArray(items) || !items.length)
      return shopRes({ status: "error", message: "รายการสินค้าว่าง" });

    // ── check stock ─────────────────────────────────────────────────
    const shopSheet = getOrCreateShopSheet();
    console.log("[create_order] ตรวจ stock...");
    const stockErr = checkStock(shopSheet, items);
    if (stockErr) {
      console.warn("[create_order] ❌ stock ไม่พอ:", stockErr);
      return shopRes({ status: "error", message: stockErr });
    }
    console.log("[create_order] ✅ stock OK");

    // ── generate order id ───────────────────────────────────────────
    const orderId = generateOrderId();
    const now = nowBkk();
    console.log("[create_order] orderId =", orderId, "| now =", now);

    // ── Stripe: create + confirm PaymentIntent ────────────────────
    console.log("[create_order] เรียก Stripe...");
    const piResult = createStripePromptPay(total, orderId, studentName, studentId);

    if (!piResult.ok) {
      console.error("[create_order] ❌ Stripe ล้มเหลว:", piResult.error);
      writePayLog(orderId, studentId, total, "", "error", piResult.error);
      return shopRes({ status: "error", message: "Stripe: " + piResult.error });
    }

    const { pi_id, qr_url } = piResult;
    console.log("[create_order] ✅ Stripe PI:", pi_id);
    console.log(
      "[create_order]    qr_url  :",
      qr_url ? qr_url.substring(0, 60) + "..." : "NULL",
    );

    // ── deduct stock ─────────────────────────────────────────────────
    console.log("[create_order] หัก stock...");
    deductStock(shopSheet, items);
    console.log("[create_order] ✅ deduct stock เสร็จ");

    // ── บันทึก ออเดอร์ ───────────────────────────────────────────────
    const ordersSheet = getOrCreateOrdersSheet();
    ordersSheet.appendRow(
      ORDER_COLUMNS.map((col) => {
        switch (col.key) {
          case "order_id":
            return orderId;
          case "order_ts":
            return now;
          case "student_id":
            return studentId;
          case "student_name":
            return studentName;
          case "items_json":
            return itemsRaw;
          case "total":
            return total;
          case "pi_id":
            return pi_id;
          case "status":
            return "pending";
          case "delivery_mode":
            return deliveryMode;
          case "delivery_loc":
            return deliveryLoc;
          case "delivery_slot":
            return deliverySlot;
          default:
            return "";
        }
      }),
    );
    styleOrderRow(ordersSheet, ordersSheet.getLastRow(), "pending");
    console.log(
      "[create_order] ✅ บันทึก ออเดอร์ แถว:",
      ordersSheet.getLastRow(),
    );

    writePayLog(
      orderId,
      studentId,
      total,
      pi_id,
      "pending",
      "สร้าง PaymentIntent สำเร็จ",
    );

    console.log("[create_order] 🎉 สำเร็จ → คืน order_id:", orderId);
    return shopRes({
      status: "success",
      message: "สร้างออเดอร์สำเร็จ",
      order_id: orderId,
      pi_id,
      qr_url,
      total,
    });
  } catch (err) {
    console.error("[create_order] ❌ UNCAUGHT:", err.message, err.stack);
    return shopRes({ status: "error", message: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  📧 NOTIFY DEDUP — เช็คจาก order status ใน Sheet (atomic)
//  GAS ไม่มี state ระหว่าง requests — in-memory cache ไม่ช่วย
//  วิธีที่ถูกต้อง: อ่าน status ก่อน write → ถ้าเป็น "paid" แล้ว = ส่งแล้ว
// ═══════════════════════════════════════════════════════════════════════

function getOrderCurrentStatus(orderId) {
  // อ่าน status ปัจจุบันจาก Sheet โดยตรง
  try {
    const sheet = getOrCreateOrdersSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;
    const oidCol = ORDER_COLUMNS.findIndex(c => c.key === "order_id") + 1;
    const statusCol = ORDER_COLUMNS.findIndex(c => c.key === "status") + 1;
    const ids = sheet.getRange(2, oidCol, lastRow - 1, 1).getValues();
    const idx = ids.findIndex(r => r[0].toString().trim() === orderId);
    if (idx === -1) return null;
    return sheet.getRange(idx + 2, statusCol).getValue().toString().trim();
  } catch (_) { return null; }
}

function markNotified(orderId) {
  // ไม่ต้องทำอะไร — updateOrderStatus("paid") คือ flag แล้ว
  console.log("[notify] markNotified:", orderId, "→ status=paid is the flag");
}

// ═══════════════════════════════════════════════════════════════════════
//  📧 ORDER NOTIFICATION — Email + LINE Notify
// ═══════════════════════════════════════════════════════════════════════

function sendOrderNotify(orderId, studentId, studentName, items, total, deliveryMode, deliveryLoc, deliverySlot) {
  var NL = "\n";
  deliveryMode = deliveryMode || "pickup";
  deliveryLoc = deliveryLoc || "\u0E2A\u0E2B\u0E01\u0E23\u0E13\u0E4C";
  deliverySlot = deliverySlot || "-";
  var modeLabel = (deliveryMode === "pickup")
    ? "\u{1F3EA} \u0E21\u0E32\u0E23\u0E31\u0E1A\u0E17\u0E35\u0E48\u0E2A\u0E2B\u0E01\u0E23\u0E13\u0E4C"
    : "\u{1F6B6} \u0E43\u0E2B\u0E49 \u0E2D\u0E27\u0E17. \u0E2A\u0E48\u0E07\u0E17\u0E35\u0E48 " + deliveryLoc;

  var itemLines = items.map(function (i) {
    return "  - " + i.name + " x" + i.qty + " = " + (i.price * i.qty).toFixed(2) + " \u0E1A\u0E32\u0E17";
  }).join(NL);

  // ── Email ────────────────────────────────────────────────────────
  if (NOTIFY_EMAIL) {
    var emailBody =
      "[\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08] " + SHOP_LABEL + NL +
      "Order ID   : " + orderId + NL +
      "\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19  : " + studentName + " (" + studentId + ")" + NL +
      "\u0E40\u0E27\u0E25\u0E32      : " + nowBkk() + NL +
      "----------------------------" + NL +
      itemLines + NL +
      "----------------------------" + NL +
      "\u0E22\u0E2D\u0E14\u0E23\u0E27\u0E21   : " + total.toFixed(2) + " \u0E1A\u0E32\u0E17" + NL +
      "\u0E23\u0E31\u0E1A/\u0E2A\u0E48\u0E07   : " + modeLabel + NL +
      "\u0E0A\u0E48\u0E27\u0E07\u0E40\u0E27\u0E25\u0E32  : " + deliverySlot + NL;
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: "[" + SHOP_LABEL + "] \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 " + orderId + " | " + total.toFixed(2) + " THB",
      body: emailBody
    });
    console.log("[notify] Email sent to " + NOTIFY_EMAIL);
  }

  // ── LINE Flex Message ─────────────────────────────────────────────
  if (!LINE_TOKEN) return;

  var itemContents = items.map(function (i) {
    return {
      type: "box", layout: "horizontal",
      contents: [
        { type: "text", text: i.name + " x" + i.qty, size: "sm", color: "#555566", flex: 5, wrap: true },
        { type: "text", text: (i.price * i.qty).toFixed(2) + " \u0E1A.", size: "sm", color: "#111111", align: "end", flex: 2 }
      ]
    };
  });

  var flexMsg = {
    type: "flex",
    altText: "\u2705 \u0E0A\u0E33\u0E23\u0E30\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 #" + orderId + " | " + total.toFixed(2) + " \u0E1A\u0E32\u0E17",
    contents: {
      type: "bubble",
      header: {
        type: "box", layout: "vertical", paddingAll: "18px",
        backgroundColor: "#0EA5E9",
        contents: [
          { type: "text", text: SHOP_LABEL, color: "#ffffff", size: "md", weight: "bold" },
          { type: "text", text: "\u2705 \u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08", color: "#E0F2FE", size: "sm" }
        ]
      },
      body: {
        type: "box", layout: "vertical", spacing: "md",
        backgroundColor: "#F5F5F5",
        contents: [
          {
            type: "box", layout: "vertical", spacing: "xs", contents: [
              {
                type: "box", layout: "horizontal", contents: [
                  { type: "text", text: "Order ID", size: "xs", color: "#aaaaaa", flex: 3 },
                  { type: "text", text: orderId, size: "xs", color: "#333333", flex: 5, weight: "bold" }
                ]
              },
              {
                type: "box", layout: "horizontal", contents: [
                  { type: "text", text: "\u0E19\u0E31\u0E01\u0E40\u0E23\u0E35\u0E22\u0E19", size: "xs", color: "#aaaaaa", flex: 3 },
                  { type: "text", text: studentName + " (" + studentId + ")", size: "xs", color: "#333333", flex: 5, wrap: true }
                ]
              },
              {
                type: "box", layout: "horizontal", contents: [
                  { type: "text", text: "\u0E40\u0E27\u0E25\u0E32", size: "xs", color: "#aaaaaa", flex: 3 },
                  { type: "text", text: nowBkk(), size: "xs", color: "#333333", flex: 5 }
                ]
              }
            ]
          },
          { type: "separator" },
          { type: "box", layout: "vertical", spacing: "xs", contents: itemContents },
          { type: "separator" },
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "\u0E22\u0E2D\u0E14\u0E23\u0E27\u0E21", size: "md", weight: "bold", color: "#0EA5E9", flex: 3 },
              { type: "text", text: total.toFixed(2) + " \u0E1A\u0E32\u0E17", size: "md", weight: "bold", color: "#0EA5E9", align: "end", flex: 4 }
            ]
          },
          { type: "separator" },
          {
            type: "box", layout: "vertical", spacing: "xs",
            backgroundColor: "#FFFFFF", paddingAll: "12px", cornerRadius: "10px",
            contents: [
              {
                type: "box", layout: "horizontal", contents: [
                  { type: "text", text: "\u{1F4E6} \u0E23\u0E31\u0E1A/\u0E2A\u0E48\u0E07", size: "xs", color: "#0284C7", flex: 3 },
                  { type: "text", text: modeLabel, size: "xs", color: "#0369A1", flex: 5, weight: "bold", wrap: true }
                ]
              },
              {
                type: "box", layout: "horizontal", contents: [
                  { type: "text", text: "\u23F0 \u0E0A\u0E48\u0E27\u0E07\u0E40\u0E27\u0E25\u0E32", size: "xs", color: "#0284C7", flex: 3 },
                  { type: "text", text: deliverySlot, size: "xs", color: "#0369A1", flex: 5, weight: "bold" }
                ]
              }
            ]
          }
        ]
      }
    }
  };

  // ส่ง admin
  if (LINE_USER) {
    UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
      method: "post",
      headers: { "Authorization": "Bearer " + LINE_TOKEN, "Content-Type": "application/json" },
      payload: JSON.stringify({ to: LINE_USER, messages: [flexMsg] }),
      muteHttpExceptions: true
    });
    console.log("[notify] Flex sent to admin " + LINE_USER);
  }

  // ส่งกลุ่ม อวท.
  if (LINE_GROUP) {
    UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
      method: "post",
      headers: { "Authorization": "Bearer " + LINE_TOKEN, "Content-Type": "application/json" },
      payload: JSON.stringify({ to: LINE_GROUP, messages: [flexMsg] }),
      muteHttpExceptions: true
    });
    console.log("[notify] Flex sent to group " + LINE_GROUP);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  ACTION: check_payment
// ═══════════════════════════════════════════════════════════════════════

function handleCheckPayment(e) {
  const params = e && e.parameter ? e.parameter : {};
  const orderId = (params.order_id || "").trim();
  console.log("[check_payment] order_id:", orderId);

  try {
    if (!orderId)
      return shopRes({ status: "error", message: "ไม่มี order_id" });

    const piId = findPiIdByOrder(orderId);
    console.log("[check_payment] pi_id:", piId);

    if (!piId) {
      console.warn("[check_payment] ❌ ไม่พบ order ใน Sheet");
      return shopRes({ status: "error", message: "ไม่พบ order: " + orderId });
    }

    // ── ดึงสถานะจาก Stripe ─────────────────────────────────────────
    console.log("[check_payment] เรียก Stripe GET /payment_intents/" + piId);
    const pi = getStripePaymentIntent(piId);

    if (!pi) {
      console.warn("[check_payment] Stripe คืน null → pending");
      return shopRes({ status: "success", payment_status: "pending" });
    }

    console.log("[check_payment] Stripe PI status:", pi.status);

    let payStatus = "pending";
    if (pi.status === "succeeded") payStatus = "paid";
    else if (pi.status === "canceled" || pi.status === "payment_failed")
      payStatus = "failed";

    console.log("[check_payment] → payStatus:", payStatus);

    if (payStatus === "paid") {
      // ── เช็ค status ปัจจุบันก่อน — ถ้าเป็น "paid" แล้ว = เคย notify ไปแล้ว ──
      const currentStatus = getOrderCurrentStatus(orderId);
      console.log("[check_payment] currentStatus in Sheet:", currentStatus);

      if (currentStatus === "paid") {
        // already processed — คืน paid ให้ client แต่ไม่ notify ซ้ำ
        console.log("[check_payment] ⚠️ order already paid — skip notify");
        return shopRes({ status: "success", payment_status: "paid", order_id: orderId });
      }

      // ── บันทึกก่อน notify ─────────────────────────────────────────
      updateOrderStatus(orderId, "paid");
      writePayLog(orderId, "", 0, piId, "succeeded", "Stripe ยืนยันชำระแล้ว");
      console.log("[check_payment] ✅ อัปเดต paid");

      // ── notify ครั้งเดียว ─────────────────────────────────────────
      try {
        const orderInfo = getOrderInfo(orderId);
        if (orderInfo) {
          sendOrderNotify(
            orderId, orderInfo.student_id, orderInfo.student_name,
            JSON.parse(orderInfo.items_json || "[]"), parseFloat(orderInfo.total || 0),
            orderInfo.delivery_mode || "pickup",
            orderInfo.delivery_loc || "สหกรณ์",
            orderInfo.delivery_slot || ""
          );
          console.log("[check_payment] ✅ notify ส่งสำเร็จ");
        }
      } catch (ne) { console.warn("[check_payment] notify error:", ne.message); }

    } else if (payStatus === "failed") {
      updateOrderStatus(orderId, "failed");
      const errMsg = pi.last_payment_error ? pi.last_payment_error.message : "";
      writePayLog(orderId, "", 0, piId, pi.status, errMsg);
      console.warn("[check_payment] ❌ failed:", errMsg);
    }

    return shopRes({
      status: "success",
      payment_status: payStatus,
      order_id: orderId,
    });
  } catch (err) {
    console.error("[check_payment] ❌ UNCAUGHT:", err.message, err.stack);
    return shopRes({ status: "error", message: err.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  ACTION: cancel_order  — นักเรียนกดยกเลิกเอง / หมดเวลา
// ═══════════════════════════════════════════════════════════════════════

function handleCancelOrder(e) {
  const params = e && e.parameter ? e.parameter : {};
  const orderId = (params.order_id || "").trim();
  console.log("[cancel_order] orderId:", orderId);
  try {
    if (!orderId) return shopRes({ status: "error", message: "ไม่มี order_id" });
    updateOrderStatus(orderId, "cancelled");
    writePayLog(orderId, params.student_id || "", 0, "", "cancelled", "นักเรียนยกเลิก / หมดเวลา");
    // คืน stock
    const ordersSheet = getOrCreateOrdersSheet();
    const lastRow = ordersSheet.getLastRow();
    if (lastRow >= 2) {
      const oidCol = ORDER_COLUMNS.findIndex(c => c.key === "order_id") + 1;
      const itemsCol = ORDER_COLUMNS.findIndex(c => c.key === "items_json") + 1;
      const ids = ordersSheet.getRange(2, oidCol, lastRow - 1, 1).getValues();
      const idx = ids.findIndex(r => r[0].toString().trim() === orderId);
      if (idx >= 0) {
        const itemsRaw = ordersSheet.getRange(idx + 2, itemsCol).getValue();
        try {
          const items = JSON.parse(itemsRaw);
          const shopSheet = getOrCreateShopSheet();
          items.forEach(item => {
            const { rowIdx } = findProductRow(shopSheet, item.id);
            if (rowIdx) {
              const stockCol = SHOP_COLUMNS.findIndex(c => c.key === "stock") + 1;
              const cur = parseInt(shopSheet.getRange(rowIdx, stockCol).getValue() || "0");
              shopSheet.getRange(rowIdx, stockCol).setValue(cur + parseInt(item.qty || 1));
            }
          });
          console.log("[cancel_order] ✅ คืน stock แล้ว");
        } catch (pe) { console.warn("[cancel_order] คืน stock ล้มเหลว:", pe.message); }
      }
    }
    return shopRes({ status: "success", order_id: orderId });
  } catch (err) {
    console.error("[cancel_order] ❌", err.message);
    return shopRes({ status: "error", message: err.message });
  }
}


// ═══════════════════════════════════════════════════════════════════════
//  STRIPE API
// ═══════════════════════════════════════════════════════════════════════

function createStripePromptPay(amountBaht, orderId, customerName, studentId) {
  // Stripe ต้องการ integer สตางค์ — ห้ามส่ง float string เช่น "1500.0"
  const satang = String(parseInt(Math.round(Number(amountBaht) * 100), 10));
  const auth = "Basic " + Utilities.base64Encode(STRIPE_SECRET_KEY + ":");

  console.log(
    "[Stripe] createStripePromptPay — satang:",
    satang,
    "| orderId:",
    orderId,
  );

  try {
    // ── Step 1: Create PaymentIntent ─────────────────────────────
    console.log("[Stripe] Step1: POST /v1/payment_intents");
    const createResp = UrlFetchApp.fetch(
      "https://api.stripe.com/v1/payment_intents",
      {
        method: "post",
        headers: { Authorization: auth },
        payload: {
          amount: satang,
          currency: "thb",
          "payment_method_types[]": "promptpay",
          description: orderId + " | " + customerName,
          "metadata[order_id]": orderId,
          "metadata[student]": customerName,
        },
        muteHttpExceptions: true,
      },
    );

    const piRaw = createResp.getContentText();
    const piCode = createResp.getResponseCode();
    console.log("[Stripe] Step1 HTTP:", piCode);
    console.log("[Stripe] Step1 body:", piRaw.substring(0, 200));

    const pi = JSON.parse(piRaw);
    if (pi.error) {
      console.error("[Stripe] Step1 error:", pi.error.message);
      return { ok: false, error: pi.error.message };
    }
    console.log("[Stripe] Step1 ✅ PI id:", pi.id, "| status:", pi.status);

    // ── Step 2: Confirm PaymentIntent ─────────────────────────────
    console.log(
      "[Stripe] Step2: POST /v1/payment_intents/" + pi.id + "/confirm",
    );
    const confirmResp = UrlFetchApp.fetch(
      "https://api.stripe.com/v1/payment_intents/" + pi.id + "/confirm",
      {
        method: "post",
        headers: { Authorization: auth },
        payload: {
          "payment_method_data[type]": "promptpay",
          // Stripe PromptPay บังคับมี billing_details[email]
          "payment_method_data[billing_details][email]": studentId + "@ASIA-BOT.ac.th",
          "payment_method_data[billing_details][name]": customerName,
          return_url: "https://asia-lb.web.app/shop/",
        },
        muteHttpExceptions: true,
      },
    );

    const confRaw = confirmResp.getContentText();
    const confCode = confirmResp.getResponseCode();
    console.log("[Stripe] Step2 HTTP:", confCode);
    console.log("[Stripe] Step2 body:", confRaw.substring(0, 300));

    const confirmed = JSON.parse(confRaw);
    if (confirmed.error) {
      console.error("[Stripe] Step2 error:", confirmed.error.message);
      return { ok: false, error: confirmed.error.message };
    }
    console.log("[Stripe] Step2 ✅ status:", confirmed.status);
    console.log(
      "[Stripe] next_action:",
      JSON.stringify(confirmed.next_action).substring(0, 200),
    );

    // ── ดึง QR URL ────────────────────────────────────────────────
    const qrObj =
      confirmed.next_action && confirmed.next_action.promptpay_display_qr_code;
    if (!qrObj) {
      console.error("[Stripe] ❌ ไม่มี next_action.promptpay_display_qr_code");
      console.error(
        "[Stripe] next_action full:",
        JSON.stringify(confirmed.next_action),
      );
      return {
        ok: false,
        error:
          "ไม่ได้รับ QR URL — ตรวจสอบว่า enable PromptPay ใน Stripe Dashboard",
      };
    }

    const qr_url = qrObj.image_url_png;
    console.log(
      "[Stripe] ✅ qr_url:",
      qr_url ? qr_url.substring(0, 80) + "..." : "NULL",
    );

    return { ok: true, pi_id: confirmed.id, qr_url };
  } catch (err) {
    console.error(
      "[Stripe] createStripePromptPay EXCEPTION:",
      err.message,
      err.stack,
    );
    return { ok: false, error: err.message };
  }
}

function getStripePaymentIntent(piId) {
  console.log("[Stripe] GET /v1/payment_intents/" + piId);
  try {
    const resp = UrlFetchApp.fetch(
      "https://api.stripe.com/v1/payment_intents/" + piId,
      {
        method: "get",
        headers: {
          Authorization:
            "Basic " + Utilities.base64Encode(STRIPE_SECRET_KEY + ":"),
        },
        muteHttpExceptions: true,
      },
    );
    const code = resp.getResponseCode();
    const body = resp.getContentText();
    console.log("[Stripe] GET HTTP:", code, "| body:", body.substring(0, 120));

    const data = JSON.parse(body);
    if (data.error) {
      console.error("[Stripe] GET error:", data.error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error("[Stripe] getStripePaymentIntent EXCEPTION:", err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  STOCK HELPERS
// ═══════════════════════════════════════════════════════════════════════

function checkStock(sheet, items) {
  for (const item of items) {
    const { rowIdx, stock } = findProductRow(sheet, item.id);
    console.log(
      "[checkStock] id:",
      item.id,
      "| rowIdx:",
      rowIdx,
      "| stock:",
      stock,
      "| need:",
      item.qty,
    );
    if (!rowIdx) return "ไม่พบสินค้า: " + (item.name || item.id);
    if (stock < parseInt(item.qty || 1))
      return (
        'สต็อก "' +
        item.name +
        '" ไม่พอ (เหลือ ' +
        stock +
        " ต้องการ " +
        item.qty +
        ")"
      );
  }
  return null;
}

function deductStock(sheet, items) {
  const stockCol = SHOP_COLUMNS.findIndex((c) => c.key === "stock") + 1;
  for (const item of items) {
    const { rowIdx, stock } = findProductRow(sheet, item.id);
    if (!rowIdx) {
      console.warn("[deductStock] ไม่พบ id:", item.id);
      continue;
    }
    const newStock = Math.max(0, stock - parseInt(item.qty || 1));
    sheet.getRange(rowIdx, stockCol).setValue(newStock);
    console.log("[deductStock] id:", item.id, "| stock:", stock, "→", newStock);
  }
}

function findProductRow(sheet, productId) {
  if (!productId) return { rowIdx: null, stock: 0 };
  const idCol = SHOP_COLUMNS.findIndex((c) => c.key === "id") + 1;
  const stockCol = SHOP_COLUMNS.findIndex((c) => c.key === "stock") + 1;
  const lastRow = sheet.getLastRow();
  if (lastRow < SHOP_DATA_START) return { rowIdx: null, stock: 0 };

  const ids = sheet
    .getRange(SHOP_DATA_START, idCol, lastRow - SHOP_DATA_START + 1, 1)
    .getValues();
  const idx = ids.findIndex(
    (r) => r[0].toString().trim() === productId.toString().trim(),
  );

  if (idx === -1) {
    console.warn("[findProductRow] ไม่พบ id:", productId);
    return { rowIdx: null, stock: 0 };
  }
  const rowIdx = SHOP_DATA_START + idx;
  const stock = parseInt(sheet.getRange(rowIdx, stockCol).getValue() || 0);
  return { rowIdx, stock };
}

// ═══════════════════════════════════════════════════════════════════════
//  ORDER HELPERS
// ═══════════════════════════════════════════════════════════════════════

function getOrderInfo(orderId) {
  const sheet = getOrCreateOrdersSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const oidCol = ORDER_COLUMNS.findIndex(c => c.key === "order_id") + 1;
  const ids = sheet.getRange(2, oidCol, lastRow - 1, 1).getValues();
  const idx = ids.findIndex(r => r[0].toString().trim() === orderId);
  if (idx === -1) return null;
  const row = sheet.getRange(idx + 2, 1, 1, ORDER_COLUMNS.length).getValues()[0];
  return Object.fromEntries(ORDER_COLUMNS.map((c, i) => [c.key, row[i]]));
}

function findPiIdByOrder(orderId) {
  const sheet = getOrCreateOrdersSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    console.warn("[findPiIdByOrder] Sheet ออเดอร์ว่าง");
    return null;
  }

  const oidCol = ORDER_COLUMNS.findIndex((c) => c.key === "order_id") + 1;
  const piCol = ORDER_COLUMNS.findIndex((c) => c.key === "pi_id") + 1;
  const ids = sheet.getRange(2, oidCol, lastRow - 1, 1).getValues();
  const idx = ids.findIndex((r) => r[0].toString().trim() === orderId);

  if (idx === -1) {
    console.warn("[findPiIdByOrder] ไม่พบ orderId:", orderId);
    return null;
  }
  const piId = sheet
    .getRange(idx + 2, piCol)
    .getValue()
    .toString()
    .trim();
  console.log("[findPiIdByOrder]", orderId, "→", piId);
  return piId || null;
}

function updateOrderStatus(orderId, newStatus) {
  const sheet = getOrCreateOrdersSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const oidCol = ORDER_COLUMNS.findIndex((c) => c.key === "order_id") + 1;
  const statusCol = ORDER_COLUMNS.findIndex((c) => c.key === "status") + 1;
  const ids = sheet.getRange(2, oidCol, lastRow - 1, 1).getValues();
  const idx = ids.findIndex((r) => r[0].toString().trim() === orderId);
  if (idx === -1) {
    console.warn("[updateOrderStatus] ไม่พบ orderId:", orderId);
    return;
  }

  const rowNum = idx + 2;
  sheet.getRange(rowNum, statusCol).setValue(newStatus);
  styleOrderRow(sheet, rowNum, newStatus);
  console.log(
    "[updateOrderStatus]",
    orderId,
    "→",
    newStatus,
    "(แถว",
    rowNum + ")",
  );
}

function writePayLog(orderId, studentId, total, piId, status, note) {
  try {
    const sheet = getOrCreatePayLogSheet();
    sheet.appendRow(
      PAY_LOG_COLUMNS.map((col) => {
        switch (col.key) {
          case "log_ts":
            return nowBkk();
          case "order_id":
            return orderId;
          case "student_id":
            return studentId;
          case "total":
            return total || "";
          case "pi_id":
            return piId;
          case "stripe_status":
            return status;
          case "status":
            return status;
          case "note":
            return note;
          default:
            return "";
        }
      }),
    );
    stylePayLogRow(sheet, sheet.getLastRow(), status);
    console.log(
      "[writePayLog]",
      orderId,
      "|",
      status,
      "|",
      note.substring(0, 60),
    );
  } catch (err) {
    console.error("[writePayLog] ❌ ERROR:", err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  SHEET SETUP
// ═══════════════════════════════════════════════════════════════════════

function getSpreadsheet() {
  if (SHOP_SS_ID) {
    console.log("[Sheet] เปิด Spreadsheet ID:", SHOP_SS_ID);
    return SpreadsheetApp.openById(SHOP_SS_ID);
  }
  console.log("[Sheet] ใช้ Active Spreadsheet");
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateShopSheet() {
  const ss = getSpreadsheet();
  let s = ss.getSheetByName(SHOP_SHEET_NAME);
  if (!s) {
    console.log("[Sheet] สร้าง Sheet ใหม่:", SHOP_SHEET_NAME);
    s = ss.insertSheet(SHOP_SHEET_NAME);
    initShopSheet(s);
  }
  return s;
}
function getOrCreateOrdersSheet() {
  const ss = getSpreadsheet();
  let s = ss.getSheetByName(ORDERS_SHEET_NAME);
  if (!s) {
    console.log("[Sheet] สร้าง Sheet ใหม่:", ORDERS_SHEET_NAME);
    s = ss.insertSheet(ORDERS_SHEET_NAME);
    initOrdersSheet(s);
  }
  return s;
}
function getOrCreatePayLogSheet() {
  const ss = getSpreadsheet();
  let s = ss.getSheetByName(PAY_LOG_SHEET);
  if (!s) {
    console.log("[Sheet] สร้าง Sheet ใหม่:", PAY_LOG_SHEET);
    s = ss.insertSheet(PAY_LOG_SHEET);
    initPayLogSheet(s);
  }
  return s;
}

function initShopSheet(sheet) {
  sheet.appendRow(SHOP_COLUMNS.map((c) => c.label));
  SHOP_COLUMNS.forEach((col, i) => {
    sheet
      .getRange(1, i + 1)
      .setBackground("#0EA5E9")
      .setFontColor("#FFF")
      .setFontWeight("bold")
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    sheet.setColumnWidth(i + 1, col.width);
  });
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 30);
  console.log("[initShopSheet] ✅ สร้าง header สินค้าแล้ว");
}
function initOrdersSheet(sheet) {
  sheet.appendRow(ORDER_COLUMNS.map((c) => c.label));
  ORDER_COLUMNS.forEach((col, i) => {
    sheet
      .getRange(1, i + 1)
      .setBackground("#635BFF")
      .setFontColor("white")
      .setFontWeight("bold")
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    sheet.setColumnWidth(i + 1, col.width);
  });
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 30);
  console.log("[initOrdersSheet] ✅ สร้าง header ออเดอร์แล้ว");
}
function initPayLogSheet(sheet) {
  sheet.appendRow(PAY_LOG_COLUMNS.map((c) => c.label));
  PAY_LOG_COLUMNS.forEach((col, i) => {
    sheet
      .getRange(1, i + 1)
      .setBackground("#1E293B")
      .setFontColor("white")
      .setFontWeight("bold")
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    sheet.setColumnWidth(i + 1, col.width);
  });
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 30);
  console.log("[initPayLogSheet] ✅ สร้าง header ชำระเงิน_Logs แล้ว");
}

// ═══════════════════════════════════════════════════════════════════════
//  ROW STYLING
// ═══════════════════════════════════════════════════════════════════════

function styleOrderRow(sheet, rowNum, status) {
  const bg = rowNum % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
  sheet
    .getRange(rowNum, 1, 1, ORDER_COLUMNS.length)
    .setBackground(bg)
    .setVerticalAlignment("middle");
  const col = ORDER_COLUMNS.findIndex((c) => c.key === "status") + 1;
  const cell = sheet.getRange(rowNum, col);
  if (status === "paid")
    cell.setBackground("#DCFCE7").setFontColor("#16A34A").setFontWeight("bold");
  else if (status === "failed")
    cell.setBackground("#FEE2E2").setFontColor("#DC2626").setFontWeight("bold");
  else
    cell.setBackground("#FEF9C3").setFontColor("#92400E").setFontWeight("bold");
}
function stylePayLogRow(sheet, rowNum, status) {
  const bg = rowNum % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
  sheet
    .getRange(rowNum, 1, 1, PAY_LOG_COLUMNS.length)
    .setBackground(bg)
    .setVerticalAlignment("middle");
  const col = PAY_LOG_COLUMNS.findIndex((c) => c.key === "status") + 1;
  const cell = sheet.getRange(rowNum, col);
  if (status === "succeeded" || status === "paid")
    cell.setBackground("#DCFCE7").setFontColor("#16A34A").setFontWeight("bold");
  else if (status === "failed" || status === "error")
    cell.setBackground("#FEE2E2").setFontColor("#DC2626").setFontWeight("bold");
  else
    cell.setBackground("#FEF9C3").setFontColor("#92400E").setFontWeight("bold");
}

// ═══════════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════════

function shopRowToObj(row) {
  return Object.fromEntries(SHOP_COLUMNS.map((c, i) => [c.key, row[i]]));
}

function generateOrderId() {
  const d = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyyMMdd");
  const r = Utilities.getUuid().replace(/-/g, "").substring(0, 4).toUpperCase();
  return "ORD-" + d + "-" + r;
}

function nowBkk() {
  return Utilities.formatDate(
    new Date(),
    "Asia/Bangkok",
    "dd/MM/yyyy HH:mm:ss",
  );
}

function shopRes(obj) {
  const json = JSON.stringify(obj);
  if (_jsonpCb) {
    return ContentService.createTextOutput(_jsonpCb + "(" + json + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(
    ContentService.MimeType.JSON,
  );
}