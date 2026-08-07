"use strict";

const crypto = require("node:crypto");
const { EMAIL_PATTERN, sendTransactionalEmail } = require("../server/transactional-email.js");

const MAX_BODY_BYTES = 32 * 1024;
const DISCLOSURE_VERSION = "2026-07-25";
const DISCLOSURE_ID = "catering-specials-email-v1";
const DISCLOSURE_TEXT = "Send me occasional 318 Food Co. catering specials by email. I can unsubscribe at any time.";
const ALLOWED_SOURCES = new Set(["guided_quote", "contact_form"]);

function json(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(payload));
}

function clean(value, maximum = 1000) {
  return String(value ?? "").trim().slice(0, maximum);
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function canonicalPayload(input) {
  const attribution = input.attribution && typeof input.attribution === "object" ? input.attribution : {};
  return {
    source: clean(input.source, 40),
    name: clean(input.name, 200),
    company: clean(input.company, 200),
    email: clean(input.email, 320).toLowerCase(),
    phone: clean(input.phone, 50),
    eventDate: clean(input.eventDate, 10) || null,
    eventTime: clean(input.eventTime, 20),
    guests: input.guests === "" || input.guests == null ? null : Number(input.guests),
    menu: clean(input.menu, 300),
    eventType: clean(input.eventType, 300),
    budget: input.budget === "" || input.budget == null ? null : Number(input.budget),
    address: clean(input.address, 1000),
    notes: clean(input.notes, 5000),
    marketingConsent: input.marketingConsent === true,
    attribution
  };
}

function validatePayload(input) {
  const value = canonicalPayload(input || {});
  const errors = [];
  if (!ALLOWED_SOURCES.has(value.source)) errors.push("Invalid submission source.");
  if (value.name.length < 2) errors.push("Name is required.");
  if (!EMAIL_PATTERN.test(value.email)) errors.push("A valid email is required.");
  if (value.phone.replace(/\D/g, "").length < 7) errors.push("A valid phone number is required.");
  if (value.guests != null && (!Number.isInteger(value.guests) || value.guests < 1 || value.guests > 10000)) errors.push("Guest count is invalid.");
  if (value.budget != null && (!Number.isFinite(value.budget) || value.budget < 0 || value.budget > 10000000)) errors.push("Budget is invalid.");
  if (value.eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(value.eventDate)) errors.push("Event date is invalid.");
  return { value, errors };
}

function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function rateLimitHash(request, secret) {
  const forwarded = clean(request.headers["x-forwarded-for"], 500).split(",")[0].trim();
  const address = forwarded || clean(request.socket?.remoteAddress, 200) || "unknown";
  return crypto.createHmac("sha256", secret).update(address).digest("hex");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function detailLines(lead) {
  return [
    ["Name", lead.name],
    ["Company", lead.company],
    ["Email", lead.email],
    ["Phone", lead.phone],
    ["Event date", lead.eventDate],
    ["Event time", lead.eventTime],
    ["Guests", lead.guests],
    ["Event type", lead.eventType],
    ["Menu / service", lead.menu],
    ["Budget / estimate", lead.budget == null ? "" : `$${Number(lead.budget).toFixed(2)}`],
    ["Address", lead.address],
    ["Notes", lead.notes]
  ].filter(([, value]) => value !== "" && value != null);
}

function emailBody(title, intro, lead, footer, adminLink = "") {
  const details = detailLines(lead);
  const text = [title, "", intro, "", ...details.map(([label, value]) => `${label}: ${value}`), "", footer, adminLink].filter(Boolean).join("\n");
  const rows = details.map(([label, value]) =>
    `<tr><th style="padding:8px;text-align:left;vertical-align:top">${escapeHtml(label)}</th><td style="padding:8px">${escapeHtml(value)}</td></tr>`
  ).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f3;font-family:Arial,sans-serif;color:#111"><main style="max-width:640px;margin:auto;padding:24px"><section style="background:#fff;border-radius:18px;padding:28px"><div style="color:#e21b23;font-weight:800">318 FOOD CO.</div><h1 style="font-size:28px">${escapeHtml(title)}</h1><p style="line-height:1.6">${escapeHtml(intro)}</p><table style="width:100%;border-collapse:collapse">${rows}</table><p style="line-height:1.6">${escapeHtml(footer)}</p>${adminLink ? `<p><a href="${escapeHtml(adminLink)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#e21b23;color:#fff;text-decoration:none;font-weight:800">Open Quote Management</a></p>` : ""}</section></main></body></html>`;
  return { html, text };
}

async function supabaseRequest(configuration, path, options = {}) {
  const response = await fetch(`${configuration.url}${path}`, {
    ...options,
    headers: {
      apikey: configuration.serviceKey,
      Authorization: `Bearer ${configuration.serviceKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (_error) { body = text; }
  if (!response.ok) {
    const error = new Error(body?.message || body?.error || `Database request failed (${response.status}).`);
    error.status = response.status;
    error.code = body?.code || "";
    throw error;
  }
  return body;
}

function publicResult(leadId, deduplicated, customerStatus, ownerStatus) {
  const acceptedCustomer = customerStatus === "accepted";
  const acceptedOwner = ownerStatus === "accepted";
  let code = "LEAD_SAVED_EMAILS_FAILED";
  let message = "Your request was received, but we could not send email confirmations. Please call 318 Food Co. if your request is urgent.";
  if (acceptedCustomer && acceptedOwner) {
    code = deduplicated ? "DUPLICATE_RECOGNIZED" : "LEAD_SAVED_EMAILS_ACCEPTED";
    message = deduplicated ? "We already received this request. No duplicate was created." : "Your request was received. A confirmation email has been accepted for delivery.";
  } else if (acceptedCustomer) {
    code = "LEAD_SAVED_OWNER_EMAIL_FAILED";
    message = "Your request was received and your confirmation email was accepted. Please call if your request is urgent.";
  } else if (acceptedOwner) {
    code = "LEAD_SAVED_CUSTOMER_EMAIL_FAILED";
    message = "Your request was received, but we could not send your confirmation email.";
  }
  return { ok: true, leadId, deduplicated, code, message, email: { customer: customerStatus, owner: ownerStatus } };
}

async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    json(response, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Method not allowed." });
    return;
  }
  const contentLength = Number(request.headers["content-length"] || 0);
  const body = request.body && typeof request.body === "object" ? request.body : {};
  const measuredLength = Buffer.byteLength(JSON.stringify(body));
  if (contentLength > MAX_BODY_BYTES || measuredLength > MAX_BODY_BYTES) {
    json(response, 413, { ok: false, code: "REQUEST_TOO_LARGE", message: "The request is too large. Please shorten the notes and try again." });
    return;
  }
  const environment = process.env;
  const configuration = {
    url: clean(environment.PUBLIC_SUPABASE_URL, 500).replace(/\/$/, ""),
    serviceKey: clean(environment.SUPABASE_SERVICE_ROLE_KEY, 5000)
  };
  const rateSecret = clean(environment.LEAD_RATE_LIMIT_SECRET, 500);
  if (!configuration.url || !configuration.serviceKey || rateSecret.length < 32) {
    json(response, 503, { ok: false, code: "LEAD_SERVICE_NOT_CONFIGURED", message: "Catering request services are temporarily unavailable. Please call 318 Food Co." });
    return;
  }
  if (clean(body.website, 200)) {
    json(response, 422, { ok: false, code: "SUSPECTED_SPAM", message: "We could not accept this request. Please call 318 Food Co. for assistance." });
    return;
  }
  const idempotencyKey = clean(request.headers["idempotency-key"] || body.idempotencyKey, 100);
  if (!validUuid(idempotencyKey)) {
    json(response, 400, { ok: false, code: "INVALID_IDEMPOTENCY_KEY", message: "Please refresh the page and try again." });
    return;
  }
  const { value: lead, errors } = validatePayload(body);
  if (errors.length) {
    json(response, 400, { ok: false, code: "INVALID_SUBMISSION", message: errors[0] });
    return;
  }

  const requestHash = stableHash(lead);
  const notes = [
    lead.eventTime ? `Time: ${lead.eventTime}` : "",
    lead.address ? `Address: ${lead.address}` : "",
    lead.notes
  ].filter(Boolean).join("\n");

  try {
    const rpc = await supabaseRequest(configuration, "/rest/v1/rpc/submit_release1_lead", {
      method: "POST",
      body: JSON.stringify({
        p_idempotency_key: idempotencyKey,
        p_request_hash: requestHash,
        p_rate_limit_key: rateLimitHash(request, rateSecret),
        p_rate_limit_max: Number(environment.LEAD_RATE_LIMIT_MAX || 5),
        p_rate_limit_window_seconds: Number(environment.LEAD_RATE_LIMIT_WINDOW_SECONDS || 900),
        p_submission_source: lead.source,
        p_name: lead.name,
        p_company: lead.company,
        p_email: lead.email,
        p_phone: lead.phone,
        p_event_date: lead.eventDate,
        p_guests: lead.guests,
        p_menu: lead.menu,
        p_event_type: lead.eventType,
        p_budget: lead.budget,
        p_notes: notes,
        p_attribution: lead.attribution,
        p_marketing_consent: lead.marketingConsent,
        p_disclosure_version: DISCLOSURE_VERSION,
        p_disclosure_id: DISCLOSURE_ID,
        p_disclosure_text: DISCLOSURE_TEXT
      })
    });
    const result = Array.isArray(rpc) ? rpc[0] : rpc;
    const leadId = Number(result?.lead_id);
    const deduplicated = result?.deduplicated === true;
    if (!Number.isSafeInteger(leadId) || leadId < 1) throw new Error("Lead persistence was not confirmed.");

    if (deduplicated) {
      const rows = await supabaseRequest(configuration, `/rest/v1/leads?id=eq.${leadId}&select=customer_confirmation_status,owner_notification_status&limit=1`);
      const saved = Array.isArray(rows) ? rows[0] : null;
      json(response, 200, publicResult(leadId, true, saved?.customer_confirmation_status || "not_attempted", saved?.owner_notification_status || "not_attempted"));
      return;
    }

    const ownerEmail = clean(environment.LEAD_NOTIFICATION_TO, 320);
    const adminBase = clean(environment.ADMIN_BASE_URL, 1000).replace(/\/$/, "");
    const businessPhone = clean(environment.BUSINESS_PHONE || "(318) 572-0137", 100);
    const businessEmail = clean(environment.BUSINESS_EMAIL || ownerEmail, 320);
    const responseExpectation = clean(environment.LEAD_RESPONSE_EXPECTATION, 300);
    const customerFooter = [
      "This request is not a confirmed booking.",
      responseExpectation ? `Response expectation: ${responseExpectation}` : "Our team will contact you after reviewing availability and details.",
      `Questions? Call ${businessPhone}${businessEmail ? ` or email ${businessEmail}` : ""}.`
    ].join(" ");
    const customerBody = emailBody("We received your catering request", "Thank you for considering 318 Food Co. Here is a summary of your request.", lead, customerFooter);
    const ownerBody = emailBody(`New catering request #${leadId}`, `A new ${lead.source === "contact_form" ? "contact form" : "guided quote"} request was saved.`, lead, "Review the request in the authenticated admin before following up.", adminBase ? `${adminBase}/admin.html?panel=leads&quote=${leadId}` : "");

    const customerDelivery = await sendTransactionalEmail({
      to: lead.email,
      subject: "318 Food Co. received your catering request",
      ...customerBody,
      messageKey: `lead-${leadId}-customer`
    });
    const ownerDelivery = ownerEmail ? await sendTransactionalEmail({
      to: ownerEmail,
      subject: `New 318 Food Co. catering request #${leadId}`,
      ...ownerBody,
      messageKey: `lead-${leadId}-owner`
    }) : { status: "manual_setup", provider: "unconfigured", reference: "", failureCode: "OWNER_RECIPIENT_NOT_CONFIGURED" };

    for (const [messageType, delivery] of [["customer_confirmation", customerDelivery], ["owner_notification", ownerDelivery]]) {
      try {
        await supabaseRequest(configuration, "/rest/v1/rpc/record_lead_email_delivery", {
          method: "POST",
          body: JSON.stringify({
            p_lead_id: leadId,
            p_message_type: messageType,
            p_status: delivery.status,
            p_provider: delivery.provider,
            p_provider_reference: delivery.reference,
            p_failure_code: delivery.failureCode
          })
        });
      } catch (recordError) {
        console.error("Lead email state recording failed.", { leadId, messageType, code: recordError.code || "DATABASE_ERROR" });
      }
      if (delivery.status === "failed") {
        console.error("Lead email delivery failed.", { leadId, messageType, code: delivery.failureCode });
      }
    }

    json(response, 201, publicResult(leadId, false, customerDelivery.status, ownerDelivery.status));
  } catch (error) {
    const rateLimited = /rate limit/i.test(error.message || "");
    console.error("Lead submission failed.", { code: error.code || "LEAD_SUBMISSION_FAILED", status: error.status || 500 });
    json(response, rateLimited ? 429 : 502, {
      ok: false,
      code: rateLimited ? "RATE_LIMITED" : "LEAD_SAVE_FAILED",
      message: rateLimited
        ? "Too many requests were received. Please wait and try again, or call 318 Food Co."
        : "Your request was not confirmed as saved. Please try again or call 318 Food Co."
    });
  }
}

module.exports = {
  MAX_BODY_BYTES, DISCLOSURE_VERSION, DISCLOSURE_ID, DISCLOSURE_TEXT,
  canonicalPayload, validatePayload, stableHash, rateLimitHash, detailLines,
  emailBody, publicResult, handler
};
