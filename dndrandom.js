function getExpectedYield(rolls) {
    let ev = 0;
    const arr = rolls.split(' ');
    for (let i in arr) {
        let param = arr[i].split('d');
        let mode = arr[i].includes('k');
        if (mode) {
            if (param[1].includes('kl')) {
                ev += getEVFromDisadvantage(parseInt(param[0]), parseInt(param[1].split('kl')[0]), parseInt(param[1].split('kl')[1]), []);
            } else {
                ev += getEVFromAdvantage(parseInt(param[0]), parseInt(param[1].split('k')[0]), parseInt(param[1].split('k')[1]), []);
            }
        } else {
            ev += parseInt(param[0]) * (parseInt(param[1]) / 2 + 0.5);
        }
    }
    return ev;
}

function getEVFromAdvantage(count, base, taken, n) {
    let ev = 0;
    if (n.length >= count) {
        let list = [];
        for (let i = 0; i < taken; i++) {
            list.push(0);
            for (let ii in n) {
                if (n[ii] > list[i]) {
                    list[i] = n[ii];
                }
            }
            n.splice(n.indexOf(list[i]), 1);
        } 
        for (let i in list) {
            ev += list[i];
        }
        return ev / (base ** count);
    }
    for (let i = 1; i <= base; i++) {
        ev += getEVFromAdvantage(count, base, taken, n.concat(i));
    }
    return ev;
}
function getEVFromDisadvantage(count, base, taken, n) {
    let ev = 0;
    if (n.length >= count) {
        let list = [];
        for (let i = 0; i < taken; i++) {
            list.push(Infinity);
            for (let ii in n) {
                if (n[ii] < list[i]) {
                    list[i] = n[ii];
                }
            }
            n.splice(n.indexOf(list[i]), 1);
        } 
        for (let i in list) {
            ev += list[i];
        }
        return ev / (base ** count);
    }
    for (let i = 1; i <= base; i++) {
        ev += getEVFromDisadvantage(count, base, taken, n.concat(i));
    }
    return ev;
}

function getEVFromAdvantageLimitedOptimized(count, base) {
    //"taken" is 1
    let ev = 0;
    for (let i = 1; i <= base; i++) {
        ev += i * ((i ** count) - ((i - 1) ** count));
    }
    return ev / (base ** count);
}