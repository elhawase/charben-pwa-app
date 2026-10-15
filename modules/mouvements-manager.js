/**
 * MOUVEMENTS-MANAGER.JS — registre append-only des mouvements de production
 *
 * Une ligne IMMUABLE par opération de sciage. Jamais modifiée, jamais supprimée.
 * C'est ce qui permet à la fiche de production de survivre au transfert des pièces
 * vers le stock PF : `wipProducts` est une table d'ÉTAT (le `statut` évolue),
 * ce registre est un HISTORIQUE.
 *
 * Natures : GRUME_ENTREE · SEMI_FINI · DOSSE · CHUTE
 *
 * Globals : dashboardRenderer (ofLine), saveToStorage, fsSave, errLog
 */
'use strict';

var MOUVEMENTS_STORAGE_KEY = 'charben_mouvements';
/* Garde-fou de volume (F-05, plan Z phase 3). localStorage ~5 Mo ; au-delà de
   MOUVEMENTS_MAX_PERSIST, le registre n'est JAMAIS tronqué ni suspendu : la tête
   récente part en localStorage, l'ancien tronçon en archive froide indexée Dexie
   (`charben_mouvements_archive`). Le miroir mémoire conserve tout l'historique. */
var MOUVEMENTS_MAX_PERSIST = 20000;

var MOUVEMENTS_ARCHIVE_DB = 'charben_mouvements_archive';
var MOUVEMENTS_ARCHIVE_TABLE = 'blocks';
/* État de l'archive — index de découpe persistant entre persist() successifs :
   le tronçon [0, archivedCount) du miroir est couvert par la base, le reste est
   la tête la plus récente. Repris depuis les blocs au redémarrage. */
var _mouvementsManager_archivedCount = 0;
var _mouvementsManager_archiveBlocks = 0;
var _mouvementsManager_archiveWarnLogged = false;
var _mouvementsManager_archiveDb = null;

function _mouvementsManager_archiveWarn(msg) {
  if (typeof errLog === 'function' && !_mouvementsManager_archiveWarnLogged) {
    errLog('mouvements-manager', 'archive', msg, 'warn');
  }
  _mouvementsManager_archiveWarnLogged = true;
}

/* ─────────────────────────────────────────────
   poste — normalise un libellé de machine en poste réel
   sfMachinePath() renvoie 'A2'/'A3' en dur, quelle que soit la ligne.
   Sur la ligne B le poste réel est 'B2'/'B3' : on ne recopie pas le préfixe.
   ───────────────────────────────────────────── */

window._mouvementsManager_poste = function poste(ofLine, machine) {
  var l = String(ofLine || 'A').charAt(0).toUpperCase() === 'B' ? 'B' : 'A';
  var slot = /([1-4])\s*$/.exec(String(machine || '').toUpperCase());
  return l + (slot ? slot[1] : '1');
};

/* ─────────────────────────────────────────────
   cle — identité d'un mouvement, pour l'idempotence
   ───────────────────────────────────────────── */

window._mouvementsManager_cle = function cle(m) {
  if (!m) return '';
  return [m.ofNum || '', m.grumeCode || '', m.nature || '', m.item || '',
    m.epaisseur || '', m.largeur || ''].join('|');
};

window._mouvementsManager_id = function id(m) {
  return 'MV-' + Date.now().toString(36) + '-' +
    Math.random().toString(36).slice(2, 8);
};

/* ─────────────────────────────────────────────
   charger — miroir mémoire depuis le stockage
   ───────────────────────────────────────────── */

window._mouvementsManager_mouvements = [];

window._mouvementsManager_charger = function charger() {
  try {
    if (typeof localStorage === 'undefined') return window._mouvementsManager_mouvements;
    var raw = localStorage.getItem(MOUVEMENTS_STORAGE_KEY);
    if (!raw) return window._mouvementsManager_mouvements;
    var parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      window._mouvementsManager_mouvements = parsed.filter(function (m) {
        return m && m.nature;
      });
    }
  } catch (e) {
    if (typeof errLog === 'function') errLog('mouvements-manager', 'charger', e, 'warn');
  }
  return window._mouvementsManager_mouvements;
};

