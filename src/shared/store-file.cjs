'use strict';

const fs = require('fs');
const { safeStorage } = require('electron');

const MAGIC = 'CNENC1:';

function canEncrypt() {
  try { return safeStorage.isEncryptionAvailable(); }
  catch { return false; }
}

function readState(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath);
  const text = raw.toString('utf8');
  if (text.startsWith(MAGIC)) {
    if (!canEncrypt()) throw new Error('Encrypted data requires OS keychain unlock');
    const buf = Buffer.from(text.slice(MAGIC.length), 'base64');
    return JSON.parse(safeStorage.decryptString(buf));
  }
  try { return JSON.parse(text); }
  catch { return {}; }
}

function writeState(filePath, state, { encrypt = true } = {}) {
  const json = JSON.stringify(state);
  if (encrypt && canEncrypt()) {
    const enc = safeStorage.encryptString(json);
    fs.writeFileSync(filePath, MAGIC + enc.toString('base64'));
    return { encrypted: true };
  }
  fs.writeFileSync(filePath, json);
  return { encrypted: false };
}

module.exports = { canEncrypt, readState, writeState, MAGIC };
