/**
 * Ethical Horizon Toolkit — shared backend (Modules 1 & 2)
 * Paste this into Extensions > Apps Script in your Google Sheet, replacing
 * the previous version, then Deploy > Manage deployments > edit (pencil) >
 * Version: New version > Deploy. The Web App URL stays the same, so
 * Module 1's ENDPOINT_URL does not need to change.
 */

const SIGNALS_SHEET = 'Signals';
const DELPHI_SHEET = 'DelphiResponses';

const SIGNAL_HEADERS = [
  'timestamp', 'title', 'description', 'subfield', 'sourceType',
  'sourceLink', 'maturity', 'geography', 'intensity',
  'submitterName', 'submitterEmail'
];

const DELPHI_HEADERS = [
  'timestamp', 'round', 'expertName', 'expertEmail',
  'signalId', 'signalTitle', 'plausibility', 'significance', 'urgency', 'comment'
];

const TIER_MAP = { 'کم': 1, 'متوسط': 2, 'زیاد': 3 };
const TIER_LABELS = ['', 'کم', 'متوسط', 'زیاد'];

/* ---------------- entry points ---------------- */

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'signals') return jsonOutput_(getSignals_());
  if (action === 'aggregates') return jsonOutput_(getAggregates_(e.parameter.round || '1'));
  if (action === 'dashboard') return jsonOutput_(getDashboardData_());
  return jsonOutput_({ error: 'unknown action' });
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  if (data.recordType === 'delphi') return handleDelphiSubmit_(data);
  return handleSignalSubmit_(data);
}

/* ---------------- Module 1: signal intake ---------------- */

function handleSignalSubmit_(data) {
  const sheet = getOrCreateSheet_(SIGNALS_SHEET, SIGNAL_HEADERS);
  const row = SIGNAL_HEADERS.map(function (k) { return data[k] || ''; });
  sheet.appendRow(row);
  return jsonOutput_({ status: 'ok' });
}

function getSignals_() {
  const sheet = getOrCreateSheet_(SIGNALS_SHEET, SIGNAL_HEADERS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  return values.slice(1)
    .map(function (row, i) {
      const obj = { id: i + 2 }; // sheet row number, used as stable-enough signal id
      headers.forEach(function (h, idx) { obj[h] = row[idx]; });
      return obj;
    })
    .filter(function (r) { return r.title; });
}

/* ---------------- Module 2: Delphi elicitation ---------------- */

function handleDelphiSubmit_(data) {
  const sheet = getOrCreateSheet_(DELPHI_SHEET, DELPHI_HEADERS);
  (data.responses || []).forEach(function (resp) {
    const record = {
      timestamp: data.timestamp,
      round: data.round,
      expertName: data.expertName,
      expertEmail: data.expertEmail,
      signalId: resp.signalId,
      signalTitle: resp.signalTitle,
      plausibility: resp.plausibility,
      significance: resp.significance,
      urgency: resp.urgency,
      comment: resp.comment
    };
    const row = DELPHI_HEADERS.map(function (k) { return record[k] || ''; });
    sheet.appendRow(row);
  });
  return jsonOutput_({ status: 'ok' });
}

function getAggregates_(round) {
  round = round || '1';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(DELPHI_SHEET);
  if (!sheet) return {};

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return {};

  const headers = values[0];
  const idx = {};
  headers.forEach(function (h, i) { idx[h] = i; });

  const groups = {};
  values.slice(1).forEach(function (row) {
    if (String(row[idx.round]) !== String(round)) return;
    const sid = row[idx.signalId];
    if (!groups[sid]) groups[sid] = { plausibility: [], significance: [], urgency: [] };
    ['plausibility', 'significance', 'urgency'].forEach(function (dim) {
      const v = TIER_MAP[row[idx[dim]]];
      if (v) groups[sid][dim].push(v);
    });
  });

  const result = {};
  Object.keys(groups).forEach(function (sid) {
    const g = groups[sid];
    const pMed = median_(g.plausibility);
    const sMed = median_(g.significance);
    const uMed = median_(g.urgency);
    result[sid] = {
      count: g.plausibility.length,
      plausibility: TIER_LABELS[pMed],
      significance: TIER_LABELS[sMed],
      urgency: TIER_LABELS[uMed],
      plausibilityValue: pMed,
      significanceValue: sMed,
      urgencyValue: uMed
    };
  });
  return result;
}

/* ---------------- Module 3: monitoring dashboard ---------------- */

function getDashboardData_() {
  const signals = getSignals_();
  const agg1 = getAggregates_('1');
  const agg2 = getAggregates_('2');

  const enriched = signals.map(function (s) {
    const a1 = agg1[s.id] || null;
    const a2 = agg2[s.id] || null;
    return Object.assign({}, s, {
      round1: a1,
      round2: a2,
      latest: a2 || a1 || null
    });
  });

  return {
    signals: enriched,
    summary: buildSummary_(signals),
    delphiMeta: getDelphiMeta_()
  };
}

function buildSummary_(signals) {
  const counts = { subfield: {}, maturity: {}, geography: {}, intensity: {} };
  signals.forEach(function (s) {
    ['subfield', 'maturity', 'geography', 'intensity'].forEach(function (k) {
      const v = s[k] || 'نامشخص';
      counts[k][v] = (counts[k][v] || 0) + 1;
    });
  });
  return { total: signals.length, counts: counts };
}

function getDelphiMeta_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(DELPHI_SHEET);
  if (!sheet) return { expertCount: 0, round1Count: 0, round2Count: 0 };

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { expertCount: 0, round1Count: 0, round2Count: 0 };

  const headers = values[0];
  const idx = {};
  headers.forEach(function (h, i) { idx[h] = i; });

  const experts = {};
  let round1Count = 0, round2Count = 0;
  values.slice(1).forEach(function (row) {
    const name = row[idx.expertName];
    if (name) experts[name] = true;
    if (String(row[idx.round]) === '1') round1Count++;
    if (String(row[idx.round]) === '2') round2Count++;
  });

  return { expertCount: Object.keys(experts).length, round1Count: round1Count, round2Count: round2Count };
}

function median_(arr) {
  if (!arr.length) return 0;
  const sorted = arr.slice().sort(function (a, b) { return a - b; });
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/* ---------------- shared helpers ---------------- */

function getOrCreateSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
