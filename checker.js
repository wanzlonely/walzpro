const dns = require("dns");
if (typeof dns.setDefaultResultOrder === "function") dns.setDefaultResultOrder("ipv4first");
const WADetector = require("./walz-loader");

const DEFAULT_TIMEOUT_MS = parseInt(process.env.WA_TIMEOUT_MS || "7500", 10);

let keepAliveDispatcher;
try {
  const { Agent } = require("undici");
  keepAliveDispatcher = new Agent({
    connections: 64,
    pipelining: 1,
    keepAliveTimeout: 45000,
    keepAliveMaxTimeout: 90000,
    connect: { timeout: 4500, rejectUnauthorized: true },
    bodyTimeout: 10000,
    headersTimeout: 8000
  });
} catch (_) {}

function sanitizePhoneInput(raw) {
  const cleaned = String(raw || "")
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
    .trim();
  const hasPlus = cleaned.startsWith("+");
  let digits = cleaned.replace(/\D/g, "");
  if (!digits) return cleaned;
  if (!hasPlus && digits.startsWith("00") && digits.length >= 9) digits = digits.slice(2);
  if (!hasPlus && digits.startsWith("0") && digits.length >= 9 && digits.length <= 14) {
    digits = "62" + digits.slice(1);
  }
  if (digits.length < 7 || digits.length > 15) return cleaned.startsWith("+") ? cleaned : "+" + digits;
  return "+" + digits;
}

function safeJsonParse(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  const cleaned = rawText.replace(/^\s*(?:for\s*\(\s*;\s*;\s*\)\s*;|\)\]\}'\s*,?)/, "").trim();
  if (!cleaned || (!cleaned.startsWith("{") && !cleaned.startsWith("["))) return null;
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    return null;
  }
}

function parseBoolFlag(val) {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val === 1;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "on" || s === "active" || s === "registered";
  }
  return null;
}

function extractDeviceState(result, existJson, codeJson) {
  const candidates = [
    result && result.isDeviceOn,
    result && result.hasDevice,
    result && result.waOld,
    result && result.wa_old,
    result && result.raw && result.raw.wa_old,
    result && result.raw && result.raw.has_device,
    existJson && existJson.wa_old,
    existJson && existJson.has_device,
    existJson && existJson.registered,
    codeJson && codeJson.wa_old,
    codeJson && codeJson.has_device
  ];
  for (const c of candidates) {
    const parsed = parseBoolFlag(c);
    if (parsed !== null) return parsed;
  }
  return false;
}

function inferFromRawJson(phone, existJson, codeJson, parsed) {
  const primary = codeJson || existJson;
  if (!primary || typeof primary !== "object") return null;

  const status = String(primary.status || "").toLowerCase();
  const reason = String(primary.reason || (existJson && existJson.reason) || "").toLowerCase();
  const rawCooldown = Number(
    primary.retry_after ?? primary.sms_wait ?? primary.voice_wait ?? primary.wait ??
    (existJson && (existJson.retry_after ?? existJson.sms_wait)) ?? 0
  );
  const cooldownSeconds = Number.isFinite(rawCooldown) && rawCooldown > 0 ? Math.floor(rawCooldown) : 0;
  const deviceOn = extractDeviceState(parsed, existJson, codeJson);

  if (
    reason === "blocked" ||
    reason === "banned" ||
    (existJson && ["blocked", "banned"].includes(String(existJson.reason || "").toLowerCase()))
  ) {
    return {
      success: true,
      phone,
      state: "BANNED",
      isReady: false,
      isCooldown: false,
      isCloneBlocked: false,
      isBanned: true,
      cooldownSeconds: 0,
      wa_old: deviceOn,
      isDeviceOn: deviceOn,
      hasDevice: deviceOn
    };
  }

  if (reason === "length_long" || reason === "length_short" || reason === "missing" || reason === "invalid_smax") {
    return { success: false, phone, state: "INVALID_NUMBER", error: reason };
  }

  if (["no_routes", "old_version", "bad_token", "security_block", "unofficial_app", "device_confirm"].includes(reason)) {
    return {
      success: true,
      phone,
      state: "CLONE_BLOCKED",
      isReady: false,
      isCooldown: cooldownSeconds > 0,
      isCloneBlocked: true,
      isBanned: false,
      cooldownSeconds,
      wa_old: deviceOn,
      isDeviceOn: deviceOn,
      hasDevice: deviceOn
    };
  }

  if (
    cooldownSeconds > 0 ||
    ["too_recent", "too_many", "too_many_guesses", "try_again", "next_method", "temporarily_unavailable", "rate_overlimit"].includes(reason)
  ) {
    return {
      success: true,
      phone,
      state: "COOLDOWN",
      isReady: false,
      isCooldown: true,
      isCloneBlocked: false,
      isBanned: false,
      cooldownSeconds,
      wa_old: deviceOn,
      isDeviceOn: deviceOn,
      hasDevice: deviceOn
    };
  }

  if (status === "ok" || reason === "incorrect" || reason === "sent" || reason === "sms_sent" || reason === "code_sent") {
    return {
      success: true,
      phone,
      state: "READY",
      isReady: true,
      isCooldown: false,
      isCloneBlocked: false,
      isBanned: false,
      cooldownSeconds: 0,
      wa_old: deviceOn,
      isDeviceOn: deviceOn,
      hasDevice: deviceOn
    };
  }

  return null;
}

