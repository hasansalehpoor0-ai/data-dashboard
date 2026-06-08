let globalData = null;
let isNormalized = false;
let charts = {}; 

const DIMS = ['I', 'B', 'T', 'SE'];
const CATEGORIES = typeof categoryMatrix !== 'undefined' ? Object.keys(categoryMatrix) : [];

$('#btn-load').click(async function() {
    let btn = $(this);
    let origHtml = btn.html();
    btn.html('<i class="fas fa-spinner fa-spin"></i> در حال پردازش...').prop('disabled', true);
    $('#status-msg').text('لطفاً فایل را انتخاب کنید...').removeClass().addClass('text-info');
    
    let response = await eel.load_excel_file()();
    
    btn.html(origHtml).prop('disabled', false);
    
    if (response.status === 'success') {
        globalData = response.data;
        $('#status-msg').text('داده‌ها با موفقیت لود شدند!').removeClass().addClass('text-success');
        $('#btn-normalize').fadeIn();
        $('#btn-export-json').fadeIn(); // نمایش دکمه ذخیره JSON

        // استخراج اطلاعات کاربری از ستون‌های C, D, E و نمایش در هدر
        let userInfoName = globalData['C'] || globalData['Name'] || globalData['نام'] || 'کاربر ناشناس';
        let userInfoD = globalData['D'] || '';
        let userInfoE = globalData['E'] || '';
        
        $('#user-info-display').html(`
            <span class="badge bg-light text-dark border me-1 mb-1"><i class="fas fa-user text-primary me-1"></i> ${userInfoName}</span>
            ${userInfoD ? `<span class="badge bg-light text-dark border me-1 mb-1">${userInfoD}</span>` : ''}
            ${userInfoE ? `<span class="badge bg-light text-dark border mb-1">${userInfoE}</span>` : ''}
        `);

        isNormalized = false;
        updateNormalizeButton();
        processAndRender();
    } else {
        $('#status-msg').text('خطا: ' + response.message).removeClass().addClass('text-danger');
    }
});

