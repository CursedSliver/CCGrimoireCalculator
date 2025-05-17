let dataPoints = []; //first layer is current magic, second layer is max magic
let allGFDConfigs = [
    [],
    ['cbg', 'fthof', 'st', 'se', 'hc', 'scp', 'ra', 'di']
];
const offsetGraph = document.getElementById('offsetGraph');
const canvasContainer = document.getElementById('canvasContainer');
const offsetGraphInteractiveDisplay = document.getElementById('offsetGraphInteractiveDisplay');
const dataAnnotations = document.getElementById('dataAnnotations');
const iconsImg = document.getElementById('iconsImg');
const colors = [
    `rgb(95, 95, 95)`,
    `rgb(255, 255, 255)`,
    `rgb(141, 67, 67)`,
    `rgb(255, 222, 58)`,
    `rgb(73, 255, 213)`,
    `rgb(255, 126, 94)`,
    `rgb(109, 65, 243)`,
    `rgb(73, 163, 133)`,
    `rgb(155, 146, 255)`,
    `rgb(255, 225, 190)`,
    `rgb(242, 0, 255)`,
    `rgb(21, 255, 0)`,
    `rgb(179, 0, 255)`,
    `rgb(255, 174, 213)`,
    `rgb(153, 212, 59)`,
    `rgb(8, 112, 135)`,
    `rgb(17, 22, 123)`,
    `rgb(30, 0, 255)`,
    `rgb(126, 143, 155)`,
    `rgb(59, 144, 255)`,
    `rgb(255, 136, 0)`,
    `rgb(83, 125, 70)`,
    `rgb(139, 72, 111)`
]

function equivalentIndexOf(arr, item) {
    for (let i = 0; i < arr.length; i++) {
        if (equivalentContent(arr[i], item)) { return i; }
    }
    return -1;
}

function addConfigs(configsArr, mult) {
    for (let i = 5; i <= magicAbsMax; i++) {
        for (let ii = i; ii < 200; ii++) {
            const gfd = getPossibleGFDs(i, ii, mult);
            if (equivalentIndexOf(configsArr, gfd) != -1) { continue; }
            configsArr.push(gfd);
        }
    }
}

function buildData() {
    let configs = [];
    allGFDConfigs = [
        [],
        ['cbg', 'fthof', 'st', 'se', 'hc', 'scp', 'ra', 'di']
    ];
    for (let i = 0; i < 4; i++) {
        addConfigs(configs, 1 - ((i % 2 == 1)?0.1:0) - ((i >= 2)?0.01:0));
    }
    configs.splice(equivalentIndexOf(configs, []), 1);
    configs.splice(equivalentIndexOf(configs, ['cbg', 'fthof', 'st', 'se', 'hc', 'scp', 'ra', 'di']), 1);
    const l = configs.length;
    loop:
    for (let i = 0; i < l; i++) {
        for (let ii = 0; ii < configs.length; ii++) {
            if (configs[ii].length == allGFDConfigs[allGFDConfigs.length - 1].length) { 
                allGFDConfigs.push(configs[ii]);
                configs.splice(ii, 1);
                continue loop;
            }
        }
        for (let ii = 0; ii < configs.length; ii++) {
            if (configs[ii].length == allGFDConfigs[allGFDConfigs.length - 1].length - 1) { 
                allGFDConfigs.push(configs[ii]);
                configs.splice(ii, 1);
                continue loop;
            }
        }
    }

    for (let i = 0; i <= magicAbsMax; i++) {
        dataPoints[i] = [];
        if (i < 5) { 
            continue; 
        }
        for (let ii = 0; ii < i; ii++) {
            dataPoints[i].push(null);
        }
        for (let ii = i; ii <= magicAbsMax; ii++) {
            if (ii < 5) { 
                dataPoints[i].push(null); 
                continue; 
            }
            dataPoints[i].push(
                equivalentIndexOf(allGFDConfigs, getPossibleGFDs(i, ii, 1)) + 
                equivalentIndexOf(allGFDConfigs, getPossibleGFDs(i, ii, 0.9)) * 100 + 
                equivalentIndexOf(allGFDConfigs, getPossibleGFDs(i, ii, 0.99)) * 10000 +
                equivalentIndexOf(allGFDConfigs, getPossibleGFDs(i, ii, 0.89)) * 1000000  
            );
        }
    }
}

