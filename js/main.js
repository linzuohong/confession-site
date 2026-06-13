// ============================================================
// main.js · 引擎：揭示/滚动叙事/Gate/中文断行/声控
// 动效一律纯函数 f(progress)，不写积分器（L27）
// ============================================================

(function () {
  'use strict';

  const DATA = window.CONFESSION;
  if (!DATA) return;

  // ============================================================
  // 0. 中文断行系统（P37 · 词级三层壳）
  // ============================================================

  /** 判断是否支持 Intl.Segmenter（中文分词） */
  const hasSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function';

  /**
   * 分词：返回词数组。标点并入前词。
   * 兜底：逐字返回，标点同样并入前字。
   */
  function tokenize(text) {
    if (!text) return [];
    if (hasSegmenter) {
      const seg = new Intl.Segmenter('zh', { granularity: 'word' });
      const words = [];
      for (const { segment } of seg.segment(text)) {
        words.push(segment);
      }
      return words;
    }
    // 兜底：逐字，但标点符号并入前字
    const chars = [...text];
    const words = [];
    let buf = '';
    const PUNCT = /^[，。！？、；：""''（）《》【】…—\s·]$/;
    for (const ch of chars) {
      if (PUNCT.test(ch)) {
        buf += ch;
      } else {
        if (buf) words.push(buf);
        buf = ch;
      }
    }
    if (buf) words.push(buf);
    return words;
  }

  /**
   * 把词的文本节点替换为三层壳 DOM：
   * <span class="chcl">（子句，inline-block，整体换行优先）
   *   <span class="chgrp">（词组，inline-block nowrap，永不拆）
   *     <span class="ch">（单字，用于逐字动效）
   *
   * 断行优先级：标点后 > 词边界 > 永不词中断
   */
  function wrapWords(el) {
    const text = el.textContent || '';
    const words = tokenize(text);
    el.textContent = '';

    // 按标点分子句：遇到标点结尾的词 → 收口
    const PUNCT_END = /[，。！？、；：》」』）】"]$/;
    let clause = document.createElement('span');
    clause.className = 'chcl';
    clause.style.display = 'inline-block';
    clause.style.whiteSpace = 'normal';

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const grp = document.createElement('span');
      grp.className = 'chgrp';
      grp.style.display = 'inline-block';
      grp.style.whiteSpace = 'nowrap';

      // 每字一层，方便逐字动效
      for (const ch of w) {
        const span = document.createElement('span');
        span.className = 'ch';
        span.style.display = 'inline-block';
        span.textContent = ch;
        grp.appendChild(span);
      }

      clause.appendChild(grp);

      // 标点结尾 → 收口，开新子句
      if (PUNCT_END.test(w)) {
        el.appendChild(clause);
        clause = document.createElement('span');
        clause.className = 'chcl';
        clause.style.display = 'inline-block';
        clause.style.whiteSpace = 'normal';
      } else if (i < words.length - 1) {
        // 词间空格（子句内可断）
        clause.appendChild(document.createTextNode(' '));
      }
    }
    // 最后一个子句
    if (clause.childNodes.length > 0) {
      el.appendChild(clause);
    }
  }

  /** 对普通段落：词边界插 <wbr> + keep-all 禁词内断 */
  function cjkWbr(el) {
    if (hasSegmenter) {
      const seg = new Intl.Segmenter('zh', { granularity: 'word' });
      const text = el.textContent || '';
      const parts = [];
      let last = 0;
      for (const { index, segment } of seg.segment(text)) {
        if (index > last) {
          parts.push(document.createTextNode(text.slice(last, index)));
        }
        parts.push(document.createTextNode(segment));
        // 词后插 <wbr>
        const wbr = document.createElement('wbr');
        parts.push(wbr);
        last = index + segment.length;
      }
      if (last < text.length) {
        parts.push(document.createTextNode(text.slice(last)));
      }
      el.textContent = '';
      parts.forEach(p => el.appendChild(p));
    }
    el.style.wordBreak = 'keep-all';
    el.style.overflowWrap = 'break-word';
  }

  // ============================================================
  // 1. 开幕 Gate（P1 · 点击门 + BGM 同手势）
  // ============================================================

  const gate = document.getElementById('gate');
  const gateParticles = document.getElementById('gateParticles');
  let gateCtx = null;
  let gateRaf = null;
  let gatePts = [];
  let opened = false;

  /** Gate 阶段粒子动画：暖红微光 + 偶尔心形 */
  function initGateParticles() {
    if (!gateParticles) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      gateParticles.width = innerWidth * dpr;
      gateParticles.height = innerHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    gateCtx = gateParticles.getContext('2d');
    gateCtx.scale(dpr, dpr);

    const N = Math.min(Math.floor((innerWidth * innerHeight) / 16000), 85);
    gatePts = Array.from({ length: N }, (_, i) => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      r: Math.random() * 1.4 + 0.3,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      a: Math.random() * 0.28 + 0.12,
      phase: Math.random() * Math.PI * 2,
      isHeart: i < N * 0.06,  // ~6% 心形，克制
      heartPhase: Math.random() * Math.PI * 2,
    }));

    /** 画心形路径 */
    function heartPath(ctx, x, y, s) {
      ctx.beginPath();
      const topY = y - s * 0.35;
      ctx.moveTo(x, y + s * 0.35);
      ctx.bezierCurveTo(x, topY, x - s * 0.5, topY, x - s * 0.5, y + s * 0.15);
      ctx.bezierCurveTo(x - s * 0.5, y + s * 0.55, x, y + s * 0.75, x, y + s);
      ctx.bezierCurveTo(x, y + s * 0.75, x + s * 0.5, y + s * 0.55, x + s * 0.5, y + s * 0.15);
      ctx.bezierCurveTo(x + s * 0.5, topY, x, topY, x, y + s * 0.35);
      ctx.closePath();
    }

    function draw() {
      if (opened) return;
      gateCtx.clearRect(0, 0, innerWidth, innerHeight);
      const t = performance.now() * 0.001;
      for (const p of gatePts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = innerWidth + 20;
        if (p.x > innerWidth + 20) p.x = -20;
        if (p.y < -20) p.y = innerHeight + 20;
        if (p.y > innerHeight + 20) p.y = -20;

        const alpha = p.a + Math.sin(t * 1.5 + p.phase) * 0.1;

        if (p.isHeart && Math.sin(t * 0.7 + p.heartPhase) > 0.5) {
          // 偶尔闪现心形
          const hs = p.r * 3.5;
          heartPath(gateCtx, p.x, p.y, hs);
          gateCtx.fillStyle = `rgba(217,52,28,${Math.max(0, alpha * 0.7)})`;
          gateCtx.fill();
        } else {
          // 默认圆点
          gateCtx.beginPath();
          gateCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          gateCtx.fillStyle = `rgba(217,52,28,${Math.max(0, alpha)})`;
          gateCtx.fill();
        }
      }
      gateRaf = requestAnimationFrame(draw);
    }
    draw();
  }

  /** 点击 gate → 起 BGM + 开滚动 */
  function openGate() {
    if (opened) return;
    opened = true;

    // 停止 gate 粒子
    if (gateRaf) cancelAnimationFrame(gateRaf);

    // 淡出 gate
    gate.classList.add('fade-out');

    // 同手势起 BGM
    playBgm();

    // 解锁滚动
    setTimeout(() => {
      document.documentElement.classList.remove('lock-scroll');
      gate.style.display = 'none';
      if (gateParticles) gateParticles.style.display = 'none';
    }, 800);
  }

  gate.addEventListener('click', openGate);
  // 触屏也能点
  gate.addEventListener('touchend', (e) => {
    e.preventDefault();
    openGate();
  });

  initGateParticles();

  // ============================================================
  // 2. BGM 控制（L7 · 绑首次点击手势）
  // ============================================================

  let bgm = null;
  let bgmPlaying = false;

  function initBgm() {
    bgm = new Audio();
    // 用静默 mp3 占位（用户替换成真正 BGM）
    bgm.src = 'audio/bgm.mp3';
    bgm.loop = true;
    bgm.volume = 0;
    bgm.preload = 'auto';
    // 加载失败静默降级（用户可替换为真正 BGM）
  }

  function playBgm() {
    if (!bgm) initBgm();
    if (!bgm || bgmPlaying) return;
    const p = bgm.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        bgmPlaying = true;
        // 渐入
        let vol = 0;
        const target = 0.35;
        const step = () => {
          vol = Math.min(vol + 0.008, target);
          bgm.volume = vol;
          if (vol < target) requestAnimationFrame(step);
        };
        step();
        updateSoundIcon();
      }).catch(() => {
        // 浏览器拦截，静默
      });
    }
  }

  function toggleBgm() {
    if (!bgm) { playBgm(); return; }
    if (bgmPlaying) {
      bgm.pause();
      bgmPlaying = false;
    } else {
      const p = bgm.play();
      if (p && typeof p.then === 'function') {
        p.then(() => { bgmPlaying = true; }).catch(() => {});
      }
    }
    updateSoundIcon();
  }

  const soundBtn = document.getElementById('sound');
  function updateSoundIcon() {
    if (soundBtn) {
      soundBtn.textContent = bgmPlaying ? '♪' : '♪';
      soundBtn.style.opacity = bgmPlaying ? '1' : '0.45';
    }
  }
  if (soundBtn) {
    soundBtn.addEventListener('click', toggleBgm);
  }

  // ============================================================
  // 3. 叙事揭示引擎（P6/P7 · 分段慢揭示 + ST 触发）
  // ============================================================

  /** 检查元素是否进入视口 */
  function isInView(el, threshold = 0.72) {
    const rect = el.getBoundingClientRect();
    return rect.top < innerHeight * threshold && rect.bottom > 0;
  }

  /** 逐行揭示带 stagger */
  function revealLines(container, baseDelay = 0) {
    const lines = container.querySelectorAll('.scene__line');
    lines.forEach((line, i) => {
      setTimeout(() => {
        line.classList.add('on');
      }, baseDelay + i * 380);
    });
  }

  /** 揭示章节号 */
  function revealChapter(scene) {
    const chap = scene.querySelector('.scene__chapter');
    if (chap) chap.classList.add('on');
  }

  /** 揭示分隔线 */
  function revealDivider(divider) {
    if (divider) divider.classList.add('on');
  }

  // Scene reveal tracking
  const scenes = document.querySelectorAll('.scene');
  const dividers = document.querySelectorAll('.divider');
  const sceneRevealed = new Set();
  const dividerRevealed = new Set();

  function checkReveals() {
    // 揭示分隔线
    dividers.forEach((d) => {
      if (!dividerRevealed.has(d) && isInView(d, 0.82)) {
        dividerRevealed.add(d);
        revealDivider(d);
      }
    });

    // 揭示场景
    scenes.forEach((scene) => {
      if (!sceneRevealed.has(scene) && isInView(scene, 0.78)) {
        sceneRevealed.add(scene);
        revealChapter(scene);
        const container = scene.querySelector('.scene__lines');
        if (container) revealLines(container, 200);
      }
    });
  }

  // ============================================================
  // 4.5 静默段揭示
  // ============================================================

  const silence = document.querySelector('.silence');
  const silenceRevealed = { done: false };

  function checkSilence() {
    if (silenceRevealed.done) return;
    if (!silence) return;
    if (isInView(silence, 0.72)) {
      silenceRevealed.done = true;
      const dots = silence.querySelector('.silence__dots');
      if (dots) {
        setTimeout(() => {
          dots.classList.add('on');
        }, 600);  // 进视口后延迟 600ms，让人先意识到空白
      }
    }
  }

  // ============================================================
  // 5. 终幕揭示
  // ============================================================

  const finale = document.getElementById('finale');
  const finaleRevealed = { done: false };

  function checkFinale() {
    if (finaleRevealed.done) return;
    if (!finale) return;
    if (isInView(finale, 0.8)) {
      finaleRevealed.done = true;
      const title = finale.querySelector('.finale__title');
      const sub = finale.querySelector('.finale__sub');
      if (title) {
        title.style.opacity = '0';
        title.style.transform = 'translateY(20px)';
        title.style.transition = 'opacity 0.8s var(--ease-out), transform 0.8s var(--ease-out)';
        setTimeout(() => {
          title.style.opacity = '1';
          title.style.transform = 'translateY(0)';
        }, 100);
      }
      if (sub) {
        sub.style.opacity = '0';
        sub.style.transform = 'translateY(12px)';
        sub.style.transition = 'opacity 0.8s var(--ease-out) 0.35s, transform 0.8s var(--ease-out) 0.35s';
        setTimeout(() => {
          sub.style.opacity = '1';
          sub.style.transform = 'translateY(0)';
        }, 450);
      }
    }
  }

  // ============================================================
  // 4.5 英雄大字入场动效（P25 改编：蓄能暖光 → 心形迸发 → 纯白落定）
  // ============================================================

  const heroText = document.getElementById('heroText');
  const heroCanvas = document.getElementById('heroCanvas');
  let heroCtx = null;
  let heroAnimRaf = null;
  let heroParticles = [];
  let heroRevealed = false;
  let heroAnimT = 0;       // 0→1 进度
  let heroAnimRunning = false;

  function initHeroCanvas() {
    if (!heroCanvas || !heroText) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      const rect = heroCanvas.parentElement.getBoundingClientRect();
      heroCanvas.width = rect.width * dpr;
      heroCanvas.height = rect.height * dpr;
      heroCanvas.style.width = rect.width + 'px';
      heroCanvas.style.height = rect.height + 'px';
    };
    resize();
    window.addEventListener('resize', resize);
    heroCtx = heroCanvas.getContext('2d');
    heroCtx.scale(dpr, dpr);
  }

  /** 在英雄文字位置生成心形粒子 */
  function spawnHeroHearts() {
    if (!heroText) return;
    const rect = heroText.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const N = 35;
    heroParticles = Array.from({ length: N }, (_, i) => {
      const angle = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist = Math.random() * 80 + 30;
      return {
        x: cx + Math.cos(angle) * dist * 0.3,
        y: cy + Math.sin(angle) * dist * 0.3,
        tx: cx + Math.cos(angle) * dist,
        ty: cy + Math.sin(angle) * dist,
        r: Math.random() * 3 + 1.5,
        life: 1,
        decay: Math.random() * 0.015 + 0.008,
        isHeart: Math.random() < 0.2,  // 内敛，不多余
      };
    });
  }

  function drawHeroFrame() {
    if (!heroCtx || !heroCanvas) return;
    const W = heroCanvas.width / (Math.min(window.devicePixelRatio || 1, 1.5));
    const H = heroCanvas.height / (Math.min(window.devicePixelRatio || 1, 1.5));
    heroCtx.clearRect(0, 0, W, H);

    if (!heroAnimRunning) return;

    // 蓄能阶段 (0→0.45)：暖红光晕从文字中心渐亮
    if (heroAnimT < 0.45) {
      const p = heroAnimT / 0.45;
      const rect = heroText.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const glowR = Math.max(rect.width, rect.height) * 0.65 * (0.5 + p * 0.5);

      const grad = heroCtx.createRadialGradient(cx, cy, glowR * 0.3, cx, cy, glowR);
      grad.addColorStop(0, `rgba(217,52,28,${0.3 * p})`);
      grad.addColorStop(0.5, `rgba(217,52,28,${0.12 * p})`);
      grad.addColorStop(1, 'rgba(217,52,28,0)');
      heroCtx.fillStyle = grad;
      heroCtx.fillRect(0, 0, W, H);
    }

    // 迸发阶段 (0.45→0.75)：粒子弹出
    if (heroAnimT >= 0.45) {
      const bp = (heroAnimT - 0.45) / 0.3; // 0→1

      for (const p of heroParticles) {
        p.life -= p.decay;
        if (p.life <= 0) continue;

        const ease = 1 - Math.pow(1 - Math.min(bp, 1), 3); // easeOutCubic
        const cx = p.x + (p.tx - p.x) * ease;
        const cy = p.y + (p.ty - p.y) * ease;

        if (p.isHeart) {
          // 画心形
          const hs = p.r * 1.8;
          heroCtx.beginPath();
          heroCtx.moveTo(cx, cy + hs * 0.35);
          heroCtx.bezierCurveTo(cx, cy, cx - hs * 0.5, cy, cx - hs * 0.5, cy + hs * 0.15);
          heroCtx.bezierCurveTo(cx - hs * 0.5, cy + hs * 0.55, cx, cy + hs * 0.75, cx, cy + hs);
          heroCtx.bezierCurveTo(cx, cy + hs * 0.75, cx + hs * 0.5, cy + hs * 0.55, cx + hs * 0.5, cy + hs * 0.15);
          heroCtx.bezierCurveTo(cx + hs * 0.5, cy, cx, cy, cx, cy + hs * 0.35);
          heroCtx.closePath();
          heroCtx.fillStyle = `rgba(217,52,28,${p.life * 0.6})`;
          heroCtx.fill();
        } else {
          heroCtx.beginPath();
          heroCtx.arc(cx, cy, p.r, 0, Math.PI * 2);
          heroCtx.fillStyle = `rgba(217,52,28,${p.life * 0.4})`;  // 深暖红，不偏粉
          heroCtx.fill();
        }
      }
    }

    // 辉光退尽 (0.75→1.0)：渐隐
    if (heroAnimT > 0.75 && heroAnimT < 1.0) {
      const fadeP = (heroAnimT - 0.75) / 0.25;
      const rect = heroText.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const glowR = Math.max(rect.width, rect.height) * 0.5;

      const grad = heroCtx.createRadialGradient(cx, cy, glowR * 0.3, cx, cy, glowR);
      const alpha = 0.15 * (1 - fadeP);
      grad.addColorStop(0, `rgba(217,52,28,${alpha})`);
      grad.addColorStop(1, 'rgba(217,52,28,0)');
      heroCtx.fillStyle = grad;
      heroCtx.fillRect(0, 0, W, H);
    }

    if (heroAnimRunning) {
      heroAnimRaf = requestAnimationFrame(drawHeroFrame);
    }
  }

  function triggerHeroAnimation() {
    if (heroRevealed) return;
    heroRevealed = true;
    heroAnimRunning = true;
    heroAnimT = 0;
    initHeroCanvas();
    spawnHeroHearts();
    // CSS 入场（纯白实心终态）
    if (heroText) heroText.classList.add('on');

    // 驱动进度 0→1（2.4s 总长）
    const start = performance.now();
    const duration = 2400;
    function tick() {
      const elapsed = performance.now() - start;
      heroAnimT = Math.min(elapsed / duration, 1);
      if (heroAnimT >= 1) {
        heroAnimRunning = false;
        if (heroCanvas) heroCanvas.style.display = 'none';
        if (heroAnimRaf) cancelAnimationFrame(heroAnimRaf);
      }
      if (heroAnimRunning) {
        requestAnimationFrame(tick);
      }
    }
    requestAnimationFrame(tick);
    drawHeroFrame();
  }

  // 把英雄文字触发加入 checkReveals
  const origCheckReveals = checkReveals;
  checkReveals = function () {
    origCheckReveals();
    if (!heroRevealed && heroText && isInView(heroText.parentElement, 0.72)) {
      triggerHeroAnimation();
    }
  };

  // ============================================================
  // 5. 滚动监听（节流）
  // ============================================================

  let ticking = false;
  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        checkReveals();
        checkSilence();
        checkFinale();
        updateProgressBar();
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // ============================================================
  // 6. 进度条
  // ============================================================

  const progressBar = document.getElementById('progressBar');
  function updateProgressBar() {
    if (!progressBar) return;
    const h = document.documentElement.scrollHeight - innerHeight;
    if (h <= 0) return;
    const pct = Math.min((scrollY / h) * 100, 100);
    progressBar.style.width = pct + '%';
  }

  // ============================================================
  // 7. 声控按钮延迟显示（开幕后才出现）
  // ============================================================

  function showSoundBtn() {
    if (soundBtn) {
      soundBtn.classList.add('visible');
    }
  }
  // 打开 gate 后延迟显示
  const origOpen = openGate;
  // 在 gate 淡出后显示
  setTimeout(() => {
    const observer = new MutationObserver(() => {
      if (gate.style.display === 'none' || gate.classList.contains('fade-out')) {
        setTimeout(showSoundBtn, 1200);
        observer.disconnect();
      }
    });
    observer.observe(gate, { attributes: true, attributeFilter: ['class', 'style'] });
  }, 500);

  // ============================================================
  // 8. 初始化
  // ============================================================

  function init() {
    initBgm();

    // 初始锁滚动
    document.documentElement.classList.add('lock-scroll');

    // 处理中文断行：对普通段落（非逐字动效区域）做 cjkWbr
    document.querySelectorAll('.scene__line').forEach((el) => {
      cjkWbr(el);
    });

    // 初始检查（可能在视口内）
    requestAnimationFrame(() => {
      checkReveals();
      checkFinale();
    });
  }

  // DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 暴露到 window
  window.__ranmao = {
    openGate,
    toggleBgm,
    playBgm,
    tokenize,
    wrapWords,
    cjkWbr,
  };
})();
