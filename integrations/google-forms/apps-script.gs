/*
Google Apps Script template: forward Google Form responses to the VA Dashboard intake endpoint.

Setup:
1) Create a Google Form (Money In / Money Out).
2) Link it to a Google Sheet (responses).
3) In the Sheet: Extensions -> Apps Script, paste this file.
4) Fill CONFIG with your tenant_id, endpoint URL, and shared secret.
5) Add a trigger:
   - Triggers -> Add Trigger
   - Function: onFormSubmit
   - Event source: From spreadsheet
   - Event type: On form submit
*/

const CONFIG = {
  tenantId: "REPLACE_WITH_TENANT_UUID",
  endpoint: "https://REPLACE_WITH_YOUR_DOMAIN/api/intake/google-form",
  intakeToken: "REPLACE_WITH_INTAKE_SHARED_SECRET",
  source: "form_in"
};

function toISODate(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  // If already string, try to keep.
  return String(value).slice(0, 10);
}

function onFormSubmit(e) {
  const rowValues = e && e.values ? e.values : null;
  const namedValues = e && e.namedValues ? e.namedValues : null;

  const payload = {
    tenant_id: CONFIG.tenantId,
    source: CONFIG.source,
    date: null,
    amount: null,
    description: null,
    attachment_url: null,
    raw_payload: {
      values: rowValues,
      namedValues: namedValues
    }
  };

  // Optional: map known question titles here for cleaner records.
  // Example question titles: "Date", "Amount", "Description", "Receipt"
  if (namedValues) {
    if (namedValues["Date"] && namedValues["Date"][0]) payload.date = toISODate(namedValues["Date"][0]);
    if (namedValues["Amount"] && namedValues["Amount"][0]) payload.amount = Number(namedValues["Amount"][0]);
    if (namedValues["Description"] && namedValues["Description"][0]) payload.description = String(namedValues["Description"][0]);
    if (namedValues["Receipt"] && namedValues["Receipt"][0]) payload.attachment_url = String(namedValues["Receipt"][0]);
  }

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    headers: {
      "x-intake-token": CONFIG.intakeToken
    }
  };

  const response = UrlFetchApp.fetch(CONFIG.endpoint, options);
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error("Intake POST failed: HTTP " + code + " " + response.getContentText());
  }
}

