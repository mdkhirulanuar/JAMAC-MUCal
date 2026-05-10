```markdown
# ⚡ MU Validate Pro v3.3

**Measurement Uncertainty Validator for Energy Meter Calibration**  
*ISO/IEC 17025 · Single-Page Web Application*

---

## 📋 About

**MU Validate Pro** is a web-based validation tool for calculating **Measurement Uncertainty (MU)** according to **ISO/IEC 17025**. It replicates the manual step-by-step calculation used in Excel spreadsheets — showing every deviation, square, sum, and formula — making it fully auditable and transparent.

Built for calibration engineers and metrology labs who need to validate their Excel MU calculations quickly and accurately.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔢 **Full MU Calculation** | U1 (Repeatability) through Ue (Expanded Uncertainty) |
| 📝 **Step-by-Step Manual Display** | Every (xᵢ−x̄), (xᵢ−x̄)², sum, variance, and formula shown |
| ⭐ **MU Cap to CMC** | Automatically caps MU to laboratory CMC per ISO 17025 §7.6.3 |
| 📊 **Excel Comparison** | Side-by-side validation against your Excel spreadsheet |
| ➕ **Dynamic Readings** | Add/remove test readings as needed |
| 💾 **Save/Load Projects** | Save multiple projects to browser LocalStorage |
| 🖨️ **Print-Ready A4** | Auto-strips UI elements for clean printed reports |
| 🌙 **Dark/Light Theme** | Glassmorphism UI with toggle |
| ⚡ **Splash Screen** | Professional loading animation |
| 📱 **Fully Responsive** | Works on desktop, tablet, and mobile |
| 🔒 **Zero Dependencies** | Pure HTML/CSS/JS — no frameworks, no server needed |

---

## 🚀 Quick Start

1. **Download** or clone this repository
2. Open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari)
3. Start calculating — no server, no installation, no dependencies

```

mu-validate-pro/
├── index.html    ← Main HTML file
├── style.css     ← Glassmorphism dark/light theme
└── script.js     ← Full calculation engine + UI logic

```

---

## 📐 Calculation Methods

### Uncertainty Components

| Component | Type | Formula |
|-----------|------|---------|
| **U1** · Repeatability | Type A · Normal | `u₁ = σ / √n` |
| **U2** · Reference Standard Cal Cert | Type B · Normal | `u₂ = U_cert / k` |
| **U3** · Resolution (Ref Std) | Type B · Rectangular | `u₃ = (R/2) / √3` |
| **U4** · Error Drift | Type B · Rectangular | `u₄ = D / √3` |
| **U5** · Temperature Coefficient | Type B · Rectangular | `u₅ = (a × β) / √3` |

### Combined & Expanded

| Result | Formula |
|--------|---------|
| **Uc** · Combined Uncertainty | `Uc = √(u₁² + u₂² + u₃² + u₄² + u₅²)` |
| **v_eff** · Effective Degrees of Freedom | `v_eff = Uc⁴ / Σ(uᵢ⁴/vᵢ)` |
| **k** · Coverage Factor | Student's t-table (95% CL) |
| **Ue** · Expanded Uncertainty | `Ue = Uc × k` |
| **Final MU** | `MAX(Ue_rounded, CMC)` — ROUNDUP to 3 d.p. |

---

## 📊 Screenshots

| Dark Theme | Light Theme |
|------------|-------------|
| *Splash Screen → Job Info → Meter Info → Readings → Steps → Summary → Excel Compare* |

---

## 🔬 ISO 17025 Compliance

- ✅ **§7.2.1.1** — Method validation (verified against Excel)
- ✅ **§7.6.3** — MU cannot be reported less than CMC (auto-cap with visual flag)
- ✅ **§7.11.3** — Software validation (full step-by-step audit trail)
- ⚠️ Records (§7.5.1) — Save/Load via LocalStorage; for full compliance, export printed reports

---

## 📈 Version History

| Version | Date | Changes |
|---------|------|---------|
| **v0.1** | Apr 2026 | Concept — replace Excel manual MU calculation |
| **v0.5** | Apr 2026 | Single HTML prototype, basic 5-step display |
| **v1.0** | May 2026 | U1–Ue complete, 5 uncertainty components, ROUNDUP |
| **v1.5** | May 2026 | MU Cap to CMC, Excel comparison, input validation |
| **v2.0** | May 2026 | Save/Load projects, Print A4, Dark mode toggle |
| **v2.5** | May 2026 | Multiple parameter tabs, Glassmorphism UI, Splash screen |
| **v3.0** | May 2026 | English fully, Dynamic readings (add/remove), Language polish |
| **v3.1** | May 2026 | CMC moved to Readings & Components, Drift removed from Job Info |
| **v3.2** | May 2026 | Full manual steps (deviations & squares shown), Color contrast fix |
| **v3.3** | May 2026 | **Current stable** — All fixes applied, production-ready |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Markup** | HTML5 |
| **Styling** | CSS3 (Custom Properties, Glassmorphism, Flexbox/Grid) |
| **Logic** | Vanilla JavaScript (ES6+) |
| **Storage** | Browser LocalStorage |
| **Font** | Space Grotesk (Google Fonts) |
| **Dependencies** | **None** — Zero external libraries |

---

## 📄 License

MIT License — See [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**Mohd Khirul Anuar Bin Saadon**  
Lab Engineer · JAMAC METERING SDN BHD

---

## 🙏 Acknowledgments

- Calibration team for Excel reference and validation
- ISO/IEC 17025 documentation for methodology
- Space Grotesk font by Florian Karsten

---

*Built with ⚡ in Shah Alam, Malaysia*
```
