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

function buildData() {
    let configs = [];
    for (let i = 5; i <= magicAbsMax; i++) {
        for (let ii = i; ii < 200; ii++) {
            const gfd = getPossibleGFDs(i, ii);
            if (equivalentIndexOf(configs, gfd) != -1) { continue; }
            configs.push(gfd);
        }
    }
    configs.splice(equivalentIndexOf(configs, []), 1);
    configs.splice(equivalentIndexOf(configs, ['cbg', 'fthof', 'st', 'se', 'hc', 'scp', 'ra', 'di']), 1);
    loop:
    for (let i = 0; i < configs.length; i++) {
        for (let ii = 0; ii < configs.length; ii++) {
            if (configs[ii].length == allGFDConfigs[allGFDConfigs.length - 1].length) { 
                allGFDConfigs.push(configs[ii]);
                configs.splice(ii, 1);
                if (ii <= i) { i--; }
                continue loop;
            }
        }
        for (let ii = 0; ii < configs.length; ii++) {
            if (configs[ii].length == allGFDConfigs[allGFDConfigs.length - 1].length - 1) { 
                allGFDConfigs.push(configs[ii]);
                configs.splice(ii, 1);
                if (ii <= i) { i--; }
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
            dataPoints[i].push(equivalentIndexOf(allGFDConfigs, getPossibleGFDs(i, ii)));
        }
    }
}

const squareSize = 3;
function drawData() {
    const ctx = offsetGraph.getContext('2d');
    ctx.fillStyle = 'black';
    offsetGraph.width = (201 - 5) * squareSize; offsetGraphInteractiveDisplay.width = offsetGraph.width; canvasContainer.style.width = offsetGraph.width;
    offsetGraph.height = (201 - 5) * squareSize; offsetGraphInteractiveDisplay.height = offsetGraph.height; canvasContainer.style.height = offsetGraph.height;
    const width = offsetGraph.width;
    const height = offsetGraph.height;
    ctx.fillRect(0, 0, width, height);
    for (let i = 5; i <= magicAbsMax; i++) {
        for (let ii = i; ii <= magicAbsMax; ii++) {
            ctx.fillStyle = colors[dataPoints[i][ii]];
            ctx.fillRect((ii - 5) * squareSize, height - (i - 5) * squareSize, squareSize, squareSize);
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
        str += '</div>'
    }

    dataAnnotations.innerHTML = str;
}

let additionalDisplayRadius = 3;
let additionalDisplaySquareSize = 20;
let upperLeftAnchor = [25, 25];
function updateDataInteractive(x, y) {
    const ctx = offsetGraphInteractiveDisplay.getContext('2d');
    x = Math.floor(x / squareSize) + 5; //max magic
    y = magicAbsMax - Math.floor(y / squareSize); //current magic

    const dim = (additionalDisplayRadius * 2 + 1) * additionalDisplaySquareSize;

    ctx.clearRect(0, 0, offsetGraph.width, offsetGraph.height);

    ctx.fillStyle = 'white';
    ctx.fillRect(upperLeftAnchor[0] - 5, upperLeftAnchor[1] - 5, dim + 10, dim + 10);
    //dont ask me how this works
    for (let i = -additionalDisplayRadius; i <= additionalDisplayRadius; i++) { //y
        for (let ii = -additionalDisplayRadius; ii <= additionalDisplayRadius; ii++) { //x
            if ((dataPoints[y + ii] ?? -1) === -1 || (dataPoints[y + ii][x + i] ?? -1) === -1) { 
                ctx.fillStyle = 'black';
            } else {
                ctx.fillStyle = colors[dataPoints[y + ii][x + i]];
            }
            ctx.fillRect(upperLeftAnchor[0] + (additionalDisplayRadius + i) * additionalDisplaySquareSize, upperLeftAnchor[1] + (additionalDisplayRadius - ii) * additionalDisplaySquareSize, additionalDisplaySquareSize, additionalDisplaySquareSize);
        }
    }
    ctx.fillStyle = 'red';
    ctx.fillRect(upperLeftAnchor[0] + additionalDisplayRadius * additionalDisplaySquareSize - 2, upperLeftAnchor[1], 4, dim);
    ctx.fillRect(upperLeftAnchor[0] + additionalDisplayRadius * additionalDisplaySquareSize + additionalDisplaySquareSize - 2, upperLeftAnchor[1], 4, dim);
    ctx.fillRect(upperLeftAnchor[0], upperLeftAnchor[1] + additionalDisplayRadius * additionalDisplaySquareSize - 2, dim, 4);
    ctx.fillRect(upperLeftAnchor[0], upperLeftAnchor[1] + additionalDisplayRadius * additionalDisplaySquareSize + additionalDisplaySquareSize - 2, dim, 4);

    ctx.font = 'bold 18px serif';
    ctx.fillStyle = 'white';
    if (y > x) { 
        ctx.fillText('Invalid tile!', upperLeftAnchor[0], upperLeftAnchor[1] + dim + 30);
        return; 
    }

    ctx.fillText(y + ' / ' + x + ' mana', upperLeftAnchor[0], upperLeftAnchor[1] + dim + 30);

    const config = allGFDConfigs[dataPoints[y][x]];
    if (!config.length) { ctx.fillText('(none)', upperLeftAnchor[0] + dim + 18, upperLeftAnchor[1] + 18); return; }
    for (let i = 0; i < config.length; i++) {
        ctx.drawImage(iconsImg, spells[config[i]].icon[0] * 48, spells[config[i]].icon[1] * 48, 48, 48, upperLeftAnchor[0] + dim + 18 + i * 36, upperLeftAnchor[1], 30, 30);
    }
    ctx.fillText(config.length + ' spell' + (config.length > 1?'s':'') + ' total', upperLeftAnchor[0] + dim + 18, upperLeftAnchor[1] + 48);
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
})

buildData(); drawData(); annotateData();