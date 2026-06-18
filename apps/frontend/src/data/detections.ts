export type DetectionSeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';
export type DetectionStatus = 'Active' | 'Testing' | 'Draft' | 'Retired';
export type SiemPlatform = 'Splunk' | 'Microsoft Sentinel' | 'Chronicle' | 'Elastic' | 'QRadar';

export interface Detection {
  id: string;
  title: string;
  description: string;
  tactic: string;
  tacticId: string;
  technique: string;
  techniqueId: string;
  severity: DetectionSeverity;
  status: DetectionStatus;
  siem: SiemPlatform;
  queryLanguage: 'SPL' | 'KQL' | 'YARA-L' | 'EQL' | 'AQL';
  query: string;
  dataSources: string[];
  nistControls: string[];
  metrics: {
    alertsPerDay: number;
    fpRate: number; // percentage 0-100
    mttd: number; // hours
  };
  created: string;
  lastUpdated: string;
  lastValidated: string;
  tags: string[];
}

export const DETECTIONS: Detection[] = [
  {
    id: 'DET-0001',
    title: 'PowerShell Encoded Command Execution',
    description:
      'Detects PowerShell launched with encoded command arguments (-EncodedCommand, -enc, -ec). A primary obfuscation technique used by malware loaders, ransomware stagers, and post-exploitation frameworks including Cobalt Strike and Empire.',
    tactic: 'Execution',
    tacticId: 'TA0002',
    technique: 'Command and Scripting Interpreter: PowerShell',
    techniqueId: 'T1059.001',
    severity: 'High',
    status: 'Active',
    siem: 'Splunk',
    queryLanguage: 'SPL',
    query: `index=windows EventCode=4688 NewProcessName="*\\powershell.exe"
  CommandLine IN ("*-EncodedCommand*","*-enc *","*-ec *","*-E *")
| eval decoded=base64decode(replace(CommandLine,
    ".*-(EncodedCommand|enc|ec|E) ([A-Za-z0-9+/=]+).*","\\2"))
| where len(decoded) > 0
| table _time, host, user, ParentProcessName, CommandLine, decoded
| sort -_time`,
    dataSources: ['Windows Security Event Logs (4688)', 'Sysmon (Event ID 1)'],
    nistControls: ['SI-3', 'SI-4', 'AU-2'],
    metrics: { alertsPerDay: 3.2, fpRate: 12, mttd: 1.8 },
    created: '2026-01-15',
    lastUpdated: '2026-05-20',
    lastValidated: '2026-06-01',
    tags: ['powershell', 'obfuscation', 'execution', 'windows'],
  },
  {
    id: 'DET-0002',
    title: 'LSASS Memory Access for Credential Dumping',
    description:
      'Detects attempts to access LSASS memory using suspicious granted access masks — the signature pattern of Mimikatz, ProcDump, and direct WinAPI credential harvesting. Excludes known-good system processes.',
    tactic: 'Credential Access',
    tacticId: 'TA0006',
    technique: 'OS Credential Dumping: LSASS Memory',
    techniqueId: 'T1003.001',
    severity: 'Critical',
    status: 'Active',
    siem: 'Splunk',
    queryLanguage: 'SPL',
    query: `index=sysmon EventCode=10 TargetImage="*\\lsass.exe"
  GrantedAccess IN ("0x1010","0x1438","0x143a","0x1418","0x1FFFFF","0x40","0x1000")
| where NOT (SourceImage IN (
    "C:\\Windows\\System32\\csrss.exe",
    "C:\\Windows\\System32\\wininit.exe",
    "C:\\Windows\\System32\\services.exe"))
| stats count by _time, host, SourceImage, SourceUser, GrantedAccess, CallTrace
| sort -_time`,
    dataSources: ['Sysmon (Event ID 10 — ProcessAccess)'],
    nistControls: ['AC-3', 'SI-3', 'SI-4'],
    metrics: { alertsPerDay: 0.4, fpRate: 3, mttd: 0.5 },
    created: '2026-01-20',
    lastUpdated: '2026-04-10',
    lastValidated: '2026-06-01',
    tags: ['lsass', 'mimikatz', 'credential-dumping', 'windows'],
  },
  {
    id: 'DET-0003',
    title: 'Azure AD Sign-in from New Country',
    description:
      "Detects Azure AD interactive sign-ins from a country not present in the user's 30-day baseline. Surfaces account compromise, credential theft, and impossible-travel scenarios for cloud identity.",
    tactic: 'Initial Access',
    tacticId: 'TA0001',
    technique: 'Valid Accounts: Cloud Accounts',
    techniqueId: 'T1078.004',
    severity: 'High',
    status: 'Active',
    siem: 'Microsoft Sentinel',
    queryLanguage: 'KQL',
    query: `let lookback = 30d;
let baseline = SigninLogs
    | where TimeGenerated > ago(lookback)
    | summarize KnownCountries = make_set(Location) by UserPrincipalName;
SigninLogs
| where TimeGenerated > ago(1d)
| where ResultType == 0 // successful sign-in
| join kind=leftouter baseline on UserPrincipalName
| where isnotempty(Location)
      and not(Location in (KnownCountries))
| project TimeGenerated, UserPrincipalName, Location,
          IPAddress, AppDisplayName, DeviceDetail, RiskLevelAggregated`,
    dataSources: ['Azure AD Sign-in Logs'],
    nistControls: ['AC-17', 'IA-2', 'SI-4'],
    metrics: { alertsPerDay: 1.1, fpRate: 18, mttd: 2.4 },
    created: '2026-02-01',
    lastUpdated: '2026-05-15',
    lastValidated: '2026-05-28',
    tags: ['azure-ad', 'impossible-travel', 'identity', 'cloud'],
  },
  {
    id: 'DET-0004',
    title: 'WMI Lateral Movement via wmic.exe',
    description:
      'Detects wmic.exe invocations targeting remote systems, a classic lateral movement technique used for remote process execution and persistence on Windows hosts.',
    tactic: 'Lateral Movement',
    tacticId: 'TA0008',
    technique: 'Remote Services: Windows Remote Management',
    techniqueId: 'T1021.006',
    severity: 'High',
    status: 'Active',
    siem: 'Splunk',
    queryLanguage: 'SPL',
    query: `index=windows EventCode=4688 NewProcessName="*\\wmic.exe"
  (CommandLine="*/node:*" OR CommandLine="*call*" OR CommandLine="*process*")
| eval target_host=replace(CommandLine,".*\\/node:([^ ]+).*","\\1")
| where target_host != ComputerName
| table _time, host, user, target_host, CommandLine
| sort -_time`,
    dataSources: ['Windows Security Event Logs (4688)', 'Sysmon (Event ID 1)'],
    nistControls: ['AC-17', 'SI-3', 'SI-4'],
    metrics: { alertsPerDay: 0.8, fpRate: 5, mttd: 1.2 },
    created: '2026-02-10',
    lastUpdated: '2026-05-01',
    lastValidated: '2026-06-01',
    tags: ['wmi', 'lateral-movement', 'windows', 'remote-execution'],
  },
  {
    id: 'DET-0005',
    title: 'Ransomware Shadow Copy Deletion',
    description:
      'Detects deletion of Volume Shadow Copies via vssadmin or wmic — the first action taken by virtually every ransomware family before encryption to prevent recovery.',
    tactic: 'Impact',
    tacticId: 'TA0040',
    technique: 'Inhibit System Recovery',
    techniqueId: 'T1490',
    severity: 'Critical',
    status: 'Active',
    siem: 'Splunk',
    queryLanguage: 'SPL',
    query: `index=windows EventCode=4688
  ((NewProcessName="*\\vssadmin.exe" AND CommandLine="*delete shadows*")
  OR (NewProcessName="*\\wmic.exe" AND CommandLine="*shadowcopy*delete*")
  OR (NewProcessName="*\\bcdedit.exe" AND CommandLine="*recoveryenabled*No*"))
| table _time, host, user, NewProcessName, CommandLine
| sort -_time`,
    dataSources: ['Windows Security Event Logs (4688)', 'Sysmon (Event ID 1)'],
    nistControls: ['CP-9', 'SI-3', 'SI-4'],
    metrics: { alertsPerDay: 0.05, fpRate: 1, mttd: 0.2 },
    created: '2026-01-10',
    lastUpdated: '2026-03-15',
    lastValidated: '2026-06-01',
    tags: ['ransomware', 'shadow-copy', 'impact', 'windows'],
  },
  {
    id: 'DET-0006',
    title: 'Kerberoasting — SPN Ticket Requests',
    description:
      'Detects anomalous Kerberos TGS requests for RC4-encrypted service tickets (etype 23) from non-service accounts — the Kerberoasting signature used to crack service account passwords offline.',
    tactic: 'Credential Access',
    tacticId: 'TA0006',
    technique: 'Steal or Forge Kerberos Tickets: Kerberoasting',
    techniqueId: 'T1558.003',
    severity: 'High',
    status: 'Active',
    siem: 'Microsoft Sentinel',
    queryLanguage: 'KQL',
    query: `SecurityEvent
| where EventID == 4769
| where TicketEncryptionType == "0x17" // RC4 — Kerberoasting signature
| where ServiceName !endswith "$" // exclude machine accounts
| where AccountName !endswith "$"
| where ServiceName !in ("krbtgt","kadmin")
| summarize RequestCount = count() by AccountName, ServiceName, IpAddress, bin(TimeGenerated, 1h)
| where RequestCount > 3 // multiple SPN requests = enumeration
| sort by RequestCount desc`,
    dataSources: ['Windows Security Event Logs (4769)'],
    nistControls: ['AC-3', 'IA-5', 'SI-4'],
    metrics: { alertsPerDay: 0.2, fpRate: 4, mttd: 1.0 },
    created: '2026-02-20',
    lastUpdated: '2026-04-22',
    lastValidated: '2026-05-30',
    tags: ['kerberoasting', 'active-directory', 'credential-access', 'windows'],
  },
  {
    id: 'DET-0007',
    title: 'DNS Beaconing to Newly Registered Domain',
    description:
      'Identifies hosts making regular, low-volume DNS requests to newly registered domains (<30 days old) — characteristic of C2 beaconing patterns designed to evade threat intel blocklists.',
    tactic: 'Command and Control',
    tacticId: 'TA0011',
    technique: 'Application Layer Protocol: DNS',
    techniqueId: 'T1071.004',
    severity: 'Medium',
    status: 'Active',
    siem: 'Chronicle',
    queryLanguage: 'YARA-L',
    query: `rule dns_beaconing_new_domain {
  meta:
    author = "OneMDR Detection Engineering"
    description = "DNS beaconing to newly registered domain"
    mitre_technique = "T1071.004"
  events:
    $dns.metadata.event_type = "NETWORK_DNS"
    $dns.network.dns.questions.name = $domain
    // Domain registered < 30 days — enriched via WHOIS integration
    $dns.principal.hostname = $host
    // Statistical beacon check: > 10 queries, regular interval
    $dns.metadata.collected_timestamp.seconds > timestamp_seconds(
      ago(1h))
  match:
    $host, $domain over 1h
  condition:
    #dns > 10 and
    max($dns.metadata.collected_timestamp.seconds) -
    min($dns.metadata.collected_timestamp.seconds) < 3600
}`,
    dataSources: ['Chronicle UDM DNS Events', 'WHOIS enrichment feed'],
    nistControls: ['SC-7', 'SI-3', 'SI-4'],
    metrics: { alertsPerDay: 1.8, fpRate: 14, mttd: 3.2 },
    created: '2026-03-01',
    lastUpdated: '2026-05-10',
    lastValidated: '2026-05-25',
    tags: ['dns', 'c2', 'beaconing', 'network'],
  },
  {
    id: 'DET-0008',
    title: 'AWS Console Login Without MFA',
    description:
      'Detects successful AWS Console authentication events where MFA was not used. Cloud console access without MFA is a critical control gap frequently exploited after credential theft.',
    tactic: 'Initial Access',
    tacticId: 'TA0001',
    technique: 'Valid Accounts: Cloud Accounts',
    techniqueId: 'T1078.004',
    severity: 'High',
    status: 'Active',
    siem: 'Splunk',
    queryLanguage: 'SPL',
    query: `index=aws sourcetype=aws:cloudtrail eventName=ConsoleLogin
  responseElements.ConsoleLogin=Success
  additionalEventData.MFAUsed=No
| table _time, userIdentity.userName, sourceIPAddress,
        userAgent, awsRegion
| sort -_time`,
    dataSources: ['AWS CloudTrail'],
    nistControls: ['IA-2', 'IA-5', 'AC-17'],
    metrics: { alertsPerDay: 0.6, fpRate: 5, mttd: 0.8 },
    created: '2026-02-15',
    lastUpdated: '2026-05-05',
    lastValidated: '2026-06-01',
    tags: ['aws', 'cloud', 'mfa', 'identity'],
  },
  {
    id: 'DET-0009',
    title: 'Scheduled Task Created by Uncommon Process',
    description:
      'Detects new scheduled tasks created by parent processes that do not normally create tasks (non-admin tools, scripting engines, Office applications) — a persistence technique widely used by APTs.',
    tactic: 'Persistence',
    tacticId: 'TA0003',
    technique: 'Scheduled Task/Job: Scheduled Task',
    techniqueId: 'T1053.005',
    severity: 'Medium',
    status: 'Testing',
    siem: 'Elastic',
    queryLanguage: 'EQL',
    query: `sequence by host.name with maxspan=30s
  [process where event.type == "start" and
    process.name : ("schtasks.exe") and
    process.parent.name : (
      "powershell.exe","cmd.exe","wscript.exe","cscript.exe",
      "mshta.exe","rundll32.exe","regsvr32.exe","msiexec.exe")
    and process.command_line : ("*/create*","/SC*")]
  [registry where registry.path : (
    "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Schedule\\TaskCache\\*")]`,
    dataSources: ['Elastic Endpoint (ECS)', 'Sysmon (Event ID 1, 13)'],
    nistControls: ['SI-3', 'SI-4', 'CM-7'],
    metrics: { alertsPerDay: 2.1, fpRate: 22, mttd: 2.8 },
    created: '2026-03-10',
    lastUpdated: '2026-06-05',
    lastValidated: '2026-06-10',
    tags: ['scheduled-task', 'persistence', 'windows', 'testing'],
  },
  {
    id: 'DET-0010',
    title: 'Excessive Failed Logins Followed by Success',
    description:
      'Detects a password spray or brute-force pattern: N failed logins within a window followed by a successful authentication from the same source — indicating successful credential compromise.',
    tactic: 'Credential Access',
    tacticId: 'TA0006',
    technique: 'Brute Force: Password Spraying',
    techniqueId: 'T1110.003',
    severity: 'Critical',
    status: 'Active',
    siem: 'Microsoft Sentinel',
    queryLanguage: 'KQL',
    query: `let threshold = 10;
let window = 1h;
let failures = SecurityEvent
    | where EventID == 4625
    | where TimeGenerated > ago(24h)
    | summarize FailCount = count(), Accounts = make_set(TargetUserName)
        by IpAddress, bin(TimeGenerated, window)
    | where FailCount >= threshold;
let successes = SecurityEvent
    | where EventID == 4624
    | where LogonType in (3, 10)
    | where TimeGenerated > ago(24h);
failures
| join kind=inner successes on IpAddress
| where TimeGenerated1 > TimeGenerated and
        TimeGenerated1 < datetime_add("hour", 1, TimeGenerated)
| project TimeGenerated, IpAddress, FailCount, Accounts,
          SuccessAccount = TargetUserName1, SuccessTime = TimeGenerated1`,
    dataSources: ['Windows Security Event Logs (4624, 4625)', 'Azure AD Sign-in Logs'],
    nistControls: ['AC-7', 'IA-5', 'SI-4'],
    metrics: { alertsPerDay: 0.3, fpRate: 6, mttd: 1.5 },
    created: '2026-01-25',
    lastUpdated: '2026-04-18',
    lastValidated: '2026-06-01',
    tags: ['brute-force', 'password-spray', 'identity', 'active-directory'],
  },
  {
    id: 'DET-0011',
    title: 'Suspicious Registry Run Key Modification',
    description:
      'Detects new entries written to common autorun registry keys by non-standard processes — a ubiquitous persistence mechanism used by malware to survive reboots.',
    tactic: 'Persistence',
    tacticId: 'TA0003',
    technique: 'Boot/Logon Autostart Execution: Registry Run Keys',
    techniqueId: 'T1547.001',
    severity: 'Medium',
    status: 'Active',
    siem: 'Splunk',
    queryLanguage: 'SPL',
    query: `index=sysmon EventCode=13
  TargetObject IN (
    "*\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run*",
    "*\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce*",
    "*\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run*")
| where NOT (Image IN (
    "C:\\Windows\\regedit.exe",
    "C:\\Windows\\System32\\reg.exe",
    "C:\\Program Files*"))
| table _time, host, user, Image, TargetObject, Details
| sort -_time`,
    dataSources: ['Sysmon (Event ID 13 — RegistryEvent)'],
    nistControls: ['CM-6', 'SI-3', 'SI-4'],
    metrics: { alertsPerDay: 1.4, fpRate: 9, mttd: 2.0 },
    created: '2026-02-05',
    lastUpdated: '2026-05-12',
    lastValidated: '2026-06-01',
    tags: ['registry', 'persistence', 'autorun', 'windows'],
  },
  {
    id: 'DET-0012',
    title: 'Outbound HTTPS to Non-Categorised IP',
    description:
      'Identifies endpoints making HTTPS connections to IP addresses with no associated hostname or domain — a C2 pattern used when attackers use direct-IP infrastructure to avoid DNS-based detection.',
    tactic: 'Command and Control',
    tacticId: 'TA0011',
    technique: 'Application Layer Protocol: Web Protocols',
    techniqueId: 'T1071.001',
    severity: 'Medium',
    status: 'Draft',
    siem: 'Chronicle',
    queryLanguage: 'YARA-L',
    query: `rule c2_direct_ip_https {
  meta:
    description = "HTTPS to direct IP — no hostname resolution"
    mitre_technique = "T1071.001"
  events:
    $net.metadata.event_type = "NETWORK_HTTP"
    $net.network.application_protocol = "HTTPS"
    // No associated domain (direct IP connection)
    not re.regex($net.target.hostname, \`^[a-zA-Z]\`)
    $net.target.ip = $ip
    $net.principal.hostname = $host
    // Exclude RFC1918 private ranges
    not net.ip_in_range_cidr($ip, "10.0.0.0/8")
    not net.ip_in_range_cidr($ip, "172.16.0.0/12")
    not net.ip_in_range_cidr($ip, "192.168.0.0/16")
  match:
    $host, $ip over 15m
  condition:
    #net > 5
}`,
    dataSources: ['Chronicle UDM Network Events', 'Proxy logs', 'Firewall logs'],
    nistControls: ['SC-7', 'SI-3', 'SI-4'],
    metrics: { alertsPerDay: 0, fpRate: 0, mttd: 0 },
    created: '2026-06-10',
    lastUpdated: '2026-06-15',
    lastValidated: '',
    tags: ['c2', 'https', 'network', 'draft'],
  },
];