/* ─────────────────────────────────────────────
   enregistrer — APPEND ONLY
   `ofLine` est la ligne NORMALISÉE, fournie par l'appelant via l'accesseur
   canonique dashboardRenderer.ofLine(of). Elle fait autorité pour tout le lot :
   on ne relit jamais la ligne portée par chaque ligne, sinon deux pièces du même
   import pourraient se retrouver attribuées à deux lignes différentes.
   Retourne le nombre de lignes réellement ajoutées.
   ───────────────────────────────────────────── */

window._mouvementsManager_enregistrer = function enregistrer(liste, ofLine) {
  if (!liste || !liste.length) return 0;
  var all = window._mouvementsManager_mouvements;
  if (!Array.isArray(all)) all = window._mouvementsManager_mouvements = [];

  /* Normalisation par le poste : une seule règle de ligne dans tout le module. */
  var ln = window._mouvementsManager_poste(ofLine, 'A1').charAt(0);

  var vues = {};
  for (var i = 0; i < all.length; i++) {
    vues[window._mouvementsManager_cle(all[i])] = 1;
  }

  var ajoutes = 0, maintenant = new Date().toISOString();
  for (var j = 0; j < liste.length; j++) {
    var src = liste[j];
    if (!src) continue;
    var m = {
      id: src.id || window._mouvementsManager_id(src),
      ts: src.ts || maintenant,
      ofNum: src.ofNum || '',
      line: ln,
      machine: src.machine || '',
      grumeCode: src.grumeCode || '',
      /* UNITÉS — ne pas deviner, c'est la source d'une erreur centenaire :
         grumeDia  : diamètre de la grume en CENTIMÈTRES (comme rawMaterials.diametre ;
                     × 10 pour des mm). grumeVol en m³.
         longueurM : longueur de la grume en MÈTRES (distincte de `longueur`, mm,
                     réservée aux pièces) — portée par l'entrée GRUME_ENTREE. */
      grumeDia: parseFloat(src.grumeDia) || 0,
      grumeEss: src.grumeEss || '',
      grumeVol: parseFloat(src.grumeVol) || 0,
      longueurM: parseFloat(src.longueurM) || 0,
      /* Pièces : epaisseur / largeur / longueur en MILLIMÈTRES, volume en m³. */
      nature: src.nature || '',
      item: src.item || '',
      epaisseur: parseFloat(src.epaisseur) || 0,
      largeur: parseFloat(src.largeur) || 0,
      longueur: parseFloat(src.longueur) || 0,
      qty: parseFloat(src.qty) || 0,
      volume: parseFloat(src.volume) || 0,
      stock: src.stock || 'AUCUN'
    };
    if (!m.nature) continue;
    var k = window._mouvementsManager_cle(m);
    if (vues[k]) continue;          /* idempotent : déjà compté */
    vues[k] = 1;
    all.push(m);
    ajoutes++;
  }

  window._mouvementsManager_persist();
  return ajoutes;
};

/* ─────────────────────────────────────────────
   persist — localStorage SEUL, sans jamais interrompre l'appelant

   ATTENTION : il n'y a PAS de copie Firestore, et ce n'est pas un oubli.
   Historique : `fsSave('mouvements', ...)` était appelé ici depuis l'origine, mais
   `FS_COLLECTIONS` (firebase-core.js) ne contient aucune clé `mouvements` — l'envoi
   partait donc dans un `if (!colName) return;` muet. Ne pas lire ce bloc comme une
   synchronisation cloud : c'est cette illusion qui a prolongé le diagnostic du bug
   « fiche Production vide » (OF-0125, 05/10/2026). L'appel a été SUPPRIMÉ ; la
   décision « local-only » est maintenant explicite ici et verrouillée par
   tests/persistance-integrite.test.mjs (LOCAL_ONLY).

   Conséquence à connaître : le registre n'existe que dans le localStorage de
   l'appareil. Un effacement des données de l'app le détruit, sans recours.
   Décision explicite du CEO (05/10/2026) : ne pas ajouter de Firestore, le
   plafond de 1 Mo/document étant incompatible avec MOUVEMENTS_MAX_PERSIST.
   ───────────────────────────────────────────── */

