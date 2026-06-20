-- ============================================================
--  Detection Library
--  Schema + 100 global seed rules
--  Platforms: Splunk · Sentinel · Chronicle · Elastic · QRadar · Sigma
-- ============================================================

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE "detection_severity" AS ENUM ('CRITICAL','HIGH','MEDIUM','LOW','INFO');
CREATE TYPE "detection_platform" AS ENUM ('SPLUNK','SENTINEL','CHRONICLE','ELASTIC','QRADAR','DEFENDER','SIGMA','CUSTOM');
CREATE TYPE "query_language"     AS ENUM ('SPL','KQL','YARA_L','EQL','AQL','SIGMA','CUSTOM');

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE "detections" (
  "id"                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "rule_id"                TEXT UNIQUE NOT NULL,
  "name"                   TEXT NOT NULL,
  "description"            TEXT NOT NULL,
  "severity"               "detection_severity" NOT NULL,
  "platform"               "detection_platform" NOT NULL,
  "mitre_attack_id"        TEXT,
  "mitre_tactic"           TEXT,
  "mitre_technique"        TEXT,
  "nist_controls"          TEXT[]    NOT NULL DEFAULT '{}',
  "data_sources"           TEXT[]    NOT NULL DEFAULT '{}',
  "query"                  TEXT      NOT NULL,
  "query_language"         "query_language" NOT NULL,
  "tags"                   TEXT[]    NOT NULL DEFAULT '{}',
  "expected_alerts_per_day" DECIMAL(8,2),
  "expected_fp_rate"       DECIMAL(5,2),
  "expected_mttd_hours"    DECIMAL(8,2),
  "is_global"              BOOLEAN   NOT NULL DEFAULT FALSE,
  "tenant_id"              UUID      REFERENCES "tenants"("id") ON DELETE CASCADE,
  "created_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "tenant_detections" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"      UUID NOT NULL REFERENCES "tenants"("id")    ON DELETE CASCADE,
  "detection_id"   UUID NOT NULL REFERENCES "detections"("id") ON DELETE CASCADE,
  "is_enabled"     BOOLEAN     NOT NULL DEFAULT TRUE,
  "enabled_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "enabled_by_id"  UUID,
  UNIQUE ("tenant_id","detection_id")
);

CREATE TABLE "detection_stats" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"      UUID NOT NULL REFERENCES "tenants"("id")    ON DELETE CASCADE,
  "detection_id"   UUID NOT NULL REFERENCES "detections"("id") ON DELETE CASCADE,
  "date"           DATE NOT NULL,
  "trigger_count"  INTEGER NOT NULL DEFAULT 0,
  "true_positives" INTEGER NOT NULL DEFAULT 0,
  "false_positives"INTEGER NOT NULL DEFAULT 0,
  "mttd_minutes"   DECIMAL(10,2),
  UNIQUE ("tenant_id","detection_id","date")
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX "detections_platform_idx"        ON "detections"("platform");
CREATE INDEX "detections_severity_idx"        ON "detections"("severity");
CREATE INDEX "detections_mitre_idx"           ON "detections"("mitre_attack_id");
CREATE INDEX "detections_tenant_idx"          ON "detections"("tenant_id");
CREATE INDEX "detections_is_global_idx"       ON "detections"("is_global");
CREATE INDEX "tenant_detections_tenant_idx"   ON "tenant_detections"("tenant_id","is_enabled");
CREATE INDEX "detection_stats_tenant_det_idx" ON "detection_stats"("tenant_id","detection_id");
CREATE INDEX "detection_stats_tenant_date_idx"ON "detection_stats"("tenant_id","date");

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER detections_updated_at
  BEFORE UPDATE ON "detections"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
--  100 GLOBAL SEED DETECTIONS
--  Columns: rule_id, name, description, severity, platform,
--           mitre_attack_id, mitre_tactic, mitre_technique,
--           nist_controls, data_sources, query, query_language,
--           tags, expected_alerts_per_day, expected_fp_rate,
--           expected_mttd_hours, is_global, tenant_id
-- ============================================================

INSERT INTO "detections" (
  "rule_id","name","description","severity","platform",
  "mitre_attack_id","mitre_tactic","mitre_technique",
  "nist_controls","data_sources","query","query_language","tags",
  "expected_alerts_per_day","expected_fp_rate","expected_mttd_hours",
  "is_global","tenant_id"
) VALUES

-- ══════════════════════════════════════════════════════════════
--  SPLUNK  (SPL)  — DET-0001 to DET-0020
-- ══════════════════════════════════════════════════════════════

('DET-0001','PowerShell Encoded Command Execution',
 'Detects PowerShell launched with encoded command arguments (-EncodedCommand, -enc, -ec). Primary obfuscation technique used by malware loaders, ransomware stagers, and post-exploitation frameworks including Cobalt Strike and Empire.',
 'HIGH','SPLUNK','T1059.001','Execution','Command and Scripting Interpreter: PowerShell',
 ARRAY['SI-3','SI-4','AU-2'],
 ARRAY['Windows Security Event Logs (4688)','Sysmon (Event ID 1)'],
 'index=windows EventCode=4688 NewProcessName="*\powershell.exe"
  CommandLine IN ("*-EncodedCommand*","*-enc *","*-ec *","*-E *")
| eval decoded=base64decode(replace(CommandLine,".*-(EncodedCommand|enc|ec|E) ([A-Za-z0-9+/=]+).*","\2"))
| where len(decoded) > 0
| table _time, host, user, ParentProcessName, CommandLine, decoded
| sort -_time',
 'SPL',ARRAY['powershell','obfuscation','execution','windows'],3.2,12.0,1.8,TRUE,NULL),

('DET-0002','Pass-the-Hash NTLM Authentication',
 'Detects lateral movement via pass-the-hash by identifying NTLM authentications where a user logs on without an interactive session. Indicative of credential reuse attacks from Mimikatz or Impacket.',
 'HIGH','SPLUNK','T1550.002','Lateral Movement','Use Alternate Authentication Material: Pass the Hash',
 ARRAY['IA-2','AC-17','AU-2'],
 ARRAY['Windows Security Event Logs (4624)','Windows Security Event Logs (4625)'],
 'index=windows EventCode=4624 Logon_Type=3 Authentication_Package=NTLM
  [search index=windows EventCode=4624 Logon_Type=3 NOT Workstation_Name="-"]
| stats count by src_ip, user, dest, _time
| where count > 5
| sort -count',
 'SPL',ARRAY['lateral-movement','ntlm','pass-the-hash','credential'],1.5,8.0,2.4,TRUE,NULL),

('DET-0003','LSASS Memory Dump via Known Tools',
 'Detects attempts to dump LSASS process memory using known credential harvesting tools such as Mimikatz, ProcDump, or Task Manager. These attacks extract plaintext passwords and NTLM hashes.',
 'CRITICAL','SPLUNK','T1003.001','Credential Access','OS Credential Dumping: LSASS Memory',
 ARRAY['IA-5','SI-3','AU-2'],
 ARRAY['Sysmon (Event ID 10)','Windows Security Event Logs (4656)'],
 'index=windows EventCode=10 TargetImage="*\\lsass.exe"
  GrantedAccess IN ("0x1010","0x1410","0x1fffff","0x1f1fff","0x1038","0x40","0x1438")
| eval tool=case(match(SourceImage,"procdump"),"ProcDump",match(SourceImage,"mimikatz"),"Mimikatz",1=1,"Unknown")
| stats count by _time, host, SourceImage, tool
| sort -_time',
 'SPL',ARRAY['credential-dumping','lsass','mimikatz','procdump'],0.8,5.0,0.5,TRUE,NULL),

('DET-0004','Scheduled Task Created via Schtasks',
 'Detects persistence mechanism via scheduled task creation using schtasks.exe or at.exe. Adversaries use scheduled tasks to maintain access and execute malicious payloads at set intervals.',
 'MEDIUM','SPLUNK','T1053.005','Persistence','Scheduled Task/Job: Scheduled Task',
 ARRAY['CM-7','SI-3','AU-12'],
 ARRAY['Windows Security Event Logs (4698)','Sysmon (Event ID 1)'],
 'index=windows EventCode=4698
| rex field=Task_Content "<Command>(?P<command>[^<]+)</Command>"
| where NOT match(command,"(?i)^(C:\\\\Windows\\\\System32|C:\\\\Program Files)")
| table _time, host, user, Task_Name, command
| sort -_time',
 'SPL',ARRAY['persistence','scheduled-task','windows'],4.1,18.0,3.0,TRUE,NULL),

('DET-0005','WMI Remote Command Execution',
 'Detects remote command execution via Windows Management Instrumentation. Adversaries use WMI for lateral movement, execution, and persistence due to its legitimate administrative use and limited logging.',
 'HIGH','SPLUNK','T1047','Execution','Windows Management Instrumentation',
 ARRAY['CM-7','SI-3','AU-12'],
 ARRAY['Sysmon (Event ID 1)','WMI Activity Event Logs (5857-5861)'],
 'index=windows EventCode=4688 ParentProcessName="*\\WmiPrvSE.exe"
  NOT (NewProcessName IN ("*\\msiexec.exe","*\\TrustedInstaller.exe"))
| stats count by _time, host, user, NewProcessName, CommandLine
| where count >= 1
| sort -_time',
 'SPL',ARRAY['wmi','lateral-movement','execution','windows'],2.3,14.0,2.0,TRUE,NULL),

('DET-0006','Registry Run Key Persistence',
 'Detects modifications to common Windows Registry Run keys used for persistence. Malware frequently adds entries to HKCU or HKLM Run keys to survive reboots.',
 'MEDIUM','SPLUNK','T1547.001','Persistence','Boot or Logon Autostart Execution: Registry Run Keys',
 ARRAY['CM-7','SI-3','AU-12'],
 ARRAY['Sysmon (Event ID 13)','Windows Registry Logs'],
 'index=windows EventCode=13 TargetObject IN
  ("*\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run*",
   "*\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce*",
   "*\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run*")
| where NOT match(Details,"(?i)(OneDrive|Teams|Dropbox|Chrome|Edge|Discord)")
| table _time, host, user, TargetObject, Details
| sort -_time',
 'SPL',ARRAY['persistence','registry','autostart','windows'],6.5,22.0,4.0,TRUE,NULL),

('DET-0007','Certutil Decode or Download (LOLBAS)',
 'Detects abuse of certutil.exe to download files or decode base64 content. A common living-off-the-land technique to download second-stage payloads while bypassing application allowlisting.',
 'HIGH','SPLUNK','T1105','Command and Control','Ingress Tool Transfer',
 ARRAY['CM-7','SI-3','SC-7'],
 ARRAY['Sysmon (Event ID 1)','Windows Security Event Logs (4688)'],
 'index=windows EventCode=4688 NewProcessName="*\\certutil.exe"
  CommandLine IN ("*-decode*","*-decodehex*","*-urlcache*","-f *http*")
| table _time, host, user, CommandLine
| sort -_time',
 'SPL',ARRAY['lolbas','certutil','download','defense-evasion'],1.2,10.0,1.5,TRUE,NULL),

('DET-0008','Brute Force Login Failures',
 'Detects brute-force password spraying by identifying multiple consecutive authentication failures from a single source, followed by a successful logon. Threshold-based detection tuned for low false positives.',
 'MEDIUM','SPLUNK','T1110.001','Credential Access','Brute Force: Password Guessing',
 ARRAY['AC-7','IA-5','AU-2'],
 ARRAY['Windows Security Event Logs (4625)','Windows Security Event Logs (4624)'],
 'index=windows EventCode=4625
| bucket _time span=5m
| stats count as failures by _time, src_ip, TargetUserName
| where failures >= 10
| join src_ip [search index=windows EventCode=4624]
| table _time, src_ip, TargetUserName, failures
| sort -failures',
 'SPL',ARRAY['brute-force','credential-access','authentication'],8.2,25.0,0.3,TRUE,NULL),

('DET-0009','Kerberoasting Attack Detection',
 'Detects Kerberoasting by identifying requests for Kerberos service tickets using RC4 encryption (Type 0x17), which is the preferred algorithm for offline cracking of service account passwords.',
 'HIGH','SPLUNK','T1558.003','Credential Access','Steal or Forge Kerberos Tickets: Kerberoasting',
 ARRAY['IA-5','AU-2','SC-8'],
 ARRAY['Windows Security Event Logs (4769)'],
 'index=windows EventCode=4769 Ticket_Encryption_Type=0x17
  Service_Name!="krbtgt" Service_Name!="$*"
| stats count by _time, src_ip, Account_Name, Service_Name
| where count > 3
| sort -count',
 'SPL',ARRAY['kerberoasting','kerberos','credential-access','active-directory'],0.5,4.0,0.8,TRUE,NULL),

