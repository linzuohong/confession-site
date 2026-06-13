// ============================================================
// fx.js · 情绪节点场（P16）
// 全屏 canvas 星座：节点漂移 + 邻近连线 + 温和呼吸
// 性能：节点≤60、DPR≤1.5、离屏停 rAF、reduced-motion 尊重
// ============================================================

(function () {
  'use strict';

  const canvas = document.getElementById('moodField');
  if (!canvas) return;

  // 尊重 reduced-motion
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    canvas.style.display = 'none';
    return;
  }

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  let W, H;
  let nodes = [];
  let raf = null;
  let visible = true;

  // ---------- 旋钮 ----------
  const N = 50;                  // 节点数
  const CONNECT_DIST = 140;      // 连线距离
  const BASE_SPEED = 0.12;       // 基础漂移速度
  const NODE_ALPHA = 0.25;       // 节点透明度
  const LINE_ALPHA_BASE = 0.04;  // 连线基础透明度

  function resize() {
    W = innerWidth;
    H = innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }
  resize();

  // 初始化节点
  function spawnNodes() {
    nodes = Array.from({ length: N }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * BASE_SPEED,
      vy: (Math.random() - 0.5) * BASE_SPEED,
      r: Math.random() * 1.4 + 0.5,
    }));
  }
  spawnNodes();

  // 重 spawn
  window.addEventListener('resize', () => {
    resize();
    spawnNodes();
  });

  function draw(/* t */) {
    ctx.clearRect(0, 0, W, H);

    // 更新节点
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      // 边界回绕
      if (n.x < -20) n.x = W + 20;
      if (n.x > W + 20) n.x = -20;
      if (n.y < -20) n.y = H + 20;
      if (n.y > H + 20) n.y = -20;
    }

    // 画连线（只连邻近）
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECT_DIST) {
          const alpha = LINE_ALPHA_BASE * (1 - dist / CONNECT_DIST);
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.strokeStyle = `rgba(217,52,28,${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    // 画节点
    for (const n of nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(217,52,28,${NODE_ALPHA})`;
      ctx.fill();
    }

    if (visible) {
      raf = requestAnimationFrame(draw);
    }
  }

  // 可见性控制
  function onVisibility() {
    visible = !document.hidden;
    if (visible && !raf) {
      raf = requestAnimationFrame(draw);
    } else if (!visible && raf) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  }
  document.addEventListener('visibilitychange', onVisibility);

  // 启动
  raf = requestAnimationFrame(draw);
})();
