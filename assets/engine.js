/* ============================================================
   贺州 · 社保规划  —  测算引擎  engine.js
   ------------------------------------------------------------
   【金额逻辑集中配置区】所有口径参数集中在 CONFIG 中，
   后续调整金额（社平工资、缴费档次、补贴、基础养老金、利率、
   计发月数等）只需修改本文件 CONFIG，界面与政策说明自动联动。
   纯函数、无 DOM 依赖，可直接被小程序 / Node 复用。
   ============================================================ */
(function (root) {
  'use strict';

  /* ================= 一、参数配置区（改金额只改这里） ================= */
  var CONFIG = {
    region: {
      city: '贺州',
      province: '广西',
      centerName: '贺州市社会保险事业管理中心',
      phone: '',                      // TODO 填写实际对外咨询电话，如 '0774-12345678'；留空则不显示
      address: '',                    // TODO 填写实际办公地址；留空则不显示
      dataVersion: '2026年度测算口径',
      // 是否展示"按当地实际标准执行"的地方口径提示；正式上线前请由业务科室核定各项数值
      dataVerified: false
    },

    /* ---------- 企业职工 / 灵活就业 ---------- */
    worker: {
      lastYearAvgSalary: 6908,        // 上年度全区全口径城镇单位在岗职工月平均工资（元/月）★可改
      accountRate: 2.5,               // 个人账户记账利率 %
      salaryGrowthRate: 2.0,          // 社平工资年增长率 %
      bankDepositRate: 1.3,           // 银行一年期定存利率 %（对比用）
      employeeRate: 0.08,             // 企业职工个人缴费比例（进个人账户）
      flexibleRate: 0.20,             // 灵活就业人员缴费比例（8% 进个人账户 + 12% 统筹）
      baseFloorRatio: 0.6,            // 缴费基数下限 = 社平 × 0.6
      baseCeilRatio: 3.0,             // 缴费基数上限 = 社平 × 3.0
      transitionalRate: 0.014,        // 过渡性养老金计发系数 1.4%
      minYearsFloor: 15,              // 最低缴费年限起步 15 年
      minYearsCap: 20,                // 2039 年起封顶 20 年
      minYearsRampStart: 2030,        // 2030 年起每年 +0.5 年
      minYearsRampStep: 0.5,
      maxRetireAge: 70
    },

    /* ---------- 城乡居民养老保险（广西 15 档） ---------- */
    resident: {
      tiers:     [200, 300, 400, 500, 600, 700, 800, 900, 1000, 1500, 2000, 3000, 4000, 5000, 6000],
      subsidies: [ 35,  40,  45,  60,  65,  70, 100, 120,  150,  175,  200,  200,  200,  200,  200],
      defaultTier: 2000,
      basicPension: 186,              // 基础养老金 元/月（广西标准 2025.07 起，贺州可上浮）★可改
      accountRate: 2.5,               // 个人账户记账利率 %
      yearlyBonus: 4,                 // 超 15 年，每多缴 1 年每月加发 元
      payoutMonths: 139,              // 60 岁计发月数
      minYears: 15,
      retireAge: 60,
      // 补缴区间：各区间最高补缴档次（元/年）
      backpaySegments: [
        { startYear: 2019, endYear: 2025, maxTier: 6000, label: '2019—2025年' },
        { startYear: 2014, endYear: 2018, maxTier: 2000, label: '2014—2018年' },
        { startYear: 2011, endYear: 2013, maxTier: 1000, label: '2011—2013年' }
      ]
    },

    /* ---------- 人员类型 & 延迟退休规则 ---------- */
    // originalAge 原法定退休年龄 / targetAge 目标年龄 / step 每几个月延 1 个月
    personTypes: [
      { key: 'male',            label: '企业职工（男）',              group: 'employee', originalAge: 60, targetAge: 63, step: 4 },
      { key: 'female_cadre',    label: '企业职工（技术和管理岗位·女）', group: 'employee', originalAge: 55, targetAge: 58, step: 4 },
      { key: 'female_worker',   label: '企业职工（普工岗位·女）',      group: 'employee', originalAge: 50, targetAge: 55, step: 2 },
      { key: 'flexible_male',   label: '灵活就业人员（男）',          group: 'flexible', originalAge: 60, targetAge: 63, step: 4 },
      { key: 'flexible_female', label: '灵活就业人员（女）',          group: 'flexible', originalAge: 55, targetAge: 58, step: 4 }
    ],

    // 个人账户养老金计发月数（退休年龄 → 月数）
    payoutTable: {
      40: 233, 41: 230, 42: 226, 43: 223, 44: 220, 45: 216, 46: 212, 47: 208,
      48: 204, 49: 199, 50: 195, 51: 190, 52: 185, 53: 180, 54: 175, 55: 170,
      56: 164, 57: 158, 58: 152, 59: 145, 60: 139, 61: 132, 62: 125, 63: 117,
      64: 109, 65: 101, 66: 93, 67: 84, 68: 75, 69: 65, 70: 56
    },

    // 测算基准日（"今年"由它决定）；每年更新一次即可
    baseDate: { year: 2026, month: 8 }
  };

  /* ================= 二、工具函数 ================= */
  function round2(n) { return Math.round(n * 100) / 100; }
  function round1(n) { return Math.round(n * 10) / 10; }
  function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }
  function isNum(v) { return typeof v === 'number' && !isNaN(v) && isFinite(v); }

  function fmtMoney(n, digits) {
    if (!isNum(n)) n = 0;
    digits = digits === undefined ? 2 : digits;
    return n.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function fmtInt(n) { return fmtMoney(Math.round(n || 0), 0); }

  function makeDate(y, m) { return new Date(y, m, 1); } // m: 0-11
  function diffMonths(a, b) { return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()); }
  function addMonths(d, n) { var x = new Date(d.getTime()); x.setMonth(x.getMonth() + n); return x; }
  function fmtYYYYMM(d) { return d.getFullYear() + '年' + (d.getMonth() + 1) + '月'; }
  function ageAt(birth, d) { return diffMonths(birth, d) / 12; }

  /* ================= 三、政策规则 ================= */
  // 延迟退休年龄：自 2025.1 起，按原法定退休时间每 step 个月延 1 个月，最多延到 targetAge
  function calcStatutoryRetire(personKey, birth) {
    var pt = getPersonType(personKey);
    if (!pt) return null;
    var policyStart = makeDate(2025, 0);
    var origDate = addMonths(birth, pt.originalAge * 12);
    if (origDate < policyStart) {
      return { retireDate: origDate, retireAge: pt.originalAge, originalAge: pt.originalAge, delayMonths: 0, personType: pt };
    }
    var monthsFromPolicyStart = diffMonths(policyStart, origDate);
    var maxDelay = (pt.targetAge - pt.originalAge) * 12;
    var delayMonths = Math.min(Math.ceil((monthsFromPolicyStart + 1) / pt.step), maxDelay);
    var finalDate = addMonths(origDate, delayMonths);
    return {
      retireDate: finalDate,
      retireAge: round1(ageAt(birth, finalDate)),
      originalAge: pt.originalAge,
      delayMonths: delayMonths,
      personType: pt
    };
  }

  // 最低缴费年限：≤2029 → 15；2030 起每年 +0.5；≥2039 → 20
  function calcMinContributionYears(retireYear) {
    var w = CONFIG.worker;
    if (retireYear <= w.minYearsRampStart - 1) return w.minYearsFloor;
    if (retireYear >= w.minYearsRampStart + (w.minYearsCap - w.minYearsFloor) / w.minYearsRampStep) return w.minYearsCap;
    return round1(w.minYearsFloor + w.minYearsRampStep * (retireYear - w.minYearsRampStart + 1));
  }

  function getPaymentMonths(age) {
    var tbl = CONFIG.payoutTable;
    age = round1(age);
    if (age <= 40) return 233;
    if (age >= 70) return 56;
    var i = Math.floor(age), frac = age - i;
    return round1(tbl[i] - (tbl[i] - tbl[i + 1]) * frac);
  }

  // 把「缴费年限不足」折算成延后申领的月份
  function extendForMinYears(retireDate, birth, creditedMonths, minYears, baseDate) {
    var needMonths = Math.round(minYears * 12);
    var monthsToRetire = Math.max(0, diffMonths(baseDate, retireDate));
    var deficit = Math.ceil(needMonths - creditedMonths - monthsToRetire);
    if (deficit <= 0) return { retireDate: retireDate, needsExtension: false, deficitMonths: 0 };
    var anchor = monthsToRetire > 0 ? retireDate : baseDate;
    return {
      retireDate: addMonths(anchor, deficit),
      needsExtension: true,
      deficitMonths: deficit
    };
  }

  // 弹性退休可选区间（月）
  function retireAgeBounds(personKey, birth, baseDate) {
    var st = calcStatutoryRetire(personKey, birth);
    if (!st) return null;
    var newMonths = diffMonths(birth, st.retireDate);
    var curMonths = Math.max(0, diffMonths(birth, baseDate));
    var lo = Math.max(st.originalAge * 12, newMonths - 36, curMonths);
    var hi = Math.min(newMonths + 36, CONFIG.worker.maxRetireAge * 12);
    if (hi < lo) hi = lo;
    return { lo: lo, hi: hi, statutoryMonths: newMonths, currentMonths: curMonths, statutoryDate: st.retireDate };
  }

  // 统一的退休排期解析：兼顾弹性退休 + 最低缴费年限门槛逐年上涨
  function resolveSchedule(personKey, birth, manualAge, creditedMonths, baseDate) {
    baseDate = baseDate || makeDate(CONFIG.baseDate.year, CONFIG.baseDate.month - 1);
    var b = retireAgeBounds(personKey, birth, baseDate);
    if (!b) return null;
    var hasManual = isNum(manualAge);
    var wishMonths = hasManual ? clamp(Math.round(manualAge * 12), b.lo, b.hi) : b.statutoryMonths;
    var wishDate = addMonths(birth, wishMonths);
    var isEarly = wishDate < b.statutoryDate;
    var iterate = isEarly && wishDate.getFullYear() >= CONFIG.worker.minYearsRampStart &&
                  wishDate.getFullYear() <= CONFIG.worker.minYearsRampStart + 9;
    var capMinYears = calcMinContributionYears(b.statutoryDate.getFullYear());
    var minYears = iterate ? calcMinContributionYears(wishDate.getFullYear()) : capMinYears;

    var candDate = wishDate, resolved = null, guard = 0;
    while (guard++ < 60) {
      resolved = extendForMinYears(candDate, birth, creditedMonths, minYears, baseDate);
      if (!iterate || !resolved.needsExtension) break;
      var next = Math.min(calcMinContributionYears(resolved.retireDate.getFullYear()), capMinYears);
      if (next <= minYears) break;
      candDate = resolved.retireDate;
      minYears = next;
    }
    var finalMonths = diffMonths(birth, resolved.retireDate);
    return {
      bounds: b,
      hasManual: hasManual,
      clamped: hasManual && Math.round(manualAge * 12) !== wishMonths,
      wishDate: wishDate,
      wishAge: wishMonths / 12,
      isEarly: isEarly,
      retireDate: resolved.retireDate,
      retireAge: finalMonths / 12,
      retireAgeMonths: finalMonths,
      minYears: minYears,
      needsExtension: resolved.needsExtension,
      extraMonths: resolved.deficitMonths
    };
  }

  /* ================= 四、企业职工 / 灵活就业 测算 ================= */
  function calcWorker(input) {
    var w = CONFIG.worker;
    var baseDate = input.baseDate || makeDate(CONFIG.baseDate.year, CONFIG.baseDate.month - 1);
    var birth = makeDate(input.birthYear, input.birthMonth - 1);
    var pt = getPersonType(input.personKey);
    if (!pt) return null;

    var paidMonths = Math.max(0, Math.round(input.paidMonths || 0));
    var deemed = Math.max(0, Math.round(input.deemedMonths || 0));
    var preAccount = Math.max(0, Math.round(input.preAccountMonths || 0));
    var creditedMonths = paidMonths + deemed;
    var creditedYears = creditedMonths / 12;

    var sched = resolveSchedule(input.personKey, birth, input.manualAge, creditedMonths, baseDate);
    var retireDate = sched.retireDate;
    var retireAge = sched.retireAge;

    // 剩余缴至退休的年数（按意愿退休日）
    var remainYears = Math.max(0, round1(diffMonths(baseDate, addMonths(birth, Math.round(sched.wishAge * 12))) / 12));
    var minCustomYears = Math.max(0, round1(sched.minYears - creditedYears));

    var plan = input.plan || 'pay_to_retire';
    var actualYears;
    if (sched.needsExtension || plan === 'pay_to_min') {
      actualYears = minCustomYears;
    } else if (plan === 'custom') {
      actualYears = clamp(isNum(input.customYears) ? input.customYears : remainYears, minCustomYears, remainYears);
    } else {
      actualYears = remainYears;
    }
    actualYears = round1(actualYears);
    var actualMonths = Math.max(0, Math.round(actualYears * 12));
    var totalYears = creditedYears + actualYears;

    var monthsToRetire = diffMonths(baseDate, retireDate);
    var prevYearAvgSalary = input.lastYearAvgSalary * Math.pow(1 + input.salaryGrowthRate / 100, monthsToRetire / 12);

    // 缴费工资：不填默认社平 60%
    var salary = isNum(input.monthlySalary) && input.monthlySalary > 0
      ? clamp(input.monthlySalary, input.lastYearAvgSalary * w.baseFloorRatio, input.lastYearAvgSalary * w.baseCeilRatio)
      : input.lastYearAvgSalary * w.baseFloorRatio;

    var curIndex = isNum(input.currentIndex) ? clamp(input.currentIndex, w.baseFloorRatio, w.baseCeilRatio) : clamp(salary / input.lastYearAvgSalary, 0.6, 3);
    var histIndex = isNum(input.historyIndex) ? clamp(input.historyIndex, 0.6, 3) : estimateHistoryIndex(paidMonths - preAccount, input.accountBalance);
    if (!isNum(input.historyIndex)) histIndex = histIndex;

    var isFlexible = pt.group === 'flexible';
    var rate = isFlexible ? w.flexibleRate : w.employeeRate;

    // 个人账户累计
    var acct = accrueAccount({
      balance: Math.max(0, input.accountBalance || 0),
      salary: salary,
      ratePct: input.accountRate,
      growthPct: input.salaryGrowthRate,
      contribMonths: actualMonths,
      totalMonths: Math.max(actualMonths, monthsToRetire),
      personalRate: 0.08
    });

    var paymentMonths = getPaymentMonths(retireAge);

    // 平均缴费工资指数（按月加权）
    var idxMonths = paidMonths + deemed + actualMonths;
    var weightedIndex = idxMonths > 0
      ? (paidMonths * histIndex + deemed * 1.0 + actualMonths * curIndex) / idxMonths
      : curIndex;

    var basicPension = prevYearAvgSalary * ((1 + weightedIndex) / 2) * totalYears * 0.01;
    var accountPension = acct.balance / paymentMonths;
    var transMonths = deemed + preAccount;
    var transitionalPension = transMonths > 0
      ? prevYearAvgSalary * weightedIndex * (transMonths / 12) * w.transitionalRate
      : 0;
    var totalPension = basicPension + accountPension + transitionalPension;

    // 未来缴费总额（按月缴、按年涨基数）
    var contrib = projectContribution(salary, rate, input.salaryGrowthRate, actualMonths);
    // 前面已缴的历史个人缴费估算
    var historyContrib = estimateWorkerHistory(paidMonths, input.accountBalance, histIndex, input.lastYearAvgSalary);
    var totalInvest = contrib.total + historyContrib;

    var bank = projectBankDeposit(salary, Math.max(input.salaryGrowthRate, input.salaryGrowthRate), w.bankDepositRate, actualMonths, w.flexibleRate);
    var recoverMonths = monthsToRecover(totalInvest, totalPension, w.bankDepositRate);
    var bankMonths = monthsToRecover(totalInvest, totalPension, 0);

    return {
      mode: 'worker',
      personKey: input.personKey,
      personLabel: pt.label,
      isFlexible: isFlexible,
      birthYear: input.birthYear,
      birthMonth: input.birthMonth,
      currentAge: Math.floor(ageAt(birth, baseDate)),
      statutoryDate: sched.bounds.statutoryDate,
      retireDate: retireDate,
      retireAge: round1(retireAge),
      minYears: sched.minYears,
      needsExtension: sched.needsExtension,
      extraMonths: sched.extraMonths,
      paidMonths: paidMonths,
      deemedMonths: deemed,
      creditedYears: round1(creditedYears),
      actualYears: actualYears,
      totalYears: round1(totalYears),
      salary: round2(salary),
      curIndex: round2(curIndex),
      histIndex: round1(histIndex),
      weightedIndex: round2(weightedIndex),
      prevYearAvgSalary: round2(prevYearAvgSalary),
      paymentMonths: paymentMonths,
      monthContribution: round2(salary * rate),
      yearContribution: round2(salary * 12 * rate),
      totalContribution: round2(contrib.total),
      totalInvest: round2(totalInvest),
      accountBalance: round2(acct.balance),
      accountPrincipal: round2(acct.principal),
      accountInterest: round2(acct.interest),
      basicPension: round2(basicPension),
      accountPension: round2(accountPension),
      transitionalPension: round2(transitionalPension),
      totalPension: round2(totalPension),
      yearlyPension: round2(totalPension * 12),
      recoverMonths: recoverMonths,
      bankMonths: bankMonths,
      bankValue: round2(bank.total),
      rateUsed: rate
    };
  }

  function getPersonType(key) {
    for (var i = 0; i < CONFIG.personTypes.length; i++) if (CONFIG.personTypes[i].key === key) return CONFIG.personTypes[i];
    return null;
  }

  // 个人账户逐年滚存（当年缴入不计当年息）
  function accrueAccount(o) {
    var bal = o.balance || 0, principal = o.balance || 0;
    var monthly = o.salary, yearIn = 0, r = o.ratePct / 100, g = o.growthPct / 100;
    var total = Math.max(o.contribMonths, o.totalMonths || 0);
    for (var m = 0; m < total; m++) {
      if (m < o.contribMonths) {
        var c = monthly * o.personalRate;
        bal += c; principal += c; yearIn += c;
      }
      if ((m + 1) % 12 === 0) {
        bal = (bal - yearIn) * (1 + r) + yearIn;
        yearIn = 0;
        if (m < o.contribMonths) monthly *= (1 + g);
      }
    }
    return { balance: bal, principal: principal, interest: Math.max(0, bal - principal) };
  }

  function projectContribution(salary, rate, growthPct, months) {
    if (!(months > 0)) return { total: 0, yearly: [] };
    var total = 0, monthly = salary, yearly = [], ySum = 0, g = growthPct / 100;
    for (var m = 0; m < months; m++) {
      var c = monthly * rate;
      total += c; ySum += c;
      if ((m + 1) % 12 === 0) {
        yearly.push({ year: CONFIG.baseDate.year + yearly.length, amount: round2(ySum), base: round2(monthly) });
        ySum = 0; monthly *= (1 + g);
      }
    }
    if (ySum > 0) yearly.push({ year: CONFIG.baseDate.year + yearly.length, amount: round2(ySum), base: round2(monthly) });
    return { total: total, yearly: yearly };
  }

  // 历史已缴个人缴费估算：由账户余额倒推（按记账利率 0 的简化口径 + 1.2 修正）
  function estimateWorkerHistory(paidMonths, balance, histIndex, avgSalary) {
    if (!paidMonths || paidMonths <= 0) return 0;
    // 以当前社平×历史指数×8% 近似历史个人缴费
    var monthly = avgSalary * (isNum(histIndex) ? histIndex : 0.6) * 0.08;
    return round2(monthly * paidMonths);
  }

  // 由账户余额反推历史缴费指数
  function estimateHistoryIndex(months, balance) {
    if (!months || months <= 0 || !(balance > 0)) return 0.6;
    var avgSalary = CONFIG.worker.lastYearAvgSalary;
    var idx = (balance / months) / (avgSalary * 0.08) / 1.2;
    return clamp(round2(idx), 0.6, 3);
  }

  // 留存资金（不缴社保自己存银行）逐月积累、按年计息
  function projectBankDeposit(salary, growthPct, ratePct, months, rate) {
    if (!(months > 0)) return { total: 0, principal: 0, interest: 0 };
    var bal = 0, principal = 0, monthly = salary, yearIn = 0;
    var r = ratePct / 100, g = growthPct / 100;
    for (var m = 0; m < months; m++) {
      var c = monthly * rate;
      bal += c; principal += c; yearIn += c;
      if ((m + 1) % 12 === 0) {
        bal = (bal - yearIn) * (1 + r) + yearIn;
        yearIn = 0; monthly *= (1 + g);
      }
    }
    return { total: bal, principal: principal, interest: bal - principal };
  }

  // 多久能"领回"投入：考虑剩余资金按利率增值
  function monthsToRecover(principal, monthlyPension, ratePct) {
    if (!(monthlyPension > 0)) return 0;
    var bal = principal, r = ratePct / 100 / 12, m = 0;
    var maxM = 12 * 60;
    while (bal > 0 && m < maxM) {
      bal = bal * (1 + r) - monthlyPension;
      m++;
    }
    return m;
  }

  /* ================= 五、城乡居民 测算 ================= */
  function calcResident(input) {
    var rs = CONFIG.resident;
    var baseDate = input.baseDate || makeDate(CONFIG.baseDate.year, CONFIG.baseDate.month - 1);
    var birth = makeDate(input.birthYear, input.birthMonth - 1);
    var retireDate = addMonths(birth, rs.retireAge * 12);

    var tier = isNum(input.tier) ? input.tier : rs.defaultTier;
    var paidYears = Math.max(0, Math.floor(input.paidYears || 0));
    var balance = Math.max(0, input.accountBalance || 0);
    var basicStandard = isNum(input.basicPension) ? input.basicPension : rs.basicPension;
    var acctRate = clamp(isNum(input.accountRate) ? input.accountRate : rs.accountRate, 0, 8);
    var bonus = isNum(input.yearlyBonus) ? input.yearlyBonus : rs.yearlyBonus;

    // 可缴年数（含今年与 60 周岁当年）
    var remainYears = retireDate <= baseDate ? 0 : retireDate.getFullYear() - baseDate.getFullYear() + 1;
    var alreadyReceiving = remainYears === 0;

    // 补缴
    var backpayYears = 0, backpayAmount = 0;
    if (input.backpay && input.backpayEnabled) {
      for (var i = 0; i < rs.backpaySegments.length; i++) {
        var seg = rs.backpaySegments[i];
        var maxY = seg.endYear - seg.startYear + 1;
        var yy = clamp(Math.floor((input.backpay[i] && input.backpay[i].years) || 0), 0, maxY);
        var tt = clamp((input.backpay[i] && input.backpay[i].tier) || Math.min(tier, seg.maxTier), 0, seg.maxTier);
        backpayYears += yy;
        backpayAmount += yy * tt;
      }
    }

    // 未来正常缴费年数
    var plan = input.plan || 'pay_to_60';
    var futureYears = 0;
    if (remainYears > 0) {
      if (plan === 'pay_to_60') futureYears = remainYears;
      else if (plan === 'custom') {
        var minC = Math.max(0, rs.minYears - paidYears - backpayYears);
        futureYears = clamp(isNum(input.customYears) ? input.customYears : minC, minC, remainYears);
      } else {
        futureYears = Math.max(0, Math.min(remainYears, rs.minYears - paidYears - backpayYears));
      }
    }
    futureYears = Math.floor(futureYears);

    var totalYears = paidYears + backpayYears + futureYears;
    var autoBackpayYears = 0;
    if (totalYears < rs.minYears && !alreadyReceiving) {
      autoBackpayYears = rs.minYears - totalYears;
      totalYears = rs.minYears;
    }

    // 逐年缴费排期（支持中途调档）
    var changes = (input.tierChanges || []).slice().sort(function (a, b) { return a.year - b.year; });
    function tierOfYear(y) {
      var t = tier;
      for (var k = 0; k < changes.length; k++) if (changes[k].year <= y) t = changes[k].tier;
      return t;
    }
    var segments = [], futureContribution = 0, subsidyTotal = 0;
    for (var y = 1; y <= futureYears; y++) {
      var absYear = baseDate.getFullYear() + y - 1;
      var ty = tierOfYear(absYear);
      var sy = getResidentSubsidy(ty);
      segments.push({ year: absYear, tier: ty, subsidy: sy, age: Math.floor(ageAt(birth, makeDate(absYear, 0))) });
      futureContribution += ty;
      subsidyTotal += sy;
    }

    // 个人账户滚存至 60 周岁当年末
    var yearsToRoll = remainYears;
    var futureBalance = balance * Math.pow(1 + acctRate / 100, yearsToRoll);
    var principal = balance + backpayAmount;
    segments.forEach(function (seg) {
      var roll = Math.max(0, yearsToRoll - (seg.year - baseDate.getFullYear() + 1) + 1);
      var deposit = seg.tier + seg.subsidy;
      principal += deposit;
      futureBalance += deposit * Math.pow(1 + acctRate / 100, roll);
    });
    futureBalance += backpayAmount + autoBackpayYears * tier; // 补缴不计息不加补贴
    principal += autoBackpayYears * tier;
    var interest = Math.max(0, futureBalance - principal);

    var accountPension = futureBalance / rs.payoutMonths;
    var extraYears = Math.max(0, totalYears - rs.minYears);
    var basicPension = basicStandard + extraYears * bonus;
    var totalPension = basicPension + accountPension;

    var totalPay = futureContribution + backpayAmount + autoBackpayYears * tier;
    var historyEstimate = estimateResidentHistory(paidYears, balance, acctRate / 100);
    var totalInvest = totalPay + historyEstimate;
    var recoverMonths = monthsToRecover(totalInvest, totalPension, CONFIG.worker.bankDepositRate);

    return {
      mode: 'resident',
      personLabel: '城乡居民养老保险',
      birthYear: input.birthYear,
      birthMonth: input.birthMonth,
      currentAge: Math.floor(ageAt(birth, baseDate)),
      retireDate: retireDate,
      retireAge: rs.retireAge,
      tier: tier,
      subsidyPerYear: getResidentSubsidy(tier),
      paidYears: paidYears,
      futureYears: futureYears,
      backpayYears: backpayYears + autoBackpayYears,
      backpayAmount: round2(backpayAmount + autoBackpayYears * tier),
      autoBackpayYears: autoBackpayYears,
      totalYears: totalYears,
      extraYears: extraYears,
      futureContribution: round2(futureContribution),
      subsidyTotal: round2(subsidyTotal),
      totalPay: round2(totalPay),
      historyEstimate: round2(historyEstimate),
      totalInvest: round2(totalInvest),
      accountBalance: round2(futureBalance),
      accountPrincipal: round2(principal),
      accountInterest: round2(interest),
      basicStandard: basicStandard,
      basicPension: round2(basicPension),
      bonusPension: round2(extraYears * bonus),
      accountPension: round2(accountPension),
      transitionalPension: 0,
      totalPension: round2(totalPension),
      yearlyPension: round2(totalPension * 12),
      recoverMonths: recoverMonths,
      segments: segments,
      alreadyReceiving: alreadyReceiving
    };
  }

  function getResidentSubsidy(tier) {
    var i = CONFIG.resident.tiers.indexOf(tier);
    return i >= 0 ? CONFIG.resident.subsidies[i] : 0;
  }

  function estimateResidentHistory(paidYears, balance, rate) {
    if (!(paidYears > 0) || !(balance > 0)) return 0;
    var f = 0;
    for (var k = 1; k <= paidYears; k++) f += Math.pow(1 + rate, k);
    if (f <= 0) return 0;
    var annual = balance / f;
    var best = CONFIG.resident.tiers[0], bestDiff = Infinity;
    CONFIG.resident.tiers.forEach(function (t, i) {
      var d = Math.abs(t + CONFIG.resident.subsidies[i] - annual);
      if (d < bestDiff) { bestDiff = d; best = t; }
    });
    return best * paidYears;
  }

  /* ================= 六、对比 ================= */
  function comparePlans(list) {
    if (!list || list.length < 2) return null;
    var keys = [
      { key: 'totalInvest', label: '总投入', lowerBetter: true },
      { key: 'totalPension', label: '月养老金', lowerBetter: false },
      { key: 'recoverMonths', label: '回本月数', lowerBetter: true }
    ];
    var out = { best: {}, years30: [] };
    keys.forEach(function (k) {
      var vals = list.map(function (p) { return p.results ? p.results[k.key] : (k.lowerBetter ? Infinity : -Infinity); });
      var target = k.lowerBetter ? Math.min.apply(null, vals) : Math.max.apply(null, vals);
      out.best[k.key] = vals.indexOf(target);
    });
    // 30 年累计领取对比
    out.years30 = list.map(function (p) {
      if (!p.results) return 0;
      return round2(p.results.totalPension * 12 * 30);
    });
    return out;
  }

  var Engine = {
    CONFIG: CONFIG,
    calcWorker: calcWorker,
    calcResident: calcResident,
    calcStatutoryRetire: calcStatutoryRetire,
    calcMinContributionYears: calcMinContributionYears,
    getPaymentMonths: getPaymentMonths,
    retireAgeBounds: retireAgeBounds,
    resolveSchedule: resolveSchedule,
    getPersonType: getPersonType,
    getResidentSubsidy: getResidentSubsidy,
    comparePlans: comparePlans,
    util: {
      fmtMoney: fmtMoney, fmtInt: fmtInt, fmtYYYYMM: fmtYYYYMM,
      makeDate: makeDate, addMonths: addMonths, diffMonths: diffMonths,
      round1: round1, round2: round2, clamp: clamp, isNum: isNum
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  root.HZSHEBAO = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