('DET-0010','Suspicious PowerShell Download Cradle',
 'Detects PowerShell downloading and executing code in memory via common download cradle patterns including Net.WebClient, Invoke-Expression, and Start-BitsTransfer. Commonly used in fileless malware attacks.',
 'HIGH','SPLUNK','T1059.001','Execution','Command and Scripting Interpreter: PowerShell',
 ARRAY['SI-3','SI-4','CM-7'],
 ARRAY['Sysmon (Event ID 1)','PowerShell Script Block Logging (4104)'],
 'index=windows source="WinEventLog:Microsoft-Windows-PowerShell/Operational" EventCode=4104
  ScriptBlockText IN ("*Net.WebClient*","*DownloadString*","*DownloadFile*","*IEX*","*Invoke-Expression*")
  ScriptBlockText IN ("*http://*","*https://*","*ftp://*")
| stats count by _time, host, UserID, ScriptBlockText
| sort -_time',
 'SPL',ARRAY['powershell','download-cradle','fileless','execution'],2.8,15.0,1.2,TRUE,NULL),

('DET-0011','DNS Tunneling Detection',
 'Detects DNS tunneling by identifying abnormally long DNS query strings or unusually high query volumes to a single domain, which are hallmarks of C2 communication or data exfiltration over DNS.',
 'HIGH','SPLUNK','T1071.004','Command and Control','Application Layer Protocol: DNS',
 ARRAY['SC-7','SI-4','AU-12'],
 ARRAY['DNS Server Logs','Network Traffic (PCAP/Flow)'],
 'index=dns
| eval query_len=len(query)
| where query_len > 50
| stats count, avg(query_len) as avg_len, values(query) as queries by src_ip, answer
| where count > 100 OR avg_len > 80
| sort -count',
 'SPL',ARRAY['dns-tunneling','c2','exfiltration','network'],1.0,8.0,3.5,TRUE,NULL),

('DET-0012','PsExec Lateral Movement',
 'Detects PsExec usage for lateral movement by identifying the creation of the PSEXESVC service and associated named pipe. PsExec is frequently used by attackers and red teamers for remote code execution.',
 'HIGH','SPLUNK','T1570','Lateral Movement','Lateral Tool Transfer',
 ARRAY['AC-17','SI-3','AU-12'],
 ARRAY['Windows Security Event Logs (7045)','Sysmon (Event ID 17,18)'],
 'index=windows EventCode=7045 Service_Name=PSEXESVC
| join host [search index=windows EventCode=5145 Share_Name="\\\\*\\IPC$" Object_Name="PSEXESVC"]
| stats count by _time, host, user, Service_File_Name
| sort -_time',
 'SPL',ARRAY['psexec','lateral-movement','remote-execution'],0.3,3.0,0.5,TRUE,NULL),

('DET-0013','Shadow Copy Deletion',
 'Detects deletion of Volume Shadow Copies via vssadmin, wmic, or PowerShell, a primary indicator of ransomware preparing to encrypt files by removing recovery options.',
 'CRITICAL','SPLUNK','T1490','Impact','Inhibit System Recovery',
 ARRAY['CP-9','CP-10','SI-3'],
 ARRAY['Windows Security Event Logs (4688)','Sysmon (Event ID 1)'],
 'index=windows EventCode=4688
  (NewProcessName="*\\vssadmin.exe" CommandLine="*delete shadows*")
  OR (NewProcessName="*\\wmic.exe" CommandLine="*shadowcopy delete*")
  OR (NewProcessName="*\\powershell.exe" CommandLine="*Win32_ShadowCopy*Delete*")
| table _time, host, user, NewProcessName, CommandLine
| sort -_time',
 'SPL',ARRAY['ransomware','shadow-copy','impact','defense-evasion'],0.1,1.0,0.2,TRUE,NULL),

('DET-0014','Kerberos Golden Ticket Usage',
 'Detects potential Golden Ticket attacks by identifying anomalous Kerberos TGT requests with abnormal encryption types or ticket lifetimes that deviate from domain policy defaults.',
 'CRITICAL','SPLUNK','T1558.001','Credential Access','Steal or Forge Kerberos Tickets: Golden Ticket',
 ARRAY['IA-5','AC-6','AU-2'],
 ARRAY['Windows Security Event Logs (4768)','Windows Security Event Logs (4769)'],
 'index=windows EventCode=4768 Ticket_Encryption_Type=0x17
  NOT Account_Name="*$"
| stats count by _time, Client_Address, Account_Name, Service_Name
| eventstats avg(count) as avg_count
| where count > avg_count * 3
| sort -_time',
 'SPL',ARRAY['golden-ticket','kerberos','credential-access','domain'],0.2,3.0,1.0,TRUE,NULL),

('DET-0015','New Local Administrator Account Created',
 'Detects creation of new local administrator accounts, which adversaries use to establish persistence or enable lateral movement. Excludes known service account patterns.',
 'MEDIUM','SPLUNK','T1136.001','Persistence','Create Account: Local Account',
 ARRAY['AC-2','IA-4','AU-12'],
 ARRAY['Windows Security Event Logs (4720)','Windows Security Event Logs (4732)'],
 'index=windows (EventCode=4720 OR EventCode=4732)
| eval event_type=if(EventCode=4720,"Account Created","Added to Group")
| where EventCode=4732 Group_Name="Administrators"
| stats count by _time, host, user, TargetUserName, event_type
| sort -_time',
 'SPL',ARRAY['persistence','account-creation','local-admin','windows'],1.5,12.0,2.0,TRUE,NULL),

('DET-0016','BITS Job Abuse for Persistence',
 'Detects abuse of Background Intelligent Transfer Service (BITS) jobs to download and execute malware. BITS is a legitimate Windows component frequently abused for stealthy persistence and payload delivery.',
 'MEDIUM','SPLUNK','T1197','Defense Evasion','BITS Jobs',
 ARRAY['CM-7','SI-3','AU-12'],
 ARRAY['Windows BITS Event Logs (Microsoft-Windows-Bits-Client)','Sysmon (Event ID 1)'],
 'index=windows source="WinEventLog:Microsoft-Windows-Bits-Client/Operational"
  EventCode IN (16403,59)
| rex field=url "(?P<domain>[^/]+)"
| where NOT match(domain,"(?i)(microsoft|windows|windowsupdate|adobe|mcafee)")
| table _time, host, url, RemoteUrl, LocalFile
| sort -_time',
 'SPL',ARRAY['bits','persistence','defense-evasion','download'],0.8,10.0,2.5,TRUE,NULL),

('DET-0017','UAC Bypass via Registry Modification',
 'Detects User Account Control bypass techniques that manipulate registry keys to elevate privileges without a UAC prompt. Covers common bypass methods including fodhelper, eventvwr, and sdclt abuse.',
 'HIGH','SPLUNK','T1548.002','Privilege Escalation','Abuse Elevation Control Mechanism: Bypass User Account Control',
 ARRAY['AC-6','CM-7','AU-12'],
 ARRAY['Sysmon (Event ID 13)','Windows Security Event Logs (4688)'],
 'index=windows EventCode=13
  TargetObject IN ("*\\ms-settings\\shell\\open\\command*","*\\Mscfile\\shell\\open\\command*","*\\Classes\\exefile\\shell\\open\\command*")
| join host [search index=windows EventCode=4688 NewProcessName IN ("*\\fodhelper.exe","*\\eventvwr.exe","*\\sdclt.exe")]
| table _time, host, user, TargetObject, Details
| sort -_time',
 'SPL',ARRAY['uac-bypass','privilege-escalation','registry','windows'],0.5,6.0,1.0,TRUE,NULL),

('DET-0018','Windows Defender Tampered',
 'Detects attempts to disable, modify, or tamper with Windows Defender via registry changes, PowerShell commands, or known tamper techniques. A prerequisite for many modern malware families.',
 'HIGH','SPLUNK','T1562.001','Defense Evasion','Impair Defenses: Disable or Modify Tools',
 ARRAY['SI-3','CM-7','AU-12'],
 ARRAY['Sysmon (Event ID 13)','Windows Security Event Logs (4688)'],
 'index=windows
  (EventCode=4688 NewProcessName="*\\powershell.exe"
    CommandLine IN ("*Set-MpPreference*DisableRealtimeMonitoring*","*Add-MpPreference*ExclusionPath*"))
  OR (EventCode=13 TargetObject="*\\Windows Defender\\Real-Time Protection\\DisableRealtimeMonitoring*" Details="DWORD (0x00000001)")
| table _time, host, user, EventCode, CommandLine, TargetObject
| sort -_time',
 'SPL',ARRAY['defender','antivirus-tamper','defense-evasion','windows'],0.6,5.0,0.8,TRUE,NULL),

('DET-0019','Lateral Movement via SMB Admin Shares',
 'Detects lateral movement by identifying connections to administrative SMB shares (C$, ADMIN$, IPC$) from unusual sources, commonly used by attackers to move through networks or deploy tools.',
 'MEDIUM','SPLUNK','T1021.002','Lateral Movement','Remote Services: SMB/Windows Admin Shares',
 ARRAY['AC-17','SC-7','AU-12'],
 ARRAY['Windows Security Event Logs (5140)','Windows Security Event Logs (5145)'],
 'index=windows EventCode=5140 Share_Name IN ("\\\\*\\C$","\\\\*\\ADMIN$","\\\\*\\IPC$")
| stats count, values(Object_Name) as objects by src_ip, user, host, Share_Name
| where count > 10
| sort -count',
 'SPL',ARRAY['lateral-movement','smb','admin-shares','windows'],3.0,20.0,2.5,TRUE,NULL),

('DET-0020','Suspicious Parent-Child Process Relationship',
 'Detects anomalous parent-child process relationships that are commonly observed in exploitation and malware execution. Examples include Office spawning cmd.exe or a browser spawning PowerShell.',
 'HIGH','SPLUNK','T1055','Defense Evasion','Process Injection',
 ARRAY['SI-3','CM-7','AU-2'],
 ARRAY['Sysmon (Event ID 1)','Windows Security Event Logs (4688)'],
 'index=windows EventCode=4688
  (ParentProcessName IN ("*\\winword.exe","*\\excel.exe","*\\powerpnt.exe","*\\outlook.exe")
   AND NewProcessName IN ("*\\cmd.exe","*\\powershell.exe","*\\wscript.exe","*\\cscript.exe","*\\mshta.exe"))
  OR (ParentProcessName IN ("*\\chrome.exe","*\\firefox.exe","*\\msedge.exe")
   AND NewProcessName IN ("*\\powershell.exe","*\\cmd.exe","*\\regsvr32.exe"))
| table _time, host, user, ParentProcessName, NewProcessName, CommandLine
| sort -_time',
 'SPL',ARRAY['process-injection','defense-evasion','office-macro','windows'],2.0,10.0,1.5,TRUE,NULL),

-- ══════════════════════════════════════════════════════════════
--  MICROSOFT SENTINEL  (KQL)  — DET-0021 to DET-0040
-- ══════════════════════════════════════════════════════════════

('DET-0021','Azure AD Impossible Travel Sign-in',
 'Detects sign-in events from geographically impossible locations — where travel between two sign-in locations would require exceeding physically possible speeds. Strong indicator of credential compromise.',
 'HIGH','SENTINEL','T1078','Initial Access','Valid Accounts',
 ARRAY['AC-2','IA-5','AU-2'],
 ARRAY['Azure AD Sign-in Logs','Microsoft Entra ID Protection'],
 'SigninLogs
| where ResultType == 0
| project TimeGenerated, UserPrincipalName, Location, IPAddress, RiskLevelDuringSignIn
| order by UserPrincipalName, TimeGenerated asc
| serialize prev_location=prev(Location), prev_time=prev(TimeGenerated), prev_user=prev(UserPrincipalName)
| where UserPrincipalName == prev_user and Location != prev_location
| where datetime_diff("hour", TimeGenerated, prev_time) < 3
| project TimeGenerated, UserPrincipalName, Location, prev_location, IPAddress',
 'KQL',ARRAY['impossible-travel','credential-compromise','azure-ad','identity'],0.4,5.0,0.5,TRUE,NULL),

('DET-0022','Mass Mailbox Delete or Purge Operation',
 'Detects bulk email deletion or purge operations in Exchange Online that may indicate an insider threat, compromised account covering tracks, or destructive attack against email data.',
 'HIGH','SENTINEL','T1070','Defense Evasion','Indicator Removal',
 ARRAY['AU-9','SI-12','AC-2'],
 ARRAY['Office 365 Unified Audit Logs','Exchange Online Audit Logs'],
 'OfficeActivity
| where OfficeWorkload == "Exchange"
| where Operation in ("HardDelete","MoveToDeletedItems","SoftDelete")
| summarize DeleteCount=count() by UserId, bin(TimeGenerated, 5m)
| where DeleteCount > 50
| project TimeGenerated, UserId, DeleteCount
| order by DeleteCount desc',
 'KQL',ARRAY['email-deletion','insider-threat','defense-evasion','exchange'],0.2,4.0,1.0,TRUE,NULL),

