/**
 * Extraction script: reads Excel detection files and generates SQL INSERT statements
 * Run with: npx ts-node --project tsconfig.json scripts/extract-detections.ts
 * Output:   scripts/detection-inserts.sql
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const EXCEL_DIR = 'C:/Users/User/Desktop/Clarbit BIG/example/Detections';

// ── Helpers ────────────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  if (s == null || s === '') return 'NULL';
  const clean = String(s)
    .replace(/'/g, "''")
    .replace(/\r?\n/g, ' ')
    .replace(/\t/g, ' ')
    .trim()
    .slice(0, 2000);
  return `'${clean}'`;
}

function pgArray(arr: string[]): string {
  const items = (arr || []).filter((s) => s && s.trim());
  if (!items.length) return "'{}'";
  const escaped = items.map(
    (s) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "''").trim()}"`,
  );
  return `'{${escaped.join(',')}}'`;
}

function mapSev(s: string): string {
  switch (s.trim().toLowerCase()) {
    case 'very high':
      return 'CRITICAL';
    case 'high':
      return 'HIGH';
    case 'medium':
      return 'MEDIUM';
    case 'low':
      return 'LOW';
    case 'very low':
      return 'INFO';
    default:
      return 'LOW';
  }
}

function extractMitreId(name: string): string | null {
  const m = name.match(/T(\d{4}(?:\.\d{3})?)/);
  return m ? `T${m[1]}` : null;
}

function cleanSplunkName(name: string): string {
  const m = name.match(/^SIEM-[A-Z]+-T\d{4}(?:\.\d{3})?-[A-Z0-9]+-(.+)$/);
  return (m ? m[1] : name).trim();
}

function firstLine(s: string): string {
  return s.split(/[\r\n]+/)[0].trim();
}

// ── State ──────────────────────────────────────────────────────────────────────

let counter = 100;
const seen = new Set<string>();
const inserts: string[] = [];

function addDetection(
  name: string,
  desc: string,
  severity: string,
  platform: string,
  mitreId: string | null,
  tactic: string | null,
  technique: string | null,
  query: string,
  queryLang: string,
  tags: string[],
  logSources: string[],
  deviceTypes: string[],
) {
  const key = name.toLowerCase().slice(0, 120);
  if (seen.has(key)) return;
  seen.add(key);

  counter++;
  const ruleId = `DET-${String(counter).padStart(4, '0')}`;
  const safeName = name.slice(0, 255);
  const safeDesc = (desc || `Detection: ${safeName}`).slice(0, 2000);
  const safeQuery = query?.trim() || '-- No query defined';

  const mit = mitreId ? `'${mitreId}'` : 'NULL';
  const tac = esc(tactic);
  const tec = esc(technique);

  inserts.push(
    `(${esc(ruleId)}, ${esc(safeName)}, ${esc(safeDesc)}, '${severity}'::detection_severity, '${platform}'::detection_platform, ${mit}, ${tac}, ${tec}, '{}', '{}', ${esc(safeQuery)}, '${queryLang}'::query_language, ${pgArray(tags)}, NULL, NULL, NULL, TRUE, NULL, ${pgArray(logSources)}, ${pgArray(deviceTypes)})`,
  );
}

// ── Data-source → device type mapping ─────────────────────────────────────────

const DS_TO_DEVICE: Record<string, string[]> = {
  'Network Communication': ['Firewall', 'Network Device'],
  Authentication: ['Identity Provider', 'Active Directory'],
  'Windows Security': ['Windows AD', 'Windows Endpoint'],
  DNS: ['DNS Server'],
  Email: ['Email Gateway', 'Mail Server'],
  'Endpoint Detection and Response': ['EDR', 'Endpoint'],
  'Anti-Virus / Anti-Malware': ['Antivirus'],
  'Web Proxy / NGFW': ['Web Proxy', 'Next-Gen Firewall'],
  DLP: ['Data Loss Prevention'],
  'IDS / IPS': ['IDS/IPS'],
  'Audit Trail': ['Audit System'],
  AWS: ['AWS Cloud'],
};

function deriveDeviceTypes(logSources: string[]): string[] {
  const types = new Set<string>();
  for (const ls of logSources) {
    for (const [key, vals] of Object.entries(DS_TO_DEVICE)) {
      if (ls.includes(key)) vals.forEach((v) => types.add(v));
    }
  }
  return [...types];
}

// ── Splunk file ────────────────────────────────────────────────────────────────

function extractSplunk() {
  const file = path.join(EXCEL_DIR, 'Usecases Master 2022 09 29 - Copy.xlsx');
  const wb = XLSX.readFile(file);
  const ws = wb.Sheets['Splunk'];
  // Use header: 'A' so column A = 'A', B = 'B', etc.
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
    header: 'A',
    raw: false,
    defval: '',
  });

  const before = inserts.length;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const ucName = String(row['A'] || '').trim();
    if (!ucName || ucName === 'Use Case Name') continue;

    const name = cleanSplunkName(ucName);
    if (!name) continue;

    const desc = String(row['B'] || '').trim();
    const tactic = firstLine(String(row['F'] || '').trim());
    const tech = firstLine(String(row['G'] || '').trim());
    const dataSource = String(row['I'] || '').trim();
    const spl = String(row['L'] || '').trim();
    const severity = mapSev(String(row['M'] || '').trim());
    const mitreId = extractMitreId(ucName);

    const logSources = dataSource
      .split(/[\r\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const deviceTypes = deriveDeviceTypes(logSources);

    addDetection(
      name,
      desc,
      severity,
      'SPLUNK',
      mitreId,
      tactic || null,
      tech || null,
      spl,
      'SPL',
      [],
      logSources,
      deviceTypes,
    );
  }

  console.log(`Splunk: ${inserts.length - before} unique detections extracted`);
}

// ── Log Monitoring file ────────────────────────────────────────────────────────

const SHEET_LOG_SOURCES: Record<string, string[]> = {
  'NetScreen FW': ['Network Communication', 'Firewall Logs', 'Juniper Netscreen'],
  'Microsoft Windows DC': ['Windows Security', 'Authentication', 'Active Directory'],
  'CISCO PIX-ASA': ['Network Communication', 'Firewall Logs', 'Cisco ASA'],
  'MS Exchange': ['Email', 'Exchange Logs'],
  Linux: ['Linux Syslog', 'Authentication'],
  'Symantec SEP': ['Anti-Virus / Anti-Malware', 'Endpoint Protection'],
  Oracle: ['Database Audit', 'Oracle Audit'],
  Webservers: ['Web Server Logs', 'HTTP Access Logs'],
  'CISCO CAT OS': ['Network Communication', 'Switch Logs'],
  'CISCO IOS': ['Network Communication', 'Router Logs'],
  'Juniper NSM': ['Network Communication', 'Firewall Logs', 'Juniper'],
  'Mcafee ePO': ['Anti-Virus / Anti-Malware', 'Endpoint Protection'],
  'McaFee Intrushield IPS': ['IDS / IPS', 'IPS Alerts'],
  'CISCO ACS': ['Authentication', 'AAA Logs'],
  CITRIX: ['Authentication', 'Application Logs'],
  'SUNONE SAP': ['Application Audit', 'SAP Logs'],
};

const SHEET_DEVICE_TYPES: Record<string, string[]> = {
  'NetScreen FW': ['Juniper Netscreen Firewall', 'Firewall'],
  'Microsoft Windows DC': ['Windows Active Directory', 'Windows Domain Controller'],
  'CISCO PIX-ASA': ['Cisco ASA Firewall', 'Firewall'],
  'MS Exchange': ['Microsoft Exchange', 'Email Server'],
  Linux: ['Linux Server'],
  'Symantec SEP': ['Symantec Endpoint Protection', 'Antivirus'],
  Oracle: ['Oracle Database'],
  Webservers: ['Web Server', 'Apache', 'IIS'],
  'CISCO CAT OS': ['Cisco Catalyst Switch', 'Network Switch'],
  'CISCO IOS': ['Cisco IOS Router', 'Network Router'],
  'Juniper NSM': ['Juniper NSM', 'Firewall'],
  'Mcafee ePO': ['McAfee ePO', 'Antivirus'],
  'McaFee Intrushield IPS': ['McAfee IPS', 'IDS/IPS'],
  'CISCO ACS': ['Cisco ACS', 'AAA Server'],
  CITRIX: ['Citrix', 'Virtual Desktop Infrastructure'],
  'SUNONE SAP': ['SAP', 'Enterprise Application'],
};

function extractLogMonitoring() {
  const file = path.join(EXCEL_DIR, 'Use-Cases Log Monitoring 2.7.xls');
  const wb = XLSX.readFile(file);
  const before = inserts.length;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
      header: 'A',
      raw: false,
      defval: '',
    });

    const logSources = SHEET_LOG_SOURCES[sheetName] ?? [sheetName];
    const deviceTypes = SHEET_DEVICE_TYPES[sheetName] ?? [sheetName];

    let currentCategory = '';
    let currentDesc = '';
    let currentSev = 'Low';
    const conds: string[] = [];

    const flush = () => {
      if (!currentDesc) return;
      const severity = mapSev(currentSev);
      const fullDesc = currentCategory ? `${currentCategory}: ${currentDesc}` : currentDesc;
      addDetection(
        currentDesc,
        fullDesc,
        severity,
        'SIGMA',
        null,
        currentCategory || null,
        null,
        conds.join('; ') || '-- See event condition',
        'SIGMA',
        [sheetName, currentCategory].filter(Boolean),
        logSources,
        deviceTypes,
      );
    };

    // Data starts at row index 4 (0-based = row 5 in Excel)
    for (let i = 4; i < rows.length; i++) {
      const row = rows[i];
      const cat = String(row['B'] || '').trim();
      const desc = String(row['C'] || '').trim();
      const sev = String(row['D'] || '').trim();
      const cond = String(row['F'] || '').trim();

      if (desc && desc !== currentDesc && desc !== 'Description') {
        flush();
        currentCategory = cat || currentCategory;
        currentDesc = desc;
        currentSev = sev || 'Low';
        conds.length = 0;
        if (cond) conds.push(cond);
      } else if (cond) {
        if (cat) currentCategory = cat;
        conds.push(cond);
      }
    }
    flush();
  }

  console.log(`Log Monitoring: ${inserts.length - before} unique detections extracted`);
}

// ── Run ────────────────────────────────────────────────────────────────────────

extractSplunk();
extractLogMonitoring();

console.log(`\nTotal unique detections: ${inserts.length}`);

const sql = `-- ============================================================
--  Auto-generated detection rules from Excel source files
--  Sources: Usecases Master 2022 09 29, Use-Cases Log Monitoring 2.7
--  Total: ${inserts.length} rules (DET-0101 ... DET-${String(counter).padStart(4, '0')})
-- ============================================================
INSERT INTO detections (
  rule_id, name, description, severity, platform,
  mitre_attack_id, mitre_tactic, mitre_technique,
  nist_controls, data_sources, query, query_language, tags,
  expected_alerts_per_day, expected_fp_rate, expected_mttd_hours,
  is_global, tenant_id, log_sources, device_types
) VALUES
${inserts.join(',\n')}
ON CONFLICT (rule_id) DO NOTHING;
`;

const outPath = path.join(__dirname, 'detection-inserts.sql');
fs.writeFileSync(outPath, sql, 'utf-8');
console.log(`\nSQL written to: ${outPath}`);
