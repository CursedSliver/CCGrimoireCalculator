// =============================================================================
// ADVANCED GFD SECTION
//
// Owns: current/max mana inputs, the spell outcome dropdown, the transmute
// and refund attempt controls, the list of possible GFD outcomes, and the
// section-local SI/RB aura checkboxes.
//
// All data and behavior specific to this section lives inside this IIFE. The
// section keeps its own copies of the SI/RB auras and the spell catalog
// (populated lazily from the central app.js core on first read) and
// publishes a small API for other sections to query its state. Nothing is
// read from a shared aura mirror.
// =============================================================================
(function advancedGfdSection() {
    "use strict";

    // ---- DOM references (scoped to this section) ----------------------------
    const spellsDropdown  = document.getElementById("spellsDropdown");
    const minAllowedMana  = document.getElementById("minmanacur");
    const maxAllowedMana  = document.getElementById("maxmanacur");
    const desiredOut      = document.getElementById("desiredOutcomeOutput");
    const gfdOutcomesList = document.getElementById("gfdOutcomesList");
    const GFDMaxForRefund = document.getElementById("GFDMaxForRefund");
    const refundOutput    = document.getElementById("refundOutput");
    const curmanaInput    = document.getElementById("curmana");
    const maxmana2Input   = document.getElementById("maxmana2");
    const gfdRandomInput  = document.getElementById("gfdRandom");
    const gfdSIInput      = document.getElementById("gfdSI");
    const gfdRBInput      = document.getElementById("gfdRB");

    // ---- Local copy of the spell catalog ------------------------------------
    let cachedSpells = null;
    function getSpells() {
        if (cachedSpells) return cachedSpells;
        cachedSpells = (typeof window !== "undefined" && window.spells) || null;
        return cachedSpells;
    }

    // ---- Local state: SI/RB auras and the active discount -------------------
    // The Advanced GFD section keeps its own copies of the auras so that
    // changes here do not silently mutate the rest of the app. The
    // checkboxes (#gfdSI, #gfdRB) are section-owned.
    function localMult() {
        return 1 - 0.1 * (gfdSIInput && gfdSIInput.checked ? 1 : 0)
            - 0.01 * (gfdRBInput && gfdRBInput.checked ? 1 : 0);
    }

    // ---- Populate the spell outcome dropdown once on load -------------------
    function populateSpellsDropdown() {
        const spells = getSpells();
        if (!spellsDropdown || !spells) return;
        spellsDropdown.innerHTML = "";
        for (const key in spells) {
            if (key === "gfd") continue;
            spellsDropdown.innerHTML += '<option value="' + key + '">'
                + spells[key].name + '</option>';
        }
    }
    populateSpellsDropdown();

    // ---- Transmutation / refund logic ---------------------------------------
    const priority = ["se", "st", "ra"];
    const magicMaxForGFDSS = 200;

    function getCost(spell, max, mult) {
        const spells = getSpells();
        if (!spells) return 0;
        return Math.floor((spells[spell].percent * 0.01 * max + spells[spell].base) * mult);
    }

    function compileRanges(arr) {
        let start = 0;
        const compiled = [];
        for (let i = 0; i < arr.length; i++) {
            if (i === 0) { continue; }
            if (arr[i] < arr[i] - 1) {
                compiled.push([arr[start], arr[i]]);
                start = i + 1;
            }
        }
        compiled.push([arr[start], arr[arr.length - 1]]);
        return compiled;
    }

    function getPossibleGFDs(current, max, multNew) {
        const m = multNew ?? localMult();
        const spells = getSpells();
        if (!spells) return [];
        const gfdCost = Math.floor((3 + 0.05 * max) * m);
        const pool = [];
        for (const key in spells) {
            if (key === "gfd") continue;
            if (gfdCost + 0.5 * (Math.floor((spells[key].percent * 0.01 * max
                + spells[key].base) * m)) <= current) {
                pool.push(key);
            }
        }
        return pool;
    }

    function getOutcome(num, cur, max) {
        const GFD = getPossibleGFDs(cur, max);
        if (!GFD.length) return false;
        return GFD[Math.floor(num * GFD.length)];
    }

    function tryTransmuteTo(num, cur, outcome) {
        for (let i = cur; i < magicMaxForGFDSS; i++) {
            const GFDList = getPossibleGFDs(cur, i);
            if (GFDList[Math.floor(num * GFDList.length)] === outcome) {
                return i;
            }
        }
        return false;
    }

    function tryTransmuteToRange(num, min, max, outcome) {
        if (isNaN(num)) return "invalid";
        for (let i = min; i < max; i++) {
            const result = tryTransmuteTo(num, i, outcome);
            if (result !== false) return [i, result];
        }
        return false;
    }

    function setTextFromTransmutatonAttempt(result) {
        if (result === "invalid") {
            if (desiredOut) desiredOut.textContent = "Invalid inputs!";
            return;
        }
        if (!result) {
            if (desiredOut) desiredOut.textContent = "Cannot transmute.";
            return;
        }
        if (desiredOut) {
            desiredOut.textContent = "Cast at " + result[0] + " mana with "
                + result[1] + " max mana.";
        }
    }

    function tryOffsetRefunds(num, cur, maxGFD) {
        maxGFD = maxGFD ?? Infinity;
        if (isNaN(num)) return false;
        const mult = localMult();
        let best = -1;
        let bestCounts = [];
        for (let i = cur; i <= magicMaxForGFDSS; i++) {
            if (getCost("gfd", i, mult) > maxGFD) break;
            const outcome = getOutcome(num, cur, i);
            if (!outcome) continue;
            const p = priority.indexOf(outcome);
            if (p > best) {
                best = p;
                bestCounts = [i];
            } else if (p === best) {
                bestCounts.push(i);
            }
            if (best === -1 && bestCounts.length) {
                const prevMagicCost = 0.5 * getCost(getOutcome(num, cur, bestCounts[0]), bestCounts[0], mult);
                const curMagicCost = 0.5 * getCost(outcome, i, mult);
                if (prevMagicCost < curMagicCost) bestCounts = [i];
                else if (prevMagicCost === curMagicCost) bestCounts.push(i);
            }
        }
        const spells = getSpells();
        return {
            solutions: compileRanges(bestCounts),
            outcome: (best !== -1)
                ? priority[best]
                : (bestCounts.length
                    ? 0.5 * getCost(getOutcome(num, cur, bestCounts[0]), bestCounts[0], mult)
                    : 0)
        };
    }

    function setTextFromRefundCalc(result) {
        if (!result) {
            if (refundOutput) refundOutput.textContent = "Invalid inputs!";
            return;
        }
        const spells = getSpells();
        if (refundOutput) {
            refundOutput.textContent = "Cast from between " + result.solutions[0][0]
                + " max mana to " + result.solutions[0][1] + " max mana, for a "
                + (typeof result.outcome === "string" && spells
                    ? spells[result.outcome].name
                    : ("resolving cost of " + result.outcome + " mana")) + ".";
        }
    }

    // ---- Per-section "update" routine: refresh the GFD outcomes list -------
    function updateAdv() {
        if (!curmanaInput || !maxmana2Input) return;
        const cur = parseFloat(curmanaInput.value);
        const max = parseFloat(maxmana2Input.value);
        const spells = getSpells();
        const gfds = getPossibleGFDs(cur, max);
        const labels = spells ? gfds.map(function (k) { return spells[k].name; }) : [];
        if (gfdOutcomesList) {
            gfdOutcomesList.textContent = "(" + gfds.length + ") "
                + (gfds.length ? labels.join(", ") : "cannot cast");
        }
        if (parseInt(max) < parseInt(cur)) {
            if (window.updateManaWith) window.updateManaWith(cur);
        }
    }

    // ---- Event wiring (scoped to this section) ------------------------------
    if (curmanaInput)   curmanaInput.addEventListener("change",  updateAdv);
    if (maxmana2Input)  maxmana2Input.addEventListener("change", updateAdv);
    if (gfdRandomInput) gfdRandomInput.addEventListener("change", updateAdv);
    if (minAllowedMana) minAllowedMana.addEventListener("change", updateAdv);
    if (maxAllowedMana) maxAllowedMana.addEventListener("change", updateAdv);
    if (gfdSIInput)     gfdSIInput.addEventListener("change",     updateAdv);
    if (gfdRBInput)     gfdRBInput.addEventListener("change",     updateAdv);

    // Re-publish the section's functions on the global namespace so the
    // legacy onclick handlers in index.html (tryTransmuteToRange,
    // setTextFromTransmutatonAttempt, tryOffsetRefunds,
    // setTextFromRefundCalc) keep working without re-declaring the logic
    // elsewhere. `current`, `max2`, and `gfdRandom` are aliases for
    // section-owned inputs that the HTML inline handlers still reference by
    // bare name.
    window.tryTransmuteToRange       = tryTransmuteToRange;
    window.setTextFromTransmutatonAttempt = setTextFromTransmutatonAttempt;
    window.tryOffsetRefunds           = tryOffsetRefunds;
    window.setTextFromRefundCalc      = setTextFromRefundCalc;
    window.getPossibleGFDs           = getPossibleGFDs;
    window.updateAdv                  = updateAdv;
    window.spellsDropdown             = spellsDropdown;
    window.minAllowedMana             = minAllowedMana;
    window.maxAllowedMana             = maxAllowedMana;
    window.GFDMaxForRefund            = GFDMaxForRefund;
    window.desiredOutcomeOutput       = desiredOut;
    window.refundOutput               = refundOutput;
    window.current                    = curmanaInput;
    window.max2                       = maxmana2Input;
    window.gfdRandom                  = gfdRandomInput;

    // ---- Public, explicitly-exposed API for this section --------------------
    window.advancedGfdSectionApi = {
        getState: function () {
            return {
                current:  curmanaInput  ? parseFloat(curmanaInput.value)  : 0,
                maxMana:  maxmana2Input ? parseFloat(maxmana2Input.value) : 0,
                si: !!(gfdSIInput && gfdSIInput.checked),
                rb: !!(gfdRBInput && gfdRBInput.checked)
            };
        },
        setMaxMana: function (v) {
            if (maxmana2Input) maxmana2Input.value = v;
            updateAdv();
        },
        setAuras: function (si, rb) {
            if (gfdSIInput) gfdSIInput.checked = !!si;
            if (gfdRBInput) gfdRBInput.checked = !!rb;
            updateAdv();
        },
        refresh: function () { updateAdv(); }
    };

    // ---- Initial render ----------------------------------------------------
    updateAdv();
})();
