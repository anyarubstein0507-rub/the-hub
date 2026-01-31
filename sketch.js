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
let activeInput = null;

// Input States
let userName = ""; 
let userTasks = "";
let userWork = ""; // NEW: Stores the "Working on" answer
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
  
  // Mobile Scroll Lock
  document.body.style.overflow = 'hidden'; 
  document.body.style.touchAction = 'none';

  // Connect Database
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();

  // Listen for Updates
  db.collection("circles").orderBy("timestamp", "asc").onSnapshot((querySnapshot) => {
      let newCircles = [];
      querySnapshot.forEach((doc) => {
          let data = doc.data();
          // Retrieve 'work' from database
          let c = new Circle(data.x, data.y, data.imageString, data.name, data.tasks, data.work, doc.id);
          newCircles.push(c);
      });
      circles = newCircles;
  });

  // Graphics Setup
  glueLayer = createGraphics(worldWidth, height);
  glueLayer.pixelDensity(window.devicePixelRatio); 

  capture = createCapture(VIDEO);
  capture.size(250, 250);
  capture.hide();
  
  // USE YOUR ADOBE FONT HERE
  textFont('basic-sans');
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  glueLayer = createGraphics(worldWidth, height);
  glueLayer.pixelDensity(window.devicePixelRatio);
}

function touchMoved() {
  if (!showCamera) return false;
}

function draw() {
  background(BG_COLOR);

  // Scroll Logic
  if (mouseIsPressed && !showCamera && inputMode === "none" && !activeInput) {
    let draggingAny = circles.some(c => c.dragging);
    if (!draggingAny) {
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
  
  // Draw Glows
  for (let c of circles) {
    if (c.connections.length > 0) c.drawGlow();
  }

  // Draw Glue
  tint(CREAM);
  image(glueLayer, 0, 0); 
  noTint();
  
  // Draw Faces
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
    // --- UPDATED INPUT PROMPTS ---
    if (inputMode === "name") {
      textSize(20); text("type your name & press enter", width/2, cy - 40);
    } else if (inputMode === "tasks") {
      textSize(20); text("how many tasks have you completed today?", width/2, cy - 40);
    } else if (inputMode === "work") {
      textSize(20); text("what are you working on now?", width/2, cy - 40);
    }
  }
}

// --- KEYBOARD & INPUT LOGIC ---
function createStyledInput(isNumber) {
  if (activeInput) activeInput.remove();
  
  activeInput = createInput('');
  if (isNumber) activeInput.attribute('type', 'number');
  
  activeInput.style('font-family', 'basic-sans'); 
  activeInput.style('font-weight', '700'); 
  activeInput.style('background', 'transparent');
  activeInput.style('border', 'none');
  activeInput.style('border-bottom', '2px solid #93A4FF'); 
  activeInput.style('color', '#EFEDE9'); 
  activeInput.style('font-size', '32px');
  activeInput.style('text-align', 'center');
  activeInput.style('width', '300px'); 
  activeInput.style('outline', 'none');
  activeInput.style('z-index', '1000');
  
  activeInput.style('position', 'fixed');
  activeInput.style('left', '50%');
  activeInput.style('top', '65%'); 
  activeInput.style('transform', 'translate(-50%, -50%)');

  setTimeout(() => activeInput.elt.focus(), 10);
  
  activeInput.elt.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        handleInputSubmit();
    }
  });
}

function handleInputSubmit() {
  let val = activeInput.value();
  
  if (inputMode === "name") {
      if (val.length > 0) {
          userName = val;
          inputMode = "tasks";
          createStyledInput(true); // Number input
      }
  } 
  else if (inputMode === "tasks") {
      if (val.length > 0) {
          userTasks = val;
          inputMode = "work"; // NEW STEP
          createStyledInput(false); // Text input again
      }
  }
  else if (inputMode === "work") {
      if (val.length > 0) {
          userWork = val;
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
      work: userWork.toLowerCase(), // Save the new answer
      imageString: imgString,
      x: width / 2,
      y: height / 2 - 150, // Spawn high above the + button
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });

  inputMode = "none"; showCamera = false; snapshot = null; 
  userName = ""; userTasks = ""; userWork = "";
}

