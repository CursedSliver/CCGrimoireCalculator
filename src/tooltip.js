// =============================================================================
// TOOLTIP MODULE
//
// Provides an element-centered tooltip system. Once attached to a DOM element,
// hovering over the element shows a tooltip positioned directly above (or
// below) it. The tooltip's position is computed once on `mouseenter` and
// remains static regardless of mouse movement within the element's boundaries
// (it is only re-anchored on `scroll` / `resize` so it stays attached to the
// element when the viewport changes — not on `mousemove`).
//
// Two visual configurations are supported:
//   - "framed":  mimics the in-game .framed class — uses frameBorder.png for
//                the border (3px border-image, round) and darkNoise.jpg for
//                the background, with the gold/brown border colors and inset
//                shadows from the reference material.
//   - "default": a simple rounded border with a solid black background.
//
// Public API (window.Tooltip):
//   attach(target, text, options)
//     target  — a DOM element or a CSS selector string.
//     text    — the tooltip body. Either a string (rendered as textContent
//               and treated as a static body) OR a function returning a
//               string/HTMLElement (invoked on every `mouseenter` so the
//               tooltip always shows fresh, dynamic content).
//     options — { style: "framed"|"default", position: "top"|"bottom" }.
//               Defaults: style "default", position "top".
//     Attaching to the same element twice is a no-op (idempotent via a
//     WeakSet guard).
//
//   setText(target, text)
//     Updates the body of an already-attached tooltip. The next `mouseenter`
//     will call the original builder with the new text (for function bodies),
//     or simply replace the text (for string bodies). Use this when other
//     code wants to drive a tooltip's content programmatically.
//
//   getAttached(target) → { text, options, update }
//     Returns the attachment record for `target` (or null). The `update`
//     method forces a re-render of the tooltip's content using its builder
//     and the current `text` value (useful while the tooltip is open).
// =============================================================================
(function tooltipModule() {
    "use strict";

    // ---- Style configuration map (style name → CSS modifier class) --------
    const STYLE_CLASSES = {
        framed:  "tooltip--framed",
        default: "tooltip--default"
    };

    // ---- Singleton tooltip element (lazily created and reused) -------------
    let tooltipEl = null;
    let activeTarget = null;
    let activePosition = "top";

    function ensureTooltip() {
        if (tooltipEl) return tooltipEl;
        tooltipEl = document.createElement("div");
        tooltipEl.className = "tooltip";
        tooltipEl.setAttribute("role", "tooltip");
        // The element is hidden via the `.tooltip { display: none }` rule in
        // src/styles/tooltip.css; `showTooltip` flips it to block and sets
        // the position. Appending to <body> keeps it outside the grimoire's
        // stacking context so it paints above everything.
        document.body.appendChild(tooltipEl);
        return tooltipEl;
    }

    // ---- Render the current body of the tooltip into the DOM node ----------
    // The body can be a string (set as innerHTML so line breaks render) or
    // a DOM node (appended directly). Anything falsy clears the tooltip.
    function renderBody(body) {
        if (!tooltipEl) return;
        tooltipEl.innerHTML = "";
        if (body == null || body === "") return;
        if (body instanceof Node) {
            tooltipEl.appendChild(body);
        } else {
            // Use innerHTML for strings so \n / <br> / formatting in the
            // builder output renders. The builder is responsible for any
            // escaping it needs.
            tooltipEl.innerHTML = String(body);
        }
    }

    // ---- Position the singleton tooltip relative to `target` --------------
    // `where` is "top" (directly above the element) or "bottom" (directly
    // below). Horizontal alignment centers the tooltip on the element; the
    // result is clamped to the viewport with a small inset so the tooltip
    // never sits flush against the edge of the screen.
    function positionTooltip(target, where) {
        if (!tooltipEl) return;
        const rect = target.getBoundingClientRect();
        const tipRect = tooltipEl.getBoundingClientRect();
        const gap = 6;
        let top;
        if (where === "bottom") {
            top = rect.bottom + gap;
        } else {
            top = rect.top - tipRect.height - gap;
        }
        // Horizontal: center on target, clamp to viewport.
        let left = rect.left + rect.width / 2 - tipRect.width / 2;
        const pad = 4;
        if (left < pad) left = pad;
        if (left + tipRect.width > window.innerWidth - pad) {
            left = window.innerWidth - tipRect.width - pad;
        }
        // Vertical clamp: keep the tooltip fully within the viewport.
        if (top < pad) top = pad;
        if (top + tipRect.height > window.innerHeight - pad) {
            top = window.innerHeight - tipRect.height - pad;
        }
        tooltipEl.style.left = left + "px";
        tooltipEl.style.top  = top + "px";
    }

    // ---- Resolve the current body for an attachment -----------------------
    // If the attachment's text is a function, call it. Otherwise return the
    // raw value. Returning a fresh value on every show is what makes the
    // tooltip "dynamic" — every `mouseenter` re-runs the builder.
    function resolveBody(text) {
        if (typeof text === "function") {
            try { return text(); }
            catch (e) { return "[tooltip error: " + (e && e.message || e) + "]"; }
        }
        return text;
    }

    // ---- Show / hide the tooltip ------------------------------------------
    function showTooltip(target, attachment) {
        const el = ensureTooltip();
        // textContent (not innerHTML) — placeholder text is plain.
        const body = resolveBody(attachment.text);
        renderBody(body);
        // Reset classes and apply the chosen style modifier.
        el.className = "tooltip";
        const cls = STYLE_CLASSES[attachment.style] || STYLE_CLASSES.default;
        el.classList.add(cls);
        activeTarget   = target;
        activePosition = attachment.position || "top";
        // Make visible so getBoundingClientRect returns real measurements,
        // then compute the position. The tooltip's position is now fixed
        // for the duration of the hover; we do NOT listen to mousemove.
        el.style.display = "block";
        positionTooltip(target, activePosition);
    }

    function hideTooltip() {
        if (!tooltipEl) return;
        tooltipEl.style.display = "none";
        activeTarget = null;
    }

    // ---- Storage: one record per attached target ---------------------------
    // We keep a WeakMap so GC can collect detached elements. The record
    // holds the user-supplied text (string or function), the resolved
    // options, and an `update` method that re-renders the body — useful
    // for refreshing an *open* tooltip without forcing a mouseleave.
    const attachments = new WeakMap();
    const attaching   = new WeakSet();

    function recordUpdate(target, attachment) {
        attachment.update = function () {
            if (!tooltipEl) return;
            if (tooltipEl.style.display === "none") return;
            if (activeTarget !== target) return;
            renderBody(resolveBody(attachment.text));
            positionTooltip(target, attachment.position || "top");
        };
    }

    function attach(target, text, options) {
        options = options || {};
        const el = (typeof target === "string")
            ? document.querySelector(target)
            : target;
        if (!el) return null;
        if (attaching.has(el)) return attachments.get(el) || null;
        attaching.add(el);
        const attachment = {
            text:     text,
            style:    options.style    || "default",
            position: options.position || "top"
        };
        recordUpdate(el, attachment);
        attachments.set(el, attachment);
        el.addEventListener("mouseenter", function () {
            showTooltip(el, attachment);
        });
        el.addEventListener("mouseleave", hideTooltip);
        return attachment;
    }

    function setText(target, text) {
        const el = (typeof target === "string")
            ? document.querySelector(target)
            : target;
        if (!el) return false;
        const attachment = attachments.get(el);
        if (!attachment) return false;
        attachment.text = text;
        // If the tooltip is currently open for this target, refresh it
        // immediately so the new content is visible without a mouseleave.
        if (tooltipEl && tooltipEl.style.display !== "none" && activeTarget === el) {
            attachment.update();
        }
        return true;
    }

    function getAttached(target) {
        const el = (typeof target === "string")
            ? document.querySelector(target)
            : target;
        if (!el) return null;
        return attachments.get(el) || null;
    }

    // ---- Re-anchor on scroll / resize (not on mousemove) -------------------
    // Keeps the tooltip glued to its target when the page scrolls or the
    // viewport is resized. Crucially, there is no `mousemove` listener on
    // the target — the tooltip stays exactly where it was placed on
    // `mouseenter` while the cursor moves within the element.
    function repositionActive() {
        if (!activeTarget || !tooltipEl) return;
        if (tooltipEl.style.display === "none") return;
        const attachment = attachments.get(activeTarget);
        const pos = (attachment && attachment.position) || activePosition;
        positionTooltip(activeTarget, pos);
    }
    window.addEventListener("scroll",  repositionActive, true);
    window.addEventListener("resize",  repositionActive);

    // ---- Expose the API ---------------------------------------------------
    window.Tooltip = {
        attach:    attach,
        setText:   setText,
        getAttached: getAttached
    };

    // =====================================================================
    // Implementation targets
    //
    // The spell tooltips are dynamic: their body is a function that reads
    // the current Spells-section state and recomputes the cost / regen /
    // optimal max-magic on every hover. Everything goes through the
    // helpers published on `window` by src/spellsDisplay.js (getMaxMagic,
    // cost, multiCost, getRegenTime, averageGFDtime) plus the central
    // spell catalog (`window.spells`). The .grimoireSpell DOM nodes are
    // numbered 0..8 in declaration order, and Object.keys(window.spells)
    // yields the catalog in the same order, so we can index by `i`.
    // =====================================================================

    // Map the i-th .grimoireSpell to the central spell acronym. The
    // declaration order in app.js matches the .grimoireSpell indices 0..8.
    function spellKeyAt(i) {
        const s = (typeof window !== "undefined" && window.spells) || null;
        if (!s) return null;
        const keys = Object.keys(s);
        return keys[i] || null;
    }

    // Read the current Spells-section configuration from the DOM. The
    // values mirror the inputs src/spellsDisplay.js uses to render the
    // grimoire, so the tooltip agrees with what the grimoire shows.
    //
    // `maximum` (the max magic the cost / regen calculations are run
    // against) is derived from the *grimoire* configuration — level and
    // tower count — via `getMaxMagic(level, towers)`, not from the free-
    // form `maxmana` input the right-panel per-spell rows use. The
    // grimoire's per-spell cost labels (`grimoirePrice0..8`) are also
    // computed against `getMaxMagic(level, towers)`, so using the same
    // value here keeps the tooltip consistent with the grimoire: if the
    // grimoire can afford a spell, the tooltip will show its recharge
    // time; if not, it shows "Unable to cast" — matching the grimoire's
    // own behavior.
    function readSpellsState() {
        const multiEl = document.getElementById("multi");
        const siEl    = document.getElementById("grimoireSI");
        const rbEl    = document.getElementById("grimoireRB");
        const calcEl  = document.getElementById("calcOptimal");
        const buffsEl = document.getElementById("Buffs");
        const seEl    = document.getElementById("SE");
        const gpocEl  = document.getElementById("gpoc");
        const dogfdEl = document.getElementById("dogfd");
        const lvlEl   = document.getElementById("grimoireLevel");
        const cntEl   = document.getElementById("grimoireCount");
        const directEl = document.getElementById("grimoireDirectMagic");
        const level   = Math.max(1, parseInt(lvlEl && lvlEl.value) || 1);
        const towers  = Math.max(1, parseInt(cntEl && cntEl.value) || 1);
        // Grimoire's effective max magic: same value the grimoire's own
        // `updateGrimoireDisplay` / per-spell cost labels use. When the
        // section-local "Direct magic" input is populated with a positive
        // number, it overrides the level/tower-derived max magic exactly
        // as it does in the grimoire rendering.
        const computedMax = window.getMaxMagic
            ? window.getMaxMagic(level, towers)
            : 5;
        const directRaw = directEl && directEl.value;
        const directVal = (directRaw === "" || directRaw == null)
            ? NaN
            : parseInt(directRaw);
        const grimoireMax = (!isNaN(directVal) && directVal > 0)
            ? directVal
            : computedMax;
        // `minmana` is the lower bound when all but one tower is sold —
        // mirrors what `updateSpellRows` passes to `multiCost`.
        const minmana = window.getMaxMagic
            ? window.getMaxMagic(level, 1)
            : 5;
        return {
            maximum:  grimoireMax,
            castnum:  Math.max(1, parseInt(multiEl && multiEl.value) || 1),
            si:        !!(siEl && siEl.checked),
            rb:        !!(rbEl && rbEl.checked),
            calcBest: !!(calcEl && calcEl.checked),
            buffs:    !!(buffsEl && buffsEl.checked),
            edifice:  !!(seEl   && seEl.checked),
            gpoc:     !!(gpocEl && gpocEl.checked),
            calcGFD:  !!(dogfdEl && dogfdEl.checked),
            minmana:  minmana,
            level:    level,
            towers:   towers
        };
    }

    // Find the optimal max-magic for a non-GFD spell in [5, 300) that
    // minimizes the per-multicast regen time. Mirrors the loop in
    // src/spellsDisplay.js updateSpellRows() but uses an upper bound of
    // 300 instead of `maximum`, as specified.
    function findOptimalMaxRegular(base, percent, st) {
        if (!window.multiCost || !window.getRegenTime) return null;
        let bestMagic = 0;
        let bestTime = Infinity;
        for (let m = 5; m < 300; m++) {
            const out = window.multiCost(base, percent / 100, m, st.castnum, st.minmana, false);
            const c = out[0];
            if (c > m) continue;
            const t = window.getRegenTime(m - c, m);
            if (!isNaN(t) && t < bestTime) {
                bestTime = t;
                bestMagic = m;
            }
        }
        return isFinite(bestTime) ? { magic: bestMagic, time: bestTime } : null;
    }

    // Find the optimal max-magic for GFD in [5, 300) that minimizes the
    // average GFD recharge time. We search by calling averageGFDtime
    // directly with the configured flags; the function returns a number
    // (or a string with "Unable to cast" / " Average recharge time: N"
    // — we extract the trailing number from the latter).
    function findOptimalMaxGFD(st) {
        if (!window.averageGFDtime) return null;
        let bestMagic = 0;
        let bestTime = Infinity;
        for (let m = 5; m < 300; m++) {
            const out = window.averageGFDtime(m, !st.buffs, st.gpoc, st.edifice, st.castnum, 0);
            // averageGFDtime returns either a number (when layers !=
            // castnum), a string beginning with " Unable to cast", or a
            // string of the form " Average recharge time: 12.345". We
            // want the numeric value in the latter case.
            let t;
            if (typeof out === "number") {
                t = out;
            } else if (typeof out === "string") {
                if (out.indexOf("Unable to cast") !== -1) continue;
                // Extract the trailing number.
                const match = out.match(/[-+]?\d*\.?\d+/g);
                if (match && match.length) {
                    t = parseFloat(match[match.length - 1]);
                }
            }
            if (typeof t === "number" && !isNaN(t) && isFinite(t) && t < bestTime) {
                bestTime = t;
                bestMagic = m;
            }
        }
        return isFinite(bestTime) ? { magic: bestMagic, time: bestTime } : null;
    }

    // Build the body for the i-th .grimoireSpell on demand. This is the
    // "dynamic" piece: the body is a function, so every mouseenter
    // re-evaluates against the latest state.
    function buildSpellBody(i) {
        const s = (typeof window !== "undefined" && window.spells) || null;
        const key = spellKeyAt(i);
        if (!s || !key) return "Tooltip (catalog not loaded)";
        const me = s[key];
        if (!me) return "Tooltip (unknown spell)";
        const st = readSpellsState();
        // Per-cast cost: same multiCost invocation spellsDisplay uses.
        const out = (window.multiCost)
            ? window.multiCost(me.base, me.percent / 100, st.maximum, st.castnum, st.minmana, true)
            : [me.base, String(me.base)];
        const realmanacost = out[0];
        const manacoststr  = out[1];

        const lines = [];
        lines.push("<b>" + me.name + "</b>");
        if (me.customtime) {
            // Gambler's Fever Dream.
            lines.push("Cost: " + manacoststr + " magic");
            if (st.calcGFD && window.averageGFDtime) {
                const avg = window.averageGFDtime(
                    st.maximum, !st.buffs, st.gpoc, st.edifice, st.castnum, 0);
                // The function returns either a number or a string of the
                // form " Average recharge time: 12.345" (or " Unable to
                // cast"). Extract the trailing number for the tooltip.
                let num;
                if (typeof avg === "number") {
                    num = avg;
                } else if (typeof avg === "string") {
                    if (avg.indexOf("Unable to cast") !== -1) {
                        lines.push("Average recharge time: Unable to cast");
                    } else {
                        const match = avg.match(/[-+]?\d*\.?\d+/g);
                        if (match && match.length) {
                            num = parseFloat(match[match.length - 1]);
                        }
                    }
                }
                if (typeof num === "number" && !isNaN(num)) {
                    lines.push("Average recharge time: "
                        + Math.round(num * 1000) / 1000 + " seconds");
                }
            } else {
                lines.push("(GFD average disabled in your settings)");
            }
            if (st.calcBest) {
                const opt = findOptimalMaxGFD(st);
                if (opt) {
                    lines.push("Optimal: "
                        + Math.round(opt.time * 1000) / 1000
                        + " seconds at max magic " + opt.magic);
                }
            }
        } else {
            // Non-GFD spells: regen time, plus a GFD-half-cost note that
            // mirrors the inline `0.5 * cost(...)` shown in the spells
            // section. We do not floor the half value — that matches the
            // existing display.
            const halfCost = (window.cost)
                ? 0.5 * window.cost(me.base, me.percent / 100, st.maximum)
                : 0;
            lines.push("Cost: " + manacoststr + " magic");
            if (halfCost) lines.push("(" + halfCost + " from GFD)");
            if (st.maximum < realmanacost) {
                lines.push("Recharge time: Unable to cast");
            } else if (window.getRegenTime) {
                const t = window.getRegenTime(st.maximum - realmanacost, st.maximum);
                lines.push("Recharge time: "
                    + Math.round(t * 1000) / 1000 + " seconds");
            }
            if (st.calcBest) {
                const opt = findOptimalMaxRegular(me.base, me.percent, st);
                if (opt) {
                    lines.push("Optimal: "
                        + Math.round(opt.time * 1000) / 1000
                        + " seconds at max magic " + opt.magic);
                }
            }
        }
        return lines.join("<br>");
    }

    function init() {
        // 1) Every .grimoireSpell in the native grimoire display.
        //    The body is a function so the cost / regen / optimal fields
        //    stay in sync with the multicast count and aura toggles.
        const spellEls = document.querySelectorAll(
            "#native-spell-displays .grimoireSpell"
        );
        spellEls.forEach(function (el, i) {
            attach(el, function () { return buildSpellBody(i); }, {
                style: "framed",
                position: "top"
            });
        });

        // 2) The magic bar (#grimoireBar).
        const barEl = document.getElementById("grimoireBar");
        if (barEl) {
            attach(barEl,
                "This bar is determined by your tower count and tower level.",
                {
                    style: "framed",
                    position: "top"
                });
        }

        // 3) The (?) help marker next to "Multicast count".
        const helpEl = document.getElementById("multiHelp");
        if (helpEl) {
            attach(helpEl,
                "Updates tooltips to show cumulative magic cost when casting multiple of each spell with towers optimally sold in between each cast.",
                {
                    style: "default",
                    position: "top"
                });
        }

        // 4) The (?) help marker next to "Direct magic".
        const otherHelpEl = document.getElementById("grimoireDirectMagicHelp");
        if (otherHelpEl) {
            attach(otherHelpEl,
                "Input to override max magic directly. Leave blank to let the tower count and tower level determine the max magic.",
                {
                    style: "default",
                    position: "top"
                });
        }
    }

    // The script tag is placed at the end of <body>, so the DOM is already
    // parsed by the time this IIFE runs. The readyState check is a small
    // safety net in case the script is ever moved into <head>.
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
