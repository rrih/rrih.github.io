/*
 * 失業保険（雇用保険・基本手当）シミュレーター 計算エンジン
 *
 * 数値の出典（令和7年8月1日〜令和8年7月31日適用）:
 *   厚生労働省 Press Release「雇用保険の基本手当日額の変更」(令和7年7月22日)
 *   https://www.mhlw.go.jp/content/11607000/001520516.pdf
 *   所定給付日数: ハローワークインターネットサービス
 *   https://www.hellowork.mhlw.go.jp/insurance/insurance_benefitdays.html
 *
 * 毎年8月1日に賃金日額の上限・下限等が改定されるため、RATES を更新すること。
 */
"use strict";

// ---- 制度定数（令和7年8月1日改定） ----
var RATES = {
  validFrom: "2025-08-01",
  validTo: "2026-07-31",
  label: "令和7年8月1日改定",
  wageMin: 3014, // 賃金日額の下限
  dailyMin: 2411, // 基本手当日額の下限
  // 給付率の屈折点（60歳未満: 80%→逓減→50%）
  k1: 5340, // ここまで80%
  k2: 13140, // ここまで逓減（0.8w-0.3((w-5340)/7800)w）
  // 60〜64歳の屈折点
  k2s: 11800,
  // 年齢区分別の上限
  caps: [
    { ageMax: 29, wageCap: 14510, dailyCap: 7255, label: "30歳未満" },
    { ageMax: 44, wageCap: 16110, dailyCap: 8055, label: "30歳以上45歳未満" },
    { ageMax: 59, wageCap: 17740, dailyCap: 8870, label: "45歳以上60歳未満" },
    { ageMax: 64, wageCap: 16940, dailyCap: 7623, label: "60歳以上65歳未満" }
  ]
};

// 所定給付日数（被保険者期間バンド: 0=1年未満, 1=1〜5年, 2=5〜10年, 3=10〜20年, 4=20年以上）
var DAYS_GENERAL = [null, 90, 90, 120, 150]; // 一般（自己都合・定年等）※1年未満は原則受給資格なし
var DAYS_SPECIFIC = {
  u30: [90, 90, 120, 180, 180],
  a30: [90, 120, 180, 210, 240],
  a35: [90, 150, 180, 240, 270],
  a45: [90, 180, 240, 270, 330],
  a60: [90, 150, 180, 210, 240]
};

// 離職理由の定義
var REASONS = {
  jiko: { label: "自己都合（転職・キャリアアップなど）", specific: false, restriction: 1, needMonths: 12 },
  kaisha: { label: "会社都合（倒産・解雇・退職勧奨など）", specific: true, restriction: 0, needMonths: 6 },
  yatoidome: { label: "雇止め（契約更新を希望したが更新されず）", specific: true, restriction: 0, needMonths: 6 },
  seito: { label: "正当な理由のある自己都合（傷病・介護・配偶者の転勤など）", specific: false, restriction: 0, needMonths: 6 },
  teinen: { label: "定年退職", specific: false, restriction: 0, needMonths: 12 }
};

function ageBandKey(age) {
  if (age < 30) return "u30";
  if (age < 35) return "a30";
  if (age < 45) return "a35";
  if (age < 60) return "a45";
  return "a60";
}

function capsFor(age) {
  for (var i = 0; i < RATES.caps.length; i++) {
    if (age <= RATES.caps[i].ageMax) return RATES.caps[i];
  }
  return null; // 65歳以上
}

// 基本手当日額の計算（1円未満切り捨て）
function dailyAllowance(wageDaily, age) {
  var cap = capsFor(age);
  if (!cap) return null;
  var w = Math.floor(Math.max(RATES.wageMin, Math.min(wageDaily, cap.wageCap)));
  var y;
  var rateText;
  if (age >= 60) {
    if (w < RATES.k1) {
      y = 0.8 * w; rateText = "80%";
    } else if (w <= RATES.k2s) {
      var a = 0.8 * w - 0.35 * ((w - RATES.k1) / (RATES.k2s - RATES.k1)) * w;
      var b = 0.05 * w + RATES.k2s * 0.4;
      y = Math.min(a, b); rateText = "80〜45%（逓減）";
    } else {
      y = 0.45 * w; rateText = "45%";
    }
  } else {
    if (w < RATES.k1) {
      y = 0.8 * w; rateText = "80%";
    } else if (w <= RATES.k2) {
      y = 0.8 * w - 0.3 * ((w - RATES.k1) / (RATES.k2 - RATES.k1)) * w;
      rateText = "80〜50%（逓減）";
    } else {
      y = 0.5 * w; rateText = "50%";
    }
  }
  y = Math.floor(y);
  y = Math.max(RATES.dailyMin, Math.min(y, cap.dailyCap));
  return {
    wageDailyRaw: wageDaily,
    wageDaily: w,
    wageCapped: wageDaily > cap.wageCap,
    daily: y,
    dailyCapped: y >= cap.dailyCap,
    rateText: rateText,
    effectiveRate: y / w,
    cap: cap
  };
}