window._mouvementsManager_persist = function persist() {
  var all = window._mouvementsManager_mouvements;
  if (!Array.isArray(all) || !all.length) return false;

  /* Dépassement du plafond : tête → localStorage, ancien tronçon → archive froide.
     L'archive n'est jamais supprimée, l'écriture n'est jamais suspendue — c'est ce
     qui garantit la traçabilité au-delà de la limite de volume (F-05). */
  if (all.length > MOUVEMENTS_MAX_PERSIST || _mouvementsManager_archivedCount > 0) {
    window._mouvementsManager_archiver(all);
    var tete = all.slice(all.length - MOUVEMENTS_MAX_PERSIST);
    try {
      if (typeof saveToStorage === 'function') saveToStorage(MOUVEMENTS_STORAGE_KEY, tete);
    } catch (e) {}
    return true;
  }

  try {
    if (typeof saveToStorage === 'function') saveToStorage(MOUVEMENTS_STORAGE_KEY, all);
  } catch (e) {}
  /* PAS d'appel fsSave ici, volontairement. La clé `mouvements` n'existe pas dans
     FS_COLLECTIONS : l'appeler produirait un envoi muet, puis une erreur dans le
     journal à chaque mouvement enregistré. Le registre est déclaré LOCAL_ONLY
     dans tests/persistance-integrite.test.mjs, avec le motif. */
  return true;
};

/* ─────────────────────────────────────────────
   ARCHIVE FROIDE (F-05) — au-delà du plafond, rien n'est perdu
   ─────────────────────────────────────────────
   localStorage plafonne ~5 Mo ; le registre est append-only et ne doit jamais être
   tronqué (invariant du bilan). L'ancien tronçon est donc écrit en blocs indexés
   dans une base Dexie dédiée. Chaque bloc est une tranche CONTIGUË du registre :
   le bloc de seq N couvre les indices [N, N+items.length) — aucune ligne en double,
   aucune trouée. L'identifiant de séquence double de clé primaire et d'ordre.

   Le registre reste entier en mémoire : persist() est synchrone et ne bloque jamais
   l'appelant, l'écriture IDB est lancée en tâche de fond, retentée à chaque appel. */

window._mouvementsManager_archiveDB = function archiveDB() {
  if (_mouvementsManager_archiveDb) return _mouvementsManager_archiveDb;
  try {
    if (typeof Dexie === 'undefined') return null;
    _mouvementsManager_archiveDb = new Dexie(MOUVEMENTS_ARCHIVE_DB);
    _mouvementsManager_archiveDb.version(1).stores({ blocks: 'seq' });
    return _mouvementsManager_archiveDb;
  } catch (e) {
    _mouvementsManager_archiveDb = null;
    return null;
  }
};

window._mouvementsManager_archiver = function archiver(all) {
  if (!Array.isArray(all)) return;
  var db = window._mouvementsManager_archiveDB();
  if (!db) {
    _mouvementsManager_archiveWarn('Archive Dexie indisponible — registre conservé en mémoire, tête seule sur localStorage');
    return;
  }
  var aCouvrir = all.length - MOUVEMENTS_MAX_PERSIST;
  if (aCouvrir <= _mouvementsManager_archivedCount) return;   /* rien de neuf */
  var lot = all.slice(_mouvementsManager_archivedCount, aCouvrir);
  if (!lot.length) return;
  var seq = _mouvementsManager_archivedCount;
  try {
    db.blocks.put({
      seq: seq,
      ts: new Date().toISOString(),
      count: lot.length,
      items: lot
    }).then(function () {
      _mouvementsManager_archivedCount = aCouvrir;
      _mouvementsManager_archiveBlocks++;
    }).catch(function (e) {
      _mouvementsManager_archiveWarn('Écriture archive refusée (IDB) : ' + ((e && e.message) || e));
    });
  } catch (e) {
    _mouvementsManager_archiveWarn('Écriture archive refusée : ' + ((e && e.message) || e));
  }
};