('DET-0023','Azure AD Password Spray Attack',
 'Detects password spray attacks against Azure AD by identifying a single source attempting authentication against many distinct user accounts within a short time window with consistent failure codes.',
 'HIGH','SENTINEL','T1110.003','Credential Access','Brute Force: Password Spraying',
 ARRAY['AC-7','IA-5','AU-2'],
 ARRAY['Azure AD Sign-in Logs'],
 'SigninLogs
| where ResultType in ("50126","50056","50064","70043")
| summarize DistinctUsers=dcount(UserPrincipalName), AttemptCount=count() by IPAddress, bin(TimeGenerated, 10m)
| where DistinctUsers > 10
| project TimeGenerated, IPAddress, DistinctUsers, AttemptCount
| order by DistinctUsers desc',
 'KQL',ARRAY['password-spray','credential-access','azure-ad','brute-force'],0.8,8.0,0.4,TRUE,NULL),

('DET-0024','Privileged Azure AD Role Assigned',
 'Detects assignment of highly privileged Azure AD roles including Global Administrator, Privileged Role Administrator, and Security Administrator, which grant extensive control over the tenant.',
 'HIGH','SENTINEL','T1098.003','Persistence','Account Manipulation: Additional Cloud Roles',
 ARRAY['AC-6','AC-2','AU-12'],
 ARRAY['Azure AD Audit Logs'],
 'AuditLogs
| where OperationName == "Add member to role"
| extend RoleName = tostring(TargetResources[0].displayName)
| where RoleName in ("Global Administrator","Privileged Role Administrator","Security Administrator","Exchange Administrator","SharePoint Administrator")
| extend AssignedBy = tostring(InitiatedBy.user.userPrincipalName)
| extend AssignedTo = tostring(TargetResources[1].userPrincipalName)
| project TimeGenerated, AssignedBy, AssignedTo, RoleName',
 'KQL',ARRAY['privilege-escalation','azure-ad','role-assignment','persistence'],0.3,3.0,1.0,TRUE,NULL),

('DET-0025','External Email Forwarding Rule Created',
 'Detects creation of email forwarding rules that redirect mail to external addresses, a common technique used by Business Email Compromise (BEC) attackers to silently harvest email communications.',
 'HIGH','SENTINEL','T1114.003','Collection','Email Collection: Email Forwarding Rule',
 ARRAY['AC-4','AU-12','SI-12'],
 ARRAY['Office 365 Unified Audit Logs','Exchange Online Audit Logs'],
 'OfficeActivity
| where Operation in ("New-InboxRule","Set-InboxRule")
| where Parameters has_any ("ForwardTo","RedirectTo","ForwardAsAttachmentTo")
| extend ForwardDest = extract("(ForwardTo|RedirectTo).*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})", 2, Parameters)
| where ForwardDest !endswith toscalar(AzureActivity | take 1 | project TenantId)
| project TimeGenerated, UserId, Operation, ForwardDest, ClientIP',
 'KQL',ARRAY['bec','email-forwarding','collection','exchange'],0.2,3.0,2.0,TRUE,NULL),

('DET-0026','MFA Disabled or Reset for User',
 'Detects when multi-factor authentication is disabled or MFA methods are deleted for a user account, a common step attackers take after compromising an admin account to maintain persistent access.',
 'CRITICAL','SENTINEL','T1556','Credential Access','Modify Authentication Process',
 ARRAY['IA-5','AC-6','AU-12'],
 ARRAY['Azure AD Audit Logs'],
 'AuditLogs
| where OperationName in ("Delete authentication method for user","Update user","Disable strong authentication")
| extend ModifiedBy = tostring(InitiatedBy.user.userPrincipalName)
| extend ModifiedUser = tostring(TargetResources[0].userPrincipalName)
| where ModifiedBy != ModifiedUser
| project TimeGenerated, ModifiedBy, ModifiedUser, OperationName, CorrelationId',
 'KQL',ARRAY['mfa-disabled','credential-access','identity','azure-ad'],0.1,2.0,0.3,TRUE,NULL),

('DET-0027','OAuth Application Consent Granted by User',
 'Detects user-level OAuth 2.0 application consent grants that may indicate illicit consent phishing, where attackers trick users into granting permissions to malicious applications to access Microsoft 365 data.',
 'MEDIUM','SENTINEL','T1528','Credential Access','Steal Application Access Token',
 ARRAY['AC-3','IA-5','AU-12'],
 ARRAY['Azure AD Audit Logs'],
 'AuditLogs
| where OperationName == "Consent to application"
| extend AppName = tostring(TargetResources[0].displayName)
| extend ConsentedBy = tostring(InitiatedBy.user.userPrincipalName)
| extend Permissions = tostring(TargetResources[0].modifiedProperties)
| where Permissions has_any ("Mail.Read","Mail.ReadWrite","Files.ReadWrite.All","Contacts.Read")
| project TimeGenerated, ConsentedBy, AppName, Permissions',
 'KQL',ARRAY['oauth','consent-phishing','credential-access','m365'],0.5,8.0,2.0,TRUE,NULL),

('DET-0028','SharePoint Mass File Download',
 'Detects mass file download events from SharePoint Online that may indicate data exfiltration, an insider threat, or a compromised account performing bulk data collection before departure or ransom.',
 'HIGH','SENTINEL','T1039','Collection','Data from Network Shared Drive',
 ARRAY['AC-4','AU-12','SI-12'],
 ARRAY['Office 365 Unified Audit Logs','SharePoint Audit Logs'],
 'OfficeActivity
| where OfficeWorkload == "SharePoint"
| where Operation in ("FileDownloaded","FileSyncDownloadedFull")
| summarize DownloadCount=count(), Sites=dcount(SiteUrl), Files=make_set(SourceFileName, 20) by UserId, bin(TimeGenerated, 1h)
| where DownloadCount > 100
| project TimeGenerated, UserId, DownloadCount, Sites
| order by DownloadCount desc',
 'KQL',ARRAY['data-exfiltration','sharepoint','collection','insider-threat'],0.4,7.0,1.5,TRUE,NULL),

('DET-0029','Conditional Access Policy Deleted or Disabled',
 'Detects deletion or disabling of Conditional Access policies, which control access requirements like MFA and compliant devices. Attackers disable these to facilitate persistent access without restrictions.',
 'CRITICAL','SENTINEL','T1556','Defense Evasion','Modify Authentication Process',
 ARRAY['AC-3','IA-5','CM-7'],
 ARRAY['Azure AD Audit Logs'],
 'AuditLogs
| where OperationName in ("Delete conditional access policy","Update conditional access policy")
| extend PolicyName = tostring(TargetResources[0].displayName)
| extend ModifiedBy = tostring(InitiatedBy.user.userPrincipalName)
| extend Changes = tostring(TargetResources[0].modifiedProperties)
| where Changes has "state" and Changes has "disabled"
| project TimeGenerated, ModifiedBy, PolicyName, OperationName',
 'KQL',ARRAY['conditional-access','defense-evasion','azure-ad','persistence'],0.05,1.0,0.2,TRUE,NULL),

('DET-0030','Azure Storage Blob Public Access Enabled',
 'Detects when Azure Storage container or blob public access is enabled, which can expose sensitive data to the internet. Often exploited by attackers to exfiltrate or publicly leak data.',
 'MEDIUM','SENTINEL','T1530','Exfiltration','Data from Cloud Storage',
 ARRAY['SC-7','AC-3','AU-12'],
 ARRAY['Azure Activity Logs','Azure Storage Diagnostic Logs'],
 'AzureActivity
| where OperationNameValue has_any ("storageAccounts/blobServices/containers/write","storageAccounts/write")
| where Properties has "allowBlobPublicAccess" and Properties has "true"
| extend CallerIpAddress, Caller
| project TimeGenerated, Caller, CallerIpAddress, ResourceGroup, Resource, Properties',
 'KQL',ARRAY['cloud-storage','public-access','exfiltration','azure'],0.3,6.0,2.0,TRUE,NULL),

('DET-0031','New Application Service Principal with Credentials',
 'Detects creation of new Azure AD application registrations with passwords or certificates added, which can be used as persistent backdoors surviving user account remediation.',
 'HIGH','SENTINEL','T1550.001','Defense Evasion','Use Alternate Authentication Material: Application Access Token',
 ARRAY['AC-2','IA-4','AU-12'],
 ARRAY['Azure AD Audit Logs'],
 'AuditLogs
| where OperationName in ("Add service principal credentials","Add password to application","Add certificate to application")
| extend AppName = tostring(TargetResources[0].displayName)
| extend AddedBy = tostring(InitiatedBy.user.userPrincipalName)
| extend CredType = iif(OperationName has "certificate","Certificate","Password")
| project TimeGenerated, AddedBy, AppName, CredType, CorrelationId',
 'KQL',ARRAY['service-principal','persistence','azure-ad','credential'],0.3,5.0,1.5,TRUE,NULL),

('DET-0032','Privileged User Sign-in from New Country',
 'Detects sign-ins from privileged Azure AD roles (Global Admin, Security Admin) originating from countries not previously seen in the user''s sign-in history, indicating potential account takeover.',
 'CRITICAL','SENTINEL','T1078.004','Initial Access','Valid Accounts: Cloud Accounts',
 ARRAY['AC-2','IA-5','AU-2'],
 ARRAY['Azure AD Sign-in Logs','Azure AD Audit Logs'],
 'let PrivilegedRoles = dynamic(["Global Administrator","Security Administrator","Privileged Role Administrator"]);
SigninLogs
| where ResultType == 0
| where ConditionalAccessStatus != "success" or RiskLevelDuringSignIn in ("high","medium")
| lookup kind=inner (IdentityInfo | where AssignedRoles has_any (PrivilegedRoles) | project UserPrincipalName) on UserPrincipalName
| summarize Countries=make_set(Location), LastSeen=max(TimeGenerated) by UserPrincipalName
| where array_length(Countries) > 1',
 'KQL',ARRAY['privileged-access','identity','azure-ad','geolocation'],0.1,2.0,0.5,TRUE,NULL),

('DET-0033','Exchange Transport Rule Created for Exfiltration',
 'Detects creation of Exchange mail transport rules that may copy, redirect, or forward email to external addresses at the transport layer, bypassing user-level inbox rule monitoring.',
 'HIGH','SENTINEL','T1114.003','Collection','Email Collection: Email Forwarding Rule',
 ARRAY['AC-4','AU-12','CM-7'],
 ARRAY['Office 365 Unified Audit Logs'],
 'OfficeActivity
| where Operation == "New-TransportRule" or Operation == "Set-TransportRule"
| where Parameters has_any ("BlindCopyTo","RedirectMessageTo","CopyTo","AddToRecipients")
| extend RuleName = extract("Name (.+?)(?:,|$)", 1, Parameters)
| extend CreatedBy = UserId
| project TimeGenerated, CreatedBy, Operation, RuleName, Parameters, ClientIP',
 'KQL',ARRAY['email-exfiltration','transport-rule','collection','exchange'],0.1,2.0,1.0,TRUE,NULL),

('DET-0034','Azure VM or Resource Export / Snapshot',
 'Detects creation of disk snapshots, managed disk exports, or VHD exports from Azure VMs, which can be used to extract data including OS credentials and application secrets from virtual machines.',
 'HIGH','SENTINEL','T1537','Exfiltration','Transfer Data to Cloud Account',
 ARRAY['SC-7','AU-12','AC-3'],
 ARRAY['Azure Activity Logs'],
 'AzureActivity
| where OperationNameValue in ("Microsoft.Compute/snapshots/write","Microsoft.Compute/disks/beginGetAccess/action","Microsoft.Compute/images/write")
| extend CallerUPN = Caller
| extend ResourceName = tostring(parse_json(Properties).resource)
| project TimeGenerated, CallerUPN, CallerIpAddress, ResourceGroup, OperationNameValue, ResourceName',
 'KQL',ARRAY['vm-snapshot','exfiltration','azure','data-theft'],0.2,4.0,2.0,TRUE,NULL),

('DET-0035','Microsoft Defender Alert Suppression Rule Created',
 'Detects creation of alert suppression rules in Microsoft Defender XDR or Defender for Endpoint, which can be abused by adversaries to suppress detection of their own tools and techniques.',
 'HIGH','SENTINEL','T1562','Defense Evasion','Impair Defenses',
 ARRAY['SI-3','CM-7','AU-12'],
 ARRAY['Microsoft Defender XDR Logs','Azure AD Audit Logs'],
 'CloudAppEvents
| where ActionType == "AlertSuppressionRuleCreated" or ActionType == "AntivirusExclusionAdded"
| extend Actor = tostring(RawEventData.UserId)
| extend RuleName = tostring(RawEventData.Name)
| extend Criteria = tostring(RawEventData.Criteria)
| project TimeGenerated, Actor, ActionType, RuleName, Criteria, IPAddress',
 'KQL',ARRAY['defender-tamper','alert-suppression','defense-evasion','m365'],0.1,2.0,0.5,TRUE,NULL),

