/**
 * Module : production-stats.js
 * Objectif : Extraction et analyse des statistiques de production à partir des mouvements réels.
 *
 * Source de vérité : le schéma du registre append-only (modules/mouvements-manager.js) :
 *   - nature  : 'GRUME_ENTREE' (brut) | 'SEMI_FINI' | 'DOSSE' (utile) | 'CHUTE' (perte)
 *   - volume  : m³ (seul champ de volume réel)
 *   - grumeEss: essence de la grume d'origine (label libre, ex. 'spruce', 'Pin')
 * Aucun champ fictif (volumeGrume / volumeSciage / volumeChutes / essence) n'est lu.
 */

(function(global) {
    const NATURE_CHUTE = 'CHUTE';
    const NATURES_UTILES = { SEMI_FINI: true, DOSSE: true };

    function toVol(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    function queryProductionStats(mouvements = []) {
        if (!Array.isArray(mouvements)) {
            throw new Error("Les mouvements doivent être fournis sous forme de tableau.");
        }

        let totalGrossVolume = 0;
        let totalUsefulVolume = 0;
        let totalWasteVolume = 0;
        const byEssence = {};

        mouvements.forEach(mvt => {
            if (!mvt || typeof mvt !== 'object') return;

            const nature = String(mvt.nature || '').trim().toUpperCase();
            const volume = toVol(mvt.volume);
            const essence = String(mvt.grumeEss || mvt.essence || '').trim().toUpperCase() || 'INCONNUE';

            let part = 'gross';
            if (nature === NATURE_CHUTE) part = 'waste';
            else if (NATURES_UTILES[nature]) part = 'useful';

            if (!byEssence[essence]) {
                byEssence[essence] = { gross: 0, useful: 0, waste: 0, count: 0 };
            }
            byEssence[essence][part] += volume;
            byEssence[essence].count += 1;

            if (part === 'gross') totalGrossVolume += volume;
            else if (part === 'useful') totalUsefulVolume += volume;
            else totalWasteVolume += volume;
        });

        const overallYieldRate = totalGrossVolume > 0
            ? `${((totalUsefulVolume / totalGrossVolume) * 100).toFixed(1)}%`
            : "0.0%";

        const overallWasteRate = totalGrossVolume > 0
            ? `${((totalWasteVolume / totalGrossVolume) * 100).toFixed(1)}%`
            : "0.0%";

        return {
            totalMouvements: mouvements.length,
            totalGrossVolume: Number(totalGrossVolume.toFixed(4)),
            totalUsefulVolume: Number(totalUsefulVolume.toFixed(4)),
            totalWasteVolume: Number(totalWasteVolume.toFixed(4)),
            overallYieldRate,
            overallWasteRate,
            byEssence,
            timestamp: new Date().toISOString()
        };
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { queryProductionStats };
    }

    global.productionStatsModule = { queryProductionStats };
})(typeof window !== 'undefined' ? window : globalThis);
