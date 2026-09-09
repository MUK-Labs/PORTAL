/** A silent, procedural light-field inspired by the supplied event artwork. */
export function mountField(host, canvas, button) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let saved = null;
  try { saved = localStorage.getItem('prl:motion'); } catch { /* Storage can be disabled. */ }
  let running = saved == null ? !media.matches : saved === 'on';
  let visible = true, raf = 0, last = 0, phase = 1.4, width = 1, height = 1;
  const pointer = { x:0, y:0 }, target = { x:0, y:0 };
  const colors = ['194,235,170','112,191,255','255,87,104'];
  function draw() {
    context.clearRect(0, 0, width, height);
    const cx = width * .52, cy = height * .49, radius = Math.min(width * .42, height * .41);
    const lines = width < 450 ? 32 : 52, steps = 100;
    for (let j = 0; j < lines; j++) {
      const layer = j / lines, tilt = -.35 + pointer.x * .18;
      const alpha = .26 + .56 * Math.pow(Math.sin(layer * Math.PI), 2);
      context.strokeStyle = `rgba(${colors[Math.floor(j / 6) % 3]},${alpha})`;
      context.lineWidth = j % 8 === 0 ? 1.3 : .8;
      context.beginPath();
      for (let k = 0; k <= steps; k++) {
        const a = k / steps * Math.PI * 2;
        const ripple = 1 + .07 * Math.sin(a * 3 + phase + layer * 9) + .035 * Math.cos(a * 5 - phase * .4);
        const rx = radius * (.5 + layer * .53), ry = radius * (.17 + .51 * Math.sin(layer * Math.PI));
        const x = Math.cos(a) * rx * ripple, y = Math.sin(a) * ry * ripple;
        const xx = cx + x * Math.cos(tilt) - y * Math.sin(tilt) + Math.sin(layer * 7 + phase * .22) * 12;
        const yy = cy + x * Math.sin(tilt) + y * Math.cos(tilt) + (layer - .5) * radius * .8 + Math.sin(a * 2 + layer * 6 + phase) * (8 + pointer.y * 4);
        k === 0 ? context.moveTo(xx, yy) : context.lineTo(xx, yy);
      }
      context.closePath(); context.stroke();
    }
    context.strokeStyle = '#91aa9722'; context.lineWidth = .6;
    context.beginPath(); context.moveTo(cx - radius - 22, cy); context.lineTo(cx + radius + 22, cy); context.stroke();
    for (const x of [cx-radius-15,cx+radius+15]) { context.beginPath(); context.moveTo(x,cy-5);context.lineTo(x,cy+5);context.stroke(); }
  }
  function frame(time) {
    raf = 0;
    if (!running || !visible || document.hidden) return;
    if (time - last > 32) {
      phase += Math.min(time - last, 70) * .00036; last = time;
      pointer.x += (target.x - pointer.x) * .06; pointer.y += (target.y - pointer.y) * .06; draw();
    }
    raf = requestAnimationFrame(frame);
  }
  function sync() {
    if (raf) cancelAnimationFrame(raf); raf = 0;
    button.textContent = running ? 'Pause motion Ⅱ' : 'Enable motion ▷';
    button.setAttribute('aria-pressed', String(running));
    button.setAttribute('aria-label', running ? 'Pause generative graphics' : 'Enable generative graphics');
    draw(); if (running && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); }
    window.dispatchEvent(new CustomEvent('prl:motion', { detail: { running } }));
  }
  new ResizeObserver(() => {
    width = host.clientWidth; height = host.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
  }).observe(host);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold:.05 }).observe(host);
  host.addEventListener('pointermove', e => { const r=host.getBoundingClientRect(); target.x=(e.clientX-r.left)/r.width-.5; target.y=(e.clientY-r.top)/r.height-.5; });
  host.addEventListener('pointerleave', () => { target.x=0;target.y=0; });
  button.hidden = false;
  button.addEventListener('click', () => { running=!running; saved=running?'on':'off'; try { localStorage.setItem('prl:motion',saved); } catch {} sync(); });
  media.addEventListener('change', () => { if (saved == null) { running=!media.matches;sync(); } });
  document.addEventListener('visibilitychange',sync); sync();
}