// 所定給付日数
function benefitDays(reasonKey, age, periodBand) {
  var r = REASONS[reasonKey];
  if (!r) return null;
  if (r.specific) {
    return DAYS_SPECIFIC[ageBandKey(age)][periodBand];
  }
  return DAYS_GENERAL[periodBand];
}

// 受給資格の簡易判定メッセージ
function eligibilityNote(reasonKey, periodBand) {
  var r = REASONS[reasonKey];
  if (periodBand === 0) {
    if (r.needMonths === 12) {
      return { ok: false, msg: "自己都合・定年等の場合、原則として離職前2年間に被保険者期間が通算12か月以上必要です。1年未満では受給資格を満たさない可能性が高いです。" };
    }
    return { ok: true, msg: "会社都合等（特定受給資格者・特定理由離職者）の場合、離職前1年間に被保険者期間が通算6か月以上あれば受給資格を満たせます。" };
  }
  return { ok: true, msg: null };
}

// 給付制限（月数）: 2025年4月改正で自己都合は原則1か月（5年以内に3回以上は3か月）
function restrictionMonths(reasonKey, threeTimes) {
  var r = REASONS[reasonKey];
  if (r.restriction === 0) return 0;
  return threeTimes ? 3 : 1;
}

// ---- 日付ユーティリティ ----
function addDays(date, n) { var d = new Date(date); d.setDate(d.getDate() + n); return d; }
function addMonths(date, n) { var d = new Date(date); d.setMonth(d.getMonth() + n); return d; }
function fmtDate(d) {
  return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
}
function fmtYen(n) { return n.toLocaleString("ja-JP") + "円"; }

// 受給スケジュール（目安）
function buildSchedule(applyDate, restMonths, days, leaveDate) {
  var steps = [];
  var taiki = addDays(applyDate, 7); // 待期満了の翌日（支給対象期間の開始目安）
  steps.push({ date: applyDate, title: "ハローワークで求職申込み・離職票提出", note: "受給資格決定日。この日から7日間は待期期間（全員に適用、支給なし）" });
  steps.push({ date: taiki, title: "待期期間（7日間）満了", note: null });
  var payStart;
  if (restMonths > 0) {
    var restEnd = addMonths(taiki, restMonths);
    steps.push({ date: restEnd, title: "給付制限期間（" + restMonths + "か月）明け", note: "2025年4月の改正で原則2か月→1か月に短縮。教育訓練等の受講で制限が解除される場合あり" });
    payStart = restEnd;
  } else {
    payStart = taiki;
  }
  var firstNinteibi = addDays(applyDate, 28);
  if (restMonths > 0 && firstNinteibi < payStart) {
    firstNinteibi = addDays(payStart, 14); // 制限明け後の認定日目安
  }
  steps.push({ date: firstNinteibi, title: "失業認定日（約4週間ごと）", note: "認定後、通常1週間程度で指定口座に振込" });
  steps.push({ date: addDays(firstNinteibi, 7), title: "初回振込の目安", note: "初回は支給対象日数が少ないため満額ではありません" });
  steps.push({ date: addDays(payStart, days), title: "所定給付日数（" + days + "日）消化の目安", note: "実際は認定日サイクルにより前後します" });
  if (leaveDate) {
    var d = new Date(leaveDate);
    steps.push({ date: addDays(addMonths(d, 12), 0), title: "受給期間満了（離職日の翌日から1年）", note: "この日を過ぎると残日数があっても受給できません。申請が遅いと給付日数を使い切れない場合があります" });
  }
  return steps;
}

// ---- 入力収集・計算・描画 ----
function $(id) { return document.getElementById(id); }