('DET-0036','Entra ID - Guest Account Mass Invitation',
 'Detects bulk external guest user invitations in Azure AD, which can be used to establish external persistence or enumerate tenant resources from attacker-controlled external accounts.',
 'MEDIUM','SENTINEL','T1136.003','Persistence','Create Account: Cloud Account',
 ARRAY['AC-2','IA-4','AU-12'],
 ARRAY['Azure AD Audit Logs'],
 'AuditLogs
| where OperationName == "Invite external user"
| extend InvitedBy = tostring(InitiatedBy.user.userPrincipalName)
| extend InvitedEmail = tostring(TargetResources[0].userPrincipalName)
| summarize InviteCount=count(), Emails=make_set(InvitedEmail, 10) by InvitedBy, bin(TimeGenerated, 1h)
| where InviteCount > 5
| project TimeGenerated, InvitedBy, InviteCount, Emails',
 'KQL',ARRAY['guest-invite','persistence','azure-ad','account-creation'],0.5,12.0,2.0,TRUE,NULL),

('DET-0037','Azure Key Vault Secrets Mass Access',
 'Detects bulk access to Azure Key Vault secrets that may indicate secret harvesting by a compromised identity or malicious application attempting to collect credentials, certificates, and API keys.',
 'HIGH','SENTINEL','T1552.004','Credential Access','Unsecured Credentials: Private Keys',
 ARRAY['IA-5','SC-28','AU-12'],
 ARRAY['Azure Key Vault Diagnostic Logs','Azure Monitor Logs'],
 'AzureDiagnostics
| where ResourceType == "VAULTS" and Category == "AuditEvent"
| where OperationName in ("SecretGet","KeyGet","CertificateGet")
| where ResultType == "Success"
| summarize AccessCount=count(), SecretNames=make_set(id_s, 20) by CallerIPAddress, identity_claim_upn_s, bin(TimeGenerated, 5m)
| where AccessCount > 10
| project TimeGenerated, identity_claim_upn_s, CallerIPAddress, AccessCount',
 'KQL',ARRAY['key-vault','credential-access','secret-harvesting','azure'],0.3,5.0,1.5,TRUE,NULL),

('DET-0038','New Federated Domain Added to Azure AD',
 'Detects addition of a new federated domain to Azure AD, a technique used to establish a persistent backdoor that allows attackers to generate valid authentication tokens for any user in the tenant.',
 'CRITICAL','SENTINEL','T1484.002','Defense Evasion','Domain or Tenant Policy Modification: Trust Modification',
 ARRAY['AC-3','IA-5','CM-7'],
 ARRAY['Azure AD Audit Logs'],
 'AuditLogs
| where OperationName in ("Set domain authentication","Add domain to company")
| extend DomainName = tostring(TargetResources[0].displayName)
| extend ModifiedBy = tostring(InitiatedBy.user.userPrincipalName)
| extend AuthType = tostring(TargetResources[0].modifiedProperties[0].newValue)
| project TimeGenerated, ModifiedBy, DomainName, AuthType, CorrelationId',
 'KQL',ARRAY['federation','persistence','golden-saml','azure-ad'],0.01,0.5,0.2,TRUE,NULL),

('DET-0039','Teams External Access Enabled or Guest Policy Changed',
 'Detects changes to Microsoft Teams external access and guest policies that could allow uncontrolled external communication, data sharing, or enable external phishing channels.',
 'MEDIUM','SENTINEL','T1566','Initial Access','Phishing',
 ARRAY['AC-4','CM-7','AU-12'],
 ARRAY['Office 365 Unified Audit Logs'],
 'OfficeActivity
| where Operation in ("Set-CsExternalAccessPolicy","Set-CsTeamsGuestMessagingConfiguration","Set-CsTeamsClientConfiguration")
| where Parameters has_any ("AllowFederatedUsers $true","AllowPublicUsers $true","AllowGuestUser $true")
| extend ChangedBy = UserId
| project TimeGenerated, ChangedBy, Operation, Parameters, ClientIP',
 'KQL',ARRAY['teams','external-access','policy-change','m365'],0.1,3.0,2.0,TRUE,NULL),

('DET-0040','Azure Automation Runbook Modified or Created',
 'Detects creation or modification of Azure Automation runbooks, which execute with potentially elevated managed identity permissions and can be used for persistence, privilege escalation, or data access.',
 'MEDIUM','SENTINEL','T1059','Execution','Command and Scripting Interpreter',
 ARRAY['CM-7','AU-12','AC-6'],
 ARRAY['Azure Activity Logs','Azure Automation Diagnostic Logs'],
 'AzureActivity
| where OperationNameValue has "runbooks" and OperationNameValue has_any ("write","publish")
| extend Author = Caller
| extend RunbookName = tostring(parse_json(Properties).entity)
| project TimeGenerated, Author, CallerIpAddress, ResourceGroup, RunbookName, OperationNameValue',
 'KQL',ARRAY['automation','runbook','persistence','azure'],0.2,5.0,2.0,TRUE,NULL),

-- ══════════════════════════════════════════════════════════════
--  GOOGLE CHRONICLE  (YARA-L)  — DET-0041 to DET-0055
-- ══════════════════════════════════════════════════════════════

('DET-0041','C2 Beacon Jitter Pattern Detection',
 'Detects command-and-control beacon traffic by identifying periodic outbound connections with consistent intervals and small jitter, characteristic of automated C2 frameworks like Cobalt Strike or Sliver.',
 'HIGH','CHRONICLE','T1071.001','Command and Control','Application Layer Protocol: Web Protocols',
 ARRAY['SC-7','SI-4','AU-12'],
 ARRAY['Network Traffic Logs','DNS Logs','HTTP Proxy Logs'],
 'rule c2_beacon_jitter {
  meta: description = "C2 beacon jitter pattern"
  events:
    $e.metadata.event_type = "NETWORK_HTTP"
    $e.network.http.method = "GET"
    $e.network.sent_bytes < 1024
    $e.network.received_bytes < 4096
    $e.target.hostname != ""
  match: $e.target.hostname over 1h
  condition: #e > 20 and #e < 200
}',
 'YARA_L',ARRAY['c2','beacon','network','cobalt-strike'],1.5,10.0,2.0,TRUE,NULL),

('DET-0042','DNS Query to Known Threat Intelligence Domain',
 'Detects DNS queries to domains identified in threat intelligence feeds as malicious, including known C2 infrastructure, malware distribution sites, and phishing domains.',
 'HIGH','CHRONICLE','T1568','Command and Control','Dynamic Resolution',
 ARRAY['SC-7','SI-3','AU-12'],
 ARRAY['DNS Server Logs','Cloud DNS Audit Logs'],
 'rule dns_threat_intel {
  meta: description = "DNS query to malicious domain"
  events:
    $e.metadata.event_type = "NETWORK_DNS"
    $e.network.dns.questions.name = /\.(xyz|tk|pw|cc|top|gq)$/
    NOT $e.principal.ip in (cidr "10.0.0.0/8", cidr "172.16.0.0/12", cidr "192.168.0.0/16")
  match: $e.principal.ip over 10m
  condition: #e > 5
}',
 'YARA_L',ARRAY['dns','threat-intel','c2','network'],5.0,20.0,1.0,TRUE,NULL),

('DET-0043','Large HTTP POST Potential Exfiltration',
 'Detects potential data exfiltration via HTTP POST requests carrying unusually large payloads to external destinations, particularly to cloud storage or file sharing services not on the approved list.',
 'MEDIUM','CHRONICLE','T1048','Exfiltration','Exfiltration Over Alternative Protocol',
 ARRAY['SC-7','AC-4','AU-12'],
 ARRAY['HTTP Proxy Logs','Network Traffic Logs'],
 'rule large_http_post_exfil {
  meta: description = "Large HTTP POST possible exfiltration"
  events:
    $e.metadata.event_type = "NETWORK_HTTP"
    $e.network.http.method = "POST"
    $e.network.sent_bytes > 10000000
    NOT $e.target.hostname = /\.(internal|corp|company\.com)$/
  match: $e.principal.ip over 30m
  condition: #e > 3
}',
 'YARA_L',ARRAY['exfiltration','http-post','data-theft','network'],0.8,12.0,3.0,TRUE,NULL),

('DET-0044','Linux Process Injection via ptrace',
 'Detects process injection on Linux systems using ptrace system call, which allows one process to observe and control another. Used by attackers for code injection, debugging bypass, and privilege escalation.',
 'HIGH','CHRONICLE','T1055','Defense Evasion','Process Injection',
 ARRAY['SI-3','CM-7','AU-12'],
 ARRAY['Linux Audit Logs (auditd)','Sysdig Logs'],
 'rule linux_ptrace_injection {
  meta: description = "Process injection via ptrace"
  events:
    $e.metadata.event_type = "PROCESS_OPEN"
    $e.network.application_protocol = "PTRACE"
    NOT $e.principal.process.file.full_path = /\/(usr\/bin\/(gdb|strace|ltrace)|bin\/bash)/
  condition: $e
}',
 'YARA_L',ARRAY['process-injection','linux','ptrace','privilege-escalation'],0.3,4.0,1.0,TRUE,NULL),

('DET-0045','Suspicious Cron Job Added',
 'Detects addition of new cron jobs on Linux/Unix systems, particularly those executing scripts from world-writable directories or downloading content from the internet, indicating persistence.',
 'MEDIUM','CHRONICLE','T1053.003','Persistence','Scheduled Task/Job: Cron',
 ARRAY['CM-7','SI-3','AU-12'],
 ARRAY['Linux Audit Logs','File Integrity Monitoring'],
 'rule suspicious_cron_added {
  meta: description = "Suspicious cron job added"
  events:
    $e.metadata.event_type = "FILE_MODIFICATION"
    $e.target.file.full_path = /\/etc\/cron|\/var\/spool\/cron/
    NOT $e.principal.user.userid = "root"
  condition: $e
}',
 'YARA_L',ARRAY['cron','persistence','linux','scheduled-task'],0.5,8.0,3.0,TRUE,NULL),

('DET-0046','SSH Brute Force from External IP',
 'Detects SSH brute force attacks from external IP addresses by identifying multiple failed authentication attempts against SSH within a short time window, followed by optional successful login.',
 'MEDIUM','CHRONICLE','T1110.004','Credential Access','Brute Force: Credential Stuffing',
 ARRAY['AC-7','IA-5','SC-7'],
 ARRAY['Linux Auth Logs','SSH Server Logs','Cloud SIEM Logs'],
 'rule ssh_brute_force {
  meta: description = "SSH brute force from external"
  events:
    $fail.metadata.event_type = "USER_LOGIN"
    $fail.metadata.vendor_name = "SSH"
    $fail.security_result.action = "BLOCK"
    $fail.principal.ip != ""
    NOT $fail.principal.ip in (cidr "10.0.0.0/8", cidr "192.168.0.0/16")
  match: $fail.principal.ip over 5m
  condition: #fail > 15
}',
 'YARA_L',ARRAY['ssh','brute-force','credential-access','linux'],3.0,15.0,0.5,TRUE,NULL),

('DET-0047','Linux Sudo Privilege Escalation',
 'Detects potential privilege escalation via sudo on Linux systems, particularly commands that are commonly used to spawn root shells or execute arbitrary code as root using GTFOBins techniques.',
 'HIGH','CHRONICLE','T1548.003','Privilege Escalation','Abuse Elevation Control Mechanism: Sudo and Sudo Caching',
 ARRAY['AC-6','CM-7','AU-12'],
 ARRAY['Linux Audit Logs','sudo audit logs'],
 'rule sudo_privilege_escalation {
  meta: description = "Sudo GTFOBins privilege escalation"
  events:
    $e.metadata.event_type = "PROCESS_LAUNCH"
    $e.principal.process.command_line = /sudo .*(vim|nano|less|more|awk|perl|python|ruby|lua|bash|sh|find|nmap|nc|netcat)/
    $e.target.user.userid = "root"
  condition: $e
}',
 'YARA_L',ARRAY['sudo','privilege-escalation','linux','gtfobins'],0.5,6.0,1.0,TRUE,NULL),

('DET-0048','Reverse Shell via Common Interpreters',
 'Detects reverse shell attempts using common scripting interpreters including bash, Python, Perl, and netcat. These one-liner payloads are frequently delivered via web vulnerabilities or command injection.',
 'CRITICAL','CHRONICLE','T1059','Execution','Command and Scripting Interpreter',
 ARRAY['SC-7','SI-3','CM-7'],
 ARRAY['Linux Audit Logs','Process Execution Logs','EDR Telemetry'],
 'rule reverse_shell_common {
  meta: description = "Reverse shell via interpreter"
  events:
    $e.metadata.event_type = "PROCESS_LAUNCH"
    $e.principal.process.command_line = /\/(bash|sh|python|perl|ruby|nc|netcat).*(\/dev\/tcp|0\.0\.0\.0|\d+\.\d+\.\d+\.\d+).*&|>.*\/dev\/tcp/
  condition: $e
}',
 'YARA_L',ARRAY['reverse-shell','command-injection','linux','execution'],0.2,3.0,0.3,TRUE,NULL),

