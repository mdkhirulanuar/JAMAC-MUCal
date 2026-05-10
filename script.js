/**
 * ============================================================
 * MU CALCULATOR - MANUAL STEP-BY-STEP
 * Energy Meter Calibration · ISO/IEC 17025
 * ============================================================
 */

(function () {
    'use strict';

    // ==================== DEFAULT DATA ====================
    const defaultData = {
        readings: [0.2854, 0.2673, 0.2714, 0.3126, 0.3009, 0.2975, 0.2881, 0.2690, 0.2851, 0.2583],
        muCert: 0.04,        // MU from Cal Cert (%)
        kCert: 2,            // Coverage factor from cert
        resolution: 0.0001,  // Resolution of Ref Std (%)
        drift: 0.02,         // Drift from MeterInfo (%)
        tempCoeff: 0.002,    // Temp coefficient (%/°C)
        deltaTemp: 2,        // Temperature difference (°C)
        paramInfo: {
            paramNum: '1',
            energy: '+P (Active Power Import)',
            voltage: '240 V',
            current: '0.1 A (2% of 5A)',
            pf: '1.0',
            phase: 'ABC (3-Phase)'
        }
    };

    // ==================== STATE ====================
    let data = { ...defaultData, readings: [...defaultData.readings] };

    // ==================== DOM REFS ====================
    const paramCard = document.getElementById('param-card');
    const inputCard = document.getElementById('input-card');
    const stepsContainer = document.getElementById('steps-container');
    const summaryContainer = document.getElementById('summary-container');
    const excelCompare = document.getElementById('excel-compare');

    // ==================== CALCULATION ENGINE ====================
    function calculateAll(readings, muCert, kCert, resolution, drift, tempCoeff, deltaTemp) {
        const n = readings.length;

        // U1 - Repeatability
        const sum = readings.reduce((a, b) => a + b, 0);
        const avg = sum / n;
        const sumSqDiff = readings.reduce((acc, x) => acc + Math.pow(x - avg, 2), 0);
        const stdDev = Math.sqrt(sumSqDiff / (n - 1));
        const u1 = stdDev / Math.sqrt(n);
        const u1Sq = Math.pow(u1, 2);
        const u14v = Math.pow(u1, 4) / (n - 1);

        // U2 - Cal Cert
        const u2 = muCert / kCert;
        const u2Sq = Math.pow(u2, 2);
        const u24v = Math.pow(u2, 4) / 60;

        // U3 - Resolution
        const semiR = resolution / 2;
        const u3 = semiR / Math.sqrt(3);
        const u3Sq = Math.pow(u3, 2);

        // U4 - Drift
        const u4 = drift / Math.sqrt(3);
        const u4Sq = Math.pow(u4, 2);

        // U5 - Temperature
        const u5 = (deltaTemp * tempCoeff) / Math.sqrt(3);
        const u5Sq = Math.pow(u5, 2);

        // Uc
        const sumSqU = u1Sq + u2Sq + u3Sq + u4Sq + u5Sq;
        const uc = Math.sqrt(sumSqU);
        const uc4 = Math.pow(uc, 4);

        // veff
        const sumCu4v = u14v + u24v;
        const veff = uc4 / sumCu4v;

        // k factor
        function getK(v) {
            if (v <= 0 || isNaN(v)) return 2.0;
            if (v >= 120) return 1.98;
            const tTable = [
                [1,12.71],[2,4.30],[3,3.18],[4,2.78],[5,2.57],
                [6,2.45],[7,2.36],[8,2.31],[9,2.26],[10,2.23],
                [11,2.20],[12,2.18],[13,2.16],[14,2.14],[15,2.13],
                [16,2.12],[17,2.11],[18,2.10],[19,2.09],[20,2.09],
                [25,2.06],[30,2.04],[35,2.03],[40,2.02],[45,2.01],
                [50,2.01],[60,2.00],[70,1.99],[80,1.99],[90,1.99],
                [100,1.98],[110,1.98],[120,1.98]
            ];
            for (let i = 0; i < tTable.length - 1; i++) {
                if (v >= tTable[i][0] && v < tTable[i + 1][0]) return tTable[i][1];
            }
            return 1.98;
        }
        const kFactor = getK(veff);
        const ue = uc * kFactor;

        return {
            n, sum, avg, sumSqDiff, stdDev, u1, u1Sq, u14v,
            u2, u2Sq, u24v,
            u3, u3Sq, semiR,
            u4, u4Sq,
            u5, u5Sq,
            sumSqU, uc, uc4,
            sumCu4v, veff, kFactor, ue
        };
    }

    // ==================== RENDER FUNCTIONS ====================
    function fmtNum(num, decimals) {
        if (Math.abs(num) < 1e-10) return '0.' + '0'.repeat(decimals);
        if (Math.abs(num) < 0.0001 && Math.abs(num) >= 1e-10) return num.toExponential(decimals - 1);
        return num.toFixed(decimals);
    }

    function createStep(num, title, type, bodyHTML) {
        const div = document.createElement('div');
        div.className = 'step open';
        div.innerHTML = `
            <div class="step-header" role="button" tabindex="0" aria-expanded="true"
                 onclick="this.parentElement.classList.toggle('open'); this.setAttribute('aria-expanded', this.parentElement.classList.contains('open'))"
                 onkeydown="if(event.key==='Enter'||event.key===' '){this.click();event.preventDefault()}">
                <span class="step-num">U${num}</span>
                <span class="step-title">${title}</span>
                <span class="step-type">${type}</span>
                <span class="step-arrow">▼</span>
            </div>
            <div class="step-body">${bodyHTML}</div>
        `;
        return div;
    }

    function renderAll(calc) {
        // Clear
        stepsContainer.innerHTML = '';
        summaryContainer.innerHTML = '';

        const { n, sum, avg, sumSqDiff, stdDev, u1, u1Sq, u14v,
                u2, u2Sq, u24v,
                u3, u3Sq, semiR,
                u4, u4Sq,
                u5, u5Sq,
                sumSqU, uc, uc4,
                sumCu4v, veff, kFactor, ue
              } = calc;

        // ---- U1 ----
        let u1HTML = `
            <div class="formula-box">u₁ = σ / √n</div>
            <div class="sub-step-label">Step 1: Cari Average (x̄)</div>
            <div class="calc-line"><span class="v">Sum</span> <span class="op">=</span> <span class="vl">${data.readings.join(' + ')}</span></div>
            <div class="calc-line"><span class="v">Sum</span> <span class="op">=</span> <span class="vl">${fmtNum(sum,4)}</span></div>
            <div class="calc-line"><span class="v">x̄</span> <span class="op">=</span> <span class="vl">${fmtNum(sum,4)}</span> <span class="op">/</span> <span class="vl">${n}</span> <span class="eq">=</span> <span class="vl">${fmtNum(avg,5)}</span></div>
            <div class="sub-step-label">Step 2: Cari Standard Deviation (σ)</div>
            <div class="calc-line"><span class="v">Σ(xi - x̄)²</span> <span class="op">=</span> <span class="vl">${fmtNum(sumSqDiff,6)}</span></div>
            <div class="calc-line"><span class="v">σ</span> <span class="op">= √[Σ(xi-x̄)² / (n-1)]</span></div>
            <div class="calc-line"><span class="v">σ</span> <span class="op">= √[</span><span class="vl">${fmtNum(sumSqDiff,6)}</span> / <span class="vl">${n-1}</span><span class="op">]</span></div>
            <div class="calc-line"><span class="v">σ</span> <span class="op">= √</span><span class="vl">${fmtNum(sumSqDiff/(n-1),6)}</span> <span class="eq">=</span> <span class="vl">${fmtNum(stdDev,5)}</span></div>
            <div class="sub-step-label">Step 3: Cari u₁</div>
            <div class="calc-line"><span class="v">√n</span> <span class="op">= √</span><span class="vl">${n}</span> <span class="eq">=</span> <span class="vl">${fmtNum(Math.sqrt(n),4)}</span></div>
            <div class="calc-line"><span class="v">u₁</span> <span class="op">=</span> <span class="vl">${fmtNum(stdDev,5)}</span> <span class="op">/</span> <span class="vl">${fmtNum(Math.sqrt(n),4)}</span></div>
            <div class="calc-line result-line"><span class="v">u₁</span> <span class="eq">=</span> <span class="vl">${fmtNum(u1,5)} %</span></div>
            <div class="calc-line"><span class="v">u₁²</span> <span class="eq">=</span> <span class="vl">${u1Sq.toExponential(4)}</span></div>
            <div class="calc-line"><span class="v">v (degrees of freedom)</span> <span class="eq">= n - 1 =</span> <span class="vl">${n-1}</span></div>
            <div class="calc-line"><span class="v">u₁⁴/v</span> <span class="eq">=</span> <span class="vl">${u14v.toExponential(4)}</span></div>
        `;
        stepsContainer.appendChild(createStep('1', 'Repeatability (Energy Error)', 'Type A · Normal', u1HTML));

        // ---- U2 ----
        let u2HTML = `
            <div class="formula-box">u₂ = U<sub>cert</sub> / k</div>
            <div class="calc-line"><span class="v">MU from Cal Cert</span> <span class="eq">=</span> <span class="vl">${data.muCert} %</span></div>
            <div class="calc-line"><span class="v">Coverage factor, k</span> <span class="eq">=</span> <span class="vl">${data.kCert}</span> <span class="note">(from cal certificate)</span></div>
            <div class="calc-line"><span class="v">u₂</span> <span class="op">=</span> <span class="vl">${data.muCert}</span> <span class="op">/</span> <span class="vl">${data.kCert}</span></div>
            <div class="calc-line result-line"><span class="v">u₂</span> <span class="eq">=</span> <span class="vl">${fmtNum(u2,5)} %</span></div>
            <div class="calc-line"><span class="v">u₂²</span> <span class="eq">=</span> <span class="vl">${u2Sq.toExponential(4)}</span></div>
            <div class="calc-line"><span class="v">v</span> <span class="eq">≈ 60</span> <span class="note">(Type B normal, large v)</span></div>
            <div class="calc-line"><span class="v">u₂⁴/v</span> <span class="eq">=</span> <span class="vl">${u24v.toExponential(4)}</span></div>
        `;
        stepsContainer.appendChild(createStep('2', 'Uncertainty Error (Ref. Std. Cal. Cert.)', 'Type B · Normal', u2HTML));

        // ---- U3 ----
        let u3HTML = `
            <div class="formula-box">u₃ = a / √3 &nbsp; (a = R / 2)</div>
            <div class="calc-line"><span class="v">Resolution, R</span> <span class="eq">=</span> <span class="vl">${data.resolution} %</span></div>
            <div class="calc-line"><span class="v">Semi-range, a</span> <span class="op">= R / 2 =</span> <span class="vl">${data.resolution}</span> <span class="op">/</span> <span class="vl">2</span></div>
            <div class="calc-line"><span class="v">a</span> <span class="eq">=</span> <span class="vl">${semiR.toExponential(1)} %</span></div>
            <div class="calc-line"><span class="v">u₃</span> <span class="op">=</span> <span class="vl">${semiR.toExponential(1)}</span> <span class="op">/</span> <span class="vl">1.7321</span></div>
            <div class="calc-line result-line"><span class="v">u₃</span> <span class="eq">=</span> <span class="vl">${fmtNum(u3,6)} %</span></div>
            <div class="calc-line"><span class="v">u₃²</span> <span class="eq">=</span> <span class="vl">${u3Sq.toExponential(4)}</span></div>
            <div class="calc-line note">Distribution: Rectangular · v = ∞</div>
        `;
        stepsContainer.appendChild(createStep('3', 'Resolution (Ref. Std. Test Bench)', 'Type B · Rectangular', u3HTML));

        // ---- U4 ----
        let u4HTML = `
            <div class="formula-box">u₄ = D / √3</div>
            <div class="calc-line"><span class="v">Error Drift, D</span> <span class="eq">=</span> <span class="vl">${data.drift} %</span></div>
            <div class="calc-line"><span class="v">u₄</span> <span class="op">=</span> <span class="vl">${data.drift}</span> <span class="op">/</span> <span class="vl">1.7321</span></div>
            <div class="calc-line result-line"><span class="v">u₄</span> <span class="eq">=</span> <span class="vl">${fmtNum(u4,4)} %</span></div>
            <div class="calc-line"><span class="v">u₄²</span> <span class="eq">=</span> <span class="vl">${u4Sq.toExponential(4)}</span></div>
            <div class="calc-line note">Distribution: Rectangular · v = ∞</div>
        `;
        stepsContainer.appendChild(createStep('4', 'Error Drift (Ref. Std.)', 'Type B · Rectangular', u4HTML));

        // ---- U5 ----
        let u5HTML = `
            <div class="formula-box">u₅ = (a × β) / √3</div>
            <div class="calc-line"><span class="v">Temp. Coefficient, β</span> <span class="eq">=</span> <span class="vl">${data.tempCoeff} %/°C</span></div>
            <div class="calc-line"><span class="v">Diff. Temperature, a</span> <span class="eq">= ±</span><span class="vl">${data.deltaTemp} °C</span></div>
            <div class="calc-line"><span class="v">a × β</span> <span class="op">=</span> <span class="vl">${data.deltaTemp}</span> <span class="op">×</span> <span class="vl">${data.tempCoeff}</span> <span class="eq">=</span> <span class="vl">${fmtNum(data.deltaTemp*data.tempCoeff,4)} %</span></div>
            <div class="calc-line"><span class="v">u₅</span> <span class="op">=</span> <span class="vl">${fmtNum(data.deltaTemp*data.tempCoeff,4)}</span> <span class="op">/</span> <span class="vl">1.7321</span></div>
            <div class="calc-line result-line"><span class="v">u₅</span> <span class="eq">=</span> <span class="vl">${fmtNum(u5,6)} %</span></div>
            <div class="calc-line"><span class="v">u₅²</span> <span class="eq">=</span> <span class="vl">${u5Sq.toExponential(4)}</span></div>
            <div class="calc-line note">Distribution: Rectangular · v = ∞</div>
        `;
        stepsContainer.appendChild(createStep('5', 'Temperature Coefficient (Ref. Std.)', 'Type B · Rectangular', u5HTML));

        // ---- Uc ----
        let ucHTML = `
            <div class="formula-box">Uc = √(u₁² + u₂² + u₃² + u₄² + u₅²)</div>
            <div class="calc-line"><span class="v">u₁²</span> <span class="eq">=</span> <span class="vl">${u1Sq.toExponential(4)}</span></div>
            <div class="calc-line"><span class="v">u₂²</span> <span class="eq">=</span> <span class="vl">${u2Sq.toExponential(4)}</span></div>
            <div class="calc-line"><span class="v">u₃²</span> <span class="eq">=</span> <span class="vl">${u3Sq.toExponential(4)}</span></div>
            <div class="calc-line"><span class="v">u₄²</span> <span class="eq">=</span> <span class="vl">${u4Sq.toExponential(4)}</span></div>
            <div class="calc-line"><span class="v">u₅²</span> <span class="eq">=</span> <span class="vl">${u5Sq.toExponential(4)}</span></div>
            <div class="calc-divider"></div>
            <div class="calc-line"><span class="v">Σ uᵢ²</span> <span class="eq">=</span> <span class="vl">${sumSqU.toExponential(6)}</span></div>
            <div class="calc-line"><span class="v">Uc</span> <span class="op">= √</span><span class="vl">${sumSqU.toExponential(6)}</span></div>
            <div class="calc-line result-line"><span class="v">Uc (Combined)</span> <span class="eq">=</span> <span class="vl">${fmtNum(uc,5)} %</span></div>
            <div class="calc-line"><span class="v">Uc⁴</span> <span class="eq">=</span> <span class="vl">${uc4.toExponential(6)}</span></div>

            <div class="sub-step-label" style="margin-top:14px;">Effective Degrees of Freedom</div>
            <div class="formula-box" style="margin-top:6px;">v<sub>eff</sub> = Uc⁴ / Σ(uᵢ⁴/vᵢ)</div>
            <div class="calc-line"><span class="v">Σ(uᵢ⁴/vᵢ)</span> <span class="eq">= u₁⁴/v₁ + u₂⁴/v₂</span></div>
            <div class="calc-line"><span class="eq">=</span> <span class="vl">${u14v.toExponential(4)}</span> <span class="op">+</span> <span class="vl">${u24v.toExponential(4)}</span></div>
            <div class="calc-line"><span class="eq">=</span> <span class="vl">${sumCu4v.toExponential(6)}</span></div>
            <div class="calc-line"><span class="v">v<sub>eff</sub></span> <span class="op">=</span> <span class="vl">${uc4.toExponential(6)}</span> <span class="op">/</span> <span class="vl">${sumCu4v.toExponential(6)}</span></div>
            <div class="calc-line result-line"><span class="v">v<sub>eff</sub></span> <span class="eq">=</span> <span class="vl">${fmtNum(veff,1)}</span></div>
        `;
        stepsContainer.appendChild(createStep('c', 'Combined Uncertainty', 'Uc', ucHTML));

        // ---- Ue ----
        let ueHTML = `
            <div class="formula-box">Ue = Uc × k</div>
            <div class="calc-line"><span class="v">From t-table, v<sub>eff</sub> = ${fmtNum(veff,1)}</span></div>
            <div class="calc-line"><span class="v">k (95% CL)</span> <span class="eq">=</span> <span class="vl">${fmtNum(kFactor,2)}</span></div>
            <div class="calc-line"><span class="v">Ue</span> <span class="op">=</span> <span class="vl">${fmtNum(uc,5)}</span> <span class="op">×</span> <span class="vl">${fmtNum(kFactor,2)}</span></div>
            <div class="calc-line result-line"><span class="v">Ue (Expanded)</span> <span class="eq">=</span> <span class="vl">${fmtNum(ue,5)} %</span></div>
        `;
        stepsContainer.appendChild(createStep('e', 'Expanded Uncertainty', '95% Confidence', ueHTML));

        // ---- Summary ----
        summaryContainer.innerHTML = `
            <div class="summary-card">
                <h3>📊 Summary — Measurement Uncertainty Budget</h3>
                <table class="summary-table">
                    <tr><td class="s-label">U1 · Repeatability</td><td class="s-val">${fmtNum(u1,5)} %</td></tr>
                    <tr><td class="s-label">U2 · Ref. Std. Cal Cert</td><td class="s-val">${fmtNum(u2,5)} %</td></tr>
                    <tr><td class="s-label">U3 · Resolution Ref. Std</td><td class="s-val">${fmtNum(u3,6)} %</td></tr>
                    <tr><td class="s-label">U4 · Error Drift</td><td class="s-val">${fmtNum(u4,4)} %</td></tr>
                    <tr><td class="s-label">U5 · Temperature Coefficient</td><td class="s-val">${fmtNum(u5,6)} %</td></tr>
                    <tr class="s-sep"><td class="s-label"><strong>Uc · Combined</strong></td><td class="s-val"><strong>${fmtNum(uc,5)} %</strong></td></tr>
                    <tr><td class="s-label">v<sub>eff</sub></td><td class="s-val">${fmtNum(veff,1)}</td></tr>
                    <tr><td class="s-label">k (95% CL)</td><td class="s-val">${fmtNum(kFactor,2)}</td></tr>
                </table>
                <div class="final-result">
                    ✅ Expanded Uncertainty at 95% Confidence Level
                    <span class="big">U = ± ${fmtNum(ue,4)} %</span>
                </div>
            </div>
        `;

        // ---- Excel Comparison ----
        const excelMU = 0.041;  // from Excel ROUNDUP(Ue,3)
        const match = Math.abs(ue - excelMU) < 0.001;
        excelCompare.innerHTML = `
            <h3>📋 Perbandingan dengan Excel</h3>
            <div class="compare-grid">
                <div class="c-head">Item</div><div class="c-head">Nilai</div>
                <div>App MU (Ue)</div><div>${fmtNum(ue,4)} %</div>
                <div>Excel MU (Ue)</div><div>${excelMU.toFixed(3)} %</div>
                <div>Status</div><div class="${match ? 'c-match' : 'c-diff'}">${match ? '✅ SAMA' : '⚠️ BERBEZA'}</div>
            </div>
        `;
    }

    // ==================== RENDER INPUT & PARAM ====================
    function renderInput() {
        paramCard.innerHTML = `
            <h3>📋 Test Parameter</h3>
            <div class="param-grid">
                <div><span class="p-label">Parameter:</span> <span class="p-val">${data.paramInfo.paramNum}</span></div>
                <div><span class="p-label">Energy:</span> <span class="p-val">${data.paramInfo.energy}</span></div>
                <div><span class="p-label">Voltage:</span> <span class="p-val">${data.paramInfo.voltage}</span></div>
                <div><span class="p-label">Current:</span> <span class="p-val">${data.paramInfo.current}</span></div>
                <div><span class="p-label">PF:</span> <span class="p-val">${data.paramInfo.pf}</span></div>
                <div><span class="p-label">Phase:</span> <span class="p-val">${data.paramInfo.phase}</span></div>
            </div>
            <div class="readings-display">
                <strong>${data.readings.length} Readings:</strong> ${data.readings.join(' &nbsp; ')}
            </div>
        `;

        inputCard.innerHTML = `
            <h3>⚙️ Input Data (Boleh Ubah)</h3>
            <div class="input-grid">
                <div class="input-group">
                    <label for="in-readings">Readings (comma-separated)</label>
                    <input type="text" id="in-readings" value="${data.readings.join(',')}">
                </div>
                <div class="input-group">
                    <label for="in-muCert">MU Cal Cert (%)</label>
                    <input type="number" id="in-muCert" value="${data.muCert}" step="0.001">
                </div>
                <div class="input-group">
                    <label for="in-kCert">k from Cert</label>
                    <input type="number" id="in-kCert" value="${data.kCert}" step="0.01">
                </div>
                <div class="input-group">
                    <label for="in-resolution">Resolution Ref Std (%)</label>
                    <input type="number" id="in-resolution" value="${data.resolution}" step="0.0001">
                </div>
                <div class="input-group">
                    <label for="in-drift">Drift (%)</label>
                    <input type="number" id="in-drift" value="${data.drift}" step="0.001">
                </div>
                <div class="input-group">
                    <label for="in-tempCoeff">Temp Coefficient (%/°C)</label>
                    <input type="number" id="in-tempCoeff" value="${data.tempCoeff}" step="0.001">
                </div>
                <div class="input-group">
                    <label for="in-deltaTemp">Δ Temperature (°C)</label>
                    <input type="number" id="in-deltaTemp" value="${data.deltaTemp}" step="0.5">
                </div>
            </div>
            <div class="btn-row">
                <button class="btn btn-primary" id="btn-calculate">🔄 Kira Semula</button>
                <button class="btn btn-secondary" id="btn-reset">↩ Reset Default</button>
            </div>
        `;

        document.getElementById('btn-calculate').addEventListener('click', () => {
            const rdStr = document.getElementById('in-readings').value.trim();
            const arr = rdStr.split(',').map(s => parseFloat(s.trim())).filter(x => !isNaN(x));
            if (arr.length < 2) {
                alert('Sila masukkan sekurang-kurangnya 2 readings.');
                return;
            }
            data.readings = arr;
            data.muCert = parseFloat(document.getElementById('in-muCert').value) || data.muCert;
            data.kCert = parseFloat(document.getElementById('in-kCert').value) || data.kCert;
            data.resolution = parseFloat(document.getElementById('in-resolution').value) || data.resolution;
            data.drift = parseFloat(document.getElementById('in-drift').value) || data.drift;
            data.tempCoeff = parseFloat(document.getElementById('in-tempCoeff').value) || data.tempCoeff;
            data.deltaTemp = parseFloat(document.getElementById('in-deltaTemp').value) || data.deltaTemp;
            const calc = calculateAll(data.readings, data.muCert, data.kCert, data.resolution, data.drift, data.tempCoeff, data.deltaTemp);
            renderAll(calc);
            renderInput();
            window.scrollTo({ top: stepsContainer.offsetTop - 80, behavior: 'smooth' });
        });

        document.getElementById('btn-reset').addEventListener('click', () => {
            data = { ...defaultData, readings: [...defaultData.readings], paramInfo: {...defaultData.paramInfo} };
            const calc = calculateAll(data.readings, data.muCert, data.kCert, data.resolution, data.drift, data.tempCoeff, data.deltaTemp);
            renderAll(calc);
            renderInput();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // ==================== INIT ====================
    function init() {
        const calc = calculateAll(data.readings, data.muCert, data.kCert, data.resolution, data.drift, data.tempCoeff, data.deltaTemp);
        renderInput();
        renderAll(calc);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
