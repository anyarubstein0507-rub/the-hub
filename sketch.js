let circles = [];
let glueLayer;
let capture;
let snapshot = null;
let showCamera = false;

// Input States
let userName = ""; 
let userTasks = "";
let inputMode = "none"; 

// Scroll Logic
let worldWidth = 3000; 
let scrollX = 0; 

// UI Colors
const BG_COLOR = '#1D1D1D';
const CREAM = '#EFEDE9';
const LILAC = '#93A4FF';
const REDO_RED = '#FE6147';
const GREY_TEXT = 'rgba(239, 237, 233, 0.6)';

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  // --- FIX PIXELATION ---
  // This tells the browser: "If this is an iPhone/Mac, use 2x or 3x more pixels"
  pixelDensity(window.devicePixelRatio); 
  
  // --- SETUP GLUE LAYER ---
  glueLayer = createGraphics(worldWidth, height);
  glueLayer.pixelDensity(window.devicePixelRatio); // Sharpens the liquid effect

  capture = createCapture(VIDEO);
  capture.size(250, 250);
  capture.hide();
  
  // --- FIX FONT ---
  textFont('DM Sans'); // This must match the HTML link exactly
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  glueLayer = createGraphics(worldWidth, height);
  glueLayer.pixelDensity(displayDensity());
}

function draw() {
  background(BG_COLOR);

  if (mouseIsPressed && !showCamera && inputMode === "none") {
    let draggingAny = circles.some(c => c.dragging);
    if (!draggingAny) {
        scrollX -= movedX; 
    }
  }
  scrollX = constrain(scrollX, 0, worldWidth - width);

  // --- 1. PROCESS GLUE LAYER (Metaballs) ---
  glueLayer.background(BG_COLOR); // Clear with dark background
  glueLayer.noStroke();
  glueLayer.fill(255); // Draw white blobs
  
  for (let c of circles) {
    c.applyBehaviors(circles);
    c.update();
    // Draw connections into glue layer
    glueLayer.ellipse(c.pos.x, c.pos.y, c.r * 2.2);
  }
  
  // Liquid Filters
  glueLayer.filter(BLUR, 12);
  glueLayer.filter(THRESHOLD, 0.5);

  // --- 2. RENDER WORLD ---
  push();
  translate(-scrollX, 0);
  
  // PASS 1: DRAW GLOWS
  for (let c of circles) {
    if (c.connections.length > 0) {
      c.drawGlow();
    }
  }

  // PASS 2: DRAW GLUE (Tinted Cream)
  tint(CREAM);
  image(glueLayer, 0, 0); 
  noTint();
  
  // PASS 3: DRAW FACES
  for (let c of circles) {
    c.display();
  }
  pop();

  drawHeader();
  drawPlus();

  if (showCamera || inputMode !== "none") {
    drawCameraInterface();
  }
}

function drawHeader() {
  push();
  noStroke();
  textAlign(LEFT, TOP);
  
  fill(CREAM);
  textSize(24);
  textStyle(BOLD);
  text("welcome to the live hub", 30, 30);
  
  textSize(12);
  
  let liveCount = circles.length + " people ";
  fill(CREAM); textStyle(BOLD);
  text(liveCount, 30, 64);
  
  let xOffset = textWidth(liveCount);
  fill(GREY_TEXT); textStyle(NORMAL);
  text("live right now", 30 + xOffset, 64);
  
  let totalTasks = circles.reduce((sum, c) => sum + int(c.tasks), 0) + " tasks ";
  fill(CREAM); textStyle(BOLD);
  text(totalTasks, 30, 82);
  
  let yOffset = textWidth(totalTasks);
  fill(GREY_TEXT); textStyle(NORMAL);
  text("completed today", 30 + yOffset, 82);
  pop();
}

function drawPlus() {
  push();
  fill(255);
  noStroke();
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(50);
  text("+", width / 2, height / 2 - 5);
  pop();
}

function drawCameraInterface() {
  fill(29, 29, 29, 245); 
  rect(0, 0, width, height);
  let cx = width / 2 - 125, cy = height / 2 - 125;

  if (snapshot) image(snapshot, cx, cy, 250, 250);
  else {
    push(); translate(cx + 250, cy); scale(-1, 1); image(capture, 0, 0, 250, 250); pop();
  }

  textAlign(CENTER);
  textStyle(BOLD);
  if (!snapshot) {
    fill(CREAM); textSize(13); text("tap to snapshot", width/2, cy + 280);
  } else if (inputMode === "none") {
    textSize(24); 
    fill(REDO_RED); textAlign(LEFT); text("redo", cx, cy + 300);
    fill(LILAC); textAlign(RIGHT); text("approve", cx + 250, cy + 300);
  } else {
    fill(CREAM); 
    if (inputMode === "name") {
      textSize(20); text("type your name & press enter", width/2, cy - 40);
      textSize(32); text(userName.toLowerCase() + "|", width/2, cy + 300);
    } else if (inputMode === "tasks") {
      textSize(20); text("how many tasks have you completed today?", width/2, cy - 40);
      textSize(48); fill(LILAC); text(userTasks + "|", width/2, cy + 310);
    }
  }
}