/* Reconstruit le miroir = archive (blocs, ordre de seq) + tête localStorage,
   dédoublonné par clé d'idempotence (une ligne ne peut pas exister aux deux
   endroits : la découpe est par index, et la clé ne ment pas). */
window._mouvementsManager_fusionnerArchive = function fusionnerArchive() {
  var db = window._mouvementsManager_archiveDB();
  if (!db) {
    _mouvementsManager_archivedCount = 0;
    return Promise.resolve(1);
  }
  return db.blocks.orderBy('seq').toArray().then(function (blocs) {
    var archive = [];
    for (var b = 0; b < blocs.length; b++) {
      var bloc = blocs[b];
      if (bloc && Array.isArray(bloc.items)) archive = archive.concat(bloc.items);
    }
    _mouvementsManager_archivedCount = archive.length;
    _mouvementsManager_archiveBlocks = blocs.length;
    if (!archive.length) return;
    var tete = window._mouvementsManager_mouvements;
    var vues = {};
    var fusion = archive.slice();
    for (var i = 0; i < fusion.length; i++) {
      vues[window._mouvementsManager_cle(fusion[i])] = 1;
    }
    for (var j = 0; j < tete.length; j++) {
      var m = tete[j];
      var k = window._mouvementsManager_cle(m);
      if (!m || vues[k]) continue;
      vues[k] = 1;
      fusion.push(m);
    }
    window._mouvementsManager_mouvements = fusion;
  }).catch(function () {
    /* Lecture d'archive secondaire : un échec ici ne doit pas casser le registre. */
    return 1;
  });
};

window._mouvementsManager_rapportArchive = function rapportArchive() {
  var all = window._mouvementsManager_mouvements;
  return {
    enable: typeof Dexie !== 'undefined',
    maxPersist: MOUVEMENTS_MAX_PERSIST,
    archived: _mouvementsManager_archivedCount,
    blocks: _mouvementsManager_archiveBlocks,
    head: Array.isArray(all) ? Math.max(0, all.length - _mouvementsManager_archivedCount) : 0,
    total: Array.isArray(all) ? all.length : 0,
    storage: MOUVEMENTS_STORAGE_KEY,
    archiveDB: MOUVEMENTS_ARCHIVE_DB
  };
};

/* ─────────────────────────────────────────────
   chutesVolume — pertes de lame déduites du pavage de la section
   ─────────────────────────────────────────────
   Les pièces, les dosses et les traits de lame pavent exactement le disque de la
   grume. L'aire perdue en lame est donc la différence entre le disque et la
   surface réellement valorisée — sans hypothèse sur le nombre de lames, et la
   perte croît avec le diamètre, ce qui est le point économique de la découpe.

   À ne pas confondre avec `o.chute` (of-manager) qui est une LARGEUR en mm.
   Ici on renvoie un VOLUME en m³. */

window._mouvementsManager_chutesVolume = function chutesVolume(params) {
  if (!params) return 0;
  var diaCm = parseFloat(params.diametreCm);
  var longueurM = parseFloat(params.longueurM);
  if (!(diaCm > 0) || !(longueurM > 0)) return 0;
  var pieces = Array.isArray(params.pieces) ? params.pieces : [];
  if (!pieces.length) return 0;

  var rayonM = (diaCm / 100) / 2;
  var aireDisque = Math.PI * rayonM * rayonM;

  var aireValorisee = 0;
  for (var i = 0; i < pieces.length; i++) {
    var p = pieces[i];
    if (!p) continue;
    var ep = parseFloat(p.epaisseur);
    var lg = parseFloat(p.largeur);
    var qty = parseFloat(p.qty);
    if (!(ep > 0) || !(lg > 0) || !(qty > 0)) continue;
    aireValorisee += (ep / 1000) * (lg / 1000) * qty;
  }

  /* Jamais de bois négatif : une découpe qui déborde du disque est un défaut de
     saisie, pas une matière à retirer du bilan. */
  var airePerdue = aireDisque - aireValorisee;
  if (!(airePerdue > 0)) return 0;
  return +(airePerdue * longueurM).toFixed(6);
};

