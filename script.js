/**
 * ============================================================
 * MU CALCULATOR PRO v3.0
 * Energy Meter Calibration · ISO/IEC 17025
 * Design System: Glassmorphism Dark Theme
 * ============================================================
 */

(function () {
    'use strict';

    // ==================== DEFAULT STATE PER TAB ====================
    function createDefaultState(tabName) {
        return {
            tabName: tabName || 'Parameter 1',
            jobRef: '',
            customer: '',
            meterMfr: '',
            meterModel: '',
            meterSN: '',
            refStdDesc: '',
            refStdSN: '',
            refStdTrace: '',
            refStdCMC: 0.04,
            refStdDrift: 0.02,
            ratedCurrent: 5,
            ratedVoltage: 240,
            meterClass: 1.0,
            meterType: 'DIRECT',
            energyType: '+P',
            testVoltage: 240,
            testCurrent: 0.1,
            testPF: '1',
            testPhase: 'ABC',
            readings: [],
            muCert: 0.04,
            kCert: 2,
            resolution: 0.0001,
            drift: 0.02,
            tempCoeff: 0.002,
            deltaTemp: 2,
            excelMU: 0.04,
        };
    }

    // ==================== GLOBAL STATE ====================
    let tabs = [];
    let activeTabIndex = 0;
    let currentTheme = localStorage.getItem('mu-theme') || 'dark';
    let tabCounter = parseInt(localStorage.getItem('mu-tabcounter-v3') || '1');

    // ==================== DOM REFS ====================
    const tabBar = document.getElementById('tab-bar');
    const tabContent = document.getElementById('tab-content');
    const loadModal = document.getElementById('load-modal');
    const loadProjectList = document.getElementById('load-project-list');
    const toast = document.getElementById('toast');

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
    function showToast(msg) { toast.textContent = msg; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2500); }

    // ==================== THEME ====================
    function applyTheme() {
        if (currentTheme === 'light') { document.body.classList.add('light'); document.getElementById('btn-darkmode').textContent = '☀️'; }
        else { document.body.classList.remove('light'); document.getElementById('btn-darkmode').textContent = '🌙'; }
        localStorage.setItem('mu-theme', currentTheme);
    }

    // ==================== TAB MANAGEMENT ====================
    function saveTabsToStorage() {
        const toSave = tabs.map(t => { const s = { ...t }; delete s._domCache; return s; });
        try { localStorage.setItem('mu-tabs-v3', JSON.stringify(toSave)); localStorage.setItem('mu-activeTab-v3', activeTabIndex); localStorage.setItem('mu-tabcounter-v3', tabCounter); }
        catch (e) { /* storage full */ }
    }
    function loadTabsFromStorage() {
        try {
            const saved = localStorage.getItem('mu-tabs-v3');
            if (saved) { tabs = JSON.parse(saved); activeTabIndex = parseInt(localStorage.getItem('mu-activeTab-v3') || '0'); tabCounter = parseInt(localStorage.getItem('mu-tabcounter-v3') || String(tabs.length || 1)); }
        } catch (e) { /* ignore */ }
        if (!tabs || tabs.length === 0) { tabs = [createDefaultState('Parameter 1')]; activeTabIndex = 0; }
        tabs = tabs.map(t => Object.assign(createDefaultState(t.tabName), t));
        if (activeTabIndex >= tabs.length) activeTabIndex = tabs.length - 1;
    }
    function addTab() { tabCounter++; const ns = createDefaultState('Parameter ' + tabCounter); tabs.push(ns); activeTabIndex = tabs.length - 1; saveTabsToStorage(); renderAll(); }
    function closeTab(index) { if (tabs.length <= 1) return; tabs.splice(index, 1); if (activeTabIndex >= tabs.length) activeTabIndex = tabs.length - 1; saveTabsToStorage(); renderAll(); }
    function switchTab(index) { activeTabIndex = index; saveTabsToStorage(); renderAll(); }
    function renderTabBar() {
        tabBar.innerHTML = tabs.map((t, i) => `
            <div class="tab-btn ${i === activeTabIndex ? 'active' : ''}" onclick="window._switchTab(${i})">
                ${t.tabName}
                ${tabs.length > 1 ? `<span class="tab-close" onclick="event.stopPropagation();window._closeTab(${i})">✕</span>` : ''}
            </div>
        `).join('');
    }
    window._switchTab = switchTab;
    window._closeTab = closeTab;
    window._addTab = addTab;

    // ==================== VALIDATION ====================
    function validateInputs(state) {
        let valid = true; const errors = [];
        if (state.readings.length < 2) { errors.push('Sekurang-kurangnya 2 readings diperlukan'); valid = false; }
        for (const r of state.readings) { if (isNaN(r) || !isFinite(r)) { errors.push('Semua readings mesti nombor sah'); valid = false; break; } }
        if (isNaN(state.refStdCMC) || state.refStdCMC <= 0) { errors.push('CMC mesti > 0'); valid = false; }
        if (isNaN(state.muCert) || state.muCert <= 0) { errors.push('MU Cal Cert mesti > 0'); valid = false; }
        if (isNaN(state.kCert) || state.kCert < 1) { errors.push('k dari Cert mesti ≥ 1'); valid = false; }
        if (isNaN(state.resolution) || state.resolution < 0) { errors.push('Resolution tak boleh negatif'); valid = false; }
        if (isNaN(state.drift) || state.drift < 0) { errors.push('Drift tak boleh negatif'); valid = false; }
        if (isNaN(state.tempCoeff) || state.tempCoeff < 0) { errors.push('Temp Coefficient tak boleh negatif'); valid = false; }
        if (isNaN(state.deltaTemp) || state.deltaTemp < 0) { errors.push('Δ Temperature tak boleh negatif'); valid = false; }
        return { valid, errors };
    }

    // ==================== CALCULATION ENGINE ====================
    function calculate(state) {
        const { readings, muCert, kCert, resolution, drift, tempCoeff, deltaTemp } = state;
        const n = readings.length;
        const sum = readings.reduce((a, b) => a + b, 0);
        const avg = sum / n;
        const sumSqDiff = readings.reduce((acc, x) => acc + (x - avg) ** 2, 0);
        const stdDev = Math.sqrt(sumSqDiff / (n - 1));
        const u1 = stdDev / Math.sqrt(n);
        const u1Sq = u1 ** 2; const u14v = u1 ** 4 / (n - 1);
        const u2 = muCert / kCert; const u2Sq = u2 ** 2; const u24v = u2 ** 4 / 60;
        const semiR = resolution / 2; const u3 = semiR / Math.sqrt(3); const u3Sq = u3 ** 2;
        const u4 = drift / Math.sqrt(3); const u4Sq = u4 ** 2;
        const u5 = (deltaTemp * tempCoeff) / Math.sqrt(3); const u5Sq = u5 ** 2;
        const sumSqU = u1Sq + u2Sq + u3Sq + u4Sq + u5Sq;
        const uc = Math.sqrt(sumSqU); const uc4 = uc ** 4;
        const sumCu4v = u14v + u24v; const veff = sumCu4v > 0 ? uc4 / sumCu4v : 999;
        function getK(v) {
            if (v <= 0 || isNaN(v)) return 2.0; if (v >= 120) return 1.98;
            const t = [[1,12.71],[2,4.30],[3,3.18],[4,2.78],[5,2.57],[6,2.45],[7,2.36],[8,2.31],[9,2.26],[10,2.23],[11,2.20],[12,2.18],[13,2.16],[14,2.14],[15,2.13],[16,2.12],[17,2.11],[18,2.10],[19,2.09],[20,2.09],[25,2.06],[30,2.04],[35,2.03],[40,2.02],[45,2.01],[50,2.01],[60,2.00],[70,1.99],[80,1.99],[90,1.99],[100,1.98],[110,1.98],[120,1.98]];
            for (let i = 0; i < t.length - 1; i++) { if (v >= t[i][0] && v < t[i+1][0]) return t[i][1]; } return 1.98;
        }
        const kFactor = getK(veff); const ue = uc * kFactor; const ueRounded = Math.ceil(ue * 1000) / 1000;
        const cmc = state.refStdCMC; const muCapped = ueRounded < cmc; const finalMU = muCapped ? cmc : ueRounded;
        return { n, sum, avg, sumSqDiff, stdDev, u1, u1Sq, u14v, u2, u2Sq, u24v, u3, u3Sq, semiR, u4, u4Sq, u5, u5Sq, sumSqU, uc, uc4, sumCu4v, veff, kFactor, ue, ueRounded, cmc, muCapped, finalMU };
    }

    // ==================== RENDER STEPS ====================
    function createStepEl(num, title, type, bodyHTML) {
        const d = document.createElement('div'); d.className = 'step open';
        d.innerHTML = `<div class="step-header" role="button" tabindex="0" aria-expanded="true" onclick="this.parentElement.classList.toggle('open');this.setAttribute('aria-expanded',this.parentElement.classList.contains('open'))" onkeydown="if(event.key==='Enter'||event.key===' '){this.click();event.preventDefault()}"><span class="step-num">U${num}</span><span class="step-title">${title}</span><span class="step-type">${type}</span><span class="step-arrow">▼</span></div><div class="step-body">${bodyHTML}</div>`;
        return d;
    }

    function renderSteps(calc, state, tabIdx) {
        const container = document.getElementById(`steps-${tabIdx}`); if (!container) return; container.innerHTML = '';
        const n = state.readings.length;
        container.appendChild(createStepEl('1', 'Repeatability (Energy Error)', 'Type A · Normal', `<div class="formula-box">u₁ = σ / √n</div><div class="sub-step-label">Step 1: Average (x̄)</div><div class="calc-line"><span class="v">Sum</span> <span class="op">=</span> <span class="vl">${fmtNum(calc.sum,4)}</span></div><div class="calc-line"><span class="v">x̄</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.avg,5)}</span></div><div class="sub-step-label">Step 2: Standard Deviation (σ)</div><div class="calc-line"><span class="v">Σ(xi-x̄)²</span> <span class="op">=</span> <span class="vl">${fmtNum(calc.sumSqDiff,6)}</span></div><div class="calc-line"><span class="v">σ</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.stdDev,5)}</span></div><div class="sub-step-label">Step 3: u₁</div><div class="calc-line"><span class="v">√n</span> <span class="eq">=</span> <span class="vl">${fmtNum(Math.sqrt(n),4)}</span></div><div class="calc-line result-line"><span class="v">u₁</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.u1,5)} %</span></div><div class="calc-line"><span class="v">u₁²</span> <span class="eq">=</span> <span class="vl">${calc.u1Sq.toExponential(4)}</span> &nbsp; <span class="v">v</span> <span class="eq">= n−1 =</span> <span class="vl">${n-1}</span></div>`));
        container.appendChild(createStepEl('2', 'Reference Standard (Cal Cert)', 'Type B · Normal', `<div class="formula-box">u₂ = U<sub>cert</sub> / k</div><div class="calc-line"><span class="v">MU cert</span> <span class="eq">=</span> <span class="vl">${state.muCert} %</span>, <span class="v">k</span> <span class="eq">=</span> <span class="vl">${state.kCert}</span></div><div class="calc-line result-line"><span class="v">u₂</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.u2,5)} %</span></div><div class="calc-line"><span class="v">u₂²</span> <span class="eq">=</span> <span class="vl">${calc.u2Sq.toExponential(4)}</span> &nbsp; <span class="v">v</span> <span class="eq">≈ 60</span></div>`));
        container.appendChild(createStepEl('3', 'Resolution (Ref. Std.)', 'Type B · Rect', `<div class="formula-box">u₃ = a / √3 &nbsp; (a = R/2)</div><div class="calc-line"><span class="v">R</span> <span class="eq">=</span> <span class="vl">${state.resolution} %</span>, <span class="v">a</span> <span class="eq">=</span> <span class="vl">${calc.semiR.toExponential(1)}</span></div><div class="calc-line result-line"><span class="v">u₃</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.u3,6)} %</span></div><div class="calc-line note">Rectangular · v = ∞</div>`));
        container.appendChild(createStepEl('4', 'Error Drift', 'Type B · Rect', `<div class="formula-box">u₄ = D / √3</div><div class="calc-line"><span class="v">D</span> <span class="eq">=</span> <span class="vl">${state.drift} %</span></div><div class="calc-line result-line"><span class="v">u₄</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.u4,4)} %</span></div><div class="calc-line note">Rectangular · v = ∞</div>`));
        container.appendChild(createStepEl('5', 'Temperature Coefficient', 'Type B · Rect', `<div class="formula-box">u₅ = (a × β) / √3</div><div class="calc-line"><span class="v">β</span> <span class="eq">=</span> <span class="vl">${state.tempCoeff} %/°C</span>, <span class="v">a</span> <span class="eq">=</span> <span class="vl">${state.deltaTemp} °C</span></div><div class="calc-line"><span class="v">a×β</span> <span class="eq">=</span> <span class="vl">${fmtNum(state.deltaTemp*state.tempCoeff,4)}</span></div><div class="calc-line result-line"><span class="v">u₅</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.u5,6)} %</span></div><div class="calc-line note">Rectangular · v = ∞</div>`));
        container.appendChild(createStepEl('c', 'Combined Uncertainty', 'Uc', `<div class="formula-box">Uc = √(u₁²+u₂²+u₃²+u₄²+u₅²)</div><div class="calc-line"><span class="v">Σ uᵢ²</span> <span class="eq">=</span> <span class="vl">${calc.sumSqU.toExponential(6)}</span></div><div class="calc-line result-line"><span class="v">Uc</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.uc,5)} %</span></div><div class="sub-step-label" style="margin-top:10px;">Effective Degrees of Freedom</div><div class="formula-box" style="margin-top:4px;">v<sub>eff</sub> = Uc⁴ / Σ(uᵢ⁴/vᵢ)</div><div class="calc-line"><span class="v">Σ(u⁴/v)</span> <span class="eq">=</span> <span class="vl">${calc.sumCu4v.toExponential(6)}</span></div><div class="calc-line result-line"><span class="v">v<sub>eff</sub></span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.veff,1)}</span></div>`));
        container.appendChild(createStepEl('e', 'Expanded Uncertainty', '95% Confidence', `<div class="formula-box">Ue = Uc × k &nbsp; (ROUNDUP 3 d.p.)</div><div class="calc-line"><span class="v">k (v=${fmtNum(calc.veff,1)})</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.kFactor,2)}</span></div><div class="calc-line"><span class="v">Ue</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.ue,5)} %</span> &nbsp; <span class="v">ROUNDUP</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.ueRounded,4)} %</span></div><div class="calc-divider"></div><div class="sub-step-label">MU Cap to CMC (ISO 17025)</div><div class="formula-box" style="margin-top:4px;">Final MU = IF(MU < CMC, CMC, MU)</div><div class="calc-line"><span class="v">CMC</span> <span class="eq">=</span> <span class="vl">${state.refStdCMC} %</span> &nbsp; <span class="v">MU</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.ueRounded,4)} %</span></div><div class="calc-line result-line" style="border-left-color:${calc.muCapped?'var(--warning)':'var(--success)'};"><span class="v">Final</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.finalMU,4)} %</span><span style="font-size:0.85em;display:block;margin-top:2px;font-weight:600;color:${calc.muCapped?'var(--warning)':'var(--success)'};">${calc.muCapped?'⚠️ MU < CMC → DICAP':'✅ MU ≥ CMC → DILAPORKAN'}</span></div>`));
    }

    function renderSummary(calc, state, tabIdx) {
        const container = document.getElementById(`summary-${tabIdx}`); if (!container) return;
        container.innerHTML = `
            ${calc.muCapped ? `<div class="cmc-banner capped">⚠️ <span class="big">MU Dicap ke CMC</span>MU (${fmtNum(calc.ueRounded,4)}%) &lt; CMC (${state.refStdCMC}%) → Final = <strong>${fmtNum(calc.finalMU,4)}%</strong></div>` : `<div class="cmc-banner pass">✅ <span class="big">MU ≥ CMC</span>MU dilaporkan tanpa cap</div>`}
            <div class="summary-card">
                <h3>📊 MU Budget Summary — ${state.tabName}</h3>
                <table class="summary-table">
                    <tr><td class="s-label">U1 · Repeatability</td><td class="s-val">${fmtNum(calc.u1,5)} %</td></tr>
                    <tr><td class="s-label">U2 · Ref. Std. Cal Cert</td><td class="s-val">${fmtNum(calc.u2,5)} %</td></tr>
                    <tr><td class="s-label">U3 · Resolution</td><td class="s-val">${fmtNum(calc.u3,6)} %</td></tr>
                    <tr><td class="s-label">U4 · Error Drift</td><td class="s-val">${fmtNum(calc.u4,4)} %</td></tr>
                    <tr><td class="s-label">U5 · Temperature Coeff</td><td class="s-val">${fmtNum(calc.u5,6)} %</td></tr>
                    <tr class="s-sep"><td class="s-label"><strong>Uc · Combined</strong></td><td class="s-val"><strong>${fmtNum(calc.uc,5)} %</strong></td></tr>
                    <tr><td class="s-label">veff / k</td><td class="s-val">${fmtNum(calc.veff,1)} / ${fmtNum(calc.kFactor,2)}</td></tr>
                    <tr class="s-sep"><td class="s-label"><strong>CMC Makmal</strong></td><td class="s-val"><strong>${state.refStdCMC} %</strong></td></tr>
                    <tr><td class="s-label"><strong>MU Final</strong></td><td class="s-val" style="font-size:1.1em;color:${calc.muCapped?'var(--warning)':'var(--success)'};"><strong>${fmtNum(calc.finalMU,4)} %</strong></td></tr>
                </table>
                <div class="final-result ${calc.muCapped?'capped':''}">
                    ${calc.muCapped?'⚠️ Final Reported (Capped to CMC)':'✅ Final Reported Uncertainty'}
                    <span class="big">U = ± ${fmtNum(calc.finalMU,4)} %</span>
                </div>
            </div>`;
    }

    function renderExcelCompare(calc, state, tabIdx) {
        const container = document.getElementById(`excel-${tabIdx}`); if (!container) return;
        const match = Math.abs(calc.finalMU - state.excelMU) < 0.001;
        container.innerHTML = `
            <div class="card-header"><span class="card-icon">📋</span><h3>Perbandingan Excel</h3></div>
            <div class="compare-grid">
                <div class="c-head">Item</div><div class="c-head">Nilai</div>
                <div>App MU</div><div>${fmtNum(calc.finalMU,4)} %</div>
                <div>Excel MU</div><div>${state.excelMU.toFixed(3)} %</div>
                <div>Status</div><div class="${match?'c-match':'c-diff'}">${match?'✅ SAMA':'⚠️ BERBEZA'}</div>
            </div>`;
    }

    // ==================== RENDER TAB ====================
    function renderTabContent() {
        tabContent.innerHTML = tabs.map((t, i) => `
            <div class="tab-panel ${i === activeTabIndex ? 'active' : ''}" id="tab-panel-${i}">
                <div class="main-content">
                    <div class="card" id="job-card-${i}"><div class="card-header"><span class="card-icon">📁</span><h3>Job Info — ${t.tabName}</h3></div></div>
                    <div class="card" id="meter-card-${i}"><div class="card-header"><span class="card-icon">📋</span><h3>Meter Info & Test Parameter</h3></div></div>
                    <div class="card" id="input-card-${i}"><div class="card-header"><span class="card-icon">📝</span><h3>Readings & Components</h3></div></div>
                    <div id="steps-${i}"></div>
                    <div id="summary-${i}"></div>
                    <div class="card" id="excel-${i}"></div>
                </div>
            </div>`).join('');
    }

    function renderSingleTab(index) {
        const state = tabs[index];
        const validation = validateInputs(state);

        // Job Card
        const jobCard = document.getElementById(`job-card-${index}`); if (!jobCard) return;
        jobCard.innerHTML = `
            <div class="card-header"><span class="card-icon">📁</span><h3>Job Info — ${state.tabName}</h3></div>
            <div class="job-grid">
                <div class="form-group"><label>Job Ref</label><input type="text" id="job-ref-${index}" value="${state.jobRef}"></div>
                <div class="form-group"><label>Customer</label><input type="text" id="job-customer-${index}" value="${state.customer}"></div>
                <div class="form-group"><label>Meter Mfr</label><input type="text" id="job-mfr-${index}" value="${state.meterMfr}"></div>
                <div class="form-group"><label>Meter Model</label><input type="text" id="job-model-${index}" value="${state.meterModel}"></div>
                <div class="form-group"><label>Meter S/N</label><input type="text" id="job-sn-${index}" value="${state.meterSN}"></div>
                <div class="form-group"><label>Ref Std Desc</label><input type="text" id="job-refstd-desc-${index}" value="${state.refStdDesc}"></div>
                <div class="form-group"><label>Ref Std S/N</label><input type="text" id="job-refstd-sn-${index}" value="${state.refStdSN}"></div>
                <div class="form-group"><label>Traceability</label><input type="text" id="job-trace-${index}" value="${state.refStdTrace}"></div>
                <div class="form-group cmc-group"><label>⭐ CMC Makmal (%)</label><input type="number" id="job-cmc-${index}" value="${state.refStdCMC}" step="0.001"></div>
                <div class="form-group"><label>Drift Ref Std (%)</label><input type="number" id="job-drift-${index}" value="${state.refStdDrift}" step="0.001"></div>
                <div class="form-group"><label>Excel MU (banding)</label><input type="number" id="job-excelMU-${index}" value="${state.excelMU}" step="0.001"></div>
            </div>`;

        // Meter Card
        const meterCard = document.getElementById(`meter-card-${index}`);
        meterCard.innerHTML = `
            <div class="card-header"><span class="card-icon">📋</span><h3>Meter Info & Test Parameter</h3></div>
            <div class="meter-grid">
                <div class="form-group"><label>Rated Current (A)</label><input type="number" id="mi-ratedCurrent-${index}" value="${state.ratedCurrent}" step="0.1" min="0.1"></div>
                <div class="form-group"><label>Rated Voltage (V)</label><input type="number" id="mi-ratedVoltage-${index}" value="${state.ratedVoltage}" step="1" min="1"></div>
                <div class="form-group"><label>Class</label><input type="number" id="mi-class-${index}" value="${state.meterClass}" step="0.1" min="0.1"></div>
                <div class="form-group"><label>Meter Type</label><select id="mi-type-${index}"><option value="DIRECT" ${state.meterType==='DIRECT'?'selected':''}>DIRECT</option><option value="CT" ${state.meterType==='CT'?'selected':''}>CT</option><option value="CT-VT" ${state.meterType==='CT-VT'?'selected':''}>CT-VT</option></select></div>
            </div>
            <div class="test-selector">
                <div class="ts-group"><span class="ts-label">Energy</span><select id="ts-energy-${index}"><option value="+P" ${state.energyType==='+P'?'selected':''}>+P</option><option value="-P" ${state.energyType==='-P'?'selected':''}>-P</option><option value="+Q" ${state.energyType==='+Q'?'selected':''}>+Q</option><option value="-Q" ${state.energyType==='-Q'?'selected':''}>-Q</option></select></div>
                <div class="ts-group"><span class="ts-label">Phase</span><select id="ts-phase-${index}"><option value="ABC" ${state.testPhase==='ABC'?'selected':''}>ABC</option><option value="A" ${state.testPhase==='A'?'selected':''}>A</option><option value="B" ${state.testPhase==='B'?'selected':''}>B</option><option value="C" ${state.testPhase==='C'?'selected':''}>C</option></select></div>
                <div class="ts-group"><span class="ts-label">PF</span><select id="ts-pf-${index}"><option value="1" ${state.testPF==='1'?'selected':''}>1.0</option><option value="0.5L" ${state.testPF==='0.5L'?'selected':''}>0.5L</option><option value="0.866L" ${state.testPF==='0.866L'?'selected':''}>0.866L</option></select></div>
                <div class="ts-group"><span class="ts-label">Test Volt (V)</span><input type="number" id="ts-voltage-${index}" value="${state.testVoltage}" step="1" min="1"></div>
                <div class="ts-group"><span class="ts-label">Test Curr (A)</span><input type="number" id="ts-current-${index}" value="${state.testCurrent}" step="0.01" min="0"></div>
            </div>
            <div class="test-point">
                <strong>Test:</strong> <span id="tp-energy-${index}">${getEnergyLabel(state.energyType)}</span>
                <span>·</span> <span id="tp-phase-${index}">${getPhaseLabel(state.testPhase)}</span>
                <span>·</span> <span id="tp-pf-${index}">${getPFLabel(state.testPF)}</span>
                <span>·</span> <span id="tp-voltage-${index}">${state.testVoltage}V</span>
                <span>·</span> <span id="tp-current-${index}">${state.testCurrent}A</span>
            </div>
            <div class="readings-display" id="readings-display-${index}"><strong>${state.readings.length} Readings:</strong> ${state.readings.join(' &nbsp; ')}</div>`;

        // Input Card
        const inputCard = document.getElementById(`input-card-${index}`);
        inputCard.innerHTML = `
            <div class="card-header"><span class="card-icon">📝</span><h3>Readings & Uncertainty Components</h3></div>
            <div class="input-grid">
                <div class="form-group"><label>Readings (comma-separated)</label><input type="text" id="in-readings-${index}" value="${state.readings.join(',')}"><span class="validation-msg" id="msg-readings-${index}">Min 2 readings</span></div>
            </div>
            <div class="input-grid" style="margin-top:10px;">
                <div class="form-group"><label>MU Cal Cert (%)</label><input type="number" id="in-muCert-${index}" value="${state.muCert}" step="0.001" min="0.001"><span class="validation-msg" id="msg-muCert-${index}">Mesti > 0</span></div>
                <div class="form-group"><label>k from Cert</label><input type="number" id="in-kCert-${index}" value="${state.kCert}" step="0.01" min="1"><span class="validation-msg" id="msg-kCert-${index}">≥ 1</span></div>
                <div class="form-group"><label>Resolution Ref Std (%)</label><input type="number" id="in-resolution-${index}" value="${state.resolution}" step="0.0001" min="0"><span class="validation-msg" id="msg-resolution-${index}">≥ 0</span></div>
                <div class="form-group"><label>Drift (%)</label><input type="number" id="in-drift-${index}" value="${state.drift}" step="0.001" min="0"><span class="validation-msg" id="msg-drift-${index}">≥ 0</span></div>
                <div class="form-group"><label>Temp Coeff (%/°C)</label><input type="number" id="in-tempCoeff-${index}" value="${state.tempCoeff}" step="0.001" min="0"><span class="validation-msg" id="msg-tempCoeff-${index}">≥ 0</span></div>
                <div class="form-group"><label>Δ Temperature (°C)</label><input type="number" id="in-deltaTemp-${index}" value="${state.deltaTemp}" step="0.5" min="0"><span class="validation-msg" id="msg-deltaTemp-${index}">≥ 0</span></div>
            </div>
            <div class="btn-row"><button class="btn btn-primary" id="btn-calc-${index}">🔄 Kira Semula</button></div>`;

        // Bind events
        bindTabEvents(index);

        if (validation.valid && state.readings.length >= 2) {
            const calc = calculate(state);
            renderSteps(calc, state, index);
            renderSummary(calc, state, index);
            renderExcelCompare(calc, state, index);
        } else {
            const sc = document.getElementById(`steps-${index}`); if (sc) sc.innerHTML = validation.errors.length > 0 ? `<div class="cmc-banner capped">⚠️ ${validation.errors.join('<br>')}</div>` : '';
            const sumc = document.getElementById(`summary-${index}`); if (sumc) sumc.innerHTML = '';
            const exc = document.getElementById(`excel-${index}`); if (exc) exc.innerHTML = '';
        }
    }

    function bindTabEvents(index) {
        const stringFields = ['job-ref','job-customer','job-mfr','job-model','job-sn','job-refstd-desc','job-refstd-sn','job-trace'];
        const stringKeys = ['jobRef','customer','meterMfr','meterModel','meterSN','refStdDesc','refStdSN','refStdTrace'];
        stringFields.forEach((f, i) => { const el = document.getElementById(`${f}-${index}`); if (el) el.addEventListener('input', function() { tabs[index][stringKeys[i]] = this.value; saveTabsToStorage(); }); });

        const numFields = [['job-cmc','refStdCMC',true],['job-drift','refStdDrift',true],['job-excelMU','excelMU',false],['mi-ratedCurrent','ratedCurrent',false],['mi-ratedVoltage','ratedVoltage',false],['mi-class','meterClass',false],['ts-voltage','testVoltage',false],['ts-current','testCurrent',false]];
        numFields.forEach(([id,key,isDriftOrCMC]) => {
            const el = document.getElementById(`${id}-${index}`); if (!el) return;
            el.addEventListener('input', function() { const v = parseFloat(this.value)||0; tabs[index][key] = v; if (isDriftOrCMC) { if (key==='refStdDrift') { tabs[index].drift = v; const di = document.getElementById(`in-drift-${index}`); if(di) di.value = v; } if (key==='refStdCMC') { tabs[index].muCert = v; const mi = document.getElementById(`in-muCert-${index}`); if(mi) mi.value = v; } } saveTabsToStorage(); updateTestDisplay(index); });
        });

        ['mi-type','ts-energy','ts-phase','ts-pf'].forEach(id => {
            const el = document.getElementById(`${id}-${index}`); if (!el) return;
            const key = id.replace('mi-','').replace('ts-',''); const realKey = key==='type'?'meterType':key==='energy'?'energyType':key==='phase'?'testPhase':key==='pf'?'testPF':'';
            el.addEventListener('change', function() { tabs[index][realKey] = this.value; saveTabsToStorage(); updateTestDisplay(index); });
        });

        const calcBtn = document.getElementById(`btn-calc-${index}`);
        if (calcBtn) calcBtn.addEventListener('click', () => {
            const rdInput = document.getElementById(`in-readings-${index}`);
            if (rdInput) { const arr = rdInput.value.trim().split(/[\s,]+/).map(s => parseFloat(s.trim())).filter(x => !isNaN(x)); if (arr.length >= 2) { tabs[index].readings = arr; rdInput.classList.remove('invalid'); const msg = document.getElementById(`msg-readings-${index}`); if(msg) msg.classList.remove('show'); } else { rdInput.classList.add('invalid'); const msg = document.getElementById(`msg-readings-${index}`); if(msg) msg.classList.add('show'); } }
            const numInputs = [['in-muCert','muCert','msg-muCert'],['in-kCert','kCert','msg-kCert'],['in-resolution','resolution','msg-resolution'],['in-drift','drift','msg-drift'],['in-tempCoeff','tempCoeff','msg-tempCoeff'],['in-deltaTemp','deltaTemp','msg-deltaTemp']];
            numInputs.forEach(([elId,key,msgId]) => { const el = document.getElementById(`${elId}-${index}`); if (!el) return; const v = parseFloat(el.value); const msg = document.getElementById(`${msgId}-${index}`); if (isNaN(v)||v<0||(key==='kCert'&&v<1)) { el.classList.add('invalid'); if(msg) msg.classList.add('show'); } else { el.classList.remove('invalid'); if(msg) msg.classList.remove('show'); tabs[index][key] = v; } });
            saveTabsToStorage();
            renderSingleTab(index);
            setTimeout(() => { const stepsEl = document.getElementById(`steps-${index}`); if(stepsEl) stepsEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
        });
    }

    function updateTestDisplay(index) {
        const s = tabs[index];
        ['energy','phase','pf','voltage','current'].forEach(f => { const el = document.getElementById(`tp-${f}-${index}`); if (!el) return; if (f==='energy') el.textContent = getEnergyLabel(s.energyType); if (f==='phase') el.textContent = getPhaseLabel(s.testPhase); if (f==='pf') el.textContent = getPFLabel(s.testPF); if (f==='voltage') el.textContent = s.testVoltage+'V'; if (f==='current') el.textContent = s.testCurrent+'A'; });
        const rd = document.getElementById(`readings-display-${index}`); if (rd) rd.innerHTML = `<strong>${s.readings.length} Readings:</strong> ${s.readings.join(' &nbsp; ')}`;
    }

    // ==================== SAVE/LOAD ====================
    function saveProject() {
        const name = prompt('Nama project:', tabs[activeTabIndex]?.tabName || 'Project'); if (!name) return;
        const project = { name, date: new Date().toISOString(), tabs: JSON.parse(JSON.stringify(tabs)), activeTabIndex, tabCounter };
        const saved = JSON.parse(localStorage.getItem('mu-projects-v3') || '[]'); saved.push(project);
        localStorage.setItem('mu-projects-v3', JSON.stringify(saved)); showToast('✅ Project disimpan!');
    }
    function loadProject(index) {
        const saved = JSON.parse(localStorage.getItem('mu-projects-v3') || '[]'); if (index<0||index>=saved.length) return;
        const p = saved[index]; tabs = p.tabs.map(t => Object.assign(createDefaultState(t.tabName), t));
        activeTabIndex = p.activeTabIndex||0; tabCounter = p.tabCounter||tabs.length;
        saveTabsToStorage(); closeLoadModal(); renderAll(); showToast('📂 Project dimuat!');
    }
    function closeLoadModal() { loadModal.classList.remove('show'); }
    function renderLoadModal() {
        const saved = JSON.parse(localStorage.getItem('mu-projects-v3') || '[]');
        loadProjectList.innerHTML = saved.length===0 ? '<p style="color:var(--text-tertiary);text-align:center;padding:20px;">Tiada project</p>' : saved.map((p,i) => `<div class="modal-item" onclick="window._loadProject(${i})"><strong>${p.name}</strong><br><small>${new Date(p.date).toLocaleDateString('ms-MY')} · ${p.tabs.length} parameter</small></div>`).join('');
    }
    window._loadProject = loadProject;

    // ==================== RENDER ALL ====================
    function renderAll() { renderTabBar(); renderTabContent(); tabs.forEach((t, i) => { if (i === activeTabIndex || document.getElementById(`tab-panel-${i}`)) renderSingleTab(i); }); }

    // ==================== INIT ====================
    function init() {
        loadTabsFromStorage(); applyTheme(); renderAll();
    }

    // Events
    document.getElementById('btn-darkmode').addEventListener('click', () => { currentTheme = currentTheme==='dark'?'light':'dark'; applyTheme(); });
    document.getElementById('btn-add-tab').addEventListener('click', addTab);
    document.getElementById('btn-save').addEventListener('click', saveProject);
    document.getElementById('btn-load').addEventListener('click', () => { renderLoadModal(); loadModal.classList.add('show'); });
    document.getElementById('btn-load-cancel').addEventListener('click', closeLoadModal);
    loadModal.addEventListener('click', function(e) { if (e.target===loadModal) closeLoadModal(); });

    if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
