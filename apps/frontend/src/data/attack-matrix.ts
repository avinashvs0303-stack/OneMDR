export interface AttackTechnique {
  id: string;
  name: string;
  coverage: number; // number of active detections
}

export interface AttackTactic {
  id: string;
  name: string;
  shortName: string;
  color: string; // tailwind bg class for tactic header
  techniques: AttackTechnique[];
}

export const ATTACK_MATRIX: AttackTactic[] = [
  {
    id: 'TA0043',
    name: 'Reconnaissance',
    shortName: 'Recon',
    color: 'bg-slate-600',
    techniques: [
      { id: 'T1595', name: 'Active Scanning', coverage: 2 },
      { id: 'T1590', name: 'Gather Victim Network Info', coverage: 0 },
      { id: 'T1589', name: 'Gather Victim Identity Info', coverage: 0 },
      { id: 'T1598', name: 'Phishing for Information', coverage: 1 },
      { id: 'T1597', name: 'Search Closed Sources', coverage: 0 },
      { id: 'T1593', name: 'Search Open Websites', coverage: 0 },
      { id: 'T1592', name: 'Gather Victim Host Info', coverage: 1 },
    ],
  },
  {
    id: 'TA0042',
    name: 'Resource Development',
    shortName: 'Resource Dev',
    color: 'bg-slate-600',
    techniques: [
      { id: 'T1583', name: 'Acquire Infrastructure', coverage: 0 },
      { id: 'T1586', name: 'Compromise Accounts', coverage: 1 },
      { id: 'T1584', name: 'Compromise Infrastructure', coverage: 0 },
      { id: 'T1587', name: 'Develop Capabilities', coverage: 0 },
      { id: 'T1588', name: 'Obtain Capabilities', coverage: 0 },
    ],
  },
  {
    id: 'TA0001',
    name: 'Initial Access',
    shortName: 'Initial Access',
    color: 'bg-red-700',
    techniques: [
      { id: 'T1566', name: 'Phishing', coverage: 6 },
      { id: 'T1190', name: 'Exploit Public-Facing App', coverage: 4 },
      { id: 'T1078', name: 'Valid Accounts', coverage: 5 },
      { id: 'T1133', name: 'External Remote Services', coverage: 4 },
      { id: 'T1189', name: 'Drive-by Compromise', coverage: 2 },
      { id: 'T1195', name: 'Supply Chain Compromise', coverage: 0 },
      { id: 'T1091', name: 'Removable Media', coverage: 2 },
      { id: 'T1199', name: 'Trusted Relationship', coverage: 1 },
    ],
  },
  {
    id: 'TA0002',
    name: 'Execution',
    shortName: 'Execution',
    color: 'bg-orange-700',
    techniques: [
      { id: 'T1059', name: 'Command & Scripting Interpreter', coverage: 8 },
      { id: 'T1203', name: 'Exploitation for Client Execution', coverage: 3 },
      { id: 'T1106', name: 'Native API', coverage: 4 },
      { id: 'T1053', name: 'Scheduled Task/Job', coverage: 5 },
      { id: 'T1047', name: 'Windows Management Instrumentation', coverage: 6 },
      { id: 'T1072', name: 'Software Deployment Tools', coverage: 2 },
      { id: 'T1129', name: 'Shared Modules', coverage: 1 },
      { id: 'T1204', name: 'User Execution', coverage: 4 },
    ],
  },
  {
    id: 'TA0003',
    name: 'Persistence',
    shortName: 'Persistence',
    color: 'bg-yellow-700',
    techniques: [
      { id: 'T1547', name: 'Boot/Logon Autostart Execution', coverage: 5 },
      { id: 'T1543', name: 'Create/Modify System Process', coverage: 4 },
      { id: 'T1546', name: 'Event Triggered Execution', coverage: 3 },
      { id: 'T1574', name: 'Hijack Execution Flow', coverage: 3 },
      { id: 'T1136', name: 'Create Account', coverage: 5 },
      { id: 'T1505', name: 'Server Software Component', coverage: 4 },
      { id: 'T1098', name: 'Account Manipulation', coverage: 6 },
      { id: 'T1197', name: 'BITS Jobs', coverage: 2 },
    ],
  },
  {
    id: 'TA0004',
    name: 'Privilege Escalation',
    shortName: 'Priv Esc',
    color: 'bg-amber-700',
    techniques: [
      { id: 'T1548', name: 'Abuse Elevation Control', coverage: 4 },
      { id: 'T1134', name: 'Access Token Manipulation', coverage: 3 },
      { id: 'T1068', name: 'Exploitation for Privilege Escalation', coverage: 3 },
      { id: 'T1055', name: 'Process Injection', coverage: 5 },
      { id: 'T1053', name: 'Scheduled Task/Job', coverage: 5 },
      { id: 'T1078', name: 'Valid Accounts', coverage: 5 },
    ],
  },
  {
    id: 'TA0005',
    name: 'Defense Evasion',
    shortName: 'Defense Evasion',
    color: 'bg-lime-700',
    techniques: [
      { id: 'T1140', name: 'Deobfuscate/Decode Files', coverage: 4 },
      { id: 'T1218', name: 'System Binary Proxy Execution', coverage: 5 },
      { id: 'T1036', name: 'Masquerading', coverage: 4 },
      { id: 'T1562', name: 'Impair Defenses', coverage: 6 },
      { id: 'T1070', name: 'Indicator Removal', coverage: 3 },
      { id: 'T1112', name: 'Modify Registry', coverage: 4 },
      { id: 'T1055', name: 'Process Injection', coverage: 5 },
      { id: 'T1027', name: 'Obfuscated Files or Information', coverage: 5 },
      { id: 'T1497', name: 'Virtualization/Sandbox Evasion', coverage: 2 },
      { id: 'T1078', name: 'Valid Accounts', coverage: 5 },
    ],
  },
  {
    id: 'TA0006',
    name: 'Credential Access',
    shortName: 'Credential Access',
    color: 'bg-emerald-700',
    techniques: [
      { id: 'T1110', name: 'Brute Force', coverage: 7 },
      { id: 'T1003', name: 'OS Credential Dumping', coverage: 6 },
      { id: 'T1187', name: 'Forced Authentication', coverage: 3 },
      { id: 'T1606', name: 'Forge Web Credentials', coverage: 2 },
      { id: 'T1056', name: 'Input Capture', coverage: 3 },
      { id: 'T1557', name: 'Adversary-in-the-Middle', coverage: 4 },
      { id: 'T1528', name: 'Steal Application Access Token', coverage: 3 },
      { id: 'T1555', name: 'Credentials from Password Stores', coverage: 4 },
    ],
  },
  {
    id: 'TA0007',
    name: 'Discovery',
    shortName: 'Discovery',
    color: 'bg-teal-700',
    techniques: [
      { id: 'T1087', name: 'Account Discovery', coverage: 4 },
      { id: 'T1580', name: 'Cloud Infrastructure Discovery', coverage: 2 },
      { id: 'T1482', name: 'Domain Trust Discovery', coverage: 3 },
      { id: 'T1083', name: 'File and Directory Discovery', coverage: 3 },
      { id: 'T1046', name: 'Network Service Discovery', coverage: 5 },
      { id: 'T1135', name: 'Network Share Discovery', coverage: 4 },
      { id: 'T1040', name: 'Network Sniffing', coverage: 3 },
      { id: 'T1069', name: 'Permission Groups Discovery', coverage: 4 },
    ],
  },
  {
    id: 'TA0008',
    name: 'Lateral Movement',
    shortName: 'Lateral Movement',
    color: 'bg-cyan-700',
    techniques: [
      { id: 'T1210', name: 'Exploitation of Remote Services', coverage: 3 },
      { id: 'T1534', name: 'Internal Spearphishing', coverage: 2 },
      { id: 'T1570', name: 'Lateral Tool Transfer', coverage: 3 },
      { id: 'T1021', name: 'Remote Services', coverage: 6 },
      { id: 'T1563', name: 'Remote Service Session Hijacking', coverage: 2 },
      { id: 'T1550', name: 'Use Alternate Auth Material', coverage: 4 },
    ],
  },
  {
    id: 'TA0009',
    name: 'Collection',
    shortName: 'Collection',
    color: 'bg-blue-700',
    techniques: [
      { id: 'T1560', name: 'Archive Collected Data', coverage: 3 },
      { id: 'T1119', name: 'Automated Collection', coverage: 2 },
      { id: 'T1530', name: 'Data from Cloud Storage', coverage: 3 },
      { id: 'T1213', name: 'Data from Info Repositories', coverage: 3 },
      { id: 'T1056', name: 'Input Capture', coverage: 3 },
      { id: 'T1039', name: 'Data from Network Shared Drive', coverage: 2 },
      { id: 'T1025', name: 'Data from Removable Media', coverage: 1 },
    ],
  },
  {
    id: 'TA0011',
    name: 'Command and Control',
    shortName: 'C2',
    color: 'bg-violet-700',
    techniques: [
      { id: 'T1071', name: 'Application Layer Protocol', coverage: 5 },
      { id: 'T1132', name: 'Data Encoding', coverage: 2 },
      { id: 'T1001', name: 'Data Obfuscation', coverage: 2 },
      { id: 'T1568', name: 'Dynamic Resolution', coverage: 3 },
      { id: 'T1573', name: 'Encrypted Channel', coverage: 4 },
      { id: 'T1008', name: 'Fallback Channels', coverage: 1 },
      { id: 'T1105', name: 'Ingress Tool Transfer', coverage: 4 },
      { id: 'T1219', name: 'Remote Access Software', coverage: 5 },
    ],
  },
  {
    id: 'TA0010',
    name: 'Exfiltration',
    shortName: 'Exfiltration',
    color: 'bg-purple-700',
    techniques: [
      { id: 'T1020', name: 'Automated Exfiltration', coverage: 2 },
      { id: 'T1030', name: 'Data Transfer Size Limits', coverage: 1 },
      { id: 'T1048', name: 'Exfil Over Alt Protocol', coverage: 3 },
      { id: 'T1041', name: 'Exfil Over C2 Channel', coverage: 3 },
      { id: 'T1011', name: 'Exfil Over Other Network', coverage: 1 },
      { id: 'T1567', name: 'Exfil Over Web Service', coverage: 4 },
    ],
  },
  {
    id: 'TA0040',
    name: 'Impact',
    shortName: 'Impact',
    color: 'bg-rose-800',
    techniques: [
      { id: 'T1485', name: 'Data Destruction', coverage: 3 },
      { id: 'T1486', name: 'Data Encrypted for Impact', coverage: 5 },
      { id: 'T1491', name: 'Defacement', coverage: 2 },
      { id: 'T1498', name: 'Network Denial of Service', coverage: 4 },
      { id: 'T1499', name: 'Endpoint Denial of Service', coverage: 3 },
      { id: 'T1489', name: 'Service Stop', coverage: 3 },
      { id: 'T1496', name: 'Resource Hijacking', coverage: 4 },
    ],
  },
];

export function getCoverageColor(coverage: number): string {
  if (coverage === 0)
    return 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-zinc-500 border-slate-200 dark:border-white/5';
  if (coverage <= 2)
    return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-500/20';
  if (coverage <= 4)
    return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20';
  if (coverage <= 6)
    return 'bg-emerald-200 dark:bg-emerald-500/40 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-500/30';
  return 'bg-emerald-500 dark:bg-emerald-500/70 text-white border-emerald-600 dark:border-emerald-500/50';
}

export function getMatrixStats() {
  const total = ATTACK_MATRIX.reduce((sum, t) => sum + t.techniques.length, 0);
  const covered = ATTACK_MATRIX.reduce(
    (sum, t) => sum + t.techniques.filter((tech) => tech.coverage > 0).length,
    0,
  );
  const strong = ATTACK_MATRIX.reduce(
    (sum, t) => sum + t.techniques.filter((tech) => tech.coverage >= 5).length,
    0,
  );
  return { total, covered, strong, pct: Math.round((covered / total) * 100) };
}
