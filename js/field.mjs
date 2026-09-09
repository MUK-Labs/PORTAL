import { LocalMicrophone } from './microphone.mjs';
/** Full-bleed ribbon instrument: pointer, touch, pulses and optional local microphone. */
export function mountField(host, canvas, button) {
  const g = canvas.getContext('2d');
  if (!g) return;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let saved = null;
  try { saved = localStorage.getItem('prl:motion'); } catch { /* Storage can be disabled. */ }
  let running = saved == null ? !media.matches : saved === 'on';
  let visible = true, raf = 0, last = 0, phase = 2.2, w = 1, h = 1, energy = 0, remix = 0;
  const pointer = { x: .3, y: 0 }, target = { x: .3, y: 0 };
  const pulses = [], colors = ['194,235,170', '112,191,255', '255,87,104'];
  const micButton = host.querySelector('#microphone-toggle'), status = host.querySelector('#field-status'), meter = host.querySelector('#mic-meter');
  const mic = new LocalMicrophone(({ state, message }) => {
    host.dataset.microphone = state; status.textContent = message;
    micButton.textContent = state === 'requesting' ? 'Cancel microphone ×' : state === 'live' ? 'Disable microphone ●' : 'Enable microphone ○';
    micButton.setAttribute('aria-pressed', String(state === 'live'));
    if (state !== 'live') meter.style.transform = 'scaleX(0)';
  });
  host.dataset.fieldVersion = '2'; host.dataset.microphone = 'off';
  function draw(dt = 0) {
    const sound = mic.sample(); energy += (sound.level - energy) * .2;
    if (mic.state === 'live') meter.style.transform = `scaleX(${sound.level.toFixed(3)})`;
    g.clearRect(0, 0, w, h);
    const small = w < 760, cx = w * (small ? .53 : .65), cy = h * (small ? .57 : .45);
    const rx = w * (small ? .63 : .40), ry = h * (small ? .22 : .32);
    const twist = Math.sin(phase * .23 + remix) * .4 + pointer.x * .95;
    const tilt = -.25 + pointer.y * .30 + Math.sin(phase * .16) * .12;
    const layers = small ? 12 : 18, steps = small ? 116 : 160;
    for (const p of pulses) p.age += dt;
    while (pulses[0]?.age > 4) pulses.shift();
    g.globalCompositeOperation = 'lighter';
    for (let band = 0; band < 3; band++) {
      const color = colors[(band + remix) % 3];
      for (let j = 0; j < layers; j++) {
        const layer = j / (layers - 1), shift = (layer - .5) * .34 + band * .11;
        const gradient = g.createLinearGradient(0, 0, w, 0);
        const alpha = (.27 + Math.sin(layer * Math.PI) * .35) * (1 + energy * .5);
        gradient.addColorStop(0, `rgba(${color},.018)`); gradient.addColorStop(.32, `rgba(${color},${small ? .1 : .055})`);
        gradient.addColorStop(.58, `rgba(${color},${alpha})`); gradient.addColorStop(1, `rgba(${color},${alpha * .6})`);
        g.strokeStyle = gradient; g.lineWidth = j % 6 === 0 ? 1.5 : .85;
        g.beginPath();
        for (let i = 0; i <= steps; i++) {
          const a = i / steps * Math.PI * 2;
          const r = 1 + .13 * Math.sin(3 * a + phase * .7 + shift) + energy * .21 + sound.low * .08;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * (.74 + shift) + Math.sin(2 * a + phase * .35 + band * .32) * (.27 + energy * .18);
          const z = Math.sin(2 * a + phase * .22) * .52 + shift * Math.cos(a * 3 + phase * .3);
          const xx = x * Math.cos(twist) + z * Math.sin(twist);
          let px = cx + (xx * Math.cos(tilt) - y * Math.sin(tilt)) * rx;
          let py = cy + (xx * Math.sin(tilt) + y * Math.cos(tilt)) * ry + Math.sin(a * 7 + phase + shift * 8) * (2 + sound.high * 20);
          const dx = px - (pointer.x + 1) * w / 2, dy = py - (pointer.y + 1) * h / 2;
          const distance = Math.hypot(dx, dy), force = Math.exp(-distance * distance / (w * w * .023)) * 65;
          px += dx / (distance + 1) * force; py += dy / (distance + 1) * force;
          for (const p of pulses) {
            const pdx = px - p.x * w, pdy = py - p.y * h, d = Math.hypot(pdx, pdy);
            const wave = Math.exp(-Math.pow((d - p.age * w * .34) / 75, 2)) * Math.max(0, 1 - p.age / 4) * 58;
            px += pdx / (d + 1) * wave; py += pdy / (d + 1) * wave;
          }
          i ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.closePath(); g.stroke();
      }
    }
    g.globalCompositeOperation = 'source-over';
  }
  function frame(t) {
    raf = 0; if (!running || !visible || document.hidden) return;
    if (t - last >= 32) {
      const dt = Math.min(t - last, 80) / 1000; last = t;
      phase += dt * (.65 + energy * 1.15);
      pointer.x += (target.x - pointer.x) * .12; pointer.y += (target.y - pointer.y) * .12;
      draw(dt);
    }
    raf = requestAnimationFrame(frame);
  }
  function schedule() {
    cancelAnimationFrame(raf); raf = 0; draw();
    if (running && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function syncMotion() {
    button.textContent = running ? 'Pause motion Ⅱ' : 'Enable motion ▷';
    button.setAttribute('aria-pressed', String(running));
    button.setAttribute('aria-label', running ? 'Pause generative graphics' : 'Enable generative graphics');
    host.dataset.motion = running ? 'on' : 'off';
    micButton.disabled = !running || !mic.supported;
    if (!running) mic.stop('Motion paused · enable motion to use the microphone.');
    else if (mic.state === 'off') status.textContent = 'Move to bend · click or tap for a pulse. Microphone is off.';
    if (!mic.supported) status.textContent = 'Pointer mode ready. Microphone mode is unavailable in this browser.';
    schedule(); window.dispatchEvent(new CustomEvent('prl:motion', { detail: { running } }));
  }
  function pulse(x = .65, y = .46) {
    if (!running) { phase += .5; draw(); return; }
    if (pulses.length >= 6) pulses.shift(); pulses.push({ x, y, age: 0 });
  }
  new ResizeObserver(() => {
    w = host.clientWidth; h = host.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
  }).observe(host);
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible && mic.session) mic.stop('Microphone stopped because the field left the screen.');
    schedule();
  }, { threshold: .08 }).observe(host);
  host.parentElement.addEventListener('pointermove', e => {
    if (e.target.closest('button,a,input')) return;
    const r = host.getBoundingClientRect(); target.x = (e.clientX - r.left) / r.width * 2 - 1; target.y = (e.clientY - r.top) / r.height * 2 - 1;
  });
  host.parentElement.addEventListener('pointerleave', () => { target.x = .3; target.y = 0; });
  canvas.addEventListener('pointerdown', e => { const r = canvas.getBoundingClientRect(); pulse((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); });
  host.querySelector('#field-pulse').addEventListener('click', () => pulse());
  host.querySelector('#field-remix').addEventListener('click', () => { remix = (remix + 1) % 3; phase += 1.3; draw(); });
  micButton.addEventListener('click', () => { if (mic.session) mic.stop(); else if (running && visible) void mic.start(); });
  button.hidden = false;
  button.addEventListener('click', () => { running = !running; saved = running ? 'on' : 'off'; try { localStorage.setItem('prl:motion', saved); } catch {} syncMotion(); });
  media.addEventListener('change', () => { if (saved == null) { running = !media.matches; syncMotion(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mic.session) mic.stop('Microphone stopped when you left this tab.'); schedule(); });
  window.addEventListener('pagehide', () => { mic.stop(); cancelAnimationFrame(raf); });
  window.addEventListener('pageshow', schedule);
  syncMotion();
}
