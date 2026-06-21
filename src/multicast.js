// =============================================================================
// ARBITRARY MULTICAST SECTION
//
// Owns its own tower level, tower count, SI/RB auras, the free-form
// multicast input, the magic-left input, the calculate button, and the
// per-cast tower-count output. All data and behavior specific to this section
// lives inside this IIFE — the section no longer reads from any central
// level/SI/RB mirror. The spell catalog is sourced from `window.spells` and
// cached locally on first read.
//
// UI: the section exposes its own level/count/SI/RB inputs in
// `#arbitrary-multicast-config`. Users can set them directly without
// touching any other section.
// =============================================================================
(function arbitraryMulticastSection() {
    "use strict";

    // ---- DOM references (scoped to this section) ----------------------------
    const arbitraryInput    = document.getElementById("arbitraryCast");
    const magicLeftInput    = document.getElementById("ACmagicLeft");
    const calcButton        = document.getElementById("arbitraryCalcButton");
    const outputEl          = document.getElementById("arbitraryCastOutput");
    const levelInput        = document.getElementById("ACLevel");
    const countInput        = document.getElementById("ACCount");
    const siInput           = document.getElementById("ACSI");
    const rbInput           = document.getElementById("ACRB");
    const maxManaDisplay    = document.getElementById("ACMaxManaDisplay");

    // ---- Local copy of the spell catalog (keyed by acronym) -----------------
    // Populated lazily on first read so load order with app.js does not
    // matter. Used to look up `base` and `percent` for each acronym.
    let cachedSpells = null;
    function getSpells() {
        if (cachedSpells) return cachedSpells;
        cachedSpells = (typeof window !== "undefined" && window.spells) || null;
        return cachedSpells;
    }

    // ---- Local copy of the max-magic formula --------------------------------
    // Reference: minigameGrimoire.js M.computeMagicM
    //   M.magicM = Math.floor(4 + Math.pow(towers, 0.6)
    //                      + Math.log((towers + (lvl-1)*10) / 15 + 1) * 15);
    function getMaxMagic(level, towers) {
        return Math.floor(4 + Math.pow(towers, 0.6)
            + Math.log((towers + (level - 1) * 10) / 15 + 1) * 15);
    }

    // ---- Local spell-cost formula -------------------------------------------
    // Reference: M.getSpellCost — cost = floor((costMin + magicM * costPercent) * mult)
    function getCost(base, percent, magic) {
        const m = localDiscount();
        return Math.floor((base + magic * percent) * m);
    }

    // ---- Local discount (derived from the section's own SI/RB auras) --------
    function localDiscount() {
        return 1 - 0.1 * (siInput && siInput.checked ? 1 : 0)
            - 0.01 * (rbInput && rbInput.checked ? 1 : 0);
    }

    // ---- Section-local error helper -----------------------------------------
    function showError(message) {
        if (typeof window.alert === "function") window.alert(message);
        if (outputEl) { 
            outputEl.style.display = '';
            outputEl.textContent = "you idiot, you fool, you absolute buffoon"; 
        }
    }

    // ---- Calculation --------------------------------------------------------
    function calculate() {
        const spells = getSpells();
        if (!spells) {
            showError("Spells catalog not loaded");
            return;
        }
        if (calcButton) calcButton.style.backgroundColor = '';
        if (!levelInput || !countInput) {
            showError("Section-local level/count inputs not ready");
            return;
        }

        const level = Math.max(1, parseInt(levelInput.value) || 1);
        const minMagic = getMaxMagic(level, 1);
        const magicleft = Number(magicLeftInput.value) || 0;
        const discount = localDiscount();

        const castSet = arbitraryInput.value;
        const casts = castSet.split(" ");
        const out = [];

        for (const e of [100, 10, 1]) {
            let totcost = 0;
            const towCounts = [];

            for (let i = casts.length - 1; i > -1; i--) {
                const curCast = casts[i];
                const curCasts = curCast.split("-");
                const per = new Array(curCasts.length);
                const base = new Array(curCasts.length);
                const gfd = new Array(curCasts.length).fill(false);

                for (let j = 0; j < curCasts.length; j++) {
                    let token = curCasts[j];
                    if (token.startsWith("g!")) {
                        token = token.slice(2);
                        gfd[j] = true;
                    }
                    if (spells[token]) {
                        const spell = spells[token];
                        per[j] = spell.percent;
                        base[j] = spell.base;
                    } else if (token.split("%+").length === 2) {
                        const parts = token.split("%+");
                        per[j]  = Number(parts[0]);
                        base[j] = parts[1];
                        if (isNaN(per[j]) || isNaN(base[j])) {
                            showError("Couldn't parse numbers in: " + token);
                            return;
                        }
                    } else {
                        showError("Couldn't parse cast: " + token);
                        return;
                    }
                }

                const persum = per.reduce((sum, val, idx) => {
                    return sum + (gfd[idx] ? (0.5 * val + spells.gfd.percent) : val);
                }, 0);
                const basesum = base.reduce((sum, val, idx) => {
                    return sum + (gfd[idx] ? (0.5 * val + spells.gfd.base) : val);
                }, 0);
                if ((persum * discount === 100 && basesum > 0) || persum * discount > 100) {
                    showError("Go get a better discount for cast set: " + curCast
                        + "(or blame nyan cat if you could actually cast this)");
                    return;
                }

                // Find minimum magic to afford this cast set.
                let b = 0;
                for (b = minMagic; true; b++) {
                    let thiscost = 0;
                    for (let j = 0; j < curCasts.length; j++) {
                        if (gfd[j]) {
                            thiscost += getCost(base[j], per[j] / 100, b) / 2
                                + getCost(spells.gfd.base, spells.gfd.percent / 100, b);
                        } else {
                            thiscost += getCost(base[j], per[j] / 100, b);
                        }
                    }
                    if (magicleft + totcost + thiscost <= b) break;
                }

                // Find the minimum tower count that yields max magic = b.
                let towers = 1;
                let low = 1;
                let high = Infinity;
                while (true) {
                    if (getMaxMagic(level, towers) < b) {
                        low = towers;
                        if (high === Infinity) towers = low * 2;
                        else towers = Math.floor((high + low) / 2);
                        continue;
                    }
                    if (getMaxMagic(level, towers) >= b && getMaxMagic(level, towers - 1) >= b) {
                        high = towers;
                        towers = Math.floor((high + low) / 2);
                        continue;
                    }
                    break;
                }
                if (totcost > 0) {
                    towers = towCounts[0] + e * Math.ceil((towers - towCounts[0]) / e);
                }
                const max = getMaxMagic(level, towers);

                for (let j = 0; j < curCasts.length; j++) {
                    if (gfd[j]) {
                        totcost += getCost(base[j], per[j] / 100, max) / 2
                            + getCost(spells.gfd.base, spells.gfd.percent / 100, max);
                    } else {
                        totcost += getCost(base[j], per[j] / 100, max);
                    }
                }
                towCounts.push(towers);
            }
            out.push("Selling by " + e + "&nbsp".repeat(3 - String(e).length)
                + ": " + towCounts.join(", ") + " For total of " + totcost + " magic");
        }
        if (outputEl) { 
            outputEl.style.display = '';
            outputEl.innerHTML = out.join("<br>"); 
        }
    }

    // ---- Per-section parameter preview (local max-magic display) ------------
    function refreshMaxManaDisplay() {
        if (!maxManaDisplay || !levelInput || !countInput) return;
        const level = Math.max(1, parseInt(levelInput.value) || 1);
        const towers = Math.max(1, parseInt(countInput.value) || 1);
        maxManaDisplay.textContent = String(getMaxMagic(level, towers));
    }
    function highlightCalculationButton() {
        if (!calcButton) return;
        calcButton.style.backgroundColor = "yellow";
    }

    // ---- Event wiring (scoped to this section) ------------------------------
    if (calcButton) calcButton.addEventListener("click", calculate);

    if (magicLeftInput) magicLeftInput.addEventListener("change", highlightCalculationButton);
    if (arbitraryInput) arbitraryInput.addEventListener("change", highlightCalculationButton);
    if (levelInput)     levelInput.addEventListener("input", function () {
        refreshMaxManaDisplay();
        highlightCalculationButton();
    });
    if (countInput)     countInput.addEventListener("input", function () {
        refreshMaxManaDisplay();
        highlightCalculationButton();
    });
    if (siInput)        siInput.addEventListener("change", highlightCalculationButton);
    if (rbInput)        rbInput.addEventListener("change", highlightCalculationButton);

    // ---- Public, explicitly-exposed API for this section --------------------
    // The Arbitrary multicast section exposes only the pieces of state other
    // sections may want to inspect (its local level/SI/RB). Anything else
    // stays private.
    window.arbitraryMulticastApi = {
        getState: function () {
            return {
                level: levelInput ? Math.max(1, parseInt(levelInput.value) || 1) : 1,
                towers: countInput ? Math.max(1, parseInt(countInput.value) || 1) : 1,
                si: siInput ? !!siInput.checked : false,
                rb: rbInput ? !!rbInput.checked : false
            };
        },
        setState: function (s) {
            if (!s) return;
            if (levelInput && s.level  != null) levelInput.value = s.level;
            if (countInput && s.towers != null) countInput.value = s.towers;
            if (siInput    && s.si     != null) siInput.checked  = !!s.si;
            if (rbInput    && s.rb     != null) rbInput.checked  = !!s.rb;
            refreshMaxManaDisplay();
            calculate();
        },
        // Allow the Shift+S / Shift+R keyboard handler (in app.js) to flip
        // this section's own SI / RB aura. Each section keeps its own copy.
        setAuras: function (si, rb) {
            if (siInput) siInput.checked = !!si;
            if (rbInput) rbInput.checked = !!rb;
        }
    };

    // Keep `window.arbitraryCalc` as an alias for backwards-compat with the
    // original onclick handler reference (the inline onclick was already
    // removed from index.html in favor of a scoped event listener, but the
    // global is harmless to keep and matches the original public surface).
    window.arbitraryCalc = calculate;

    // ---- Initial render ----------------------------------------------------
    refreshMaxManaDisplay();
})();
