/**
 * ============================================================
 * MU CALCULATOR - Version 3.0
 * Energy Meter Calibration · ISO/IEC 17025
 * Features: Dark Mode, Save/Load, Print, Multiple Tabs
 * ============================================================
 */

(function () {
    'use strict';

    // ==================== DEFAULT STATE PER TAB ====================
    function createDefaultState(tabName) {
        return {
            tabName: tabName || 'Parameter 1',
            // Job Info
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
            readings: [],
            muCert: 0.04,
            kCert: 2,
            resolution: 0.0001,
            drift: 0.02,
            tempCoeff: 0.002,
            deltaTemp: 2,
            // Excel comparison
            excelMU: 0.04,
        };
    }

    // ==================== GLOBAL APP STATE ====================
    let tabs = [];
    let activeTabIndex = 0;
    let darkMode = localStorage.getItem('mu-darkmode') === 'true';
    let tabCounter = parseInt(localStorage.getItem('mu-tabcounter') || '1');

    // ==================== DOM REFS ====================
    const tabBar = document.getElementById('tab-bar');
    const tabContent = document.getElementById('tab-content');
    const sideMenu = document.getElementById('side-menu');
    const overlay = document.getElementById('overlay');
    const savedProjectsList = document.getElementById('saved-projects-list');
    const loadModal = document.getElementById('load-modal');
    const loadProjectList = document.getElementById('load-project-list');

    // ==================== HELPERS ====================
    function fmtNum(num, decimals) {
        if (!isFinite(num)) return '—';
        if (Math.abs(num) < 1e-12 && num !== 0) return num.toExponential(Math.max(0, decimals - 2));
        if (Math.abs(num) < 0.0001 && Math.abs(num) > 0) return num.toExponential(Math.max(0, decimals - 2));
        return num.toFixed(decimals);
    }
    function getEnergyLabel(e) {
        const m = { '+P': 'Active Power Import (+P)', '-P': 'Active Power Export (-P)', '+Q': 'Reactive Power Import (+Q)', '-Q': 'Reactive Power Export (-Q)' };
        return m[e] || e;
    }
    function getPFLabel(pf) {
        const m = { '1': '1.0 (Unity)', '0.5L': '0.5 Lag', '0.866L': '0.866 Lag', '0.5C': '0.5 Lead', '0.866C': '0.866 Lead', '0': '0 (Reactive)' };
        return m[pf] || pf;
    }
    function getPhaseLabel(ph) {
        const m = { 'ABC': 'ABC (3-Phase)', 'A': 'A-Phase', 'B': 'B-Phase', 'C': 'C-Phase' };
        return m[ph] || ph;
    }
    function getCurrentState() { return tabs[activeTabIndex]; }

    // ==================== DARK MODE ====================
    function applyDarkMode() {
        if (darkMode) {
            document.body.classList.add('dark');
            document.getElementById('btn-darkmode').textContent = '☀️';
        } else {
            document.body.classList.remove('dark');
            document.getElementById('btn-darkmode').textContent = '🌙';
        }
        localStorage.setItem('mu-darkmode', darkMode);
    }

    // ==================== TAB MANAGEMENT ====================
    function saveTabsToStorage() {
        const toSave = tabs.map(t => {
            const s = { ...t };
            delete s._domCache;
            return s;
        });
        try {
            localStorage.setItem('mu-tabs', JSON.stringify(toSave));
            localStorage.setItem('mu-activeTab', activeTabIndex);
            localStorage.setItem('mu-tabcounter', tabCounter);
        } catch (e) {
            // Storage full — ignore
        }
    }

    function loadTabsFromStorage() {
        try {
            const saved = localStorage.getItem('mu-tabs');
            if (saved) {
                tabs = JSON.parse(saved);
                activeTabIndex = parseInt(localStorage.getItem('mu-activeTab') || '0');
                tabCounter = parseInt(localStorage.getItem('mu-tabcounter') || String(tabs.length || 1));
            }
        } catch (e) { /* ignore */ }
        if (!tabs || tabs.length === 0) {
            tabs = [createDefaultState('Parameter 1')];
            activeTabIndex = 0;
        }
        // Ensure all tabs have all keys
        tabs = tabs.map(t => Object.assign(createDefaultState(t.tabName), t));
        if (activeTabIndex >= tabs.length) activeTabIndex = tabs.length - 1;
    }

    function addTab() {
        tabCounter++;
        const newState = createDefaultState('Parameter ' + tabCounter);
        tabs.push(newState);
        activeTabIndex = tabs.length - 1;
        saveTabsToStorage();
        renderAll();
    }

    function closeTab(index) {
        if (tabs.length <= 1) return;
        tabs.splice(index, 1);
        if (activeTabIndex >= tabs.length) activeTabIndex = tabs.length - 1;
        saveTabsToStorage();
        renderAll();
    }

    function switchTab(index) {
        activeTabIndex = index;
        saveTabsToStorage();
        renderAll();
    }

    function renderTabBar() {
        tabBar.innerHTML = tabs.map((t, i) => `
            <div class="tab-btn ${i === activeTabIndex ? 'active' : ''}" onclick="window._switchTab(${i})">
                ${t.tabName}
                ${tabs.length > 1 ? `<span class="tab-close" onclick="event.stopPropagation();window._closeTab(${i})">✕</span>` : ''}
            </div>
        `).join('');
    }

    // Expose to global for onclick
    window._switchTab = switchTab;
    window._closeTab = closeTab;
    window._addTab = addTab;

    // ==================== VALIDATION ====================
    function validateInputs(state) {
        let valid = true;
        const errors = [];
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
        const cmc = state.refStdCMC;
        const muCapped = ueRounded < cmc;
        const finalMU = muCapped ? cmc : ueRounded;
        return { n, sum, avg, sumSqDiff, stdDev, u1, u1Sq, u14v, u2, u2Sq, u24v, u3, u3Sq, semiR, u4, u4Sq, u5, u5Sq, sumSqU, uc, uc4, sumCu4v, veff, kFactor, ue, ueRounded, cmc, muCapped, finalMU };
    }

    // ==================== RENDER STEPS ====================
    function createStepEl(num, title, type, bodyHTML) {
        const d = document.createElement('div');
        d.className = 'step open';
        d.innerHTML = `<div class="step-header" role="button" tabindex="0" aria-expanded="true" onclick="this.parentElement.classList.toggle('open');this.setAttribute('aria-expanded',this.parentElement.classList.contains('open'))" onkeydown="if(event.key==='Enter'||event.key===' '){this.click();event.preventDefault()}"><span class="step-num">U${num}</span><span class="step-title">${title}</span><span class="step-type">${type}</span><span class="step-arrow">▼</span></div><div class="step-body">${bodyHTML}</div>`;
        return d;
    }

    function renderSteps(calc, state) {
        const container = document.getElementById(`steps-${activeTabIndex}`);
        if (!container) return;
        container.innerHTML = '';
        const n = state.readings.length;

        container.appendChild(createStepEl('1', 'Repeatability (Energy Error)', 'Type A · Normal', `
            <div class="formula-box">u₁ = σ / √n</div>
            <div class="sub-step-label">Step 1: Cari Average (x̄)</div>
            <div class="calc-line"><span class="v">Sum</span> <span class="op">=</span> <span class="vl">${fmtNum(calc.sum,4)}</span></div>
            <div class="calc-line"><span class="v">x̄</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.avg,5)}</span></div>
            <div class="sub-step-label">Step 2: Cari Standard Deviation (σ)</div>
            <div class="calc-line"><span class="v">Σ(xi-x̄)²</span> <span class="op">=</span> <span class="vl">${fmtNum(calc.sumSqDiff,6)}</span></div>
            <div class="calc-line"><span class="v">σ</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.stdDev,5)}</span></div>
            <div class="sub-step-label">Step 3: Cari u₁</div>
            <div class="calc-line"><span class="v">√n</span> <span class="eq">=</span> <span class="vl">${fmtNum(Math.sqrt(n),4)}</span></div>
            <div class="calc-line result-line"><span class="v">u₁</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.u1,5)} %</span></div>
            <div class="calc-line"><span class="v">u₁²</span> <span class="eq">=</span> <span class="vl">${calc.u1Sq.toExponential(4)}</span> &nbsp; <span class="v">v</span> <span class="eq">= n−1 =</span> <span class="vl">${n-1}</span></div>
            <div class="calc-line"><span class="v">u₁⁴/v</span> <span class="eq">=</span> <span class="vl">${calc.u14v.toExponential(4)}</span></div>
        `));

        container.appendChild(createStepEl('2', 'Reference Standard (Cal Cert)', 'Type B · Normal', `
            <div class="formula-box">u₂ = U<sub>cert</sub> / k</div>
            <div class="calc-line"><span class="v">MU Cal Cert</span> <span class="eq">=</span> <span class="vl">${state.muCert} %</span>, <span class="v">k</span> <span class="eq">=</span> <span class="vl">${state.kCert}</span></div>
            <div class="calc-line result-line"><span class="v">u₂</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.u2,5)} %</span></div>
            <div class="calc-line"><span class="v">u₂²</span> <span class="eq">=</span> <span class="vl">${calc.u2Sq.toExponential(4)}</span> &nbsp; <span class="v">v</span> <span class="eq">≈ 60</span></div>
            <div class="calc-line"><span class="v">u₂⁴/v</span> <span class="eq">=</span> <span class="vl">${calc.u24v.toExponential(4)}</span></div>
        `));

        container.appendChild(createStepEl('3', 'Resolution (Ref. Std.)', 'Type B · Rect', `
            <div class="formula-box">u₃ = a / √3 &nbsp; (a = R/2)</div>
            <div class="calc-line"><span class="v">R</span> <span class="eq">=</span> <span class="vl">${state.resolution} %</span>, <span class="v">a</span> <span class="eq">=</span> <span class="vl">${calc.semiR.toExponential(1)}</span></div>
            <div class="calc-line result-line"><span class="v">u₃</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.u3,6)} %</span></div>
            <div class="calc-line note">Rectangular · v = ∞</div>
        `));

        container.appendChild(createStepEl('4', 'Error Drift', 'Type B · Rect', `
            <div class="formula-box">u₄ = D / √3</div>
            <div class="calc-line"><span class="v">D</span> <span class="eq">=</span> <span class="vl">${state.drift} %</span></div>
            <div class="calc-line result-line"><span class="v">u₄</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.u4,4)} %</span></div>
            <div class="calc-line note">Rectangular · v = ∞</div>
        `));

        container.appendChild(createStepEl('5', 'Temperature Coefficient', 'Type B · Rect', `
            <div class="formula-box">u₅ = (a × β) / √3</div>
            <div class="calc-line"><span class="v">β</span> <span class="eq">=</span> <span class="vl">${state.tempCoeff} %/°C</span>, <span class="v">a</span> <span class="eq">=</span> <span class="vl">${state.deltaTemp} °C</span></div>
            <div class="calc-line"><span class="v">a×β</span> <span class="eq">=</span> <span class="vl">${fmtNum(state.deltaTemp*state.tempCoeff,4)}</span></div>
            <div class="calc-line result-line"><span class="v">u₅</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.u5,6)} %</span></div>
            <div class="calc-line note">Rectangular · v = ∞</div>
        `));

        container.appendChild(createStepEl('c', 'Combined Uncertainty', 'Uc', `
            <div class="formula-box">Uc = √(u₁² + u₂² + u₃² + u₄² + u₅²)</div>
            <div class="calc-line"><span class="v">u₁²</span> <span class="eq">=</span> <span class="vl">${calc.u1Sq.toExponential(4)}</span></div>
            <div class="calc-line"><span class="v">u₂²</span> <span class="eq">=</span> <span class="vl">${calc.u2Sq.toExponential(4)}</span></div>
            <div class="calc-line"><span class="v">u₃²</span> <span class="eq">=</span> <span class="vl">${calc.u3Sq.toExponential(6)}</span></div>
            <div class="calc-line"><span class="v">u₄²</span> <span class="eq">=</span> <span class="vl">${calc.u4Sq.toExponential(4)}</span></div>
            <div class="calc-line"><span class="v">u₅²</span> <span class="eq">=</span> <span class="vl">${calc.u5Sq.toExponential(6)}</span></div>
            <div class="calc-divider"></div>
            <div class="calc-line"><span class="v">Σ uᵢ²</span> <span class="eq">=</span> <span class="vl">${calc.sumSqU.toExponential(6)}</span></div>
            <div class="calc-line result-line"><span class="v">Uc</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.uc,5)} %</span></div>
            <div class="sub-step-label" style="margin-top:10px;">Effective Degrees of Freedom</div>
            <div class="formula-box" style="margin-top:4px;">v<sub>eff</sub> = Uc⁴ / Σ(uᵢ⁴/vᵢ)</div>
            <div class="calc-line"><span class="v">Σ(uᵢ⁴/v)</span> <span class="eq">=</span> <span class="vl">${calc.sumCu4v.toExponential(6)}</span></div>
            <div class="calc-line result-line"><span class="v">v<sub>eff</sub></span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.veff,1)}</span></div>
        `));

        container.appendChild(createStepEl('e', 'Expanded Uncertainty', '95% Confidence', `
            <div class="formula-box">Ue = Uc × k &nbsp; (ROUNDUP 3 d.p.)</div>
            <div class="calc-line"><span class="v">k (95%CL, v=${fmtNum(calc.veff,1)})</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.kFactor,2)}</span></div>
            <div class="calc-line"><span class="v">Ue</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.uc,5)}</span> <span class="op">×</span> <span class="vl">${fmtNum(calc.kFactor,2)}</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.ue,5)} %</span></div>
            <div class="calc-line"><span class="v">ROUNDUP</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.ueRounded,4)} %</span></div>
            <div class="calc-divider"></div>
            <div class="sub-step-label">MU Cap to CMC Validation</div>
            <div class="formula-box" style="margin-top:4px;">Final MU = IF(MU < CMC, CMC, MU)</div>
            <div class="calc-line"><span class="v">CMC</span> <span class="eq">=</span> <span class="vl">${state.refStdCMC} %</span></div>
            <div class="calc-line"><span class="v">MU</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.ueRounded,4)} %</span></div>
            <div class="calc-line result-line" style="border-left-color:${calc.muCapped?'var(--warning)':'var(--success)'};">
                <span class="v">Final MU</span> <span class="eq">=</span> <span class="vl">${fmtNum(calc.finalMU,4)} %</span>
                <span style="font-size:0.85em;display:block;margin-top:2px;font-weight:600;color:${calc.muCapped?'var(--warning)':'var(--success)'};">
                    ${calc.muCapped ? '⚠️ MU < CMC → DICAP KEPADA CMC' : '✅ MU ≥ CMC → MU DILAPORKAN'}
                </span>
            </div>
        `));
    }

    function renderSummary(calc, state) {
        const container = document.getElementById(`summary-${activeTabIndex}`);
        if (!container) return;
        container.innerHTML = `
            ${calc.muCapped ? `
            <div class="cmc-banner capped">
                ⚠️ <span class="big">MU Dicap ke CMC</span>
                MU hasil kiraan (${fmtNum(calc.ueRounded,4)}%) &lt; CMC Makmal (${state.refStdCMC}%)
                <br>Final MU dilaporkan sebagai CMC = <strong>${fmtNum(calc.finalMU,4)}%</strong>
            </div>` : `
            <div class="cmc-banner pass">
                ✅ <span class="big">MU ≥ CMC</span>
                MU hasil kiraan (${fmtNum(calc.ueRounded,4)}%) ≥ CMC Makmal (${state.refStdCMC}%)
                <br>MU dilaporkan tanpa cap
            </div>`}
            <div class="summary-card">
                <h3>📊 MU Budget Summary — ${state.tabName}</h3>
                <table class="summary-table">
                    <tr><td class="s-label">U1 · Repeatability</td><td class="s-val">${fmtNum(calc.u1,5)} %</td></tr>
                    <tr><td class="s-label">U2 · Ref. Std. Cal Cert</td><td class="s-val">${fmtNum(calc.u2,5)} %</td></tr>
                    <tr><td class="s-label">U3 · Resolution Ref. Std</td><td class="s-val">${fmtNum(calc.u3,6)} %</td></tr>
                    <tr><td class="s-label">U4 · Error Drift</td><td class="s-val">${fmtNum(calc.u4,4)} %</td></tr>
                    <tr><td class="s-label">U5 · Temperature Coefficient</td><td class="s-val">${fmtNum(calc.u5,6)} %</td></tr>
                    <tr class="s-sep"><td class="s-label"><strong>Uc · Combined</strong></td><td class="s-val"><strong>${fmtNum(calc.uc,5)} %</strong></td></tr>
                    <tr><td class="s-label">v<sub>eff</sub></td><td class="s-val">${fmtNum(calc.veff,1)}</td></tr>
                    <tr><td class="s-label">k (95% CL)</td><td class="s-val">${fmtNum(calc.kFactor,2)}</td></tr>
                    <tr class="s-sep"><td class="s-label"><strong>CMC Makmal</strong></td><td class="s-val"><strong>${state.refStdCMC} %</strong></td></tr>
                    <tr><td class="s-label"><strong>MU Final</strong></td><td class="s-val" style="font-size:1.1em;color:${calc.muCapped?'var(--warning)':'var(--success)'};"><strong>${fmtNum(calc.finalMU,4)} %</strong></td></tr>
                </table>
                <div class="final-result ${calc.muCapped?'capped':''}">
                    ${calc.muCapped ? '⚠️ Final Reported Uncertainty (Capped to CMC)' : '✅ Final Reported Uncertainty'}
                    <span class="big">U = ± ${fmtNum(calc.finalMU,4)} %</span>
                </div>
            </div>
        `;
    }

    function renderExcelCompare(calc, state) {
        const container = document.getElementById(`excel-${activeTabIndex}`);
        if (!container) return;
        const match = Math.abs(calc.finalMU - state.excelMU) < 0.001;
        container.innerHTML = `
            <h3>📋 Perbandingan dengan Excel</h3>
            <div class="compare-grid">
                <div class="c-head">Item</div><div class="c-head">Nilai</div>
                <div>App Final MU</div><div>${fmtNum(calc.finalMU,4)} %</div>
                <div>Excel Final MU</div><div>${state.excelMU.toFixed(3)} %</div>
                <div>Status</div><div class="${match?'c-match':'c-diff'}">${match?'✅ SAMA':'⚠️ BERBEZA'}</div>
            </div>
        `;
    }

    // ==================== RENDER TAB CONTENT ====================
    function renderTabContent() {
        tabContent.innerHTML = tabs.map((t, i) => `
            <div class="tab-panel ${i === activeTabIndex ? 'active' : ''}" id="tab-panel-${i}">
                <div class="main-content">
                    <div class="param-card" id="job-card-${i}"></div>
                    <div class="param-card" id="meter-card-${i}"></div>
                    <div class="input-card" id="input-card-${i}"></div>
                    <div id="steps-${i}"></div>
                    <div id="summary-${i}"></div>
                    <div class="excel-compare" id="excel-${i}"></div>
                    <div class="footer">
                        <p id="footer-info-${i}"></p>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderAllTabContent() {
        renderTabContent();
        tabs.forEach((t, i) => {
            if (i === activeTabIndex || document.getElementById(`tab-panel-${i}`)) {
                renderSingleTab(i);
            }
        });
        bindAllEvents();
    }

    function renderSingleTab(index) {
        const state = tabs[index];
        const validation = validateInputs(state);

        // Job Card
        const jobCard = document.getElementById(`job-card-${index}`);
        if (!jobCard) return;
        jobCard.innerHTML = `
            <h3>📁 Job Info — ${state.tabName}</h3>
            <div class="job-grid">
                <div class="jg-group"><span class="jg-label">Job Ref</span><input type="text" id="job-ref-${index}" value="${state.jobRef}"></div>
                <div class="jg-group"><span class="jg-label">Customer</span><input type="text" id="job-customer-${index}" value="${state.customer}"></div>
                <div class="jg-group"><span class="jg-label">Meter Mfr</span><input type="text" id="job-mfr-${index}" value="${state.meterMfr}"></div>
                <div class="jg-group"><span class="jg-label">Meter Model</span><input type="text" id="job-model-${index}" value="${state.meterModel}"></div>
                <div class="jg-group"><span class="jg-label">Meter S/N</span><input type="text" id="job-sn-${index}" value="${state.meterSN}"></div>
                <div class="jg-group"><span class="jg-label">Ref Std Desc</span><input type="text" id="job-refstd-desc-${index}" value="${state.refStdDesc}"></div>
                <div class="jg-group"><span class="jg-label">Ref Std S/N</span><input type="text" id="job-refstd-sn-${index}" value="${state.refStdSN}"></div>
                <div class="jg-group"><span class="jg-label">Traceability</span><input type="text" id="job-trace-${index}" value="${state.refStdTrace}"></div>
                <div class="jg-group jg-cmc-group">
                    <span class="jg-cmc-label">⭐ CMC Makmal (%)</span>
                    <input type="number" id="job-cmc-${index}" value="${state.refStdCMC}" step="0.001">
                </div>
                <div class="jg-group"><span class="jg-label">Drift Ref Std (%)</span><input type="number" id="job-drift-${index}" value="${state.refStdDrift}" step="0.001"></div>
                <div class="jg-group"><span class="jg-label">Excel MU (banding)</span><input type="number" id="job-excelMU-${index}" value="${state.excelMU}" step="0.001"></div>
            </div>
        `;

        // Meter Card
        const meterCard = document.getElementById(`meter-card-${index}`);
        meterCard.innerHTML = `
            <h3>📋 Meter Info & Test Parameter</h3>
            <div class="meter-info-grid">
                <div class="mi-group"><span class="mi-label">Rated Current (A)</span><input type="number" id="mi-ratedCurrent-${index}" value="${state.ratedCurrent}" step="0.1" min="0.1"></div>
                <div class="mi-group"><span class="mi-label">Rated Voltage (V)</span><input type="number" id="mi-ratedVoltage-${index}" value="${state.ratedVoltage}" step="1" min="1"></div>
                <div class="mi-group"><span class="mi-label">Class</span><input type="number" id="mi-class-${index}" value="${state.meterClass}" step="0.1" min="0.1"></div>
                <div class="mi-group"><span class="mi-label">Meter Type</span><select id="mi-type-${index}"><option value="DIRECT" ${state.meterType==='DIRECT'?'selected':''}>DIRECT</option><option value="CT" ${state.meterType==='CT'?'selected':''}>CT</option><option value="CT-VT" ${state.meterType==='CT-VT'?'selected':''}>CT-VT</option></select></div>
            </div>
            <div class="test-selector">
                <div class="ts-group"><span class="ts-label">Energy</span><select id="ts-energy-${index}"><option value="+P" ${state.energyType==='+P'?'selected':''}>+P</option><option value="-P" ${state.energyType==='-P'?'selected':''}>-P</option><option value="+Q" ${state.energyType==='+Q'?'selected':''}>+Q</option><option value="-Q" ${state.energyType==='-Q'?'selected':''}>-Q</option></select></div>
                <div class="ts-group"><span class="ts-label">Phase</span><select id="ts-phase-${index}"><option value="ABC" ${state.testPhase==='ABC'?'selected':''}>ABC</option><option value="A" ${state.testPhase==='A'?'selected':''}>A</option><option value="B" ${state.testPhase==='B'?'selected':''}>B</option><option value="C" ${state.testPhase==='C'?'selected':''}>C</option></select></div>
                <div class="ts-group"><span class="ts-label">PF</span><select id="ts-pf-${index}"><option value="1" ${state.testPF==='1'?'selected':''}>1.0</option><option value="0.5L" ${state.testPF==='0.5L'?'selected':''}>0.5L</option><option value="0.866L" ${state.testPF==='0.866L'?'selected':''}>0.866L</option></select></div>
                <div class="ts-group"><span class="ts-label">Test Voltage (V)</span><input type="number" id="ts-voltage-${index}" value="${state.testVoltage}" step="1" min="1"></div>
                <div class="ts-group"><span class="ts-label">Test Current (A)</span><input type="number" id="ts-current-${index}" value="${state.testCurrent}" step="0.01" min="0"></div>
            </div>
            <div class="test-point-display">
                <strong>Test:</strong> <span id="tp-energy-${index}">${getEnergyLabel(state.energyType)}</span> ·
                <span id="tp-phase-${index}">${getPhaseLabel(state.testPhase)}</span> ·
                <span id="tp-pf-${index}">${getPFLabel(state.testPF)}</span> ·
                <span id="tp-voltage-${index}">${state.testVoltage}V</span> ·
                <span id="tp-current-${index}">${state.testCurrent}A</span>
            </div>
            <div class="readings-display" id="readings-display-${index}"><strong>${state.readings.length} Readings:</strong> ${state.readings.join(' &nbsp; ')}</div>
        `;

        // Input Card
        const inputCard = document.getElementById(`input-card-${index}`);
        inputCard.innerHTML = `
            <h3>📝 Readings</h3>
            <div class="input-grid">
                <div class="input-group">
                    <label for="in-readings-${index}">Readings (comma-separated)</label>
                    <input type="text" id="in-readings-${index}" value="${state.readings.join(',')}">
                    <span class="validation-msg" id="msg-readings-${index}">Sila masukkan sekurang-kurangnya 2 readings</span>
                </div>
            </div>
            <h3 style="margin-top:10px;">⚙️ Uncertainty Components</h3>
            <div class="input-grid">
                <div class="input-group"><label for="in-muCert-${index}">MU Cal Cert (%)</label><input type="number" id="in-muCert-${index}" value="${state.muCert}" step="0.001" min="0.001"><span class="validation-msg" id="msg-muCert-${index}">Mesti > 0</span></div>
                <div class="input-group"><label for="in-kCert-${index}">k from Cert</label><input type="number" id="in-kCert-${index}" value="${state.kCert}" step="0.01" min="1"><span class="validation-msg" id="msg-kCert-${index}">Mesti ≥ 1</span></div>
                <div class="input-group"><label for="in-resolution-${index}">Resolution Ref Std (%)</label><input type="number" id="in-resolution-${index}" value="${state.resolution}" step="0.0001" min="0"><span class="validation-msg" id="msg-resolution-${index}">Tak boleh negatif</span></div>
                <div class="input-group"><label for="in-drift-${index}">Drift (%)</label><input type="number" id="in-drift-${index}" value="${state.drift}" step="0.001" min="0"><span class="validation-msg" id="msg-drift-${index}">Tak boleh negatif</span></div>
                <div class="input-group"><label for="in-tempCoeff-${index}">Temp Coeff (%/°C)</label><input type="number" id="in-tempCoeff-${index}" value="${state.tempCoeff}" step="0.001" min="0"><span class="validation-msg" id="msg-tempCoeff-${index}">Tak boleh negatif</span></div>
                <div class="input-group"><label for="in-deltaTemp-${index}">Δ Temperature (°C)</label><input type="number" id="in-deltaTemp-${index}" value="${state.deltaTemp}" step="0.5" min="0"><span class="validation-msg" id="msg-deltaTemp-${index}">Tak boleh negatif</span></div>
            </div>
            <div class="btn-row">
                <button class="btn btn-primary" id="btn-calc-${index}">🔄 Kira Semula</button>
            </div>
        `;

        // Footer
        const footerInfo = document.getElementById(`footer-info-${index}`);
        if (footerInfo) {
            footerInfo.innerHTML = `${state.jobRef || '—'} · ${state.customer || '—'} · ${state.meterMfr || '—'} ${state.meterModel || '—'} · S/N: ${state.meterSN || '—'} | Ref Std: ${state.refStdDesc || '—'} · S/N: ${state.refStdSN || '—'}`;
        }

        if (validation.valid && state.readings.length >= 2) {
            const calc = calculate(state);
            renderSteps(calc, state);
            renderSummary(calc, state);
            renderExcelCompare(calc, state);
        } else {
            const stepsContainer = document.getElementById(`steps-${index}`);
            if (stepsContainer) stepsContainer.innerHTML = validation.errors.length > 0
                ? `<div class="cmc-banner capped">⚠️ ${validation.errors.join('<br>')}</div>`
                : `<p style="text-align:center;color:var(--text-light);padding:20px;">Sila masukkan readings dan klik Kira Semula</p>`;
            const summaryContainer = document.getElementById(`summary-${index}`);
            if (summaryContainer) summaryContainer.innerHTML = '';
            const excelContainer = document.getElementById(`excel-${index}`);
            if (excelContainer) excelContainer.innerHTML = '';
        }
    }

    // ==================== BIND ALL EVENTS ====================
    function bindAllEvents() {
        tabs.forEach((t, i) => {
            // Job info fields
            bindInputEvent(`job-ref-${i}`, 'jobRef', i);
            bindInputEvent(`job-customer-${i}`, 'customer', i);
            bindInputEvent(`job-mfr-${i}`, 'meterMfr', i);
            bindInputEvent(`job-model-${i}`, 'meterModel', i);
            bindInputEvent(`job-sn-${i}`, 'meterSN', i);
            bindInputEvent(`job-refstd-desc-${i}`, 'refStdDesc', i);
            bindInputEvent(`job-refstd-sn-${i}`, 'refStdSN', i);
            bindInputEvent(`job-trace-${i}`, 'refStdTrace', i);
            bindNumberEvent(`job-cmc-${i}`, 'refStdCMC', i);
            bindNumberEvent(`job-drift-${i}`, 'refStdDrift', i, true);
            bindNumberEvent(`job-excelMU-${i}`, 'excelMU', i);

            // Meter info
            bindNumberEvent(`mi-ratedCurrent-${i}`, 'ratedCurrent', i);
            bindNumberEvent(`mi-ratedVoltage-${i}`, 'ratedVoltage', i);
            bindNumberEvent(`mi-class-${i}`, 'meterClass', i);
            bindSelectEvent(`mi-type-${i}`, 'meterType', i);

            // Test selector
            bindSelectEvent(`ts-energy-${i}`, 'energyType', i);
            bindSelectEvent(`ts-phase-${i}`, 'testPhase', i);
            bindSelectEvent(`ts-pf-${i}`, 'testPF', i);
            bindNumberEvent(`ts-voltage-${i}`, 'testVoltage', i);
            bindNumberEvent(`ts-current-${i}`, 'testCurrent', i);

            // Calc button
            const calcBtn = document.getElementById(`btn-calc-${i}`);
            if (calcBtn) {
                calcBtn.addEventListener('click', () => {
                    collectReadings(i);
                    collectNumbers(i);
                    saveTabsToStorage();
                    renderSingleTab(i);
                });
            }
        });
    }

    function bindInputEvent(elId, key, tabIndex) {
        const el = document.getElementById(elId);
        if (!el) return;
        el.addEventListener('input', function() {
            tabs[tabIndex][key] = this.value;
            saveTabsToStorage();
            updateFooter(tabIndex);
            updateTestDisplay(tabIndex);
        });
    }

    function bindNumberEvent(elId, key, tabIndex, isDrift) {
        const el = document.getElementById(elId);
        if (!el) return;
        el.addEventListener('input', function() {
            const val = parseFloat(this.value) || 0;
            tabs[tabIndex][key] = val;
            if (isDrift) {
                tabs[tabIndex].drift = val;
                const driftInput = document.getElementById(`in-drift-${tabIndex}`);
                if (driftInput) driftInput.value = val;
            }
            if (key === 'refStdCMC') {
                tabs[tabIndex].muCert = val;
                const muCertInput = document.getElementById(`in-muCert-${tabIndex}`);
                if (muCertInput) muCertInput.value = val;
            }
            saveTabsToStorage();
            updateTestDisplay(tabIndex);
        });
    }

    function bindSelectEvent(elId, key, tabIndex) {
        const el = document.getElementById(elId);
        if (!el) return;
        el.addEventListener('change', function() {
            tabs[tabIndex][key] = this.value;
            saveTabsToStorage();
            updateTestDisplay(tabIndex);
        });
    }

    function collectReadings(tabIndex) {
        const input = document.getElementById(`in-readings-${tabIndex}`);
        if (!input) return;
        const arr = input.value.trim().split(/[\s,]+/).map(s => parseFloat(s.trim())).filter(x => !isNaN(x));
        if (arr.length >= 2) {
            tabs[tabIndex].readings = arr;
            input.classList.remove('invalid');
            const msg = document.getElementById(`msg-readings-${tabIndex}`);
            if (msg) msg.classList.remove('show');
        } else {
            input.classList.add('invalid');
            const msg = document.getElementById(`msg-readings-${tabIndex}`);
            if (msg) msg.classList.add('show');
        }
    }

    function collectNumbers(tabIndex) {
        const fields = [
            ['in-muCert', 'muCert', 'msg-muCert'],
            ['in-kCert', 'kCert', 'msg-kCert'],
            ['in-resolution', 'resolution', 'msg-resolution'],
            ['in-drift', 'drift', 'msg-drift'],
            ['in-tempCoeff', 'tempCoeff', 'msg-tempCoeff'],
            ['in-deltaTemp', 'deltaTemp', 'msg-deltaTemp'],
        ];
        fields.forEach(([elId, key, msgId]) => {
            const el = document.getElementById(`${elId}-${tabIndex}`);
            if (!el) return;
            const val = parseFloat(el.value);
            const msg = document.getElementById(`${msgId}-${tabIndex}`);
            if (isNaN(val) || val < 0 || (key === 'kCert' && val < 1)) {
                el.classList.add('invalid');
                if (msg) msg.classList.add('show');
            } else {
                el.classList.remove('invalid');
                if (msg) msg.classList.remove('show');
                tabs[tabIndex][key] = val;
            }
        });
    }

    function updateFooter(tabIndex) {
        const footerInfo = document.getElementById(`footer-info-${tabIndex}`);
        if (!footerInfo) return;
        const s = tabs[tabIndex];
        footerInfo.innerHTML = `${s.jobRef || '—'} · ${s.customer || '—'} · ${s.meterMfr || '—'} ${s.meterModel || '—'} · S/N: ${s.meterSN || '—'} | Ref Std: ${s.refStdDesc || '—'} · S/N: ${s.refStdSN || '—'}`;
    }

    function updateTestDisplay(tabIndex) {
        const s = tabs[tabIndex];
        ['energy', 'phase', 'pf', 'voltage', 'current'].forEach(field => {
            const el = document.getElementById(`tp-${field}-${tabIndex}`);
            if (!el) return;
            if (field === 'energy') el.textContent = getEnergyLabel(s.energyType);
            if (field === 'phase') el.textContent = getPhaseLabel(s.testPhase);
            if (field === 'pf') el.textContent = getPFLabel(s.testPF);
            if (field === 'voltage') el.textContent = s.testVoltage + 'V';
            if (field === 'current') el.textContent = s.testCurrent + 'A';
        });
        const rd = document.getElementById(`readings-display-${tabIndex}`);
        if (rd) rd.innerHTML = `<strong>${s.readings.length} Readings:</strong> ${s.readings.join(' &nbsp; ')}`;
    }

    // ==================== SAVE / LOAD ====================
    function saveProject(name) {
        const projectName = name || prompt('Nama project:', tabs[activeTabIndex]?.tabName || 'Project');
        if (!projectName) return;
        const project = {
            name: projectName,
            date: new Date().toISOString(),
            tabs: JSON.parse(JSON.stringify(tabs)),
            activeTabIndex,
            tabCounter,
        };
        const saved = JSON.parse(localStorage.getItem('mu-projects') || '[]');
        saved.push(project);
        localStorage.setItem('mu-projects', JSON.stringify(saved));
        renderSavedProjects();
        alert('✅ Project disimpan!');
    }

    function loadProject(index) {
        const saved = JSON.parse(localStorage.getItem('mu-projects') || '[]');
        if (index < 0 || index >= saved.length) return;
        const project = saved[index];
        tabs = project.tabs.map(t => Object.assign(createDefaultState(t.tabName), t));
        activeTabIndex = project.activeTabIndex || 0;
        tabCounter = project.tabCounter || tabs.length;
        saveTabsToStorage();
        closeLoadModal();
        renderAll();
    }

    function deleteProject(index) {
        if (!confirm('Padam project ini?')) return;
        const saved = JSON.parse(localStorage.getItem('mu-projects') || '[]');
        saved.splice(index, 1);
        localStorage.setItem('mu-projects', JSON.stringify(saved));
        renderSavedProjects();
    }

    function renderSavedProjects() {
        const saved = JSON.parse(localStorage.getItem('mu-projects') || '[]');
        if (saved.length === 0) {
            savedProjectsList.innerHTML = '<p class="empty-msg">Tiada project tersimpan</p>';
        } else {
            savedProjectsList.innerHTML = saved.map((p, i) => `
                <div class="saved-project-item" onclick="window._loadProject(${i})">
                    <div class="sp-name">${p.name}</div>
                    <div class="sp-date">${new Date(p.date).toLocaleDateString('ms-MY')} · ${p.tabs.length} parameter</div>
                    <button class="sp-delete" onclick="event.stopPropagation();window._deleteProject(${i})">🗑️</button>
                </div>
            `).join('');
        }
    }

    function renderLoadModal() {
        const saved = JSON.parse(localStorage.getItem('mu-projects') || '[]');
        if (saved.length === 0) {
            loadProjectList.innerHTML = '<p style="color:var(--text-light);text-align:center;padding:20px;">Tiada project tersimpan</p>';
        } else {
            loadProjectList.innerHTML = saved.map((p, i) => `
                <div class="modal-item" onclick="window._loadProject(${i})">
                    <strong>${p.name}</strong><br>
                    <small>${new Date(p.date).toLocaleDateString('ms-MY')} · ${p.tabs.length} parameter</small>
                </div>
            `).join('');
        }
    }

    function closeLoadModal() {
        loadModal.classList.remove('show');
    }

    // Expose to global
    window._loadProject = loadProject;
    window._deleteProject = deleteProject;

    // ==================== SIDE MENU ====================
    function openSideMenu() {
        renderSavedProjects();
        sideMenu.classList.add('open');
        overlay.classList.add('show');
    }
    function closeSideMenu() {
        sideMenu.classList.remove('open');
        overlay.classList.remove('show');
    }

    // ==================== RENDER ALL ====================
    function renderAll() {
        renderTabBar();
        renderAllTabContent();
    }

    // ==================== INIT ====================
    function init() {
        loadTabsFromStorage();
        applyDarkMode();
        renderAll();
    }

    // ==================== EVENT LISTENERS ====================
    document.getElementById('btn-darkmode').addEventListener('click', () => {
        darkMode = !darkMode;
        applyDarkMode();
    });

    document.getElementById('btn-add-tab').addEventListener('click', addTab);

    document.getElementById('btn-save').addEventListener('click', () => saveProject());

    document.getElementById('btn-load').addEventListener('click', () => {
        renderLoadModal();
        loadModal.classList.add('show');
    });

    document.getElementById('btn-load-cancel').addEventListener('click', closeLoadModal);

    document.getElementById('btn-menu').addEventListener('click', openSideMenu);
    document.getElementById('btn-menu-close').addEventListener('click', closeSideMenu);
    overlay.addEventListener('click', () => {
        closeSideMenu();
        closeLoadModal();
    });

    loadModal.addEventListener('click', function(e) {
        if (e.target === loadModal) closeLoadModal();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
