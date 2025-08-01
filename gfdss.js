
const spellsDropdown = document.getElementById('spellsDropdown');
for (let i in spells) {
    if (i == 'gfd') { continue; }
    spellsDropdown.innerHTML += '<option value="' + i + '">' + spells[i].name + '</option>';
}
const minAllowedMana = document.getElementById('minmanacur');
const maxAllowedMana = document.getElementById('maxmanacur');
const manaLimitsConfig = document.getElementById('manaLimitsConfig');
const desiredOutcomeOutput = document.getElementById('desiredOutcomeOutput');
const gfdOutcomesList = document.getElementById('gfdOutcomesList');
const GFDMaxForRefund = document.getElementById('GFDMaxForRefund');
const refundOutput = document.getElementById('refundOutput');

function updateAdv() {
    let gfds = getPossibleGFDs(parseFloat(current.value), parseFloat(max.value));
    for (let i in gfds) {
        gfds[i] = spells[gfds[i]].name;
    }
    gfdOutcomesList.innerHTML = '(' + gfds.length + ') ' + (gfds.length?gfds.join(', '):'cannot cast');
    if (parseInt(max.value) < parseInt(current.value)) { updateManaWith(current.value); }
}

function recalcMult() {
    window.mult = 1 - (si.checked ? 0.1 : 0) - (rb.checked ? 0.01 : 0);
    return window.mult;
}

let priority = ['se', 'st', 'ra'];

function compileRanges(arr) {
    let start = 0;
    let compiled = [];
    for (let i = 0; i < arr.length; i++) {
        if (i == 0) { continue; }
        if (arr[i] < arr[i] - 1) {
            compiled.push([arr[start], arr[i]]);
            start = i + 1;
        }
    }
    compiled.push([arr[start], arr[arr.length - 1]]);
    return compiled;
}

function getCost(spell, max, mult) {
    return Math.floor((spells[spell].percent * 0.01 * max + spells[spell].base) * mult);
}

const magicMaxForGFDSS = 200;

function getPossibleGFDs(current, max, multNew) {
    recalcMult();
    const m = multNew ?? mult;
    const gfdCost = Math.floor((3 + 0.05 * max) * m);
    let pool = [];
    for (let i in spells) {
        if (i == 'gfd') { continue; }
        if (gfdCost + 0.5 * (Math.floor((spells[i].percent * 0.01 * max + spells[i].base) * m)) <= current) {
            pool.push(i);
        }
    }
    return pool;
}