function normalizeResult(phone, parsed, existText, codeText) {
  const existJson = safeJsonParse(existText);
  const codeJson = safeJsonParse(codeText);

  if (!parsed || typeof parsed !== "object") {
    const recovered = inferFromRawJson(phone, existJson, codeJson, null);
    return recovered || { success: false, phone, error: "empty_parser_response" };
  }

  if (!parsed.success) {
    const recovered = inferFromRawJson(parsed.phone || phone, existJson, codeJson, parsed);
    if (recovered) return recovered;
    const rawReason = (codeJson && codeJson.reason) || (existJson && existJson.reason) || "";
    return {
      success: false,
      phone: parsed.phone || phone,
      state: parsed.state || undefined,
      error: parsed.error || parsed.description || rawReason || "detection_failed"
    };
  }

  const rawCooldown = Number(
    parsed.cooldownSeconds ??
    (codeJson && (codeJson.retry_after ?? codeJson.sms_wait ?? codeJson.voice_wait ?? codeJson.wait)) ??
    0
  );
  const cooldownSeconds = Number.isFinite(rawCooldown) && rawCooldown > 0 ? Math.floor(rawCooldown) : 0;

  let isBanned = Boolean(parsed.isBanned);
  let isCloneBlocked = Boolean(parsed.isCloneBlocked);
  let isCooldown = Boolean(parsed.isCooldown) || cooldownSeconds > 0;
  let isReady = Boolean(parsed.isReady);
  let state = String(parsed.state || "UNKNOWN").toUpperCase();

  if (isBanned) {
    isCloneBlocked = false;
    isCooldown = false;
    isReady = false;
    state = "BANNED";
  } else if (isCloneBlocked) {
    isCooldown = false;
    isReady = false;
    state = "CLONE_BLOCKED";
  } else if (isCooldown) {
    isReady = false;
    state = "COOLDOWN";
  } else if (isReady) {
    isCooldown = false;
    state = "READY";
  }

  const deviceOn = extractDeviceState(parsed, existJson, codeJson);

  return {
    ...parsed,
    success: true,
    phone: parsed.phone || phone,
    state,
    isReady,
    isCooldown,
    isCloneBlocked,
    isBanned,
    cooldownSeconds,
    wa_old: deviceOn,
    isDeviceOn: deviceOn,
    hasDevice: deviceOn
  };
}

function normalizeEmailResult(phone, parsed, existText, codeText) {
  const existJson = safeJsonParse(existText);
  const codeJson = safeJsonParse(codeText);

  if ((!parsed || typeof parsed !== "object" || !parsed.success) && !existJson && !codeJson) {
    return {
      success: false,
      phone: (parsed && parsed.phone) || phone,
      error: (parsed && (parsed.error || parsed.description)) || "email_check_failed"
    };
  }

  const safeParsed = parsed && typeof parsed === "object" ? parsed : {};
  const deviceOn = extractDeviceState(safeParsed, existJson, codeJson);
  const isBanned = Boolean(
    safeParsed.isBanned ||
    safeParsed.emailStatus === "BANNED" ||
    (existJson && existJson.reason === "blocked") ||
    (codeJson && codeJson.reason === "blocked")
  );

  const maskedEmail =
    safeParsed.maskedEmail ||
    safeParsed.email ||
    (codeJson && (codeJson.email || codeJson.email_address || codeJson.masked_email)) ||
    (existJson && (existJson.email || existJson.email_address || existJson.masked_email)) ||
    null;

  const rawWait = Number(
    safeParsed.emailWaitSeconds ??
    (codeJson && (codeJson.email_wait ?? codeJson.email_retry_after)) ??
    (existJson && (existJson.email_wait ?? existJson.email_retry_after)) ??
    0
  );
  const emailWaitSeconds = Number.isFinite(rawWait) && rawWait > 0 ? Math.floor(rawWait) : 0;

  const eligibleFlag = parseBoolFlag(
    safeParsed.emailEligible ??
    safeParsed.email_otp_eligible ??
    (codeJson && (codeJson.email_otp_eligible ?? codeJson.email_eligible ?? codeJson.can_send_email)) ??
    (existJson && (existJson.email_otp_eligible ?? existJson.email_eligible ?? existJson.can_send_email))
  );

  let emailStatus = String(safeParsed.emailStatus || "").toUpperCase();
  if (isBanned) {
    emailStatus = "BANNED";
  } else if (emailStatus !== "ELIGIBLE" && emailStatus !== "WAIT" && emailStatus !== "UNAVAILABLE") {
    if (emailWaitSeconds > 0) {
      emailStatus = "WAIT";
    } else if (eligibleFlag === true || Boolean(maskedEmail)) {
      emailStatus = "ELIGIBLE";
    } else {
      emailStatus = "UNAVAILABLE";
    }
  }

  return {
    ...safeParsed,
    success: true,
    phone: safeParsed.phone || phone,
    state: emailStatus,
    emailStatus,
    maskedEmail: maskedEmail ? String(maskedEmail) : null,
    emailWaitSeconds,
    wa_old: deviceOn,
    isDeviceOn: deviceOn,
    hasDevice: deviceOn
  };
}

