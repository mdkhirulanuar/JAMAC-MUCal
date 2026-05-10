/**
 * ============================================================
 * MU CALCULATOR - FULLY MANUAL INPUT
 * Energy Meter Calibration · ISO/IEC 17025
 * Semua nilai (Job Info, Meter, Test Param, Readings) dimasukkan manual
 * ============================================================
 */

(function () {
    'use strict';

    // ==================== DEFAULT STATE ====================
    const defaults = {
        // Job Info
        jobRef: 'JTSO0280043',
        customer: 'Total Metering Solutions',
        meterMfr: 'ATEC',
        meterModel: 'DTS353',
        meterSN: 'TC2500100',
        refStdDesc: 'Three Phase Digital Power Meter Zhejiang Harnpu HC3100A',
        refStdSN: 'Z2102155',
        refStdTrace: 'JM/WS/25006',
        refStdCMC: '0.04',
        refStdDrift: '0.02',

        // Meter Info
        ratedCurrent: 5,
        ratedVoltage: 240,
        meterClass: 1.0,
        meterType: 'DIRECT',

        // Test Parameter
        energyType: '+P',
        testVoltage: 240,
        testCurrent: 0.1,
        testPF: '1',
        testPhase: 'ABC',

        // Uncertainty Components
        readings: [0.2854, 0.2673, 0.2714, 0.3126, 0.3009, 0.2975, 0.2881, 0.2690, 0.2851, 0.2583],
        muCert: 0.04,
        kCert: 2,
        resolution: 0.0001,
        drift: 0.02,
        tempCoeff: 0.002,
        deltaTemp: 2,

        // Excel comparison value
        excelMU: 0.041,
    };

    let state = JSON.parse(JSON.stringify(defaults));

    // ==================== DOM REFS ====================
    const jobCard = document.getElementById('job-card');
    const meterCard = document.getElementById('meter-card');
    const inputCard = document.getElementById('input-card');
    const stepsContainer = document.getElementById('steps-container');
    const summaryContainer = document.getElementById('summary-container');
    const excelCompare = document.getElementById('excel-compare');
    const jobInfoHeader = document.getElementById('job-info-header');
    const footerInfo = document.getElementById('footer-info');

    // ==================== HELPERS ====================
    function fmtNum(num, decimals) {
        if (!isFinite(num)) return '—';
        if (Math.abs(num) < 1e-12 && num !== 0) return num.toExponential(Math.max(0, decimals - 2));
        if (Math.abs(num) < 0.0001 && Math.abs(num) > 0) return num.toExponential(Math.max(0, decimals - 2));
        return num.toFixed(decimals);
    }

    function getEnergyLabel(e) { const m = { '+P':'Active Power Import (+P)', '-P':'Active Power Export (-P)', '+Q':'Reactive Power Import (+Q)', '-Q':'Reactive Power Export (-Q)' }; return m[e] || e; }
    function getPFLabel(pf) { const m = { '1':'1.0 (Unity)', '0.5L':'0.5 Lag', '0.866L':'0.866 Lag', '0.5C':'0.5 Lead', '0.866C':'0.866 Lead', '0':'0 (Reactive)' }; return m[pf] || pf; }
    function getPhaseLabel(ph) { const m = { 'ABC':'ABC (3-Phase)', 'A':'A-Phase', 'B':'B-Phase', 'C':'C-Phase' }; return m[ph] || ph; }

    function updateJobDisplay() {
        jobInfoHeader.innerHTML = `<span>${state.jobRef}</span> · <span>${state.customer}</span>`;
        footerInfo.innerHTML = `
            <p>${state.jobRef} · ${state.customer} · ${state.meterMfr} ${state.meterModel} · S/N: ${state.meterSN}</p>
            <p>Reference Standard: ${state.refStdDesc} · S/N: ${state.refStdSN} · Traceability: ${state.refStdTrace}</p>
        `;
    }

    // ==================== CALCULATION ====================
    function calculate(readings, muCert, kCert, resolution, drift, tempCoeff, deltaTemp) {
        const n = readings.length;
        const sum = readings.reduce((a, b) => a + b, 0);
        const avg = sum / n;
        const sumSqDiff = readings.reduce((acc, x) => acc + (x - avg) ** 2, 0);
        const stdDev = Math.sqrt(sumSqDiff / (n - 1));
        const u1 = stdDev / Math.sqrt(n);
        const u1Sq = u1 ** 2;
        const u14v = u1 ** 4 / (n - 1);

        const u2 = muCert / kCert;
        const u2Sq = u2 ** 2;
        const u24v = u2 ** 4 / 60;

        const semiR = resolution / 2;
        const u3 = semiR / Math.sqrt(3);
        const u3Sq = u3 ** 2;

        const u4 = drift / Math.sqrt(3);
        const u4Sq = u4 ** 2;

        const u5 = (deltaTemp * tempCoeff) / Math.sqrt(3);
        const u5Sq = u5 ** 2;

        const sumSqU = u1Sq + u2Sq + u3Sq + u4Sq + u5Sq;
        const uc = Math.sqrt(sumSqU);
        const uc4 = uc ** 4;

        const sumCu4v = u14v + u24v;
        const veff = sumCu4v > 0 ? uc4 / sumCu4v : 999;

        function getK(v) {
            if (v <= 0 || isNaN(v)) return 2.0;
            if (v >= 120) return 1.98;
            const t = [[1,12.71],[2,4.30],[3,3.18],[4,2.78],[5,2.57],[6,2.45],[7,2.36],[8,2.31],[9,2.26],[10,2.23],[11,2.20],[12,2.18],[13,2.16],[14,2.14],[15,2.13],[16,2.12],[17,2.11],[18,2.10],[19,2.09],[20,2.09],[25,2.06],[30,2.04],[35,2.03],[40,2.02],[45,2.01],[50,2.01],[60,2.00],[70,1.99],[80,1.99],[90,1.99],[100,1.98],[110,1.98],[120,1.98]];
            for (let i = 0; i < t.length - 1; i++) { if (v >= t[i][0] && v < t[i+1][0]) return t[i][1]; }
            return 1.98;
        }
        const kFactor = getK(veff);
        const ue = uc * kFactor;
        const ueRounded = Math.ceil(ue * 1000) / 1000;

        return { n, sum, avg, sumSqDiff, stdDev, u1, u1Sq, u14v, u2, u2Sq, u24v, u3, u3Sq, semiR, u4, u4Sq, u5, u5Sq, sumSqU, uc, uc4, sumCu4v, veff, kFactor, ue, ueRounded };
    }

    // ==================== RENDER STEPS ====================
    function createStepEl(num, title, type, bodyHTML) {
        const d = document.createElement('div');
        d.className = 'step open';
        d.innerHTML = `<div class="step-header" role="button" tabindex="0" aria-expanded="true" onclick="this.parentElement.classList.toggle('open');this.setAttribute('aria-expanded',this.parentElement.classList.contains('open'))" onkeydown="if(event.key==='Enter'||event.key===' '){this.click();event.preventDefault()}"><span class="step-num">U${num}</span><span class="step-title">${title}</span><span class="step-type">${type}</span><span class="step-arrow">▼</span></div><div class="step-body">${bodyHTML}</div>`;
        return d;
    }

    function renderSteps(calc) {
        stepsContainer.innerHTML = '';
        const n = state.readings.length;

        stepsContainer.appendChild(createStepEl('1', 'Repeatability', 'Type A · Normal', `
            <div class="formula-box">u₁ = σ / √n</div>
            <div class="sub-step-label">Step 1: Average</div>
            <div class="calc-line"><span class="v">Sum</span> <span class="op">=</span> <span class="vl">${fmtNum(calc.sum,4)}</span></div>
            <div class="calc-line"><span class="v">x̄</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.avg,5)}</span></div>
            <div class="sub-step-label">Step 2: Standard Deviation</div>
            <div class="calc-line"><span class="v">Σ(xi-x̄)²</span> <span class="op">=</span> <span class="vl">${fmtNum(calc.sumSqDiff,6)}</span></div>
            <div class="calc-line"><span class="v">σ</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.stdDev,5)}</span></div>
            <div class="sub-step-label">Step 3: u₁</div>
            <div class="calc-line"><span class="v">√n</span> <span class="eq">=</span> <span class="vl">${fmtNum(Math.sqrt(n),4)}</span></div>
            <div class="calc-line result-line"><span class="v">u₁</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.u1,5)} %</span></div>
            <div class="calc-line"><span class="v">u₁²</span> <span class="eq">=</span> <span class="vl">${calc.u1Sq.toExponential(4)}</span> &nbsp; <span class="v">v</span><span class="eq">=</span><span class="vl">${n-1}</span></div>
        `));

        stepsContainer.appendChild(createStepEl('2', 'Ref. Std. Cal Cert', 'Type B · Normal', `
            <div class="formula-box">u₂ = U<sub>cert</sub> / k</div>
            <div class="calc-line"><span class="v">U<sub>cert</sub></span><span class="eq">=</span><span class="vl">${state.muCert} %</span>, <span class="v">k</span><span class="eq">=</span><span class="vl">${state.kCert}</span></div>
            <div class="calc-line result-line"><span class="v">u₂</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.u2,5)} %</span></div>
            <div class="calc-line"><span class="v">u₂²</span><span class="eq">=</span><span class="vl">${calc.u2Sq.toExponential(4)}</span> &nbsp; <span class="v">v</span><span class="eq">≈</span><span class="vl">60</span></div>
            <div class="calc-line note">Normal · v ≈ 60</div>
        `));

        stepsContainer.appendChild(createStepEl('3', 'Resolution (Ref Std)', 'Type B · Rect', `
            <div class="formula-box">u₃ = a / √3 &nbsp; (a = R/2)</div>
            <div class="calc-line"><span class="v">R</span><span class="eq">=</span><span class="vl">${state.resolution} %</span>, <span class="v">a</span><span class="eq">=</span><span class="vl">${calc.semiR.toExponential(1)}</span></div>
            <div class="calc-line result-line"><span class="v">u₃</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.u3,6)} %</span></div>
            <div class="calc-line note">Rectangular · v = ∞</div>
        `));

        stepsContainer.appendChild(createStepEl('4', 'Error Drift', 'Type B · Rect', `
            <div class="formula-box">u₄ = D / √3</div>
            <div class="calc-line"><span class="v">D</span><span class="eq">=</span><span class="vl">${state.drift} %</span></div>
            <div class="calc-line result-line"><span class="v">u₄</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.u4,4)} %</span></div>
            <div class="calc-line note">Rectangular · v = ∞</div>
        `));

        stepsContainer.appendChild(createStepEl('5', 'Temperature Coefficient', 'Type B · Rect', `
            <div class="formula-box">u₅ = (a × β) / √3</div>
            <div class="calc-line"><span class="v">β</span><span class="eq">=</span><span class="vl">${state.tempCoeff} %/°C</span>, <span class="v">a</span><span class="eq">=</span><span class="vl">${state.deltaTemp} °C</span></div>
            <div class="calc-line"><span class="v">a×β</span><span class="eq">=</span><span class="vl">${fmtNum(state.deltaTemp*state.tempCoeff,4)}</span></div>
            <div class="calc-line result-line"><span class="v">u₅</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.u5,6)} %</span></div>
            <div class="calc-line note">Rectangular · v = ∞</div>
        `));

        stepsContainer.appendChild(createStepEl('c', 'Combined Uncertainty', 'Uc', `
            <div class="formula-box">Uc = √(u₁² + u₂² + u₃² + u₄² + u₅²)</div>
            <div class="calc-line"><span class="v">u₁²</span><span class="eq">=</span><span class="vl">${calc.u1Sq.toExponential(4)}</span> &nbsp; <span class="v">u₂²</span><span class="eq">=</span><span class="vl">${calc.u2Sq.toExponential(4)}</span></div>
            <div class="calc-line"><span class="v">u₃²</span><span class="eq">=</span><span class="vl">${calc.u3Sq.toExponential(6)}</span> &nbsp; <span class="v">u₄²</span><span class="eq">=</span><span class="vl">${calc.u4Sq.toExponential(4)}</span></div>
            <div class="calc-line"><span class="v">u₅²</span><span class="eq">=</span><span class="vl">${calc.u5Sq.toExponential(6)}</span></div>
            <div class="calc-divider"></div>
            <div class="calc-line"><span class="v">Σ</span> <span class="eq">=</span> <span class="vl">${calc.sumSqU.toExponential(6)}</span></div>
            <div class="calc-line result-line"><span class="v">Uc</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.uc,5)} %</span></div>
            <div class="sub-step-label" style="margin-top:10px;">Effective Degrees of Freedom</div>
            <div class="formula-box" style="margin-top:4px;">v<sub>eff</sub> = Uc⁴ / Σ(uᵢ⁴/vᵢ)</div>
            <div class="calc-line"><span class="v">Σ(uᵢ⁴/v)</span> <span class="eq">=</span> <span class="vl">${calc.sumCu4v.toExponential(6)}</span></div>
            <div class="calc-line result-line"><span class="v">v<sub>eff</sub></span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.veff,1)}</span></div>
        `));

        stepsContainer.appendChild(createStepEl('e', 'Expanded Uncertainty', '95% Confidence', `
            <div class="formula-box">Ue = Uc × k &nbsp; (ROUNDUP to 3 decimal)</div>
            <div class="calc-line"><span class="v">k (95%CL, v=${fmtNum(calc.veff,1)})</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.kFactor,2)}</span></div>
            <div class="calc-line"><span class="v">Ue</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.uc,5)}</span> <span class="op">×</span> <span class="vl">${fmtNum(calc.kFactor,2)}</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.ue,5)} %</span></div>
            <div class="calc-line result-line"><span class="v">Ue (ROUNDUP)</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.ueRounded,4)} %</span></div>
        `));
    }

    // ==================== RENDER ALL ====================
    function renderAll() {
        const calc = calculate(state.readings, state.muCert, state.kCert, state.resolution, state.drift, state.tempCoeff, state.deltaTemp);
        updateJobDisplay();
        renderJobCard();
        renderMeterCard();
        renderInputCard();
        renderSteps(calc);
        renderSummary(calc);

        // Excel comparison — user can edit excelMU in job card
        const match = Math.abs(calc.ueRounded - state.excelMU) < 0.001;
        excelCompare.innerHTML = `
            <h3>📋 Perbandingan dengan Excel</h3>
            <div class="compare-grid">
                <div class="c-head">Item</div><div class="c-head">Nilai</div>
                <div>App MU (Ue)</div><div>${fmtNum(calc.ueRounded,4)} %</div>
                <div>Excel MU (Ue)</div><div>${state.excelMU.toFixed(3)} %</div>
                <div>Status</div><div class="${match?'c-match':'c-diff'}">${match?'✅ SAMA':'⚠️ BERBEZA'}</div>
            </div>
        `;
    }

    function renderJobCard() {
        jobCard.innerHTML = `
            <h3>📁 Job Info</h3>
            <div class="job-grid">
                <div class="jg-group"><span class="jg-label">Job Ref</span><input type="text" id="job-ref" value="${state.jobRef}"></div>
                <div class="jg-group"><span class="jg-label">Customer</span><input type="text" id="job-customer" value="${state.customer}"></div>
                <div class="jg-group"><span class="jg-label">Meter Manufacturer</span><input type="text" id="job-mfr" value="${state.meterMfr}"></div>
                <div class="jg-group"><span class="jg-label">Meter Model/Type</span><input type="text" id="job-model" value="${state.meterModel}"></div>
                <div class="jg-group"><span class="jg-label">Meter Serial No</span><input type="text" id="job-sn" value="${state.meterSN}"></div>
                <div class="jg-group"><span class="jg-label">Ref Std Description</span><input type="text" id="job-refstd-desc" value="${state.refStdDesc}"></div>
                <div class="jg-group"><span class="jg-label">Ref Std Serial No</span><input type="text" id="job-refstd-sn" value="${state.refStdSN}"></div>
                <div class="jg-group"><span class="jg-label">Traceability</span><input type="text" id="job-trace" value="${state.refStdTrace}"></div>
                <div class="jg-group"><span class="jg-label">CMC (%)</span><input type="number" id="job-cmc" value="${state.refStdCMC}" step="0.001"></div>
                <div class="jg-group"><span class="jg-label">Drift (%)</span><input type="number" id="job-drift" value="${state.refStdDrift}" step="0.001"></div>
                <div class="jg-group"><span class="jg-label">Excel MU (utk banding)</span><input type="number" id="job-excelMU" value="${state.excelMU}" step="0.001"></div>
            </div>
        `;
        bindJobEvents();
    }

    function bindJobEvents() {
        const ids = {
            'job-ref': 'jobRef', 'job-customer': 'customer', 'job-mfr': 'meterMfr',
            'job-model': 'meterModel', 'job-sn': 'meterSN', 'job-refstd-desc': 'refStdDesc',
            'job-refstd-sn': 'refStdSN', 'job-trace': 'refStdTrace'
        };
        Object.entries(ids).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', function() { state[key] = this.value; updateJobDisplay(); });
        });
        const numIds = { 'job-cmc': 'refStdCMC', 'job-drift': 'refStdDrift', 'job-excelMU': 'excelMU' };
        Object.entries(numIds).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', function() {
                state[key] = parseFloat(this.value) || 0;
                if (key === 'refStdCMC') { state.muCert = state.refStdCMC; document.getElementById('in-muCert') && (document.getElementById('in-muCert').value = state.muCert); }
                if (key === 'refStdDrift') { state.drift = state.refStdDrift; document.getElementById('in-drift') && (document.getElementById('in-drift').value = state.drift); }
                refreshCalc();
            });
        });
    }

    function renderMeterCard() {
        meterCard.innerHTML = `
            <h3>📋 Meter Info & Test Parameter</h3>
            <div class="meter-info-grid">
                <div class="mi-group"><span class="mi-label">Rated Current (A)</span><input type="number" id="mi-ratedCurrent" value="${state.ratedCurrent}" step="0.1"></div>
                <div class="mi-group"><span class="mi-label">Rated Voltage (V)</span><input type="number" id="mi-ratedVoltage" value="${state.ratedVoltage}" step="1"></div>
                <div class="mi-group"><span class="mi-label">Class</span><input type="number" id="mi-class" value="${state.meterClass}" step="0.1"></div>
                <div class="mi-group"><span class="mi-label">Meter Type</span><select id="mi-type"><option value="DIRECT" ${state.meterType==='DIRECT'?'selected':''}>DIRECT</option><option value="CT" ${state.meterType==='CT'?'selected':''}>CT</option><option value="CT-VT" ${state.meterType==='CT-VT'?'selected':''}>CT-VT</option></select></div>
            </div>
            <div class="test-selector">
                <div class="ts-group"><span class="ts-label">Energy</span><select id="ts-energy"><option value="+P" ${state.energyType==='+P'?'selected':''}>+P</option><option value="-P" ${state.energyType==='-P'?'selected':''}>-P</option><option value="+Q" ${state.energyType==='+Q'?'selected':''}>+Q</option><option value="-Q" ${state.energyType==='-Q'?'selected':''}>-Q</option></select></div>
                <div class="ts-group"><span class="ts-label">Phase</span><select id="ts-phase"><option value="ABC" ${state.testPhase==='ABC'?'selected':''}>ABC</option><option value="A" ${state.testPhase==='A'?'selected':''}>A</option><option value="B" ${state.testPhase==='B'?'selected':''}>B</option><option value="C" ${state.testPhase==='C'?'selected':''}>C</option></select></div>
                <div class="ts-group"><span class="ts-label">PF</span><select id="ts-pf"><option value="1" ${state.testPF==='1'?'selected':''}>1.0</option><option value="0.5L" ${state.testPF==='0.5L'?'selected':''}>0.5L</option><option value="0.866L" ${state.testPF==='0.866L'?'selected':''}>0.866L</option><option value="0.5C" ${state.testPF==='0.5C'?'selected':''}>0.5C</option><option value="0.866C" ${state.testPF==='0.866C'?'selected':''}>0.866C</option></select></div>
                <div class="ts-group"><span class="ts-label">Test Voltage (V)</span><input type="number" id="ts-voltage" value="${state.testVoltage}" step="1"></div>
                <div class="ts-group"><span class="ts-label">Test Current (A)</span><input type="number" id="ts-current" value="${state.testCurrent}" step="0.01"></div>
            </div>
            <div class="test-point-display">
                <strong>Test Parameter:</strong>
                <div class="test-point-grid">
                    <div class="tp-item"><span class="tp-label">Energy:</span> <span id="tp-energy">${getEnergyLabel(state.energyType)}</span></div>
                    <div class="tp-item"><span class="tp-label">Phase:</span> <span id="tp-phase">${getPhaseLabel(state.testPhase)}</span></div>
                    <div class="tp-item"><span class="tp-label">PF:</span> <span id="tp-pf">${getPFLabel(state.testPF)}</span></div>
                    <div class="tp-item"><span class="tp-label">Voltage:</span> <span id="tp-voltage">${state.testVoltage} V</span></div>
                    <div class="tp-item"><span class="tp-label">Current:</span> <span id="tp-current">${state.testCurrent} A</span></div>
                </div>
            </div>
            <div class="readings-display" id="readings-display"><strong>${state.readings.length} Readings:</strong> ${state.readings.join(' &nbsp; ')}</div>
        `;
        bindMeterEvents();
    }

    function bindMeterEvents() {
        document.getElementById('mi-ratedCurrent').addEventListener('input', function() { state.ratedCurrent = parseFloat(this.value)||5; });
        document.getElementById('mi-ratedVoltage').addEventListener('input', function() { state.ratedVoltage = parseFloat(this.value)||240; });
        document.getElementById('mi-class').addEventListener('input', function() { state.meterClass = parseFloat(this.value)||1.0; });
        document.getElementById('mi-type').addEventListener('change', function() { state.meterType = this.value; });
        ['ts-energy','ts-phase','ts-pf'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', function() {
                if (id === 'ts-energy') state.energyType = this.value;
                if (id === 'ts-phase') state.testPhase = this.value;
                if (id === 'ts-pf') state.testPF = this.value;
                updateTestDisplay();
            });
        });
        document.getElementById('ts-voltage').addEventListener('input', function() { state.testVoltage = parseFloat(this.value)||240; updateTestDisplay(); });
        document.getElementById('ts-current').addEventListener('input', function() { state.testCurrent = parseFloat(this.value)||0.1; updateTestDisplay(); });
    }

    function updateTestDisplay() {
        const tpE = document.getElementById('tp-energy'); if(tpE) tpE.textContent = getEnergyLabel(state.energyType);
        const tpP = document.getElementById('tp-phase'); if(tpP) tpP.textContent = getPhaseLabel(state.testPhase);
        const tpPf = document.getElementById('tp-pf'); if(tpPf) tpPf.textContent = getPFLabel(state.testPF);
        const tpV = document.getElementById('tp-voltage'); if(tpV) tpV.textContent = state.testVoltage + ' V';
        const tpC = document.getElementById('tp-current'); if(tpC) tpC.textContent = state.testCurrent + ' A';
    }

    function renderInputCard() {
        inputCard.innerHTML = `
            <h3>📝 Readings (10 nilai ujian)</h3>
            <div class="input-grid">
                <div class="input-group"><label for="in-readings">Readings (comma-separated)</label><input type="text" id="in-readings" value="${state.readings.join(',')}"></div>
            </div>
            <h3 style="margin-top:12px;">⚙️ Uncertainty Components (Type B)</h3>
            <div class="input-grid">
                <div class="input-group"><label for="in-muCert">MU Cal Cert (%)</label><input type="number" id="in-muCert" value="${state.muCert}" step="0.001"></div>
                <div class="input-group"><label for="in-kCert">k from Cert</label><input type="number" id="in-kCert" value="${state.kCert}" step="0.01"></div>
                <div class="input-group"><label for="in-resolution">Resolution Ref Std (%)</label><input type="number" id="in-resolution" value="${state.resolution}" step="0.0001"></div>
                <div class="input-group"><label for="in-drift">Drift (%)</label><input type="number" id="in-drift" value="${state.drift}" step="0.001"></div>
                <div class="input-group"><label for="in-tempCoeff">Temp Coefficient (%/°C)</label><input type="number" id="in-tempCoeff" value="${state.tempCoeff}" step="0.001"></div>
                <div class="input-group"><label for="in-deltaTemp">Δ Temperature (°C)</label><input type="number" id="in-deltaTemp" value="${state.deltaTemp}" step="0.5"></div>
            </div>
            <div class="btn-row">
                <button class="btn btn-primary" id="btn-calc">🔄 Kira Semula</button>
                <button class="btn btn-secondary" id="btn-reset">↩ Reset Default</button>
            </div>
        `;
        bindInputEvents();
    }

    function bindInputEvents() {
        document.getElementById('btn-calc').addEventListener('click', () => {
            const rdStr = document.getElementById('in-readings').value.trim();
            const arr = rdStr.split(',').map(s => parseFloat(s.trim())).filter(x => !isNaN(x));
            if (arr.length < 2) { alert('Sila masukkan sekurang-kurangnya 2 readings.'); return; }
            state.readings = arr;
            state.muCert = parseFloat(document.getElementById('in-muCert').value) || state.muCert;
            state.kCert = parseFloat(document.getElementById('in-kCert').value) || state.kCert;
            state.resolution = parseFloat(document.getElementById('in-resolution').value) || state.resolution;
            state.drift = parseFloat(document.getElementById('in-drift').value) || state.drift;
            state.tempCoeff = parseFloat(document.getElementById('in-tempCoeff').value) || state.tempCoeff;
            state.deltaTemp = parseFloat(document.getElementById('in-deltaTemp').value) || state.deltaTemp;
            refreshCalc();
            window.scrollTo({ top: stepsContainer.offsetTop - 80, behavior: 'smooth' });
        });
        document.getElementById('btn-reset').addEventListener('click', () => {
            state = JSON.parse(JSON.stringify(defaults));
            renderAll();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    function refreshCalc() {
        const calc = calculate(state.readings, state.muCert, state.kCert, state.resolution, state.drift, state.tempCoeff, state.deltaTemp);
        renderSteps(calc);
        renderSummary(calc);
        const rd = document.getElementById('readings-display');
        if (rd) rd.innerHTML = `<strong>${state.readings.length} Readings:</strong> ${state.readings.join(' &nbsp; ')}`;
        const match = Math.abs(calc.ueRounded - state.excelMU) < 0.001;
        excelCompare.innerHTML = `
            <h3>📋 Perbandingan dengan Excel</h3>
            <div class="compare-grid">
                <div class="c-head">Item</div><div class="c-head">Nilai</div>
                <div>App MU (Ue)</div><div>${fmtNum(calc.ueRounded,4)} %</div>
                <div>Excel MU (Ue)</div><div>${state.excelMU.toFixed(3)} %</div>
                <div>Status</div><div class="${match?'c-match':'c-diff'}">${match?'✅ SAMA':'⚠️ BERBEZA'}</div>
            </div>
        `;
    }

    function renderSummary(calc) {
        summaryContainer.innerHTML = `
            <div class="summary-card">
                <h3>📊 MU Budget Summary</h3>
                <table class="summary-table">
                    <tr><td class="s-label">U1 · Repeatability</td><td class="s-val">${fmtNum(calc.u1,5)} %</td></tr>
                    <tr><td class="s-label">U2 · Ref. Std. Cal Cert</td><td class="s-val">${fmtNum(calc.u2,5)} %</td></tr>
                    <tr><td class="s-label">U3 · Resolution Ref. Std</td><td class="s-val">${fmtNum(calc.u3,6)} %</td></tr>
                    <tr><td class="s-label">U4 · Error Drift</td><td class="s-val">${fmtNum(calc.u4,4)} %</td></tr>
                    <tr><td class="s-label">U5 · Temperature Coefficient</td><td class="s-val">${fmtNum(calc.u5,6)} %</td></tr>
                    <tr class="s-sep"><td class="s-label"><strong>Uc · Combined</strong></td><td class="s-val"><strong>${fmtNum(calc.uc,5)} %</strong></td></tr>
                    <tr><td class="s-label">v<sub>eff</sub></td><td class="s-val">${fmtNum(calc.veff,1)}</td></tr>
                    <tr><td class="s-label">k (95% CL)</td><td class="s-val">${fmtNum(calc.kFactor,2)}</td></tr>
                </table>
                <div class="final-result">
                    ✅ Expanded Uncertainty at 95% Confidence Level
                    <span class="big">U = ± ${fmtNum(calc.ueRounded,4)} %</span>
                </div>
            </div>
        `;
    }

    // ==================== INIT ====================
    function init() { renderAll(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
