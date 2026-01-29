// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCfa_I1642RFckchkTS4EdJxnGLgwNrGwQ",
  authDomain: "the-hub-50647.firebaseapp.com",
  projectId: "the-hub-50647",
  storageBucket: "the-hub-50647.firebasestorage.app",
  messagingSenderId: "756123675906",
  appId: "1:756123675906:web:3467dd7637e7ab4642e61b"
};

// Global Variables
let db;
let circles = [];
let glueLayer;
let capture;
let snapshot = null;
let showCamera = false;
let activeInput = null; // Holds the text box

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
  pixelDensity(window.devicePixelRatio); 
  
  // --- MOBILE FIX: LOCK SCROLL ---
  // This stops the page from "bouncing" when you drag
  document.body.style.overflow = 'hidden'; 
  document.body.style.touchAction = 'none';

  // --- CONNECT TO DATABASE ---
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();

  // --- LISTEN FOR UPDATES ---
  db.collection("circles").orderBy("timestamp", "asc").onSnapshot((querySnapshot) => {
      let newCircles = [];
      querySnapshot.forEach((doc) => {
          let data = doc.data();
          let c = new Circle(data.x, data.y, data.imageString, data.name, data.tasks, doc.id);
          newCircles.push(c);
      });
      circles = newCircles;
  });

  // Setup Graphics
  glueLayer = createGraphics(worldWidth, height);
  glueLayer.pixelDensity(window.devicePixelRatio); 

  capture = createCapture(VIDEO);
  capture.size(250, 250);
  capture.hide();
  
  textFont('DM Sans');
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  glueLayer = createGraphics(worldWidth, height);
  glueLayer.pixelDensity(window.devicePixelRatio);
}

// --- MOBILE FIX: PREVENT DEFAULT SCROLLING ---
function touchMoved() {
  // If we are NOT in the camera, block default browser scrolling
  if (!showCamera) {
    return false;
  }
}

function draw() {
  background(BG_COLOR);

  // --- SCROLL LOGIC (UPDATED FOR MOBILE) ---
  if (mouseIsPressed && !showCamera && inputMode === "none" && !activeInput) {
    let draggingAny = circles.some(c => c.dragging);
    
    // If we aren't holding a circle, drag the world
    if (!draggingAny) {
        // use (mouseX - pmouseX) instead of movedX for better touch response
        let delta = mouseX - pmouseX;
        scrollX -= delta; 
    }
  }
  scrollX = constrain(scrollX, 0, worldWidth - width);

  // --- GLUE LAYER ---
  glueLayer.background(BG_COLOR);
  glueLayer.noStroke();
  glueLayer.fill(255);
  
  for (let c of circles) {
    c.applyBehaviors(circles);
    c.update();
    glueLayer.ellipse(c.pos.x, c.pos.y, c.r * 2.2);
  }
  
  glueLayer.filter(BLUR, 12);
  glueLayer.filter(THRESHOLD, 0.5);

  // --- RENDER WORLD ---
  push();
  translate(-scrollX, 0);
  
  for (let c of circles) {
    if (c.connections.length > 0) c.drawGlow();
  }

  tint(CREAM);
  image(glueLayer, 0, 0); 
  noTint();
  
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
  fill(CREAM); textSize(24); textStyle(BOLD);
  text("welcome to the live hub", 30, 30);
  textSize(12);
  let liveCount = circles.length + " people ";
  fill(CREAM); textStyle(BOLD); text(liveCount, 30, 64);
  let xOffset = textWidth(liveCount);
  fill(GREY_TEXT); textStyle(NORMAL); text("live right now", 30 + xOffset, 64);
  let totalTasks = circles.reduce((sum, c) => sum + int(c.tasks), 0) + " tasks ";
  fill(CREAM); textStyle(BOLD); text(totalTasks, 30, 82);
  let yOffset = textWidth(totalTasks);
  fill(GREY_TEXT); textStyle(NORMAL); text("completed today", 30 + yOffset, 82);
  pop();
}

function drawPlus() {
  push();
  fill(255); noStroke(); textAlign(CENTER, CENTER);
  textStyle(BOLD); textSize(50);
  text("+", width / 2, height / 2 - 5);
  pop();
}

function drawCameraInterface() {
  fill(29, 29, 29, 245); 
  rect(0, 0, width, height);
  let cx = width / 2 - 125, cy = height / 2 - 125;

  if (snapshot) {
      image(snapshot, cx, cy, 250, 250);
  } else {
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
    } else if (inputMode === "tasks") {
      textSize(20); text("how many tasks have you completed today?", width/2, cy - 40);
    }
  }
}

