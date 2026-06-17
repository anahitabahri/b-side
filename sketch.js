let cellSize = 7;
let cols, rows;
let fft, ampAnalyzer;
let song;
let isPlaying = false;

// Circle layout
let circX, circY, circR;

// Audio smoothing
let prevBass = 0;
let kickVal = 0;
let smoothBass = 0;
let smoothMid = 0;
let smoothHigh = 0;
let smoothEnergy = 0;

// Per-cell data
let cellPhase = [];

// Color palettes
let palettes = [
  [[10, 80, 255], [0, 200, 220], [0, 255, 140], [30, 40, 180], [0, 160, 200]],
  [[255, 20, 120], [255, 0, 200], [255, 60, 80], [200, 0, 100], [255, 130, 180]],
  [[180, 40, 255], [255, 50, 150], [100, 20, 200], [220, 80, 220], [140, 0, 255]],
  [[255, 140, 30], [255, 80, 50], [255, 200, 60], [220, 60, 30], [255, 110, 80]],
  [[160, 190, 255], [220, 230, 255], [80, 120, 220], [200, 210, 255], [40, 70, 180]],
];
let currentPal = 0;
let nextPal = 1;
let palBlend = 0;
let palTimer = 0;

let titleFont;

function preload() {
  song = loadSound("YOUcanDOitBABY!.wav");
  titleFont = loadFont("HATTEN.TTF");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  cols = floor(width / cellSize);
  rows = floor(height / cellSize);
  fft = new p5.FFT(0.8, 512);
  ampAnalyzer = new p5.Amplitude();
  initCells();
  updateLayout();
  noStroke();
  tryAutoPlay();
}

// ---- LAYOUT ----

function updateLayout() {
  let minDim = min(width, height);
  circR = minDim * 0.40;   // bigger circle
  circX = width * 0.38;
  circY = height * 0.5;   // slightly above center
}

function initCells() {
  let total = cols * rows;
  cellPhase = new Array(total);
  for (let i = 0; i < total; i++) {
    cellPhase[i] = random(TWO_PI);
  }
}

function draw() {
  background(0);
  let dt = deltaTime / 1000;
  dt = min(dt, 0.1);

  let spectrum = fft.analyze();
  let level = ampAnalyzer.getLevel();
  let bass = fft.getEnergy("bass") / 255;
  let mid = fft.getEnergy("mid") / 255;
  let high = fft.getEnergy("treble") / 255;

  smoothBass = lerp(smoothBass, bass, 0.3);
  smoothMid = lerp(smoothMid, mid, 0.25);
  smoothHigh = lerp(smoothHigh, high, 0.25);
  smoothEnergy = lerp(smoothEnergy, pow(level, 0.4), 0.2);

  let kick = 0;
  if (bass - prevBass > 0.1) {
    kick = constrain((bass - prevBass) * 3, 0, 1);
  }
  prevBass = lerp(prevBass, bass, 0.15);
  kickVal *= 0.85;
  if (kick > kickVal) kickVal = kick;

  palTimer += dt;
  if (palTimer > 20) {
    currentPal = nextPal;
    nextPal = (nextPal + 1) % palettes.length;
    palBlend = 0;
    palTimer = 0;
  }
  palBlend = min(1, palBlend + dt / 3);
  let pal = blendPals(palettes[currentPal], palettes[nextPal], palBlend);

  let t = millis() * 0.001;

  drawCircularGrid(spectrum, pal, t);
  drawText();
}

// ---- CIRCULAR GRID ----

