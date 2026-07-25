"use strict";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailConfiguration(environment = process.env) {
  const provider = String(environment.TRANSACTIONAL_EMAIL_PROVIDER || "").trim().toLowerCase();
  const from = String(environment.TRANSACTIONAL_EMAIL_FROM || "").trim();
  const apiKey = String(environment.RESEND_API_KEY || "").trim();
  const production = String(environment.VERCEL_ENV || environment.NODE_ENV || "").toLowerCase() === "production";

  if (provider === "test" && !production) return { mode: "test", provider: "test", from: from || "test@invalid.local" };
  if (provider === "resend" && apiKey && EMAIL_PATTERN.test(from)) {
    return { mode: "send", provider: "resend", from, apiKey };
  }
  return { mode: "manual_setup", provider: provider || "unconfigured", from };
}

function safeHeader(value, maximum = 200) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim().slice(0, maximum);
}
function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.href : "";
  } catch (_error) {
    return "";
  }
}

async function sendTransactionalEmail(message, options = {}) {
  const configuration = options.configuration || emailConfiguration(options.environment);
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  if (configuration.mode === "manual_setup") {
    return { status: "manual_setup", provider: configuration.provider, reference: "", failureCode: "EMAIL_PROVIDER_NOT_CONFIGURED" };
  }
  if (!EMAIL_PATTERN.test(String(message.to || "").trim())) {
    return { status: "failed", provider: configuration.provider, reference: "", failureCode: "INVALID_RECIPIENT" };
  }
  if (configuration.mode === "test") {
    return { status: "accepted", provider: "test", reference: `test_${safeHeader(message.messageKey, 80)}`, failureCode: "" };
  }
  if (typeof fetchImpl !== "function") {
    return { status: "failed", provider: configuration.provider, reference: "", failureCode: "EMAIL_TRANSPORT_UNAVAILABLE" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs || 8000));
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configuration.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": safeHeader(message.messageKey, 200)
      },
      body: JSON.stringify({
        from: configuration.from,
        to: [String(message.to).trim()],
        subject: safeHeader(message.subject),
        html: String(message.html || ""),
        text: String(message.text || ""),
        ...(EMAIL_PATTERN.test(String(message.replyTo || "").trim()) ? { reply_to: String(message.replyTo).trim() } : {}),
        ...(safeHttpsUrl(message.listUnsubscribe) ? { headers: {
          "List-Unsubscribe": `<${safeHttpsUrl(message.listUnsubscribe)}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
        }} : {})
      }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.id) {
      return {
        status: "failed",
        provider: "resend",
        reference: "",
        failureCode: response.status === 429 ? "PROVIDER_RATE_LIMITED" : `PROVIDER_REJECTED_${response.status}`
      };
    }
    return { status: "accepted", provider: "resend", reference: String(payload.id).slice(0, 500), failureCode: "" };
  } catch (error) {
    return {
      status: "failed",
      provider: "resend",
      reference: "",
      failureCode: error?.name === "AbortError" ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE"
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { EMAIL_PATTERN, emailConfiguration, safeHeader, safeHttpsUrl, sendTransactionalEmail };