/* ─────────────────────────────────────────────
   pertesParPoste — la chute décomposée en 3 postes
   ─────────────────────────────────────────────
   DÉCISION CEO 08/10/2026 (phase B) : une chute n'est pas une masse
   indifférenciée. On distingue :
     - dosses   : reste en attente de récupération (poste A4) — matière non PF,
                  pas une perte définitive ;
     - débites  : traits de lame = nbLames × DISK_THICKNESS × Ø × L — le coût
                  machine, qui croît avec le nombre de lames ;
     - carrelet : reste géométrique du disque (bords arrondis) non valorisable.
   Invariant : entrant = PF + dosses + débites + carrelet, et
               total   = dosses + débites + carrelet (= ce que chutesVolume
               renvoie quand les dosses ne sont pas dans `pieces`).
   DISK_THICKNESS reste la constante métier (4 mm, firebase-core.js) : c'est
   elle qui change si la lame change, elle doit être lisible ici.
   ───────────────────────────────────────────── */

window._mouvementsManager_pertesParPoste = function pertesParPoste(params) {
  function r6(n) { return +parseFloat(n).toFixed(6); }
  var vide = { entrant: 0, pf: 0, dosse: 0, lame: 0, carrelet: 0, total: 0 };
  if (!params) return vide;
  var diaCm = parseFloat(params.diametreCm);
  var longueurM = parseFloat(params.longueurM);
  if (!(diaCm > 0) || !(longueurM > 0)) return vide;
  var pieces = Array.isArray(params.pieces) ? params.pieces : [];
  if (!pieces.length) return vide;

  function aireDe(liste) {
    if (!Array.isArray(liste)) return 0;
    var somme = 0;
    for (var i = 0; i < liste.length; i++) {
      var p = liste[i];
      if (!p) continue;
      var ep = parseFloat(p.epaisseur);
      var lg = parseFloat(p.largeur);
      var qty = parseFloat(p.qty);
      if (!(ep > 0) || !(lg > 0) || !(qty > 0)) continue;
      somme += (ep / 1000) * (lg / 1000) * qty;
    }
    return somme;
  }

  var rayonM = (diaCm / 100) / 2;
  var aireDisque = Math.PI * rayonM * rayonM;

  var entrant = r6(aireDisque * longueurM);
  var pf = r6(aireDe(pieces) * longueurM);
  var dosse = r6(aireDe(params.dosses) * longueurM);

  /* Trait de lame : bande de largeur DISK_THICKNESS sur toute la hauteur du
     disque, pour chaque lame engagée. Pas de nbLames → aucun trait inventé. */
  var epaisseurLame = (typeof DISK_THICKNESS === 'number' && DISK_THICKNESS > 0) ? DISK_THICKNESS : 4;
  var nbLames = parseFloat(params.nbLames);
  var lame = 0;
  if (nbLames > 0) {
    lame = r6(nbLames * (epaisseurLame / 1000) * (diaCm / 100) * longueurM);
  }

  /* Borne : les lames ne peuvent pas consommer plus que ce qui reste après le
     PF et les dosses — sinon le carrelet partait en négatif. */
  var dispo = r6(entrant - pf - dosse);
  if (lame > dispo) lame = dispo > 0 ? dispo : 0;
  var carrelet = r6(dispo > lame ? dispo - lame : 0);
  var total = r6(dosse + lame + carrelet);

  return { entrant: entrant, pf: pf, dosse: dosse, lame: lame, carrelet: carrelet, total: total };
};

/* ─────────────────────────────────────────────
   pourOF — mouvements d'un OF (registre complet, toutes lignes)
   ───────────────────────────────────────────── */

window._mouvementsManager_pourOF = function pourOF(ofNum) {
  var all = window._mouvementsManager_mouvements;
  if (!Array.isArray(all) || !ofNum) return [];
  return all.filter(function (m) { return m && m.ofNum === ofNum; });
};

