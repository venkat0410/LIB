/* ============================================================
   BGA Land Pattern Calculator — bga_land_calculator.js
   IPC-7351B Compliant Ball Grid Array Land Pattern Calculator
   Integrated into PCB CalcPro — fully offline, zero external dependencies.
   ============================================================ */

"use strict";

(function initBgaLandCalculatorModule() {
  const STORAGE_KEY = "pcb-bga-saved-specs";

  const MM_TO_MIL = 1000 / 25.4; // 39.37007874...
  const MIL_TO_MM = 25.4 / 1000; // 0.0254

  // State
  let activeUnit = "mm";
  let savedSpecsList = [];
  let bgaInitialized = false;

  // CAD Layer Visibility
  const cadLayers = {
    land: true,
    ball: true,
    mask: true,
    dim: true,
    array: true,
    route: true,
  };

  // IPC-7351B Table 8-1 Standard Ball Sizes and Nominal Land Diameters (in mm)
  // [nominal_ball_dia, levelA_land, levelB_land, levelC_land]
  const IPC_STANDARD_TABLE = [
    { ball: 0.75, A: 0.65, B: 0.60, C: 0.55 },
    { ball: 0.60, A: 0.55, B: 0.50, C: 0.45 },
    { ball: 0.50, A: 0.45, B: 0.40, C: 0.35 },
    { ball: 0.45, A: 0.40, B: 0.35, C: 0.30 },
    { ball: 0.40, A: 0.35, B: 0.30, C: 0.25 },
    { ball: 0.35, A: 0.30, B: 0.28, C: 0.25 },
    { ball: 0.30, A: 0.28, B: 0.25, C: 0.20 },
    { ball: 0.25, A: 0.23, B: 0.20, C: 0.17 },
    { ball: 0.20, A: 0.19, B: 0.17, C: 0.15 },
    { ball: 0.15, A: 0.15, B: 0.13, C: 0.12 },
  ];

  // Standard Presets (dimensions in mm)
  const BGA_PRESETS = {
    "bga-127": {
      name: "BGA-256 (1.27mm)",
      pitchX: 1.27,
      pitchY: 1.27,
      ballNom: 0.75,
      ballMin: 0.65,
      ballMax: 0.85,
      fabTol: 0.05,
      asmTol: 0.05,
      maskClr: 0.05,
      traceW: 0.127,
      traceS: 0.127,
    },
    "bga-100": {
      name: "BGA-484 (1.00mm)",
      pitchX: 1.00,
      pitchY: 1.00,
      ballNom: 0.60,
      ballMin: 0.50,
      ballMax: 0.70,
      fabTol: 0.05,
      asmTol: 0.05,
      maskClr: 0.05,
      traceW: 0.10,
      traceS: 0.10,
    },
    "fbga-080": {
      name: "FBGA-256 (0.80mm)",
      pitchX: 0.80,
      pitchY: 0.80,
      ballNom: 0.50,
      ballMin: 0.45,
      ballMax: 0.55,
      fabTol: 0.05,
      asmTol: 0.05,
      maskClr: 0.05,
      traceW: 0.10,
      traceS: 0.10,
    },
    "fbga-080-ddr": {
      name: "FBGA-96 DDR3/4 (0.80mm)",
      pitchX: 0.80,
      pitchY: 0.80,
      ballNom: 0.45,
      ballMin: 0.40,
      ballMax: 0.50,
      fabTol: 0.05,
      asmTol: 0.05,
      maskClr: 0.05,
      traceW: 0.10,
      traceS: 0.10,
    },
    "fbga-065": {
      name: "FBGA-144 (0.65mm)",
      pitchX: 0.65,
      pitchY: 0.65,
      ballNom: 0.40,
      ballMin: 0.35,
      ballMax: 0.45,
      fabTol: 0.05,
      asmTol: 0.05,
      maskClr: 0.05,
      traceW: 0.09,
      traceS: 0.09,
    },
    "fbga-050": {
      name: "FBGA-100 (0.50mm)",
      pitchX: 0.50,
      pitchY: 0.50,
      ballNom: 0.30,
      ballMin: 0.25,
      ballMax: 0.35,
      fabTol: 0.04,
      asmTol: 0.04,
      maskClr: 0.04,
      traceW: 0.075,
      traceS: 0.075,
    },
    "wlcsp-040": {
      name: "WLCSP-49 (0.40mm)",
      pitchX: 0.40,
      pitchY: 0.40,
      ballNom: 0.25,
      ballMin: 0.21,
      ballMax: 0.29,
      fabTol: 0.035,
      asmTol: 0.035,
      maskClr: 0.035,
      traceW: 0.065,
      traceS: 0.065,
    },
    "wlcsp-035": {
      name: "WLCSP-36 (0.35mm)",
      pitchX: 0.35,
      pitchY: 0.35,
      ballNom: 0.20,
      ballMin: 0.17,
      ballMax: 0.23,
      fabTol: 0.03,
      asmTol: 0.03,
      maskClr: 0.03,
      traceW: 0.05,
      traceS: 0.05,
    },
  };

  // Cached calculated results for export/save/print
  let currentResults = null;

  // DOM Elements
  const el = {
    unitMmBtn: () => document.getElementById("bga-unit-mm"),
    unitMilBtn: () => document.getElementById("bga-unit-mil"),
    presetSelect: () => document.getElementById("bga-preset-select"),
    pkgName: () => document.getElementById("bga-pkg-name"),
    pitchX: () => document.getElementById("bga-pitch-x"),
    pitchY: () => document.getElementById("bga-pitch-y"),
    squarePitch: () => document.getElementById("bga-square-pitch"),
    ballNom: () => document.getElementById("bga-ball-nom"),
    ballMin: () => document.getElementById("bga-ball-min"),
    ballMax: () => document.getElementById("bga-ball-max"),
    ballTol: () => document.getElementById("bga-ball-tol"),
    densityLevel: () => document.getElementById("bga-density-level"),
    padType: () => document.getElementById("bga-pad-type"),
    ballType: () => document.getElementById("bga-ball-type"),
    fabTol: () => document.getElementById("bga-fab-tol"),
    asmTol: () => document.getElementById("bga-asm-tol"),
    maskClr: () => document.getElementById("bga-mask-clr"),
    traceW: () => document.getElementById("bga-trace-w"),
    traceS: () => document.getElementById("bga-trace-s"),
    alertBox: () => document.getElementById("bga-alert-box"),
  };

  function bgaToast(message, type = "info") {
    if (typeof showToast === "function") {
      showToast(message, type === "success" ? "success" : type === "error" ? "error" : "info");
      return;
    }
    console.log(`[BGA Calc] ${message}`);
  }

  function loadSavedSpecs() {
    try {
      savedSpecsList = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      savedSpecsList = [];
    }
  }

  function persistSavedSpecs() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSpecsList));
  }

  // -------------------------------------------------------------
  // Unit Conversion
  // -------------------------------------------------------------
  function setUnit(unit) {
    if (unit === activeUnit) return;
    const oldUnit = activeUnit;
    activeUnit = unit;

    const factor = unit === "mm" ? MIL_TO_MM : MM_TO_MIL;
    const prec = unit === "mm" ? 3 : 1;

    // Update buttons
    el.unitMmBtn()?.classList.toggle("active", unit === "mm");
    el.unitMilBtn()?.classList.toggle("active", unit === "mil");

    // Update all unit labels in UI
    document.querySelectorAll(".bga-unit-lbl").forEach((lbl) => {
      lbl.textContent = unit;
    });

    // Convert input field values without data loss
    const inputIds = [
      "bga-pitch-x",
      "bga-pitch-y",
      "bga-ball-nom",
      "bga-ball-min",
      "bga-ball-max",
      "bga-ball-tol",
      "bga-fab-tol",
      "bga-asm-tol",
      "bga-mask-clr",
      "bga-trace-w",
      "bga-trace-s",
    ];

    inputIds.forEach((id) => {
      const input = document.getElementById(id);
      if (input && input.value !== "") {
        const val = parseFloat(input.value);
        if (!isNaN(val) && val >= 0) {
          input.value = (val * factor).toFixed(prec).replace(/\.?0+$/, "");
        }
      }
    });

    calculateBga();
  }

  // -------------------------------------------------------------
  // Preset Management
  // -------------------------------------------------------------
  function applyPreset(presetKey) {
    if (!presetKey || !BGA_PRESETS[presetKey]) return;
    const p = BGA_PRESETS[presetKey];
    const factor = activeUnit === "mm" ? 1 : MM_TO_MIL;
    const prec = activeUnit === "mm" ? 3 : 1;

    const pkgName = el.pkgName();
    if (pkgName) pkgName.value = p.name;

    const pitchX = el.pitchX();
    const pitchY = el.pitchY();
    const ballNom = el.ballNom();
    const ballMin = el.ballMin();
    const ballMax = el.ballMax();
    const ballTol = el.ballTol();
    const fabTol = el.fabTol();
    const asmTol = el.asmTol();
    const maskClr = el.maskClr();
    const traceW = el.traceW();
    const traceS = el.traceS();

    if (pitchX) pitchX.value = (p.pitchX * factor).toFixed(prec).replace(/\.?0+$/, "");
    if (pitchY) pitchY.value = (p.pitchY * factor).toFixed(prec).replace(/\.?0+$/, "");
    if (ballNom) ballNom.value = (p.ballNom * factor).toFixed(prec).replace(/\.?0+$/, "");
    if (ballMin) ballMin.value = (p.ballMin * factor).toFixed(prec).replace(/\.?0+$/, "");
    if (ballMax) ballMax.value = (p.ballMax * factor).toFixed(prec).replace(/\.?0+$/, "");
    if (ballTol) ballTol.value = ((p.ballNom - p.ballMin) * factor).toFixed(prec).replace(/\.?0+$/, "");
    if (fabTol) fabTol.value = (p.fabTol * factor).toFixed(prec).replace(/\.?0+$/, "");
    if (asmTol) asmTol.value = (p.asmTol * factor).toFixed(prec).replace(/\.?0+$/, "");
    if (maskClr) maskClr.value = (p.maskClr * factor).toFixed(prec).replace(/\.?0+$/, "");
    if (traceW) traceW.value = (p.traceW * factor).toFixed(prec).replace(/\.?0+$/, "");
    if (traceS) traceS.value = (p.traceS * factor).toFixed(prec).replace(/\.?0+$/, "");

    calculateBga();
  }

  // -------------------------------------------------------------
  // IPC-7351B Sizing Algorithm
  // -------------------------------------------------------------
  function getIpcTableMatch(ballMm) {
    for (const item of IPC_STANDARD_TABLE) {
      if (Math.abs(item.ball - ballMm) <= 0.015) {
        return item;
      }
    }
    return null;
  }

  function calculateTargetLandMm(ballNomMm, densityLevel, isCollapsible) {
    if (!isCollapsible) {
      // Non-collapsible BGA (Ceramic CBGA / Column)
      if (densityLevel === "A") return ballNomMm * 1.05;
      if (densityLevel === "B") return ballNomMm * 1.00;
      return ballNomMm * 0.95;
    }

    // Collapsible BGA (Plastic PBGA / FBGA / CSP with SAC305 or SnPb)
    const tableMatch = getIpcTableMatch(ballNomMm);
    if (tableMatch) {
      if (densityLevel === "A") return tableMatch.A;
      if (densityLevel === "B") return tableMatch.B;
      return tableMatch.C;
    }

    // Continuous proportional IPC-7351B reduction formula for custom ball diameter
    // Level A: ~12-15% reduction (Most material / maximum land)
    // Level B: ~20% reduction (Nominal material / median land)
    // Level C: ~25% reduction (Least material / minimum land)
    let reductionPct = 0.20;
    if (densityLevel === "A") reductionPct = 0.15;
    if (densityLevel === "C") reductionPct = 0.25;

    // Fine pitch reduction scaling to maintain minimum solderable pad size
    if (ballNomMm <= 0.25) {
      reductionPct = densityLevel === "A" ? 0.08 : densityLevel === "B" ? 0.20 : 0.30;
    }

    return ballNomMm * (1 - reductionPct);
  }

  // -------------------------------------------------------------
  // Main Calculation Routine
  // -------------------------------------------------------------
  function calculateBga() {
    const pkgName = el.pkgName()?.value.trim() || "BGA Component";
    const pitchX = parseFloat(el.pitchX()?.value) || 0;
    const pitchY = parseFloat(el.pitchY()?.value) || 0;
    const ballNom = parseFloat(el.ballNom()?.value) || 0;
    let ballMin = parseFloat(el.ballMin()?.value);
    let ballMax = parseFloat(el.ballMax()?.value);
    const ballTol = parseFloat(el.ballTol()?.value);

    const densityLevel = el.densityLevel()?.value || "B";
    const padType = el.padType()?.value || "NSMD";
    const ballType = el.ballType()?.value || "collapsible";
    const isCollapsible = ballType === "collapsible";

    const fabTol = parseFloat(el.fabTol()?.value) || 0;
    const asmTol = parseFloat(el.asmTol()?.value) || 0;
    const maskClr = parseFloat(el.maskClr()?.value) || 0;
    const traceW = parseFloat(el.traceW()?.value) || 0;
    const traceS = parseFloat(el.traceS()?.value) || 0;

    // Unit conversion to MM for standard calculation
    const toMm = activeUnit === "mil" ? MIL_TO_MM : 1;
    const fromMm = activeUnit === "mil" ? MM_TO_MIL : 1;
    const prec = activeUnit === "mil" ? 1 : 3;

    // Fill missing ball min/max from tolerance or nominal
    if (isNaN(ballMin) || ballMin <= 0) {
      ballMin = !isNaN(ballTol) && ballTol > 0 ? ballNom - ballTol : ballNom * 0.9;
      if (el.ballMin()) el.ballMin().value = ballMin.toFixed(prec);
    }
    if (isNaN(ballMax) || ballMax <= 0) {
      ballMax = !isNaN(ballTol) && ballTol > 0 ? ballNom + ballTol : ballNom * 1.1;
      if (el.ballMax()) el.ballMax().value = ballMax.toFixed(prec);
    }

    // Input Validation & Safety DRC
    const alertBox = el.alertBox();
    const warnings = [];
    let isError = false;

    if (pitchX <= 0 || pitchY <= 0) {
      warnings.push("Pitch in both X and Y must be strictly greater than zero.");
      isError = true;
    }
    if (ballNom <= 0) {
      warnings.push("Nominal ball diameter must be strictly greater than zero.");
      isError = true;
    }
    if (ballMin > ballMax) {
      warnings.push(`Minimum ball diameter (${ballMin}) cannot exceed maximum ball diameter (${ballMax}).`);
      isError = true;
    }
    if (ballNom < ballMin || ballNom > ballMax) {
      warnings.push(`Nominal ball diameter (${ballNom}) must be within the range [${ballMin}, ${ballMax}].`);
      isError = true;
    }

    const minPitch = Math.min(pitchX, pitchY);
    if (ballNom >= minPitch && minPitch > 0) {
      warnings.push(`Critical: Nominal ball diameter (${ballNom} ${activeUnit}) equals or exceeds pitch (${minPitch} ${activeUnit}). Solder balls will touch and short!`);
      isError = true;
    }

    if (isError) {
      if (alertBox) {
        alertBox.className = "bga-alert danger";
        alertBox.innerHTML = `
          <div class="bga-alert-icon">⚠️</div>
          <div>
            <strong>Input Geometry Validation Error:</strong><br/>
            ${warnings.join("<br/>")}
          </div>
        `;
      }
      resetResultDisplays();
      currentResults = null;
      return;
    }

    // Physical dimensions in MM
    const pitchXMm = pitchX * toMm;
    const pitchYMm = pitchY * toMm;
    const ballNomMm = ballNom * toMm;
    const ballMinMm = ballMin * toMm;
    const ballMaxMm = ballMax * toMm;
    const fabTolMm = fabTol * toMm;
    const asmTolMm = asmTol * toMm;
    const maskClrMm = maskClr * toMm;
    const traceWMm = traceW * toMm;
    const traceSMm = traceS * toMm;
    const minPitchMm = Math.min(pitchXMm, pitchYMm);

    // 1. Calculate Target PCB Land Diameter in mm
    const landTargetMm = calculateTargetLandMm(ballNomMm, densityLevel, isCollapsible);

    // Sizing tolerance boundaries
    const landMmcMm = landTargetMm + fabTolMm; // Maximum Material Condition (MMC)
    const landLmcMm = landTargetMm - fabTolMm; // Least Material Condition (LMC)

    // RMS Statistical Tolerance Stackup
    const ballTolRangeMm = ballMaxMm - ballMinMm;
    const fabTolRangeMm = 2 * fabTolMm;
    const asmTolRangeMm = 2 * asmTolMm;
    const rmsTolMm = Math.sqrt(
      Math.pow(ballTolRangeMm, 2) + Math.pow(fabTolRangeMm, 2) + Math.pow(asmTolRangeMm, 2)
    );

    // 2. Pad Definition: NSMD vs SMD
    let copperPadMm = 0;
    let maskOpeningMm = 0;
    let maskDamMm = 0;
    let copperClearanceX_Mm = 0;
    let copperClearanceY_Mm = 0;
    let copperClearanceDiag_Mm = 0;

    if (padType === "NSMD") {
      // Non-Solder Mask Defined (Copper defines land)
      copperPadMm = landTargetMm;
      maskOpeningMm = landTargetMm + 2 * maskClrMm;
      maskDamMm = minPitchMm - maskOpeningMm;
      copperClearanceX_Mm = pitchXMm - copperPadMm;
      copperClearanceY_Mm = pitchYMm - copperPadMm;
      copperClearanceDiag_Mm = Math.sqrt(Math.pow(pitchXMm, 2) + Math.pow(pitchYMm, 2)) - copperPadMm;
    } else {
      // Solder Mask Defined (Mask opening defines land)
      maskOpeningMm = landTargetMm;
      copperPadMm = landTargetMm + 2 * maskClrMm; // Copper pad is expanded under mask
      maskDamMm = minPitchMm - copperPadMm;
      copperClearanceX_Mm = pitchXMm - copperPadMm;
      copperClearanceY_Mm = pitchYMm - copperPadMm;
      copperClearanceDiag_Mm = Math.sqrt(Math.pow(pitchXMm, 2) + Math.pow(pitchYMm, 2)) - copperPadMm;
    }

    // 3. Routing Channel Clearance & Escape Traces
    const channelWidthMm = minPitchMm - copperPadMm;
    const spaceFor1TraceMm = 2 * traceSMm + traceWMm;
    const spaceFor2TracesMm = 3 * traceSMm + 2 * traceWMm;

    let escapeTraces = 0;
    let routabilityText = "0 Traces (Via-in-Pad Required)";
    let routabilityClass = "amber";

    if (channelWidthMm >= spaceFor2TracesMm && spaceFor2TracesMm > 0) {
      escapeTraces = 2;
      routabilityText = "2 Traces Escapable";
      routabilityClass = "green";
    } else if (channelWidthMm >= spaceFor1TraceMm && spaceFor1TraceMm > 0) {
      escapeTraces = 1;
      routabilityText = "1 Trace Escapable";
      routabilityClass = "cyan";
    }

    // Engineering Safety DRC Checks
    const drcWarnings = [];
    if (copperPadMm >= minPitchMm) {
      drcWarnings.push(`Critical: Copper land diameter (${(copperPadMm * fromMm).toFixed(prec)} ${activeUnit}) exceeds pitch (${minPitch.toFixed(prec)} ${activeUnit}). Pads overlap!`);
    } else if (Math.min(copperClearanceX_Mm, copperClearanceY_Mm) < 0.10) {
      drcWarnings.push(`High Bridging Risk: Copper pad-to-pad clearance (${(Math.min(copperClearanceX_Mm, copperClearanceY_Mm) * fromMm).toFixed(prec)} ${activeUnit}) is under standard PCB manufacturing threshold (0.10mm / 4mil).`);
    }

    if (maskDamMm < 0.075) {
      drcWarnings.push(`Solder Mask Dam Warning: Mask dam width (${(maskDamMm * fromMm).toFixed(prec)} ${activeUnit}) is below typical LPI photoimageable mask threshold (0.075mm / 3mil). Consider SMD pads or reducing mask clearance.`);
    }

    const landToBallRatio = (landTargetMm / ballNomMm) * 100;
    if (isCollapsible && (landToBallRatio < 65 || landToBallRatio > 105)) {
      drcWarnings.push(`IPC Design Caution: Land-to-ball ratio is ${landToBallRatio.toFixed(1)}%. IPC-7351B recommends 70% to 90% for collapsible balls to guarantee proper standoff height.`);
    }

    if (alertBox) {
      if (drcWarnings.length > 0) {
        alertBox.className = "bga-alert warning";
        alertBox.innerHTML = `
          <div class="bga-alert-icon">⚠️</div>
          <div>
            <strong>Design Rule & DRC Alerts:</strong><br/>
            ${drcWarnings.join("<br/>")}
          </div>
        `;
      } else {
        alertBox.className = "bga-alert success";
        alertBox.innerHTML = `
          <div class="bga-alert-icon">✅</div>
          <div>
            <strong>IPC-7351B Verification Passed:</strong> Recommended land dimensions meet IPC-7351B standards for Level ${densityLevel} design with acceptable solder mask dam and routing clearances.
          </div>
        `;
      }
    }

    // Convert metrics back to active display unit
    const landTargetDisp = landTargetMm * fromMm;
    const landMmcDisp = landMmcMm * fromMm;
    const landLmcDisp = landLmcMm * fromMm;
    const maskOpeningDisp = maskOpeningMm * fromMm;
    const maskDamDisp = maskDamMm * fromMm;
    const copperClearanceDisp = Math.min(copperClearanceX_Mm, copperClearanceY_Mm) * fromMm;
    const channelWidthDisp = channelWidthMm * fromMm;

    // Cache results
    currentResults = {
      pkgName,
      unit: activeUnit,
      pitchX,
      pitchY,
      pitchXMm,
      pitchYMm,
      ballNom,
      ballNomMm,
      ballMin,
      ballMax,
      densityLevel,
      padType,
      ballType,
      isCollapsible,
      fabTol,
      asmTol,
      maskClr,
      traceW,
      traceS,
      landTarget: landTargetDisp,
      landTargetMm,
      landMmc: landMmcDisp,
      landLmc: landLmcDisp,
      maskOpening: maskOpeningDisp,
      maskOpeningMm,
      copperPad: copperPadMm * fromMm,
      copperPadMm,
      maskDam: maskDamDisp,
      copperClearance: copperClearanceDisp,
      channelWidth: channelWidthDisp,
      escapeTraces,
      routabilityText,
      rmsTolMm,
      landToBallRatio,
    };

    // Update Result Metrics Cards
    setMetric("bga-metric-land", `${landTargetDisp.toFixed(prec)} ${activeUnit}`);
    setMetric("bga-metric-mmc", `${landMmcDisp.toFixed(prec)} ${activeUnit}`);
    setMetric("bga-metric-lmc", `${landLmcDisp.toFixed(prec)} ${activeUnit}`);
    setMetric("bga-metric-mask", `${maskOpeningDisp.toFixed(prec)} ${activeUnit}`);
    setMetric("bga-metric-dam", `${maskDamDisp.toFixed(prec)} ${activeUnit}`);
    setMetric("bga-metric-clearance", `${copperClearanceDisp.toFixed(prec)} ${activeUnit}`);
    setMetric("bga-metric-channel", `${channelWidthDisp.toFixed(prec)} ${activeUnit}`);
    setMetric("bga-metric-routability", routabilityText);

    // Update Formula Step-by-Step Breakdown
    updateCalculationBreakdown(currentResults, prec);

    // Update Reference Matrix Active Row Highlight
    highlightReferenceTableRow(ballNomMm);

    // Render CAD SVG Visualizer
    renderCadSvg(currentResults);
  }

  function setMetric(id, text) {
    const elNode = document.getElementById(id);
    if (elNode) elNode.textContent = text;
  }

  function resetResultDisplays() {
    [
      "bga-metric-land",
      "bga-metric-mmc",
      "bga-metric-lmc",
      "bga-metric-mask",
      "bga-metric-dam",
      "bga-metric-clearance",
      "bga-metric-channel",
      "bga-metric-routability",
    ].forEach((id) => setMetric(id, "—"));

    const cadSvg = document.getElementById("bga-cad-svg");
    if (cadSvg) {
      cadSvg.innerHTML = `
        <defs>
          <pattern id="bga-cad-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(148,163,184,0.15)" stroke-width="0.5"/>
          </pattern>
        </defs>
        <rect width="440" height="440" fill="url(#bga-cad-grid)" rx="8"/>
        <text x="220" y="225" text-anchor="middle" fill="#64748b" font-size="12" font-family="sans-serif">Enter valid parameters and click Calculate</text>
      `;
    }
  }

  function highlightReferenceTableRow(ballNomMm) {
    document.querySelectorAll(".bga-ref-table tbody tr").forEach((row) => {
      const rowBall = parseFloat(row.dataset.ball);
      const isMatch = Math.abs(rowBall - ballNomMm) <= 0.015;
      row.classList.toggle("active-row", isMatch);
    });
  }

  // -------------------------------------------------------------
  // Step-by-Step Calculation Breakdown
  // -------------------------------------------------------------
  function updateCalculationBreakdown(r, prec) {
    const u = r.unit;
    const reductionPct = ((1 - r.landTargetMm / r.ballNomMm) * 100).toFixed(1);

    // Step 1: Land Sizing Formula Box
    const s1Eq = document.getElementById("bga-step1-eq");
    const s1Val = document.getElementById("bga-step1-val");
    if (s1Eq && s1Val) {
      if (r.isCollapsible) {
        s1Eq.textContent = `D_land = b_nom × (1 - Reduction)`;
        s1Val.textContent = `D_land = ${r.ballNom.toFixed(prec)} × (1 - ${reductionPct}%) = ${r.landTarget.toFixed(prec)} ${u}`;
      } else {
        s1Eq.textContent = `D_land = b_nom × Factor (Non-collapsible CBGA)`;
        s1Val.textContent = `D_land = ${r.ballNom.toFixed(prec)} × ${r.densityLevel === "A" ? "1.05" : r.densityLevel === "B" ? "1.00" : "0.95"} = ${r.landTarget.toFixed(prec)} ${u}`;
      }
    }

    // Step 2: Tolerance Stackup Box
    const s2Eq = document.getElementById("bga-step2-eq");
    const s2Val = document.getElementById("bga-step2-val");
    if (s2Eq && s2Val) {
      s2Eq.textContent = `D_max (MMC) = D_land + F_tol | D_min (LMC) = D_land - F_tol`;
      s2Val.textContent = `MMC: ${r.landMmc.toFixed(prec)} ${u} | LMC: ${r.landLmc.toFixed(prec)} ${u} | RMS Variation: ${(r.rmsTolMm * (u === "mil" ? MM_TO_MIL : 1)).toFixed(prec)} ${u}`;
    }

    // Step 3: Solder Mask Box
    const s3Eq = document.getElementById("bga-step3-eq");
    const s3Val = document.getElementById("bga-step3-val");
    if (s3Eq && s3Val) {
      if (r.padType === "NSMD") {
        s3Eq.textContent = `D_mask = D_land + 2×M_clr | W_dam = Pitch - D_mask`;
        s3Val.textContent = `D_mask = ${r.maskOpening.toFixed(prec)} ${u} | Mask Dam = ${r.maskDam.toFixed(prec)} ${u} (NSMD)`;
      } else {
        s3Eq.textContent = `D_mask = D_land | D_copper = D_land + 2×M_clr`;
        s3Val.textContent = `D_mask = ${r.maskOpening.toFixed(prec)} ${u} | Copper Pad = ${r.copperPad.toFixed(prec)} ${u} (SMD)`;
      }
    }

    // Step 4: Routing Channel Box
    const s4Eq = document.getElementById("bga-step4-eq");
    const s4Val = document.getElementById("bga-step4-val");
    if (s4Eq && s4Val) {
      s4Eq.textContent = `W_ch = Pitch - Pad_dia | Traces = ⌊(W_ch - S_tr) / (W_tr + S_tr)⌋`;
      s4Val.textContent = `Channel: ${r.channelWidth.toFixed(prec)} ${u} | Clearance: ${r.copperClearance.toFixed(prec)} ${u} ➔ ${r.routabilityText}`;
    }
  }

  // -------------------------------------------------------------
  // CAD Visualizer SVG Renderer
  // -------------------------------------------------------------
  function renderCadSvg(r) {
    const svg = document.getElementById("bga-cad-svg");
    if (!svg || !r) return;

    const viewBoxSize = 440;
    const center = viewBoxSize / 2; // (220, 220)

    // Calculate display scale (fit a 3x3 array comfortably inside 440px)
    // Desired grid center-to-center distance in SVG pixels: ~120px
    const maxPitchMm = Math.max(r.pitchXMm, r.pitchYMm);
    const pxPerMm = 120 / maxPitchMm;

    const pitchX_Svg = r.pitchXMm * pxPerMm;
    const pitchY_Svg = r.pitchYMm * pxPerMm;

    const copperRadiusSvg = (r.copperPadMm / 2) * pxPerMm;
    const ballRadiusSvg = (r.ballNomMm / 2) * pxPerMm;
    const maskRadiusSvg = (r.maskOpeningMm / 2) * pxPerMm;
    const traceWSvg = Math.max(1.2, r.traceW * (r.unit === "mil" ? MIL_TO_MM : 1) * pxPerMm);

    // 3x3 array coordinates relative to center
    const padPositions = [
      { row: -1, col: -1, name: "A1" },
      { row: -1, col: 0, name: "A2" },
      { row: -1, col: 1, name: "A3" },
      { row: 0, col: -1, name: "B1" },
      { row: 0, col: 0, name: "B2 (Center)", isCenter: true },
      { row: 0, col: 1, name: "B3" },
      { row: 1, col: -1, name: "C1" },
      { row: 1, col: 0, name: "C2" },
      { row: 1, col: 1, name: "C3" },
    ];

    let svgContent = `
      <defs>
        <pattern id="bga-cad-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(148,163,184,0.12)" stroke-width="0.5"/>
        </pattern>
        <marker id="bga-arrow-dim" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#fb7185" />
        </marker>
      </defs>
      <rect width="${viewBoxSize}" height="${viewBoxSize}" fill="url(#bga-cad-grid)" rx="8"/>
    `;

    // 1. Array Matrix Pads
    svgContent += `<g id="bga-svg-array-group">`;
    padPositions.forEach((pos) => {
      if (!cadLayers.array && !pos.isCenter) return;

      const px = center + pos.col * pitchX_Svg;
      const py = center + pos.row * pitchY_Svg;

      // Solder Mask Layer
      if (cadLayers.mask) {
        svgContent += `
          <circle cx="${px}" cy="${py}" r="${maskRadiusSvg}"
            fill="${r.padType === "NSMD" ? "rgba(192, 132, 252, 0.08)" : "none"}"
            stroke="#c084fc" stroke-width="1.8" stroke-dasharray="${r.padType === "SMD" ? "none" : "3,2"}"
            class="bga-svg-mask" opacity="0.9" />
        `;
      }

      // Copper Land Layer
      if (cadLayers.land) {
        svgContent += `
          <circle cx="${px}" cy="${py}" r="${copperRadiusSvg}"
            fill="${pos.isCenter ? "rgba(52, 211, 153, 0.35)" : "rgba(52, 211, 153, 0.18)"}"
            stroke="#34d399" stroke-width="${pos.isCenter ? "2.5" : "1.8"}"
            class="bga-svg-land" />
        `;
      }

      // Solder Ball Layer (Dashed circle representing ball boundary)
      if (cadLayers.ball) {
        svgContent += `
          <circle cx="${px}" cy="${py}" r="${ballRadiusSvg}"
            fill="none" stroke="#22d3ee" stroke-width="1.5" stroke-dasharray="4,3"
            class="bga-svg-ball" opacity="0.85" />
          <circle cx="${px}" cy="${py}" r="2" fill="${pos.isCenter ? "#fbbf24" : "#22d3ee"}" />
        `;
      }

      // Pad text label
      svgContent += `
        <text x="${px}" y="${py - copperRadiusSvg - 6}" text-anchor="middle"
          fill="${pos.isCenter ? "#34d399" : "#64748b"}" font-size="9" font-family="'JetBrains Mono', monospace" font-weight="${pos.isCenter ? "700" : "500"}">
          ${pos.name}
        </text>
      `;
    });
    svgContent += `</g>`;

    // 2. Escape Routing Traces
    if (cadLayers.route && cadLayers.array && r.escapeTraces > 0) {
      svgContent += `<g id="bga-svg-route-group">`;
      // Escape channel between center (col 0) and East (col 1)
      const xMid = center + pitchX_Svg / 2;
      const yStart = center - pitchY_Svg * 0.8;
      const yEnd = center + pitchY_Svg * 0.8;

      if (r.escapeTraces === 1) {
        svgContent += `
          <line x1="${xMid}" y1="${yStart}" x2="${xMid}" y2="${yEnd}"
            stroke="#fbbf24" stroke-width="${traceWSvg}" stroke-linecap="round" />
          <text x="${xMid + 8}" y="${center}" fill="#fbbf24" font-size="8.5" font-family="'JetBrains Mono', monospace">1 Trace</text>
        `;
      } else if (r.escapeTraces >= 2) {
        const offset = Math.max(3, traceWSvg * 1.5);
        svgContent += `
          <line x1="${xMid - offset}" y1="${yStart}" x2="${xMid - offset}" y2="${yEnd}"
            stroke="#34d399" stroke-width="${traceWSvg}" stroke-linecap="round" />
          <line x1="${xMid + offset}" y1="${yStart}" x2="${xMid + offset}" y2="${yEnd}"
            stroke="#34d399" stroke-width="${traceWSvg}" stroke-linecap="round" />
          <text x="${xMid + offset + 8}" y="${center}" fill="#34d399" font-size="8.5" font-family="'JetBrains Mono', monospace">2 Traces</text>
        `;
      }
      svgContent += `</g>`;
    }

    // 3. Dimension Annotations
    if (cadLayers.dim) {
      svgContent += `<g id="bga-svg-dim-group">`;

      // Pitch X Dimension Line (between Center and East pad B3)
      if (cadLayers.array) {
        const yDimX = center + pitchY_Svg / 2 + 25;
        svgContent += `
          <line x1="${center}" y1="${yDimX}" x2="${center + pitchX_Svg}" y2="${yDimX}"
            stroke="#fb7185" stroke-width="1.5" marker-start="url(#bga-arrow-dim)" marker-end="url(#bga-arrow-dim)" />
          <line x1="${center}" y1="${center + copperRadiusSvg + 4}" x2="${center}" y2="${yDimX + 6}"
            stroke="#fb7185" stroke-width="0.8" stroke-dasharray="2,2" />
          <line x1="${center + pitchX_Svg}" y1="${center + copperRadiusSvg + 4}" x2="${center + pitchX_Svg}" y2="${yDimX + 6}"
            stroke="#fb7185" stroke-width="0.8" stroke-dasharray="2,2" />
          <text x="${center + pitchX_Svg / 2}" y="${yDimX - 5}" text-anchor="middle"
            fill="#fb7185" font-size="9.5" font-family="'JetBrains Mono', monospace" font-weight="600">
            Px = ${r.pitchX} ${r.unit}
          </text>
        `;

        // Pitch Y Dimension Line (between Center and North pad A2)
        const xDimY = center - pitchX_Svg / 2 - 25;
        svgContent += `
          <line x1="${xDimY}" y1="${center - pitchY_Svg}" x2="${xDimY}" y2="${center}"
            stroke="#fb7185" stroke-width="1.5" marker-start="url(#bga-arrow-dim)" marker-end="url(#bga-arrow-dim)" />
          <line x1="${xDimY - 6}" y1="${center - pitchY_Svg}" x2="${center - copperRadiusSvg - 4}" y2="${center - pitchY_Svg}"
            stroke="#fb7185" stroke-width="0.8" stroke-dasharray="2,2" />
          <line x1="${xDimY - 6}" y1="${center}" x2="${center - copperRadiusSvg - 4}" y2="${center}"
            stroke="#fb7185" stroke-width="0.8" stroke-dasharray="2,2" />
          <text x="${xDimY - 8}" y="${center - pitchY_Svg / 2}" text-anchor="middle" transform="rotate(-90 ${xDimY - 8} ${center - pitchY_Svg / 2})"
            fill="#fb7185" font-size="9.5" font-family="'JetBrains Mono', monospace" font-weight="600">
            Py = ${r.pitchY} ${r.unit}
          </text>
        `;
      }

      // Land Diameter Callout on Center Pad
      const diaY = center - copperRadiusSvg - 18;
      svgContent += `
        <line x1="${center - copperRadiusSvg}" y1="${diaY}" x2="${center + copperRadiusSvg}" y2="${diaY}"
          stroke="#34d399" stroke-width="1.2" marker-start="url(#bga-arrow-dim)" marker-end="url(#bga-arrow-dim)" />
        <line x1="${center - copperRadiusSvg}" y1="${center - copperRadiusSvg}" x2="${center - copperRadiusSvg}" y2="${diaY - 4}"
          stroke="#34d399" stroke-width="0.7" stroke-dasharray="2,2" />
        <line x1="${center + copperRadiusSvg}" y1="${center - copperRadiusSvg}" x2="${center + copperRadiusSvg}" y2="${diaY - 4}"
          stroke="#34d399" stroke-width="0.7" stroke-dasharray="2,2" />
        <text x="${center}" y="${diaY - 4}" text-anchor="middle"
          fill="#34d399" font-size="9" font-family="'JetBrains Mono', monospace" font-weight="600">
          Ø ${r.landTarget.toFixed(r.unit === "mil" ? 1 : 3)} ${r.unit}
        </text>
      `;

      svgContent += `</g>`;
    }

    svg.innerHTML = svgContent;
  }

  // -------------------------------------------------------------
  // Specification Library (Save / Load / Delete / Export)
  // -------------------------------------------------------------
  function saveCurrentSpec() {
    if (!currentResults) {
      calculateBga();
    }
    if (!currentResults) {
      bgaToast("Cannot save: please resolve calculation errors.", "error");
      return;
    }

    const rec = {
      id: `BGA-${Date.now().toString().slice(-4)}`,
      pkgName: currentResults.pkgName,
      unit: currentResults.unit,
      pitch: `${currentResults.pitchX}x${currentResults.pitchY} ${currentResults.unit}`,
      ballDia: `${currentResults.ballNom} ${currentResults.unit}`,
      landDia: `${currentResults.landTarget.toFixed(currentResults.unit === "mil" ? 1 : 3)} ${currentResults.unit}`,
      maskOpening: `${currentResults.maskOpening.toFixed(currentResults.unit === "mil" ? 1 : 3)} ${currentResults.unit}`,
      density: `Level ${currentResults.densityLevel}`,
      padType: currentResults.padType,
      timestamp: new Date().toISOString(),
    };

    savedSpecsList.push(rec);
    persistSavedSpecs();
    updateSavedSpecsTable();

    // Log to global PCB CalcPro history
    if (typeof saveHistory === "function") {
      saveHistory({
        type: "BGA Land Pattern",
        data: rec,
      });
    }

    bgaToast(`BGA specification [${rec.id}] saved successfully.`, "success");
  }

  function deleteSpecRecord(id) {
    savedSpecsList = savedSpecsList.filter((r) => r.id !== id);
    persistSavedSpecs();
    updateSavedSpecsTable();
    bgaToast("Footprint spec removed.", "info");
  }

  function clearAllSpecs() {
    if (confirm("Are you sure you want to clear all saved BGA footprint specifications?")) {
      savedSpecsList = [];
      persistSavedSpecs();
      updateSavedSpecsTable();
      bgaToast("All BGA specs cleared.", "info");
    }
  }

  function updateSavedSpecsTable() {
    const tbody = document.getElementById("bga-saved-specs-body");
    if (!tbody) return;

    if (savedSpecsList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:32px;">No saved BGA footprint specifications yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = savedSpecsList
      .map(
        (rec) => `
        <tr>
          <td><strong>${rec.id}</strong></td>
          <td>${rec.pkgName}</td>
          <td>${rec.pitch}</td>
          <td>${rec.ballDia}</td>
          <td><span style="color:var(--accent-green);font-weight:600;">${rec.landDia}</span></td>
          <td>${rec.maskOpening}</td>
          <td>${rec.density}</td>
          <td><span class="bga-preset-badge">${rec.padType}</span></td>
          <td>
            <button type="button" class="btn btn-danger btn-icon btn-sm bga-delete-spec-btn" data-id="${rec.id}" title="Delete">✕</button>
          </td>
        </tr>`
      )
      .join("");

    tbody.querySelectorAll(".bga-delete-spec-btn").forEach((btn) => {
      btn.addEventListener("click", () => deleteSpecRecord(btn.dataset.id));
    });
  }

  function exportBgaCsv() {
    if (!currentResults) calculateBga();
    if (!currentResults) {
      bgaToast("No calculation results to export.", "error");
      return;
    }

    const r = currentResults;
    const prec = r.unit === "mil" ? 1 : 3;

    const rows = [
      ["Parameter", "Value", "Unit", "Standard Reference"],
      ["Component / Package Name", r.pkgName, "-", "-"],
      ["Applicable Standard", "IPC-7351B Section 8", "-", "IPC Generic Land Pattern Standard"],
      ["Measurement Unit", r.unit, "-", "-"],
      ["Ball Pitch X", r.pitchX, r.unit, "JEDEC Publication 95"],
      ["Ball Pitch Y", r.pitchY, r.unit, "JEDEC Publication 95"],
      ["Nominal Ball Diameter", r.ballNom, r.unit, "Manufacturer Datasheet"],
      ["Minimum Ball Diameter", r.ballMin, r.unit, "Manufacturer Datasheet"],
      ["Maximum Ball Diameter", r.ballMax, r.unit, "Manufacturer Datasheet"],
      ["Design Density Objective", `Level ${r.densityLevel}`, "-", "IPC-7351B Density Tier"],
      ["Pad Configuration", r.padType, "-", r.padType === "NSMD" ? "Non-Solder Mask Defined (Preferred)" : "Solder Mask Defined"],
      ["Solder Ball Collapsibility", r.isCollapsible ? "Collapsible (SAC305/SnPb)" : "Non-Collapsible (CBGA)", "-", "-"],
      ["Board Fabrication Allowance", r.fabTol, r.unit, "Standard Rigid PCB Fabrication (IPC Class 2)"],
      ["Assembly Placement Tolerance", r.asmTol, r.unit, "Pick & Place Machine Tolerance"],
      ["Solder Mask Clearance", r.maskClr, r.unit, "IPC-7351B Standard Clearance"],
      ["PCB Trace Width", r.traceW, r.unit, "Design Rule"],
      ["PCB Trace Spacing", r.traceS, r.unit, "Design Rule"],
      ["--- RESULTS ---", "---", "---", "---"],
      ["Recommended PCB Land Diameter", r.landTarget.toFixed(prec), r.unit, "IPC-7351B Recommended Nominal"],
      ["Max Land Diameter (MMC)", r.landMmc.toFixed(prec), r.unit, "Maximum Material Condition"],
      ["Min Land Diameter (LMC)", r.landLmc.toFixed(prec), r.unit, "Least Material Condition"],
      ["Solder Mask Opening Diameter", r.maskOpening.toFixed(prec), r.unit, "Exposure Aperture"],
      ["Solder Mask Dam Width", r.maskDam.toFixed(prec), r.unit, "Minimum Mask Web Between Openings"],
      ["Pad-to-Pad Clearance", r.copperClearance.toFixed(prec), r.unit, "Copper Spacing"],
      ["Routing Channel Width", r.channelWidth.toFixed(prec), r.unit, "Pitch - Copper Pad"],
      ["Escape Traces Supported", r.routabilityText, "-", "Channel routability analysis"],
      ["Land-to-Ball Ratio", `${r.landToBallRatio.toFixed(1)}%`, "-", "IPC-7351B recommended 70-90%"],
    ];

    const csvContent = rows.map((e) => e.map((x) => `"${x}"`).join(",")).join("\n");
    const filename = `bga_${r.pkgName.replace(/\s+/g, "_").toLowerCase()}_ipc7351b.csv`;

    if (typeof downloadFile === "function") {
      downloadFile(csvContent, filename, "text/csv");
      bgaToast("BGA engineering CSV report exported!", "success");
    } else {
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      bgaToast("BGA engineering CSV report exported!", "success");
    }
  }

  function copyBgaSummary() {
    if (!currentResults) calculateBga();
    if (!currentResults) {
      bgaToast("No valid calculation to copy.", "error");
      return;
    }

    const r = currentResults;
    const prec = r.unit === "mil" ? 1 : 3;

    const summary = [
      `=== BGA Land Pattern Engineering Summary (IPC-7351B) ===`,
      `Component: ${r.pkgName}`,
      `Design Level: Level ${r.densityLevel} | Pad Type: ${r.padType} | Alloy: ${r.ballType}`,
      `Pitch: Px = ${r.pitchX} ${r.unit}, Py = ${r.pitchY} ${r.unit}`,
      `Ball Diameter: ${r.ballNom} ${r.unit} (Range: [${r.ballMin}, ${r.ballMax}] ${r.unit})`,
      `-------------------------------------------------------`,
      `Recommended Land Diameter (Nominal): ${r.landTarget.toFixed(prec)} ${r.unit}`,
      `Land Diameter @ MMC (Max):           ${r.landMmc.toFixed(prec)} ${r.unit}`,
      `Land Diameter @ LMC (Min):           ${r.landLmc.toFixed(prec)} ${r.unit}`,
      `Solder Mask Opening Diameter:       ${r.maskOpening.toFixed(prec)} ${r.unit}`,
      `Solder Mask Dam Width:              ${r.maskDam.toFixed(prec)} ${r.unit}`,
      `Pad-to-Pad Copper Clearance:        ${r.copperClearance.toFixed(prec)} ${r.unit}`,
      `Routing Channel Width:              ${r.channelWidth.toFixed(prec)} ${r.unit}`,
      `Escape Capability:                  ${r.routabilityText}`,
      `=======================================================`,
    ].join("\n");

    if (navigator.clipboard) {
      navigator.clipboard.writeText(summary).then(() => {
        bgaToast("BGA calculation summary copied to clipboard!", "success");
      });
    } else {
      bgaToast("Clipboard API unavailable in this browser.", "error");
    }
  }

  function printBgaSpec() {
    if (!currentResults) calculateBga();
    if (!currentResults) return;

    const r = currentResults;
    const prec = r.unit === "mil" ? 1 : 3;

    document.getElementById("bga-print-pkg").textContent = r.pkgName;
    document.getElementById("bga-print-pitch").textContent = `${r.pitchX} × ${r.pitchY} ${r.unit}`;
    document.getElementById("bga-print-ball").textContent = `${r.ballNom} ${r.unit} [${r.ballMin} - ${r.ballMax}]`;
    document.getElementById("bga-print-density").textContent = `Level ${r.densityLevel}`;
    document.getElementById("bga-print-padtype").textContent = r.padType;
    document.getElementById("bga-print-balltype").textContent = r.ballType;
    document.getElementById("bga-print-fabtol").textContent = `±${r.fabTol} ${r.unit}`;
    document.getElementById("bga-print-asmtol").textContent = `±${r.asmTol} ${r.unit}`;

    document.getElementById("bga-print-land").textContent = `${r.landTarget.toFixed(prec)} ${r.unit}`;
    document.getElementById("bga-print-mmc").textContent = `${r.landMmc.toFixed(prec)} ${r.unit}`;
    document.getElementById("bga-print-lmc").textContent = `${r.landLmc.toFixed(prec)} ${r.unit}`;
    document.getElementById("bga-print-mask").textContent = `${r.maskOpening.toFixed(prec)} ${r.unit}`;
    document.getElementById("bga-print-dam").textContent = `${r.maskDam.toFixed(prec)} ${r.unit}`;
    document.getElementById("bga-print-clearance").textContent = `${r.copperClearance.toFixed(prec)} ${r.unit}`;
    document.getElementById("bga-print-channel").textContent = `${r.channelWidth.toFixed(prec)} ${r.unit}`;
    document.getElementById("bga-print-routability").textContent = r.routabilityText;

    document.body.classList.add("bga-printing");
    const cleanup = () => {
      document.body.classList.remove("bga-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }

  // -------------------------------------------------------------
  // Event Binding
  // -------------------------------------------------------------
  function bindEvents() {
    if (bgaInitialized) return;

    // Unit toggle buttons
    el.unitMmBtn()?.addEventListener("click", () => setUnit("mm"));
    el.unitMilBtn()?.addEventListener("click", () => setUnit("mil"));

    // Preset selection
    el.presetSelect()?.addEventListener("change", (e) => {
      applyPreset(e.target.value);
    });

    // Square pitch synchronizer
    el.pitchX()?.addEventListener("input", (e) => {
      if (el.squarePitch()?.checked && el.pitchY()) {
        el.pitchY().value = e.target.value;
      }
      calculateBga();
    });

    el.squarePitch()?.addEventListener("change", (e) => {
      if (e.target.checked && el.pitchX() && el.pitchY()) {
        el.pitchY().value = el.pitchX().value;
        calculateBga();
      }
    });

    // Ball tolerance link
    el.ballNom()?.addEventListener("input", (e) => {
      const nom = parseFloat(e.target.value);
      const tol = parseFloat(el.ballTol()?.value);
      if (!isNaN(nom) && !isNaN(tol) && tol > 0) {
        if (el.ballMin()) el.ballMin().value = (nom - tol).toFixed(activeUnit === "mil" ? 1 : 3);
        if (el.ballMax()) el.ballMax().value = (nom + tol).toFixed(activeUnit === "mil" ? 1 : 3);
      }
      calculateBga();
    });

    el.ballTol()?.addEventListener("input", (e) => {
      const tol = parseFloat(e.target.value);
      const nom = parseFloat(el.ballNom()?.value);
      if (!isNaN(nom) && !isNaN(tol) && tol >= 0) {
        if (el.ballMin()) el.ballMin().value = (nom - tol).toFixed(activeUnit === "mil" ? 1 : 3);
        if (el.ballMax()) el.ballMax().value = (nom + tol).toFixed(activeUnit === "mil" ? 1 : 3);
      }
      calculateBga();
    });

    // Input change re-evaluations
    [
      "bga-pkg-name",
      "bga-pitch-y",
      "bga-ball-min",
      "bga-ball-max",
      "bga-density-level",
      "bga-pad-type",
      "bga-ball-type",
      "bga-fab-tol",
      "bga-asm-tol",
      "bga-mask-clr",
      "bga-trace-w",
      "bga-trace-s",
    ].forEach((id) => {
      const node = document.getElementById(id);
      node?.addEventListener("input", calculateBga);
      node?.addEventListener("change", calculateBga);
    });

    // CAD Layer toggles
    [
      { id: "bga-layer-land", key: "land" },
      { id: "bga-layer-ball", key: "ball" },
      { id: "bga-layer-mask", key: "mask" },
      { id: "bga-layer-dim", key: "dim" },
      { id: "bga-layer-array", key: "array" },
      { id: "bga-layer-route", key: "route" },
    ].forEach((l) => {
      const box = document.getElementById(l.id);
      box?.addEventListener("change", () => {
        cadLayers[l.key] = box.checked;
        if (currentResults) renderCadSvg(currentResults);
      });
    });

    // Action buttons
    document.getElementById("bga-calc-btn")?.addEventListener("click", calculateBga);
    document.getElementById("bga-save-btn")?.addEventListener("click", saveCurrentSpec);
    document.getElementById("bga-export-csv-btn")?.addEventListener("click", exportBgaCsv);
    document.getElementById("bga-copy-summary-btn")?.addEventListener("click", copyBgaSummary);
    document.getElementById("bga-print-btn")?.addEventListener("click", printBgaSpec);
    document.getElementById("bga-clear-specs-btn")?.addEventListener("click", clearAllSpecs);

    // Reset button
    document.getElementById("bga-reset-btn")?.addEventListener("click", () => {
      if (el.presetSelect()) {
        el.presetSelect().value = "bga-100";
        applyPreset("bga-100");
        bgaToast("Parameters reset to default BGA-1.00mm preset.", "info");
      }
    });

    bgaInitialized = true;
  }

  // -------------------------------------------------------------
  // Public Lifecycle Hook
  // -------------------------------------------------------------
  window.initBgaLandCalculator = function initBgaLandCalculator() {
    bindEvents();
    loadSavedSpecs();
    updateSavedSpecsTable();
    calculateBga();
  };

  // Auto-init on page load if element is present in DOM
  if (document.getElementById("page-bgaland")) {
    window.initBgaLandCalculator();
  }
})();
