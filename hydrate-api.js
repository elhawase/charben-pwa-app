(function(){
  try {
    var g=(typeof globalThis!=='undefined')?globalThis:(typeof global!=='undefined')?global:(typeof window!=='undefined')?window:{};
    if(typeof globalThis==='undefined')globalThis=g; if(typeof window==='undefined')window=g;
    var MP_DEFAULT_STATUT='EN_STOCK';
    var MP_DEFAULT_REFRESH_MS=10000;
    var ESS_SHORT={PIN:'Pin',EPICEA:'Épicéa',CHENE:'Chêne'};
    var _mpTimer=null; var _mpDelay=0; var _hpBusy=false;
    var ESS_ALIAS={pinpinmaritime:'pin',pinmaritime:'pin',epiceasapindenorway:'epicea',sapindenorway:'epicea'};
    function grumeEssKey(v){
      var s=String(v==null?'':v).toLowerCase();
      try{s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(e){}
      s=s.replace(/[^a-z0-9]/g,'');
      return ESS_ALIAS[s]||s;
    }
    function shortEssenceLabel(code){
      var k=String(code==null?'':code).toUpperCase();
      return ESS_SHORT[k]||code||'';
    }
    function fmtVol(v){
      if(v===null||v===undefined||isNaN(Number(v)))return '—';
      return Number(v).toFixed(4);
    }
    function grumeKey(r){
      return String(r.scanCode||r.scan_code||r.code||'').trim().toLowerCase();
    }
    function copyRec(o){
      var c={};
      for(var f in o){if(Object.prototype.hasOwnProperty.call(o,f))c[f]=o[f];}
      return c;
    }
    function mergeGrumes(apiRows,localRows){
      var out=[]; var seen={}; var lmap={}; var i;
      for(i=0;i<(localRows||[]).length;i++){var l=localRows[i]||{};var k=grumeKey(l);if(k)lmap[k]=l;}
      for(i=0;i<(apiRows||[]).length;i++){
        var x=apiRows[i]||{}; var kx=grumeKey(x); var lt=lmap[kx];
        var merged=x;
        if(lt){
          merged=copyRec(x);
          if(!merged.fournisseur&&lt.fournisseur)merged.fournisseur=lt.fournisseur;
          if(!merged.origine&&lt.origine)merged.origine=lt.origine;
          if(!merged.qualite&&lt.qualite)merged.qualite=lt.qualite;
          if(!merged.prixM3&&lt.prixM3)merged.prixM3=lt.prixM3;
          if(!merged.scanCode&&lt.scanCode)merged.scanCode=lt.scanCode;
        }
        out.push(merged);
        if(kx)seen[kx]=true;
      }
      for(i=0;i<(localRows||[]).length;i++){
        var l2=localRows[i]||{}; var k2=grumeKey(l2);
        if(!seen[k2]){var cp=copyRec(l2);cp.apiAbsent=true;out.push(cp);}
      }
      return out;
    }
    function mpFilter(list,opts){
      opts=opts||{};
      var ess=opts.essence; var st=opts.statut; var q=String(opts.search||'').toLowerCase();
      var haveEss=!!ess&&ess!=='all'; var haveSt=!!st&&st!=='all'; var haveQ=q.length>0;
      var out=[]; var i,r;
      for(i=0;i<(list||[]).length;i++){
        r=list[i]||{};
        if(haveEss&&grumeEssKey(r.essence)!==grumeEssKey(ess))continue;
        if(haveSt&&String(r.statut||'')!==st)continue;
        if(haveQ&&String(r.code||'').toLowerCase().indexOf(q)===-1&&grumeEssKey(r.essence).indexOf(q)===-1&&String(r.fournisseur||'').toLowerCase().indexOf(q)===-1)continue;
        out.push(r);
      }
      return out;
    }
    function mpScreenActive(){
      try{
        var s=typeof document!=='undefined'?document.getElementById('screenMp'):null;
        return !!(s&&s.classList&&s.classList.contains('active'));
      }catch(e){return false;}
    }
    function startMpAutoRefresh(delayMs){
      if(_mpTimer!==null)return true;
      var d=(typeof delayMs==='number'&&delayMs>0)?delayMs:MP_DEFAULT_REFRESH_MS;
      _mpTimer=setInterval(function(){
        if(!mpScreenActive())return;
        if(typeof window.hydrateGrumesFromApi==='function'){try{window.hydrateGrumesFromApi();}catch(e){}}
      },d);
      _mpDelay=d;
      return _mpTimer!==null;
    }
    function stopMpAutoRefresh(){
      if(_mpTimer!==null){clearInterval(_mpTimer);_mpTimer=null;_mpDelay=0;}
      return _mpTimer===null;
    }
    function getMpAutoRefreshState(){return{active:_mpTimer!==null,delayMs:_mpDelay};}
    /* Données locales (Firestore) : plus aucun appel réseau.
       hp/hpf déclenchent simplement le re-rendu des écrans MP / PF. */
    async function hp(){
      if(_hpBusy)return;
      _hpBusy=true;
      try{
        if(typeof renderGrumes==='function'){try{renderGrumes();}catch(e){}}
        if(typeof updateMpStats==='function'){try{updateMpStats();}catch(e){}}
      }finally{
        _hpBusy=false;
      }
    }
    async function hpf(){
      if(typeof renderProduitsFinis==='function'){try{renderProduitsFinis();}catch(e){}}
      if(typeof renderPfRecap==='function'){try{renderPfRecap();}catch(e){}}
    }
    g.hydrateGrumesFromApi=hp; g.hydratePfFromApi=hpf;
    g.shortEssenceLabel=shortEssenceLabel; g.grumeEssKey=grumeEssKey; g.fmtVol=fmtVol;
    g.mergeGrumes=mergeGrumes; g.mpFilter=mpFilter; g.MP_DEFAULT_STATUT=MP_DEFAULT_STATUT;
    g.startMpAutoRefresh=startMpAutoRefresh; g.stopMpAutoRefresh=stopMpAutoRefresh;
    g.getMpAutoRefreshState=getMpAutoRefreshState;
    if(typeof window!=='undefined'){
      window.hydrateGrumesFromApi=hp;window.hydratePfFromApi=hpf;
      window.shortEssenceLabel=shortEssenceLabel;window.grumeEssKey=grumeEssKey;window.fmtVol=fmtVol;
      window.mergeGrumes=mergeGrumes;window.mpFilter=mpFilter;window.MP_DEFAULT_STATUT=MP_DEFAULT_STATUT;
      window.startMpAutoRefresh=startMpAutoRefresh;window.stopMpAutoRefresh=stopMpAutoRefresh;
      window.getMpAutoRefreshState=getMpAutoRefreshState;
    }
    if(typeof globalThis!=='undefined'){
      globalThis.hydrateGrumesFromApi=hp;globalThis.hydratePfFromApi=hpf;
      globalThis.shortEssenceLabel=shortEssenceLabel;globalThis.grumeEssKey=grumeEssKey;globalThis.fmtVol=fmtVol;
      globalThis.mergeGrumes=mergeGrumes;globalThis.mpFilter=mpFilter;globalThis.MP_DEFAULT_STATUT=MP_DEFAULT_STATUT;
      globalThis.startMpAutoRefresh=startMpAutoRefresh;globalThis.stopMpAutoRefresh=stopMpAutoRefresh;
      globalThis.getMpAutoRefreshState=getMpAutoRefreshState;
    }
  }catch(e){}
})();
