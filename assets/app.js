/* ============================================================
   贺州 · 社保规划  —  界面交互 app.js
   ============================================================ */
(function () {
  'use strict';
  var E = window.HZSHEBAO;
  var CFG = E.CONFIG;
  var U = E.util;
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    mode: 'worker',
    plans: [],
    activePlanId: null,
    lastResult: null,
    uid: 0
  };

  /* ---------------- 通用 ---------------- */
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }
  function modal(title, text) {
    $('modalTitle').textContent = title;
    $('modalText').textContent = text;
    $('modalMask').classList.add('open');
  }
  function parseMoney(v) {
    if (v === null || v === undefined) return 0;
    var s = String(v).replace(/[,，\s]/g, '');
    var n = parseFloat(s);
    return isNum(n) ? n : 0;
  }
  function isNum(n) { return typeof n === 'number' && !isNaN(n) && isFinite(n); }
  function val(id) { var el = $(id); return el ? el.value : ''; }
  function num(id) { return parseMoney(val(id)); }

  /* ---------------- 初始化 ---------------- */
  function init() {
    // 人员类型
    var sel = $('personType');
    CFG.personTypes.forEach(function (p) {
      var o = document.createElement('option');
      o.value = p.key; o.textContent = p.label; sel.appendChild(o);
    });

    // 出生年月
    var maxYear = CFG.baseDate.year - 16;
    for (var y = maxYear; y >= 1935; y--) {
      var o = document.createElement('option');
      o.value = y; o.textContent = y + ' 年'; $('birthYear').appendChild(o);
    }
    for (var m = 1; m <= 12; m++) {
      var om = document.createElement('option');
      om.value = m; om.textContent = m + ' 月'; $('birthMonth').appendChild(om);
    }

    // 高级选项默认值
    $('lastYearAvgSalary').value = CFG.worker.lastYearAvgSalary;
    $('accountRate').value = CFG.worker.accountRate;
    $('salaryGrowthRate').value = CFG.worker.salaryGrowthRate;
    $('bankRate').value = CFG.worker.bankDepositRate;
    $('salaryHint').textContent = '默认按上年度社平工资的 ' + Math.round(CFG.worker.baseFloorRatio * 100) + '%（' +
      U.fmtInt(CFG.worker.lastYearAvgSalary * CFG.worker.baseFloorRatio) + ' 元）申报，可在社平 ' +
      Math.round(CFG.worker.baseFloorRatio * 100) + '%~' + Math.round(CFG.worker.baseCeilRatio * 100) + '% 区间内调整';

    // 居民缴费档次
    var tierSel = $('resTier');
    CFG.resident.tiers.forEach(function (t, i) {
      var o = document.createElement('option');
      o.value = t;
      o.textContent = t + ' 元/年（补贴 ' + CFG.resident.subsidies[i] + ' 元）' +
        (t === 100 ? ' · 困难群体代缴档' : '');
      tierSel.appendChild(o);
    });
    tierSel.value = CFG.resident.defaultTier;
    $('resBasicPension').value = CFG.resident.basicPension;
    $('resAccountRate').value = CFG.resident.accountRate;
    $('resYearlyBonus').value = CFG.resident.yearlyBonus;
    $('resTierHint').textContent = '贺州现行 ' + CFG.resident.tiers.length + ' 档（' +
      CFG.resident.tiers[0] + '~' + CFG.resident.tiers[CFG.resident.tiers.length - 1] + ' 元/年），按年缴费，多缴多得';

    // 补缴区
    buildBackpayFields();
    // 政策表
    buildPolicyTierTable();
    // 政策参数文本
    $('pFloor').textContent = Math.round(CFG.worker.baseFloorRatio * 100);
    $('pCeil').textContent = Math.round(CFG.worker.baseCeilRatio * 100);
    $('pAcctRate').textContent = CFG.worker.accountRate;
    $('pGrowth').textContent = CFG.worker.salaryGrowthRate.toFixed(1);
    $('pPayout').textContent = CFG.resident.payoutMonths;
    $('pResBasic').textContent = CFG.resident.basicPension;
    $('pBonus').textContent = CFG.resident.yearlyBonus;
    var contactBits = [];
    if (CFG.region.phone) contactBits.push('电话：' + CFG.region.phone);
    if (CFG.region.address) contactBits.push('地址：' + CFG.region.address);
    if (contactBits.length) {
      $('policyContact').innerHTML = '如有疑问请联系' + CFG.region.centerName + '，' + contactBits.join('，');
      $('policyContact').style.display = 'block';
    } else {
      $('policyContact').style.display = 'none';
    }
    $('footerOrg').textContent = CFG.region.centerName + ' · 便民服务';
    $('headerMeta').textContent = '测算基准日 ' + CFG.baseDate.year + '年' + CFG.baseDate.month + '月 · ' + CFG.region.dataVersion;

    bindEvents();
    // 默认给个示例，方便直接体验
    $('birthYear').value = '1980';
    $('birthMonth').value = '6';
    $('personType').value = 'male';
    $('paidMonths').value = '120';
    $('accountBalance').value = '86000';
    $('monthlySalary').value = U.fmtInt(CFG.worker.lastYearAvgSalary * 0.6);
    syncRetireInfo();
    syncWorkerEstimates();
    syncResidentEstimates();
    renderTabs();
  }

  function buildBackpayFields() {
    var grid = $('backpayGrid'); grid.innerHTML = '';
    CFG.resident.backpaySegments.forEach(function (seg, i) {
      var maxY = seg.endYear - seg.startYear + 1;
      var block = document.createElement('div');
      block.className = 'backpay-block';
      block.innerHTML =
        '<div class="bp-title">' + seg.label + '</div>' +
        '<div class="bp-cap">最多补缴 ' + maxY + ' 年，最高 ' + seg.maxTier + ' 元/年</div>' +
        '<input type="number" id="bpYears' + i + '" min="0" max="' + maxY + '" step="1" value="0" placeholder="补缴年数" />' +
        '<select id="bpTier' + i + '"></select>';
      grid.appendChild(block);
      var ts = $('bpTier' + i);
      CFG.resident.tiers.forEach(function (t) {
        if (t > seg.maxTier) return;
        var o = document.createElement('option');
        o.value = t; o.textContent = t + ' 元/年'; ts.appendChild(o);
      });
      ts.value = Math.min(CFG.resident.defaultTier, seg.maxTier);
    });
  }

  function buildPolicyTierTable() {
    var tb = $('policyTierTable'); tb.innerHTML = '';
    var tiers = CFG.resident.tiers, subs = CFG.resident.subsidies;
    var half = Math.ceil(tiers.length / 2);
    for (var i = 0; i < half; i++) {
      var tr = document.createElement('tr');
      var j = i + half;
      tr.innerHTML = '<td>' + tiers[i] + '</td><td>' + subs[i] + '</td>' +
        (j < tiers.length ? '<td>' + tiers[j] + '</td><td>' + subs[j] + '</td>' : '<td>—</td><td>—</td>');
      tb.appendChild(tr);
    }
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    document.querySelectorAll('.mode-tab').forEach(function (btn) {
      btn.addEventListener('click', function () { switchMode(btn.dataset.mode); });
    });

    document.querySelectorAll('.btn-toggle-advanced').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var box = $(btn.dataset.toggle);
        var open = box.classList.toggle('open');
        btn.textContent = (open ? '– 收起高级选项' : '+ 显示高级选项');
      });
    });

    $('policyTitleRow').addEventListener('click', function () {
      var c = $('policyContent');
      var show = c.style.display === 'none';
      c.style.display = show ? 'block' : 'none';
      $('policyToggle').textContent = show ? '–' : '+';
    });

    // 基本信息联动
    ['birthYear', 'birthMonth', 'personType', 'paidMonths', 'deemedMonths'].forEach(function (id) {
      $(id).addEventListener('change', function () { syncRetireInfo(); syncWorkerEstimates(); });
      $(id).addEventListener('input', function () { syncRetireInfo(); syncWorkerEstimates(); });
    });
    $('manualAge').addEventListener('input', function () { syncRetireInfo(); syncWorkerEstimates(); });

    ['monthlySalary', 'currentIndex', 'lastYearAvgSalary', 'accountRate', 'salaryGrowthRate'].forEach(function (id) {
      $(id).addEventListener('input', function () { syncWorkerEstimates(); });
    });

    $('workerPlan').addEventListener('change', function () {
      var isCustom = this.value === 'custom';
      $('fgCustomYears').style.display = isCustom ? 'flex' : 'none';
      if (isCustom) buildCustomYearOptions();
      syncWorkerEstimates();
    });

    // 居民联动
    ['resPaidYears', 'resBalance', 'resTier', 'resPlan', 'resCustomYears', 'resBasicPension', 'resAccountRate', 'resYearlyBonus'].forEach(function (id) {
      $(id).addEventListener('change', function () { syncResidentEstimates(); });
      $(id).addEventListener('input', function () { syncResidentEstimates(); });
    });
    $('resPlan').addEventListener('change', function () {
      var isCustom = this.value === 'custom';
      $('fgResCustomYears').style.display = isCustom ? 'flex' : 'none';
      if (isCustom) buildResCustomYearOptions();
      syncResidentEstimates();
    });
    $('backpayEnabled').addEventListener('change', function () {
      $('backpayGrid').style.display = this.checked ? 'grid' : 'none';
      syncResidentEstimates();
    });
    $('backpayGrid').addEventListener('input', syncResidentEstimates);
    $('backpayGrid').addEventListener('change', syncResidentEstimates);

    $('btnAddTierChange').addEventListener('click', function () { addTierChangeRow(); });

    // 测算
    $('btnCalcWorker').addEventListener('click', function () { runCalc('worker'); });
    $('btnCalcResident').addEventListener('click', function () { runCalc('resident'); });

    // 重置
    $('btnResetWorker').addEventListener('click', function () {
      $('paidMonths').value = '0';
      $('accountBalance').value = '0';
      $('deemedMonths').value = '';
      $('historyIndex').value = '';
      $('manualAge').value = '';
      $('monthlySalary').value = U.fmtInt(CFG.worker.lastYearAvgSalary * CFG.worker.baseFloorRatio);
      $('workerPlan').value = 'pay_to_retire';
      $('fgCustomYears').style.display = 'none';
      syncRetireInfo(); syncWorkerEstimates();
      resetResult();
      toast('已重置');
    });
    $('btnResetResident').addEventListener('click', function () {
      $('resPaidYears').value = '0';
      $('resBalance').value = '0';
      $('resTier').value = CFG.resident.defaultTier;
      $('resPlan').value = 'pay_to_60';
      $('fgResCustomYears').style.display = 'none';
      $('backpayEnabled').checked = false;
      $('backpayGrid').style.display = 'none';
      CFG.resident.backpaySegments.forEach(function (s, i) { $('bpYears' + i).value = '0'; });
      $('tierChangeList').innerHTML = '';
      syncResidentEstimates();
      resetResult();
      toast('已重置');
    });

    // 方案
    $('btnAddPlan').addEventListener('click', addPlan);
    $('btnClearPlans').addEventListener('click', function () {
      state.plans = []; state.activePlanId = null; renderTabs(); renderCompare();
      toast('已清空方案');
    });

    $('modalOk').addEventListener('click', function () { $('modalMask').classList.remove('open'); });
    $('modalMask').addEventListener('click', function (e) {
      if (e.target === $('modalMask')) $('modalMask').classList.remove('open');
    });
  }

  /* ---------------- 模式切换 ---------------- */
  function switchMode(mode) {
    state.mode = mode;
    document.querySelectorAll('.mode-tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    document.querySelectorAll('.worker-only').forEach(function (el) {
      el.style.display = (mode === 'worker') ? '' : 'none';
    });
    document.querySelectorAll('.resident-only').forEach(function (el) {
      el.style.display = (mode === 'resident') ? '' : 'none';
    });
    // form-group 类元素需要重置回 flex
    if (mode === 'worker') {
      document.querySelectorAll('.worker-only.form-group').forEach(function (el) { el.style.display = 'flex'; });
      $('fgCustomYears').style.display = $('workerPlan').value === 'custom' ? 'flex' : 'none';
    } else {
      document.querySelectorAll('.resident-only.form-group').forEach(function (el) { el.style.display = 'flex'; });
      $('fgResCustomYears').style.display = $('resPlan').value === 'custom' ? 'flex' : 'none';
    }
    resetResult();
  }

  /* ---------------- 退休信息联动 ---------------- */
  function getBirth() {
    var y = parseInt(val('birthYear'), 10), m = parseInt(val('birthMonth'), 10);
    if (!y || !m) return null;
    return { y: y, m: m, date: U.makeDate(y, m - 1) };
  }

  function syncRetireInfo() {
    var b = getBirth();
    $('fgBirth').classList.toggle('invalid', !b);
    if (!b) { $('retireDateText').value = ''; $('minYears').value = ''; return null; }
    var pt = val('personType');
    if (!pt) return null;

    var st = E.calcStatutoryRetire(pt, b.date);
    var paidM = Math.max(0, Math.round(num('paidMonths')));
    var deemedM = parseDeemed(val('deemedMonths')).sum;
    var credited = paidM + deemedM;
    var manual = val('manualAge').trim() === '' ? null : parseFloat(val('manualAge'));
    var sched = E.resolveSchedule(pt, b.date, manual, credited);

    $('minYears').value = sched.minYears + ' 年';
    $('retireDateText').value = U.fmtYYYYMM(sched.retireDate) + '（约 ' + U.round1(sched.retireAge) + ' 岁）';

    var hintBits = [];
    hintBits.push('新法定退休：' + U.fmtYYYYMM(sched.bounds.statutoryDate) + '（' + U.round1(sched.bounds.statutoryDate ? U.diffMonths(b.date, sched.bounds.statutoryDate) / 12 : 0) + ' 岁）');
    if (sched.needsExtension) {
      hintBits.push('⚠ 缴费年限不足，需顺延 ' + sched.extraMonths + ' 个月缴费');
    }
    if (manual !== null && sched.clamped) {
      hintBits.push('填写年龄超出可选区间，已调整为 ' + U.round1(sched.wishAge) + ' 岁');
    }
    $('retireDateHint').textContent = hintBits.join('　');

    // 弹性退休区间提示
    var lo = Math.floor(sched.bounds.lo / 12 * 10) / 10, hi = Math.floor(sched.bounds.hi / 12 * 10) / 10;
    $('retireAgeHint').textContent = '弹性退休可选区间 ' + lo + ' ~ ' + hi + ' 岁；留空按新法定退休年龄自动计算。';
    $('manualAge').min = lo;
    $('manualAge').max = hi;
    return { birth: b, sched: sched, paidM: paidM, deemed: parseDeemed(val('deemedMonths')) };
  }

  function parseDeemed(s) {
    s = (s || '').trim();
    if (!s) return { deemed: 0, preAccount: 0, sum: 0 };
    var parts = s.split('+').map(function (x) { return parseInt(x, 10) || 0; });
    var a = parts[0] || 0, b = parts[1] || 0;
    return { deemed: a, preAccount: b, sum: a + b };
  }

  function buildCustomYearOptions() {
    var info = syncRetireInfo();
    if (!info) return;
    var sel = $('customYears'); var prev = parseFloat(sel.value);
    var credited = (info.paidM + info.deemed.sum) / 12;
    var minY = Math.max(0, Math.ceil(info.sched.minYears - credited));
    var maxY = Math.max(minY, Math.floor(U.diffMonths(U.makeDate(CFG.baseDate.year, CFG.baseDate.month - 1), info.birth.date ? U.addMonths(info.birth.date, Math.round(info.sched.wishAge * 12)) : new Date()) / 12));
    sel.innerHTML = '';
    for (var y = minY; y <= maxY; y++) {
      var o = document.createElement('option'); o.value = y; o.textContent = y + ' 年'; sel.appendChild(o);
    }
    sel.value = isNum(prev) ? Math.min(Math.max(prev, minY), maxY) : maxY;
  }

  function buildResCustomYearOptions() {
    var b = getBirth();
    if (!b) return;
    var paid = Math.max(0, Math.floor(num('resPaidYears')));
    var retireDate = U.addMonths(b.date, CFG.resident.retireAge * 12);
    var base = U.makeDate(CFG.baseDate.year, CFG.baseDate.month - 1);
    var remain = retireDate <= base ? 0 : retireDate.getFullYear() - base.getFullYear() + 1;
    var minY = Math.max(0, CFG.resident.minYears - paid);
    var sel = $('resCustomYears'); var prev = parseFloat(sel.value);
    sel.innerHTML = '';
    for (var y = minY; y <= remain; y++) {
      var o = document.createElement('option'); o.value = y; o.textContent = y + ' 年'; sel.appendChild(o);
    }
    sel.value = isNum(prev) ? Math.min(Math.max(prev, minY), remain) : remain;
  }

  /* ---------------- 缴费金额联动 ---------------- */
  function syncWorkerEstimates() {
    var salaryInput = num('monthlySalary');
    var avg = num('lastYearAvgSalary') || CFG.worker.lastYearAvgSalary;
    var salary = salaryInput > 0 ? U.clamp(salaryInput, avg * CFG.worker.baseFloorRatio, avg * CFG.worker.baseCeilRatio) : avg * CFG.worker.baseFloorRatio;
    var pt = E.getPersonType(val('personType'));
    var rate = pt && pt.group === 'flexible' ? CFG.worker.flexibleRate : CFG.worker.employeeRate;
    var index = num('currentIndex') > 0 ? num('currentIndex') : U.clamp(salary / avg, 0.6, 3);

    $('monthContribution').value = U.fmtInt(salary * rate);
    $('yearContribution').value = U.fmtInt(salary * 12 * rate);
    $('monthContribHint').textContent = '缴费基数 ' + U.fmtInt(salary) + ' 元 × ' + Math.round(rate * 100) +
      '%（' + (pt && pt.group === 'flexible' ? '灵活就业 20%，其中 8% 进个人账户' : '个人 8% 进个人账户') + '）';

    if (salaryInput > 0 && salaryInput !== salary) {
      $('salaryHint').textContent = '输入值超出区间，已按 ' + U.fmtInt(salary) + ' 元（社平 ' +
        Math.round(salary / avg * 100) + '%）计算';
    } else {
      $('salaryHint').textContent = '默认按社平 ' + Math.round(CFG.worker.baseFloorRatio * 100) + '%（' +
        U.fmtInt(avg * CFG.worker.baseFloorRatio) + ' 元）申报，可在 60%~300% 区间调整';
    }

    var info = syncRetireInfo();
    if (!info) { $('totalContribution').value = ''; return; }
    var base = U.makeDate(CFG.baseDate.year, CFG.baseDate.month - 1);
    var remainYears = Math.max(0, U.diffMonths(base, U.addMonths(info.birth.date, Math.round(info.sched.wishAge * 12))) / 12);
    var credited = (info.paidM + info.deemed.sum) / 12;
    var minCustom = Math.max(0, info.sched.minYears - credited);
    var plan = val('workerPlan');
    var years = plan === 'pay_to_min' ? minCustom : (plan === 'custom' ? (parseFloat(val('customYears')) || remainYears) : remainYears);
    if (info.sched.needsExtension) years = minCustom;
    years = U.round1(years);
    var total = 0, m = salary, g = (num('salaryGrowthRate') || 0) / 100;
    var months = Math.round(years * 12);
    for (var i = 0; i < months; i++) { total += m * rate; if ((i + 1) % 12 === 0) m *= (1 + g); }
    $('totalContribution').value = U.fmtInt(total) + '（缴 ' + years + ' 年）';
    $('currentIndex').placeholder = '当前约 ' + U.round2(index);
  }

  function syncResidentEstimates() {
    var tier = parseInt(val('resTier'), 10) || CFG.resident.defaultTier;
    var subsidy = E.getResidentSubsidy(tier);
    $('resSubsidy').value = subsidy + ' 元';
    var b = getBirth();
    if (!b) { $('resTotalPay').value = ''; $('resTotalSubsidy').value = ''; return; }
    var base = U.makeDate(CFG.baseDate.year, CFG.baseDate.month - 1);
    var retireDate = U.addMonths(b.date, CFG.resident.retireAge * 12);
    var remain = retireDate <= base ? 0 : retireDate.getFullYear() - base.getFullYear() + 1;
    var paid = Math.max(0, Math.floor(num('resPaidYears')));
    var plan = val('resPlan');
    var bp = readBackpay();
    var future = remain;
    if (plan === 'pay_to_15') future = Math.max(0, Math.min(remain, CFG.resident.minYears - paid - bp.years));
    else if (plan === 'custom') future = U.clamp(parseFloat(val('resCustomYears')) || remain, Math.max(0, CFG.resident.minYears - paid - bp.years), remain);
    future = Math.floor(future);

    var changes = readTierChanges();
    var pay = 0, sub = 0;
    for (var y = 1; y <= future; y++) {
      var abs = base.getFullYear() + y - 1;
      var t = tier;
      changes.forEach(function (c) { if (c.year <= abs) t = c.tier; });
      pay += t; sub += E.getResidentSubsidy(t);
    }
    var autoBp = 0;
    if (paid + bp.years + future < CFG.resident.minYears && remain > 0) {
      autoBp = CFG.resident.minYears - (paid + bp.years + future);
    }
    var totalPay = pay + bp.amount + autoBp * tier;
    $('resTotalPay').value = U.fmtInt(totalPay) + (bp.years + autoBp > 0 ? '（含补缴 ' + (bp.years + autoBp) + ' 年）' : '');
    $('resTotalSubsidy').value = U.fmtInt(sub);
    if ($('fgResCustomYears').style.display !== 'none') buildResCustomYearOptions();
  }

  function readBackpay() {
    if (!$('backpayEnabled').checked) return { years: 0, amount: 0, list: [] };
    var years = 0, amount = 0, list = [];
    CFG.resident.backpaySegments.forEach(function (seg, i) {
      var maxY = seg.endYear - seg.startYear + 1;
      var y = U.clamp(Math.floor(num('bpYears' + i)), 0, maxY);
      var t = parseInt(val('bpTier' + i), 10) || Math.min(CFG.resident.defaultTier, seg.maxTier);
      years += y; amount += y * t; list.push({ years: y, tier: t });
    });
    return { years: years, amount: amount, list: list };
  }

  /* ---------------- 调档 ---------------- */
  function addTierChangeRow(year, tier) {
    var base = CFG.baseDate.year;
    if (!year) {
      var rows = $('tierChangeList').querySelectorAll('.tier-change-row');
      year = base + rows.length + 1;
    }
    var row = document.createElement('div');
    row.className = 'tier-change-row';
    var opts = '', topts = '';
    for (var y = base; y <= base + 40; y++) opts += '<option value="' + y + '"' + (y === year ? ' selected' : '') + '>' + y + ' 年起</option>';
    CFG.resident.tiers.forEach(function (t) { topts += '<option value="' + t + '"' + (t === (tier || CFG.resident.defaultTier) ? ' selected' : '') + '>' + t + ' 元/年' + (t === 100 ? ' · 困难群体代缴档' : '') + '</option>'; });
    row.innerHTML = '<select class="tier-change-year">' + opts + '</select>' +
      '<select class="tier-change-tier">' + topts + '</select>' +
      '<button class="btn-tier-change-remove" title="删除">×</button>';
    row.querySelector('.btn-tier-change-remove').addEventListener('click', function () { row.remove(); syncResidentEstimates(); });
    row.addEventListener('change', syncResidentEstimates);
    $('tierChangeList').appendChild(row);
    syncResidentEstimates();
  }

  function readTierChanges() {
    var out = [];
    $('tierChangeList').querySelectorAll('.tier-change-row').forEach(function (r) {
      out.push({ year: parseInt(r.querySelector('.tier-change-year').value, 10), tier: parseInt(r.querySelector('.tier-change-tier').value, 10) });
    });
    return out.sort(function (a, b) { return a.year - b.year; });
  }

  /* ---------------- 计算 ---------------- */
  function collectWorkerInput() {
    var b = getBirth();
    if (!b) return { error: '请选择出生年月' };
    if (!val('personType')) return { error: '请选择人员类型' };
    var paid = val('paidMonths');
    if (paid !== '' && (parseFloat(paid) < 0 || parseFloat(paid) > 600)) return { error: '历史已缴费月数需在 0—600 之间' };
    return {
      personKey: val('personType'),
      birthYear: b.y,
      birthMonth: b.m,
      paidMonths: Math.round(num('paidMonths')),
      accountBalance: num('accountBalance'),
      deemedMonths: parseDeemed(val('deemedMonths')).deemed,
      preAccountMonths: parseDeemed(val('deemedMonths')).preAccount,
      historyIndex: val('historyIndex').trim() === '' ? null : parseFloat(val('historyIndex')),
      manualAge: val('manualAge').trim() === '' ? null : parseFloat(val('manualAge')),
      monthlySalary: num('monthlySalary'),
      currentIndex: val('currentIndex').trim() === '' ? null : parseFloat(val('currentIndex')),
      lastYearAvgSalary: num('lastYearAvgSalary') || CFG.worker.lastYearAvgSalary,
      accountRate: val('accountRate') === '' ? CFG.worker.accountRate : num('accountRate'),
      salaryGrowthRate: val('salaryGrowthRate') === '' ? CFG.worker.salaryGrowthRate : num('salaryGrowthRate'),
      plan: val('workerPlan'),
      customYears: parseFloat(val('customYears'))
    };
  }

  function collectResidentInput() {
    var b = getBirth();
    if (!b) return { error: '请选择出生年月' };
    return {
      birthYear: b.y,
      birthMonth: b.m,
      paidYears: Math.floor(num('resPaidYears')),
      accountBalance: num('resBalance'),
      tier: parseInt(val('resTier'), 10),
      plan: val('resPlan'),
      customYears: parseFloat(val('resCustomYears')),
      basicPension: num('resBasicPension'),
      accountRate: val('resAccountRate') === '' ? CFG.resident.accountRate : num('resAccountRate'),
      yearlyBonus: num('resYearlyBonus'),
      backpayEnabled: $('backpayEnabled').checked,
      backpay: readBackpay().list,
      tierChanges: readTierChanges()
    };
  }

  function runCalc(mode) {
    var input = mode === 'worker' ? collectWorkerInput() : collectResidentInput();
    if (input.error) {
      $('fgBirth').classList.toggle('invalid', input.error.indexOf('出生') >= 0);
      modal('还差一步', input.error);
      return;
    }
    var res = mode === 'worker' ? E.calcWorker(input) : E.calcResident(input);
    if (!res) { modal('无法测算', '请检查填写信息是否完整、合理。'); return; }

    state.lastResult = { mode: mode, input: input, results: res };
    renderResult(res);

    // 首次自动存为方案
    if (state.plans.length === 0) {
      addPlan(true);
    } else if (state.activePlanId) {
      var p = findPlan(state.activePlanId);
      if (p && p.mode === mode) { p.input = input; p.results = res; p.summary = summarize(res); renderTabs(); renderCompare(); }
    }
    setTimeout(function () {
      $('resultBody').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  }

  function resetResult() {
    $('resultBody').style.display = 'none';
    $('resultEmpty').style.display = 'block';
    state.lastResult = null;
  }

  /* ---------------- 结果渲染 ---------------- */
  function renderResult(r) {
    $('resultEmpty').style.display = 'none';
    $('resultBody').style.display = 'block';

    $('rRetireDate').textContent = U.fmtYYYYMM(r.retireDate);
    $('rPension').textContent = U.fmtInt(r.totalPension);
    $('rInvest').textContent = U.fmtInt(r.totalInvest);
    var rm = r.recoverMonths;
    $('rRecover').textContent = rm >= 12 ? Math.floor(rm / 12) + ' 年 ' + (rm % 12) + ' 个月' : rm + ' 个月';
    var ru = $('rRecoverUnit'); if (ru) ru.style.display = 'none';

    $('rBasic').innerHTML = U.fmtInt(r.basicPension) + '<small>元</small>';
    $('rAccount').innerHTML = U.fmtInt(r.accountPension) + '<small>元</small>';
    $('rTrans').innerHTML = U.fmtInt(r.transitionalPension) + '<small>元</small>';
    $('rIndex').textContent = r.mode === 'worker' ? r.weightedIndex.toFixed(2) : (r.tier / 1000).toFixed(2) + '档';

    // 银行对比
    var bankTip = $('rCompareBank');
    if (r.mode === 'worker' && r.bankValue > 0) {
      bankTip.style.display = 'block';
      bankTip.innerHTML = '若把同样的钱存银行（年利率 ' + CFG.worker.bankDepositRate + '%），退休时约 <b>' +
        U.fmtInt(r.bankValue) + '</b> 元，按每月 ' + U.fmtInt(r.totalPension) + ' 元领取约 ' +
        Math.floor(r.bankMonths / 12) + ' 年 ' + (r.bankMonths % 12) + ' 个月用尽；<b>养老金可终身领取</b>。';
    } else {
      bankTip.style.display = 'none';
    }

    // 明细
    var html = '';
    if (r.mode === 'worker') {
      html =
        '<div>缴费年限：已缴 <b>' + r.creditedYears + '</b> 年（' + r.paidMonths + ' 个月' + (r.deemedMonths ? ' + 视同 ' + r.deemedMonths + ' 个月' : '') +
        '），后续再缴 <b>' + r.actualYears + '</b> 年，合计 <b>' + r.totalYears + '</b> 年' +
        (r.needsExtension ? '（<span style="color:#fa8c16">因不足最低缴费年限 ' + r.minYears + ' 年，申领时间已顺延 ' + r.extraMonths + ' 个月</span>）' : '') + '</div>' +
        '<div>退休时上年度社平工资约 <b>' + U.fmtInt(r.prevYearAvgSalary) + '</b> 元/月；计发月数 <b>' + r.paymentMonths + '</b> 个月；' +
        '缴费基数 <b>' + U.fmtInt(r.salary) + '</b> 元（指数 ' + r.curIndex.toFixed(2) + '）</div>' +
        '<div>总投入约 <b>' + U.fmtInt(r.totalInvest) + '</b> 元（后续 ' + U.fmtInt(r.totalContribution) + ' 元 + 历史约 ' +
        U.fmtInt(r.totalInvest - r.totalContribution) + ' 元）；退休时个人账户累计 <b>' + U.fmtInt(r.accountBalance) +
        '</b> 元（含利息 ' + U.fmtInt(r.accountInterest) + ' 元）</div>' +
        '<div>领取结构：基础养老金 ' + U.fmtInt(r.basicPension) + ' + 个人账户养老金 ' + U.fmtInt(r.accountPension) +
        (r.transitionalPension > 0 ? ' + 过渡性养老金 ' + U.fmtInt(r.transitionalPension) : '') +
        ' = <b>' + U.fmtInt(r.totalPension) + '</b> 元/月，年领约 <b>' + U.fmtInt(r.yearlyPension) + '</b> 元</div>';
    } else {
      html =
        '<div>缴费档次 <b>' + r.tier + '</b> 元/年（补贴 ' + r.subsidyPerYear + ' 元/年）；已缴 ' + r.paidYears + ' 年，后续再缴 ' +
        r.futureYears + ' 年' + (r.backpayYears > 0 ? '，补缴 ' + r.backpayYears + ' 年（' + U.fmtInt(r.backpayAmount) + ' 元，不计补贴）' : '') +
        '，累计 <b>' + r.totalYears + '</b> 年</div>' +
        '<div>个人账户累计 <b>' + U.fmtInt(r.accountBalance) + '</b> 元（本金 ' + U.fmtInt(r.accountPrincipal) +
        ' + 利息 ' + U.fmtInt(r.accountInterest) + '），÷' + CFG.resident.payoutMonths + ' = ' + U.fmtInt(r.accountPension) + ' 元/月</div>' +
        '<div>基础养老金 ' + U.fmtInt(r.basicStandard) + (r.bonusPension > 0 ? ' + 年限加发 ' + U.fmtInt(r.bonusPension) : '') +
        ' + 个人账户 ' + U.fmtInt(r.accountPension) + ' = <b>' + U.fmtInt(r.totalPension) + '</b> 元/月，年领约 <b>' + U.fmtInt(r.yearlyPension) + '</b> 元</div>' +
        '<div>累计投入约 <b>' + U.fmtInt(r.totalInvest) + '</b> 元，约 ' + (rm >= 12 ? Math.floor(rm / 12) + ' 年 ' + (rm % 12) + ' 个月' : rm + ' 个月') + ' 领回个人缴费</div>';
    }
    $('rDetail').innerHTML = html;
  }

  /* ---------------- 方案 ---------------- */
  function findPlan(id) {
    for (var i = 0; i < state.plans.length; i++) if (state.plans[i].id === id) return state.plans[i];
    return null;
  }

  function summarize(r) {
    return {
      type: r.mode === 'worker' ? '职工/灵活就业' : '城乡居民',
      planText: r.mode === 'worker'
        ? (r.actualYears <= 0 ? '已缴满' : '缴 ' + r.actualYears + ' 年')
        : (r.futureYears <= 0 ? '已缴满' : '缴 ' + r.futureYears + ' 年'),
      monthPay: r.mode === 'worker' ? Math.round(r.monthContribution) : Math.round(r.tier / 12),
      yearPay: r.mode === 'worker' ? Math.round(r.yearContribution) : Math.round(r.tier),
      totalInvest: Math.round(r.totalInvest),
      pension: Math.round(r.totalPension),
      recover: r.recoverMonths,
      totalPension: r.totalPension
    };
  }

  function addPlan(silent) {
    if (!state.lastResult) {
      modal('暂无测算结果', '请先填写信息并点击「开始测算」，再把结果保存为方案。');
      return;
    }
    state.uid++;
    var r = state.lastResult.results;
    var plan = {
      id: 'p' + state.uid,
      name: '方案' + state.uid,
      mode: state.lastResult.mode,
      input: state.lastResult.input,
      results: r,
      summary: summarize(r)
    };
    state.plans.push(plan);
    state.activePlanId = plan.id;
    renderTabs(); renderCompare();
    if (!silent) toast('已保存为「' + plan.name + '」');
  }

  function renderTabs() {
    var box = $('planTabs'); box.innerHTML = '';
    if (!state.plans.length) {
      box.innerHTML = '<span style="font-size:13px;color:#94a3b8">尚未保存方案</span>';
      return;
    }
    state.plans.forEach(function (p) {
      var el = document.createElement('div');
      el.className = 'plan-tab' + (p.id === state.activePlanId ? ' active' : '');
      var inp = document.createElement('input');
      inp.className = 'plan-name-edit';
      inp.value = p.name;
      inp.addEventListener('input', function () { p.name = inp.value || p.name; });
      inp.addEventListener('change', function () { renderTabs(); renderCompare(); });
      inp.addEventListener('click', function (e) { e.stopPropagation(); });
      var del = document.createElement('button');
      del.className = 'plan-tab-delete';
      del.textContent = '×';
      del.title = '删除该方案';
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        state.plans = state.plans.filter(function (x) { return x.id !== p.id; });
        if (state.activePlanId === p.id) state.activePlanId = state.plans.length ? state.plans[state.plans.length - 1].id : null;
        renderTabs(); renderCompare();
      });
      el.appendChild(inp); el.appendChild(del);
      el.addEventListener('click', function () {
        state.activePlanId = p.id;
        renderTabs();
        restorePlan(p);
      });
      box.appendChild(el);
    });
  }

  function restorePlan(p) {
    state.mode = p.mode;
    switchMode(p.mode);
    var i = p.input;
    $('birthYear').value = i.birthYear;
    $('birthMonth').value = i.birthMonth;
    if (p.mode === 'worker') {
      $('personType').value = i.personKey;
      $('paidMonths').value = i.paidMonths;
      $('accountBalance').value = i.accountBalance;
      $('deemedMonths').value = val('deemedMonths');
      $('manualAge').value = i.manualAge === null ? '' : i.manualAge;
      $('monthlySalary').value = U.fmtInt(i.monthlySalary);
      $('workerPlan').value = i.plan;
      $('fgCustomYears').style.display = i.plan === 'custom' ? 'flex' : 'none';
    } else {
      $('resPaidYears').value = i.paidYears;
      $('resBalance').value = i.accountBalance;
      $('resTier').value = i.tier;
      $('resPlan').value = i.plan;
      $('fgResCustomYears').style.display = i.plan === 'custom' ? 'flex' : 'none';
    }
    syncRetireInfo(); syncWorkerEstimates(); syncResidentEstimates();
    state.lastResult = { mode: p.mode, input: i, results: p.results };
    renderResult(p.results);
    toast('已载入「' + p.name + '」');
  }

  function renderCompare() {
    var tb = $('compareBody'); tb.innerHTML = '';
    if (!state.plans.length) {
      tb.innerHTML = '<tr><td colspan="8" class="adjacent-empty">暂无已保存方案，测算后可点击「保存为新方案」进行多方案对比</td></tr>';
      return;
    }
    var cmp = E.comparePlans(state.plans);
    if (!cmp) cmp = { best: {} };
    state.plans.forEach(function (p, idx) {
      var s = p.summary;
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td style="font-weight:600;color:#334155">' + esc(p.name) + '</td>' +
        '<td>' + s.type + '</td>' +
        '<td>' + s.planText + '</td>' +
        '<td>' + U.fmtInt(s.monthPay) + '</td>' +
        '<td>' + U.fmtInt(s.yearPay) + '</td>' +
        '<td class="' + (cmp.best.totalInvest === idx ? 'best' : '') + '">' + U.fmtInt(s.totalInvest) + '</td>' +
        '<td class="' + (cmp.best.totalPension === idx ? 'best' : '') + '">' + U.fmtInt(s.pension) + ' 元</td>' +
        '<td class="' + (cmp.best.recoverMonths === idx ? 'best' : '') + '">' + (s.recover >= 12 ? Math.floor(s.recover / 12) + '年' + (s.recover % 12) + '个月' : s.recover + '个月') + '</td>';
      tb.appendChild(tr);
    });
    if (state.plans.length >= 2) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="8" style="text-align:left;font-size:12.5px;color:#64748b;background:#f8fafc">' +
        '红底为同项最优（总投入最低 / 月养老金最高 / 回本最快）。30 年累计领取：' +
        state.plans.map(function (p) { return esc(p.name) + ' ' + U.fmtInt(p.summary.totalPension * 12 * 30) + ' 元'; }).join('；') + '</td>';
      tb.appendChild(tr);
    }
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  document.addEventListener('DOMContentLoaded', init);
})();
