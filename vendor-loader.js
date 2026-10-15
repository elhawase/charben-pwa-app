/* vendor-loader.js — lazy-load vendors lourds (xlsx, jsqr, qrcode)
   Requis par : data-tables.js (xlsx import), app.js (qr generation),
   fardeaux-manager.js / grumes-manager.js (qr scan via jsQR).
   NE JAMAIS charger ce fichier AVANT que les modules l'aient besoin
   (le charger trop tôt casse le lazy-load). */
(function(){
  var _v={};
  var PATHS={xlsx:'vendor/xlsx.full.min.js',jsqr:'vendor/jsqr.js',qrcode:'vendor/qrcode.js'};

  function ensureVendor(name){
    if(_v[name]) return Promise.resolve(true);
    if(name==='xlsx'  && typeof XLSX!=='undefined')   {_v.xlsx=1;   return Promise.resolve(true)}
    if(name==='jsqr'  && typeof jsQR!=='undefined')   {_v.jsqr=1;   return Promise.resolve(true)}
    if(name==='qrcode'&& typeof qrcode!=='undefined') {_v.qrcode=1; return Promise.resolve(true)}
    var p=PATHS[name]; if(!p) return Promise.resolve(false);
    return new Promise(function(res){
      var s=document.createElement('script');
      s.src=p;
      s.onload=function(){_v[name]=1;res(true)};
      s.onerror=function(){_v[name]=0;res(false)};
      document.head.appendChild(s);
    });
  }

  function idleLoadVendors(){
    var run=function(){ensureVendor('qrcode');ensureVendor('jsqr')};
    setTimeout(run, 0);
  }

  window.ensureVendor=ensureVendor;
  window.idleLoadVendors=idleLoadVendors;
})();
