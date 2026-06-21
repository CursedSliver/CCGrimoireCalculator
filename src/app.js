// =============================================================================
// app.js — central core
//
// Each of the four sections (Spells, Arbitrary multicast, Advanced GFD,
// Transmutation graph) is fully self-contained: it owns its own DOM inputs,
// its own aura state, and its own state-helpers. Nothing in this file
// publishes any aura, level, or count value as shared state.
//
// What still lives here is the genuinely cross-cutting surface:
//
// - The `spells` catalog (`window.spells`) — the one piece of data every
//   section depends on. Sections read it lazily on first access so the
//   load order with this script is forgiving.
// - The `updateManaWith` glue shim — used by inline `onchange` handlers
//   that need to fan a mana value out to both the Spells section and the
//   Advanced GFD section. Each section owns its own `maxmana` / `maxmana2`
//   input; the shim delegates to the sections' APIs.
// - The `calculateStuff` glue shim — used by inline `onchange` handlers
//   to ask the Spells section to republish. It is wrapped by the Spells
//   section's IIFE so the per-spell rows always refresh.
// - `initSectionToggles` — wires the per-section collapse buttons in
//   `index.html` (`aria-controls="…-body"` → matching `.section-body`).
//   Individual section scripts don't need to know about this.
// - The Shift+S / Shift+R keyboard handler — toggles each section's own
//   SI/RB aura (it calls `setAuras` on every section that exposes one),
//   then asks each section to redraw. Auras are not shared: each section
//   keeps its own copy of the toggle state.
// =============================================================================

// ---- Shared catalog (the only piece of data genuinely shared by every
//      section). Defined here so the four section scripts can read it
//      through `window.spells` once they load. Explicitly assigned to
//      `window` because `const` declarations at the top level of a script
//      do not become properties of `window` on their own.
const spells = {
    cbg:{
        base:2,
        percent:40,
        gfd:true,
        name:"Conjure Baked Goods",
        icon:[21, 11]
    },
    fthof:{
        base:10,
        percent:60,
        gfd:true,
        name:"Force the Hand of Fate",
        icon:[22, 11]
    },
    st:{
        base:8,
        percent:20,
        gfd:false,
        name:"Stretch Time",
        icon:[23, 11]
    },
    se:{
        base:20,
        percent:75,
        gfd:false,
        name:"Spontaneous Edifice",
        icon:[24, 11]
    },
    hc:{
        base:10,
        percent:10,
        gfd:true,
        name:"Haggler's charm",
        icon:[25, 11]
    },
    scp:{
        base:10,
        percent:20,
        gfd:true,
        name:"Summon Crafty Pixies",
        icon:[26, 11]
    },
    gfd:{
        base:3,
        percent:5,
        gfd:false,
        customtime:true,
        name:"Gambler's fever dream",
        icon:[27, 11]
    },
    ra:{
        base:20,
        percent:10,
        gfd:false,
        name:"Resurrect Abomination",
        icon:[28, 11]
    },
    di:{
        base:5,
        percent:20,
        gfd:true,
        name:"Diminish Ineptitude",
        icon:[29, 11]
    }
}
window.spells = spells;

// ---- Glue functions (kept thin: they delegate to the owning sections) -----

// updateManaWith: keep the Spells section's maxmana and the Advanced GFD
// section's maxmana2 in sync. The sections own their own inputs; this
// shim fans the value out to whichever sections have registered an API.
function updateManaWith(value) {
    if (window.spellsSectionApi    && typeof window.spellsSectionApi.setMaxMana    === "function") {
        window.spellsSectionApi.setMaxMana(value);
    }
    if (window.advancedGfdSectionApi && typeof window.advancedGfdSectionApi.setMaxMana === "function") {
        window.advancedGfdSectionApi.setMaxMana(value);
    }
}

// calculateStuff: the central "recalculate" entry point referenced by HTML
// inline handlers. The per-spell rendering and the value-capping all live
// inside the Spells section now; this shim simply delegates.
function calculateStuff() {
    if (window.spellsSectionApi && typeof window.spellsSectionApi.refresh === "function") {
        window.spellsSectionApi.refresh();
    }
}

