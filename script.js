/**
 * ============================================================
 * MU VALIDATE PRO v3.3
 * Energy Meter Calibration · ISO/IEC 17025
 * Single Parameter · Dynamic Readings · Full Manual Steps · English
 * ============================================================
 */
(function () {
    'use strict';

    const defaults = {
        projectName: 'Parameter 1',
        jobRef: '', customer: '', meterMfr: '', meterModel: '', meterSN: '',
        refStdDesc: '', refStdSN: '', refStdTrace: '',
        ratedCurrent: 5, ratedVoltage: 240, meterClass: 1.0, meterType: 'DIRECT',
        energyType: '+P', testVoltage: 240, testCurrent: 0.1, testPF: '1', testPhase: 'ABC',
        readings: [0.2854, 0.2673, 0.2714, 0.3126, 0.3009, 0.2975, 0.2881, 0.2690, 0.2851, 0.2583],
        cmc: 0.04, muCert: 0.04, kCert: 2, resolution: 0.0001, drift: 0.02,
        tempCoeff: 0.002, deltaTemp: 2, excelMU: 0.04,
    };

    let state = JSON.parse(JSON.stringify(defaults));
    let currentTheme = localStorage.getItem('mu-theme-v3') || 'dark';

    const mainContent = document.getElementById('main-content');
    const loadModal = document.getElementById('load-modal');
    const saveModal = document.getElementById('save-modal');
    const loadProjectList = document.getElementById('load-project-list');
    const toast = document.getElementById('toast');

    function fmtNum(num, d) {
        if (!isFinite(num)) return '—';
        if (Math.abs(num) < 1e-12 && num !== 0) return num.toExponential(Math.max(0, d - 2));
        if (Math.abs(num) < 0.0001 && Math.abs(num) > 0) return num.toExponential(Math.max(0, d - 2));
        return num.toFixed(d);
    }
    function showToast(msg) { toast.textContent = msg; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2500); }

    function applyTheme() {
        if (currentTheme === 'light') { document.body.classList.add('light'); document.getElementById('btn-darkmode').textContent = '☀️'; }
        else { document.body.classList.remove('light'); document.getElementById('btn-darkmode').textContent = '🌙'; }
        localStorage.setItem('mu-theme-v3', currentTheme);
    }

    function saveToStorage() { try { localStorage.setItem('mu-state-v3', JSON.stringify(state)); } catch (e) {} }
    function loadFromStorage() { try { const s = localStorage.getItem('mu-state-v3'); if (s) state = Object.assign(JSON.parse(JSON.stringify(defaults)), JSON.parse(s)); } catch (e) {} }

    function validateInputs(s) {
        let valid = true; const errors = [];
        if (s.readings.length < 2) { errors.push('Minimum 2 readings required'); valid = false; }
        for (const r of s.readings) { if (isNaN(r) || !isFinite(r)) { errors.push('All readings must be valid numbers'); valid = false; break; } }
        if (isNaN(s.cmc) || s.cmc <= 0) { errors.push('CMC must be greater than 0'); valid = false; }
        if (isNaN(s.muCert) || s.muCert <= 0) { errors.push('MU Cal Cert must be greater than 0'); valid = false; }
        if (isNaN(s.kCert) || s.kCert < 1) { errors.push('k must be ≥ 1'); valid = false; }
        if (isNaN(s.resolution) || s.resolution < 0) { errors.push('Resolution cannot be negative'); valid = false; }
        if (isNaN(s.drift) || s.drift < 0) { errors.push('Drift cannot be negative'); valid = false; }
        if (isNaN(s.tempCoeff) || s.tempCoeff < 0) { errors.push('Temp Coefficient cannot be negative'); valid = false; }
        if (isNaN(s.deltaTemp) || s.deltaTemp < 0) { errors.push('Δ Temperature cannot be negative'); valid = false; }
        return { valid, errors };
    }

    function calculate(s) {
        const r = s.readings; const n = r.length;
        const sum = r.reduce((a, b) => a + b, 0); const avg = sum / n;
        const deviations = r.map(x => x - avg);
        const sqDevs = deviations.map(d => d * d);
        const sumSqDiff = sqDevs.reduce((a, b) => a + b, 0);
        const variance = sumSqDiff / (n - 1);
        const stdDev = Math.sqrt(variance);
        const u1 = stdDev / Math.sqrt(n);
        const u1Sq = u1 ** 2; const u14v = u1 ** 4 / (n - 1);

        const u2 = s.muCert / s.kCert; const u2Sq = u2 ** 2; const u24v = u2 ** 4 / 60;
        const semiR = s.resolution / 2; const u3 = semiR / Math.sqrt(3); const u3Sq = u3 ** 2;
        const u4 = s.drift / Math.sqrt(3); const u4Sq = u4 ** 2;
        const u5 = (s.deltaTemp * s.tempCoeff) / Math.sqrt(3); const u5Sq = u5 ** 2;

        const sumSqU = u1Sq + u2Sq + u3Sq + u4Sq + u5Sq;
        const uc = Math.sqrt(sumSqU); const uc4 = uc ** 4;
        const sumCu4v = u14v + u24v; const veff = sumCu4v > 0 ? uc4 / sumCu4v : 999;

        function getK(v) {
            if (v <= 0 || isNaN(v)) return 2.0; if (v >= 120) return 1.98;
            const t = [[1, 12.71], [2, 4.30], [3, 3.18], [4, 2.78], [5, 2.57], [6, 2.45], [7, 2.36], [8, 2.31], [9, 2.26], [10, 2.23], [11, 2.20], [12, 2.18], [13, 2.16], [14, 2.14], [15, 2.13], [16, 2.12], [17, 2.11], [18, 2.10], [19, 2.09], [20, 2.09], [25, 2.06], [30, 2.04], [35, 2.03], [40, 2.02], [45, 2.01], [50, 2.01], [60, 2.00], [70, 1.99], [80, 1.99], [90, 1.99], [100, 1.98], [110, 1.98], [120, 1.98]];
            for (let i = 0; i < t.length - 1; i++) { if (v >= t[i][0] && v < t[i + 1][0]) return t[i][1]; }
            return 1.98;
        }
        const kFactor = getK(veff); const ue = uc * kFactor;
        const ueRounded = Math.ceil(ue * 1000) / 1000;
        const muCapped = ueRounded < s.cmc; const finalMU = muCapped ? s.cmc : ueRounded;

        return { n, sum, avg, deviations, sqDevs, sumSqDiff, variance, stdDev, u1, u1Sq, u14v, u2, u2Sq, u24v, u3, u3Sq, semiR, u4, u4Sq, u5, u5Sq, sumSqU, uc, uc4, sumCu4v, veff, kFactor, ue, ueRounded, muCapped, finalMU, cmc: s.cmc };
    }

    function createStepEl(num, title, type, body) {
        const d = document.createElement('div'); d.className = 'step open';
        d.innerHTML = `<div class="step-header" role="button" tabindex="0" aria-expanded="true" onclick="this.parentElement.classList.toggle('open');this.setAttribute('aria-expanded',this.parentElement.classList.contains('open'))"><span class="step-num">U${num}</span><span class="step-title">${title}</span><span class="step-type">${type}</span><span class="step-arrow">▼</span></div><div class="step-body">${body}</div>`;
        return d;
    }

    function renderSteps(calc, s) {
        const container = document.getElementById('steps-container'); if (!container) return; container.innerHTML = '';
        const n = s.readings.length;

        // U1 — Full manual detail
        const devLines = calc.deviations.map((d, i) => `<div class="calc-line"><span class="v">(x<sub>${i+1}</sub>−x̄)</span> <span class="op">=</span> <span class="vl">${fmtNum(s.readings[i],4)} − ${fmtNum(calc.avg,5)}</span> <span class="eq">=</span> <span class="vl">${fmtNum(d,5)}</span></div>`).join('');
        const sqDevLines = calc.sqDevs.map((d, i) => `<div class="calc-line"><span class="v">(x<sub>${i+1}</sub>−x̄)²</span> <span class="op">=</span> <span class="vl">${fmtNum(calc.deviations[i],5)}²</span> <span class="eq">=</span> <span class="vl">${d.toExponential(4)}</span></div>`).join('');
        const sumSqLine = calc.sqDevs.map((d, i) => d.toExponential(4)).join(' + ');

        container.appendChild(createStepEl('1', 'Repeatability (Energy Error)', 'Type A · Normal', `
            <div class="formula-box">u₁ = σ / √n &nbsp; where &nbsp; σ = √[ Σ(xᵢ−x̄)² / (n−1) ]</div>
            <div class="sub-step-label">Step 1: Calculate Average (x̄)</div>
            <div class="calc-line"><span class="v">Sum</span> <span class="op">=</span> <span class="vl">${s.readings.join(' + ')}</span></div>
            <div class="calc-line"><span class="v">Sum</span> <span class="op">=</span> <span class="vl">${fmtNum(calc.sum,4)}</span></div>
            <div class="calc-line"><span class="v">x̄</span> <span class="op">= Sum / n =</span> <span class="vl">${fmtNum(calc.sum,4)}</span> <span class="op">/</span> <span class="vl">${n}</span></div>
            <div class="calc-line result-line"><span class="v">x̄</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.avg,5)}</span></div>

            <div class="sub-step-label">Step 2: Calculate Deviations (xᵢ − x̄)</div>
            ${devLines}

            <div class="sub-step-label">Step 3: Square Each Deviation (xᵢ − x̄)²</div>
            ${sqDevLines}

            <div class="sub-step-label">Step 4: Sum of Squares & Variance</div>
            <div class="calc-line"><span class="v">Σ(xᵢ−x̄)²</span> <span class="op">=</span> <span class="vl">${sumSqLine}</span></div>
            <div class="calc-line"><span class="v">Σ(xᵢ−x̄)²</span> <span class="op">=</span> <span class="vl">${fmtNum(calc.sumSqDiff,6)}</span></div>
            <div class="calc-line"><span class="v">Variance (s²)</span> <span class="op">= Σ(xᵢ−x̄)² / (n−1) =</span> <span class="vl">${fmtNum(calc.sumSqDiff,6)}</span> <span class="op">/</span> <span class="vl">${n-1}</span></div>
            <div class="calc-line"><span class="v">s²</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.variance,6)}</span></div>

            <div class="sub-step-label">Step 5: Standard Deviation & u₁</div>
            <div class="calc-line"><span class="v">σ (STDEV.S)</span> <span class="op">= √s² = √</span><span class="vl">${fmtNum(calc.variance,6)}</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.stdDev,5)}</span></div>
            <div class="calc-line"><span class="v">√n</span> <span class="op">= √</span><span class="vl">${n}</span> <span class="eq">=</span> <span class="vl">${fmtNum(Math.sqrt(n),4)}</span></div>
            <div class="calc-line"><span class="v">u₁</span> <span class="op">= σ / √n =</span> <span class="vl">${fmtNum(calc.stdDev,5)}</span> <span class="op">/</span> <span class="vl">${fmtNum(Math.sqrt(n),4)}</span></div>
            <div class="calc-line result-line"><span class="v">u₁</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.u1,5)} %</span></div>
            <div class="calc-line"><span class="v">u₁²</span> <span class="eq">=</span> <span class="vl">${calc.u1Sq.toExponential(4)}</span> &nbsp; | &nbsp; <span class="v">v = n−1 =</span> <span class="vl">${n-1}</span></div>
            <div class="calc-line"><span class="v">u₁⁴/v</span> <span class="eq">=</span> <span class="vl">${calc.u14v.toExponential(4)}</span></div>
        `));

        // U2
        container.appendChild(createStepEl('2', 'Reference Standard (Calibration Cert)', 'Type B · Normal', `
            <div class="formula-box">u₂ = U<sub>cert</sub> / k</div>
            <div class="calc-line"><span class="v">MU from Calibration Certificate</span> <span class="eq">=</span> <span class="vl">${s.muCert} %</span></div>
            <div class="calc-line"><span class="v">Coverage Factor, k</span> <span class="eq">=</span> <span class="vl">${s.kCert}</span> <span class="note">(stated in certificate, typically k=2)</span></div>
            <div class="calc-line"><span class="v">u₂</span> <span class="op">=</span> <span class="vl">${s.muCert}</span> <span class="op">/</span> <span class="vl">${s.kCert}</span></div>
            <div class="calc-line result-line"><span class="v">u₂</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.u2,5)} %</span></div>
            <div class="calc-line"><span class="v">u₂²</span> <span class="eq">=</span> <span class="vl">${calc.u2Sq.toExponential(4)}</span> &nbsp; | &nbsp; <span class="v">v ≈ 60</span> <span class="note">(Type B normal)</span></div>
            <div class="calc-line"><span class="v">u₂⁴/v</span> <span class="eq">=</span> <span class="vl">${calc.u24v.toExponential(4)}</span></div>
        `));

        // U3
        container.appendChild(createStepEl('3', 'Resolution (Reference Standard)', 'Type B · Rectangular', `
            <div class="formula-box">u₃ = a / √3 &nbsp; where &nbsp; a = R / 2</div>
            <div class="calc-line"><span class="v">Resolution, R</span> <span class="eq">=</span> <span class="vl">${s.resolution} %</span></div>
            <div class="calc-line"><span class="v">Semi-range, a</span> <span class="op">= R / 2 =</span> <span class="vl">${s.resolution}</span> <span class="op">/</span> <span class="vl">2</span> <span class="eq">=</span> <span class="vl">${calc.semiR.toExponential(1)} %</span></div>
            <div class="calc-line"><span class="v">√3</span> <span class="eq">=</span> <span class="vl">1.73205</span></div>
            <div class="calc-line"><span class="v">u₃</span> <span class="op">=</span> <span class="vl">${calc.semiR.toExponential(1)}</span> <span class="op">/</span> <span class="vl">1.73205</span></div>
            <div class="calc-line result-line"><span class="v">u₃</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.u3,6)} %</span></div>
            <div class="calc-line"><span class="v">u₃²</span> <span class="eq">=</span> <span class="vl">${calc.u3Sq.toExponential(6)}</span></div>
            <div class="note">Rectangular distribution · v = ∞ (infinite)</div>
        `));

        // U4
        container.appendChild(createStepEl('4', 'Error Drift (Reference Standard)', 'Type B · Rectangular', `
            <div class="formula-box">u₄ = D / √3</div>
            <div class="calc-line"><span class="v">Error Drift, D</span> <span class="eq">=</span> <span class="vl">${s.drift} %</span> <span class="note">(from reference standard specifications)</span></div>
            <div class="calc-line"><span class="v">√3</span> <span class="eq">=</span> <span class="vl">1.73205</span></div>
            <div class="calc-line"><span class="v">u₄</span> <span class="op">=</span> <span class="vl">${s.drift}</span> <span class="op">/</span> <span class="vl">1.73205</span></div>
            <div class="calc-line result-line"><span class="v">u₄</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.u4,4)} %</span></div>
            <div class="calc-line"><span class="v">u₄²</span> <span class="eq">=</span> <span class="vl">${calc.u4Sq.toExponential(4)}</span></div>
            <div class="note">Rectangular distribution · v = ∞</div>
        `));

        // U5
        container.appendChild(createStepEl('5', 'Temperature Coefficient', 'Type B · Rectangular', `
            <div class="formula-box">u₅ = (a × β) / √3</div>
            <div class="calc-line"><span class="v">Temp coefficient, β</span> <span class="eq">=</span> <span class="vl">${s.tempCoeff} %/°C</span></div>
            <div class="calc-line"><span class="v">Temperature difference, a</span> <span class="eq">= ±</span><span class="vl">${s.deltaTemp} °C</span></div>
            <div class="calc-line"><span class="v">a × β</span> <span class="op">=</span> <span class="vl">${s.deltaTemp}</span> <span class="op">×</span> <span class="vl">${s.tempCoeff}</span> <span class="eq">=</span> <span class="vl">${fmtNum(s.deltaTemp*s.tempCoeff,4)} %</span></div>
            <div class="calc-line"><span class="v">√3</span> <span class="eq">=</span> <span class="vl">1.73205</span></div>
            <div class="calc-line"><span class="v">u₅</span> <span class="op">=</span> <span class="vl">${fmtNum(s.deltaTemp*s.tempCoeff,4)}</span> <span class="op">/</span> <span class="vl">1.73205</span></div>
            <div class="calc-line result-line"><span class="v">u₅</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.u5,6)} %</span></div>
            <div class="calc-line"><span class="v">u₅²</span> <span class="eq">=</span> <span class="vl">${calc.u5Sq.toExponential(6)}</span></div>
            <div class="note">Rectangular distribution · v = ∞</div>
        `));

        // Uc
        container.appendChild(createStepEl('c', 'Combined Standard Uncertainty', 'Uc = √Σuᵢ²', `
            <div class="formula-box">Uc = √(u₁² + u₂² + u₃² + u₄² + u₅²)</div>
            <div class="calc-line"><span class="v">u₁²</span> <span class="eq">=</span> <span class="vl">${calc.u1Sq.toExponential(4)}</span></div>
            <div class="calc-line"><span class="v">u₂²</span> <span class="eq">=</span> <span class="vl">${calc.u2Sq.toExponential(4)}</span></div>
            <div class="calc-line"><span class="v">u₃²</span> <span class="eq">=</span> <span class="vl">${calc.u3Sq.toExponential(6)}</span></div>
            <div class="calc-line"><span class="v">u₄²</span> <span class="eq">=</span> <span class="vl">${calc.u4Sq.toExponential(4)}</span></div>
            <div class="calc-line"><span class="v">u₅²</span> <span class="eq">=</span> <span class="vl">${calc.u5Sq.toExponential(6)}</span></div>
            <div class="calc-divider"></div>
            <div class="calc-line"><span class="v">Σuᵢ²</span> <span class="eq">= ${calc.u1Sq.toExponential(4)} + ${calc.u2Sq.toExponential(4)} + ${calc.u3Sq.toExponential(6)} + ${calc.u4Sq.toExponential(4)} + ${calc.u5Sq.toExponential(6)}</span></div>
            <div class="calc-line"><span class="v">Σuᵢ²</span> <span class="eq">=</span> <span class="vl">${calc.sumSqU.toExponential(6)}</span></div>
            <div class="calc-line"><span class="v">Uc</span> <span class="op">= √</span><span class="vl">${calc.sumSqU.toExponential(6)}</span></div>
            <div class="calc-line result-line"><span class="v">Uc (Combined)</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.uc,5)} %</span></div>

            <div class="sub-step-label" style="margin-top:14px;">Effective Degrees of Freedom (Welch-Satterthwaite)</div>
            <div class="formula-box" style="margin-top:4px;">v<sub>eff</sub> = Uc⁴ / Σ(uᵢ⁴/vᵢ)</div>
            <div class="calc-line"><span class="v">Uc⁴</span> <span class="eq">=</span> <span class="vl">${calc.uc4.toExponential(6)}</span></div>
            <div class="calc-line"><span class="v">Σ(uᵢ⁴/vᵢ)</span> <span class="eq">= u₁⁴/v₁ + u₂⁴/v₂</span></div>
            <div class="calc-line"><span class="eq">=</span> <span class="vl">${calc.u14v.toExponential(4)} + ${calc.u24v.toExponential(4)} = ${calc.sumCu4v.toExponential(6)}</span></div>
            <div class="calc-line"><span class="v">v<sub>eff</sub></span> <span class="op">=</span> <span class="vl">${calc.uc4.toExponential(6)}</span> <span class="op">/</span> <span class="vl">${calc.sumCu4v.toExponential(6)}</span></div>
            <div class="calc-line result-line"><span class="v">v<sub>eff</sub></span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.veff,1)}</span></div>
        `));

        // Ue
        container.appendChild(createStepEl('e', 'Expanded Uncertainty', '95% Confidence Level', `
            <div class="formula-box">Ue = Uc × k &nbsp; (ROUNDUP to 3 decimal places)</div>
            <div class="calc-line"><span class="v">v<sub>eff</sub></span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.veff,1)}</span> <span class="note">→ Lookup Student's t-table</span></div>
            <div class="calc-line"><span class="v">k (95% CL)</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.kFactor,2)}</span></div>
            <div class="calc-line"><span class="v">Ue</span> <span class="op">=</span> <span class="vl">${fmtNum(calc.uc,5)}</span> <span class="op">×</span> <span class="vl">${fmtNum(calc.kFactor,2)}</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.ue,5)} %</span></div>
            <div class="calc-line"><span class="v">ROUNDUP(Ue, 3)</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.ueRounded,4)} %</span></div>
            <div class="calc-divider"></div>
            <div class="sub-step-label">MU Cap to CMC Validation (ISO 17025 §7.6.3)</div>
            <div class="formula-box" style="margin-top:4px;">Final MU = IF(MU < CMC, CMC, MU)</div>
            <div class="calc-line"><span class="v">Laboratory CMC</span> <span class="eq">=</span> <span class="vl">${calc.cmc} %</span> <span class="note">(from scope of accreditation)</span></div>
            <div class="calc-line"><span class="v">Calculated MU</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.ueRounded,4)} %</span></div>
            <div class="calc-line"><span class="v">${fmtNum(calc.ueRounded,4)} ${calc.ueRounded < calc.cmc ? '<' : '≥'} ${calc.cmc}</span></div>
            <div class="calc-line result-line" style="border-left-color:${calc.muCapped?'var(--warning)':'var(--success)'};">
                <span class="v">Final Reported MU</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.finalMU,4)} %</span>
                <span style="font-size:0.85em;display:block;margin-top:3px;font-weight:600;color:${calc.muCapped?'var(--warning)':'var(--success)'};">
                    ${calc.muCapped ? '⚠️ MU < CMC → CAPPED TO CMC' : '✅ MU ≥ CMC → REPORTED AS CALCULATED'}
                </span>
            </div>
        `));
    }

    function renderSummary(calc, s) {
        const c = document.getElementById('summary-container'); if (!c) return;
        c.innerHTML = `
            ${calc.muCapped ? `<div class="cmc-banner capped">⚠️ <span class="big">MU Capped to CMC</span>Calculated MU (${fmtNum(calc.ueRounded,4)}%) is less than laboratory CMC (${calc.cmc}%).<br>Final reported MU = <strong>${fmtNum(calc.finalMU,4)}%</strong> (capped).</div>` : `<div class="cmc-banner pass">✅ <span class="big">MU ≥ CMC — Valid</span>Calculated MU (${fmtNum(calc.ueRounded,4)}%) ≥ laboratory CMC (${calc.cmc}%).<br>MU reported without capping.</div>`}
            <div class="summary-card"><h3>📊 Measurement Uncertainty Budget — ${s.projectName}</h3>
            <table class="summary-table">
                <tr><td class="s-label">U1 · Repeatability (Type A)</td><td class="s-val">${fmtNum(calc.u1,5)} %</td></tr>
                <tr><td class="s-label">U2 · Reference Std. Cal Cert (Type B)</td><td class="s-val">${fmtNum(calc.u2,5)} %</td></tr>
                <tr><td class="s-label">U3 · Resolution (Type B)</td><td class="s-val">${fmtNum(calc.u3,6)} %</td></tr>
                <tr><td class="s-label">U4 · Error Drift (Type B)</td><td class="s-val">${fmtNum(calc.u4,4)} %</td></tr>
                <tr><td class="s-label">U5 · Temperature Coefficient (Type B)</td><td class="s-val">${fmtNum(calc.u5,6)} %</td></tr>
                <tr class="s-sep"><td class="s-label"><strong>Uc · Combined Standard Uncertainty</strong></td><td class="s-val"><strong>${fmtNum(calc.uc,5)} %</strong></td></tr>
                <tr><td class="s-label">Effective Degrees of Freedom (v<sub>eff</sub>)</td><td class="s-val">${fmtNum(calc.veff,1)}</td></tr>
                <tr><td class="s-label">Coverage Factor k (95% Confidence Level)</td><td class="s-val">${fmtNum(calc.kFactor,2)}</td></tr>
                <tr><td class="s-label">Expanded Uncertainty Ue (before ROUNDUP)</td><td class="s-val">${fmtNum(calc.ue,5)} %</td></tr>
                <tr><td class="s-label">Ue ROUNDUP (3 d.p.)</td><td class="s-val">${fmtNum(calc.ueRounded,4)} %</td></tr>
                <tr class="s-sep"><td class="s-label"><strong>Laboratory CMC</strong></td><td class="s-val"><strong>${calc.cmc} %</strong></td></tr>
                <tr><td class="s-label"><strong>Final Reported MU</strong></td><td class="s-val" style="font-size:1.15em;color:${calc.muCapped?'var(--warning)':'var(--success)'};"><strong>± ${fmtNum(calc.finalMU,4)} %</strong></td></tr>
            </table>
            <div class="final-result ${calc.muCapped?'capped':''}">
                ${calc.muCapped ? '⚠️ Final Expanded Uncertainty (Capped to Laboratory CMC)' : '✅ Final Expanded Uncertainty at 95% Confidence Level'}
                <span class="big">U = ± ${fmtNum(calc.finalMU,4)} %</span>
            </div></div>`;
    }

    function renderExcelCompare(calc, s) {
        const c = document.getElementById('excel-container'); if (!c) return;
        const match = Math.abs(calc.finalMU - s.excelMU) < 0.001;
        c.innerHTML = `
            <div class="card-header"><span class="card-icon">📋</span><h3>Excel Comparison (Validation)</h3></div>
            <div class="compare-grid">
                <div class="c-head">Item</div><div class="c-head">Value</div>
                <div>App Final MU</div><div>${fmtNum(calc.finalMU,4)} %</div>
                <div>Excel Final MU</div><div>${s.excelMU.toFixed(3)} %</div>
                <div>Match Status</div><div class="${match?'c-match':'c-diff'}">${match?'✅ MATCH — Both give same value':'⚠️ MISMATCH — Check input values'}</div>
            </div>
            ${!match ? `<p style="margin-top:8px;font-size:0.75em;color:var(--text-secondary);">Possible causes: Different MU Cert value per parameter, or Excel uses a different ROUNDUP formula. Verify the MU from Cal Cert matches the parameter being evaluated.</p>` : ''}
        `;
    }

    function renderReadings() {
        const container = document.getElementById('readings-dynamic'); if (!container) return;
        container.innerHTML = state.readings.map((v, i) => `
            <div class="reading-row" id="reading-row-${i}">
                <span class="row-num">#${i+1}</span>
                <input type="number" value="${v}" step="0.0001" onchange="window._updateReading(${i}, this.value)" onfocus="this.select()">
                ${state.readings.length > 2 ? `<button class="btn-icon-sm danger" onclick="window._removeReading(${i})" title="Remove reading">✕</button>` : ''}
            </div>
        `).join('');
        const sum = state.readings.reduce((a,b)=>a+b,0);
        const avg = sum / state.readings.length;
        const summaryEl = document.getElementById('readings-summary-text');
        if (summaryEl) summaryEl.innerHTML = `<strong>n = ${state.readings.length}</strong> &nbsp;|&nbsp; <strong>Average = ${fmtNum(avg,5)}</strong> &nbsp;|&nbsp; <strong>Sum = ${fmtNum(sum,4)}</strong>`;
    }

    window._updateReading = function(index, value) { const v = parseFloat(value); if (!isNaN(v)) { state.readings[index] = v; saveToStorage(); renderReadings(); } };
    window._removeReading = function(index) { if (state.readings.length <= 2) { showToast('Minimum 2 readings required'); return; } state.readings.splice(index, 1); saveToStorage(); renderReadings(); };
    window._addReading = function() { const lastVal = state.readings[state.readings.length - 1] || 0; state.readings.push(lastVal); saveToStorage(); renderReadings(); setTimeout(() => { const container = document.getElementById('readings-dynamic'); if (container) { const lastRow = container.querySelector('.reading-row:last-child'); if (lastRow) lastRow.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, 100); };

    function updateTestDisplay() {
        const s = state;
        ['energy','phase','pf','voltage','current'].forEach(f => { const el = document.getElementById(`tp-${f}`); if (!el) return; const vals = { energy: s.energyType==='+P'?'Active Power Import (+P)':s.energyType==='-P'?'Active Power Export (-P)':s.energyType==='+Q'?'Reactive Power Import (+Q)':'Reactive Power Export (-Q)', phase: s.testPhase==='ABC'?'ABC (3-Phase)':s.testPhase==='A'?'A-Phase':s.testPhase==='B'?'B-Phase':'C-Phase', pf: s.testPF==='1'?'1.0 (Unity)':s.testPF==='0.5L'?'0.5 Lag':'0.866 Lag', voltage: s.testVoltage+'V', current: s.testCurrent+'A' }; el.textContent = vals[f]; });
    }

    function renderAll() {
        mainContent.innerHTML = `
            <div class="card"><div class="card-header"><span class="card-icon">📁</span><h3>Job Information</h3></div>
            <div class="job-grid">
                <div class="form-group"><label>Job Reference</label><input type="text" id="in-jobRef" value="${state.jobRef||''}"></div>
                <div class="form-group"><label>Customer</label><input type="text" id="in-customer" value="${state.customer||''}"></div>
                <div class="form-group"><label>Meter Manufacturer</label><input type="text" id="in-meterMfr" value="${state.meterMfr||''}"></div>
                <div class="form-group"><label>Meter Model / Type</label><input type="text" id="in-meterModel" value="${state.meterModel||''}"></div>
                <div class="form-group"><label>Meter Serial Number</label><input type="text" id="in-meterSN" value="${state.meterSN||''}"></div>
                <div class="form-group"><label>Reference Standard Description</label><input type="text" id="in-refStdDesc" value="${state.refStdDesc||''}"></div>
                <div class="form-group"><label>Reference Standard Serial No</label><input type="text" id="in-refStdSN" value="${state.refStdSN||''}"></div>
                <div class="form-group"><label>Traceability (Cal Cert No)</label><input type="text" id="in-refStdTrace" value="${state.refStdTrace||''}"></div>
            </div></div>

            <div class="card"><div class="card-header"><span class="card-icon">📋</span><h3>Meter Information & Test Parameters</h3></div>
            <div class="meter-grid">
                <div class="form-group"><label>Rated Current (A)</label><input type="number" id="in-ratedCurrent" value="${state.ratedCurrent}" step="0.1"></div>
                <div class="form-group"><label>Rated Voltage (V)</label><input type="number" id="in-ratedVoltage" value="${state.ratedVoltage}" step="1"></div>
                <div class="form-group"><label>Accuracy Class</label><input type="number" id="in-meterClass" value="${state.meterClass}" step="0.1"></div>
                <div class="form-group"><label>Meter Type</label><select id="in-meterType"><option value="DIRECT" ${state.meterType==='DIRECT'?'selected':''}>DIRECT</option><option value="CT" ${state.meterType==='CT'?'selected':''}>CT</option><option value="CT-VT" ${state.meterType==='CT-VT'?'selected':''}>CT-VT</option></select></div>
            </div>
            <div class="test-selector">
                <div class="ts-group"><span class="ts-label">Energy</span><select id="in-energyType"><option value="+P" ${state.energyType==='+P'?'selected':''}>+P (Import)</option><option value="-P" ${state.energyType==='-P'?'selected':''}>-P (Export)</option><option value="+Q" ${state.energyType==='+Q'?'selected':''}>+Q (Import)</option><option value="-Q" ${state.energyType==='-Q'?'selected':''}>-Q (Export)</option></select></div>
                <div class="ts-group"><span class="ts-label">Phase</span><select id="in-testPhase"><option value="ABC" ${state.testPhase==='ABC'?'selected':''}>ABC</option><option value="A" ${state.testPhase==='A'?'selected':''}>A</option><option value="B" ${state.testPhase==='B'?'selected':''}>B</option><option value="C" ${state.testPhase==='C'?'selected':''}>C</option></select></div>
                <div class="ts-group"><span class="ts-label">Power Factor</span><select id="in-testPF"><option value="1" ${state.testPF==='1'?'selected':''}>1.0</option><option value="0.5L" ${state.testPF==='0.5L'?'selected':''}>0.5L</option><option value="0.866L" ${state.testPF==='0.866L'?'selected':''}>0.866L</option></select></div>
                <div class="ts-group"><span class="ts-label">Test Voltage (V)</span><input type="number" id="in-testVoltage" value="${state.testVoltage}" step="1"></div>
                <div class="ts-group"><span class="ts-label">Test Current (A)</span><input type="number" id="in-testCurrent" value="${state.testCurrent}" step="0.01"></div>
            </div>
            <div class="test-point"><strong>Active Test Point:</strong> <span id="tp-energy">${state.energyType==='+P'?'Active Power Import (+P)':state.energyType==='-P'?'Active Power Export (-P)':state.energyType==='+Q'?'Reactive Power Import (+Q)':'Reactive Power Export (-Q)'}</span> · <span id="tp-phase">${state.testPhase==='ABC'?'ABC (3-Phase)':state.testPhase==='A'?'A-Phase':state.testPhase==='B'?'B-Phase':'C-Phase'}</span> · <span id="tp-pf">${state.testPF==='1'?'1.0 (Unity)':state.testPF==='0.5L'?'0.5 Lag':'0.866 Lag'}</span> · <span id="tp-voltage">${state.testVoltage}V</span> · <span id="tp-current">${state.testCurrent}A</span></div></div>

            <div class="card"><div class="card-header"><span class="card-icon">📝</span><h3>Readings & Uncertainty Components</h3></div>
            <div class="readings-container">
                <label style="font-size:0.7em;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.8px;">Test Readings (Click + to add more rows)</label>
                <div id="readings-dynamic"></div>
                <button class="btn-add-reading" onclick="window._addReading()">➕ Add Reading</button>
                <div class="readings-summary" id="readings-summary-text"></div>
            </div>
            <div class="input-grid" style="margin-top:14px;">
                <div class="form-group cmc-highlight"><label>⭐ Laboratory CMC (%)</label><input type="number" id="in-cmc" value="${state.cmc}" step="0.001"></div>
                <div class="form-group"><label>MU from Calibration Certificate (%)</label><input type="number" id="in-muCert" value="${state.muCert}" step="0.001"><span class="validation-msg" id="msg-muCert">Must be > 0</span></div>
                <div class="form-group"><label>Coverage Factor (k) from Cert</label><input type="number" id="in-kCert" value="${state.kCert}" step="0.01"><span class="validation-msg" id="msg-kCert">Must be ≥ 1</span></div>
                <div class="form-group"><label>Resolution of Ref Std (%)</label><input type="number" id="in-resolution" value="${state.resolution}" step="0.0001"><span class="validation-msg" id="msg-resolution">Must be ≥ 0</span></div>
                <div class="form-group"><label>Error Drift of Ref Std (%)</label><input type="number" id="in-drift" value="${state.drift}" step="0.001"><span class="validation-msg" id="msg-drift">Must be ≥ 0</span></div>
                <div class="form-group"><label>Temperature Coefficient (%/°C)</label><input type="number" id="in-tempCoeff" value="${state.tempCoeff}" step="0.001"><span class="validation-msg" id="msg-tempCoeff">Must be ≥ 0</span></div>
                <div class="form-group"><label>Δ Temperature (±°C)</label><input type="number" id="in-deltaTemp" value="${state.deltaTemp}" step="0.5"><span class="validation-msg" id="msg-deltaTemp">Must be ≥ 0</span></div>
                <div class="form-group"><label>Excel MU Value (for comparison)</label><input type="number" id="in-excelMU" value="${state.excelMU}" step="0.001"></div>
            </div>
            <div class="btn-row"><button class="btn btn-primary" id="btn-calc">🔄 Calculate & Validate</button></div></div>

            <div id="steps-container"></div>
            <div id="summary-container"></div>
            <div class="card" id="excel-container"></div>
        `;

        renderReadings();

        // Bind events
        const stringFields = { 'in-jobRef':'jobRef','in-customer':'customer','in-meterMfr':'meterMfr','in-meterModel':'meterModel','in-meterSN':'meterSN','in-refStdDesc':'refStdDesc','in-refStdSN':'refStdSN','in-refStdTrace':'refStdTrace' };
        Object.entries(stringFields).forEach(([id,key]) => { const el=document.getElementById(id); if(el) el.addEventListener('input',function(){state[key]=this.value;saveToStorage();}); });
        const numFields = { 'in-ratedCurrent':'ratedCurrent','in-ratedVoltage':'ratedVoltage','in-meterClass':'meterClass','in-testVoltage':'testVoltage','in-testCurrent':'testCurrent' };
        Object.entries(numFields).forEach(([id,key]) => { const el=document.getElementById(id); if(el) el.addEventListener('input',function(){state[key]=parseFloat(this.value)||0;saveToStorage();updateTestDisplay();}); });
        document.getElementById('in-meterType').addEventListener('change',function(){state.meterType=this.value;saveToStorage();});
        document.getElementById('in-energyType').addEventListener('change',function(){state.energyType=this.value;saveToStorage();updateTestDisplay();});
        document.getElementById('in-testPhase').addEventListener('change',function(){state.testPhase=this.value;saveToStorage();updateTestDisplay();});
        document.getElementById('in-testPF').addEventListener('change',function(){state.testPF=this.value;saveToStorage();updateTestDisplay();});

        const validation = validateInputs(state);
        if (validation.valid && state.readings.length >= 2) {
            const calc = calculate(state);
            renderSteps(calc, state);
            renderSummary(calc, state);
            renderExcelCompare(calc, state);
        } else if (validation.errors.length > 0) {
            document.getElementById('steps-container').innerHTML = `<div class="cmc-banner capped">⚠️ ${validation.errors.join('<br>')}</div>`;
        }

        document.getElementById('btn-calc').addEventListener('click', () => {
            const numIds = ['in-cmc','in-muCert','in-kCert','in-resolution','in-drift','in-tempCoeff','in-deltaTemp','in-excelMU'];
            const numKeys = ['cmc','muCert','kCert','resolution','drift','tempCoeff','deltaTemp','excelMU'];
            numIds.forEach((id,i) => {
                const el = document.getElementById(id); if(!el) return;
                const v = parseFloat(el.value);
                const msg = document.getElementById('msg-'+id.replace('in-',''));
                if (isNaN(v) || v < 0 || (numKeys[i]==='kCert' && v<1)) { el.classList.add('invalid'); if(msg) msg.classList.add('show'); }
                else { el.classList.remove('invalid'); if(msg) msg.classList.remove('show'); state[numKeys[i]] = v; }
            });
            saveToStorage();
            renderAll();
            setTimeout(() => { const el = document.getElementById('steps-container'); if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); }, 100);
        });
    }

    function saveProject() { document.getElementById('save-project-name').value = state.projectName || ''; saveModal.classList.add('show'); }
    function loadProject(index) { const saved = JSON.parse(localStorage.getItem('mu-projects-v3')||'[]'); if(index<0||index>=saved.length)return; state = Object.assign(JSON.parse(JSON.stringify(defaults)), saved[index].state); saveToStorage(); closeLoadModal(); renderAll(); showToast('📂 Project loaded!'); }
    function closeLoadModal() { loadModal.classList.remove('show'); }
    function closeSaveModal() { saveModal.classList.remove('show'); }
    function renderLoadModal() { const saved = JSON.parse(localStorage.getItem('mu-projects-v3')||'[]'); loadProjectList.innerHTML = saved.length===0 ? '<p style="color:var(--text-tertiary);text-align:center;padding:20px;">No saved projects</p>' : saved.map((p,i) => `<div class="modal-item" onclick="window._loadProject(${i})"><strong>${p.name}</strong><br><small>${new Date(p.date).toLocaleDateString('en-GB')}</small></div>`).join(''); }
    window._loadProject = loadProject;

    function init() {
        const splash = document.getElementById('splash-screen');
        const app = document.getElementById('app-container');
        loadFromStorage();
        applyTheme();
        setTimeout(() => {
            splash.classList.add('fade-out');
            app.style.display = 'flex'; app.classList.add('show');
            setTimeout(() => { if(splash&&splash.parentNode) splash.parentNode.removeChild(splash); }, 600);
            renderAll();
        }, 2200);
    }

    document.getElementById('btn-darkmode').addEventListener('click', () => { currentTheme = currentTheme==='dark'?'light':'dark'; applyTheme(); });
    document.getElementById('btn-save').addEventListener('click', saveProject);
    document.getElementById('btn-load').addEventListener('click', () => { renderLoadModal(); loadModal.classList.add('show'); });
    document.getElementById('btn-load-cancel').addEventListener('click', closeLoadModal);
    document.getElementById('btn-save-cancel').addEventListener('click', closeSaveModal);
    document.getElementById('btn-save-confirm').addEventListener('click', () => { const name = document.getElementById('save-project-name').value.trim(); if(!name){alert('Please enter a project name.');return;} state.projectName = name; const project = {name,date:new Date().toISOString(),state:JSON.parse(JSON.stringify(state))}; const saved=JSON.parse(localStorage.getItem('mu-projects-v3')||'[]');saved.push(project);localStorage.setItem('mu-projects-v3',JSON.stringify(saved));saveToStorage();closeSaveModal();showToast('✅ Project saved!'); });
    loadModal.addEventListener('click', function(e) { if(e.target===loadModal) closeLoadModal(); });
    saveModal.addEventListener('click', function(e) { if(e.target===saveModal) closeSaveModal(); });

    if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