('DET-0049','GCP Storage Bucket IAM Policy Changed',
 'Detects changes to Google Cloud Storage bucket IAM policies, particularly granting allUsers or allAuthenticatedUsers access which would expose bucket contents publicly to the internet.',
 'HIGH','CHRONICLE','T1530','Exfiltration','Data from Cloud Storage',
 ARRAY['AC-3','SC-7','AU-12'],
 ARRAY['GCP Cloud Audit Logs','GCS Access Logs'],
 'rule gcs_bucket_public_access {
  meta: description = "GCS bucket made public"
  events:
    $e.metadata.event_type = "RESOURCE_PERMISSIONS_CHANGE"
    $e.target.resource.type = "storage.googleapis.com/Bucket"
    $e.network.http.request_url = /setIamPolicy/
    $e.security_result.description = /allUsers|allAuthenticatedUsers/
  condition: $e
}',
 'YARA_L',ARRAY['gcs','public-bucket','exfiltration','gcp'],0.1,2.0,0.5,TRUE,NULL),

('DET-0050','Kubernetes Privileged Pod Launched',
 'Detects creation of Kubernetes pods with privileged security contexts, host network, or host PID namespace access, which can be used to escape the container boundary and access the underlying node.',
 'HIGH','CHRONICLE','T1611','Privilege Escalation','Escape to Host',
 ARRAY['AC-6','CM-7','SI-3'],
 ARRAY['Kubernetes Audit Logs','GKE Audit Logs'],
 'rule k8s_privileged_pod {
  meta: description = "Kubernetes privileged pod creation"
  events:
    $e.metadata.event_type = "RESOURCE_CREATION"
    $e.target.resource.type = "k8s.io/Pod"
    $e.metadata.description = /privileged.*true|hostPID.*true|hostNetwork.*true/
    NOT $e.principal.user.userid = /system:serviceaccount:kube-system/
  condition: $e
}',
 'YARA_L',ARRAY['kubernetes','container-escape','privileged-pod','gcp'],0.2,4.0,1.0,TRUE,NULL),

('DET-0051','GCP Service Account Key Created',
 'Detects creation of new GCP service account keys, which provide long-lived programmatic access and are frequently targeted for persistence or used as backdoors after initial compromise.',
 'MEDIUM','CHRONICLE','T1552.004','Credential Access','Unsecured Credentials: Private Keys',
 ARRAY['IA-5','AC-6','AU-12'],
 ARRAY['GCP Cloud Audit Logs'],
 'rule gcp_sa_key_created {
  meta: description = "GCP service account key creation"
  events:
    $e.metadata.event_type = "SERVICE_ACCOUNT_CREATION"
    $e.target.resource.type = "iam.googleapis.com/ServiceAccountKey"
    $e.metadata.product_event_type = "google.iam.admin.v1.CreateServiceAccountKey"
    NOT $e.principal.user.email_addresses = /terraform|ansible|gha-runner/
  condition: $e
}',
 'YARA_L',ARRAY['gcp','service-account','key-creation','persistence'],1.0,10.0,2.0,TRUE,NULL),

('DET-0052','GCP Metadata Server SSRF Attempt',
 'Detects Server-Side Request Forgery (SSRF) attempts targeting the GCP instance metadata server at 169.254.169.254, which can expose service account tokens and instance configuration.',
 'HIGH','CHRONICLE','T1552.002','Credential Access','Unsecured Credentials: Cloud Instance Metadata API',
 ARRAY['SC-7','IA-5','SI-3'],
 ARRAY['GCP Cloud Audit Logs','HTTP Proxy Logs','Load Balancer Logs'],
 'rule gcp_metadata_ssrf {
  meta: description = "GCP metadata server SSRF"
  events:
    $e.metadata.event_type = "NETWORK_HTTP"
    $e.target.ip = "169.254.169.254"
    NOT $e.principal.process.file.full_path = /\/(usr\/lib\/google-cloud-sdk|gcloud)/
  condition: $e
}',
 'YARA_L',ARRAY['ssrf','metadata-api','gcp','credential-access'],0.3,5.0,0.5,TRUE,NULL),

('DET-0053','GCP IAM Binding Modified for High-Privilege Role',
 'Detects modifications to GCP IAM policy bindings that add high-privilege roles such as Owner, Editor, or Security Admin to identities, indicating potential privilege escalation or persistence.',
 'HIGH','CHRONICLE','T1098','Persistence','Account Manipulation',
 ARRAY['AC-6','AU-12','AC-3'],
 ARRAY['GCP Cloud Audit Logs'],
 'rule gcp_iam_high_priv_role {
  meta: description = "GCP high-privilege IAM binding"
  events:
    $e.metadata.event_type = "RESOURCE_PERMISSIONS_CHANGE"
    $e.metadata.product_event_type = /setIamPolicy/
    $e.security_result.description = /roles\/(owner|editor|iam\.securityAdmin|resourcemanager\.organizationAdmin)/
  condition: $e
}',
 'YARA_L',ARRAY['gcp','iam','privilege-escalation','persistence'],0.2,3.0,1.0,TRUE,NULL),

('DET-0054','Container Runtime Suspicious File Drop',
 'Detects suspicious file creation within running containers, particularly executables, scripts, or configuration files dropped into sensitive directories, indicating possible container compromise.',
 'HIGH','CHRONICLE','T1105','Command and Control','Ingress Tool Transfer',
 ARRAY['SI-3','CM-7','AU-12'],
 ARRAY['Container Runtime Logs','Falco Event Logs','GKE Security Logs'],
 'rule container_file_drop {
  meta: description = "Suspicious file dropped in container"
  events:
    $e.metadata.event_type = "FILE_CREATION"
    $e.target.file.full_path = /^\/(tmp|var\/tmp|dev\/shm)\/.+\.(sh|py|elf|bin|so)/
    $e.principal.process.file.full_path != ""
    $e.metadata.ingestion_labels.container_id != ""
  condition: $e
}',
 'YARA_L',ARRAY['container','file-drop','malware','gcp'],0.5,8.0,1.5,TRUE,NULL),

('DET-0055','GCP Project Deletion or Shutdown Initiated',
 'Detects deletion of GCP projects, which would destroy all resources and data within that project. This is a destructive action that could indicate insider threat or compromised admin credential abuse.',
 'CRITICAL','CHRONICLE','T1485','Impact','Data Destruction',
 ARRAY['CP-9','CP-10','AU-12'],
 ARRAY['GCP Cloud Audit Logs','GCP Resource Manager Logs'],
 'rule gcp_project_deletion {
  meta: description = "GCP project deletion initiated"
  events:
    $e.metadata.event_type = "RESOURCE_DELETION"
    $e.target.resource.type = "cloudresourcemanager.googleapis.com/Project"
    $e.metadata.product_event_type = "DeleteProject"
  condition: $e
}',
 'YARA_L',ARRAY['gcp','project-deletion','impact','destruction'],0.01,0.1,0.1,TRUE,NULL),

-- ══════════════════════════════════════════════════════════════
--  ELASTIC SECURITY  (EQL)  — DET-0056 to DET-0075
-- ══════════════════════════════════════════════════════════════

('DET-0056','Ransomware Shadow Copy Deletion via vssadmin',
 'Detects ransomware pre-encryption activity by identifying vssadmin, wbadmin, or wmic commands used to delete volume shadow copies and backup catalogs, preventing victim file recovery.',
 'CRITICAL','ELASTIC','T1490','Impact','Inhibit System Recovery',
 ARRAY['CP-9','CP-10','SI-3'],
 ARRAY['Endpoint Logs (Elastic Agent)','Windows Event Logs'],
 'process where event.type == "start" and (
  (process.name : "vssadmin.exe" and process.args : ("delete","shadows","resize","storage")) or
  (process.name : "wbadmin.exe" and process.args : ("delete","catalog","backup")) or
  (process.name : "wmic.exe" and process.args : ("shadowcopy") and process.args : ("delete"))
)',
 'EQL',ARRAY['ransomware','shadow-copy','impact','windows'],0.05,1.0,0.2,TRUE,NULL),

('DET-0057','Credential Dump via ProcDump or Task Manager',
 'Detects credential dumping from LSASS process using ProcDump or Task Manager minidump, which extracts cleartext passwords and NTLM hashes from memory. Requires Sysmon process access events.',
 'CRITICAL','ELASTIC','T1003.001','Credential Access','OS Credential Dumping: LSASS Memory',
 ARRAY['IA-5','SI-3','AU-2'],
 ARRAY['Elastic Endpoint Security','Sysmon Events'],
 'process where event.type == "start" and (
  (process.name : "procdump*.exe" and process.args : ("-ma","-mp") and process.args : ("lsass")) or
  (process.name : "taskmgr.exe" and process.args : ("/create","/minidump")) or
  (process.pe.original_file_name : "procdump" and process.args : ("lsass.exe"))
)',
 'EQL',ARRAY['lsass','credential-dump','procdump','windows'],0.3,3.0,0.5,TRUE,NULL),

('DET-0058','Network Port Scanning from Endpoint',
 'Detects internal network reconnaissance via port scanning by identifying a single process opening an unusually high number of unique network connections within a short time window.',
 'MEDIUM','ELASTIC','T1046','Discovery','Network Service Discovery',
 ARRAY['SC-7','AU-12','SI-4'],
 ARRAY['Elastic Endpoint Security','Network Events'],
 'sequence by process.entity_id with maxspan=60s
  [network where event.action == "connection_attempted" and
   not network.direction == "inbound" and not process.name in ("chrome.exe","firefox.exe","msedge.exe")]
  with runs=50',
 'EQL',ARRAY['port-scan','discovery','reconnaissance','network'],1.5,18.0,2.0,TRUE,NULL),

('DET-0059','Cobalt Strike Default Named Pipe',
 'Detects Cobalt Strike beacon activity by identifying creation of default named pipes used by Cobalt Strike for inter-process communication including MSSE-*, postex_*, msagent_*, and others.',
 'CRITICAL','ELASTIC','T1071','Command and Control','Application Layer Protocol',
 ARRAY['SC-7','SI-3','SI-4'],
 ARRAY['Elastic Endpoint Security','Sysmon Event ID 17/18'],
 'file where event.action : "creation" and
  file.path : ("\\\\.\\\\.\\pipe\\MSSE-*","\\\\.\\\\.\\pipe\\postex_*","\\\\.\\\\.\\pipe\\msagent_*",
               "\\\\.\\\\.\\pipe\\status_*","\\\\.\\\\.\\pipe\\SearchTextHarvester")',
 'EQL',ARRAY['cobalt-strike','named-pipe','c2','windows'],0.2,2.0,0.5,TRUE,NULL),

('DET-0060','DLL Side-Loading from Suspicious Path',
 'Detects DLL side-loading by identifying signed binaries loading DLLs from non-standard paths such as temp directories, user profile directories, or paths that do not match the application location.',
 'HIGH','ELASTIC','T1574.002','Defense Evasion','Hijack Execution Flow: DLL Side-Loading',
 ARRAY['CM-7','SI-3','AU-12'],
 ARRAY['Elastic Endpoint Security','Sysmon Event ID 7'],
 'library where dll.path : ("?:\\Users\\*","?:\\ProgramData\\*","?:\\Temp\\*","?:\\AppData\\*") and
  process.code_signature.trusted == true and
  not dll.code_signature.trusted == true',
 'EQL',ARRAY['dll-sideloading','defense-evasion','windows','signed-binary'],1.0,12.0,2.0,TRUE,NULL),

('DET-0061','Office Application Spawning Child Process',
 'Detects Microsoft Office applications spawning child processes, which is a common initial access technique via malicious macros or document exploits (Equation Editor, DDE, etc.).',
 'HIGH','ELASTIC','T1566.001','Initial Access','Phishing: Spearphishing Attachment',
 ARRAY['SI-3','CM-7','AU-12'],
 ARRAY['Elastic Endpoint Security','Endpoint Detection and Response'],
 'process where event.type == "start" and
  process.parent.name : ("WINWORD.EXE","EXCEL.EXE","POWERPNT.EXE","MSACCESS.EXE","OUTLOOK.EXE") and
  process.name : ("cmd.exe","powershell.exe","wscript.exe","cscript.exe","mshta.exe","regsvr32.exe","certutil.exe")',
 'EQL',ARRAY['office-macro','phishing','initial-access','windows'],1.8,8.0,1.5,TRUE,NULL),

('DET-0062','WinRM Remote Shell Execution',
 'Detects lateral movement via Windows Remote Management (WinRM) by identifying wsmprovhost.exe spawning command interpreters. WinRM is increasingly used as an alternative to PsExec for stealthier lateral movement.',
 'HIGH','ELASTIC','T1021.006','Lateral Movement','Remote Services: Windows Remote Management',
 ARRAY['AC-17','SC-7','AU-12'],
 ARRAY['Elastic Endpoint Security','Windows Event Logs (6'],
 'process where event.type == "start" and
  process.parent.name : "wsmprovhost.exe" and
  process.name : ("cmd.exe","powershell.exe","wscript.exe","cscript.exe","mshta.exe") and
  not process.args : ("Set-ExecutionPolicy","Get-PSSessionConfiguration")',
 'EQL',ARRAY['winrm','lateral-movement','remote-shell','windows'],0.5,6.0,1.0,TRUE,NULL),

