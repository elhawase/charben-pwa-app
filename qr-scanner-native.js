/* qr-scanner-native.js — Wrapper scan QR natif
   Utilise @capacitor-mlkit/barcode-scanning quand disponible (Android),
   fallback sur JSQR (web) si le plugin natif n'est pas chargé.
   Ne modifie PAS le flow existant — ajoute juste la capacité native. */
(function() {
  'use strict';

  var _nativeAvailable = false;

  async function checkNative() {
    try {
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BarcodeScanner) {
        var status = await window.Capacitor.Plugins.BarcodeScanner.isPermissionsGranted();
        _nativeAvailable = status && status.granted;
      }
    } catch (e) {
      _nativeAvailable = false;
    }
  }

  async function scanNative() {
    if (!_nativeAvailable) return null;
    try {
      var result = await window.Capacitor.Plugins.BarcodeScanner.scan({
        formats: ['QR_CODE', 'DATA_MATRIX', 'CODE_128'],
        cameraDirection: 'back',
        lensFacing: 'environment'
      });
      if (result && result.barcode && result.barcode.rawValue) {
        return result.barcode.rawValue;
      }
      return null;
    } catch (e) {
      if (e.message && e.message.includes('cancelled')) return null;
      errLog('qr-scanner', 'scan', e.message, 'warn');
      return null;
    }
  }

  async function requestPermissions() {
    if (!_nativeAvailable) return false;
    try {
      var result = await window.Capacitor.Plugins.BarcodeScanner.requestPermissions();
      _nativeAvailable = result && result.granted;
      return _nativeAvailable;
    } catch (e) {
      return false;
    }
  }

  /* Initialiser au chargement */
  if (window.Capacitor) {
    checkNative();
  }

  window.qrScannerNative = {
    isAvailable: function() { return _nativeAvailable; },
    scan: scanNative,
    requestPermissions: requestPermissions
  };
})();