async function callWA(reqObj, userAgent, sharedHeaders = null, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const method = String((reqObj && reqObj.method) || "POST").toUpperCase();
    const options = {
      method,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": userAgent,
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
        ...(sharedHeaders || {}),
        ...((reqObj && reqObj.headers) || {})
      },
      signal: controller.signal
    };
    if (method !== "GET" && method !== "HEAD" && reqObj && reqObj.body !== undefined) {
      options.body = reqObj.body;
    }
    if (keepAliveDispatcher) options.dispatcher = keepAliveDispatcher;

    const res = await fetch(reqObj.url, options);
    if (res.status === 429) {
      throw new Error("HTTP_429_RATE_LIMIT");
    }
    if (res.status >= 500) {
      throw new Error(`HTTP_${res.status}_SERVER_ERROR`);
    }
    if (res.status === 403 || res.status === 401) {
      throw new Error(`HTTP_${res.status}_FORBIDDEN`);
    }
    const text = await res.text();
    if (!text || !text.trim()) {
      throw new Error(`EMPTY_UPSTREAM_HTTP_${res.status}`);
    }
    return text;
  } catch (e) {
    if (e && e.name === "AbortError") {
      throw new Error("REQUEST_TIMEOUT");
    }
    const msg = String(e && e.message ? e.message : e);
    if (/ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|UND_ERR|fetch failed/i.test(msg)) {
      throw new Error("NETWORK_ERROR");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function checkPhone(rawPhone) {
  const cleanPhone = sanitizePhoneInput(rawPhone);
  try {
    const payload = await WADetector.buildDualPayloads(cleanPhone);
    if (!payload || !payload.success) {
      return {
        success: false,
        phone: cleanPhone,
        state: "INVALID_NUMBER",
        error: (payload && payload.error) || "invalid_phone"
      };
    }

    const formattedPhone = `+${payload.phoneInfo.full}`;
    const existText = await callWA(payload.exist, payload.userAgent, payload.headers);
    await new Promise(r => setTimeout(r, 12));
    const codeText = await callWA(payload.code, payload.userAgent, payload.headers);

    const parsed = WADetector.parseDualResponse(payload.phoneInfo, existText, codeText);
    return normalizeResult(formattedPhone, parsed, existText, codeText);
  } catch (e) {
    return {
      success: false,
      phone: cleanPhone,
      error: String(e && e.message ? e.message : e)
    };
  }
}

async function triggerEmailVerification(rawPhone) {
  const cleanPhone = sanitizePhoneInput(rawPhone);
  try {
    const buildFn = typeof WADetector.buildEmailPayloads === "function"
      ? WADetector.buildEmailPayloads.bind(WADetector)
      : WADetector.buildDualPayloads.bind(WADetector);

    const payload = await buildFn(cleanPhone);
    if (!payload || !payload.success) {
      return {
        success: false,
        phone: cleanPhone,
        state: "INVALID_NUMBER",
        error: (payload && payload.error) || "invalid_phone"
      };
    }

    const formattedPhone = `+${payload.phoneInfo.full}`;
    let existText = "";
    let codeText = "";

    if (payload.exist) {
      existText = await callWA(payload.exist, payload.userAgent, payload.headers);
    }
    if (payload.code) {
      if (existText) await new Promise(r => setTimeout(r, 12));
      codeText = await callWA(payload.code, payload.userAgent, payload.headers);
    }
    if (payload.email) {
      if (existText || codeText) await new Promise(r => setTimeout(r, 12));
      const emailResp = await callWA(payload.email, payload.userAgent, payload.headers);
      codeText = emailResp || codeText;
    }

    const parsed = typeof WADetector.parseEmailResponse === "function"
      ? WADetector.parseEmailResponse(payload.phoneInfo, existText, codeText)
      : WADetector.parseDualResponse(payload.phoneInfo, existText, codeText);

    return normalizeEmailResult(formattedPhone, parsed, existText, codeText);
  } catch (e) {
    return {
      success: false,
      phone: cleanPhone,
      error: String(e && e.message ? e.message : e)
    };
  }
}

module.exports = { checkPhone, triggerEmailVerification };