('DET-0063','BloodHound Active Directory Enumeration',
 'Detects Active Directory enumeration activity consistent with BloodHound/SharpHound by identifying LDAP queries that enumerate domain trusts, group memberships, and session information at high volumes.',
 'HIGH','ELASTIC','T1087.002','Discovery','Account Discovery: Domain Account',
 ARRAY['AC-6','AU-12','SI-4'],
 ARRAY['Elastic Endpoint Security','Network Events','Active Directory Logs'],
 'sequence by source.ip with maxspan=2m
  [network where event.action == "dns_query" and dns.question.name in ("_ldap._tcp.dc._msdcs.*")]
  [network where network.direction == "outbound" and destination.port == 389]
  with runs=10',
 'EQL',ARRAY['bloodhound','active-directory','enumeration','ldap'],0.3,5.0,2.0,TRUE,NULL),

('DET-0064','AMSI Bypass via Reflection',
 'Detects Antimalware Scan Interface (AMSI) bypass techniques that use .NET reflection to patch the AmsiScanBuffer function in memory, preventing PowerShell from being scanned for malicious content.',
 'CRITICAL','ELASTIC','T1562.001','Defense Evasion','Impair Defenses: Disable or Modify Tools',
 ARRAY['SI-3','CM-7','AU-12'],
 ARRAY['PowerShell Script Block Logs (4104)','Elastic Endpoint Security'],
 'process where event.type == "start" and process.name : "powershell.exe" and
  process.command_line : ("*AmsiScanBuffer*","*amsiInitFailed*","*AmsiUtils*","*System.Runtime.InteropServices*")
  and process.command_line : ("*[Ref].*GetField*","*GetMethod*","*SetValue*")',
 'EQL',ARRAY['amsi-bypass','powershell','defense-evasion','windows'],0.4,4.0,0.8,TRUE,NULL),

('DET-0065','Regsvr32 COM Scriptlet Execution',
 'Detects abuse of regsvr32.exe (the Squiblydoo technique) to execute COM scriptlets from remote URLs, bypassing application whitelisting controls. A signed Microsoft binary commonly abused for defense evasion.',
 'HIGH','ELASTIC','T1218.010','Defense Evasion','System Binary Proxy Execution: Regsvr32',
 ARRAY['CM-7','SI-3','AU-12'],
 ARRAY['Elastic Endpoint Security','Process Execution Events'],
 'process where event.type == "start" and process.name : "regsvr32.exe" and
  process.args : ("/i:http*","/i:ftp*","/u /i:http*","scrobj.dll") and
  process.args : ("/s","/silent")',
 'EQL',ARRAY['regsvr32','lolbas','defense-evasion','com-scriptlet'],0.5,5.0,1.0,TRUE,NULL),

('DET-0066','SMB-Based Lateral Movement with Dropped Payload',
 'Detects a sequence indicating SMB-based lateral movement: a file is dropped to an administrative share followed by service creation or scheduled task execution from the same file path.',
 'HIGH','ELASTIC','T1021.002','Lateral Movement','Remote Services: SMB/Windows Admin Shares',
 ARRAY['AC-17','SI-3','AU-12'],
 ARRAY['Elastic Endpoint Security','Windows Event Logs','Sysmon'],
 'sequence with maxspan=5m
  [file where event.action == "creation" and file.path : "?:\\Windows\\*" and
   file.name : ("*.exe","*.dll","*.bat","*.ps1")]
  [process where event.type == "start" and
   process.parent.name in ("services.exe","svchost.exe") and
   process.executable : "?:\\Windows\\*"]',
 'EQL',ARRAY['lateral-movement','smb','service-creation','windows'],0.8,8.0,1.5,TRUE,NULL),

('DET-0067','Browser Credential Store Access',
 'Detects access to browser credential databases (Login Data, key4.db, logins.json) by processes other than the browser itself, indicating credential harvesting via infostealer malware.',
 'HIGH','ELASTIC','T1555.003','Credential Access','Credentials from Password Stores: Credentials from Web Browsers',
 ARRAY['IA-5','SC-28','AU-12'],
 ARRAY['Elastic Endpoint Security','File Access Events'],
 'file where event.action in ("open","read") and
  file.path : ("?:\\Users\\*\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Login Data",
               "?:\\Users\\*\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles\\*\\logins.json",
               "?:\\Users\\*\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\Login Data") and
  not process.name in ("chrome.exe","firefox.exe","msedge.exe","brave.exe")',
 'EQL',ARRAY['browser-creds','infostealer','credential-access','windows'],0.6,8.0,1.5,TRUE,NULL),

('DET-0068','Process Hollowing Detection',
 'Detects process hollowing by identifying a suspended process creation immediately followed by memory write operations and thread resumption, hallmarks of this process injection technique.',
 'HIGH','ELASTIC','T1055.012','Defense Evasion','Process Injection: Process Hollowing',
 ARRAY['SI-3','CM-7','AU-12'],
 ARRAY['Elastic Endpoint Security','Sysmon Events'],
 'sequence by host.id with maxspan=1m
  [process where event.type == "start" and process.name in ("svchost.exe","notepad.exe","explorer.exe","cmd.exe")]
  [process where event.type == "info" and process.name : "*.exe" and
   process.Ext.memory_region.protection : ("RWX","PAGE_EXECUTE_READWRITE")]',
 'EQL',ARRAY['process-hollowing','process-injection','defense-evasion','windows'],0.3,3.0,1.0,TRUE,NULL),

('DET-0069','RDP Brute Force from External',
 'Detects Remote Desktop Protocol brute force attacks from external IP addresses by identifying multiple failed RDP authentication events from a single source within a short time window.',
 'MEDIUM','ELASTIC','T1110.001','Credential Access','Brute Force: Password Guessing',
 ARRAY['AC-7','IA-5','SC-7'],
 ARRAY['Windows Event Logs (4625)','Elastic Endpoint Security','Network Logs'],
 'sequence by source.ip with maxspan=5m
  [authentication where event.action == "logged-on" and event.outcome == "failure" and
   winlog.logon.type == "Network" and source.port == 3389]
  with runs=10',
 'EQL',ARRAY['rdp','brute-force','credential-access','remote-access'],2.0,15.0,0.5,TRUE,NULL),

('DET-0070','Domain Admin Group Membership Added',
 'Detects when a user account is added to the Domain Admins, Enterprise Admins, or Schema Admins groups in Active Directory, a high-value event that should always be reviewed and audited.',
 'CRITICAL','ELASTIC','T1098','Persistence','Account Manipulation',
 ARRAY['AC-2','AC-6','AU-12'],
 ARRAY['Windows Event Logs (4728)','Active Directory Audit Logs'],
 'iam where event.action == "added-member-to-group" and
  group.name : ("Domain Admins","Enterprise Admins","Schema Admins","Administrators") and
  not winlog.event_data.SubjectUserName : ("*$","DomainSync*")',
 'EQL',ARRAY['domain-admin','active-directory','privilege-escalation','persistence'],0.1,2.0,0.5,TRUE,NULL),

('DET-0071','PowerShell Suspicious Download via WebClient',
 'Detects PowerShell scripts using Net.WebClient or Invoke-WebRequest to download content from the internet, a common initial access and execution technique for fileless malware delivery.',
 'HIGH','ELASTIC','T1105','Command and Control','Ingress Tool Transfer',
 ARRAY['SI-3','SC-7','CM-7'],
 ARRAY['PowerShell Script Block Logs (4104)','Elastic Endpoint Security'],
 'process where event.type == "start" and process.name : "powershell.exe" and
  process.command_line : ("*Net.WebClient*","*Invoke-WebRequest*","*wget *","*curl *","*iwr *") and
  process.command_line : ("*http://*","*https://*","*ftp://*") and
  not process.command_line : ("*update*","*patch*","*nuget*","*chocolatey*")',
 'EQL',ARRAY['powershell','download','fileless','execution'],3.5,18.0,1.5,TRUE,NULL),

('DET-0072','Security Software Discovery Enumeration',
 'Detects enumeration of installed security software including AV, EDR, and firewall products via WMI, registry queries, or process listing, typically performed during post-exploitation reconnaissance.',
 'MEDIUM','ELASTIC','T1518.001','Discovery','Software Discovery: Security Software Discovery',
 ARRAY['SI-3','AU-12','CM-7'],
 ARRAY['Elastic Endpoint Security','Process Execution Events'],
 'process where event.type == "start" and (
  (process.name : "powershell.exe" and process.command_line : ("*Get-MpPreference*","*Get-AntiMalwareStatus*","*Win32_SecuritySoftware*")) or
  (process.name : "wmic.exe" and process.command_line : ("*antivirusproduct*","*firewallproduct*")) or
  (process.name : "reg.exe" and process.command_line : ("*WinDefend*","*MsMpEng*"))
)',
 'EQL',ARRAY['discovery','security-software','enumeration','windows'],4.0,25.0,3.0,TRUE,NULL),

('DET-0073','COM Hijacking via User Registry',
 'Detects COM object hijacking via the HKCU (user) registry hive, where an attacker registers a malicious COM server under the current user to intercept and hijack calls made by other processes.',
 'MEDIUM','ELASTIC','T1546.015','Persistence','Event Triggered Execution: Component Object Model Hijacking',
 ARRAY['CM-7','SI-3','AU-12'],
 ARRAY['Sysmon Events (ID 13)','Elastic Endpoint Security'],
 'registry where event.action == "modification" and
  registry.path : "HKEY_USERS\\\\*\\\\SOFTWARE\\\\Classes\\\\CLSID\\\\*\\\\InProcServer32" and
  not registry.data.strings : ("%SystemRoot%\\\\*","C:\\\\Program Files*","C:\\\\Windows\\\\*")',
 'EQL',ARRAY['com-hijacking','persistence','registry','windows'],0.4,6.0,3.0,TRUE,NULL),

('DET-0074','Token Impersonation via Windows API',
 'Detects privilege escalation via Windows token impersonation APIs including DuplicateTokenEx, ImpersonateLoggedOnUser, and SetThreadToken, used to assume the security context of higher-privileged users.',
 'HIGH','ELASTIC','T1134','Privilege Escalation','Access Token Manipulation',
 ARRAY['AC-6','SI-3','AU-12'],
 ARRAY['Elastic Endpoint Security','Sysmon Events','ETW Telemetry'],
 'api where process.Ext.api.name in ("DuplicateTokenEx","ImpersonateLoggedOnUser","SetThreadToken") and
  process.Ext.api.parameters.desired_access_numeric : (0x02000000, 0x001fffff) and
  not process.name in ("lsass.exe","services.exe","svchost.exe")',
 'EQL',ARRAY['token-impersonation','privilege-escalation','windows','api'],0.5,7.0,1.0,TRUE,NULL),

('DET-0075','PowerShell Running from Unusual Location',
 'Detects PowerShell executables running from non-standard paths, which may indicate masquerading where malware renames itself as powershell.exe, or a legitimate but suspicious portable PowerShell execution.',
 'HIGH','ELASTIC','T1036.005','Defense Evasion','Masquerading: Match Legitimate Name or Location',
 ARRAY['SI-3','CM-7','AU-12'],
 ARRAY['Elastic Endpoint Security','Process Execution Events'],
 'process where event.type == "start" and process.name : "powershell.exe" and
  not process.executable : (
    "?:\\Windows\\System32\\WindowsPowerShell\\*\\powershell.exe",
    "?:\\Windows\\SysWOW64\\WindowsPowerShell\\*\\powershell.exe",
    "?:\\Program Files\\PowerShell\\*\\pwsh.exe")',
 'EQL',ARRAY['masquerading','powershell','defense-evasion','windows'],0.3,4.0,1.0,TRUE,NULL),

-- ══════════════════════════════════════════════════════════════
--  IBM QRADAR  (AQL)  — DET-0076 to DET-0090
-- ══════════════════════════════════════════════════════════════