const scaleFactor = 3;
const squareSize = 4 * scaleFactor;
function drawCrate(ctx, topLeftX, topLeftY, size, colors) {
    const corners = [
        { x: topLeftX, y: topLeftY },   
        { x: topLeftX + size, y: topLeftY },    
        { x: topLeftX + size, y: topLeftY + size },   
        { x: topLeftX, y: topLeftY + size }  
    ];

    const center = { x: topLeftX + size / 2, y: topLeftY + size / 2 }

    for (let i = 0; i < 4; i++) {
        const c1 = corners[i];
        const c2 = corners[(i + 1) % 4];
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(c1.x, c1.y);
        ctx.lineTo(c2.x, c2.y);
        ctx.closePath();
        ctx.fillStyle = colors[i];
        ctx.fill();
    }
}
function drawData() {
    const ctx = offsetGraph.getContext('2d');
    ctx.fillStyle = 'black';
    const dim = (201 - 5) * squareSize;
    offsetGraph.width = dim; offsetGraph.style.width = dim / scaleFactor; offsetGraphInteractiveDisplay.width = dim; canvasContainer.style.width = dim / scaleFactor;
    offsetGraph.height = dim; offsetGraph.style.height = dim / scaleFactor;  offsetGraphInteractiveDisplay.height = offsetGraph.height; canvasContainer.style.height = offsetGraph.height / scaleFactor;
    const width = dim;
    const height = offsetGraph.height;
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    for (let i = 5; i <= magicAbsMax; i++) {
        for (let ii = i; ii <= magicAbsMax; ii++) {
            //right = si, bottom = rb, left = sirb
            //ctx.fillStyle = colors[dataPoints[i][ii]];
            const c = [
                colors[Math.floor((dataPoints[i][ii] / 100 - Math.floor(dataPoints[i][ii] / 100)) * 100)],
                colors[Math.floor((dataPoints[i][ii] / 10000 - Math.floor(dataPoints[i][ii] / 10000)) * 100)],
                colors[Math.floor((dataPoints[i][ii] / 1000000 - Math.floor(dataPoints[i][ii] / 1000000)) * 100)],
                colors[Math.floor((dataPoints[i][ii] / 100000000 - Math.floor(dataPoints[i][ii] / 100000000)) * 100)]
            ];
            drawCrate(ctx, (ii - 5) * squareSize, 
                height - (i - 5) * squareSize, 
                squareSize, c
            );
            //ctx.fillRect((ii - 5) * squareSize, height - (i - 5) * squareSize, squareSize, squareSize);
        }
    }
}

function annotateData() {
    let str = '<div class="box" style="background: '+colors[0]+'">0 (empty)</div>';
    for (let i = 1; i < allGFDConfigs.length; i++) {
        str += '<div class="box" style="background: '+colors[i]+'">'+allGFDConfigs[i].length;
        for (let ii in allGFDConfigs[i]) {
            str += '<div class="icon" style="background-position: -' + (spells[allGFDConfigs[i][ii]].icon[0] * 48) + 'px -' + (spells[allGFDConfigs[i][ii]].icon[1] * 48) + 'px;"></div>'; 
        }
        str += '</div>';
    }

    dataAnnotations.innerHTML = str;
}

