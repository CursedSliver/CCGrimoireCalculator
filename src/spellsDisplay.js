// =============================================================================
// SPELLS SECTION
//
// Owns the grimoire-style display, the wizard-tower config (level, count, SI,
// RB auras), the manainfo banner, the per-spell mana-cost/recharge-time rows,
// and the optimal-magic + sell-strat toggle controls.
//
// All data and behavior specific to this section lives inside this IIFE.
// The section reads the spell catalog (`window.spells`) and keeps its own
// copy of every input/state/helper that is only consumed by this section
// (the maxmana input, the multi input, the GFD-flag checkboxes, the cost /
// regen / averageGFDtime / getMaxMagic helpers, etc.). A small window surface
// (`window.spellsSectionApi`, plus a few `window.*` aliases for the HTML
// inline handlers) is the only thing this section exposes.
//
// The Spells section does not read or write any shared aura, level, or count
// state — its grimoire inputs are the single source of truth for this
// section.
// =============================================================================
(function spellsSection() {
    "use strict";

    // ---- DOM references (scoped to this section) ---------------------------
    const grimoireLevelInput   = document.getElementById("grimoireLevel");
    const grimoireCountInput   = document.getElementById("grimoireCount");
    const grimoireDirectMagicInput = document.getElementById("grimoireDirectMagic");
    const grimoireSIInput      = document.getElementById("grimoireSI");
    const grimoireRBInput      = document.getElementById("grimoireRB");
    const grimoireExpandedCostInput = document.getElementById("grimoireExpandedCost");
    const grimoireBarL         = document.getElementById("grimoireBar");
    const grimoireBarFullL     = document.getElementById("grimoireBarFull");
    const grimoireBarTextL     = document.getElementById("grimoireBarText");
    const grimoireMinMagicL    = document.getElementById("minMagicInfo");
    const spellConfigEl        = document.getElementById("spell-config");
    const spellsAdvancedToggleL= document.getElementById("spells-advanced-toggle");
    const spellsAdvancedSection= document.getElementById("spells-advanced-section");
    // Section-owned inputs that previously lived as app.js globals.
    const maxInput             = document.getElementById("maxmana");
    const multiInput           = document.getElementById("multi");
    const gudRegenInput        = document.getElementById("gudRegen");
    const calcOptimalInput     = document.getElementById("calcOptimal");
    const buffsInput           = document.getElementById("Buffs");
    const seInput              = document.getElementById("SE");
    const gpocInput            = document.getElementById("gpoc");
    const dogfdInput           = document.getElementById("dogfd");

    // ---- Local catalog copy (mirrors `window.spells` from app.js) -----------
    // Each entry has the same shape as the central catalog: { base, percent,
    // gfd, name, icon? }. We hold it as a local copy so this section can
    // iterate in display order without depending on the central object's
    // declaration order.
    const SPELL_CATALOG = [
        { id: 0, name: "Conjure Baked Goods",     base: 2,  percent: 40, gfd: true  },
        { id: 1, name: "Force the Hand of Fate",  base: 10, percent: 60, gfd: true  },
        { id: 2, name: "Stretch Time",            base: 8,  percent: 20, gfd: false },
        { id: 3, name: "Spontaneous Edifice",     base: 20, percent: 75, gfd: false },
        { id: 4, name: "Haggler's Charm",         base: 10, percent: 10, gfd: true  },
        { id: 5, name: "Summon Crafty Pixies",    base: 10, percent: 20, gfd: true  },
        { id: 6, name: "Gambler's Fever Dream",   base: 3,  percent: 5,  gfd: false, customtime: true, isGFD: true },
        { id: 7, name: "Resurrect Abomination",   base: 20, percent: 10, gfd: false },
        { id: 8, name: "Diminish Ineptitude",     base: 5,  percent: 20, gfd: true  }
    ];

    // Local cache for the central "spells" map (keyed by acronym). Populated
    // lazily on first read so that load order with app.js does not matter.
    let cachedCentralSpells = null;
    function getCentralSpells() {
        if (cachedCentralSpells) return cachedCentralSpells;
        cachedCentralSpells = (typeof window !== "undefined" && window.spells) || null;
        return cachedCentralSpells;
    }

    // ---- Local copy of the max-magic formula --------------------------------
    // Reference: minigameGrimoire.js M.computeMagicM
    //   M.magicM = Math.floor(4 + Math.pow(towers, 0.6)
    //                      + Math.log((towers + (lvl-1)*10) / 15 + 1) * 15);
    function getMaxMagic(level, towers) {
        return Math.floor(4 + Math.pow(towers, 0.6)
            + Math.log((towers + (level - 1) * 10) / 15 + 1) * 15);
    }

    // ---- Section-local discount / fasterRegen state ------------------------
    // These were previously module-level let vars in app.js. They are only
    // consulted by this section's helpers (`cost`, `getRegenTime`, ...), so
    // they live here now.
    let discount = 1;
    let fasterRegen = false;

    // ---- Local spell-cost formula -------------------------------------------
    // Reference: M.getSpellCost — cost = floor((costMin + magicM * costPercent) * mult)
    function cost(base, percent, magic) {
        return Math.floor((base + magic * percent) * discount);
    }
    function multiCost(base, percent, magic, castCount, minMagic, str) {
        let manacoststr = "";
        let realmanacost = 0;
        let mana = magic;
        for (let e = castCount; e > 0; e--) {
            const manacost = cost(base, percent, mana);
            mana -= manacost;
            mana = Math.max(mana, minMagic);
            realmanacost += Number(manacost);
            if (str) {
                manacoststr += manacost;
                if (e > 1) manacoststr += " + ";
            }
        }
        return [realmanacost, manacoststr];
    }

    // ---- Local regen-time model --------------------------------------------
    function getRegenTime(start, max) {
        let a = start;
        let b = 0;
        while (a < max) {
            const curMax = fasterRegen ? Math.ceil(a + 1) : max;
            a += Math.max(0.002, Math.pow(a / Math.max(curMax, 100), 0.5)) * 0.002;
            b++;
        }
        return b / 30;
    }

    // ---- Local GFD-average-time model --------------------------------------
    function averageGFDtime(magic, buffs, gpoc, edifice, layers, extra) {
        let a = cost(3, 0.05, magic);
        const curMax = Math.ceil(magic - extra);
        let b = 0;
        let c = 0;
        const spells = getCentralSpells();
        if (spells) {
            for (const spell in spells) {
                const me = spells[spell];
                if (me.gfd) {
                    const price = cost(me.base, me.percent / 100, magic) / 2;
                    if (curMax > a + price) {
                        b += layers > 1
                            ? averageGFDtime(magic, buffs, gpoc, edifice, layers - 1, price + a + extra)
                            : getRegenTime(magic - price - a - extra, magic);
                        c++;
                    }
                }
            }
        }
        // Stretch time
        const stprice = cost(8, 0.2, magic) / 2;
        if (curMax > a + stprice) {
            b += layers > 1
                ? !buffs * averageGFDtime(magic, buffs, gpoc, edifice, layers - 1, stprice + a + extra)
                : !buffs * getRegenTime(magic - stprice - a - extra, magic);
            c++;
        }
        // Spontaneous Edifice
        const seprice = cost(20, 0.75, magic) / 2;
        if (curMax > a + seprice) {
            const sebackfire = edifice ? 0 : 1;
            b += layers > 1
                ? averageGFDtime(magic, buffs, gpoc, edifice, layers - 1, seprice + a + extra) / 2
                : getRegenTime(magic - seprice - a - extra, magic) / 2;
            c++;
            b += layers > 1
                ? averageGFDtime(magic, buffs, gpoc, edifice, layers - 1, extra + (a + seprice) * sebackfire) / 2
                : getRegenTime(magic - ((a + seprice) * sebackfire) - extra, magic) / 2;
            c++;
        }
        // Resurrect Abomination
        const raprice = cost(20, 0.1, magic) / 2;
        if (curMax > a + raprice) {
            b += layers > 1
                ? gpoc * averageGFDtime(magic, buffs, gpoc, edifice, layers - 1, seprice + a + extra)
                : gpoc * getRegenTime(magic - a - raprice - extra, magic);
            c++;
        }
        if (isNaN(b)) return " Unable to cast";
        return c === 0
            ? " Unable to cast"
            : (Number(multiInput && multiInput.value) === layers ? " Average recharge time: " : 0)
                + Math.round(b / c * 1000) / 1000;
    }

    // ---- Tower-count-from-magic helper (used by the maxmana onchange) ------
    function getTowerCountFromMagic(level, magic) {
        let min = 1;
        let max = min;
        for (let i = min; i < 5100; i++) {
            if (getMaxMagic(level, i) === magic && getMaxMagic(level, i - 1) < magic) {
                min = i;
                continue;
            }
            if (getMaxMagic(level, i) > magic) {
                max = i;
                break;
            }
        }
        return [min, max]; // bottom inclusive, top exclusive
    }
    function formatTowerCountFromMagic(arr) {
        const [min, max] = arr;
        return '>=' + min + ', <' + max;
    }

    // ---- Local copy of the grimoire display math ----------------------------
    // Reference: M.getSpellCost — cost = floor((costMin + magicM * costPercent) * mult)
    function getMaxMagicAt(level, towers) {
        return getMaxMagic(level, towers);
    }
    function getGrimoireSpellCost(costMin, costPercent, maxMagic, mult) {
        return Math.floor((costMin + maxMagic * costPercent) * mult);
    }
    function getGrimoireDiscount() {
        return 1 - 0.1 * (grimoireSIInput.checked ? 1 : 0)
            - 0.01 * (grimoireRBInput.checked ? 1 : 0);
    }

    // Lightweight number formatter for grimoire prices.
    function formatGrimoireNumber(n) {
        if (typeof n !== 'number') return n;
        const raw = n.toString();
        if (raw.includes('e')) { return raw; }
        // Insert commas
        return raw.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    // ---- Local state: per-spell display rows --------------------------------
    const spellDisplays = [];
    for (let i = 1; i <= 9; i++) {
        spellDisplays.push(document.getElementById("spell" + i));
    }

    // ---- Render: the static grimoire display --------------------------------
    // When the section-local "Direct magic" input is populated with a positive
    // number, that value directly overrides the grimoire's max-magic display
    // (the bar's width, the "current/max" label, and the per-spell cost
    // labels). When the field is left blank, the max-magic falls back to the
    // usual `getMaxMagicAt(level, towers)` value.
    function updateGrimoireDisplay() {
        if (!grimoireLevelInput || !grimoireCountInput) return;

        const level = Math.max(1, parseInt(grimoireLevelInput.value) || 1);
        const towers = Math.max(1, parseInt(grimoireCountInput.value) || 1);
        const computedMaxMagic = getMaxMagicAt(level, towers);
        const directMagicRaw = grimoireDirectMagicInput && grimoireDirectMagicInput.value;
        const directMagic = directMagicRaw === "" || directMagicRaw == null
            ? NaN
            : parseInt(directMagicRaw);
        const maxMagic = (!isNaN(directMagic) && directMagic > 0)
            ? directMagic
            : computedMaxMagic;
        const minMaxMagic = getMaxMagicAt(level, 1);
        const mult = getGrimoireDiscount();

        // Magic bar.
        if (grimoireBarFullL) grimoireBarFullL.style.width = 100 + "%";
        if (grimoireBarL) grimoireBarL.style.width = (maxMagic * 3 + 50) + "px";
        if (grimoireBarTextL) {
            grimoireBarTextL.textContent = maxMagic + "/" + maxMagic;
        }
        if (grimoireMinMagicL) grimoireMinMagicL.textContent = minMaxMagic;

        // Per-spell cost labels.
        const expanded = !!(grimoireExpandedCostInput && grimoireExpandedCostInput.checked);
        for (const spell of SPELL_CATALOG) {
            const spellCost = getGrimoireSpellCost(spell.base, spell.percent / 100, maxMagic, mult);
            const gfdCost = (!spell.isGFD) ? (spellCost / 2) : null;
            const priceEl = document.getElementById("grimoirePrice" + spell.id);
            if (priceEl) {
                if (expanded) {
                    // Hide the in-box default cost; expanded costs render
                    // below the spell box instead.
                    priceEl.textContent = "";
                    priceEl.style.display = "none";
                } else {
                    priceEl.textContent = formatGrimoireNumber(spellCost);
                    priceEl.style.display = "";
                }
            }

            const spellEl = document.getElementById("grimoireSpell" + spell.id);
            if (spellEl && !spellEl.classList.contains("ready")) {
                spellEl.classList.add("ready");
            }

            // Render the expanded cost lines directly below the spell box.
            if (expanded) {
                // Wrap each spell box in an inline-block container so the
                // cost lines can stack below it without pushing the next
                // spell box onto its own line. All wrappers sit side by
                // side like the original spell boxes did.
                let wrapper = document.getElementById("grimoireSpellWrapper" + spell.id);
                if (!wrapper) {
                    wrapper = document.createElement("div");
                    wrapper.id = "grimoireSpellWrapper" + spell.id;
                    wrapper.className = "grimoireSpellWrapper";
                    spellEl.parentNode.insertBefore(wrapper, spellEl);
                    wrapper.appendChild(spellEl);
                }
                let extraEl = document.getElementById("grimoireSpellExtra" + spell.id);
                if (!extraEl) {
                    extraEl = document.createElement("div");
                    extraEl.id = "grimoireSpellExtra" + spell.id;
                    extraEl.className = "grimoireSpellExtra";
                    wrapper.appendChild(extraEl);
                }
                // GFD cannot cast itself — suppress the GFD cost line for it.
                const isGfdSpell = spell.customtime === true;
                const gfdLine = isGfdSpell
                    ? ""
                    : '<div class="grimoireSpellExtraGfd">GFD '
                        + formatGrimoireNumber(gfdCost) + "</div>";
                extraEl.innerHTML =
                    '<div class="grimoireSpellExtraCost">Cost '
                        + formatGrimoireNumber(spellCost) + "</div>"
                    + gfdLine;
                extraEl.style.display = "block";
            } else {
                const extraEl = document.getElementById("grimoireSpellExtra" + spell.id);
                if (extraEl) extraEl.style.display = "none";
            }
        }
    }

    // ---- Render: per-spell mana cost / recharge time rows -------------------
    // This is the same logic that used to live inline in calculateStuff(), but
    // it now reads its inputs from the section's own state and writes only to
    // the section's display elements. Other sections have their own copies of
    // any "magic counts" they need.
    function updateSpellRows() {
        const central = getCentralSpells();
        if (!central) return; // central catalog not yet loaded

        const lvlEl   = grimoireLevelInput;
        const cntEl   = grimoireCountInput;
        const maxEl   = maxInput    || document.getElementById("maxmana");
        const multiEl = multiInput  || document.getElementById("multi");
        if (!lvlEl || !cntEl || !maxEl || !multiEl) return;

        if (cntEl.value < 1) cntEl.value = 1;
        if (lvlEl.value < 1) lvlEl.value = 1;
        if (parseFloat(maxEl.value) > 10000) maxEl.value = 10000;
        if (parseFloat(maxEl.value) < 1) maxEl.value = 1;
        if (parseFloat(multiEl.value) > 50) multiEl.value = 50;
        if (parseFloat(multiEl.value) < 1) multiEl.value = 1;

        const siEl   = grimoireSIInput;
        const rbEl   = grimoireRBInput;
        const calcEl = calcOptimalInput;
        const seEl   = seInput;
        const buffEl = buffsInput;
        const gpocEl = gpocInput;
        const dogfdEl = dogfdInput;

        discount   = 1 - 0.1 * (siEl && siEl.checked ? 1 : 0) - 0.01 * (rbEl && rbEl.checked ? 1 : 0);
        fasterRegen = !!(gudRegenInput && gudRegenInput.checked);

        const towers   = Number(cntEl.value);
        const level    = Number(lvlEl.value);
        const maximum  = Number(maxEl.value);
        const calcBest = calcEl   ? calcEl.checked   : false;
        const buffs    = buffEl   ? buffEl.checked   : false;
        const edifice  = seEl     ? seEl.checked     : false;
        const gpoc     = gpocEl   ? gpocEl.checked   : false;
        const calcGFD  = dogfdEl  ? dogfdEl.checked  : false;
        const castnum  = Number(multiEl.value);
        const minmana  = getMaxMagic(level, 1);

        let i = 0;
        for (const key in central) {
            const me = central[key];
            if (!spellDisplays[i]) break;
            if (me.customtime) {
                if (calcGFD) {
                    spellDisplays[i].innerHTML = me.name + ":<br>Mana cost: "
                        + cost(me.base, me.percent / 100, maximum) + "<br>"
                        + averageGFDtime(maximum, !buffs, gpoc, edifice, castnum, 0);
                } else {
                    spellDisplays[i].innerHTML = me.name + ":<br>Not calculating this right now<br> (Due to your settings)";
                }
            } else {
                const out = multiCost(me.base, me.percent / 100, maximum, castnum, minmana, true);
                const realmanacost = out[0];
                const manacoststr  = out[1];
                let str = me.name + ":<br>Mana cost: " + manacoststr
                    + " (" + (0.5 * cost(me.base, me.percent / 100, maximum)) + " from GFD)"
                    + "<br>" + (maximum < realmanacost
                        ? "    Unable to cast"
                        : " Recharge time: " + Math.round(getRegenTime(maximum - realmanacost, maximum) * 1000) / 1000 + " seconds");
                let a = 0;
                let bestTime = 0;
                if (calcBest) {
                    for (let m = 5; m < maximum; m++) {
                        const c = (multiCost(me.base, me.percent / 100, m, castnum, minmana, false))[0];
                        if (c > m) continue;
                        const b = getRegenTime(m - c, m);
                        if ((b < bestTime || a === 0) && !isNaN(b)) {
                            a = m;
                            bestTime = b;
                        }
                    }
                }
                spellDisplays[i].innerHTML = str + (calcBest
                    ? "<br>" + bestTime.toFixed(2) + " seconds with a maximum mana of " + a
                    : "");
            }
            i++;
        }
    }

    // Combined update for this section: redraw the grimoire and the spell
    // rows in one go. Other sections can call this when they need to
    // republish magic counts back into the central core.
    function rerender() {
        updateGrimoireDisplay();
        updateSpellRows();
    }

    // ---- Event wiring (scoped to this section) ------------------------------
    if (grimoireLevelInput) grimoireLevelInput.addEventListener("input", rerender);
    if (grimoireCountInput) grimoireCountInput.addEventListener("input", rerender);
    if (grimoireDirectMagicInput) grimoireDirectMagicInput.addEventListener("input", rerender);
    if (grimoireSIInput)    grimoireSIInput.addEventListener("change", rerender);
    if (grimoireRBInput)    grimoireRBInput.addEventListener("change", rerender);
    if (grimoireExpandedCostInput) grimoireExpandedCostInput.addEventListener("change", rerender);

    // ---- Public, explicitly-exposed API for this section --------------------
    // The Spells section exposes only the pieces of state other sections may
    // need to render against (magic counts). Anything else stays private.
    window.spellsSectionApi = {
        getState: function () {
            return {
                level:  grimoireLevelInput ? parseInt(grimoireLevelInput.value) || 1 : 1,
                towers: grimoireCountInput ? parseInt(grimoireCountInput.value) || 1 : 1,
                si:     grimoireSIInput    ? !!grimoireSIInput.checked           : false,
                rb:     grimoireRBInput    ? !!grimoireRBInput.checked           : false,
                maxMagic: grimoireLevelInput && grimoireCountInput
                    ? getMaxMagicAt(parseInt(grimoireLevelInput.value) || 1,
                                    parseInt(grimoireCountInput.value) || 1)
                    : 0
            };
        },
        setState: function (s) {
            if (!s) return;
            if (grimoireLevelInput && s.level  != null) grimoireLevelInput.value = s.level;
            if (grimoireCountInput && s.towers != null) grimoireCountInput.value = s.towers;
            if (grimoireSIInput    && s.si     != null) grimoireSIInput.checked    = !!s.si;
            if (grimoireRBInput    && s.rb     != null) grimoireRBInput.checked    = !!s.rb;
            rerender();
        },
        // Allow other sections to ask the Spells section to refresh the
        // per-spell rows (e.g. after a mana value changes elsewhere).
        refresh: function () { rerender(); },
        // Allow the central glue function to update the section-owned maxmana
        // input from another section.
        setMaxMana: function (v) {
            if (maxInput) maxInput.value = v;
        },
        // Allow the Shift+S / Shift+R keyboard handler (in app.js) to flip
        // this section's own SI / RB aura. Each section keeps its own copy —
        // the keyboard handler routes to every section that exposes this.
        setAuras: function (si, rb) {
            if (grimoireSIInput) grimoireSIInput.checked = !!si;
            if (grimoireRBInput) grimoireRBInput.checked = !!rb;
            rerender();
        }
    };

    function toggleSpellsAdvanced() {
        if (spellsAdvancedSection) spellsAdvancedSection.classList.toggle("hidden");
        if (spellsAdvancedToggleL) spellsAdvancedToggleL.classList.toggle("hidden");
    }

    // Window surface required by HTML inline handlers (e.g. the maxmana
    // onchange calls `formatTowerCountFromMagic`, `getTowerCountFromMagic`,
    // `updateAdv`, etc.). These are thin aliases over the section's local
    // helpers / inputs.
    window.getMaxMagic          = getMaxMagic;
    window.getTowerCountFromMagic = getTowerCountFromMagic;
    window.formatTowerCountFromMagic = formatTowerCountFromMagic;
    window.toggleSpellsAdvanced = toggleSpellsAdvanced;
    window.getRegenTime         = getRegenTime;
    window.averageGFDtime       = averageGFDtime;
    window.cost                 = cost;
    window.multiCost            = multiCost;
    window.max                  = maxInput;
    window.multi                = multiInput;
    window.gudRGN               = gudRegenInput;
    window.calcBestMagic        = calcOptimalInput;
    window.st                   = buffsInput;
    window.se                   = seInput;
    window.ra                   = gpocInput;
    window.dogfd                = dogfdInput;

    // Wrap the central `calculateStuff` so it always refreshes the Spells
    // section's rows after running. The original implementation in app.js
    // just calls into the Spells section's refresh via the API; this wrap
    // is kept for the (currently unused) path where other code might call
    // `window.calculateStuff()` directly.
    if (typeof window.calculateStuff === "function") {
        const original = window.calculateStuff;
        window.calculateStuff = function () {
            const result = original.apply(this, arguments);
            updateSpellRows();
            return result;
        };
    }

    // ---- Initial render ----------------------------------------------------
    rerender();
})();
