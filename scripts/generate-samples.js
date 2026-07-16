/**
 * Generates the three synthetic specimen bills bundled in public/samples/.
 * Utilities and consumers are fictional; layouts mimic real Indian bills so the
 * AI has genuine table structure, tariff slabs, and penalties to reason about.
 *
 * Run: node scripts/generate-samples.js
 */
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const OUT_DIR = path.join(__dirname, "..", "public", "samples");

/* ---------------- helpers ---------------- */

const inr = (n) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function rupeesInWords(n) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
    "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x) => (x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? " " + ones[x % 10] : ""}`);
  const three = (x) =>
    `${x >= 100 ? ones[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " " : "") : ""}${x % 100 ? two(x % 100) : ""}`;

  let x = Math.round(n);
  const parts = [];
  const crore = Math.floor(x / 1e7); x %= 1e7;
  const lakh = Math.floor(x / 1e5); x %= 1e5;
  const thousand = Math.floor(x / 1e3); x %= 1e3;
  if (crore) parts.push(`${two(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (x) parts.push(three(x));
  return `Rupees ${parts.join(" ") || "Zero"} Only`;
}

/* ---------------- generic bill renderer ---------------- */

const M = 42; // page margin
const W = 595.28 - M * 2; // usable width on A4

function drawBill(bill) {
  const doc = new PDFDocument({ size: "A4", margin: M, info: { Title: bill.docTitle } });
  const stream = fs.createWriteStream(path.join(OUT_DIR, bill.file));
  doc.pipe(stream);

  // faint diagonal SPECIMEN watermark
  doc.save();
  doc.rotate(-38, { origin: [297, 420] });
  doc.font("Helvetica-Bold").fontSize(72).fillColor("#000000").opacity(0.05);
  doc.text("SPECIMEN", 60, 380, { width: 480, align: "center" });
  doc.restore();
  doc.opacity(1);

  let y = M;

  // header band
  doc.rect(M, y, W, 64).fill(bill.brand);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(15);
  doc.text(bill.utility.name, M + 16, y + 12, { width: W - 32 });
  doc.font("Helvetica").fontSize(8.5);
  doc.text(bill.utility.sub, M + 16, y + 32, { width: W - 32 });
  doc.text(bill.utility.addressLine, M + 16, y + 44, { width: W - 32 });
  y += 72;

  doc.fillColor("#111111").font("Helvetica-Bold").fontSize(11);
  doc.text(bill.docTitle.toUpperCase(), M, y, { width: W, align: "center", characterSpacing: 1 });
  y += 22;

  // meta strip
  const metaW = W / bill.meta.length;
  doc.lineWidth(0.7).rect(M, y, W, 40).stroke("#999999");
  bill.meta.forEach(([k, v], i) => {
    const x = M + i * metaW;
    if (i) doc.moveTo(x, y).lineTo(x, y + 40).stroke("#999999");
    doc.font("Helvetica").fontSize(7.5).fillColor("#555555").text(k.toUpperCase(), x + 8, y + 6);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111").text(v, x + 8, y + 17, { width: metaW - 14 });
  });
  y += 50;

  // consumer + connection details, two columns
  const colW = W / 2 - 8;
  const leftH = 16 + 14 + bill.consumer.addressLines.length * 12 + 6;
  const rightH = 16 + bill.connection.length * 15 + 6;
  const blockH = Math.max(leftH, rightH, 96);

  doc.rect(M, y, colW, blockH).stroke("#999999");
  doc.font("Helvetica").fontSize(7.5).fillColor("#555555").text("BILLED TO", M + 10, y + 8);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111").text(bill.consumer.name, M + 10, y + 20);
  doc.font("Helvetica").fontSize(8.5).fillColor("#333333");
  let ay = y + 34;
  for (const line of bill.consumer.addressLines) {
    doc.text(line, M + 10, ay, { width: colW - 20 });
    ay += 12;
  }

  const rx = M + colW + 16;
  doc.rect(rx, y, colW, blockH).stroke("#999999");
  doc.font("Helvetica").fontSize(7.5).fillColor("#555555").text("CONNECTION DETAILS", rx + 10, y + 8);
  let ry = y + 21;
  doc.fontSize(8.5);
  for (const [k, v] of bill.connection) {
    doc.font("Helvetica").fillColor("#555555").text(k, rx + 10, ry, { width: 98 });
    doc.font("Helvetica-Bold").fillColor("#111111").text(v, rx + 112, ry, { width: colW - 122 });
    ry += 15;
  }
  y += blockH + 12;

  // meter reading table
  y = drawTable(doc, y, "METER READING DETAILS", bill.reading.headers, bill.reading.rows, bill.reading.widths);
  y += 12;

  // charges table
  doc.font("Helvetica").fontSize(7.5).fillColor("#555555").text("BILL DETAILS", M, y);
  y += 12;
  doc.lineWidth(0.7);
  const rowH = 16;
  doc.rect(M, y, W, rowH).fill("#efefef");
  doc.fillColor("#333333").font("Helvetica-Bold").fontSize(8.5);
  doc.text("Description", M + 10, y + 4);
  doc.text("Amount (Rs.)", M, y + 4, { width: W - 10, align: "right" });
  y += rowH;
  doc.font("Helvetica").fontSize(8.8);
  for (const [label, amount] of bill.charges) {
    doc.rect(M, y, W, rowH).stroke("#cccccc");
    doc.fillColor("#111111").text(label, M + 10, y + 4, { width: W - 130 });
    doc.text(inr(amount), M, y + 4, { width: W - 10, align: "right" });
    y += rowH;
  }

  // totals
  for (const [label, value, strong] of bill.totals) {
    doc.rect(M, y, W, rowH).stroke("#cccccc");
    if (strong) {
      doc.rect(M, y, W, rowH).fill("#f5efdd");
      doc.rect(M, y, W, rowH).stroke("#b09a55");
    }
    doc.font(strong ? "Helvetica-Bold" : "Helvetica").fontSize(strong ? 9.5 : 8.8).fillColor("#111111");
    doc.text(label, M + 10, y + 4, { width: W - 130 });
    doc.text(value, M, y + 4, { width: W - 10, align: "right" });
    y += rowH;
  }
  doc.font("Helvetica-Oblique").fontSize(8).fillColor("#333333");
  doc.text(bill.amountWords, M, y + 5);
  y += 22;

  // notes
  doc.font("Helvetica").fontSize(7.5).fillColor("#555555").text("IMPORTANT", M, y);
  y += 11;
  doc.fontSize(8).fillColor("#333333");
  for (const note of bill.notes) {
    doc.text(`• ${note}`, M, y, { width: W });
    y = doc.y + 3;
  }

  // footer disclaimer
  doc.font("Helvetica").fontSize(7).fillColor("#888888");
  doc.text(
    "SPECIMEN DOCUMENT — This is a synthetic bill generated for a product demo. The utility, consumer, and all values are fictional.",
    M,
    780,
    { width: W, align: "center" }
  );

  doc.end();
  return new Promise((resolve) => stream.on("finish", resolve));
}

function drawTable(doc, y, caption, headers, rows, widths) {
  doc.font("Helvetica").fontSize(7.5).fillColor("#555555").text(caption, M, y);
  y += 12;
  const rowH = 16;
  const xs = widths.reduce((acc, w) => [...acc, acc[acc.length - 1] + w], [M]);
  doc.rect(M, y, W, rowH).fill("#efefef");
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#333333");
  headers.forEach((h, i) => doc.text(h, xs[i] + 6, y + 4, { width: widths[i] - 12 }));
  y += rowH;
  doc.font("Helvetica").fontSize(8.5);
  for (const row of rows) {
    doc.rect(M, y, W, rowH).stroke("#cccccc");
    row.forEach((cell, i) =>
      doc.fillColor("#111111").text(String(cell), xs[i] + 6, y + 4, { width: widths[i] - 12 })
    );
    y += rowH;
  }
  return y;
}

/* ---------------- the three specimen bills ---------------- */

const residential = {
  file: "residential-bill.pdf",
  brand: "#1d4f2e",
  docTitle: "Electricity Bill — LT Residential",
  utility: {
    name: "Western Maharashtra Vidyut Vitaran Co. Ltd.",
    sub: "(A fictional distribution licensee — specimen bill for demo purposes)",
    addressLine: "Urja Bhavan, Senapati Marg, Pune 411005 | Consumer care: 1800-00-0000 | www.wmvv.example",
  },
  meta: [
    ["Bill No", "WMV/2026/07/48213967"],
    ["Bill Date", "03-Jul-2026"],
    ["Billing Period", "01-Jun-2026 to 30-Jun-2026"],
    ["Due Date", "21-Jul-2026"],
  ],
  consumer: {
    name: "Rohan Kulkarni",
    addressLines: [
      "Flat 402, Sahyadri Residency",
      "Baner Road, Baner",
      "Pune, Maharashtra 411045",
    ],
  },
  connection: [
    ["Consumer No", "170023814562"],
    ["Tariff Category", "LT-I (B) Residential"],
    ["Sanctioned Load", "3.0 kW"],
    ["Connection Type", "Single Phase"],
    ["Meter No", "MH-07-664208"],
    ["Bill Month", "JUN-2026"],
  ],
  reading: {
    headers: ["Meter No", "Previous Reading (05-Jun)", "Current Reading (05-Jul)", "Multiplier", "Units Billed (kWh)"],
    widths: [90, 130, 130, 70, 91],
    rows: [["MH-07-664208", "14,382", "14,627", "1", "245"]],
  },
  charges: [
    ["Energy Charge: 0–100 units @ Rs. 4.41/unit", 441.0],
    ["Energy Charge: 101–245 units (145 units) @ Rs. 9.64/unit", 1397.8],
    ["Fixed Charge (Single Phase)", 128.0],
    ["Wheeling Charge: 245 units @ Rs. 1.38/unit", 338.1],
    ["Fuel Adjustment Charge (FAC): 245 units @ Rs. 0.35/unit", 85.75],
    ["Electricity Duty @ 16%", 382.5],
    ["Tax on Sale of Electricity: 245 units @ Rs. 0.26/unit", 63.7],
    ["Prompt Payment Discount (previous bill, paid online)", -23.0],
    ["Rounding Adjustment", 0.15],
  ],
  totals: [
    ["Current Bill Amount", inr(2814.0)],
    ["Principal Arrears", inr(0)],
    ["TOTAL AMOUNT PAYABLE", `Rs. ${inr(2814.0)}`, true],
    ["If paid after due date (incl. 1.25% p.m. interest)", inr(2849.18)],
  ],
  amountWords: rupeesInWords(2814),
  notes: [
    "Average daily consumption this month: 8.2 units. Same month last year: 7.4 units.",
    "Pay online via UPI/net-banking to earn a prompt payment discount of 0.25% on your next bill.",
    "For outages call 1800-00-0000 or use the WMVV Connect app.",
  ],
};

const commercial = {
  file: "commercial-bill.pdf",
  brand: "#28306e",
  docTitle: "Tax Invoice — LT Commercial Supply",
  utility: {
    name: "Metro Capital Power Distribution Ltd.",
    sub: "(A fictional distribution licensee — specimen bill for demo purposes)",
    addressLine: "Vidyut Sadan, Barakhamba Lane, New Delhi 110001 | Helpline: 19100 | www.mcpd.example",
  },
  meta: [
    ["Bill No", "MCP/ND/2026/06/771402"],
    ["Bill Date", "05-Jul-2026"],
    ["Billing Period", "01-Jun-2026 to 30-Jun-2026"],
    ["Due Date", "20-Jul-2026"],
  ],
  consumer: {
    name: "Apex Retail Private Limited",
    addressLines: [
      "Ground Floor, Block E-14",
      "Inner Circle, Connaught Place",
      "New Delhi 110001",
      "GSTIN: 07AAACA0000A1Z5",
    ],
  },
  connection: [
    ["CA Number", "150890224477"],
    ["Tariff Category", "Non-Domestic LT (NDLT-2)"],
    ["Sanctioned Load", "45 kW"],
    ["MDI This Month", "52.4 kVA"],
    ["Meter No", "DL-3-99120744"],
    ["Supply Type", "Three Phase LT"],
  ],
  reading: {
    headers: ["Meter No", "Previous Reading (01-Jun)", "Current Reading (01-Jul)", "Multiplier", "Units Billed (kWh)"],
    widths: [90, 130, 130, 70, 91],
    rows: [["DL-3-99120744", "88,214", "95,054", "1", "6,840"]],
  },
  charges: [
    ["Energy Charge: 6,840 units @ Rs. 8.50/unit", 58140.0],
    ["Fixed (Demand) Charge: 45 kW @ Rs. 250/kW", 11250.0],
    ["Excess Demand Surcharge: MDI 52.4 kVA vs sanctioned 45 kW (7.4 kVA @ Rs. 500)", 3700.0],
    ["Power Purchase Adjustment Cost (PPAC) @ 22%", 15265.8],
    ["Electricity Tax @ 5%", 4417.79],
    ["Late Payment Surcharge (on unpaid May-2026 bill)", 1486.5],
  ],
  totals: [
    ["Current Bill Amount", inr(94260.09)],
    ["Principal Arrears (May-2026 bill unpaid)", inr(9910.0)],
    ["TOTAL AMOUNT PAYABLE", `Rs. ${inr(104170.0)}`, true],
    ["If paid after due date", inr(106253.4)],
  ],
  amountWords: rupeesInWords(104170),
  notes: [
    "ARREARS NOTICE: Your May-2026 bill of Rs. 9,910.00 remains unpaid. Supply is liable for disconnection under Section 56 if arrears are not cleared by the due date.",
    "MDI of 52.4 kVA exceeded your sanctioned load of 45 kW. Repeated violation for 3 consecutive months may result in compulsory load enhancement.",
    "PPAC is levied as per DERC order dated 15-Apr-2026.",
  ],
};

const industrial = {
  file: "industrial-bill.pdf",
  brand: "#7a2e12",
  docTitle: "Tax Invoice — HT Industrial Supply",
  utility: {
    name: "Suryodaya Transmission & Distribution Co. Ltd.",
    sub: "(A fictional distribution licensee — specimen bill for demo purposes)",
    addressLine: "Urja Marg, Sector 11, Gandhinagar 382011 | HT helpdesk: 1800-11-0000 | www.stdc.example",
  },
  meta: [
    ["Bill No", "STD/HT/2026/07/003182"],
    ["Bill Date", "02-Jul-2026"],
    ["Billing Period", "01-Jun-2026 to 30-Jun-2026"],
    ["Due Date", "23-Jul-2026"],
  ],
  consumer: {
    name: "Shakti Auto Components Ltd.",
    addressLines: [
      "Plot 218/2, Phase IV",
      "GIDC Industrial Estate, Vatva",
      "Ahmedabad, Gujarat 382445",
      "GSTIN: 24AABCS0000B1Zk",
    ],
  },
  connection: [
    ["Consumer No", "HT-24-000921"],
    ["Tariff Category", "HT-I Industrial (11 kV)"],
    ["Contract Demand", "500 kVA"],
    ["Billed Demand", "465 kVA"],
    ["Power Factor", "0.89"],
    ["CT/PT Ratio", "250:1"],
  ],
  reading: {
    headers: ["Period", "Previous Reading", "Current Reading", "Multiplier", "Units (kWh)"],
    widths: [120, 110, 110, 70, 101],
    rows: [
      ["Normal (06–18 hrs)", "5,731.4", "6,099.4", "250", "92,000"],
      ["Peak (18–22 hrs)", "1,872.6", "1,985.8", "250", "28,300"],
      ["Off-peak (22–06 hrs)", "1,242.2", "1,330.2", "250", "22,000"],
    ],
  },
  charges: [
    ["Energy Charge — Normal: 92,000 units @ Rs. 7.10/unit", 653200.0],
    ["Energy Charge — Peak (TOD): 28,300 units @ Rs. 8.55/unit", 241965.0],
    ["Energy Charge — Off-peak (TOD): 22,000 units @ Rs. 5.95/unit", 130900.0],
    ["Demand Charge: 465 kVA @ Rs. 350/kVA", 162750.0],
    ["Power Factor Penalty: PF 0.89 below norm 0.90 (1% of energy + demand charges)", 11888.15],
    ["Fuel & Power Purchase Price Adjustment (FPPPA): 1,42,300 units @ Rs. 1.20/unit", 170760.0],
    ["Electricity Duty @ 15%", 205719.47],
  ],
  totals: [
    ["Current Bill Amount", inr(1577182.62)],
    ["Rounding Adjustment", inr(0.38)],
    ["TOTAL AMOUNT PAYABLE", `Rs. ${inr(1577183.0)}`, true],
    ["Prompt payment option (1% rebate if paid by 09-Jul-2026)", inr(1561411.17)],
  ],
  amountWords: rupeesInWords(1577183),
  notes: [
    "Power factor of 0.89 is below the 0.90 norm — a penalty of 1% of energy + demand charges has been levied. PF above 0.95 earns an incentive of 0.5% per 0.01.",
    "Billed demand is the highest of: actual MDI (465 kVA) or 85% of contract demand (425 kVA).",
    "TOD peak-hour consumption (18–22 hrs) is billed at Rs. 8.55/unit vs Rs. 5.95 off-peak. Shifting load to 22:00–06:00 reduces energy cost.",
    "Units billed this month: 1,42,300 kWh. Previous month: 1,38,940 kWh.",
  ],
};

/* ---------------- run ---------------- */

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const bill of [residential, commercial, industrial]) {
    await drawBill(bill);
    console.log(`generated ${bill.file}`);
  }
})();
