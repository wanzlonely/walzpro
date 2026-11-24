const dns = require("dns");
if (typeof dns.setDefaultResultOrder === "function") dns.setDefaultResultOrder("ipv4first");
const WADetector = require("./walz-loader");

const DEFAULT_TIMEOUT_MS = parseInt(process.env.WA_TIMEOUT_MS || "7000", 10);

let keepAliveDispatcher;
try {
  const { Agent } = require("undici");
  keepAliveDispatcher = new Agent({
    connections: 96,
    pipelining: 1,
    keepAliveTimeout: 60000,
    keepAliveMaxTimeout: 120000,
    connect: { timeout: 3500, rejectUnauthorized: true },
    bodyTimeout: 8000,
    headersTimeout: 6000
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

  const hardCooldownReasons = ["too_recent", "too_many", "too_many_guesses", "try_again", "next_method", "temporarily_unavailable", "rate_overlimit"];
  const readyReasons = ["incorrect", "sent", "sms_sent", "code_sent", "ok", ""];

  if (hardCooldownReasons.includes(reason) || (cooldownSeconds >= 600 && status !== "ok")) {
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

  if (status === "ok" || readyReasons.includes(reason) || (cooldownSeconds > 0 && cooldownSeconds < 600 && !hardCooldownReasons.includes(reason))) {
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

function numWait(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function extractMethodWaits(parsed, existJson, codeJson) {
  const cd = (parsed && parsed.cooldowns) || {};
  const pick = (obj, keys) => {
    for (const k of keys) {
      if (obj && obj[k] != null) {
        if (typeof obj[k] === "object" && obj[k].seconds != null) return numWait(obj[k].seconds);
        return numWait(obj[k]);
      }
    }
    return 0;
  };
  return {
    sms: pick(cd, ["sms"]) || pick(codeJson || {}, ["sms_wait", "retry_after", "wait"]) || pick(existJson || {}, ["sms_wait", "retry_after"]),
    voice: pick(cd, ["voice"]) || pick(codeJson || {}, ["voice_wait"]) || pick(existJson || {}, ["voice_wait"]),
    flash: pick(cd, ["flash"]) || pick(codeJson || {}, ["flash_wait", "flash_type"]) || 0,
    wa_old: pick(cd, ["wa_old_device", "wa_old"]) || pick(codeJson || {}, ["wa_old_wait"]) || 0,
    email: pick(cd, ["email_otp", "email"]) || pick(codeJson || {}, ["email_wait", "email_retry_after"]) || pick(existJson || {}, ["email_wait", "email_retry_after"])
  };
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

  const codeReason = String((codeJson && codeJson.reason) || (existJson && existJson.reason) || parsed.reason || "").toLowerCase();
  const codeStatus = String((codeJson && codeJson.status) || (existJson && existJson.status) || "").toLowerCase();
  const methods = extractMethodWaits(parsed, existJson, codeJson);
  const primaryWait = methods.sms || methods.voice || methods.email || methods.wa_old || methods.flash || 0;

  const hardCooldownReasons = ["too_recent", "too_many", "too_many_guesses", "try_again", "next_method", "temporarily_unavailable", "rate_overlimit"];
  const isHardCooldown = hardCooldownReasons.includes(codeReason) || primaryWait >= 600;

  let isBanned = Boolean(parsed.isBanned);
  let isCloneBlocked = Boolean(parsed.isCloneBlocked);
  const baseReady = Boolean(parsed.isReady) || codeStatus === "ok" || ["incorrect", "sent", "sms_sent", "code_sent"].includes(codeReason);

  let isReady = false;
  let isCooldown = false;
  let isSmsLimited = false;
  let cooldownSeconds = primaryWait;
  let state = "UNKNOWN";

  if (isBanned) {
    state = "BANNED";
  } else if (isCloneBlocked) {
    state = "CLONE_BLOCKED";
  } else if (isHardCooldown) {
    isCooldown = true;
    state = "COOLDOWN";
  } else if (baseReady && methods.sms > 0 && methods.sms < 600) {
    isSmsLimited = true;
    isReady = false;
    cooldownSeconds = methods.sms;
    state = "SMS_LIMIT";
  } else if (baseReady || (primaryWait === 0 && !isHardCooldown)) {
    isReady = true;
    cooldownSeconds = 0;
    state = "READY";
  } else if (primaryWait > 0) {
    isCooldown = true;
    state = "COOLDOWN";
  } else if (baseReady) {
    isReady = true;
    state = "READY";
  }

  const deviceOn = extractDeviceState(parsed, existJson, codeJson);
  const availableMethods = [];
  if (methods.sms === 0 && !isBanned && !isCloneBlocked) availableMethods.push("sms");
  if (methods.voice === 0 && !isBanned && !isCloneBlocked) availableMethods.push("voice");
  if (methods.flash === 0 && !isBanned && !isCloneBlocked) availableMethods.push("flash");
  if (methods.wa_old === 0 && deviceOn && !isBanned) availableMethods.push("wa_old");
  if (methods.email === 0 && !isBanned && !isCloneBlocked) availableMethods.push("email");

  return {
    ...parsed,
    success: true,
    phone: parsed.phone || phone,
    state,
    isReady,
    isCooldown,
    isSmsLimited,
    isCloneBlocked,
    isBanned,
    cooldownSeconds: isCooldown || isSmsLimited ? cooldownSeconds : 0,
    methods,
    availableMethods,
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
    let existText = "";
    let codeText = "";

    try {
      existText = await callWA(payload.exist, payload.userAgent, payload.headers);
    } catch (e1) {
      throw e1;
    }

    try {
      await new Promise(r => setTimeout(r, 5));
      codeText = await callWA(payload.code, payload.userAgent, payload.headers);
    } catch (_) {}

    const parsed = WADetector.parseDualResponse(payload.phoneInfo, existText, codeText || null);
    return normalizeResult(formattedPhone, parsed, existText, codeText || null);
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
      try { existText = await callWA(payload.exist, payload.userAgent, payload.headers); } catch (_) {}
    }
    if (payload.code) {
      try {
        if (existText) await new Promise(r => setTimeout(r, 5));
        codeText = await callWA(payload.code, payload.userAgent, payload.headers);
      } catch (_) {}
    }
    if (payload.email) {
      try {
        if (existText || codeText) await new Promise(r => setTimeout(r, 5));
        const emailResp = await callWA(payload.email, payload.userAgent, payload.headers);
        codeText = emailResp || codeText;
      } catch (_) {}
    }

    if (!existText && !codeText) {
      return { success: false, phone: cleanPhone, error: "REQUEST_TIMEOUT" };
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

async function probePhoneMethods(rawPhone) {
  const checked = await checkPhone(rawPhone);
  if (!checked || !checked.success) {
    return {
      success: false,
      phone: (checked && checked.phone) || rawPhone,
      error: (checked && checked.error) || "probe_failed",
      methods: { sms: 0, voice: 0, flash: 0, wa_old: 0, email: 0 },
      availableMethods: [],
      state: (checked && checked.state) || "ERROR",
      isDeviceOn: false
    };
  }
  return {
    success: true,
    phone: checked.phone,
    state: checked.state,
    isReady: checked.isReady,
    isCooldown: checked.isCooldown,
    isSmsLimited: checked.isSmsLimited,
    isBanned: checked.isBanned,
    isCloneBlocked: checked.isCloneBlocked,
    cooldownSeconds: checked.cooldownSeconds || 0,
    methods: checked.methods || { sms: 0, voice: 0, flash: 0, wa_old: 0, email: 0 },
    availableMethods: checked.availableMethods || [],
    isDeviceOn: Boolean(checked.isDeviceOn || checked.wa_old),
    maskedEmail: checked.maskedEmail || null
  };
}

async function callWAWithRetry(reqObj, userAgent, sharedHeaders, timeoutMs, retries = 1) {
  let lastErr = null;
  for (let i = 0; i <= retries; i++) {
    try {
      return await callWA(reqObj, userAgent, sharedHeaders, timeoutMs);
    } catch (e) {
      lastErr = e;
      const msg = String(e && e.message ? e.message : e);
      if (!/NETWORK_ERROR|REQUEST_TIMEOUT|HTTP_5|EMPTY_UPSTREAM/i.test(msg)) break;
      if (i < retries) await new Promise(r => setTimeout(r, 250 + i * 300));
    }
  }
  throw lastErr;
}

async function sendVerificationCode(rawPhone, method = "sms", options = {}) {
  const cleanPhone = sanitizePhoneInput(rawPhone);
  const allowed = new Set(["sms", "voice", "flash", "email", "wa_old"]);
  const methodKey = allowed.has(String(method || "").toLowerCase()) ? String(method).toLowerCase() : "sms";
  const skipProbe = Boolean(options.skipProbe);

  try {
    let probe = options.probe || null;
    if (!skipProbe && !probe) {
      probe = await probePhoneMethods(cleanPhone);
    }

    if (probe && !probe.success && !options.forceSend) {
      return { success: false, phone: probe.phone, method: methodKey, error: probe.error || "probe_failed", probe };
    }

    if (probe && probe.isBanned) {
      return { success: false, phone: probe.phone, method: methodKey, state: "BANNED", error: "banned", probe, cooldownSeconds: 0 };
    }

    if (probe && methodKey === "wa_old" && !probe.isDeviceOn) {
      return {
        success: false,
        phone: probe.phone,
        method: methodKey,
        state: "NO_DEVICE",
        error: "wa_old_not_available",
        probe,
        cooldownSeconds: 0,
        methods: probe.methods
      };
    }

    if (probe && probe.methods) {
      const waitForMethod = numWait(probe.methods[methodKey]);
      if (waitForMethod > 0 && !options.ignoreCooldown) {
        return {
          success: false,
          phone: probe.phone,
          method: methodKey,
          state: "COOLDOWN",
          error: "method_cooldown",
          cooldownSeconds: waitForMethod,
          methods: probe.methods,
          isDeviceOn: probe.isDeviceOn,
          probe
        };
      }
    }

    const payload = await WADetector.buildDualPayloads(cleanPhone, methodKey);
    if (!payload || !payload.success) {
      return {
        success: false,
        phone: cleanPhone,
        method: methodKey,
        error: (payload && payload.error) || "invalid_phone",
        probe
      };
    }

    const formattedPhone = `+${payload.phoneInfo.full}`;
    let existText = "";
    let codeText = "";

    if (payload.exist) {
      try {
        existText = await callWAWithRetry(payload.exist, payload.userAgent, payload.headers, DEFAULT_TIMEOUT_MS, 1);
      } catch (e) {
        return {
          success: false,
          phone: formattedPhone,
          method: methodKey,
          error: String(e && e.message ? e.message : e),
          probe
        };
      }
    }

    const req = payload.code || null;
    if (!req) {
      return { success: false, phone: formattedPhone, method: methodKey, error: "no_code_endpoint", probe };
    }

    try {
      if (existText) await new Promise(r => setTimeout(r, 20));
      codeText = await callWAWithRetry(req, payload.userAgent, payload.headers, DEFAULT_TIMEOUT_MS, 1);
    } catch (e) {
      return {
        success: false,
        phone: formattedPhone,
        method: methodKey,
        error: String(e && e.message ? e.message : e),
        probe
      };
    }

    const codeJson = safeJsonParse(codeText) || {};
    const existJson = safeJsonParse(existText) || {};
    const reason = String(codeJson.reason || existJson.reason || "").toLowerCase();
    const status = String(codeJson.status || "").toLowerCase();
    const methods = extractMethodWaits(null, existJson, codeJson);
    const cooldownSeconds =
      numWait(methods[methodKey]) ||
      numWait(methods.sms) ||
      numWait(codeJson.retry_after ?? codeJson.sms_wait ?? codeJson.wait);
    const deviceOn = extractDeviceState(null, existJson, codeJson);
    const hardFail = ["blocked", "banned", "no_routes", "bad_token", "length_long", "length_short", "missing"].includes(reason);
    const sentOk = status === "sent" || status === "ok" || ["sent", "sms_sent", "code_sent", "incorrect"].includes(reason);

    if (hardFail) {
      return {
        success: false,
        phone: formattedPhone,
        method: methodKey,
        state: reason === "blocked" || reason === "banned" ? "BANNED" : "FAILED",
        error: reason || "send_failed",
        cooldownSeconds,
        methods,
        isDeviceOn: deviceOn,
        probe
      };
    }

    if (!sentOk && cooldownSeconds > 0 && ["too_recent", "too_many", "try_again", "too_many_guesses"].includes(reason)) {
      return {
        success: false,
        phone: formattedPhone,
        method: methodKey,
        state: "COOLDOWN",
        error: reason,
        cooldownSeconds,
        methods,
        isDeviceOn: deviceOn,
        probe
      };
    }

    return {
      success: true,
      phone: formattedPhone,
      method: methodKey,
      state: "SENT",
      reason: reason || status || "sent",
      cooldownSeconds,
      methods,
      maskedEmail: codeJson.email || codeJson.masked_email || existJson.email || (probe && probe.maskedEmail) || null,
      isDeviceOn: deviceOn,
      hasDevice: deviceOn,
      probe,
      rawStatus: status,
      rawReason: reason
    };
  } catch (e) {
    return {
      success: false,
      phone: cleanPhone,
      method: methodKey,
      error: String(e && e.message ? e.message : e)
    };
  }
}

module.exports = { checkPhone, triggerEmailVerification, sendVerificationCode, probePhoneMethods };