/* ─────────────────────────────────────────────
   pourOFPoste — un OF restreint à une machine
   Le registre se lit dans deux sens : vertical par OF (toute la matière),
   horizontal par poste (ce que la machine a réellement sorti). Un `poste`
   vide ou absent = tous les postes.
   ───────────────────────────────────────────── */

window._mouvementsManager_pourOFPoste = function pourOFPoste(ofNum, poste) {
  var base = window._mouvementsManager_pourOF(ofNum);
  if (!poste) return base;
  var cible = String(poste).toUpperCase();
  return base.filter(function (m) {
    return m && String(m.machine || '').toUpperCase() === cible;
  });
};

/* ─────────────────────────────────────────────
   soldeGrume — la perte d'UNE grume, par soustraction
   `entrant` vient du stock, les sorties des cotes réelles de découpe : les
   deux grandeurs ne sont jamais identiques au micron près, et c'est ce reste
   qui doit devenir la perte. Le calcul géométrique de `chutesVolume()` reste
   un contrôle, jamais la source : l'utiliser comme volume de chute faisait
   fuir le bilan de 0,0001 m³ sur la ligne B.
   ───────────────────────────────────────────── */

window._mouvementsManager_soldeGrume = function soldeGrume(ofNum, grumeCode) {
  function r4(n) { return +parseFloat(n).toFixed(4); }
  var mv = window._mouvementsManager_pourOF(ofNum);
  var code = String(grumeCode || '');
  var entrant = 0, sorties = 0, trouve = false;
  for (var i = 0; i < mv.length; i++) {
    var m = mv[i];
    if (!m || String(m.grumeCode || '') !== code) continue;
    var v = parseFloat(m.volume) || 0;
    if (m.nature === 'GRUME_ENTREE') { entrant += v; trouve = true; }
    else if (m.nature === 'SEMI_FINI' || m.nature === 'DOSSE') { sorties += v; trouve = true; }
  }
  return {
    entrant: r4(entrant),
    sorties: r4(sorties),
    solde: r4(entrant - sorties),
    sansCode: code === '',
    trouvee: trouve
  };
};

/* ─────────────────────────────────────────────
   bilanOF — agrégation de l'invariant de la fiche
   entrant = semi-finis + dosses + chutes
   ───────────────────────────────────────────── */

window._mouvementsManager_bilanOF = function bilanOF(ofNum) {
  return window._mouvementsManager_bilanPoste(ofNum, '');
};

window._mouvementsManager_bilanPoste = function bilanPoste(ofNum, poste) {
  /* Agrégats arrondis à 4 décimales : un bilan en m³ ne doit jamais afficher
     0.6739999999999999, ni présenter un écart fantôme sur une somme flottante. */
  function r4(n) { return +parseFloat(n).toFixed(4); }

  var mv = window._mouvementsManager_pourOFPoste(ofNum, poste);
  var b = { ofNum: ofNum || '', poste: poste || '', entrant: 0, semiFini: 0, dosses: 0, chutes: 0, grumes: 0, pieces: 0, ecart: 0 };
  var vuesGrumes = {};
  mv.forEach(function (m) {
    if (!m) return;
    var v = parseFloat(m.volume) || 0;
    if (m.nature === 'GRUME_ENTREE') {
      b.entrant += v;
      /* Une grume sans code est réelle mais non identifiable : la compter une
         seule fois, sinon 24 lignes d'import en lot affichent 24 grumes. */
      var cle = String(m.grumeCode || ' sans-code');
      if (!vuesGrumes[cle]) { vuesGrumes[cle] = 1; b.grumes++; }
    } else if (m.nature === 'SEMI_FINI') { b.semiFini += v; b.pieces += (parseFloat(m.qty) || 0); }
    else if (m.nature === 'DOSSE') { b.dosses += v; b.pieces += (parseFloat(m.qty) || 0); }
    else if (m.nature === 'CHUTE') { b.chutes += v; }
  });
  b.entrant = r4(b.entrant);
  b.semiFini = r4(b.semiFini);
  b.dosses = r4(b.dosses);
  b.chutes = r4(b.chutes);
  b.utile = r4(b.semiFini + b.dosses);
  b.reste = r4(b.entrant - b.utile - b.chutes);
  b.ecart = r4(b.entrant - (b.utile + b.chutes));
  /* DÉCISION CEO 08/10/2026 — définition canonique du rendement :
     le rendement est le taux PF = SEMI-FINIS / GRUMES. Une dosse n'est pas du
     produit : c'est un reste en attente de récupération (A4), qui part en
     séchage ni en vente sous sa forme d'origine. Le compter dans le rendement
     mentait sur le résultat de la scierie (34,7 % affichés pour 24,4 % réels).
     La matière valorisée reste `utile` (= PF + dosses) pour l'équation de masse
     de la fiche ; la récupération potentielle est exposée à part, en indicateur. */
  b.rendement = b.entrant > 0 ? r4(b.semiFini / b.entrant * 100) : 0;
  b.rendementRecup = b.entrant > 0 ? r4(b.utile / b.entrant * 100) : 0;
  b.dossesPct = b.entrant > 0 ? r4(b.dosses / b.entrant * 100) : 0;
  b.pertePct = b.entrant > 0 ? r4(b.chutes / b.entrant * 100) : 0;
  return b;
};

