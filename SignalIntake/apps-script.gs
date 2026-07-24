/**
 * Ethical Horizon Toolkit — Module 1: Signal Intake
 * Paste this into Extensions > Apps Script in your Google Sheet, then
 * Deploy > New deployment > Web app (Execute as: Me, Access: Anyone).
 * Copy the resulting URL into ENDPOINT_URL in signal-intake.html.
 */

const SHEET_NAME = 'Signals';

const HEADERS = [
  'timestamp',
  'title',
  'description',
  'subfield',
  'sourceType',
  'sourceLink',
  'maturity',
  'geography',
  'intensity',
  'submitterName',
  'submitterEmail'
];

function doPost(e) {
  const sheet = getOrCreateSheet_();
  const data = JSON.parse(e.postData.contents);

  const row = HEADERS.map(function(key) {
    return data[key] || '';
  });

  sheet.appendRow(row);

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}