const additionalDisplayRadius = 3;
const additionalDisplaySquareSize = 30 * scaleFactor;
const upperLeftAnchor = [25 * scaleFactor, 25 * scaleFactor];
const sirbConfigIcons = [
    [5, 10],
    [34, 25],
    [32, 25],
    [10, 25]
];
let lastHoverX = 0;
let lastHoverY = 0;
function updateDataInteractive(x, y) {
    const ctx = offsetGraphInteractiveDisplay.getContext('2d');
    x *= scaleFactor;
    y *= scaleFactor;

    lastHoverX = x;
    lastHoverY = y;

    x = Math.floor(x / squareSize) + 5; //max magic
    y = magicAbsMax - Math.floor(y / squareSize); //current magic

    const dim = (additionalDisplayRadius * 2 + 1) * additionalDisplaySquareSize;

    ctx.clearRect(0, 0, offsetGraph.width, offsetGraph.height);

    ctx.fillStyle = 'rgba(102, 102, 102, 0.21)';
    for (let i = 50; i < magicAbsMax; i += 50) {
        ctx.fillRect(0, i * squareSize - 1, offsetGraph.width, 1);
        ctx.fillRect((i - 5) * squareSize - 1, 0, 1, offsetGraph.height);
    }
    ctx.fillStyle = 'white';
    let count = 0;
    for (let i of [5, 10, 50]) {
        for (let ii = i; ii < magicAbsMax; ii += i) {
            const longSide = 5 * (2 ** count);
            const shortSide = 2 + count;
            ctx.fillRect(0, ii * squareSize - shortSide / 2, longSide, shortSide);
            ctx.fillRect((ii - 5) * squareSize - shortSide / 2, 0, shortSide, longSide);
        }
        count++;
    }

    ctx.fillStyle = 'white';
    ctx.fillRect(upperLeftAnchor[0] - 5 * scaleFactor, upperLeftAnchor[1] - 5 * scaleFactor, dim + 10 * scaleFactor, dim + 10 * scaleFactor);
    ctx.fillStyle = 'black';
    ctx.fillRect(upperLeftAnchor[0] - 2 * scaleFactor, upperLeftAnchor[1] - 2 * scaleFactor, dim + 4 * scaleFactor, dim + 4 * scaleFactor);
    //dont ask me how this works
    for (let i = -additionalDisplayRadius; i <= additionalDisplayRadius; i++) { //y
        for (let ii = -additionalDisplayRadius; ii <= additionalDisplayRadius; ii++) { //x
            if ((dataPoints[y + ii] ?? -1) === -1 || (dataPoints[y + ii][x + i] ?? -1) === -1) { 
                ctx.fillStyle = 'black';
                ctx.fillRect(upperLeftAnchor[0] + (additionalDisplayRadius + i) * additionalDisplaySquareSize, upperLeftAnchor[1] + (additionalDisplayRadius - ii) * additionalDisplaySquareSize, additionalDisplaySquareSize, additionalDisplaySquareSize);
            } else {
                const c = [
                    colors[Math.floor((dataPoints[y + ii][x + i] / 100 - Math.floor(dataPoints[y + ii][x + i] / 100)) * 100)],
                    colors[Math.floor((dataPoints[y + ii][x + i] / 10000 - Math.floor(dataPoints[y + ii][x + i] / 10000)) * 100)],
                    colors[Math.floor((dataPoints[y + ii][x + i] / 1000000 - Math.floor(dataPoints[y + ii][x + i] / 1000000)) * 100)],
                    colors[Math.floor((dataPoints[y + ii][x + i] / 100000000 - Math.floor(dataPoints[y + ii][x + i] / 100000000)) * 100)]
                ];
                drawCrate(ctx,upperLeftAnchor[0] + (additionalDisplayRadius + i) * additionalDisplaySquareSize, upperLeftAnchor[1] + (additionalDisplayRadius - ii) * additionalDisplaySquareSize, additionalDisplaySquareSize, c);
            }
        }
    }
    ctx.fillStyle = 'rgba(102, 102, 102, 0.21)';
    for (let i = 1; i <= additionalDisplayRadius * 2; i++) {
        ctx.fillRect(upperLeftAnchor[0], upperLeftAnchor[1] + i * additionalDisplaySquareSize - 1, dim, 2);
        ctx.fillRect(upperLeftAnchor[0] + i * additionalDisplaySquareSize - 1, upperLeftAnchor[1], 2, dim);
    }
    ctx.fillStyle = 'red';
    ctx.fillRect(upperLeftAnchor[0] + additionalDisplayRadius * additionalDisplaySquareSize - 2, upperLeftAnchor[1], 3 * scaleFactor, dim);
    ctx.fillRect(upperLeftAnchor[0] + additionalDisplayRadius * additionalDisplaySquareSize + additionalDisplaySquareSize - 2, upperLeftAnchor[1], 3 * scaleFactor, dim);
    ctx.fillRect(upperLeftAnchor[0], upperLeftAnchor[1] + additionalDisplayRadius * additionalDisplaySquareSize - 2, dim, 3 * scaleFactor);
    ctx.fillRect(upperLeftAnchor[0], upperLeftAnchor[1] + additionalDisplayRadius * additionalDisplaySquareSize + additionalDisplaySquareSize - 2, dim, 3 * scaleFactor);

    ctx.font = 'bold ' + (18 * scaleFactor) + 'px serif';
    ctx.fillStyle = 'white';
    if (y > x) { 
        ctx.fillText('Invalid tile!', upperLeftAnchor[0], upperLeftAnchor[1] + dim + 30 * scaleFactor);
        return; 
    }

    ctx.fillText(y + ' / ' + x + ' mana', upperLeftAnchor[0], upperLeftAnchor[1] + dim + 30 * scaleFactor);

    //const config = allGFDConfigs[dataPoints[y][x]];
    //if (!config.length) { ctx.fillText('(none)', upperLeftAnchor[0] + dim + 18 * scaleFactor, upperLeftAnchor[1] + 18 * scaleFactor); return; }
    for (let i = 1; i <= 4; i++) {
        const config = allGFDConfigs[Math.floor((dataPoints[y][x] / (100 ** i) - Math.floor(dataPoints[y][x] / (100 ** i))) * 100)];
        //console.log(config, dataPoints[y][x]);
        let indicator = ['#333333', '#333333', '#333333', '#333333'];
        indicator[i - 1] = colors[equivalentIndexOf(allGFDConfigs, config)];
        drawCrate(ctx, upperLeftAnchor[0] + dim + 18 * scaleFactor, upperLeftAnchor[1] + (i - 1) * 36 * scaleFactor, 24 * scaleFactor, indicator);
        ctx.drawImage(iconsImg, sirbConfigIcons[i - 1][0] * 48, sirbConfigIcons[i - 1][1] * 48, 48, 48, upperLeftAnchor[0] + dim + 48 * scaleFactor, upperLeftAnchor[1] - 3 * scaleFactor + 36 * (i - 1) * scaleFactor, 30 * scaleFactor, 30 * scaleFactor);

        ctx.fillStyle = 'white';
        if (!config.length) { ctx.fillText('(none)', upperLeftAnchor[0] + dim + 84 * scaleFactor, upperLeftAnchor[1] + 18 * scaleFactor + (i - 1) * 36 * scaleFactor); continue; }
        ctx.fillText(config.length, upperLeftAnchor[0] + dim + 84 * scaleFactor, upperLeftAnchor[1] + 18 * scaleFactor + (i - 1) * 36 * scaleFactor);
        for (let ii = 0; ii < config.length; ii++) {
            ctx.drawImage(iconsImg, spells[config[ii]].icon[0] * 48, spells[config[ii]].icon[1] * 48, 48, 48, upperLeftAnchor[0] + dim + 100 * scaleFactor + ii * 30 * scaleFactor, upperLeftAnchor[1] + 36 * (i - 1) * scaleFactor, 24 * scaleFactor, 24 * scaleFactor);
        }
    }
    //ctx.fillText(config.length + ' spell' + (config.length > 1?'s':'') + ' total', upperLeftAnchor[0] + dim + 18 * scaleFactor, upperLeftAnchor[1] + 48 * scaleFactor);
}
offsetGraphInteractiveDisplay.addEventListener('mousemove', function(e) {
    //insane orteil code
    var posx = 0;
    var posy = 0;
    if (e.clientX || e.clientY) {
        posx = e.clientX + document.body.scrollLeft;
        posy = e.clientY + document.body.scrollTop;
    }

    updateDataInteractive(posx - offsetGraphInteractiveDisplay.getBoundingClientRect().left, posy - offsetGraphInteractiveDisplay.getBoundingClientRect().top);
});

function redrawAll(init) {
    buildData(); drawData(); annotateData();
    if (!init) { updateDataInteractive(lastHoverX, lastHoverY); }
}

document.querySelectorAll('input[type=number]').forEach(input => {
    input.addEventListener('wheel', function (event) {
        if (document.activeElement === this) {
            event.preventDefault();
        }
    });
});