function drawCircularGrid(spectrum, pal, t) {
  let gridCX = circX / cellSize;
  let gridCY = circY / cellSize;
  let gridR = circR / cellSize;

  let startCol = max(0, floor(gridCX - gridR - 1));
  let endCol = min(cols, ceil(gridCX + gridR + 1));
  let startRow = max(0, floor(gridCY - gridR - 1));
  let endRow = min(rows, ceil(gridCY + gridR + 1));

  for (let y = startRow; y < endRow; y++) {
    for (let x = startCol; x < endCol; x++) {
      let dx = (x + 0.5) - gridCX;
      let dy = (y + 0.5) - gridCY;
      let dist = sqrt(dx * dx + dy * dy);
      if (dist > gridR) continue;

      let edgeFade = constrain((gridR - dist) / 2.5, 0, 1);

      let gi = y * cols + x;
      let px = x * cellSize;
      let py = y * cellSize;

      let n = noise(x * 0.1, y * 0.1, t * 0.3);
      let freqIdx = floor(n * spectrum.length * 0.5);
      freqIdx = constrain(freqIdx, 0, spectrum.length - 1);
      let specVal = spectrum[freqIdx] / 255;

      let cn = noise(x * 0.05, y * 0.05, t * 0.2);
      let ci = constrain(floor(cn * pal.length), 0, pal.length - 1);
      let c = pal[ci];

      let phase = cellPhase[gi];
      let breathe = sin(t * 2 + phase) * 0.04;
      let bright = 0.2 + specVal * 0.4 + smoothEnergy * 0.55 + breathe + kickVal * 0.3;
      bright = constrain(bright, 0.03, 1.5);

      let sz = cellSize * (0.2 + specVal * 0.4 + smoothEnergy * 0.3 + smoothBass * 0.15 + kickVal * 0.2);
      sz = constrain(sz, cellSize * 0.1, cellSize * 0.95);
      let pad = (cellSize - sz) / 2;

      fill(c[0] * bright * edgeFade, c[1] * bright * edgeFade, c[2] * bright * edgeFade);
      rect(px + pad, py + pad, sz, sz);
    }
  }
}

// ---- TEXT ----

function drawText() {
  // "b-side." — big, centered, overlapping the visualizer
  let titleSize = max(64, width * 0.11);
  textFont(titleFont);
  textSize(titleSize);
  textAlign(CENTER, CENTER);

  // Subtle shadow for projection readability
  // fill(0, 0, 0, 120);
  // text("b-side.", width / 2 + 2, circY + 5);

  // Main title in white
  fill(255);
  text("b-side.", width * 0.615, circY);

  // Project card — tucked under "side."
  let descSize = max(11, width * 0.011);
  textFont('Roboto');
  textSize(descSize);
  textAlign(LEFT, TOP);
  textLeading(descSize * 1.7);
  fill(255, 255, 255, 150);
  let descX = width * 0.575;
  let descY = circY + titleSize / 2 + 12;
  let descW = 240;
  text(
    "a listening installation broadcasting the b-sides of my listening life through three radio stations: solo, in love, in community.",
    descX, descY, descW
  );
}

// ---- UTILITY ----

function blendPals(a, b, t) {
  let r = [];
  for (let i = 0; i < a.length; i++) {
    r.push([
      lerp(a[i][0], b[i][0], t),
      lerp(a[i][1], b[i][1], t),
      lerp(a[i][2], b[i][2], t)
    ]);
  }
  return r;
}

// ---- CONTROLS ----

function tryAutoPlay() {
  if (isPlaying) return;
  getAudioContext().resume().then(() => {
    if (!isPlaying && song && song.isLoaded()) {
      song.loop();
      isPlaying = true;
    }
  }).catch(() => {});
}

function mousePressed() {
  if (!isPlaying) {
    getAudioContext().resume().then(() => {
      song.loop();
      isPlaying = true;
    });
  }
}

function keyPressed() {
  if (!isPlaying) {
    getAudioContext().resume().then(() => {
      song.loop();
      isPlaying = true;
    });
  }

  if (key === " ") {
    if (song.isPlaying()) song.pause();
    else song.loop();
  }

  if (keyCode === RIGHT_ARROW && song.isPlaying()) {
    let t = song.currentTime();
    let dur = song.duration();
    let newT = t + 10;
    if (newT >= dur) newT = newT - dur;
    song.jump(newT);
  }
  if (keyCode === LEFT_ARROW && song.isPlaying()) {
    let t = song.currentTime();
    let dur = song.duration();
    let newT = t - 10;
    if (newT < 0) newT = dur + newT;
    song.jump(newT);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  cols = floor(width / cellSize);
  rows = floor(height / cellSize);
  initCells();
  updateLayout();
}
