// ===== 从 userData.js 注入公司名/邮箱 =====
(function () {
  const ud = window.userData;
  if (!ud) return;

  document.querySelectorAll('.ud-company').forEach(el => {
    el.textContent = ud.company;
  });
  document.querySelectorAll('.ud-email').forEach(el => {
    el.textContent = ud.email;
  });
  document.querySelectorAll('.ud-email-link').forEach(el => {
    el.href = 'mailto:' + ud.email;
  });
})();

// ===== 游戏分类筛选 =====
const filterBtns = document.querySelectorAll('.filter-btn');
const cards      = document.querySelectorAll('.game-card');
const countEl    = document.getElementById('count');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const filter = btn.dataset.filter;
    let visible = 0;

    cards.forEach(card => {
      const match = filter === 'all' || card.dataset.category === filter;
      card.classList.toggle('hidden', !match);
      if (match) visible++;
    });

    if (countEl) countEl.textContent = visible;
  });
});