function getOutcome(num, cur, max) {
    //GFD outcome with those configurations
    const GFD = getPossibleGFDs(cur, max);
    if (!GFD.length) { return false; }
    return GFD[Math.floor(num * GFD.length)];
}
function tryTransmuteTo(num, cur, outcome) {
    for (let i = cur; i < magicMaxForGFDSS; i++) {
        const GFDList = getPossibleGFDs(cur, i);
        if (GFDList[Math.floor(num * GFDList.length)] == outcome) {
            return i;
        }
    }
    return false;
}
function tryTransmuteToRange(num, min, max, outcome) {
    if (isNaN(num)) { return 'invalid'; }
    for (let i = min; i < max; i++) {
        const result = tryTransmuteTo(num, i, outcome);
        if (result !== false) { return [i, result]; }
    }
    return false;
}
function setTextFromTransmutatonAttempt(result) {
    if (result == 'invalid') { 
        desiredOutcomeOutput.innerHTML = 'Invalid inputs!';
        return;
    }
    if (!result) {
        desiredOutcomeOutput.innerHTML = 'Cannot transmute.';
        return;
    }
    desiredOutcomeOutput.innerHTML = 'Cast at ' + result[0] + ' mana with ' + result[1] + ' max mana.';
}
function tryOffsetRefund(num, cur, maxGFD) {
    //given a magic amount "cur" and random number "num", find optimal solution to yield refunds
    maxGFD = maxGFD ?? Infinity;
    let best = -1;
    let bestCount = cur;
    for (let i = cur; i <= magicMaxForGFDSS; i++) {
        if (getCost('gfd', i, mult) > maxGFD) { break; }
        const outcome = getOutcome(num, cur, i);
        if (!outcome) { continue; }
        if (priority.indexOf(outcome) > best) {
            best = priority.indexOf(outcome);
            bestCount = i;
        }
        if (best == -1) {
            const prevMagicCost = 0.5 * getCost(getOutcome(num, cur, bestCount), bestCount, mult);
            const curMagicCost = 0.5 * getCost(outcome, i, mult);
            if (prevMagicCost < curMagicCost) {
                bestCount = i;
            }
        }
    }
    return bestCount;
}
function tryOffsetRefunds(num, cur, maxGFD) {
    //given a magic amount "cur" and random number "num", find optimal solutions to yield refunds
    maxGFD = maxGFD ?? Infinity;
    if (isNaN(num)) { return false; }
    let best = -1;
    let bestCounts = [];
    for (let i = cur; i <= magicMaxForGFDSS; i++) {
        if (getCost('gfd', i, mult) > maxGFD) { break; }
        const outcome = getOutcome(num, cur, i);
        if (!outcome) { continue; }
        if (priority.indexOf(outcome) > best) {
            best = priority.indexOf(outcome);
            bestCounts = [i];
        } else if (priority.indexOf(outcome) == best) {
            bestCounts.push(i);
        }
        if (best == -1) {
            const prevMagicCost = 0.5 * getCost(getOutcome(num, cur, bestCounts[0]), bestCounts[0], mult);
            const curMagicCost = 0.5 * getCost(outcome, i, mult);
            if (prevMagicCost < curMagicCost) {
                bestCounts = [i];
            } else if (prevMagicCost == curMagicCost) {
                bestCounts.push(i);
            }
        }
    }
    return { solutions: compileRanges(bestCounts), outcome: (best != -1)?priority[best]:(0.5 * getCost(getOutcome(num, cur, bestCounts[0]), bestCounts[0], mult)) };
}
function setTextFromRefundCalc(result) {
    if (!result) { 
        refundOutput.innerHTML = 'Invalid inputs!';
        return;
    }
    refundOutput.innerHTML = 'Cast from between ' + result.solutions[0][0] + ' max mana to ' + result.solutions[0][1] + ' max mana, for a ' + (typeof result.outcome == 'string'?spells[result.outcome].name:('resolving cost of ' + result.outcome + ' mana')) + '.';
}
function tryOffsetRefundRange(num, range, maxGFD) {
    //given a range [min, max] representing current magic amounts, find the optimal solution(s) to yield refunds
    let bestCounts = [];
    let bestResult = 0; //number or string, if number represents cost that it is trying to maximize
    for (let i = range[0]; i <= range[1]; i++) {
        const optimalMax = tryOffsetRefund(num, i, maxGFD);
        const outcome = getOutcome(num, i, optimalMax);
        const priorityMark = priority.indexOf(outcome);
        if (priorityMark > -1 || priority.includes(bestResult)) {
            const index = priority.indexOf(bestResult);
            if (priorityMark > index) {
                bestCounts = [i];
                bestResult = outcome;
            } else if (priorityMark == index) {
                bestCounts.push(i);
            }
        } else {
            const cost = getCost(outcome, optimalMax, mult);
            if (cost > bestResult) {
                bestCounts = [i];
                bestResult = cost;
            } else if (cost == bestResult) {
                bestCounts.push(i);
            }
        }
    }

    const compiled = compileRanges(bestCounts);

    return {
        solutions: compiled,
        bestResult: (typeof bestResult === 'string') ? bestResult : (bestResult * 0.5)
    }
}
function tryOffsetMinimizeCost(num, cur) {
    //given a magic amount and a random number, find the max magic to use to minimize cost when casted by GFD
    const mult = 1 - (si.checked ? 0.1 : 0) - (rb.checked ? 0.01 : 0);
    let bestCounts = [];
    let bestResult = Infinity;
    for (let i = cur; i <= magicMaxForGFDSS; i++) {
        const outcome = getOutcome(num, cur, i);
        if (!outcome) { continue; }
        const cost = getCost('gfd', i, mult) + 0.5 * getCost(outcome, i, mult);
        if (cost < bestResult) {
            bestCounts = [i];
            bestResult = cost;
        } else if (cost == bestResult) {
            bestCounts.push(i);
        }
    }

    const compiled = compileRanges(bestCounts);

    return { bestCounts: compiled, GFDCost: getCost('gfd', compiled[0][0], mult), cost: bestResult - getCost('gfd', compiled[0][0], mult) };
}
function tryOffsetMinimizeCostRange(num, range) {
    //given a range of magic amounts, find the one to minimize cost 
    const mult = 1 - (si.checked ? 0.1 : 0) - (rb.checked ? 0.01 : 0);

    let bestCounts = [];
    let bestCountsCorrespondingMax = [];
    let bestResult = Infinity;
    for (let i = range[0]; i <= range[1]; i++) {
        const config = tryOffsetMinimizeCost(num, i);
        if (config.cost) { }
        //unfinished
    }
}