class Circle {
  constructor(x, y, imgString, name, tasks, work, id) {
    let angle = random(TWO_PI);
    let distOut = random(150, 400); 
    
    // Position
    if (x && y) this.pos = createVector(x, y);
    else this.pos = createVector(width/2 + scrollX + cos(angle) * distOut, height/2 + sin(angle) * distOut);
    
    this.r = 45;
    this.dragging = false;
    this.offset = random(100);
    this.id = id;

    this.displayName = name;
    this.tasks = tasks;
    this.displayWork = work || "working"; 
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

    // --- 1. AVOID THE PLUS BUTTON ---
    let worldCenter = createVector(width/2 + scrollX, height/2);
    let distToCenter = dist(this.pos.x, this.pos.y, worldCenter.x, worldCenter.y);
    
    // Strong repulsion if too close to center
    if (distToCenter < 140) { 
       let push = p5.Vector.sub(this.pos, worldCenter).normalize().mult(4);
       this.pos.add(push);
    }

    // --- 2. INTERACT WITH OTHERS ---
    for (let other of others) {
      if (other === this) continue;
      
      let d = dist(this.pos.x, this.pos.y, other.pos.x, other.pos.y);
      let minDistance = this.r * 2 + 10; // 90px + padding

      // A. SEPARATION (Don't overlap)
      if (d < minDistance) {
          let push = p5.Vector.sub(this.pos, other.pos).normalize().mult(1.5);
          this.pos.add(push);
      }

      // B. STICKY LOGIC (Only connect if dragged close)
      if ((this.dragging || other.dragging) && d < minDistance + 10) {
          if (!this.connections.includes(other)) {
              this.connections.push(other);
              other.connections.push(this);
          }
      }

      // C. CONNECTION PHYSICS
      if (this.connections.includes(other)) {
          let targetDist = this.r * 2.1; 
          let force = (d - targetDist) * 0.05; 
          let diff = p5.Vector.sub(other.pos, this.pos);
          diff.normalize().mult(force);
          this.pos.add(diff);
          
          if (d > this.r * 5) {
             this.connections = this.connections.filter(c => c !== other);
          }
      }
    }
  }

  update() {
    if (this.dragging) this.pos.set(mouseX + scrollX, mouseY);
    else {
        // Gentle Floating
        this.pos.y += sin(frameCount * 0.02 + this.offset) * 0.1;
        this.pos.x += cos(frameCount * 0.01 + this.offset) * 0.1;
    }
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
    
    // Border
    let grad = drawingContext.createLinearGradient(-this.r, -this.r, this.r, this.r);
    grad.addColorStop(0, CREAM);
    grad.addColorStop(1, LILAC);
    drawingContext.fillStyle = grad;
    noStroke();
    ellipse(0, 0, this.r * 2);

    // Photo
    imageMode(CENTER);
    tint(200, 180, 220); 
    image(this.img, 0, 0, this.r * 1.8, this.r * 1.8);
    noTint();

    // Wash
    fill(147, 164, 255, 40); 
    ellipse(0, 0, this.r * 1.8);

    // Text
    fill(CREAM);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    
    // NAME
    textSize(10); 
    text(this.displayName, 0, -6);
    
    // WORK (Replaces tasks count)
    textSize(8); 
    // Truncate if too long so it fits in circle
    let displayStr = this.displayWork.length > 15 ? this.displayWork.substring(0, 15) + "..." : this.displayWork;
    text(displayStr, 0, 6);
    
    pop();
  }
}

function mousePressed() {
  if (activeInput) return; 

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
         createStyledInput(false); 
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