export const SIEM_COLORS: Record<string, string> = {
  Splunk: 'text-orange-400 bg-orange-500/15 border border-orange-500/25',
  'Microsoft Sentinel': 'text-blue-400 bg-blue-500/15 border border-blue-500/25',
  Chronicle: 'text-indigo-400 bg-indigo-500/15 border border-indigo-500/25',
  Elastic: 'text-cyan-400 bg-cyan-500/15 border border-cyan-500/25',
  QRadar: 'text-violet-400 bg-violet-500/15 border border-violet-500/25',
};

export const SEVERITY_COLORS: Record<string, string> = {
  Critical:
    'text-red-400 bg-red-500/20 border border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.15)]',
  High: 'text-orange-400 bg-orange-500/20 border border-orange-500/30',
  Medium: 'text-amber-400 bg-amber-500/20 border border-amber-500/25',
  Low: 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/25',
  Informational: 'text-zinc-400 bg-white/5 border border-white/10',
};

export const STATUS_COLORS: Record<string, string> = {
  Active: 'text-emerald-400 bg-emerald-500/20 border border-emerald-500/30',
  Testing: 'text-amber-400 bg-amber-500/20 border border-amber-500/25',
  Draft: 'text-zinc-400 bg-white/5 border border-white/10',
  Retired: 'text-rose-400 bg-rose-500/15 border border-rose-500/25',
};