function equivalentContent(a1, a2) {
    if (a1.length != a2.length) { return false; }
    for (let i in a1) {
        if (a1[i] != a2[i]) { return false; }
    }
    return true;
}
function computePossibleConfigs(spell) {
    recalcMult();
    let possibleConfigs = [
        ['cbg', 'fthof', 'st', 'se', 'hc', 'scp', 'ra', 'di']
    ]
    for (let i = 5; i <= magicMaxForGFDSS; i++) {
        loop:
        for (let ii = 5; ii <= i; ii++) {
            const GFD = getPossibleGFDs(ii, i);
            if (!GFD.includes(spell)) { continue; }
            for (let iii in possibleConfigs) {
                if (equivalentContent(possibleConfigs[iii], GFD)) { continue loop; }
            }
            possibleConfigs.push(GFD);
        }
    }
    return possibleConfigs();
}
function getRAResolveInfo(list) {
    const possibleRAConfigs = computePossibleRAConfigs('ra');
    recalcMult();

    let newList = [];

    for (let i in list) {
        newList.push([list[i]]);
    }

    for (let i in list) {
        for (let ii in possibleRAConfigs) {
            if (possibleRAConfigs[ii].indexOf('ra') / possibleRAConfigs[ii].length <= list[i]
                && (possibleRAConfigs[ii].indexOf('ra') + 1) / possibleRAConfigs[ii].length > list[i]) {
                newList[i].push(parseInt(ii));
            }
        }
    }
    return newList;
}
function getCorrespondingMagicAmounts() {
    let list = {};
    for (let i in possibleRAConfigs) {
        list[i] = { config: possibleRAConfigs[i] };
        const pos = list[i];
        for (let ii = 5; ii <= magicMaxForGFDSS; ii++) {
            let begin = 0;
            let last = false;
            for (let iii = 5; iii <= ii; iii++) {
                const result = getPossibleGFDs(iii, ii);
                if (equivalentContent(result, possibleRAConfigs[i])) {
                    if (!begin) { begin = iii; }
                    last = true;
                } else if (last) {
                    if (pos[ii]) {
                        pos[ii] = [].concat(pos[ii]);
                        pos[ii].push({ magic: [begin, iii - 1], gfd: getCost('gfd', ii, mult) });
                    } else {
                        pos[ii] = { magic: [begin, iii - 1], gfd: getCost('gfd', ii, mult) };
                    }
                    begin = 0;
                    last = false;
                }
            }
            if (last) {
                if (pos[ii]) {
                    pos[ii] = [].concat(pos[ii]);
                    pos[ii].push({ magic: [begin, ii], gfd: getCost('gfd', ii, mult) })
                } else {
                    pos[ii] = { magic: [begin, ii], gfd: getCost('gfd', ii, mult) };
                }
            }
        }
    }
    return list;
}

updateAdv();