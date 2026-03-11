// ═══════════════════════════════════════════════════════════════════════
//  ASIA-LB — Shop API  (Code_shop.gs)
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
  "sk_test_51T0GcyPvb75VFaaMhmVYKOuiW4ZgDAd1ub6EUBUGDvQO1cYbE0SP0etnApNizjEWLIfFYNH8QKal2m07TqDNLuzj00BCct4hXP"; // Stripe Dashboard → Developers → API keys
//                        "sk_live_xxxxxxxxxxxx"    ← สลับตอน go-live

// Spreadsheet ID ของ Shop (ดูจาก URL: /spreadsheets/d/{ID}/edit)
const SHOP_SS_ID = ""; // ← ใส่ ID ของ Spreadsheet Shop ใหม่

// ── ชื่อ Sheet ────────────────────────────────────────────────────────
const SHOP_SHEET_NAME = "สินค้า";
const ORDERS_SHEET_NAME = "ออเดอร์";
const PAY_LOG_SHEET = "ชำระเงิน_Logs";
const ACTIVITY_LOG_SHEET = "กิจกรรม_Logs";
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

// ── schema กิจกรรม_Logs ───────────────────────────────────────────────
const ACTIVITY_LOG_COLUMNS = [
  { key: "log_ts", label: "เวลา", width: 160 },
  { key: "student_id", label: "รหัสนักเรียน", width: 125 },
  { key: "student_name", label: "ชื่อนักเรียน", width: 175 },
  { key: "event", label: "เหตุการณ์", width: 150 },
  { key: "detail", label: "รายละเอียด", width: 320 },
  { key: "order_id", label: "Order ID", width: 175 },
];

// ═══════════════════════════════════════════════════════════════════════
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
      case "log_activity":
        return handleLogActivity(e);
      default:
        console.log("[doGet] unknown action:", action);
        return shopRes({
          status: "ok",
          message: "ASIA-LB Shop API v4.0 🛒",
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

  console.log("[create_order] ── รับ params ──────────────────────");
  console.log("[create_order]  student_id  :", studentId);
  console.log("[create_order]  student_name:", studentName);
  console.log("[create_order]  total       :", total);
  console.log("[create_order]  items (raw) :", itemsRaw.substring(0, 120));

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
    const piResult = createStripePromptPay(
      total,
      orderId,
      studentName,
      studentId,
    );

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
      updateOrderStatus(orderId, "paid");
      writePayLog(orderId, "", 0, piId, "succeeded", "Stripe ยืนยันชำระแล้ว");
      console.log("[check_payment] ✅ อัปเดต paid");
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
//  ACTION: log_activity
// ═══════════════════════════════════════════════════════════════════════

function handleLogActivity(e) {
  const params = e && e.parameter ? e.parameter : {};
  const studentId = (params.student_id || "").trim();
  const studentName = (params.student_name || "").trim();
  const event = (params.event || "unknown").trim();
  const detail = (params.detail || "").trim();
  const orderId = (params.order_id || "").trim();
  try {
    const sheet = getOrCreateActivityLogSheet();
    sheet.appendRow(
      ACTIVITY_LOG_COLUMNS.map((col) => {
        switch (col.key) {
          case "log_ts":
            return nowBkk();
          case "student_id":
            return studentId;
          case "student_name":
            return studentName;
          case "event":
            return event;
          case "detail":
            return detail;
          case "order_id":
            return orderId;
          default:
            return "";
        }
      }),
    );
    styleActivityRow(sheet, sheet.getLastRow(), event);
    return shopRes({ status: "success", event });
  } catch (err) {
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
          "payment_method_data[billing_details][email]":
            studentId + "@asia-lb.ac.th",
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
function getOrCreateActivityLogSheet() {
  const ss = getSpreadsheet();
  let s = ss.getSheetByName(ACTIVITY_LOG_SHEET);
  if (!s) {
    console.log("[Sheet] สร้าง Sheet ใหม่:", ACTIVITY_LOG_SHEET);
    s = ss.insertSheet(ACTIVITY_LOG_SHEET);
    initActivityLogSheet(s);
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
function initActivityLogSheet(sheet) {
  sheet.appendRow(ACTIVITY_LOG_COLUMNS.map((c) => c.label));
  ACTIVITY_LOG_COLUMNS.forEach((col, i) => {
    sheet
      .getRange(1, i + 1)
      .setBackground("#7C3AED")
      .setFontColor("white")
      .setFontWeight("bold")
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    sheet.setColumnWidth(i + 1, col.width);
  });
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 30);
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

// ── styleActivityRow ─────────────────────────────────────────────────
function styleActivityRow(sheet, rowNum, event) {
  const bg = rowNum % 2 === 0 ? "#FAF5FF" : "#FFFFFF";
  sheet
    .getRange(rowNum, 1, 1, ACTIVITY_LOG_COLUMNS.length)
    .setBackground(bg)
    .setVerticalAlignment("middle");
  const col = ACTIVITY_LOG_COLUMNS.findIndex((c) => c.key === "event") + 1;
  const cell = sheet.getRange(rowNum, col);
  const payE = ["payment_success", "order_created"];
  const alertE = ["payment_cancelled", "payment_failed"];
  const cartE = ["add_to_cart", "remove_from_cart", "clear_cart"];
  if (payE.includes(event))
    cell.setBackground("#DCFCE7").setFontColor("#16A34A").setFontWeight("bold");
  else if (alertE.includes(event))
    cell.setBackground("#FEE2E2").setFontColor("#DC2626").setFontWeight("bold");
  else if (cartE.includes(event))
    cell.setBackground("#EFF6FF").setFontColor("#2563EB").setFontWeight("bold");
  else
    cell.setBackground("#F3E8FF").setFontColor("#7C3AED").setFontWeight("bold");
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
    return ContentService.createTextOutput(
      _jsonpCb + "(" + json + ")",
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(
    ContentService.MimeType.JSON,
  );
}
