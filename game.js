(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const startOverlay = document.getElementById('start');
  const finishOverlay = document.getElementById('finish');
  const countdownEl = document.getElementById('countdown');

  let W = 0, H = 0, DPR = 1;
  let state = 'menu';
  let keys = {};
  let last = 0;
  let raceTime = 0;
  let distance = 0;
  let playerX = 0;
  let playerSpeed = 0;
  let botProgress = 0;
  let slowTimer = 0;
  let traffic = [];
  let scenery = [];
  let particles = [];
  let people = [];
  let rain = [];

  const RACE_MILES = 3.2;
  const RACE_UNITS = RACE_MILES * 160;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth;
    H = innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function reset() {
    distance = 0;
    botProgress = 0;
    playerX = 0;
    playerSpeed = 0;
    raceTime = 0;
    slowTimer = 0;
    traffic = [];
    particles = [];

    for (let i = 0; i < 15; i++) {
      traffic.push(makeTraffic(i * 80 + 450));
    }

    scenery = [];
    for (let i = -2; i < 18; i++) {
      scenery.push({ z: i * 10, side: -1, seed: i * 7 + 3 });
      scenery.push({ z: i * 10, side: 1, seed: i * 7 + 9 });
    }

    people = [];
    for (let i = 0; i < 24; i++) {
      people.push({
        z: (i * 39 + 20) % 170,
        side: i % 2 ? -1 : 1,
        lane: (i * 37) % 100,
        color: ['#ef745e','#75b9de','#eadb78','#a68bd1','#78ba92'][i % 5],
        walk: i % 4 === 0,
        cheer: i % 7 === 0,
        phase: i * 1.7
      });
    }

    rain = [];
    for (let i = 0; i < 100; i++) {
      rain.push({ x: Math.random() * W, y: Math.random() * H, s: 4 + Math.random() * 8 });
    }
  }

  function makeTraffic(z) {
    const lane = [-1, 0, 1][Math.floor(Math.random() * 3)] + (Math.random() - .5) * .12;
    const colors = ['#e9edf2','#f15d45','#2685c7','#f3bd35','#9b5de5','#263044'];
    return { z, lane, speed: 16 + Math.random() * 25, color: colors[Math.floor(Math.random() * colors.length)], sway: Math.random() * 6.28 };
  }

  function startCountdown() {
    reset();
    state = 'countdown';
    startOverlay.classList.add('hidden');
    finishOverlay.classList.add('hidden');
    let n = 3;
    countdownEl.textContent = n;
    countdownEl.classList.add('show');
    const timer = setInterval(() => {
      n--;
      if (n > 0) countdownEl.textContent = n;
      else if (n === 0) countdownEl.textContent = 'GO!';
      else {
        clearInterval(timer);
        countdownEl.classList.remove('show');
        state = 'race';
      }
    }, 700);
  }

  function roadProjection(z) {
    const t = 1 - z / 170;
    const eased = t * t;
    return { y: H * .43 + eased * H * .72, scale: .12 + eased * 1.28 };
  }

  function roadEdges(y) {
    const horizon = H * .43;
    const t = (y - horizon) / (H - horizon);
    const half = W * (.055 + t * .42);
    return { left: W / 2 - half, right: W / 2 + half };
  }

  function worldToScreen(lane, z) {
    const p = roadProjection(z);
    const r = roadEdges(p.y);
    return { x: W / 2 + lane * (r.right - r.left) * .28, y: p.y, scale: p.scale };
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H * .55);
    g.addColorStop(0, '#0a1730');
    g.addColorStop(.58, '#355b75');
    g.addColorStop(1, '#d79267');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255, 222, 169, .25)';
    ctx.beginPath(); ctx.arc(W * .72, H * .18, 34, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#18212d';
    const horizon = H * .43;
    for (let i = 0; i < 22; i++) {
      const bw = 28 + (i * 17 % 55);
      const bh = 38 + (i * 29 % 105);
      const x = i * (W / 20) - 20;
      ctx.fillRect(x, horizon - bh, bw, bh);
      ctx.fillStyle = i % 3 === 0 ? '#d1a65d' : '#73879a';
      for (let wy = horizon - bh + 10; wy < horizon - 8; wy += 14) {
        for (let wx = x + 7; wx < x + bw - 5; wx += 13) {
          if ((wx + wy + i) % 5 > 1) ctx.fillRect(wx, wy, 4, 6);
        }
      }
      ctx.fillStyle = '#18212d';
    }

    ctx.fillStyle = '#252c35';
    ctx.fillRect(W * .48, horizon - 95, 3, 95);
    ctx.fillRect(W * .70, horizon - 78, 3, 78);
  }

  function drawRoad() {
    const horizon = H * .43;
    ctx.beginPath();
    ctx.moveTo(W * .45, horizon);
    ctx.lineTo(W * .55, horizon);
    ctx.lineTo(W * .96, H);
    ctx.lineTo(W * .04, H);
    ctx.closePath();
    ctx.fillStyle = '#25272e';
    ctx.fill();

    ctx.save();
    ctx.globalAlpha = .22;
    for (let i = 0; i < 18; i++) {
      const z = ((i * 12 - distance * .8) % 180 + 180) % 180;
      const p = roadProjection(z);
      ctx.fillStyle = i % 2 ? '#3a3d42' : '#292c32';
      ctx.beginPath(); ctx.ellipse(W/2, p.y, p.scale * 160, p.scale * 2, 0, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();

    // lane markings
    ctx.fillStyle = '#e9dfb1';
    for (let lane = -1; lane <= 1; lane += 2) {
      for (let z = 8; z < 170; z += 25) {
        let zz = (z - (distance * 1.2 % 25) + 175) % 175;
        const p = roadProjection(zz);
        const r = roadEdges(p.y);
        const x = W/2 + lane * (r.right-r.left) * .24;
        ctx.fillRect(x - p.scale * 3, p.y, p.scale * 6, p.scale * 20);
      }
    }

    // curbs
    ctx.fillStyle = '#cdd0ca';
    ctx.beginPath();
    ctx.moveTo(W*.45,horizon); ctx.lineTo(W*.455,horizon); ctx.lineTo(W*.04,H); ctx.lineTo(W*.04,H); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W*.55,horizon); ctx.lineTo(W*.545,horizon); ctx.lineTo(W*.96,H); ctx.lineTo(W*.96,H); ctx.fill();
  }

  function drawBuildings() {
    for (const b of [...scenery].sort((a,b) => b.z-a.z)) {
      let z = (b.z - distance * .7 % 180 + 180) % 180;
      if (z > 165) continue;
      const p = roadProjection(z);
      const r = roadEdges(p.y);
      const sideX = b.side < 0 ? r.left - p.scale * 115 : r.right + p.scale * 115;
      const bw = 55 + (b.seed % 4) * 16;
      const bh = 150 * p.scale;
      const width = bw * p.scale;

      ctx.fillStyle = b.seed % 3 === 0 ? '#8a8d7f' : b.seed % 3 === 1 ? '#655e55' : '#7a6c60';
      ctx.fillRect(sideX - (b.side > 0 ? 0 : width), p.y - bh, width, bh);

      ctx.fillStyle = '#20293a';
      for (let row = p.y - bh + 18*p.scale; row < p.y - 8*p.scale; row += 23*p.scale) {
        for (let col = sideX - (b.side > 0 ? 0 : width) + 8*p.scale; col < sideX + (b.side > 0 ? width : 0) - 8*p.scale; col += 20*p.scale) {
          if (((col + row + b.seed) | 0) % 3 !== 0) ctx.fillRect(col,row,10*p.scale,12*p.scale);
        }
      }

      if (z > 65 && z < 150) {
        const signY = p.y - bh*.42;
        ctx.fillStyle = b.seed % 2 ? '#f4b942' : '#9ed3ce';
        ctx.fillRect(sideX - (b.side > 0 ? 0 : width), signY, width, 13*p.scale);
      }

      // awning
      ctx.fillStyle = b.seed % 2 ? '#9b3036' : '#315b74';
      ctx.beginPath();
      const doorX = sideX - (b.side > 0 ? 0 : width);
      ctx.moveTo(doorX,p.y-bh*.18); ctx.lineTo(doorX+width,p.y-bh*.18); ctx.lineTo(doorX+width,p.y-bh*.08); ctx.lineTo(doorX,p.y-bh*.10); ctx.fill();
    }
  }

  function drawPerson(person) {
    let z = (person.z - distance * .62 + 170) % 170;
    if (z < 8 || z > 160) return;
    const p = roadProjection(z);
    const r = roadEdges(p.y);
    const curb = r.left - p.scale * 30;
    const rightCurb = r.right + p.scale * 30;
    let x = person.side < 0 ? curb - person.lane * p.scale * .15 : rightCurb + person.lane * p.scale * .15;

    if (person.walk) x += Math.sin(raceTime * 2 + person.phase) * 10 * p.scale;
    const s = p.scale;

    ctx.save();
    ctx.translate(x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(0, 3*s, 8*s, 3*s, 0, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#d09b72';
    ctx.beginPath(); ctx.arc(0,-24*s,5*s,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = person.color;
    ctx.fillRect(-7*s,-19*s,14*s,16*s);
    ctx.fillStyle = '#283040';
    ctx.fillRect(-6*s,-3*s,5*s,14*s); ctx.fillRect(1*s,-3*s,5*s,14*s);

    if (person.cheer) {
      ctx.strokeStyle = '#d09b72'; ctx.lineWidth = 3*s;
      ctx.beginPath(); ctx.moveTo(-7*s,-16*s); ctx.lineTo(-13*s,-25*s); ctx.moveTo(7*s,-16*s); ctx.lineTo(13*s,-25*s); ctx.stroke();
    }
    ctx.restore();
  }

  function drawTrafficCar(car) {
    let z = (car.z - distance * (1.0 + car.speed/100) + 180) % 180;
    car.z = z;
    if (z < 12) car.z = 170;
    if (z > 168) return;
    const s = worldToScreen(car.lane, z);
    const w = 44 * s.scale;
    const h = 70 * s.scale;

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.fillStyle = 'rgba(0,0,0,.38)';
    ctx.beginPath(); ctx.ellipse(0,5*s.scale,w*.65,h*.12,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.moveTo(-w*.38,-h*.65); ctx.quadraticCurveTo(-w*.48,-h*.32,-w*.42,h*.38);
    ctx.quadraticCurveTo(0,h*.55,w*.42,h*.38); ctx.quadraticCurveTo(w*.48,-h*.32,w*.38,-h*.65);
    ctx.quadraticCurveTo(0,-h*.82,-w*.38,-h*.65); ctx.fill();
    ctx.fillStyle = '#1b2735';
    ctx.beginPath(); ctx.moveTo(-w*.29,-h*.42); ctx.lineTo(w*.29,-h*.42); ctx.lineTo(w*.24,-h*.12); ctx.lineTo(-w*.24,-h*.12); ctx.fill();
    ctx.fillStyle = '#ff5d55'; ctx.fillRect(-w*.31,h*.25,w*.16,h*.1); ctx.fillRect(w*.15,h*.25,w*.16,h*.1);
    ctx.restore();

    if (state === 'race') {
      const playerS = worldToScreen(playerX, 18);
      const dx = s.x - playerS.x;
      const dy = s.y - playerS.y;
      if (z > 8 && z < 30 && Math.abs(dx) < w*.72 && Math.abs(dy) < h*.68) {
        if (slowTimer <= 0) {
          slowTimer = 1.5;
          playerSpeed *= .45;
          particles.push({x:s.x,y:s.y,life:1});
        }
        car.z = 155;
        car.lane = [-1.2,1.2][Math.floor(Math.random()*2)];
      }
    }
  }

  function drawPlayer() {
    const s = worldToScreen(playerX, 18);
    const w = 76 * s.scale;
    const h = 118 * s.scale;

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.beginPath(); ctx.ellipse(0, h*.42,w*.7,h*.12,0,0,Math.PI*2); ctx.fill();

    ctx.fillStyle = '#f4f6fa';
    ctx.beginPath();
    ctx.moveTo(-w*.36,-h*.55); ctx.quadraticCurveTo(-w*.48,-h*.22,-w*.43,h*.38);
    ctx.quadraticCurveTo(-w*.18,h*.62,w*.43,h*.38); ctx.quadraticCurveTo(w*.48,-h*.22,w*.36,-h*.55);
    ctx.quadraticCurveTo(0,-h*.75,-w*.36,-h*.55); ctx.fill();

    ctx.fillStyle = '#111827';
    ctx.beginPath(); ctx.moveTo(-w*.30,-h*.38); ctx.lineTo(w*.30,-h*.38); ctx.lineTo(w*.25,-h*.07); ctx.lineTo(-w*.25,-h*.07); ctx.fill();
    ctx.fillStyle = '#f3bd35'; ctx.fillRect(-w*.28,h*.30,w*.18,h*.08); ctx.fillRect(w*.10,h*.30,w*.18,h*.08);

    ctx.fillStyle = '#e33838';
    ctx.fillRect(-w*.08,-h*.62,w*.16,h*.18);

    ctx.restore();

    if (slowTimer > 0) {
      ctx.strokeStyle = `rgba(255,75,75,${slowTimer/.18})`;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(s.x,s.y-h*.2,70,0,Math.PI*2); ctx.stroke();
    }
  }

  function drawBot() {
    let botOffset = botProgress - distance;
    let z = 95 - botOffset * 30;
    z = Math.max(22, Math.min(145, z));
    const botLane = Math.sin(botProgress * 1.7) * .55;
    const s = worldToScreen(botLane, z);
    const w = 55*s.scale, h = 86*s.scale;
    ctx.save(); ctx.translate(s.x,s.y);
    ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.beginPath(); ctx.ellipse(0,h*.38,w*.65,h*.1,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ed3d62';
    ctx.beginPath(); ctx.moveTo(-w*.38,-h*.5); ctx.quadraticCurveTo(-w*.48,h*.35,0,h*.5); ctx.quadraticCurveTo(w*.48,h*.35,w*.38,-h*.5); ctx.quadraticCurveTo(0,-h*.65,-w*.38,-h*.5); ctx.fill();
    ctx.fillStyle = '#1b2735'; ctx.fillRect(-w*.26,-h*.35,w*.52,h*.22);
    ctx.fillStyle = '#80e6ff'; ctx.fillRect(-w*.08,-h*.58,w*.16,h*.12);
    ctx.restore();

    ctx.save(); ctx.translate(s.x,s.y-h*s.scale*1.1);
    ctx.fillStyle = 'rgba(5,10,20,.82)'; ctx.fillRect(-25,-12,50,24);
    ctx.fillStyle = '#ffcf32'; ctx.font = 'bold 11px Arial'; ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('RIVAL',0,1);
    ctx.restore();
  }

  function drawRain() {
    ctx.strokeStyle = 'rgba(185,214,235,.18)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const drop of rain) {
      drop.y += drop.s;
      drop.x -= drop.s * .35;
      if (drop.y > H) { drop.y = -10; drop.x = Math.random()*W; }
      if (drop.x < 0) drop.x = W;
      ctx.moveTo(drop.x,drop.y); ctx.lineTo(drop.x-drop.s*.28,drop.y+drop.s);
    }
    ctx.stroke();
  }

  function update(dt) {
    if (state !== 'race') return;
    raceTime += dt;

    const accel = keys.ArrowUp || keys.KeyW ? 35 : 0;
    const brake = keys.ArrowDown || keys.KeyS ? 30 : 10;
    playerSpeed += accel * dt;
    playerSpeed -= brake * dt;

    if (slowTimer > 0) {
      slowTimer -= dt;
      playerSpeed -= 18 * dt;
    }

    playerSpeed = Math.max(0, Math.min(170, playerSpeed));

    if (keys.ArrowLeft || keys.KeyA) playerX -= dt * (1.25 + playerSpeed/170*.25);
    if (keys.ArrowRight || keys.KeyD) playerX += dt * (1.25 + playerSpeed/170*.25);
    playerX = Math.max(-1.45, Math.min(1.45, playerX));

    distance += playerSpeed * dt / 3600;

    const botBase = .96 + Math.sin(raceTime*.42)*.035;
    const catchup = Math.max(0, distance - botProgress) * .18;
    const botSpeed = 1.075 * botBase + catchup;
    botProgress += botSpeed * dt / 3600;

    for (const car of traffic) {
      car.z -= car.speed * dt * (.06 + playerSpeed/700);
      if (car.z < 2) {
        car.z = 175;
        car.lane = [-1,0,1][Math.floor(Math.random()*3)] + (Math.random()-.5)*.12;
        car.speed = 16+Math.random()*25;
      }
    }

    for (const p of particles) p.life -= dt;
    particles = particles.filter(p => p.life > 0);

    document.getElementById('speed').textContent = Math.round(playerSpeed);
    document.getElementById('distance').textContent = `${distance.toFixed(1)} mi`;

    const position = botProgress > distance ? '2 / 2' : '1 / 2';
    document.getElementById('position').textContent = position;

    if (distance >= RACE_MILES) finish(distance >= botProgress);
    if (botProgress >= RACE_MILES) finish(distance >= botProgress);
  }

  function finish(won) {
    state = 'finished';
    document.getElementById('finishLabel').textContent = won ? 'RACE COMPLETE' : 'RACE OVER';
    document.getElementById('finishTitle').textContent = won ? 'VICTORY' : 'DEFEAT';
    document.getElementById('finishStats').textContent = `${raceTime.toFixed(1)} seconds • ${Math.round(playerSpeed)} mph finish speed`;
    finishOverlay.classList.remove('hidden');
  }

  function render() {
    ctx.clearRect(0,0,W,H);
    drawSky();
    drawBuildings();
    drawRoad();

    const sortedPeople = [...people].sort((a,b) => b.z-a.z);
    for (const person of sortedPeople) drawPerson(person);

    const sortedTraffic = [...traffic].sort((a,b) => b.z-a.z);
    for (const car of sortedTraffic) drawTrafficCar(car);

    if (state === 'race' || state === 'finished') drawBot();
    drawPlayer();

    ctx.fillStyle = 'rgba(255,255,255,.04)';
    ctx.fillRect(0,H*.43,W,2);
    drawRain();

    for (const p of particles) {
      ctx.fillStyle = `rgba(255,225,100,${p.life})`;
      ctx.beginPath(); ctx.arc(p.x+(Math.random()-0.5)*30,p.y+(Math.random()-0.5)*30,Math.random()*8+3,0,Math.PI*2); ctx.fill();
    }
  }

  function loop(now) {
    const dt = Math.min(.033, (now-last)/1000 || 0);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventEventDefault?.();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  let touchStart = null;
  canvas.addEventListener('touchstart', e => { touchStart = e.touches[0].clientX; e.preventDefault(); }, {passive:false});
  canvas.addEventListener('touchmove', e => {
    if (!touchStart) return;
    const dx = e.touches[0].clientX-touchStart;
    playerX += dx*.004;
    touchStart=e.touches[0].clientX;
    keys.ArrowUp = true;
    e.preventDefault();
  }, {passive:false});
  canvas.addEventListener('touchend', () => { touchStart=null; keys.ArrowUp=false; });

  document.getElementById('startButton').addEventListener('click', startCountdown);
  document.getElementById('restartButton').addEventListener('click', startCountdown);

  resize();
  reset();
  requestAnimationFrame(loop);
})();