// عملکرد دکمه ذخیره JSON
$('#btn-export-json').click(function() {
    if (!globalData) return;
    
    // تبدیل داده‌ها به رشته JSON
    const jsonString = JSON.stringify(globalData, null, 2);
    
    // ایجاد یک Blob و لینک دانلود
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // نامگذاری فایل (مثلاً با استفاده از نام کاربر یا زمان)
    const userName = globalData['C'] || 'user';
    a.download = `${userName}_data.json`;
    
    // شبیه‌سازی کلیک برای دانلود
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

$('#btn-normalize').click(function() {
    if (!globalData) return;
    isNormalized = !isNormalized;
    updateNormalizeButton();
    processAndRender();
});

function updateNormalizeButton() {
    if (isNormalized) {
        $('#btn-normalize span').text('نمایش نمرات نسبی (P%)');
        $('#btn-normalize i').removeClass('fa-balance-scale').addClass('fa-undo');
        $('#mode-badge').removeClass('bg-secondary').addClass('bg-primary').text('استاندارد مقایسه‌ای (Z-Score)');
    } else {
        $('#btn-normalize span').text('اعمال استاندارد Z-Score');
        $('#btn-normalize i').removeClass('fa-undo').addClass('fa-balance-scale');
        $('#mode-badge').removeClass('bg-primary').addClass('bg-secondary').text('نمرات نسبی ایپساتیو (Percentile)');
    }
}

function createOrUpdateChart(id, options) {
    if (charts[id]) charts[id].destroy();
    charts[id] = new ApexCharts(document.querySelector(id), options);
    charts[id].render();
}

function processAndRender() {
    if (!globalData) return;
    
    let scores = {};
    for (const [key, value] of Object.entries(globalData)) {
        scores[key.toUpperCase()] = parseFloat(value) || 0;
    }

    // ============================================
    // اعتبارسنجی 
    // ============================================
    let attScore = 0;
    if (scores['Q-ATT-1'] === 5) attScore += 1;
    if (scores['Q-ATT-2'] === 3) attScore += 1;
    let s_att = attScore / 2.0;

    let v = 0.0;
    let s_rev = 0.0;
    let s_dup = 0.0;
    let validityStatus = "";
    
    if (s_att === 0) {
        v = 0.0;
        validityStatus = "INVALID";
    } else {
        let revPairs = [{rev: 'Q-REV-1', anchor: 'TR-2'}, {rev: 'Q-REV-2', anchor: 'R-CRE-2'}, {rev: 'Q-REV-3', anchor: 'R-CRE-3'}];
        s_rev = revPairs.map(p => 1 - (Math.abs(scores[p.anchor] + scores[p.rev] - 6) / 4.0)).reduce((a,b)=>a+b,0) / 3.0;

        let dupPairs = [{dup: 'Q-DUP-2', anchor: 'RO-4'}, {dup: 'Q-DUP-1', anchor: 'TS-4'}, {dup: 'Q-DUP-3', anchor: 'G-LIN-3'}];
        s_dup = dupPairs.map(p => 1 - (Math.abs(scores[p.dup] - scores[p.anchor]) / 4.0)).reduce((a,b)=>a+b,0) / 3.0;

        v = (0.40 * s_att) + (0.35 * s_rev) + (0.25 * s_dup);
        if (v >= 0.70) validityStatus = "VALID";
        else if (v >= 0.50) validityStatus = "SUSPICIOUS";
        else validityStatus = "INVALID";
    }

    $('#validation-section').fadeIn();
    let banner = $('#validation-banner');
    let vPercent = (v * 100).toFixed(1);
    
    if (validityStatus === "INVALID") {
        banner.removeClass('alert-success alert-warning').addClass('alert-danger')
              .html(`<i class="fas fa-times-circle me-2 fs-4"></i> <div><strong>پاسخنامه نامعتبر:</strong> به دلیل وجود تناقضات بالا و عدم دقت در پاسخ به سوالات کنترل، نتایج قابل اتکا نیستند و پیشنهاد می‌شود آزمون مجدداً با دقت بیشتر انجام شود.</div>`);
        $('#dashboard-content').fadeOut();
    } else if (validityStatus === "SUSPICIOUS") {
        banner.removeClass('alert-danger alert-success').addClass('alert-warning')
              .html(`<i class="fas fa-exclamation-triangle me-2 fs-4"></i> <div><strong>هشدار اعتبار:</strong> تناقضات مشکوکی در برخی از پاسخ‌ها دیده می‌شود. پیشنهاد می‌شود تحلیل و استناد به این نتایج با احتیاط انجام شود.</div>`);
        $('#dashboard-content').fadeIn();
    } else {
        banner.removeClass('alert-danger alert-warning').addClass('alert-success')
              .html(`<i class="fas fa-check-circle me-2 fs-4"></i> <div><strong>پاسخنامه کاملاً معتبر:</strong> داده‌ها از نظر روان‌سنجی معتبر و سازگار هستند. می‌توانید با اطمینان به نتایج این تحلیل اتکا کنید.</div>`);
        $('#dashboard-content').fadeIn();
    }

    // نمودار ضریب اعتبار
    createOrUpdateChart('#validityGaugeChart', {
        series: [parseFloat(vPercent)],
        chart: { type: 'radialBar', height: 180, fontFamily: 'Vazirmatn' },
        plotOptions: {
            radialBar: {
                hollow: { size: '55%' },
                dataLabels: { 
                    name: { show: false }, 
                    value: { show: true, fontSize: '20px', fontWeight: 'bold', offsetY: 8, formatter: function (val) { return val + "%" } } 
                }
            }
        },
        colors: [validityStatus === "VALID" ? '#1cc88a' : (validityStatus === "SUSPICIOUS" ? '#f6c23e' : '#e74a3b')]
    });

    // نمودار شاخص پایایی و ثبات
    let reliabilityVal = s_att === 0 ? 0.0 : ((s_rev + s_dup) / 2.0) * 100;
    createOrUpdateChart('#reliabilityGaugeChart', {
        series: [parseFloat(reliabilityVal.toFixed(1))],
        chart: { type: 'radialBar', height: 180, fontFamily: 'Vazirmatn' },
        plotOptions: {
            radialBar: {
                hollow: { size: '55%' },
                dataLabels: { 
                    name: { show: false }, 
                    value: { show: true, fontSize: '20px', fontWeight: 'bold', offsetY: 8, formatter: function (val) { return val + "%" } } 
                }
            }
        },
        colors: [reliabilityVal >= 70 ? '#4e73df' : (reliabilityVal >= 50 ? '#f6c23e' : '#e74a3b')]
    });

    if (validityStatus === "INVALID") return;

    // ============================================
    // پردازش نقش‌های چهارگانه
    // ============================================
    let rawRoleScores = { "R-EXE": 0, "R-SUP": 0, "R-CRE": 0, "R-INTRA": 0 };
    let R_hat = {};
    let roleRawPercents = {};

    for (let code in scores) {
        if (code.startsWith('Q-')) continue; 
        let r = scores[code]; 
        if (!(r >= 1 && r <= 5)) continue; 
        let a_i = (r - 1) / 4.0; 

        if (typeof roleWeights !== 'undefined' && roleWeights[code]) {
            for (let role in rawRoleScores) rawRoleScores[role] += a_i * roleWeights[code][role];
        }
    }

    let normalizedRoleScores = {};
    for(let role in rawRoleScores) {
        let m_weight = (typeof maxWeights !== 'undefined' && maxWeights[role]) ? maxWeights[role] : 1;
        R_hat[role] = rawRoleScores[role] / m_weight; 
        roleRawPercents[role] = (typeof maxWeights !== 'undefined' && maxWeights[role]) ? (rawRoleScores[role] / maxWeights[role]) * 100 : 0;
    }

    if (isNormalized) {
        let vals = Object.values(roleRawPercents);
        let rMean = vals.reduce((a, b) => a + b, 0) / vals.length;
        let rStd = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - rMean, 2), 0) / vals.length) || 1;
        
        let zScores = {};
        for (let role in roleRawPercents) zScores[role] = (roleRawPercents[role] - rMean) / rStd;
        let minZ = Math.min(...Object.values(zScores));
        
        let shiftedZ = {};
        for (let role in zScores) shiftedZ[role] = zScores[role] - minZ;
        let maxZ = Math.max(...Object.values(shiftedZ), 0.0001);
        for (let role in shiftedZ) normalizedRoleScores[role] = (shiftedZ[role] / maxZ) * 100;
    } else {
        for (let role in roleRawPercents) normalizedRoleScores[role] = roleRawPercents[role];
    }

    let sortedRoles = Object.keys(normalizedRoleScores).sort((a, b) => normalizedRoleScores[b] - normalizedRoleScores[a]);
    let globalTopRole = sortedRoles[0] || "R-EXE";
    let roleLabelsArr = sortedRoles.map(role => typeof LABELS !== 'undefined' && LABELS["ROLE_" + role] ? LABELS["ROLE_" + role] : role);
    let roleValuesArr = sortedRoles.map(role => parseFloat(normalizedRoleScores[role].toFixed(1)));

    if (sortedRoles.length > 0) {
        let topRole = sortedRoles[0];
        let secRole = sortedRoles[1];
        let scoreGap = normalizedRoleScores[topRole] - normalizedRoleScores[secRole];

        $('#top-role').text(typeof LABELS !== 'undefined' && LABELS["ROLE_" + topRole] ? LABELS["ROLE_" + topRole] : topRole);
        $('#sec-role').text(typeof LABELS !== 'undefined' && LABELS["ROLE_" + secRole] ? LABELS["ROLE_" + secRole] : secRole);
        $('#role-gap').text(scoreGap.toFixed(1) + " امتیاز");

        // نمودار رادار
        createOrUpdateChart('#roleRadarChart', {
            series: [{ name: isNormalized ? 'امتیاز نقش (Z-Score)' : 'امتیاز نقش (۰-۱۰۰)', data: [ normalizedRoleScores["R-EXE"].toFixed(1), normalizedRoleScores["R-SUP"].toFixed(1), normalizedRoleScores["R-CRE"].toFixed(1), normalizedRoleScores["R-INTRA"].toFixed(1) ] }],
            chart: { type: 'radar', height: 350, fontFamily: 'Vazirmatn' },
            labels: ['اجرایی', 'پشتیبانی', 'خلاق', 'درون‌فردی'],
            stroke: { width: 2 }, fill: { opacity: 0.2 }, colors: ['#4e73df'],
            yaxis: { show: false, min: 0, max: 100 }
        });

        // نمودار میله‌ای
        createOrUpdateChart('#roleBarChart', {
            series: [{ name: isNormalized ? 'امتیاز Z-Score نسبی' : 'امتیاز (درصد)', data: roleValuesArr }],
            chart: { type: 'bar', height: 350, fontFamily: 'Vazirmatn' },
            plotOptions: { bar: { borderRadius: 4, horizontal: false, distributed: true } },
            colors: ['#1cc88a', '#f6c23e', '#4e73df', '#e74a3b'],
            dataLabels: { enabled: true, formatter: function (val) { return val + "%" } },
            xaxis: { categories: roleLabelsArr },
            legend: { show: false }, yaxis: { min: 0, max: 100 }
        });
        
        // دونات
        createOrUpdateChart('#roleDonutChart', {
            series: roleValuesArr,
            chart: { type: 'donut', height: 350, fontFamily: 'Vazirmatn' },
            labels: roleLabelsArr,
            colors: ['#1cc88a', '#f6c23e', '#4e73df', '#e74a3b'],
            dataLabels: { enabled: true, formatter: function (val) { return val.toFixed(1) + "%" } },
            legend: { position: 'bottom' }
        });

        // مساحت قطبی
        createOrUpdateChart('#rolePolarChart', {
            series: roleValuesArr,
            chart: { type: 'polarArea', height: 350, fontFamily: 'Vazirmatn' },
            labels: roleLabelsArr,
            colors: ['#1cc88a', '#f6c23e', '#4e73df', '#e74a3b'],
            fill: { opacity: 0.8 },
            legend: { position: 'bottom' }
        });
    }

    // ============================================
    // پردازش محاسبات هوش‌های چندگانه
    // ============================================
    let miScores = { LIN: 0, LOG: 0, SPA: 0, MUS: 0, BOD: 0, INTER: 0, INTRA: 0 };
    let miDenominators = { LIN: 0, LOG: 0, SPA: 0, MUS: 0, BOD: 0, INTER: 0, INTRA: 0 };
    let I_hat = {}; 
    let miRawPercents = {};

    for (let code in MI_WEIGHTS) {
        let r = scores[code];
        if (r >= 1 && r <= 5) {
            let a_i = (r - 1) / 4.0;
            for (let k in miScores) {
                miScores[k] += (MI_WEIGHTS[code][k] || 0) * a_i;
                miDenominators[k] += (MI_WEIGHTS[code][k] || 0);
            }
        }
    }

    let miFinalScores = {};
    for (let k in miScores) {
        miRawPercents[k] = miDenominators[k] > 0 ? (miScores[k] / miDenominators[k]) * 100 : 0;
        let mi_m_weight = (typeof MI_MAX_WEIGHTS !== 'undefined' && MI_MAX_WEIGHTS[k]) ? MI_MAX_WEIGHTS[k] : miDenominators[k];
        I_hat[k] = mi_m_weight > 0 ? miScores[k] / mi_m_weight : 0;
    }

    let miMeanValue = 0;
    if (isNormalized) {
        let miVals = Object.values(miRawPercents);
        let miMean = miVals.reduce((a, b) => a + b, 0) / miVals.length;
        let miStd = Math.sqrt(miVals.reduce((a, b) => a + Math.pow(b - miMean, 2), 0) / miVals.length) || 1;
        
        let zScores = {};
        for (let k in miRawPercents) zScores[k] = (miRawPercents[k] - miMean) / miStd;
        let minZ = Math.min(...Object.values(zScores));
        let shiftedZ = {};
        for (let k in zScores) shiftedZ[k] = zScores[k] - minZ;
        let maxZ = Math.max(...Object.values(shiftedZ), 0.0001);
        for (let k in shiftedZ) miFinalScores[k] = (shiftedZ[k] / maxZ) * 100;
    } else {
        for (let k in miRawPercents) miFinalScores[k] = miRawPercents[k];
    }
    
    let allMiVals = Object.values(miFinalScores);
    miMeanValue = allMiVals.reduce((a,b)=>a+b,0)/allMiVals.length;

    let sortedMI = Object.keys(miFinalScores).sort((a, b) => miFinalScores[b] - miFinalScores[a]);
    let globalTopIntel = sortedMI[0] || "LOG";
    
    $('#top-mi-role').text(typeof MI_LABELS !== 'undefined' && MI_LABELS[sortedMI[0]] ? MI_LABELS[sortedMI[0]] : sortedMI[0]);
    $('#sec-mi-role').text(typeof MI_LABELS !== 'undefined' && MI_LABELS[sortedMI[1]] ? MI_LABELS[sortedMI[1]] : sortedMI[1]);

    createOrUpdateChart('#miRadarChart', {
        series: [{ name: isNormalized ? 'نمره هوش (Z-Score)' : 'نمره هوش', data: Object.keys(MI_LABELS || miFinalScores).map(k => parseFloat(miFinalScores[k].toFixed(1))) }],
        chart: { type: 'radar', height: 350, fontFamily: 'Vazirmatn' },
        labels: Object.keys(MI_LABELS || miFinalScores).map(k => MI_LABELS && MI_LABELS[k] ? MI_LABELS[k] : k),
        stroke: { width: 2 }, fill: { opacity: 0.3 }, colors: ['#1cc88a'], yaxis: { show: false, min: 0, max: 100 }
    });

    createOrUpdateChart('#miBarChart', {
        series: [{ name: isNormalized ? 'نمره Z-Score' : 'نمره', data: sortedMI.map(k => parseFloat(miFinalScores[k].toFixed(1))) }],
        chart: { type: 'bar', height: 350, fontFamily: 'Vazirmatn' },
        plotOptions: { bar: { horizontal: true, borderRadius: 4, colors: { ranges: [ { from: 0, to: 39.9, color: '#e74a3b' }, { from: 40, to: 69.9, color: '#4e73df' }, { from: 70, to: 100, color: '#1cc88a' } ] } } },
        dataLabels: { enabled: true, formatter: function (val) { return val + "%" } },
        xaxis: { categories: sortedMI.map(k => MI_LABELS && MI_LABELS[k] ? MI_LABELS[k] : k), min: 0, max: 100 },
        annotations: { xaxis: [{ x: 50, borderColor: '#333', strokeDashArray: 4, label: { style: { color: '#fff', background: '#333' }, text: 'میانه (50)' } }] }
    });

    // میله‌ای شعاعی
    createOrUpdateChart('#miRadialBarChart', {
        series: sortedMI.map(k => parseFloat(miFinalScores[k].toFixed(1))),
        chart: { type: 'radialBar', height: 350, fontFamily: 'Vazirmatn' },
        plotOptions: { radialBar: { dataLabels: { name: { fontSize: '22px', }, value: { fontSize: '16px', } } } },
        labels: sortedMI.map(k => MI_LABELS && MI_LABELS[k] ? MI_LABELS[k] : k)
    });

    // رادار با خط مبنا
    createOrUpdateChart('#miRadarBenchmarkChart', {
        series: [
            { name: 'نمره کاربر', data: Object.keys(MI_LABELS || miFinalScores).map(k => parseFloat(miFinalScores[k].toFixed(1))) },
            { name: 'میانگین', data: Object.keys(MI_LABELS || miFinalScores).map(() => parseFloat(miMeanValue.toFixed(1))) }
        ],
        chart: { type: 'radar', height: 350, fontFamily: 'Vazirmatn' },
        labels: Object.keys(MI_LABELS || miFinalScores).map(k => MI_LABELS && MI_LABELS[k] ? MI_LABELS[k] : k),
        stroke: { width: 2 }, fill: { opacity: 0.1 }, colors: ['#4e73df', '#858796'], yaxis: { show: false, min: 0, max: 100 }
    });


    // ============================================
    // پردازش حوزه‌ها
    // ============================================
    let finalCategories = ['TR', 'TS', 'NA', 'FA', 'PO', 'RO'];
    let categoryScores = { TR: { I: 0, SE: 0 }, TS: { I: 0, SE: 0 }, NA: { I: 0, SE: 0 }, FA: { I: 0, SE: 0 }, PO: { I: 0, SE: 0 }, RO: { I: 0, SE: 0 } };
    let rawCategoryScores = { TR: { I: 0, SE: 0 }, TS: { I: 0, SE: 0 }, NA: { I: 0, SE: 0 }, FA: { I: 0, SE: 0 }, PO: { I: 0, SE: 0 }, RO: { I: 0, SE: 0 } };

    if (typeof domainWeights !== 'undefined') {
        const channels = ['INT_TR', 'INT_TS', 'INT_RO', 'INT_FA', 'INT_NA', 'INT_PO', 'SE_TR', 'SE_TS', 'SE_RO', 'SE_FA', 'SE_NA', 'SE_PO'];
        let num = {}, den = {};
        channels.forEach(c => { num[c] = 0; den[c] = 0; });

        for (let code in domainWeights) {
            let r = scores[code];
            if (!(r >= 1 && r <= 5)) continue; 
            let a = (r - 1) / 4.0; 
            let row = domainWeights[code];
            for (let c in row) { let w = row[c] || 0; num[c] += w * a; den[c] += w; }
        }

        let out = {};
        channels.forEach(c => out[c] = den[c] > 0 ? (num[c] / den[c]) * 100 : 0);
        let rawOut = {...out}; 

        if (isNormalized) {
            let intChannels = finalCategories.map(c => 'INT_' + c);
            let intVals = intChannels.map(c => out[c]);
            let intMean = intVals.reduce((a, b) => a + b, 0) / intVals.length;
            let intStd = Math.sqrt(intVals.reduce((a, b) => a + Math.pow(b - intMean, 2), 0) / intVals.length) || 1;
            
            let intShifted = {};
            intChannels.forEach(c => intShifted[c] = (out[c] - intMean) / intStd);
            let minInt = Math.min(...Object.values(intShifted));
            for (let c in intShifted) intShifted[c] -= minInt;
            let maxInt = Math.max(...Object.values(intShifted), 0.0001);

            let seChannels = finalCategories.map(c => 'SE_' + c);
            let seVals = seChannels.map(c => out[c]);
            let seMean = seVals.reduce((a, b) => a + b, 0) / seVals.length;
            let seStd = Math.sqrt(seVals.reduce((a, b) => a + Math.pow(b - seMean, 2), 0) / seVals.length) || 1;
            
            let seShifted = {};
            seChannels.forEach(c => seShifted[c] = (out[c] - seMean) / seStd);
            let minSe = Math.min(...Object.values(seShifted));
            for (let c in seShifted) seShifted[c] -= minSe;
            let maxSe = Math.max(...Object.values(seShifted), 0.0001);

            intChannels.forEach(c => out[c] = (intShifted[c] / maxInt) * 100);
            seChannels.forEach(c => out[c] = (seShifted[c] / maxSe) * 100);
        }
        
        finalCategories.forEach(C => {
            categoryScores[C] = { I: out['INT_' + C] || 0, SE: out['SE_' + C] || 0 };
            rawCategoryScores[C] = { I: rawOut['INT_' + C] || 0, SE: rawOut['SE_' + C] || 0 };
        });

        let sortedInterest = [...finalCategories].sort((a, b) => categoryScores[b].I - categoryScores[a].I);
        let sortedEfficacy = [...finalCategories].sort((a, b) => categoryScores[b].SE - categoryScores[a].SE);
        $('#top-interest').text(typeof LABELS !== 'undefined' && LABELS[sortedInterest[0]] ? LABELS[sortedInterest[0]] : sortedInterest[0]);
        $('#top-efficacy').text(typeof LABELS !== 'undefined' && LABELS[sortedEfficacy[0]] ? LABELS[sortedEfficacy[0]] : sortedEfficacy[0]);

        createOrUpdateChart('#domainRadarChart', {
            series: [ 
                { name: isNormalized ? 'علاقه (Z-Score)' : 'علاقه (Interest)', data: finalCategories.map(C => parseFloat(categoryScores[C].I.toFixed(1))) }, 
                { name: isNormalized ? 'خودکارآمدی (Z-Score)' : 'خودکارآمدی (Self-Efficacy)', data: finalCategories.map(C => parseFloat(categoryScores[C].SE.toFixed(1))) } 
            ],
            chart: { type: 'radar', height: 350, fontFamily: 'Vazirmatn' },
            labels: finalCategories.map(C => typeof LABELS !== 'undefined' && LABELS[C] ? LABELS[C] : C),
            stroke: { width: 2 }, fill: { opacity: 0.3 }, colors: ['#4e73df', '#f6c23e'], markers: { size: 4 }, yaxis: { show: false, min: 0, max: 100 }, legend: { position: 'bottom' }
        });

        createOrUpdateChart('#domainDivergingBarChart', {
            series: [
                { name: isNormalized ? 'علاقه (Z-Score)' : 'علاقه (Interest)', data: finalCategories.map(C => parseFloat(categoryScores[C].I.toFixed(1))) },
                { name: isNormalized ? 'خودکارآمدی (Z-Score)' : 'خودکارآمدی (Self-Efficacy)', data: finalCategories.map(C => parseFloat(categoryScores[C].SE.toFixed(1))).map(v => -v) }
            ],
            chart: { type: 'bar', stacked: true, height: 350, fontFamily: 'Vazirmatn' },
            colors: ['#4e73df', '#f6c23e'], plotOptions: { bar: { horizontal: true, barHeight: '80%' } },
            dataLabels: { enabled: true, formatter: function(val) { return Math.abs(val) + "%"; } },
            xaxis: { categories: finalCategories.map(C => typeof LABELS !== 'undefined' && LABELS[C] ? LABELS[C] : C), min: -100, max: 100, labels: { formatter: function(val) { return Math.abs(Math.round(val)) + "%"; } } },
            yaxis: { title: { text: '' } }, tooltip: { y: { formatter: function(val) { return Math.abs(val) + "%"; } } }, legend: { position: 'top' }
        });

        // نمودار دمبل (استفاده از Range Bar)
        let dumbbellData = finalCategories.map(C => {
            let minVal = Math.min(categoryScores[C].I, categoryScores[C].SE);
            let maxVal = Math.max(categoryScores[C].I, categoryScores[C].SE);
            return { x: LABELS[C]||C, y: [parseFloat(minVal.toFixed(1)), parseFloat(maxVal.toFixed(1))] };
        });
        createOrUpdateChart('#interestDumbbellChart', {
            series: [{ data: dumbbellData }],
            chart: { type: 'rangeBar', height: 350, fontFamily: 'Vazirmatn' },
            plotOptions: { bar: { horizontal: true, isDumbbell: true, dumbbellColors: [['#4e73df', '#f6c23e']] } },
            legend: { show: false }, xaxis: { min: 0, max: 100 }
        });

        // نقشه حرارتی
        let heatSeries = [
            { name: 'علاقه', data: finalCategories.map(C => ({ x: LABELS[C]||C, y: parseFloat(categoryScores[C].I.toFixed(1)) })) },
            { name: 'خودکارآمدی', data: finalCategories.map(C => ({ x: LABELS[C]||C, y: parseFloat(categoryScores[C].SE.toFixed(1)) })) }
        ];
        createOrUpdateChart('#interestHeatmapChart', {
            series: heatSeries,
            chart: { type: 'heatmap', height: 350, fontFamily: 'Vazirmatn' },
            dataLabels: { enabled: true }, colors: ["#008FFB"]
        });
    }

    // ============================================
    // مدل ترکیبی نهایی
    // ============================================
    let M_c = {};
    let D_c_val = {};
    
    finalCategories.forEach(d => {
        let numA = 0, denA = 0;
        if (typeof combinedConfig !== 'undefined' && combinedConfig.weightsA) {
            for(let intel in I_hat) { let w = combinedConfig.weightsA[d][intel] || 0; numA += w * I_hat[intel]; denA += w; }
            for(let role in R_hat) { let w = combinedConfig.weightsA[d][role] || 0; numA += w * R_hat[role]; denA += w; }
        }
        M_c[d] = denA > 0 ? numA / denA : 0;
    });

    let denB = {};
    finalCategories.forEach(d => { D_c_val[d] = 0; denB[d] = 0; });

    if (typeof combinedConfig !== 'undefined' && combinedConfig.itemsB) {
        for(let item in combinedConfig.itemsB) {
            let qScore = scores[item];
            if (qScore >= 1 && qScore <= 5) {
                let a_i = (qScore - 1) / 4.0;
                let d = combinedConfig.itemsB[item].domain;
                let w = combinedConfig.itemsB[item].weight;
                D_c_val[d] += w * a_i; denB[d] += w;
            }
        }
    }
    finalCategories.forEach(d => D_c_val[d] = denB[d] > 0 ? D_c_val[d] / denB[d] : 0);

    let F_c = {};
    let w_A = 0.5, w_B = 0.5;
    let F_rel = {};
    
    if (isNormalized) {
        let M_values = Object.values(M_c);
        let D_values = Object.values(D_c_val);
        let M_mean = M_values.reduce((a, b) => a + b, 0) / M_values.length;
        let M_std = Math.sqrt(M_values.reduce((a, b) => a + Math.pow(b - M_mean, 2), 0) / M_values.length) || 1;
        let D_mean = D_values.reduce((a, b) => a + b, 0) / D_values.length;
        let D_std = Math.sqrt(D_values.reduce((a, b) => a + Math.pow(b - D_mean, 2), 0) / D_values.length) || 1;

        finalCategories.forEach(d => { F_c[d] = (w_A * ((M_c[d] - M_mean) / M_std)) + (w_B * ((D_c_val[d] - D_mean) / D_std)); });
        let min_F = Math.min(...Object.values(F_c));
        let F_shifted = {};
        finalCategories.forEach(d => F_shifted[d] = F_c[d] - min_F);
        let max_F = Math.max(...Object.values(F_shifted), 0.0001);
        finalCategories.forEach(d => F_rel[d] = (F_shifted[d] / max_F) * 100);
    } else {
        finalCategories.forEach(d => { F_c[d] = (w_A * M_c[d]) + (w_B * D_c_val[d]); F_rel[d] = F_c[d] * 100; });
    }

    let sortedFinalDomains = finalCategories.slice().sort((a, b) => F_rel[b] - F_rel[a]);
    $('#top-domain-role').text(typeof LABELS !== 'undefined' && LABELS[sortedFinalDomains[0]] ? LABELS[sortedFinalDomains[0]] : sortedFinalDomains[0]);

    $('#top-talent').text(typeof LABELS !== 'undefined' && LABELS[sortedFinalDomains[0]] ? LABELS[sortedFinalDomains[0]] : sortedFinalDomains[0]);
    $('#sec-talent').text(typeof LABELS !== 'undefined' && LABELS[sortedFinalDomains[1]] ? LABELS[sortedFinalDomains[1]] : sortedFinalDomains[1]);

    createOrUpdateChart('#combinedFinalRadarChart', {
        series: [{ name: isNormalized ? 'امتیاز ترکیبی نهایی (Z-Score)' : 'امتیاز ترکیبی نهایی (درصد واقعی)', data: finalCategories.map(c => parseFloat(F_rel[c].toFixed(1))) }],
        chart: { type: 'radar', height: 350, fontFamily: 'Vazirmatn' },
        labels: finalCategories.map(c => typeof LABELS !== 'undefined' && LABELS[c] ? LABELS[c] : c),
        stroke: { width: 2 }, fill: { opacity: 0.3 }, colors: ['#17a2b8'], markers: { size: 4 }, yaxis: { show: false, min: 0, max: 100 }, dataLabels: { enabled: true }
    });

    createOrUpdateChart('#combinedFinalBarChart', {
        series: [{ name: 'امتیاز نسبی (درصد)', data: sortedFinalDomains.map(c => parseFloat(F_rel[c].toFixed(1))) }],
        chart: { type: 'bar', height: 350, fontFamily: 'Vazirmatn' },
        plotOptions: { bar: { borderRadius: 4, horizontal: true, distributed: false, colors: { ranges: [{ from: 0, to: 70, color: '#f6c23e' }, { from: 70.01, to: 100, color: '#1cc88a' }] } } },
        dataLabels: { enabled: true, formatter: function (val) { return val + "%" } },
        xaxis: { categories: sortedFinalDomains.map(c => typeof LABELS !== 'undefined' && LABELS[c] ? LABELS[c] : c), min: 0, max: 100 }, legend: { show: false }
    });

    // --- مساحت قطبی و ۶ گیج کوچک ---
    
    // مساحت قطبی استعدادها
    createOrUpdateChart('#talentPolarChart', {
        series: sortedFinalDomains.map(c => parseFloat(F_rel[c].toFixed(1))),
        chart: { type: 'polarArea', height: 350, fontFamily: 'Vazirmatn' },
        labels: sortedFinalDomains.map(c => typeof LABELS !== 'undefined' && LABELS[c] ? LABELS[c] : c),
        fill: { opacity: 0.8 },
        theme: { palette: 'palette1' },
        legend: { position: 'bottom' }
    });

    // ۶ گیج کوچک برای هر استعداد
    let gaugeColors = ['#1cc88a', '#36b9cc', '#4e73df', '#f6c23e', '#e74a3b', '#858796'];
    sortedFinalDomains.forEach((c, index) => {
        let val = parseFloat(F_rel[c].toFixed(1));
        let label = typeof LABELS !== 'undefined' && LABELS[c] ? LABELS[c] : c;
        
        createOrUpdateChart('#talentGauge' + index, {
            series: [val],
            chart: { type: 'radialBar', height: 180, fontFamily: 'Vazirmatn' },
            plotOptions: {
                radialBar: {
                    hollow: { size: '40%' },
                    dataLabels: { 
                        name: { offsetY: 20, fontSize: '11px', color: '#555' }, 
                        value: { offsetY: -10, fontSize: '14px', fontWeight: 'bold' } 
                    }
                }
            },
            labels: [label],
            colors: [gaugeColors[index % gaugeColors.length]]
        });
    });

    // ============================================
    // محاسبه Fit Score و موتور تفسیر داینامیک (TEXT_BANK)
    // ============================================
    const avg = arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const stdDev = (arr, mean) => Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length) || 1;
    
    let talentBy = {}, interestBy = {}, efficacyBy = {};
    let tValues = [], iValues = [];
    
    let domainFitScores = {};
    finalCategories.forEach(d => {
        let t = ((M_c[d] * 100) + (D_c_val[d] * 100)) / 2.0;
        let i = rawCategoryScores[d] ? rawCategoryScores[d].I : 0;
        let e = rawCategoryScores[d] ? rawCategoryScores[d].SE : 0;
        
        talentBy[d] = t; interestBy[d] = i; efficacyBy[d] = e;
        tValues.push(t); iValues.push(i);
        domainFitScores[d] = (0.35 * t) + (0.40 * i) + (0.25 * e);
    });
    
    let sortedDomainsForRank = [...finalCategories].sort((a,b) => domainFitScores[b] - domainFitScores[a]);

    let meanT = avg(tValues), stdT = stdDev(tValues, meanT);
    let meanI = avg(iValues), stdI = stdDev(iValues, meanI);

    function getLevel(val, mean, std) {
        let z = (val - mean) / std;
        if (z >= 1.0) return 5;
        if (z >= 0.3) return 4;
        if (z > -0.3) return 3;
        if (z > -1.0) return 2;
        return 1;
    }

    function getLevelLetter(level) {
        if(level === 5) return 'H';
        if(level === 4) return 'MH';
        if(level === 3) return 'M';
        if(level === 2) return 'ML';
        return 'L';
    }

    let finalReportTexts = [];
    let randItem = (arr) => {
        if(!arr || arr.length === 0) return "";
        return arr[Math.floor(Math.random() * arr.length)];
    };
    
    finalCategories.forEach(d => {
        let talent = talentBy[d];
        let interest = interestBy[d];
        let efficacy = efficacyBy[d];

        let fitScore = domainFitScores[d];
        let rank = sortedDomainsForRank.indexOf(d); 
        
        let G_c = talent - efficacy;
        let calKey = "";
        if (G_c >= 20) calKey = "HIDDEN_STRONG";
        else if (G_c >= 8) calKey = "HIDDEN_MILD";
        else if (G_c > -8) calKey = "CALIBRATED";
        else if (G_c > -20) calKey = "OVERCONFIDENT_MILD";
        else calKey = "OVERCONFIDENT_STRONG";

        if ((rank === 0 || rank === 1) && calKey === "OVERCONFIDENT_STRONG") {
            calKey = "OVERCONFIDENT_MILD";
        }

        // ========================================================
        // اعمال شرط 10٪ اختلاف بین علاقه و خودکارآمدی (اصلاح شماره ۱)
        // ========================================================
        if ((calKey === "OVERCONFIDENT_MILD" || calKey === "OVERCONFIDENT_STRONG") && Math.abs(interest - efficacy) <= 10) {
            calKey = "CALIBRATED";
        }

        let levelT = getLevel(talent, meanT, stdT);
        let levelI = getLevel(interest, meanI, stdI);
        let quadKey = getLevelLetter(levelT) + "_" + getLevelLetter(levelI);

        let quadObj = (typeof TEXT_BANK !== 'undefined' && TEXT_BANK.quad) ? TEXT_BANK.quad[quadKey] : null;
        let calObj = (typeof TEXT_BANK !== 'undefined' && TEXT_BANK.calibration) ? TEXT_BANK.calibration[calKey] : null;

        let quadLabel = quadObj ? quadObj.label : "حوزه تحلیل";
        let gapLabel = calObj ? calObj.label : "تحلیل فاصله";
        let gapClass = calObj ? calObj.badgeClass : "bg-secondary text-white";

        let finalCombinedText = "";
        let shortCalKey = calKey.includes("HIDDEN") ? "HIDDEN" : (calKey.includes("OVERCONFIDENT") ? "OVERCONFIDENT" : "CALIBRATED");
        let combinedKey = quadKey + "_" + shortCalKey;

        if (typeof TEXT_BANK !== 'undefined' && TEXT_BANK.combined && TEXT_BANK.combined[combinedKey]) {
            finalCombinedText = randItem(TEXT_BANK.combined[combinedKey].texts);
        } else {
            let text1 = quadObj ? randItem(quadObj.texts) : "";
            let text2 = calObj ? randItem(calObj.texts) : "";
            finalCombinedText = text1 + " " + text2;
        }

        let intelContributions = [];
        let roleContributions = [];
        
        if (typeof combinedConfig !== 'undefined' && combinedConfig.weightsA && combinedConfig.weightsA[d]) {
            for(let intel in I_hat) {
                let w = combinedConfig.weightsA[d][intel] || 0;
                intelContributions.push({ name: intel, contribution: w * I_hat[intel] });
            }
            for(let role in R_hat) {
                let w = combinedConfig.weightsA[d][role] || 0;
                roleContributions.push({ name: role, contribution: w * R_hat[role] });
            }
        }

        intelContributions.sort((a, b) => b.contribution - a.contribution);
        roleContributions.sort((a, b) => b.contribution - a.contribution);

        let bestIntel = intelContributions.length > 0 ? intelContributions[0].name : "LOG";
        let secondIntel = (intelContributions.length > 1 && intelContributions[1].contribution > 0) ? intelContributions[1].name : bestIntel;
        let thirdIntel = (d === 'NA' && intelContributions.length > 2 && intelContributions[2].contribution > 0) ? intelContributions[2].name : null;
        
        // ========================================================
        // استخراج نقش برتر دوم جهت پاس دادن به متن داینامیک (اصلاح شماره ۲)
        // ========================================================
        let bestRole = roleContributions.length > 0 ? roleContributions[0].name : "R-EXE";
        let secondRole = (roleContributions.length > 1 && roleContributions[1].contribution > 0) ? roleContributions[1].name : bestRole;

        finalReportTexts.push({
            domain: d,
            name: typeof LABELS !== 'undefined' && LABELS[d] ? LABELS[d] : d,
            fitScore: fitScore,
            gapLabel, gapClass, quadLabel, finalCombinedText, 
            bestIntel, secondIntel, thirdIntel, bestRole, secondRole
        });
    });

    let reportHtml = "";
    let sortedReports = finalReportTexts.sort((a, b) => b.fitScore - a.fitScore);
    
    sortedReports.forEach((item, index) => {
        let intelName = (typeof MI_LABELS !== 'undefined' && MI_LABELS[item.bestIntel]) ? MI_LABELS[item.bestIntel] : item.bestIntel;
        let secondIntelName = (typeof MI_LABELS !== 'undefined' && MI_LABELS[item.secondIntel]) ? MI_LABELS[item.secondIntel] : item.secondIntel;
        
        let roleName = (typeof LABELS !== 'undefined' && LABELS["ROLE_" + item.bestRole]) ? LABELS["ROLE_" + item.bestRole] : item.bestRole;
        let rolePct = Math.round(normalizedRoleScores[item.bestRole] || 0);

        let role2Name = (typeof LABELS !== 'undefined' && LABELS["ROLE_" + item.secondRole]) ? LABELS["ROLE_" + item.secondRole] : item.secondRole;
        let role2Pct = Math.round(normalizedRoleScores[item.secondRole] || 0);
        
        let intelPct = Math.round(miFinalScores[item.bestIntel] || 0);
        let secondIntelPct = Math.round(miFinalScores[item.secondIntel] || 0);

        let reasonTemplate = "";
        if (index < 3 && TEXT_BANK?.dynamic_reasoning?.top_arts) {
            reasonTemplate = randItem(TEXT_BANK.dynamic_reasoning.top_arts);
        } else if (index >= 3 && TEXT_BANK?.dynamic_reasoning?.other_arts) {
            reasonTemplate = randItem(TEXT_BANK.dynamic_reasoning.other_arts);
        } else {
            reasonTemplate = "تحلیل سیستم برای این حوزه به زودی تکمیل خواهد شد.";
        }

        // ========================================================
        // تزریق نقش اول و نقش دوم داخل متن داینامیک (اصلاح شماره ۲)
        // ========================================================
        let dynamicReasoningText = reasonTemplate
            .replace(/{intel_name}/g, intelName)
            .replace(/{intel_percent}/g, intelPct)
            .replace(/{role1_name}/g, roleName)
            .replace(/{role1_percent}/g, rolePct)
            .replace(/{role2_name}/g, role2Name)
            .replace(/{role2_percent}/g, role2Pct)
            // در صورتی که متن قبلی با role_name نوشته شده باشد
            .replace(/{role_name}/g, roleName)
            .replace(/{role_percent}/g, rolePct);

        let warnings = (typeof TEXT_BANK !== 'undefined' && TEXT_BANK.role_warnings) ? TEXT_BANK.role_warnings[item.bestRole] : null;
        let specificWarning = warnings ? randItem(warnings) : "روی توسعه متوازن مهارت‌های خود تمرکز کنید.";
        let bSpotHtml = `<div class="dev-warning mt-3"><i class="fas fa-exclamation-triangle me-1"></i> ${specificWarning}</div>`;

        let closeDomainText = "";
        if (index < sortedReports.length - 1 && Math.abs(item.fitScore - sortedReports[index + 1].fitScore) <= 3) {
            let randClose = (typeof TEXT_BANK !== 'undefined' && TEXT_BANK.close_domains) ? randItem(TEXT_BANK.close_domains) : "رقابت بسیار نزدیک بین این حوزه و رتبه بعدی دیده می‌شود.";
            closeDomainText = `<div class="alert alert-info mt-3 mb-0 p-2 small"><i class="fas fa-balance-scale"></i> ${randClose}</div>`;
        }

        let secondIntelHtml = (item.bestIntel !== item.secondIntel) ? 
            `<span class="impact-badge" title="دومین هوش موثر"><i class="fas fa-brain text-info"></i> ${secondIntelName} ${secondIntelPct}٪</span>` : '';
            
        let thirdIntelHtml = '';
        if (item.domain === 'NA' && item.thirdIntel) {
            let thirdIntelName = (typeof MI_LABELS !== 'undefined' && MI_LABELS[item.thirdIntel]) ? MI_LABELS[item.thirdIntel] : item.thirdIntel;
            let thirdIntelPct = Math.round(miFinalScores[item.thirdIntel] || 0);
            thirdIntelHtml = `<span class="impact-badge" title="سومین هوش موثر"><i class="fas fa-brain text-warning"></i> ${thirdIntelName} ${thirdIntelPct}٪</span>`;
        }

        // ========================================================
        // تگ HTML نقش دوم در کارت‌ها (اصلاح شماره ۳)
        // ========================================================
        let secondRoleHtml = (item.bestRole !== item.secondRole) ? 
            `<span class="impact-badge" title="نقش کلیدی دوم"><i class="fas fa-user-tag text-secondary"></i> ${role2Name} ${role2Pct}٪</span>` : '';

        let dynamicReasoningHtml = `
            <div class="reasoning-title"><i class="fas fa-microchip me-2"></i> استنتاج سیستم</div>
            <p class="mb-0 text-dark small" style="text-align: justify; line-height: 1.7;">
                ${dynamicReasoningText}
            </p>
            <div class="impact-tags">
                <span class="impact-badge" title="بیشترین تاثیر قطعی در این حوزه"><i class="fas fa-brain text-success"></i> ${intelName} ${intelPct}٪</span>
                ${secondIntelHtml}
                ${thirdIntelHtml}
                <span class="impact-badge" title="نقش کلیدی برتر"><i class="fas fa-user-tag text-primary"></i> ${roleName} ${rolePct}٪</span>
                ${secondRoleHtml}
            </div>
            ${index < 3 ? bSpotHtml : ''}
            ${closeDomainText}
        `;

        let rankColor = index === 0 ? '#f6c23e' : (index === 1 ? '#858796' : (index === 2 ? '#e67e22' : '#4e73df'));

        reportHtml += `
            <div class="col-lg-4 col-md-6 mb-3">
                <div class="report-card h-100">
                    <div class="report-card-header d-flex justify-content-between align-items-center">
                        <h6 class="fw-bold mb-0 text-dark d-flex align-items-center">
                            <span class="badge rounded-circle shadow-sm me-2 text-white" style="background-color: ${rankColor}; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 0.9rem;">${index + 1}</span> 
                            ${item.name}
                        </h6>
                        <span class="text-primary fw-bold" style="font-size: 0.85rem;" title="Fit Score">تناسب: ${item.fitScore.toFixed(1)}</span>
                    </div>
                    
                    <div class="report-card-body">
                        <div class="d-flex flex-wrap gap-2 mb-3 justify-content-start">
                            <span class="badge ${item.gapClass} px-3 py-2 shadow-sm"><i class="fas fa-fingerprint me-1"></i> ${item.gapLabel}</span>
                            <span class="badge bg-light text-dark border px-3 py-2 shadow-sm"><i class="fas fa-map-marker-alt text-info me-1"></i> ${item.quadLabel}</span>
                        </div>
                        
                        <p class="text-secondary small mb-4" style="text-align: justify; line-height: 1.8;"><strong>تفسیر ساختاری:</strong> ${item.finalCombinedText}</p>
                        
                        <div class="reasoning-box shadow-sm">
                            ${dynamicReasoningHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    $('#final-report').html(reportHtml);

    // ============================================
    // پیاده‌سازی سه نمودار جدید (Bubble, Gap, DPI)
    // ============================================
    let domainColors = ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#6f42c1'];
    
    let advancedChartData = finalCategories.map((d, idx) => {
        let T = ((M_c[d] * 100) + (D_c_val[d] * 100)) / 2.0; 
        let SE = rawCategoryScores[d] ? rawCategoryScores[d].SE : 0;
        let I = rawCategoryScores[d] ? rawCategoryScores[d].I : 0;
        let name = typeof LABELS !== 'undefined' && LABELS[d] ? LABELS[d] : d;
        
        let gap = I - SE;
        let dpi = (I * T * (1 - (SE / 100))) / 100;
        
        return { d, name, T, SE, I, gap, dpi, bubbleColor: domainColors[idx] };
    });

    let gapSorted = [...advancedChartData].sort((a, b) => b.gap - a.gap);
    $('#max-gap-area').text(gapSorted[0].name);

    let dpiSorted = [...advancedChartData].sort((a, b) => b.dpi - a.dpi);
    $('#talent-growth').text(dpiSorted[0].name);

    let strongCount = sortedReports.filter(r => r.fitScore >= 70).length;
    $('#total-strengths').text(strongCount + " حوزه مستعد");
    $('#development-areas').text(dpiSorted[0].name); 
    
    let avgFit = sortedReports.reduce((sum, r) => sum + r.fitScore, 0) / sortedReports.length;
    $('#overall-status').text(avgFit >= 65 ? "بسیار مستعد" : (avgFit >= 50 ? "در حال توسعه" : "نیازمند توجه"));

    // 1. نمودار حباب
    let bubbleSeries = advancedChartData.map(item => ({
        name: item.name,
        data: [[parseFloat(item.SE.toFixed(1)), parseFloat(item.T.toFixed(1)), parseFloat(item.I.toFixed(1))]],
        color: item.bubbleColor
    }));

    createOrUpdateChart('#bubbleChart', {
        series: bubbleSeries,
        chart: { type: 'bubble', height: 350, fontFamily: 'Vazirmatn' },
        dataLabels: { enabled: false },
        plotOptions: { bubble: { minBubbleRadius: 8, maxBubbleRadius: 35 } },
        xaxis: { type: 'numeric', title: { text: 'خودباوری (SE)' }, min: 0, max: 100, tickAmount: 10 },
        yaxis: { title: { text: 'استعداد (T)' }, min: 0, max: 100, tickAmount: 10 },
        annotations: { xaxis: [{ x: 50, borderColor: '#333', strokeDashArray: 4 }], yaxis: [{ y: 50, borderColor: '#333', strokeDashArray: 4 }] },
        legend: { position: 'bottom', show: true }, tooltip: { z: { title: 'علاقه (I):' } }
    });

    // 2. نمودار میله‌ای شکاف اقدام
    createOrUpdateChart('#actionGapChart', {
        series: [{ name: 'شکاف اقدام (I - SE)', data: gapSorted.map(item => parseFloat(item.gap.toFixed(1))) }],
        chart: { type: 'bar', height: 350, fontFamily: 'Vazirmatn' },
        plotOptions: { bar: { horizontal: true, colors: { ranges: [ { from: 10, to: 100, color: '#e74a3b' }, { from: -10, to: 9.99, color: '#f6c23e' }, { from: -100, to: -10.01, color: '#858796' } ] } } },
        dataLabels: { enabled: true, formatter: val => val > 0 ? "+" + val : val },
        xaxis: { min: -100, max: 100, title: { text: 'مقدار شکاف' } },
        yaxis: { labels: { formatter: function(val, index) { return val; } } }, labels: gapSorted.map(item => item.name)
    });

    // 3. نمودار اولویت‌های توسعه (DPI)
    createOrUpdateChart('#dpiChart', {
        series: [{ name: 'اولویت توسعه (DPI)', data: dpiSorted.map(item => parseFloat(item.dpi.toFixed(1))) }],
        chart: { type: 'bar', height: 350, fontFamily: 'Vazirmatn' },
        plotOptions: { bar: { horizontal: true, distributed: true, borderRadius: 4 } },
        colors: dpiSorted.map((item, idx) => idx === 0 ? '#1cc88a' : '#8ddcbe'),
        dataLabels: { enabled: true, formatter: val => val.toFixed(1) },
        xaxis: { title: { text: 'شاخص DPI' } }, legend: { show: false }, labels: dpiSorted.map(item => item.name)
    });
}