// ---- Section hide/show buttons: every section header has a button (added
//      directly in index.html next to the <h3>) that toggles the visibility
//      of the section's body. This walks the DOM once at startup and wires
//      each button by matching its `aria-controls` to the corresponding
//      `.section-body` element, so individual section scripts don't have
//      to know about the toggle behavior.
//
//      The open/closed state of each section is persisted in localStorage
//      under the key STORAGE_KEY, so the user's choice survives page
//      reloads. We read the saved state on startup (after wiring the
//      listeners) and reflect it on the DOM, and we write the new state
//      on every toggle. Any button that has no recorded entry is treated
//      as open (the default) and its entry is written on first toggle.
const STORAGE_KEY = "grimoireCalculator.sectionToggles";
function readSavedToggleStates() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === "object") ? parsed : {};
    } catch (e) {
        return {};
    }
}
function writeSavedToggleStates(states) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
    } catch (e) {
        // localStorage may be unavailable (e.g. private mode); fail silently.
    }
}
function initSectionToggles() {
    const toggles = document.querySelectorAll('.section-toggle');
    const saved = readSavedToggleStates();
    const newStates = {};
    toggles.forEach(function(btn) {
        const targetId = btn.getAttribute('aria-controls');
        if (!targetId) return;
        const body = document.getElementById(targetId);
        if (!body) return;
        // Reflect any persisted state. Anything without a recorded entry
        // is treated as open (the default) and gets stored as such on
        // first toggle.
        const wasSaved = Object.prototype.hasOwnProperty.call(saved, targetId);
        const shouldBeOpen = wasSaved ? !!saved[targetId] : true;
        if (shouldBeOpen) {
            body.style.display = '';
            btn.textContent = 'Hide';
            btn.setAttribute('aria-expanded', 'true');
        } else {
            body.style.display = 'none';
            btn.textContent = 'Show';
            btn.setAttribute('aria-expanded', 'false');
        }
        newStates[targetId] = shouldBeOpen;
        btn.addEventListener('click', function() {
            const isHidden = body.style.display === 'none';
            if (isHidden) {
                body.style.display = '';
                btn.textContent = 'Hide';
                btn.setAttribute('aria-expanded', 'true');
            } else {
                body.style.display = 'none';
                btn.textContent = 'Show';
                btn.setAttribute('aria-expanded', 'false');
            }
            // After the toggle above, `body.style.display === 'none'` is the
            // new state of the section. We persist that.
            newStates[targetId] = body.style.display !== 'none';
            writeSavedToggleStates(newStates);
        });
    });
    // Persist the initial snapshot so any section that didn't have a
    // recorded entry gets one (defaulting to open).
    writeSavedToggleStates(newStates);
}
initSectionToggles();

// ---- Keyboard handler: Shift+S / Shift+R toggle each section's own SI /
//      RB aura, then ask the section to redraw. Auras are NOT shared —
//      every section that uses them keeps its own copy and is toggled
//      independently here.
function toggleAuraOnAllSections(which) {
    // `which` is "si" or "rb". For each section API that exposes a
    // `setAuras` method, we ask the section to flip its own copy of that
    // aura (preserving the other aura's current value) and re-render.
    const apis = [
        window.spellsSectionApi,
        window.arbitraryMulticastApi,
        window.advancedGfdSectionApi,
        window.transmutationGraphApi
    ];
    for (let i = 0; i < apis.length; i++) {
        const api = apis[i];
        if (!api || typeof api.getState !== "function" || typeof api.setAuras !== "function") continue;
        const st = api.getState();
        const cur = {
            si: !!(st && st.si),
            rb: !!(st && st.rb)
        };
        cur[which] = !cur[which];
        api.setAuras(cur.si, cur.rb);
    }
}

document.addEventListener('keydown', function(e) {
    if (e.shiftKey) {
        if (e.key.toLowerCase() == 's') {
            toggleAuraOnAllSections("si");
        } else if (e.key.toLowerCase() == 'r') {
            toggleAuraOnAllSections("rb");
        } else {
            return;
        }
        calculateStuff();
        if (typeof updateAdv === 'function') updateAdv();
        if (window.dataPoints && window.dataPoints.length && typeof redrawAll === 'function') {
            redrawAll();
        }
    }
})

// ---- Initial run: ask the Spells section to render its DOM. The section
//      scripts load after this one, so the first invocation here is a no-op;
//      each section's own IIFE will call into its refresh / render entry
//      point when it loads. By the time the user interacts, every section is
//      fully wired.
calculateStuff();

// The four section scripts (spellsDisplay.js, multicast.js, gfdss.js,
// offsetGraph.js) are loaded directly in index.html after this file, so
// this core script can rely on them being available by the time the page
// finishes loading. We intentionally do not call registerScript() here to
// avoid double-loading the section scripts.