function keyPressed() {
  if (inputMode === "name") {
    if (keyCode === ENTER && userName.length > 0) inputMode = "tasks";
    else if (keyCode === BACKSPACE) userName = userName.substring(0, userName.length - 1);
    else if (key.length === 1 && userName.length < 12) userName += key;
  } 
  else if (inputMode === "tasks") {
    if (keyCode === ENTER && userTasks.length > 0) {
      circles.push(new Circle(width / 2, height / 2, snapshot.get(), userName.toLowerCase(), int(userTasks)));
      inputMode = "none"; showCamera = false; snapshot = null; userName = ""; userTasks = "";
    } else if (keyCode === BACKSPACE) userTasks = userTasks.substring(0, userTasks.length - 1);
    else if (key >= '0' && key <= '9' && userTasks.length < 3) userTasks += key;
  }
}

class Circle {
  constructor(x, y, img, name, tasks) {
    let angle = random(TWO_PI);
    let distOut = random(100, 140); 
    this.pos = createVector(x + scrollX + cos(angle) * distOut, y + sin(angle) * distOut);
    this.r = 45;
    this.dragging = false;
    this.offset = random(100);
    this.img = img; 
    this.displayName = name;
    this.tasks = tasks;
    this.connections = []; 

    this.maskGfx = createGraphics(90, 90);
    this.maskGfx.ellipse(45, 45, 90, 90);
    this.img.mask(this.maskGfx);
  }

  applyBehaviors(others) {
    if (this.dragging) {
        for (let i = this.connections.length - 1; i >= 0; i--) {
            let other = this.connections[i];
            if (dist(this.pos.x, this.pos.y, other.pos.x, other.pos.y) > 180) {
                this.breakConnection(other);
            }
        }
        return;
    }

    let viewCenter = createVector(width/2 + scrollX, height/2);
    if (dist(this.pos.x, this.pos.y, viewCenter.x, viewCenter.y) < 85) {
      this.pos.add(p5.Vector.sub(this.pos, viewCenter).normalize().mult(2));
    }

    for (let other of others) {
      if (other === this) continue;
      let d = dist(this.pos.x, this.pos.y, other.pos.x, other.pos.y);
      let connectThreshold = this.r * 1.8;

      if (d < connectThreshold && !this.connections.includes(other)) {
          this.connections.push(other);
          if (!other.connections.includes(this)) other.connections.push(this);
      }

      if (this.connections.includes(other)) {
          let targetDist = this.r * 1.5;
          let force = (d - targetDist) * 0.08;
          let diff = p5.Vector.sub(other.pos, this.pos);
          diff.normalize().mult(force);
          this.pos.add(diff);
      } else if (d < this.r * 1.8) {
          this.pos.add(p5.Vector.sub(this.pos, other.pos).normalize().mult(0.5));
      }
    }
  }

  breakConnection(other) {
    this.connections = this.connections.filter(c => c !== other);
    other.connections = other.connections.filter(c => c !== this);
  }

  update() {
    if (this.dragging) this.pos.set(mouseX + scrollX, mouseY);
    else this.pos.y += sin(frameCount * 0.03 + this.offset) * 0.2;
  }

  drawGlow() {
    push();
    translate(this.pos.x, this.pos.y);
    let pulse = 20 + sin(frameCount * 0.05 + this.offset) * 10;
    drawingContext.shadowBlur = pulse + 30;
    drawingContext.shadowColor = LILAC;
    noStroke();
    fill(147, 164, 255, 50); 
    ellipse(0, 0, this.r * 1.5);
    pop();
  }

  display() {
    push();
    translate(this.pos.x, this.pos.y);
    
    // 1. Gradient Border
    let grad = drawingContext.createLinearGradient(-this.r, -this.r, this.r, this.r);
    grad.addColorStop(0, CREAM);
    grad.addColorStop(1, LILAC);
    drawingContext.fillStyle = grad;
    noStroke();
    ellipse(0, 0, this.r * 2);

    // 2. Photo with Lilac Wash
    imageMode(CENTER);
    tint(200, 180, 220); 
    image(this.img, 0, 0, this.r * 1.8, this.r * 1.8);
    noTint();

    // 3. Extra Wash Overlay
    fill(147, 164, 255, 40); 
    ellipse(0, 0, this.r * 1.8);

    // 4. Text
    fill(CREAM);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(10); text(this.displayName, 0, -6);
    textSize(7); text(this.tasks + " tasks completed today", 0, 6);
    pop();
  }
}

function mousePressed() {
  if (inputMode !== "none") return;
  if (showCamera) {
    let cx = width / 2 - 125, cy = height / 2 - 125;
    if (mouseX < cx || mouseX > cx + 250 || mouseY < cy || mouseY > cy + 300) {
      showCamera = false; snapshot = null; return;
    }
    if (!snapshot) {
      let temp = capture.get(0, 0, 250, 250);
      snapshot = createGraphics(250, 250);
      snapshot.push(); snapshot.translate(250, 0); snapshot.scale(-1, 1); snapshot.image(temp, 0, 0); snapshot.pop();
    } else {
      if (mouseX > width/2) inputMode = "name";
      else snapshot = null;
    }
    return;
  }
  if (dist(mouseX, mouseY, width / 2, height / 2) < 40) showCamera = true;
  for (let c of circles) {
    if (dist(mouseX + scrollX, mouseY, c.pos.x, c.pos.y) < c.r) {
      c.dragging = true; break;
    }
  }
}

function mouseReleased() {
  for (let c of circles) c.dragging = false;
}