function collectInputs() {
  var age = Number.parseInt($("in-age").value, 10);
  var periodBand = Number.parseInt($("in-period").value, 10);
  var reason = document.querySelector('input[name="reason"]:checked');
  var reasonKey = reason ? reason.value : "jiko";
  var threeTimes = $("in-three").checked;
  var leaveDate = $("in-leave").value || null;
  var salaries = [];
  var useDetail = $("adv-salary").open;
  if (useDetail) {
    for (var i = 1; i <= 6; i++) {
      var v = Number.parseFloat($("in-m" + i).value);
      if (!isNaN(v) && v > 0) salaries.push(v * 10000);
    }
  }
  var avg = Number.parseFloat($("in-salary").value);
  return {
    age: age,
    periodBand: periodBand,
    reasonKey: reasonKey,
    threeTimes: threeTimes,
    leaveDate: leaveDate,
    salaryMan: isNaN(avg) ? null : avg,
    salaries: salaries,
    useDetail: useDetail && salaries.length === 6
  };
}

function validate(inp) {
  var errs = [];
  if (isNaN(inp.age) || inp.age < 15 || inp.age > 80) errs.push("離職時の年齢を15〜80歳の範囲で入力してください。");
  if (!inp.useDetail && (inp.salaryMan === null || inp.salaryMan <= 0)) errs.push("離職前6か月の平均月収（額面）を入力してください。");
  if (!inp.useDetail && inp.salaryMan !== null && (inp.salaryMan < 5 || inp.salaryMan > 500)) errs.push("月収は5〜500万円の範囲で入力してください（単位は万円です）。");
  if (inp.useDetail === false && $("adv-salary").open && inp.salaries.length > 0 && inp.salaries.length < 6) {
    errs.push("6か月分の給与をすべて入力するか、詳細入力を閉じて平均月収を使ってください。");
  }
  return errs;
}

function calc(inp) {
  var totalWage = inp.useDetail
    ? inp.salaries.reduce((a, b) => a + b, 0)
    : inp.salaryMan * 10000 * 6;
  var wageDaily = totalWage / 180;
  if (inp.age >= 65) {
    return { senior: true };
  }
  var allowance = dailyAllowance(wageDaily, inp.age);
  var days = benefitDays(inp.reasonKey, inp.age, inp.periodBand);
  var elig = eligibilityNote(inp.reasonKey, inp.periodBand);
  var rest = restrictionMonths(inp.reasonKey, inp.threeTimes);
  if (days === null) {
    return { ineligible: true, eligMsg: elig.msg };
  }
  var total = allowance.daily * days;
  // 比較: 同条件で自己都合/会社都合だった場合
  var daysJiko = benefitDays("jiko", inp.age, inp.periodBand);
  var daysKaisha = benefitDays("kaisha", inp.age, inp.periodBand);
  return {
    allowance: allowance,
    days: days,
    total: total,
    monthly: allowance.daily * 28,
    rest: rest,
    elig: elig,
    compare: {
      jiko: daysJiko === null ? null : { days: daysJiko, total: allowance.daily * daysJiko, rest: restrictionMonths("jiko", inp.threeTimes) },
      kaisha: { days: daysKaisha, total: allowance.daily * daysKaisha, rest: 0 }
    }
  };
}

