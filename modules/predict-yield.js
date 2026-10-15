/**
 * Module : predict-yield.js
 * Objectif : Calcul du rendement volumétrique basé strictement sur les profils officiels (sciage-logic.js).
 */

(function(global) {
    function predictLogYield(essence, diameterCm, lengthM) {
        if (!global.window || !global.window.sciageLogic) {
            throw new Error("Le moteur sciageLogic n'est pas chargé dans la sandbox.");
        }

        const sl = global.window.sciageLogic;
        
        // 1. Volume brut via la fonction canonique du moteur
        const grossVolume = sl.calcVolumeGrume(diameterCm, lengthM);

        // 2. Profil d'essence officiel (Source de vérité unique Plan S2)
        const profile = sl.essenceProfile ? sl.essenceProfile(essence) : { key: essence, coefSciage: 0.55, famille: 'standard', retraitPct: 0 };
        
        const rate = profile.coefSciage;
        const estimatedUsefulVolume = Number((grossVolume * rate).toFixed(4));
        const estimatedWaste = Number((grossVolume - estimatedUsefulVolume).toFixed(4));

        return {
            essenceKey: profile.key || essence,
            famille: profile.famille || 'standard',
            retraitPct: profile.retraitPct || 0,
            dimensions: { diameterCm, lengthM },
            grossVolume: Number(grossVolume.toFixed(4)),
            estimatedYieldRate: `${(rate * 100).toFixed(1)}%`,
            estimatedUsefulVolume,
            estimatedWaste,
            timestamp: new Date().toISOString()
        };
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { predictLogYield };
    }
    
    global.predictYieldModule = { predictLogYield };
})(typeof window !== 'undefined' ? window : globalThis);