('DET-0076','Windows Event Log Audit Log Cleared',
 'Detects clearing of Windows Security, System, or Application event logs, a common anti-forensics technique used by attackers to cover their tracks after achieving their objectives.',
 'HIGH','QRADAR','T1070.001','Defense Evasion','Indicator Removal: Clear Windows Event Logs',
 ARRAY['AU-9','SI-12','IR-5'],
 ARRAY['Windows Event Logs (1102)','Windows Event Logs (104)'],
 'SELECT sourceip, username, devicetype, category, "Log Cleared", starttime
FROM events
WHERE LOGSOURCETYPENAME(devicetype) = ''Microsoft Windows Security Event Log''
AND category = 12309
OR (LOGSOURCETYPENAME(devicetype) = ''Microsoft Windows Security Event Log'' AND category = 104)
START ''${last_30_minutes}'' STOP ''${now}''',
 'AQL',ARRAY['log-clearing','anti-forensics','defense-evasion','windows'],0.1,1.0,0.3,TRUE,NULL),

('DET-0077','Internal Network Port Scan',
 'Detects internal hosts performing network port scanning by identifying connections to many unique destination ports or hosts within a short period, indicating reconnaissance or lateral movement preparation.',
 'MEDIUM','QRADAR','T1046','Discovery','Network Service Discovery',
 ARRAY['SC-7','AU-12','SI-4'],
 ARRAY['Network Flow Data (QRadar Flow)','Firewall Logs'],
 'SELECT sourceip, COUNT(DISTINCT destinationport) AS unique_ports,
  COUNT(DISTINCT destinationip) AS unique_hosts, SUM(eventcount) AS total_attempts
FROM flows
WHERE sourceip INCIDR ''10.0.0.0/8'' OR sourceip INCIDR ''192.168.0.0/16''
GROUP BY sourceip, bin(starttime, 60)
HAVING unique_ports > 50 OR unique_hosts > 20
ORDER BY unique_ports DESC
START ''${last_5_minutes}''',
 'AQL',ARRAY['port-scan','reconnaissance','discovery','network'],2.0,20.0,2.0,TRUE,NULL),

('DET-0078','Suspicious SMTP Relay or Mass Mail',
 'Detects potential spam relay abuse or mass phishing campaign execution by identifying a host sending email to an unusually high number of distinct recipients within a short time period.',
 'MEDIUM','QRADAR','T1071.003','Command and Control','Application Layer Protocol: Mail Protocols',
 ARRAY['SC-7','AU-12','SI-3'],
 ARRAY['Mail Server Logs (SMTP)','Network Flow Data'],
 'SELECT sourceip, COUNT(DISTINCT destinationip) AS unique_recipients,
  SUM(eventcount) AS total_messages
FROM events
WHERE destinationport = 25 OR destinationport = 587
GROUP BY sourceip, bin(starttime, 300)
HAVING unique_recipients > 50
ORDER BY unique_recipients DESC
START ''${last_10_minutes}''',
 'AQL',ARRAY['smtp','spam','phishing','email'],0.8,12.0,2.0,TRUE,NULL),

('DET-0079','Web Application SQL Injection Attempt',
 'Detects SQL injection attempts against web applications by identifying HTTP requests containing common SQL injection payloads in query parameters, body content, or headers.',
 'HIGH','QRADAR','T1190','Initial Access','Exploit Public-Facing Application',
 ARRAY['SI-10','SC-7','AU-12'],
 ARRAY['Web Application Firewall Logs','Web Server Access Logs','IDS/IPS Logs'],
 'SELECT sourceip, destinationip, URL, username, COUNT(*) AS attempts
FROM events
WHERE LOGSOURCETYPENAME(devicetype) IN (''Snort'',''Suricata'',''ModSecurity'')
AND (URL ILIKE ''%union%select%'' OR URL ILIKE ''%drop%table%'' OR URL ILIKE ''%1=1%''
     OR URL ILIKE ''%0x%'' OR URL ILIKE ''%char(%'')
GROUP BY sourceip, destinationip, URL, bin(starttime, 60)
HAVING attempts > 3
ORDER BY attempts DESC',
 'AQL',ARRAY['sql-injection','web-application','initial-access','owasp'],3.5,15.0,1.0,TRUE,NULL),

('DET-0080','Concurrent VPN Session from Same User',
 'Detects simultaneous active VPN sessions from the same user account from different source IP addresses, indicating possible credential sharing, account compromise, or VPN session hijacking.',
 'MEDIUM','QRADAR','T1133','Initial Access','External Remote Services',
 ARRAY['AC-17','IA-2','AU-12'],
 ARRAY['VPN Gateway Logs','Authentication Logs'],
 'SELECT username, COUNT(DISTINCT sourceip) AS concurrent_ips,
  MIN(starttime) AS first_session, MAX(starttime) AS last_session
FROM events
WHERE LOGSOURCETYPENAME(devicetype) IN (''Cisco ASA'',''Palo Alto GlobalProtect'',''Fortinet FortiGate'')
AND eventid = ''VPN_SESSION_START''
GROUP BY username, bin(starttime, 900)
HAVING concurrent_ips > 2
ORDER BY concurrent_ips DESC',
 'AQL',ARRAY['vpn','concurrent-session','credential-sharing','remote-access'],0.5,10.0,2.0,TRUE,NULL),

('DET-0081','Large FTP or SFTP Data Transfer',
 'Detects potential data exfiltration via FTP or SFTP by identifying unusually large outbound file transfers to external destinations, particularly to cloud storage or file hosting services.',
 'HIGH','QRADAR','T1048.003','Exfiltration','Exfiltration Over Alternative Protocol: Exfiltration Over Unencrypted Non-C2 Protocol',
 ARRAY['SC-7','AC-4','AU-12'],
 ARRAY['FTP Server Logs','Network Flow Data','Firewall Logs'],
 'SELECT sourceip, destinationip, username, SUM(bytesout) AS total_bytes_out
FROM flows
WHERE destinationport IN (20,21,22,115,990)
AND sourceip INCIDR ''10.0.0.0/8''
AND NOT destinationip INCIDR ''10.0.0.0/8''
GROUP BY sourceip, destinationip, username, bin(starttime, 3600)
HAVING total_bytes_out > 104857600
ORDER BY total_bytes_out DESC',
 'AQL',ARRAY['ftp','exfiltration','data-transfer','network'],0.4,6.0,3.0,TRUE,NULL),

('DET-0082','ICMP Tunneling via Large Packets',
 'Detects ICMP tunneling by identifying ICMP Echo requests with unusually large payloads exceeding 64 bytes, which are characteristic of ICMP tunneling tools used for C2 and data exfiltration.',
 'MEDIUM','QRADAR','T1095','Command and Control','Non-Application Layer Protocol',
 ARRAY['SC-7','SI-4','AU-12'],
 ARRAY['Network Flow Data','IDS/IPS Logs','Firewall Logs'],
 'SELECT sourceip, destinationip, AVG(payloadlen) AS avg_payload, COUNT(*) AS packet_count
FROM flows
WHERE protocolname = ''ICMP'' AND payloadlen > 64
AND NOT destinationip INCIDR ''10.0.0.0/8''
GROUP BY sourceip, destinationip, bin(starttime, 300)
HAVING packet_count > 50
ORDER BY avg_payload DESC
START ''${last_5_minutes}''',
 'AQL',ARRAY['icmp-tunnel','c2','network','exfiltration'],0.3,5.0,3.0,TRUE,NULL),

('DET-0083','LDAP Enumeration Flood',
 'Detects Active Directory enumeration via LDAP by identifying hosts generating an abnormally high volume of LDAP queries within a short period, consistent with automated AD enumeration tools.',
 'MEDIUM','QRADAR','T1087.002','Discovery','Account Discovery: Domain Account',
 ARRAY['AU-12','SI-4','AC-6'],
 ARRAY['Active Directory Logs','Network Flow Data','LDAP Server Logs'],
 'SELECT sourceip, destinationip, COUNT(*) AS ldap_queries
FROM flows
WHERE destinationport IN (389,636,3268,3269)
AND sourceip INCIDR ''10.0.0.0/8''
GROUP BY sourceip, destinationip, bin(starttime, 60)
HAVING ldap_queries > 500
ORDER BY ldap_queries DESC',
 'AQL',ARRAY['ldap','active-directory','enumeration','reconnaissance'],0.8,12.0,2.0,TRUE,NULL),

('DET-0084','Web Shell Access Pattern',
 'Detects web shell activity by identifying HTTP requests to web server paths that exhibit characteristics of web shell communication: non-standard file extensions, POST requests, and command output patterns.',
 'CRITICAL','QRADAR','T1505.003','Persistence','Server Software Component: Web Shell',
 ARRAY['SI-3','CM-7','AU-12'],
 ARRAY['Web Server Access Logs','WAF Logs','IDS/IPS Logs'],
 'SELECT sourceip, URL, method, username, COUNT(*) AS requests, MAX(responsesize) AS max_response
FROM events
WHERE LOGSOURCETYPENAME(devicetype) IN (''Apache'',''IIS'',''Nginx'')
AND method = ''POST''
AND (URL ILIKE ''%.php'' OR URL ILIKE ''%.aspx'' OR URL ILIKE ''%.jsp'' OR URL ILIKE ''%.cfm'')
AND responsesize BETWEEN 500 AND 50000
GROUP BY sourceip, URL, bin(starttime, 60)
HAVING requests > 5
ORDER BY requests DESC',
 'AQL',ARRAY['webshell','persistence','server-side','web-application'],0.3,4.0,1.0,TRUE,NULL),

('DET-0085','Public IP to Internal RDP Successful Login',
 'Detects successful RDP logins originating from public internet IP addresses directly to internal hosts, indicating either an exposed RDP service or a VPN/gateway misconfiguration.',
 'HIGH','QRADAR','T1133','Initial Access','External Remote Services',
 ARRAY['AC-17','SC-7','IA-2'],
 ARRAY['Windows Event Logs (4624)','Firewall Logs','Network Flow Data'],
 'SELECT sourceip, destinationip, username, starttime, eventcount
FROM events
WHERE LOGSOURCETYPENAME(devicetype) = ''Microsoft Windows Security Event Log''
AND category = 12544 AND eventid = 4624
AND NOT sourceip INCIDR ''10.0.0.0/8''
AND NOT sourceip INCIDR ''172.16.0.0/12''
AND NOT sourceip INCIDR ''192.168.0.0/16''
AND destinationport = 3389
ORDER BY starttime DESC',
 'AQL',ARRAY['rdp','external-access','initial-access','remote-desktop'],0.5,5.0,0.5,TRUE,NULL),

('DET-0086','Anomalous Data Volume Upload to Cloud',
 'Detects potential data exfiltration via cloud storage upload by identifying HTTP PUT or POST requests to cloud providers with unusually large payloads from internal hosts.',
 'HIGH','QRADAR','T1537','Exfiltration','Transfer Data to Cloud Account',
 ARRAY['SC-7','AC-4','AU-12'],
 ARRAY['Proxy Logs','Firewall Logs','Network Flow Data'],
 'SELECT sourceip, destinationip, URL, SUM(bytesSent) AS total_uploaded
FROM events
WHERE (URL ILIKE ''%s3.amazonaws.com%'' OR URL ILIKE ''%blob.core.windows.net%''
       OR URL ILIKE ''%storage.googleapis.com%'' OR URL ILIKE ''%dropbox.com/upload%'')
AND method IN (''PUT'',''POST'')
AND sourceip INCIDR ''10.0.0.0/8''
GROUP BY sourceip, destinationip, URL, bin(starttime, 3600)
HAVING total_uploaded > 104857600
ORDER BY total_uploaded DESC',
 'AQL',ARRAY['cloud-upload','exfiltration','data-theft','s3'],0.6,8.0,3.0,TRUE,NULL),

('DET-0087','TOR Exit Node Outbound Traffic',
 'Detects outbound connections from internal hosts to known TOR exit nodes and relay IPs, which may indicate use of TOR for anonymous C2 communication, data exfiltration, or policy violation.',
 'HIGH','QRADAR','T1090.003','Command and Control','Proxy: Multi-hop Proxy',
 ARRAY['SC-7','AU-12','SI-4'],
 ARRAY['Firewall Logs','Proxy Logs','Threat Intelligence Feed'],
 'SELECT sourceip, destinationip, destinationport, COUNT(*) AS connections
FROM events
WHERE destinationip REFERENCECONTAINS(''TOR_Exit_Nodes'')
AND sourceip INCIDR ''10.0.0.0/8''
GROUP BY sourceip, destinationip, bin(starttime, 300)
HAVING connections > 3
ORDER BY connections DESC',
 'AQL',ARRAY['tor','proxy','c2','network-anonymization'],0.2,3.0,1.5,TRUE,NULL),

('DET-0088','Pass-the-Ticket Kerberos Anomaly',
 'Detects pass-the-ticket attacks by identifying Kerberos ticket usage from source IPs that differ from the host where the ticket was originally requested, indicating ticket theft and replay.',
 'HIGH','QRADAR','T1550.003','Lateral Movement','Use Alternate Authentication Material: Pass the Ticket',
 ARRAY['IA-2','AC-6','AU-12'],
 ARRAY['Windows Event Logs (4769)','Kerberos KDC Logs'],
 'SELECT username, COUNT(DISTINCT sourceip) AS source_ips,
  MIN(sourceip) AS first_ip, MAX(sourceip) AS last_ip
FROM events
WHERE LOGSOURCETYPENAME(devicetype) = ''Microsoft Windows Security Event Log''
AND eventid = 4769
AND ticketEncryptionType = ''0x17''
GROUP BY username, bin(starttime, 300)
HAVING source_ips > 1
ORDER BY source_ips DESC',
 'AQL',ARRAY['pass-the-ticket','kerberos','lateral-movement','credential'],0.3,4.0,1.0,TRUE,NULL),