function esc(s) {
  var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(s).replace(/[&<>"']/g, function (c) { return map[c]; });
}

function render(inp, res) {
  var box = $("result");
  var html = "";

  if (res.senior) {
    box.innerHTML =
      '<div class="card"><h2 style="margin-top:0">65歳以上の方は「高年齢求職者給付金」の対象です</h2>' +
      '<p>65歳以上で離職した場合、基本手当（失業保険）ではなく<strong>高年齢求職者給付金</strong>（一時金）の対象になります。被保険者期間が1年以上なら基本手当日額の<strong>50日分</strong>、6か月以上1年未満なら<strong>30日分</strong>が一括で支給されます。</p>' +
      '<p>本ツールは64歳以下の基本手当を対象としています。詳しくは<a href="./faq/">FAQ</a>とお近くのハローワークでご確認ください。</p></div>';
    box.hidden = false;
    return;
  }
  if (res.ineligible) {
    box.innerHTML =
      '<div class="card"><h2 style="margin-top:0">受給資格を満たさない可能性があります</h2><p>' + esc(res.eligMsg) + '</p>' +
      '<p>被保険者期間は前職分と通算できる場合があります。正確な判定はハローワークで行われますので、離職票を持って相談してみてください。</p></div>';
    box.hidden = false;
    return;
  }

  var a = res.allowance;
  html += '<div class="result-headline"><span class="label">受給できる金額の総額（目安）</span>' +
    '<div class="amount">約' + fmtYen(res.total) + '</div>' +
    '<span class="sub">基本手当日額 ' + fmtYen(a.daily) + ' × 所定給付日数 ' + res.days + '日</span></div>';

  html += '<div class="result-grid">' +
    '<div class="result-item"><span class="k">賃金日額</span><span class="v">' + fmtYen(a.wageDaily) + (a.wageCapped ? ' <small>(上限適用)</small>' : '') + '</span></div>' +
    '<div class="result-item"><span class="k">給付率</span><span class="v">' + a.rateText + ' <small>(実効 ' + Math.round(a.effectiveRate * 100) + '%)</small></span></div>' +
    '<div class="result-item"><span class="k">基本手当日額</span><span class="v">' + fmtYen(a.daily) + (a.dailyCapped ? ' <small>(上限)</small>' : '') + '</span></div>' +
    '<div class="result-item"><span class="k">所定給付日数</span><span class="v">' + res.days + '日</span></div>' +
    '<div class="result-item"><span class="k">4週間(28日)あたり</span><span class="v">約' + fmtYen(res.monthly) + '</span></div>' +
    '<div class="result-item"><span class="k">給付制限</span><span class="v">' + (res.rest === 0 ? 'なし' : res.rest + 'か月') + '</span></div>' +
    '</div>';

  if (res.elig.msg) {
    html += '<p class="notice">' + esc(res.elig.msg) + '</p>';
  }

  // 解説
  var capNote = "";
  if (a.wageCapped) capNote = "離職前の賃金が高いため、賃金日額は年齢区分（" + a.cap.label + "）の上限 " + fmtYen(a.cap.wageCap) + " で頭打ちになっています。";
  else if (a.dailyCapped) capNote = "基本手当日額は年齢区分（" + a.cap.label + "）の上限 " + fmtYen(a.cap.dailyCap) + " が適用されています。";
  html += '<h3>この結果の読み方</h3><p style="font-size:0.9rem">' +
    '離職前6か月の賃金合計を180で割った<strong>賃金日額</strong>に、賃金水準が低いほど高くなる<strong>給付率（' + a.rateText + '）</strong>を掛けて1日あたりの支給額が決まります。' +
    capNote +
    ' 計算式の詳細は<a href="./keisanshiki/">基本手当日額の計算式</a>で確認できます。</p>';

  // スケジュール
  var applyBase = inp.leaveDate ? addDays(new Date(inp.leaveDate + "T00:00:00"), 14) : new Date();
  var sched = buildSchedule(applyBase, res.rest, res.days, inp.leaveDate);
  html += '<h3>受給スケジュールの目安' + (inp.leaveDate ? '（離職日から2週間後に申請した場合）' : '（今日申請した場合）') + '</h3>';
  html += '<ul class="schedule">';
  sched.forEach((s) => {
    html += '<li><span class="d">' + fmtDate(s.date) + '</span> ' + esc(s.title) +
      (s.note ? '<span class="note">' + esc(s.note) + '</span>' : '') + '</li>';
  });
  html += '</ul>';

  // 比較表
  html += '<h3>離職理由でこれだけ変わる</h3><div class="table-scroll"><table class="data"><caption>同じ年齢・賃金・加入期間での比較（目安）</caption>' +
    '<thead><tr><th>離職理由</th><th class="num">給付日数</th><th class="num">総額</th><th>給付制限</th></tr></thead><tbody>';
  var isJiko = (inp.reasonKey === "jiko" || inp.reasonKey === "teinen" || inp.reasonKey === "seito");
  if (res.compare.jiko) {
    html += '<tr' + (isJiko ? ' class="hl"' : '') + '><td>自己都合</td><td class="num">' + res.compare.jiko.days + '日</td><td class="num">約' + fmtYen(res.compare.jiko.total) + '</td><td>' + res.compare.jiko.rest + 'か月</td></tr>';
  }
  html += '<tr' + (!isJiko ? ' class="hl"' : '') + '><td>会社都合（特定受給資格者）</td><td class="num">' + res.compare.kaisha.days + '日</td><td class="num">約' + fmtYen(res.compare.kaisha.total) + '</td><td>なし</td></tr>';
  html += '</tbody></table></div>';
  html += '<p style="font-size:0.84rem;color:var(--c-text-sub)">退職勧奨やハラスメント、残業過多など、実態が「会社都合」に当たるケースでは離職理由の判定が変わることがあります。離職票の離職理由に異議がある場合はハローワークで申し立てできます。</p>';

  html += '<div class="actions">' +
    '<button type="button" class="btn-ghost" id="btn-share">結果を共有</button>' +
    '<button type="button" class="btn-ghost" id="btn-copy">URLをコピー</button>' +
    '<button type="button" class="btn-ghost" onclick="window.print()">印刷・PDF保存</button>' +
    '</div>';

  html += '<p class="notice">この結果は' + RATES.label + '（適用期間: 〜2026年7月31日）の計算式・上限額に基づく概算です。実際の支給額・受給資格はハローワークが離職票に基づいて決定します。賞与は賃金日額の計算に含まれません。' +
    '出典: <a href="https://www.mhlw.go.jp/stf/newpage_59748.html" target="_blank" rel="noopener">厚生労働省「雇用保険の基本手当日額の変更」</a>・' +
    '<a href="https://www.hellowork.mhlw.go.jp/insurance/insurance_benefitdays.html" target="_blank" rel="noopener">ハローワークインターネットサービス「基本手当の所定給付日数」</a></p>';

  box.innerHTML = html;
  box.hidden = false;
  bindResultActions();
  box.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---- URL同期・保存 ----
function stateToParams(inp) {
  var p = new URLSearchParams();
  p.set("a", inp.age);
  p.set("p", inp.periodBand);
  p.set("r", inp.reasonKey);
  if (inp.salaryMan !== null) p.set("s", inp.salaryMan);
  if (inp.threeTimes) p.set("t3", "1");
  if (inp.leaveDate) p.set("d", inp.leaveDate);
  if (inp.useDetail) p.set("m", inp.salaries.map((v) => v / 10000).join(","));
  return p;
}

function applyParams(p) {
  var has = false;
  if (p.get("a")) { $("in-age").value = p.get("a"); has = true; }
  if (p.get("p") !== null && p.get("p") !== "") { $("in-period").value = p.get("p"); }
  if (p.get("s")) { $("in-salary").value = p.get("s"); has = true; }
  if (p.get("r") && REASONS[p.get("r")]) {
    var el = document.querySelector('input[name="reason"][value="' + p.get("r") + '"]');
    if (el) el.checked = true;
  }
  if (p.get("t3") === "1") $("in-three").checked = true;
  if (p.get("d")) $("in-leave").value = p.get("d");
  if (p.get("m")) {
    var parts = p.get("m").split(",");
    if (parts.length === 6) {
      $("adv-salary").open = true;
      parts.forEach((v, i) => { $("in-m" + (i + 1)).value = v; });
      has = true;
    }
  }
  return has;
}

function saveLocal(inp) {
  try { localStorage.setItem("shk_state", stateToParams(inp).toString()); } catch (e) { /* private mode */ }
}
function loadLocal() {
  try { return localStorage.getItem("shk_state"); } catch (e) { return null; }
}

function bindResultActions() {
  var share = $("btn-share");
  var copy = $("btn-copy");
  if (share) {
    share.addEventListener("click", () => {
      var data = { title: "失業保険シミュレーター", text: "失業保険（基本手当）がいくら・いつから・何日もらえるかの試算結果", url: location.href };
      if (navigator.share) { navigator.share(data).catch(() => {}); }
      else { copyUrl(share); }
    });
  }
  if (copy) {
    copy.addEventListener("click", () => { copyUrl(copy); });
  }
}
function copyUrl(btn) {
  navigator.clipboard.writeText(location.href).then(() => {
    var t = btn.textContent;
    btn.textContent = "コピーしました";
    setTimeout(() => { btn.textContent = t; }, 1600);
  });
}

// ---- 初期化 ----
function runCalc(pushUrl) {
  var inp = collectInputs();
  var errs = validate(inp);
  var errBox = $("form-errors");
  if (errs.length) {
    errBox.innerHTML = errs.map((e) => "<div>" + esc(e) + "</div>").join("");
    errBox.hidden = false;
    $("result").hidden = true;
    return;
  }
  errBox.hidden = true;
  var res = calc(inp);
  render(inp, res);
  if (pushUrl !== false) {
    var qs = stateToParams(inp).toString();
    history.replaceState(null, "", location.pathname + "?" + qs);
  }
  saveLocal(inp);
}

document.addEventListener("DOMContentLoaded", () => {
  var form = $("calc-form");
  if (!form) return;
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    runCalc();
  });

  // URL → 復元（なければ localStorage）
  var p = new URLSearchParams(location.search);
  var restored = applyParams(p);
  if (!restored) {
    var saved = loadLocal();
    if (saved) applyParams(new URLSearchParams(saved));
  } else {
    runCalc(false);
  }
});