/* `mouvements` est un accesseur : le miroir mémoire est réassigné en entier par
   charger() et par les tests. Une propriété de valeur ici l'écraserait — donc
   uniquement le couple get/set. */
window.mouvementsManager = {
  charger: window._mouvementsManager_charger,
  chutesVolume: window._mouvementsManager_chutesVolume,
  pertesParPoste: window._mouvementsManager_pertesParPoste,
  enregistrer: window._mouvementsManager_enregistrer,
  pourOF: window._mouvementsManager_pourOF,
  pourOFPoste: window._mouvementsManager_pourOFPoste,
  soldeGrume: window._mouvementsManager_soldeGrume,
  bilanOF: window._mouvementsManager_bilanOF,
  bilanPoste: window._mouvementsManager_bilanPoste,
  poste: window._mouvementsManager_poste,
  persist: window._mouvementsManager_persist,
  archiver: window._mouvementsManager_archiver,
  fusionnerArchive: window._mouvementsManager_fusionnerArchive,
  rapportArchive: window._mouvementsManager_rapportArchive,
  archiveDB: window._mouvementsManager_archiveDB,
  get mouvements() { return window._mouvementsManager_mouvements; },
  set mouvements(v) { window._mouvementsManager_mouvements = v; },
  STORAGE_KEY: MOUVEMENTS_STORAGE_KEY
};

/* ─────────────────────────────────────────────
   RECHARGEMENT AU DÉMARRAGE — obligatoire.

   `charger()` était le seul lecteur de localStorage et n'était appelé nulle part :
   le miroir mémoire repartait de `[]` à chaque chargement de l'app. Deux dégâts,
   l'un visible et l'autre définitif :

   1. visible  — les fiches lisent le registre et rendent RIEN quand il est vide
                 (« Aucun mouvement enregistré pour OF-XXXX »). L'onglet
                 Production › Fiche devenait vide après un simple redémarrage ;
   2. DEFINITIF— `persist()` réécrit le tableau ENTIER. Le miroir reparti vide, la
                 grume suivante effaçait donc l'historique de tous les OF
                 précédents, sans copie Firestore pour le rattraper.

   Le registre est la source UNIQUE de la fiche de production : il doit survivre au
   redémarrage, au même titre que `orders` ou `wip`. On recharge donc ici, à la
   fin du module — après la déclaration du miroir et après l'export, pour que le
   rechargement ne puisse pas être écrasé par une réassignation ultérieure. ── */
window._mouvementsManager_charger();
/* Fusion de l'archive froide (F-05) : la tête localStorage se recharge ci-dessus en
   SYNCHRONE ; les blocs archivés se re-fusionnent ensuite en tâche de fond, sans
   bloquer le rendu. La fusion est idempotente et dédoublonne par clé d'idempotence. */
window._mouvementsManager_fusionnerArchive();