// --- NEW KEYBOARD LOGIC (WORKS ON MOBILE) ---
function createStyledInput(isNumber) {
  if (activeInput) activeInput.remove();
  
  activeInput = createInput('');
  if (isNumber) activeInput.attribute('type', 'number');
  
  // Style to match design
  activeInput.style('font-family', 'DM Sans');
  activeInput.style('background', 'transparent');
  activeInput.style('border', 'none');
  activeInput.style('border-bottom', '2px solid #93A4FF'); 
  activeInput.style('color', '#EFEDE9'); 
  activeInput.style('font-size', '32px');
  activeInput.style('text-align', 'center');
  activeInput.style('width', '200px');
  activeInput.style('outline', 'none');
  activeInput.style('z-index', '1000');
  
  // Fixed Position for Mobile
  activeInput.style('position', 'fixed');
  activeInput.style('left', '50%');
  activeInput.style('top', '65%'); 
  activeInput.style('transform', 'translate(-50%, -50%)');

  // Force Focus
  setTimeout(() => activeInput.elt.focus(), 10);
  
  activeInput.elt.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        handleInputSubmit();
    }
  });
}

function handleInputSubmit() {
  if (inputMode === "name") {
      let val = activeInput.value();
      if (val.length > 0) {
          userName = val;
          inputMode = "tasks";
          createStyledInput(true); // Switch to tasks (number keyboard)
      }
  } else if (inputMode === "tasks") {
      let val = activeInput.value();
      if (val.length > 0) {
          userTasks = val;
          uploadCircle();
      }
  }
}

function uploadCircle() {
  if (activeInput) {
      activeInput.remove();
      activeInput = null;
  }

  let imgString = snapshot.canvas.toDataURL('image/png');
  
  db.collection("circles").add({
      name: userName.toLowerCase(),
      tasks: int(userTasks),
      imageString: imgString,
      x: width / 2,
      y: height / 2,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });

  inputMode = "none"; showCamera = false; snapshot = null; userName = ""; userTasks = "";
}

class Circle {
  constructor(x, y, imgString, name, tasks, id) {
    let angle = random(TWO_PI);
    let distOut = random(100, 140); 
    if (x && y) this.pos = createVector(x, y);
    else this.pos = createVector(width/2 + scrollX + cos(angle) * distOut, height/2 + sin(angle) * distOut);
    
    this.r = 45;
    this.dragging = false;
    this.offset = random(100);
    this.id = id;

    this.displayName = name;
    this.tasks = tasks;
    this.connections = []; 

    this.img = createImage(90, 90);
    loadImage(imgString, (loadedImg) => {
        loadedImg.resize(90, 90);
        this.img = loadedImg;
        this.maskGfx = createGraphics(90, 90);
        this.maskGfx.ellipse(45, 45, 90, 90);
        this.img.mask(this.maskGfx);
    });
  }

  applyBehaviors(others) {
    if (this.dragging) return;

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
    
    let grad = drawingContext.createLinearGradient(-this.r, -this.r, this.r, this.r);
    grad.addColorStop(0, CREAM);
    grad.addColorStop(1, LILAC);
    drawingContext.fillStyle = grad;
    noStroke();
    ellipse(0, 0, this.r * 2);

    imageMode(CENTER);
    tint(200, 180, 220); 
    image(this.img, 0, 0, this.r * 1.8, this.r * 1.8);
    noTint();

    fill(147, 164, 255, 40); 
    ellipse(0, 0, this.r * 1.8);

    fill(CREAM);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(10); text(this.displayName, 0, -6);
    textSize(7); text(this.tasks + " tasks completed today", 0, 6);
    pop();
  }
}

function mousePressed() {
  if (activeInput) return; // Don't do anything if we are typing

  if (showCamera) {
    let cx = width / 2 - 125, cy = height / 2 - 125;
    if (mouseX < cx || mouseX > cx + 250 || mouseY < cy || mouseY > cy + 300) {
      showCamera = false; snapshot = null; return;
    }
    if (!snapshot) {
      let temp = capture.get();
      snapshot = createGraphics(250, 250);
      snapshot.push(); snapshot.translate(250, 0); snapshot.scale(-1, 1); snapshot.image(temp, 0, 0, 250, 250); snapshot.pop();
    } else {
      if (mouseX > width/2) {
         inputMode = "name";
         createStyledInput(false); // Enable Keyboard
      }
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
