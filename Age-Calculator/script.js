// ===== PARTICLES BACKGROUND =====
function createParticles() {
  const container = document.getElementById("particles");
  const colors = ["#6c5ce7", "#fd79a8", "#00cec9", "#a29bfe", "#ffeaa7"];

  for (let i = 0; i < 30; i++) {
    const particle = document.createElement("div");
    particle.classList.add("particle");
    const size = Math.random() * 6 + 2;
    particle.style.width = size + "px";
    particle.style.height = size + "px";
    particle.style.left = Math.random() * 100 + "%";
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
    particle.style.animationDuration = Math.random() * 15 + 10 + "s";
    particle.style.animationDelay = Math.random() * 10 + "s";
    container.appendChild(particle);
  }
}
createParticles();

// ===== ADD SVG GRADIENT (for the ring) =====
function addSVGGradient() {
  const svg = document.querySelector(".countdown-ring svg");
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
  gradient.setAttribute("id", "ringGradient");
  gradient.setAttribute("x1", "0%");
  gradient.setAttribute("y1", "0%");
  gradient.setAttribute("x2", "100%");
  gradient.setAttribute("y2", "100%");

  const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  stop1.setAttribute("offset", "0%");
  stop1.setAttribute("stop-color", "#6c5ce7");

  const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  stop2.setAttribute("offset", "50%");
  stop2.setAttribute("stop-color", "#fd79a8");

  const stop3 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  stop3.setAttribute("offset", "100%");
  stop3.setAttribute("stop-color", "#00cec9");

  gradient.appendChild(stop1);
  gradient.appendChild(stop2);
  gradient.appendChild(stop3);
  defs.appendChild(gradient);
  svg.insertBefore(defs, svg.firstChild);
}
addSVGGradient();

// ===== CONFETTI =====
function launchConfetti() {
  const canvas = document.getElementById("confettiCanvas");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const confettiPieces = [];
  const colors = ["#6c5ce7", "#fd79a8", "#00cec9", "#ffeaa7", "#ff7675", "#74b9ff", "#55efc4", "#fdcb6e"];

  for (let i = 0; i < 150; i++) {
    confettiPieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 10 + 5,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      speed: Math.random() * 4 + 2,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.2,
      drift: (Math.random() - 0.5) * 2,
      opacity: 1,
    });
  }

  let frame = 0;
  const maxFrames = 180;

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frame++;

    confettiPieces.forEach((p) => {
      p.y += p.speed;
      p.x += p.drift;
      p.angle += p.spin;
      if (frame > maxFrames - 60) {
        p.opacity -= 0.017;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.globalAlpha = Math.max(p.opacity, 0);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    if (frame < maxFrames) {
      requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  animate();
}

// ===== ANIMATED COUNTER =====
function animateCounter(element, target, duration = 1500, suffix = "") {
  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(eased * target);
    element.textContent = current.toLocaleString() + suffix;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = target.toLocaleString() + suffix;
    }
  }

  requestAnimationFrame(update);
}

// ===== MAIN CALCULATION =====
function calculateAge() {
  const input = document.getElementById("birthdate");
  const birthDate = new Date(input.value);
  const today = new Date();

  // Validate
  if (!input.value || birthDate >= today) {
    input.parentElement.classList.add("shake");
    setTimeout(() => input.parentElement.classList.remove("shake"), 500);
    return;
  }

  // Calculate age
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  let days = today.getDate() - birthDate.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  // Total days
  const totalMs = today - birthDate;
  const totalDays = Math.floor(totalMs / (1000 * 60 * 60 * 24));
  const totalHours = totalDays * 24;
  const heartbeats = totalDays * 100000; // ~100k/day
  const sleepDays = Math.floor(totalDays / 3); // ~8h/day

  // Next birthday
  let nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  if (nextBirthday <= today) {
    nextBirthday.setFullYear(today.getFullYear() + 1);
  }
  const daysUntilBirthday = Math.ceil((nextBirthday - today) / (1000 * 60 * 60 * 24));
  const turningAge = nextBirthday.getFullYear() - birthDate.getFullYear();

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Show results
  const results = document.getElementById("results");
  results.classList.add("show");

  // Scroll to results
  setTimeout(() => {
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 200);

  // Animate age cards
  const ageCards = document.querySelectorAll(".age-card");
  ageCards.forEach((card, i) => {
    card.classList.remove("animate");
    setTimeout(() => card.classList.add("animate"), 100 + i * 150);
  });

  // Animate age numbers
  setTimeout(() => animateCounter(document.getElementById("years"), years), 200);
  setTimeout(() => animateCounter(document.getElementById("months"), months), 350);
  setTimeout(() => animateCounter(document.getElementById("days"), days), 500);

  // Animate stat items
  const statItems = document.querySelectorAll(".stat-item");
  statItems.forEach((item, i) => {
    item.classList.remove("animate");
    setTimeout(() => item.classList.add("animate"), 600 + i * 100);
  });

  // Animate fun stats
  setTimeout(() => animateCounter(document.getElementById("totalDays"), totalDays), 700);
  setTimeout(() => animateCounter(document.getElementById("totalHours"), totalHours), 800);
  setTimeout(() => animateCounter(document.getElementById("heartbeats"), heartbeats), 900);
  setTimeout(() => animateCounter(document.getElementById("sleepDays"), sleepDays), 1000);

  // Birthday countdown
  setTimeout(() => animateCounter(document.getElementById("daysLeft"), daysUntilBirthday), 1100);

  document.getElementById("nextBirthdayDate").textContent =
    `${monthNames[nextBirthday.getMonth()]} ${nextBirthday.getDate()}, ${nextBirthday.getFullYear()}`;
  document.getElementById("turningAge").textContent = turningAge + " years old";
  document.getElementById("birthdayDay").textContent = dayNames[nextBirthday.getDay()];

  // Animate ring progress
  const ring = document.getElementById("ringProgress");
  const circumference = 2 * Math.PI * 90; // 565.48
  const daysInYear = 365;
  const progress = (daysInYear - daysUntilBirthday) / daysInYear;
  const offset = circumference - progress * circumference;

  setTimeout(() => {
    ring.style.strokeDashoffset = offset;
  }, 500);

  // 🎉 Launch confetti!
  setTimeout(launchConfetti, 400);
}

// Allow Enter key
document.getElementById("birthdate").addEventListener("keypress", function (e) {
  if (e.key === "Enter") calculateAge();
});