('DET-0089','Malicious Service Installation',
 'Detects installation of new Windows services with suspicious characteristics including unusual binary paths, non-standard service names, or services configured to run from temp directories.',
 'HIGH','QRADAR','T1543.003','Persistence','Create or Modify System Process: Windows Service',
 ARRAY['CM-7','SI-3','AU-12'],
 ARRAY['Windows Event Logs (7045)','Windows System Event Logs'],
 'SELECT hostname, username, servicename, servicefile, starttype
FROM events
WHERE LOGSOURCETYPENAME(devicetype) = ''Microsoft Windows Security Event Log''
AND eventid = 7045
AND (servicefile ILIKE ''%\\temp\\%'' OR servicefile ILIKE ''%\\appdata\\%''
     OR servicefile ILIKE ''%\\users\\%'' OR servicefile ILIKE ''%cmd.exe%'')
ORDER BY starttime DESC',
 'AQL',ARRAY['service-installation','persistence','windows','malware'],0.4,6.0,1.5,TRUE,NULL),

('DET-0090','Off-Hours Administrative Activity',
 'Detects privileged administrative activity occurring outside normal business hours (weekends, nights), which may indicate insider threat, compromised admin credentials, or unauthorized access.',
 'MEDIUM','QRADAR','T1078','Initial Access','Valid Accounts',
 ARRAY['AC-2','AU-12','AC-6'],
 ARRAY['Active Directory Logs','Windows Event Logs','Authentication Logs'],
 'SELECT username, sourceip, COUNT(*) AS actions, MIN(starttime) AS first_action
FROM events
WHERE category IN (12544,12545)
AND eventid IN (4728,4732,4756,4720,4722)
AND DAYOFWEEK(starttime) IN (1,7)
OR HOUR(starttime) NOT BETWEEN 7 AND 19
GROUP BY username, sourceip, bin(starttime, 3600)
HAVING actions > 3
ORDER BY actions DESC',
 'AQL',ARRAY['off-hours','insider-threat','admin-activity','authentication'],1.5,20.0,3.0,TRUE,NULL),

-- ══════════════════════════════════════════════════════════════
--  SIGMA (Cross-platform)  — DET-0091 to DET-0100
-- ══════════════════════════════════════════════════════════════

('DET-0091','Mimikatz Generic Keyword Detection',
 'Detects Mimikatz credential dumping tool usage by identifying characteristic strings and command arguments in process command lines and script blocks across multiple platforms and versions.',
 'CRITICAL','SIGMA','T1003','Credential Access','OS Credential Dumping',
 ARRAY['IA-5','SI-3','AU-2'],
 ARRAY['Windows Event Logs','EDR Telemetry','PowerShell Logs'],
 'title: Mimikatz Generic Detection
status: stable
logsource:
  category: process_creation
  product: windows
detection:
  selection:
    CommandLine|contains:
      - ''sekurlsa::''
      - ''lsadump::''
      - ''privilege::debug''
      - ''crypto::capi''
      - ''kerberos::ptt''
      - ''sid::patch''
  condition: selection
falsepositives:
  - Security testing
level: critical',
 'SIGMA',ARRAY['mimikatz','credential-dump','active-directory','windows'],0.2,2.0,0.3,TRUE,NULL),

('DET-0092','Cobalt Strike Malleable C2 Profile Detection',
 'Detects Cobalt Strike malleable C2 profiles by identifying characteristic HTTP headers, URIs, and user agents that match known Cobalt Strike default and community profiles.',
 'CRITICAL','SIGMA','T1071.001','Command and Control','Application Layer Protocol: Web Protocols',
 ARRAY['SC-7','SI-4','AU-12'],
 ARRAY['Network Traffic','Proxy Logs','IDS/IPS Logs'],
 'title: Cobalt Strike Malleable C2
status: stable
logsource:
  category: proxy
detection:
  selection:
    c-useragent|contains:
      - ''Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.2; WOW64; Trident/6.0)''
      - ''Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 5.1; Trident/4.0)''
    cs-uri-query|contains:
      - ''__utm.gif''
      - ''updates.rss''
      - ''pixel.gif''
  condition: selection
level: high',
 'SIGMA',ARRAY['cobalt-strike','c2','malleable-profile','network'],0.3,4.0,1.0,TRUE,NULL),

('DET-0093','LSASS Process Access by Non-System Process',
 'Detects access to the LSASS process by non-system processes, a prerequisite for all memory-based credential dumping techniques including Mimikatz, ProcDump, and custom dumpers.',
 'CRITICAL','SIGMA','T1003.001','Credential Access','OS Credential Dumping: LSASS Memory',
 ARRAY['IA-5','SI-3','AU-2'],
 ARRAY['Sysmon Event ID 10','EDR Process Access Events'],
 'title: LSASS Process Access
status: stable
logsource:
  category: process_access
  product: windows
detection:
  selection:
    TargetImage|endswith: ''\lsass.exe''
    GrantedAccess|contains:
      - ''0x1010''
      - ''0x1410''
      - ''0x1438''
      - ''0x143a''
      - ''0x1f1fff''
      - ''0x1fffff''
  filter:
    SourceImage|startswith: ''C:\Windows\''
  condition: selection and not filter
level: critical',
 'SIGMA',ARRAY['lsass','credential-dump','process-access','windows'],0.5,5.0,0.5,TRUE,NULL),

('DET-0094','WMI Subscription Persistence',
 'Detects WMI event subscription persistence mechanisms by identifying creation of EventFilter, EventConsumer, and FilterToConsumerBinding objects used to maintain persistence across reboots.',
 'HIGH','SIGMA','T1546.003','Persistence','Event Triggered Execution: Windows Management Instrumentation Event Subscription',
 ARRAY['CM-7','SI-3','AU-12'],
 ARRAY['WMI Activity Event Logs','Sysmon Event ID 19,20,21'],
 'title: WMI Event Subscription
status: stable
logsource:
  product: windows
  service: sysmon
detection:
  selection_eid19:
    EventID: 19
  selection_eid20:
    EventID: 20
  selection_eid21:
    EventID: 21
  condition: selection_eid19 or selection_eid20 or selection_eid21
falsepositives:
  - Legitimate WMI event subscriptions by management software
level: high',
 'SIGMA',ARRAY['wmi','persistence','event-subscription','windows'],0.3,8.0,3.0,TRUE,NULL),

('DET-0095','PowerShell Invoke-Expression with Download',
 'Detects the combination of Invoke-Expression (IEX) and download functions in PowerShell, the most common pattern for fileless malware execution that downloads and runs code entirely in memory.',
 'HIGH','SIGMA','T1059.001','Execution','Command and Scripting Interpreter: PowerShell',
 ARRAY['SI-3','CM-7','AU-2'],
 ARRAY['PowerShell Script Block Logs (4104)','Windows Event Logs'],
 'title: PowerShell IEX Download Cradle
status: stable
logsource:
  product: windows
  service: powershell
  definition: Script Block Logging must be enabled
detection:
  selection:
    EventID: 4104
    ScriptBlockText|contains|all:
      - ''Invoke-Expression''
      - ''DownloadString''
  condition: selection
falsepositives:
  - Legitimate admin scripts (whitelist by user and script path)
level: high',
 'SIGMA',ARRAY['powershell','iex','download-cradle','fileless'],2.5,12.0,1.5,TRUE,NULL),

('DET-0096','Domain Trust Discovery via nltest',
 'Detects Active Directory domain trust enumeration using nltest, a built-in Windows tool frequently used by adversaries during reconnaissance to map forest and domain trusts for lateral movement planning.',
 'MEDIUM','SIGMA','T1482','Discovery','Domain Trust Discovery',
 ARRAY['AU-12','SI-4','AC-6'],
 ARRAY['Windows Event Logs (4688)','Sysmon Event ID 1'],
 'title: Domain Trust Discovery via nltest
status: stable
logsource:
  category: process_creation
  product: windows
detection:
  selection:
    Image|endswith: ''\nltest.exe''
    CommandLine|contains:
      - ''/domain_trusts''
      - ''/trusted_domains''
      - ''/all_trusts''
      - ''/dclist''
  condition: selection
level: medium',
 'SIGMA',ARRAY['domain-trust','nltest','discovery','active-directory'],0.8,15.0,3.0,TRUE,NULL),

('DET-0097','Rundll32 Remote or Suspicious DLL Execution',
 'Detects abuse of rundll32.exe to execute DLLs from network paths, temp directories, or with suspicious export names, a common living-off-the-land technique for executing malicious payloads.',
 'HIGH','SIGMA','T1218.011','Defense Evasion','System Binary Proxy Execution: Rundll32',
 ARRAY['CM-7','SI-3','AU-12'],
 ARRAY['Windows Event Logs (4688)','Sysmon Event ID 1'],
 'title: Rundll32 Suspicious Execution
status: stable
logsource:
  category: process_creation
  product: windows
detection:
  selection:
    Image|endswith: ''\rundll32.exe''
    CommandLine|contains:
      - ''\\\\''
      - ''\temp\''
      - ''\appdata\''
      - ''javascript:''
      - ''shell32.dll,ShellExec_RunDLL''
  condition: selection
falsepositives:
  - Rare legitimate use of network DLLs
level: high',
 'SIGMA',ARRAY['rundll32','lolbas','defense-evasion','windows'],2.0,18.0,2.0,TRUE,NULL),

('DET-0098','Certutil Base64 Decode or Download',
 'Detects abuse of the built-in certutil.exe binary for base64 decoding of payloads or downloading files from the internet, commonly used to bypass application whitelisting and download droppers.',
 'HIGH','SIGMA','T1105','Command and Control','Ingress Tool Transfer',
 ARRAY['CM-7','SI-3','SC-7'],
 ARRAY['Windows Event Logs (4688)','Sysmon Event ID 1'],
 'title: Certutil Decode or Download
status: stable
logsource:
  category: process_creation
  product: windows
detection:
  selection:
    Image|endswith: ''\certutil.exe''
    CommandLine|contains:
      - ''-decode''
      - ''-decodehex''
      - ''-urlcache''
      - ''-verifyctl''
      - ''http://''
      - ''https://''
  condition: selection
level: high',
 'SIGMA',ARRAY['certutil','lolbas','download','defense-evasion'],1.0,10.0,1.5,TRUE,NULL),

('DET-0099','New Remote Service Created',
 'Detects creation of new Windows services remotely via the Service Control Manager, which is used by PsExec, Impacket, and other lateral movement tools as a remote code execution primitive.',
 'HIGH','SIGMA','T1543.003','Persistence','Create or Modify System Process: Windows Service',
 ARRAY['CM-7','SI-3','AU-12'],
 ARRAY['Windows System Event Logs (7045)','Sysmon Event ID 1'],
 'title: Remote Service Created
status: stable
logsource:
  product: windows
  service: system
detection:
  selection:
    EventID: 7045
    ImagePath|contains:
      - ''\\cmd.exe''
      - ''\\powershell.exe''
      - ''\users\''
      - ''\temp\''
      - ''%temp%''
  condition: selection
falsepositives:
  - Legitimate remote administration tools
level: high',
 'SIGMA',ARRAY['service-creation','lateral-movement','persistence','windows'],0.5,7.0,1.5,TRUE,NULL),

('DET-0100','AppLocker or WDAC Policy Bypass via PsExec or COM',
 'Detects attempts to bypass application control policies including AppLocker and Windows Defender Application Control using known bypass techniques such as COM object instantiation or signed binary abuse.',
 'HIGH','SIGMA','T1218','Defense Evasion','System Binary Proxy Execution',
 ARRAY['CM-7','SI-3','AU-12'],
 ARRAY['AppLocker Event Logs (8003,8004,8006,8007)','Sysmon Event ID 1'],
 'title: AppLocker Bypass Technique
status: stable
logsource:
  product: windows
  service: applocker
detection:
  selection_block:
    EventID:
      - 8003
      - 8004
      - 8006
      - 8007
  selection_process:
    Image|endswith:
      - ''\regsvr32.exe''
      - ''\mshta.exe''
      - ''\wscript.exe''
      - ''\cscript.exe''
      - ''\installutil.exe''
      - ''\MSBuild.exe''
  condition: selection_block and selection_process
level: high',
 'SIGMA',ARRAY['applocker','bypass','defense-evasion','application-control'],0.6,8.0,2.0,TRUE,NULL);

-- ── Verification ──────────────────────────────────────────────────────────────

DO $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM "detections" WHERE "is_global" = TRUE;
  IF v_count < 100 THEN
    RAISE EXCEPTION 'Seed verification failed: expected 100 global detections, found %', v_count;
  END IF;
  RAISE NOTICE 'Detection seed complete: % global rules inserted', v_count;
END $$;
