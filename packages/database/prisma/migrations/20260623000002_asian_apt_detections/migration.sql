-- ============================================================
--  Asian APT Detection Pack + Hunt Playbooks
--  Source: Kaspersky "Modern Asian APT Groups TTPs" (370pp)
--          MITRE "Threat Modeling with ATT&CK" (56pp)
--  10 global SIEM detections (DET-0579 – DET-0588) — Splunk SPL
--  10 global hunt playbooks  (PBK-0009 – PBK-0018)
-- ============================================================

-- ── Detections (DET-0101 – DET-0110) ─────────────────────────────────────────

INSERT INTO "detections" (
  "rule_id","name","description","severity","platform",
  "mitre_attack_id","mitre_tactic","mitre_technique",
  "nist_controls","data_sources","query","query_language","tags",
  "expected_alerts_per_day","expected_fp_rate","expected_mttd_hours",
  "is_global","tenant_id"
) VALUES

-- DET-0579 ─────────────────────────────────────────────────────────────────
('DET-0579','Critical Windows Process Tree Anomaly',
 'Detects Windows critical system processes (svchost, lsass, csrss, smss, winlogon) spawning unexpected child processes such as cmd.exe or PowerShell. Observed across all documented Asian APT groups using Process Hollowing and DLL side-loading. svchost.exe in particular must always carry a -k flag — its absence is a near-certain indicator of masquerading or hollowing.',
 'CRITICAL','SPLUNK','T1055.012','Defense Evasion','Process Injection: Process Hollowing',
 ARRAY['SI-3','CM-7','AU-2'],
 ARRAY['Sysmon (Event ID 1)','Windows Security Event Logs (4688)'],
 'index=windows EventCode=4688
  (
    (ParentProcessName IN ("*\\lsass.exe","*\\csrss.exe","*\\smss.exe","*\\winlogon.exe")
     AND NewProcessName IN ("*\\cmd.exe","*\\powershell.exe","*\\wscript.exe","*\\cscript.exe","*\\mshta.exe","*\\net.exe","*\\net1.exe"))
    OR
    (NewProcessName="*\\svchost.exe" AND NOT (CommandLine="*-k *" OR CommandLine="* /k *"))
    OR
    (ParentProcessName="*\\svchost.exe"
     AND NewProcessName IN ("*\\cmd.exe","*\\powershell.exe","*\\wscript.exe")
     AND NOT CommandLine IN ("*MsMpEng*","*WerFault*","*SoundSrv*","*TimeSrv*"))
  )
| eval risk=case(
    match(ParentProcessName,"lsass|csrss|smss"),"CRITICAL",
    NOT match(CommandLine,"-k "),  "HIGH",
    1=1,"HIGH"
  )
| table _time, host, user, ParentProcessName, NewProcessName, CommandLine, risk
| sort -_time',
 'SPL',ARRAY['process-hollowing','masquerading','apt','asian-apt','windows'],
 0.5, 3.0, 0.3, TRUE, NULL),

-- DET-0580 ─────────────────────────────────────────────────────────────────
('DET-0580','LSASS Memory Dump via comsvcs.dll MiniDump',
 'Detects the specific pattern of using comsvcs.dll MiniDump function via rundll32 to create a memory dump of the LSASS process. This is a signature technique observed in Stone Panda (APT10), Emissary Panda (APT27), and APT41 incidents documented by Kaspersky. Zero expected false positives in production environments.',
 'CRITICAL','SPLUNK','T1003.001','Credential Access','OS Credential Dumping: LSASS Memory',
 ARRAY['IA-5','SI-3','AU-2'],
 ARRAY['Sysmon (Event ID 1)','Windows Security Event Logs (4688)','Sysmon (Event ID 10)'],
 'index=windows
  (
    (EventCode=4688
     NewProcessName="*\\rundll32.exe"
     (CommandLine="*comsvcs*MiniDump*" OR CommandLine="*comsvcs*minidump*" OR CommandLine="*#24*"))
    OR
    (EventCode=10
     TargetImage="*\\lsass.exe"
     SourceImage="*\\rundll32.exe"
     GrantedAccess IN ("0x1fffff","0x1f1fff","0x1010","0x1038","0x1410"))
    OR
    (EventCode=4688
     NewProcessName="*\\rundll32.exe"
     CommandLine="*lsass*")
  )
| eval technique=case(
    match(CommandLine,"comsvcs"),"comsvcs.dll MiniDump (T1003.001)",
    match(CommandLine,"#24"),    "Ordinal call comsvcs.dll (T1003.001)",
    EventCode=10,                "LSASS handle via rundll32 (T1003.001)",
    1=1,"LSASS Memory Access"
  )
| table _time, host, user, NewProcessName, CommandLine, GrantedAccess, technique
| sort -_time',
 'SPL',ARRAY['lsass','comsvcs','credential-dumping','apt','asian-apt'],
 0.1, 0.5, 0.2, TRUE, NULL),

-- DET-0581 ─────────────────────────────────────────────────────────────────
('DET-0581','PowerShell Windows Defender Exclusion Added',
 'Detects PowerShell commands adding paths, processes, or extensions to Windows Defender exclusions via Set-MpPreference or Add-MpPreference. This pre-execution staging technique was observed in every major Asian APT campaign documented by Kaspersky — attackers add their own staging directory to Defender exclusions before dropping payloads.',
 'CRITICAL','SPLUNK','T1562.001','Defense Evasion','Impair Defenses: Disable or Modify Tools',
 ARRAY['SI-3','CM-7','AU-12'],
 ARRAY['Windows Security Event Logs (4688)','PowerShell Script Block Logging (4104)'],
 'index=windows
  (
    (EventCode=4688
     NewProcessName="*\\powershell.exe"
     (CommandLine="*Add-MpPreference*Exclusion*"
      OR CommandLine="*Set-MpPreference*Exclusion*"
      OR CommandLine="*Set-MpPreference*Disable*True*"
      OR CommandLine="*DisableRealtimeMonitoring*$true*"
      OR CommandLine="*DisableIOAVProtection*$true*"))
    OR
    (EventCode=4104
     (ScriptBlockText="*Add-MpPreference*ExclusionPath*"
      OR ScriptBlockText="*Add-MpPreference*ExclusionProcess*"
      OR ScriptBlockText="*Set-MpPreference*DisableRealtimeMonitoring*"))
    OR
    (EventCode=13
     TargetObject="*\\Windows Defender\\Real-Time Protection\\DisableRealtimeMonitoring"
     Details="DWORD (0x00000001)")
  )
| eval method=case(
    EventCode=4688, "PowerShell Process (4688)",
    EventCode=4104, "Script Block Log (4104)",
    EventCode=13,   "Registry Modification (4657)"
  )
| rex field=CommandLine "Exclusion(?:Path|Process|Extension)\s+[''\"]*(?P<excluded_path>[^''\"]+)"
| table _time, host, user, CommandLine, excluded_path, method
| sort -_time',
 'SPL',ARRAY['defender-bypass','exclusion','apt','asian-apt','pre-execution'],
 0.3, 2.0, 0.3, TRUE, NULL),

-- DET-0582 ─────────────────────────────────────────────────────────────────
('DET-0582','Shell Spawned by Office or Browser Process',
 'Detects Microsoft Office applications and browsers spawning command interpreters (cmd, PowerShell, wscript, mshta). This is the primary initial access delivery chain used by Asian APT groups targeting healthcare and government sectors — spearphishing attachments with embedded macros or exploits trigger this parent-child relationship.',
 'HIGH','SPLUNK','T1566.001','Initial Access','Phishing: Spearphishing Attachment',
 ARRAY['SI-3','CM-7','AU-2'],
 ARRAY['Sysmon (Event ID 1)','Windows Security Event Logs (4688)'],
 'index=windows EventCode=4688
  ParentProcessName IN (
    "*\\WINWORD.EXE","*\\EXCEL.EXE","*\\POWERPNT.EXE",
    "*\\MSACCESS.EXE","*\\OUTLOOK.EXE","*\\MSPUB.EXE",
    "*\\chrome.exe","*\\msedge.exe","*\\firefox.exe","*\\iexplore.exe",
    "*\\acrord32.exe","*\\AcroRd32.exe","*\\FoxitReader.exe"
  )
  NewProcessName IN (
    "*\\cmd.exe","*\\powershell.exe","*\\wscript.exe",
    "*\\cscript.exe","*\\mshta.exe","*\\certutil.exe",
    "*\\regsvr32.exe","*\\rundll32.exe","*\\bitsadmin.exe"
  )
| eval parent_app=case(
    match(ParentProcessName,"(?i)WINWORD|EXCEL|POWERPNT|MSACCESS|OUTLOOK|MSPUB"), "Office",
    match(ParentProcessName,"(?i)chrome|msedge|firefox|iexplore"), "Browser",
    match(ParentProcessName,"(?i)acro|foxit"), "PDF Reader",
    1=1,"Other"
  )
| table _time, host, user, parent_app, ParentProcessName, NewProcessName, CommandLine
| sort -_time',
 'SPL',ARRAY['phishing','initial-access','office-macro','spearphishing','apt'],
 1.5, 8.0, 0.5, TRUE, NULL),

-- DET-0583 ─────────────────────────────────────────────────────────────────
('DET-0583','Bitsadmin Tool Transfer from External Host',
 'Detects bitsadmin.exe being used to download files from external (non-Microsoft, non-Windows-Update) hosts. Documented across multiple Asian APT campaigns as an alternative to certutil for bypassing proxy controls. Also catches BITS job creation pointing to IP addresses, a pattern used by Override Panda (APT30).',
 'HIGH','SPLUNK','T1197','Defense Evasion','BITS Jobs',
 ARRAY['CM-7','SI-3','SC-7'],
 ARRAY['Sysmon (Event ID 1)','Windows Security Event Logs (4688)','Windows BITS Event Logs'],
 'index=windows
  (
    (EventCode=4688 NewProcessName="*\\bitsadmin.exe"
     (CommandLine="*/Transfer*" OR CommandLine="*/Create*" OR CommandLine="*/AddFile*")
     NOT (CommandLine="*microsoft.com*" OR CommandLine="*windowsupdate.com*"
          OR CommandLine="*office.com*" OR CommandLine="*akamai*"))
    OR
    (source="WinEventLog:Microsoft-Windows-Bits-Client/Operational"
     EventCode=59
     NOT (RemoteUrl="*microsoft.com*" OR RemoteUrl="*windowsupdate.com*"
          OR RemoteUrl="*windows.com*" OR RemoteUrl="*akamai*"))
    OR
    (EventCode=4688 NewProcessName="*\\powershell.exe"
     CommandLine="*Start-BitsTransfer*"
     NOT CommandLine="*microsoft.com*")
  )
| rex field=CommandLine "(?P<remote_url>https?://[^\s''\"]+)"
| rex field=RemoteUrl "(?P<remote_url>.+)"
| eval dest=coalesce(remote_url,"(check BITS event)")
| table _time, host, user, NewProcessName, CommandLine, dest
| sort -_time',
 'SPL',ARRAY['bits','bitsadmin','download-cradle','apt','asian-apt'],
 0.8, 6.0, 1.0, TRUE, NULL),

-- DET-0584 ─────────────────────────────────────────────────────────────────
('DET-0584','WMI Permanent Event Subscription Created',
 'Detects creation of WMI permanent event subscriptions (EventFilter → EventConsumer → Binding) used for fileless persistence. Documented by Kaspersky in APT41 and ToddyCat incidents. WMI subscriptions survive reboots without registry run key modifications, making them invisible to most basic persistence scanners.',
 'HIGH','SPLUNK','T1546.003','Persistence','Event Triggered Execution: Windows Management Instrumentation Event Subscription',
 ARRAY['CM-7','SI-3','AU-12'],
 ARRAY['WMI Activity Event Logs (5857-5861)','Sysmon (Event ID 19,20,21)'],
 'index=windows
  (
    (EventCode=5861
     (Consumer="*CommandLineEventConsumer*" OR Consumer="*ActiveScriptEventConsumer*"))
    OR
    (EventCode IN (19,20,21))
    OR
    (EventCode=4688 ParentProcessName="*\\wmiprvse.exe"
     NewProcessName IN ("*\\cmd.exe","*\\powershell.exe","*\\wscript.exe","*\\cscript.exe","*\\mshta.exe")
     NOT CommandLine IN ("*msiexec*","*TrustedInstaller*","*WerFault*"))
    OR
    (EventCode=4688 NewProcessName="*\\mofcomp.exe"
     NOT CommandLine IN ("*system32*","*windows*"))
  )
| eval event_type=case(
    EventCode=5861,"WMI Consumer Created (5861)",
    EventCode=19,  "Sysmon WmiEvent Filter (19)",
    EventCode=20,  "Sysmon WmiEvent Consumer (20)",
    EventCode=21,  "Sysmon WmiEvent Binding (21)",
    EventCode=4688 AND match(ParentProcessName,"wmiprvse"), "WMI Remote Shell Execution",
    EventCode=4688 AND match(NewProcessName,"mofcomp"),    "MOF Compiled (Persistence Install)",
    1=1, "WMI Suspicious Activity"
  )
| table _time, host, user, event_type, CommandLine, Consumer
| sort -_time',
 'SPL',ARRAY['wmi','event-subscription','persistence','apt','fileless'],
 0.4, 3.0, 0.8, TRUE, NULL),

-- DET-0585 ─────────────────────────────────────────────────────────────────
('DET-0585','Windows Service Installed with Shell Binary or Unusual Path',
 'Detects Windows service installation where the service binary is a shell interpreter (cmd.exe, PowerShell) or runs from a non-system directory. The "cmd /K start" service pattern is a signature of Dark Seoul group and Lotus Panda (Naikon APT). Services from AppData, Temp, or ProgramData paths are near-certain indicators of malicious persistence.',
 'HIGH','SPLUNK','T1543.003','Persistence','Create or Modify System Process: Windows Service',
 ARRAY['CM-7','SI-3','AU-12'],
 ARRAY['Windows System Event Logs (7045)','Sysmon (Event ID 1)'],
 'index=windows EventCode=7045
  (
    ServiceFileName IN ("*\\cmd.exe*","*\\powershell.exe*","*\\wscript.exe*","*\\cscript.exe*","*\\mshta.exe*")
    OR ServiceFileName IN ("*/K start*","*/c start*")
    OR (NOT ServiceFileName IN (
          "*\\Windows\\*","*\\Program Files\\*","*\\Program Files (x86)\\*",
          "*\\Sysmon*","*\\Windows Defender\\*","*\\Microsoft\\*"
        )
        AND ServiceFileName != ""
        AND NOT match(ServiceFileName,"(?i)^\"?[A-Z]:\\\\Windows"))
    OR ServiceFileName IN ("*\\AppData\\*","*\\Temp\\*","*\\ProgramData\\*","*\\Users\\Public\\*")
  )
| eval risk=case(
    match(ServiceFileName,"cmd\.exe|powershell\.exe|wscript\.exe"), "CRITICAL — Shell as service binary",
    match(ServiceFileName,"AppData|\\\\Temp\\\\|ProgramData"), "HIGH — Service from unusual path",
    1=1, "HIGH — Non-system service path"
  )
| table _time, host, user, ServiceName, ServiceFileName, ServiceType, risk
| sort -_time',
 'SPL',ARRAY['service-creation','persistence','masquerading','dark-seoul','asian-apt'],
 1.0, 7.0, 1.5, TRUE, NULL),

-- DET-0586 ─────────────────────────────────────────────────────────────────
('DET-0586','NTDS.dit Extraction via ntdsutil or Volume Shadow Copy',
 'Detects extraction of the Active Directory credential database (NTDS.dit) via ntdsutil IFM or by copying from a Volume Shadow Copy path. This technique provides offline cracking of all domain account hashes. Documented in Emissary Panda (APT27) and HAFNIUM incidents from the Kaspersky report. Highly targeted, near-zero false positives.',
 'CRITICAL','SPLUNK','T1003.003','Credential Access','OS Credential Dumping: NTDS',
 ARRAY['IA-5','SI-3','AU-2'],
 ARRAY['Windows Security Event Logs (4688)','Sysmon (Event ID 1)','Windows File System Audit (4663)'],
 'index=windows
  (
    (EventCode=4688 NewProcessName="*\\ntdsutil.exe"
     (CommandLine="*ifm*" OR CommandLine="*create full*" OR CommandLine="*activate instance ntds*"))
    OR
    (EventCode=4688
     (CommandLine="*\\GLOBALROOT\\Device\\HarddiskVolumeShadowCopy*ntds.dit*"
      OR CommandLine="*vssadmin*ntds*"
      OR CommandLine="*copy*ntds.dit*"
      OR CommandLine="*robocopy*ntds.dit*"))
    OR
    (EventCode=4663
     ObjectName IN ("*\\NTDS\\ntds.dit","*\\HarddiskVolumeShadowCopy*\\ntds.dit")
     NOT ProcessName IN ("*\\ntdsa.dll","*\\lsass.exe","*\\sqlservr.exe"))
    OR
    (EventCode=4688 CommandLine="*esentutl*ntds.dit*")
  )
| eval technique=case(
    match(NewProcessName,"ntdsutil"), "ntdsutil IFM (T1003.003)",
    match(CommandLine,"HarddiskVolumeShadowCopy"), "VSS Copy ntds.dit (T1003.003)",
    match(CommandLine,"esentutl"), "esentutl NTDS copy (T1003.003)",
    EventCode=4663, "Direct NTDS.dit File Access",
    1=1, "NTDS.dit Access"
  )
| table _time, host, user, technique, CommandLine, ObjectName
| sort -_time',
 'SPL',ARRAY['ntds','active-directory','credential-dumping','apt','domain-takeover'],
 0.05, 0.5, 0.2, TRUE, NULL),

-- DET-0587 ─────────────────────────────────────────────────────────────────
('DET-0587','Archive Tool Staging Files in Recycle Bin',
 'Detects archiver tools (WinRAR, 7-Zip) creating output archives inside C:\$Recycle.Bin, a unique pre-exfiltration staging behavior documented across multiple Asian APT incidents by Kaspersky. Attackers move collected documents to the Recycle Bin before exfiltrating to cloud storage or external C2, exploiting the fact that many DLP and file-audit tools ignore this directory.',
 'HIGH','SPLUNK','T1560.001','Collection','Archive Collected Data: Archive via Utility',
 ARRAY['AU-12','SI-4','SC-7'],
 ARRAY['Sysmon (Event ID 1)','Windows File System Audit (4663)','Sysmon (Event ID 11)'],
 'index=windows
  (
    (EventCode=4688
     NewProcessName IN ("*\\rar.exe","*\\WinRAR.exe","*\\7z.exe","*\\7za.exe","*\\winzip.exe")
     CommandLine="*$Recycle*")
    OR
    (EventCode=4688
     NewProcessName IN ("*\\rar.exe","*\\WinRAR.exe","*\\7z.exe","*\\7za.exe")
     (CommandLine="*\\$R*" OR CommandLine IN ("*a *","*e *","*x *") AND CommandLine="*Recycle*"))
    OR
    (EventCode=11
     TargetFilename="*\\$Recycle.Bin\\*"
     TargetFilename IN ("*.rar","*.zip","*.7z","*.gz","*.tar","*.cab"))
    OR
    (EventCode=4663
     ObjectName="*\\$Recycle.Bin\\*"
     ObjectName IN ("*.rar","*.zip","*.7z")
     NOT ProcessName IN ("*\\explorer.exe","*\\recycle*"))
  )
| eval staging_dir=replace(CommandLine,".*(\\\$Recycle[^\s''\"]+).*","\1")
| table _time, host, user, NewProcessName, CommandLine, TargetFilename, staging_dir
| sort -_time',
 'SPL',ARRAY['collection','staging','recycle-bin','exfil-staging','asian-apt'],
 0.2, 1.5, 0.5, TRUE, NULL),

-- DET-0588 ─────────────────────────────────────────────────────────────────
('DET-0588','SSH Port Forwarding or Tunneling Detected',
 'Detects SSH client processes (ssh.exe, plink.exe, putty.exe) launched with port forwarding flags (-L, -R, -D) indicating tunneling or SOCKS proxy creation. Used by Asian APT groups to pivot from compromised DMZ hosts to isolated internal segments that are otherwise unreachable. The -R (reverse tunnel) flag is especially high-fidelity as it requires attacker-controlled infrastructure.',
 'HIGH','SPLUNK','T1572','Command and Control','Protocol Tunneling',
 ARRAY['SC-7','SI-4','AU-12'],
 ARRAY['Sysmon (Event ID 1)','Windows Security Event Logs (4688)','Network Flow Logs'],
 'index=windows EventCode=4688
  NewProcessName IN ("*\\ssh.exe","*\\plink.exe","*\\putty.exe","*\\puttygen.exe","*\\kitty.exe")
  (
    CommandLine IN ("* -L *","* -R *","* -D *","*-L*:*:*","*-R*:*:*","*-D *")
    OR CommandLine="*-N *"
    OR CommandLine="*-w *"
  )
| eval tunnel_type=case(
    match(CommandLine," -L |-L[0-9]"), "Local Port Forward (inbound to target)",
    match(CommandLine," -R |-R[0-9]"), "Reverse Port Forward (CRITICAL — attacker C2 tunnel)",
    match(CommandLine," -D "),         "Dynamic SOCKS Proxy (pivoting)",
    match(CommandLine," -N "),         "No-command tunnel (pure pivot)",
    1=1, "SSH Tunnel"
  )
| eval risk=if(match(tunnel_type,"Reverse"),"CRITICAL","HIGH")
| table _time, host, user, NewProcessName, CommandLine, tunnel_type, risk
| sort -_time',
 'SPL',ARRAY['ssh-tunnel','pivoting','c2','apt','protocol-tunneling'],
 0.6, 5.0, 1.0, TRUE, NULL)

ON CONFLICT ("rule_id") DO NOTHING;


-- ── Hunt Playbooks (PBK-0009 – PBK-0018) ─────────────────────────────────────
-- Source: Kaspersky Asian APT TTP report — intelligence-driven hunt hypotheses
-- These supplement the 8 existing global playbooks with APT-specific scenarios.

INSERT INTO th_playbooks (
  id, tenant_id, playbook_ref, title, description, category,
  mitre_tactic_id, mitre_tactic, mitre_techniques,
  severity, estimated_hours, tags, queries, is_global
) VALUES

-- PBK-0009 ─────────────────────────────────────────────────────────────────
(gen_random_uuid(), NULL, 'PBK-0009',
 'Asian APT Reconnaissance Script Execution',
 'Hunt for the characteristic recon batch script observed across Stone Panda (APT10), Emissary Panda (APT27), and APT41 incidents. Attackers execute 15-20 system discovery commands in rapid sequence and save outputs to files in staging directories such as C:\Windows\Web\ or C:\Intel\. Hypothesis: an attacker with foothold has executed the standard Asian APT recon playbook within the last 72 hours.',
 'Threat Intelligence', 'TA0007', 'Discovery',
 ARRAY['T1082','T1016','T1049','T1069','T1087','T1482','T1033','T1057'],
 'CRITICAL', 8,
 ARRAY['asian-apt','discovery','recon-script','apt10','apt27','apt41'],
 '[
   {
     "name": "Batch Recon Command Sequence",
     "description": "Hunt for the Asian APT reconnaissance sequence: systeminfo → netstat → tasklist → net group/user → nltest executed in rapid succession within 5 minutes on a single host",
     "query": "index=windows EventCode=4688 NewProcessName IN (\"*\\\\systeminfo.exe\",\"*\\\\netstat.exe\",\"*\\\\tasklist.exe\",\"*\\\\net.exe\",\"*\\\\net1.exe\",\"*\\\\nltest.exe\",\"*\\\\ipconfig.exe\",\"*\\\\arp.exe\",\"*\\\\route.exe\",\"*\\\\whoami.exe\") | bucket _time span=5m | stats dc(NewProcessName) as recon_cmds, values(NewProcessName) as cmds, values(CommandLine) as args by host, _time | where recon_cmds >= 5 | sort -recon_cmds",
     "earliest": "-72h",
     "latest": "now"
   },
   {
     "name": "Recon Output Staged to File",
     "description": "Hunt for recon output redirected to text files in APT staging directories (C:\\Windows\\Web, C:\\Intel, C:\\perflogs, C:\\Windows\\help\\help)",
     "query": "index=windows EventCode=4688 (CommandLine=\"*systeminfo*>*\" OR CommandLine=\"*netstat*>*\" OR CommandLine=\"*tasklist*>*\" OR CommandLine=\"*net user*>*\" OR CommandLine=\"*ipconfig*>*\") (CommandLine=\"*Windows\\\\Web*\" OR CommandLine=\"*\\\\Intel\\\\*\" OR CommandLine=\"*perflogs*\" OR CommandLine=\"*help\\\\help*\") | stats count by host, user, CommandLine, _time | sort -_time",
     "earliest": "-72h",
     "latest": "now"
   },
   {
     "name": "nltest Domain Trust Enumeration",
     "description": "Hunt for nltest.exe domain trust discovery — a high-fidelity APT indicator when run by non-admin accounts or from unusual parent processes",
     "query": "index=windows EventCode=4688 NewProcessName=\"*\\\\nltest.exe\" (CommandLine=\"*/domain_trusts*\" OR CommandLine=\"*/dclist*\" OR CommandLine=\"*/dsgetdc*\") | stats count by host, user, ParentProcessName, CommandLine, _time | sort -_time",
     "earliest": "-72h",
     "latest": "now"
   },
   {
     "name": "USB and Network Share Enumeration",
     "description": "Hunt for registry queries targeting USB history and network settings — part of the documented APT recon batch pattern",
     "query": "index=windows EventCode=4688 NewProcessName=\"*\\\\reg.exe\" (CommandLine=\"*USBSTOR*\" OR CommandLine=\"*MountedDevices*\" OR CommandLine=\"*Internet Settings*\" OR CommandLine=\"*NetworkList*\") | stats count by host, user, CommandLine, _time | sort -_time",
     "earliest": "-72h",
     "latest": "now"
   }
 ]'::jsonb, TRUE),

-- PBK-0010 ─────────────────────────────────────────────────────────────────
(gen_random_uuid(), NULL, 'PBK-0010',
 'ShadowPad / PlugX DLL Side-Loading',
 'Hunt for DLL side-loading used to load ShadowPad and PlugX backdoors — the primary implants of Mustang Panda, APT41, and Stone Panda (APT10). The technique plants a malicious DLL alongside a legitimate signed executable in directories like C:\ProgramData\ or C:\Program Files\. Hypothesis: a compromised host is silently running ShadowPad or PlugX via a legitimate security or software vendor executable.',
 'Malware', 'TA0005', 'Defense Evasion',
 ARRAY['T1574.002','T1574.001','T1036.005','T1055'],
 'CRITICAL', 10,
 ARRAY['shadowpad','plugx','dll-sideloading','mustang-panda','apt41','apt10'],
 '[
   {
     "name": "DLL Created in ProgramData by Non-Installer",
     "description": "Hunt for DLL files created in C:\\ProgramData or C:\\Program Files by non-installer processes — primary ShadowPad/PlugX drop location",
     "query": "index=windows EventCode=11 TargetFilename IN (\"*\\\\ProgramData\\\\*.dll\",\"*\\\\Program Files\\\\*.dll\",\"*\\\\Program Files (x86)\\\\*.dll\") NOT (Image IN (\"*\\\\msiexec.exe\",\"*\\\\setup.exe\",\"*\\\\install*\",\"*\\\\uninstall*\") OR User=\"NT AUTHORITY\\\\SYSTEM\") | stats count by host, Image, TargetFilename, _time | sort -_time",
     "earliest": "-7d",
     "latest": "now"
   },
   {
     "name": "Legitimate Signed Binary Loading Unsigned DLL",
     "description": "Hunt for digitally signed binaries loading DLLs from non-standard paths — the side-loading pattern used to abuse trusted processes",
     "query": "index=windows EventCode=7 (ImageLoaded IN (\"*\\\\ProgramData\\\\*.dll\",\"*\\\\AppData\\\\*.dll\",\"*\\\\Temp\\\\*.dll\") AND Signed=\"true\" AND Signature!=\"Microsoft*\") | stats count by host, Image, ImageLoaded, Signed, Signature, _time | sort -_time",
     "earliest": "-7d",
     "latest": "now"
   },
   {
     "name": "Security Product Name Masquerade",
     "description": "Hunt for files or processes named after security products (avast, avg, kaspersky, norton, sophos, avp) in unexpected paths — PlugX/ShadowPad commonly masquerades as AV components",
     "query": "index=windows EventCode IN (4688,11) (NewProcessName IN (\"*avp*\",\"*avpui*\",\"*avast*\",\"*avg*\",\"*norton*\",\"*sophos*\") OR TargetFilename IN (\"*avp*\",\"*avpui*\",\"*wsc.dll\",\"*sxIn.dll\")) NOT (NewProcessName IN (\"*\\\\Kaspersky*\",\"*\\\\AVAST*\",\"*\\\\AVG*\",\"*\\\\Norton*\",\"*\\\\Sophos*\") OR TargetFilename IN (\"*\\\\Kaspersky*\",\"*\\\\AVAST*\")) | stats count by host, user, NewProcessName, TargetFilename, _time | sort -_time",
     "earliest": "-7d",
     "latest": "now"
   },
   {
     "name": "IKEEXT or SessionEnv DLL Hijacking Path",
     "description": "Hunt for known DLL hijacking paths for IKEEXT (wlbsctrl.dll) and SessionEnv (TSMSISrv.dll, TSVIPSrv.dll) services — documented Asian APT persistence technique",
     "query": "index=windows EventCode=11 TargetFilename IN (\"*\\\\System32\\\\wlbsctrl.dll\",\"*\\\\System32\\\\TSMSISrv.dll\",\"*\\\\System32\\\\TSVIPSrv.dll\",\"*\\\\System32\\\\rasauto.dll\",\"*\\\\System32\\\\rasman.dll\") NOT Image IN (\"*\\\\TrustedInstaller.exe\",\"*\\\\wusa.exe\") | stats count by host, Image, TargetFilename, _time | sort -_time",
     "earliest": "-30d",
     "latest": "now"
   }
 ]'::jsonb, TRUE),

-- PBK-0011 ─────────────────────────────────────────────────────────────────
(gen_random_uuid(), NULL, 'PBK-0011',
 'Cobalt Strike Beacon via Obfuscated PowerShell',
 'Hunt for Cobalt Strike stager execution using GzipStream-compressed, Base64-encoded PowerShell — the exact delivery method documented in the Indonesian APT41 incident and multiple APT10 campaigns. Hypothesis: Cobalt Strike shellcode is running inside a legitimate process on a compromised host, communicating with attacker C2 over HTTPS with sleep jitter.',
 'Malware', 'TA0002', 'Execution',
 ARRAY['T1059.001','T1027','T1071.001','T1055'],
 'CRITICAL', 6,
 ARRAY['cobalt-strike','powershell','gzipstream','apt41','apt10','c2'],
 '[
   {
     "name": "GzipStream PowerShell Decompression Pattern",
     "description": "Hunt for PowerShell using GzipStream or MemoryStream decompression — Cobalt Strike stager signature",
     "query": "index=windows EventCode=4104 (ScriptBlockText=\"*GzipStream*\" OR ScriptBlockText=\"*IO.Compression*\" OR ScriptBlockText=\"*FromBase64String*MemoryStream*\" OR ScriptBlockText=\"*[IO.Compression.CompressionMode]::Decompress*\") | stats count by host, UserID, ScriptBlockText, _time | sort -_time",
     "earliest": "-7d",
     "latest": "now"
   },
   {
     "name": "Cobalt Strike Default Named Pipes",
     "description": "Hunt for Cobalt Strike default named pipe patterns used for inter-process communication between the beacon and post-exploitation modules",
     "query": "index=windows EventCode IN (17,18) PipeName IN (\"*MSSE-*\",\"*postex_*\",\"*msagent_*\",\"*status_*\",\"*SearchTextHarvester\",\"*ntsvcs*\",\"*DserNamePipe*\") | stats count by host, Image, PipeName, _time | sort -_time",
     "earliest": "-7d",
     "latest": "now"
   },
   {
     "name": "PowerShell HTTPS Beacon Jitter Pattern",
     "description": "Hunt for PowerShell or system processes making periodic HTTPS connections with consistent interval — beacon heartbeat pattern",
     "query": "index=network sourcetype=firewall (dest_port=443 OR dest_port=80) src IN [search index=windows EventCode=4688 NewProcessName=\"*\\\\powershell.exe\" | fields host | rename host as src] | bin _time span=5m | stats count by src, dest, _time | eventstats stdev(count) as jitter by src, dest | where jitter < 1.5 AND count > 3 | sort -count",
     "earliest": "-24h",
     "latest": "now"
   },
   {
     "name": "XOR-Encoded PowerShell Execution",
     "description": "Hunt for PowerShell commands using XOR decoding loops — a less common but documented Cobalt Strike and custom APT stager technique",
     "query": "index=windows EventCode IN (4688,4104) (CommandLine=\"*bxor*\" OR ScriptBlockText=\"*-bxor*\" OR ScriptBlockText=\"*[byte]*[byte]*\" OR CommandLine=\"*XOR*[char]*\") | stats count by host, user, CommandLine, ScriptBlockText, _time | sort -_time",
     "earliest": "-7d",
     "latest": "now"
   }
 ]'::jsonb, TRUE),

-- PBK-0012 ─────────────────────────────────────────────────────────────────
(gen_random_uuid(), NULL, 'PBK-0012',
 'APT Pre-Exfiltration Staging in Recycle Bin',
 'Hunt for the unique Asian APT behavior of staging collected archives in C:\$Recycle.Bin before exfiltrating to cloud storage or C2. Observed in 4 out of 11 APT groups in the Kaspersky report. The Recycle Bin is chosen because DLP solutions and file auditing tools commonly exclude it. Hypothesis: data has been collected and archived to the Recycle Bin in the last 48 hours awaiting exfiltration.',
 'Collection', 'TA0009', 'Collection',
 ARRAY['T1560.001','T1005','T1074','T1119'],
 'HIGH', 4,
 ARRAY['collection','staging','recycle-bin','pre-exfil','asian-apt'],
 '[
   {
     "name": "Archive Created in Recycle Bin",
     "description": "Hunt for archive files (rar, zip, 7z) being created inside C:\\$Recycle.Bin by non-Explorer processes — definitive APT staging indicator",
     "query": "index=windows EventCode=11 TargetFilename=\"*\\\\$Recycle.Bin\\\\*\" TargetFilename IN (\"*.rar\",\"*.zip\",\"*.7z\",\"*.gz\",\"*.tar\",\"*.cab\") NOT Image IN (\"*\\\\explorer.exe\",\"*\\\\SHCore.dll\") | stats count by host, Image, TargetFilename, _time | sort -_time",
     "earliest": "-48h",
     "latest": "now"
   },
   {
     "name": "Archiver Executed with Recycle Bin Output Path",
     "description": "Hunt for rar.exe, 7z.exe, or WinRAR with command-line output directed to Recycle Bin path",
     "query": "index=windows EventCode=4688 NewProcessName IN (\"*\\\\rar.exe\",\"*\\\\WinRAR.exe\",\"*\\\\7z.exe\",\"*\\\\7za.exe\") CommandLine=\"*$Recycle*\" | stats count by host, user, CommandLine, _time | sort -_time",
     "earliest": "-48h",
     "latest": "now"
   },
   {
     "name": "Document Files Moved to Recycle Bin by Non-Explorer Process",
     "description": "Hunt for mass movement of documents (pdf, docx, xlsx) to the Recycle Bin by shells or scripts — collection before archiving",
     "query": "index=windows EventCode=4663 ObjectName=\"*\\\\$Recycle.Bin\\\\*\" ObjectName IN (\"*.doc*\",\"*.xls*\",\"*.pdf\",\"*.ppt*\",\"*.txt\") NOT ProcessName IN (\"*\\\\explorer.exe\") | stats count by host, user, ProcessName, _time | where count > 10 | sort -count",
     "earliest": "-48h",
     "latest": "now"
   },
   {
     "name": "PowerShell Searching Recent Documents",
     "description": "Hunt for PowerShell Get-ChildItem scanning for documents modified in the last 7-14 days — document collection pre-staging",
     "query": "index=windows EventCode IN (4688,4104) (CommandLine=\"*Get-ChildItem*LastWriteTime*\" OR CommandLine=\"*Get-ChildItem*-Filter*.doc*\" OR ScriptBlockText=\"*LastWriteTime -gt*\" OR ScriptBlockText=\"*Get-ChildItem*recurse*\\.pdf\") | stats count by host, user, CommandLine, ScriptBlockText, _time | sort -_time",
     "earliest": "-7d",
     "latest": "now"
   }
 ]'::jsonb, TRUE),

-- PBK-0013 ─────────────────────────────────────────────────────────────────
(gen_random_uuid(), NULL, 'PBK-0013',
 'Fake Windows Service with cmd.exe Binary (Dark Seoul)',
 'Hunt for Windows services where the service binary is cmd.exe, PowerShell, or a shell script launched via "cmd /K start" — a unique signature of the Dark Seoul group and Lotus Panda (Naikon APT). These groups install services named to mimic legitimate Windows components (e.g., "Windows Host Management", "Windows Session Manager") but use shell interpreters as the actual binary.',
 'Malware', 'TA0003', 'Persistence',
 ARRAY['T1543.003','T1036.004','T1036.005'],
 'CRITICAL', 5,
 ARRAY['dark-seoul','lotus-panda','service-masquerade','persistence','asian-apt'],
 '[
   {
     "name": "Service with Shell Interpreter as Binary",
     "description": "Hunt for Windows services where the binary is cmd.exe, PowerShell, wscript, or mshta — a direct Dark Seoul signature",
     "query": "index=windows EventCode=7045 (ServiceFileName IN (\"*\\\\cmd.exe*\",\"*\\\\powershell.exe*\",\"*\\\\wscript.exe*\",\"*\\\\mshta.exe*\",\"*\\\\cscript.exe*\") OR ServiceFileName IN (\"*/K start*\",\"*/c *start*\")) | stats count by host, ServiceName, ServiceFileName, ServiceStartType, _time | sort -_time",
     "earliest": "-30d",
     "latest": "now"
   },
   {
     "name": "Service Binary from Non-System Directory",
     "description": "Hunt for newly installed services with binaries NOT in System32, SysWOW64, or Program Files — services from Temp, AppData, or ProgramData are always suspicious",
     "query": "index=windows EventCode=7045 NOT (ServiceFileName IN (\"*\\\\Windows\\\\System32\\\\*\",\"*\\\\Windows\\\\SysWOW64\\\\*\",\"*\\\\Program Files\\\\*\",\"*\\\\Program Files (x86)\\\\*\",\"*\\\\Windows\\\\Microsoft.NET\\\\*\")) NOT ServiceFileName IN (\"*Sysmon*\",\"*WinDefend*\",\"*MsMpEng*\",\"*sense*\") | stats count by host, ServiceName, ServiceFileName, ServiceType, _time | sort -_time",
     "earliest": "-30d",
     "latest": "now"
   },
   {
     "name": "Service Named to Mimic Windows Components",
     "description": "Hunt for service names that closely resemble legitimate Windows services but run from unusual paths — name-spoofing persistence",
     "query": "index=windows EventCode=7045 (ServiceName IN (\"*Windows Host*\",\"*Windows Session*\",\"*Windows Management*\",\"*Windows Service*\",\"*Windows Security*\",\"*Windows Update*\") AND NOT ServiceFileName IN (\"*\\\\Windows\\\\System32\\\\*\",\"*\\\\SysWOW64\\\\*\",\"*\\\\Program Files\\\\Windows*\")) | stats count by host, ServiceName, ServiceFileName, _time | sort -_time",
     "earliest": "-30d",
     "latest": "now"
   }
 ]'::jsonb, TRUE),

-- PBK-0014 ─────────────────────────────────────────────────────────────────
(gen_random_uuid(), NULL, 'PBK-0014',
 'BITS Jobs as C2 Download Cradle',
 'Hunt for abuse of Background Intelligent Transfer Service (BITS) to download second-stage payloads from attacker-controlled external hosts. Documented in APT30 (Override Panda) and APT10 (Stone Panda) campaigns. BITS transfers survive reboots, are not blocked by most web proxies, and use signed Windows binaries — making them a stealthy alternative to PowerShell download cradles.',
 'Malware', 'TA0005', 'Defense Evasion',
 ARRAY['T1197','T1105','T1059.003'],
 'HIGH', 4,
 ARRAY['bits','bitsadmin','download-cradle','apt30','apt10','c2'],
 '[
   {
     "name": "Bitsadmin Download from External IP",
     "description": "Hunt for bitsadmin.exe /Transfer or /AddFile pointing to external (non-Microsoft) hosts or raw IP addresses",
     "query": "index=windows EventCode=4688 NewProcessName=\"*\\\\bitsadmin.exe\" (CommandLine=\"*/Transfer*\" OR CommandLine=\"*/AddFile*\" OR CommandLine=\"*/Create*\") NOT (CommandLine IN (\"*microsoft.com*\",\"*windowsupdate.com*\",\"*windows.com*\",\"*office.com*\",\"*akamaized.net*\")) | rex field=CommandLine \"(?P<remote_url>https?://[^\\s''\\\"]+)\" | table _time, host, user, CommandLine, remote_url | sort -_time",
     "earliest": "-7d",
     "latest": "now"
   },
   {
     "name": "BITS Job Transfer Event to External Host",
     "description": "Hunt for BITS client operational log events showing completed transfers from non-Microsoft external URLs",
     "query": "index=windows source=\"WinEventLog:Microsoft-Windows-Bits-Client/Operational\" EventCode=59 NOT (RemoteUrl IN (\"*microsoft.com*\",\"*windowsupdate.com*\",\"*windows.com*\",\"*office.com*\",\"*akamai*\")) | stats count by host, user, RemoteUrl, LocalFile, _time | sort -_time",
     "earliest": "-7d",
     "latest": "now"
   },
   {
     "name": "PowerShell Start-BitsTransfer to External",
     "description": "Hunt for PowerShell Start-BitsTransfer cmdlet downloading from external hosts — PowerShell wrapper around BITS used by some APT stagers",
     "query": "index=windows EventCode IN (4688,4104) (CommandLine=\"*Start-BitsTransfer*\" OR ScriptBlockText=\"*Start-BitsTransfer*\") NOT (CommandLine IN (\"*microsoft.com*\",\"*windowsupdate.com*\") OR ScriptBlockText IN (\"*microsoft.com*\",\"*windowsupdate.com*\")) | rex field=CommandLine \"Source\\s+[''\\\"]+(?P<source_url>https?://[^''\\\"\\s]+)\" | stats count by host, user, CommandLine, source_url, _time | sort -_time",
     "earliest": "-7d",
     "latest": "now"
   }
 ]'::jsonb, TRUE),

-- PBK-0015 ─────────────────────────────────────────────────────────────────
(gen_random_uuid(), NULL, 'PBK-0015',
 'WMI Event Subscription Persistence Hunt',
 'Hunt for WMI permanent event subscription persistence — EventFilter, EventConsumer, and FilterToConsumerBinding objects — used by APT41 and ToddyCat to maintain access across reboots without touching registry Run keys. This technique is invisible to standard autoruns tools and survives AV/EDR tool removal unless the WMI repository is cleared.',
 'Persistence', 'TA0003', 'Persistence',
 ARRAY['T1546.003'],
 'HIGH', 6,
 ARRAY['wmi','event-subscription','persistence','apt41','toddycat','fileless'],
 '[
   {
     "name": "WMI Consumer Binding Event Log",
     "description": "Hunt for WMI EventConsumer creation events in the WMI Activity operational log — direct evidence of subscription persistence installation",
     "query": "index=windows source=\"WinEventLog:Microsoft-Windows-WMI-Activity/Operational\" EventCode=5861 (Consumer=\"*CommandLineEventConsumer*\" OR Consumer=\"*ActiveScriptEventConsumer*\") | rex field=Consumer \"CommandTemplate=(?P<cmd_template>[^;]+)\" | table _time, host, user, Consumer, cmd_template, _raw | sort -_time",
     "earliest": "-30d",
     "latest": "now"
   },
   {
     "name": "Sysmon WMI Event Filter/Consumer/Binding",
     "description": "Hunt for Sysmon WMI event subscription creation events (IDs 19, 20, 21) which capture filter creation, consumer creation, and binding",
     "query": "index=windows EventCode IN (19,20,21) | eval event_type=case(EventCode=19,\"EventFilter Created\",EventCode=20,\"EventConsumer Created\",EventCode=21,\"FilterToConsumerBinding\") | stats count by host, user, event_type, Name, Consumer, Filter, Operation, _time | sort -_time",
     "earliest": "-30d",
     "latest": "now"
   },
   {
     "name": "MOF File Compiled Outside System Directory",
     "description": "Hunt for mofcomp.exe compiling MOF files from non-system directories — used to install WMI subscriptions from files dropped by attackers",
     "query": "index=windows EventCode=4688 NewProcessName=\"*\\\\mofcomp.exe\" NOT CommandLine IN (\"*System32*\",\"*Windows\\\\*\",\"*WMI\\\\*\",\"*WbemDisc*\") | stats count by host, user, CommandLine, _time | sort -_time",
     "earliest": "-30d",
     "latest": "now"
   },
   {
     "name": "wmiprvse Spawning Unusual Child Process",
     "description": "Hunt for WMI Provider Host spawning shell processes — evidence of WMI subscription consumer executing attacker commands",
     "query": "index=windows EventCode=4688 ParentProcessName=\"*\\\\WmiPrvSE.exe\" NewProcessName IN (\"*\\\\cmd.exe\",\"*\\\\powershell.exe\",\"*\\\\wscript.exe\",\"*\\\\cscript.exe\",\"*\\\\mshta.exe\",\"*\\\\regsvr32.exe\",\"*\\\\rundll32.exe\") NOT CommandLine IN (\"*msiexec*\",\"*WerFault*\",\"*TrustedInstaller*\") | stats count by host, user, NewProcessName, CommandLine, _time | sort -_time",
     "earliest": "-7d",
     "latest": "now"
   }
 ]'::jsonb, TRUE),

-- PBK-0016 ─────────────────────────────────────────────────────────────────
(gen_random_uuid(), NULL, 'PBK-0016',
 'IFEO / SilentProcessExit Backdoor Hunt',
 'Hunt for Image File Execution Options (IFEO) and SilentProcessExit persistence — documented in IronHusky, HAFNIUM, and multiple APT41 incidents. IFEO allows inserting a debugger into any Windows process execution path. SilentProcessExit (GlobalFlag + ReportingMode) triggers execution when a target process terminates. Both evade most EDR persistence monitoring.',
 'Persistence', 'TA0003', 'Persistence',
 ARRAY['T1546.012'],
 'HIGH', 5,
 ARRAY['ifeo','silentprocessexit','persistence','ironhusky','hafnium','apt'],
 '[
   {
     "name": "IFEO Debugger Registry Key Created",
     "description": "Hunt for creation of Debugger values under Image File Execution Options — attackers use this to intercept any process launch and redirect to their payload",
     "query": "index=windows EventCode=13 TargetObject=\"*\\\\Image File Execution Options\\\\*\\\\Debugger\" NOT (Details IN (\"*vsjitdebugger.exe*\",\"*\\\\debugger\\\\*\",\"*\\\\Microsoft\\\\Visual Studio\\\\*\",\"*windbg.exe*\",\"*ntsd.exe*\") OR match(TargetObject,\"(?i)firefox|chrome|edge|teams|zoom\")) | stats count by host, user, TargetObject, Details, _time | sort -_time",
     "earliest": "-30d",
     "latest": "now"
   },
   {
     "name": "SilentProcessExit GlobalFlag Registry Modification",
     "description": "Hunt for GlobalFlag registry key modifications enabling SilentProcessExit monitoring — combined with ReportingMode=512 this triggers execution on process termination",
     "query": "index=windows EventCode=13 (TargetObject=\"*\\\\Image File Execution Options\\\\*\\\\GlobalFlag\" OR TargetObject=\"*\\\\SilentProcessExit\\\\*\\\\ReportingMode\" OR TargetObject=\"*\\\\SilentProcessExit\\\\*\\\\MonitorProcess\") | stats count by host, user, TargetObject, Details, _time | sort -_time",
     "earliest": "-30d",
     "latest": "now"
   },
   {
     "name": "Accessibility Feature Backdoor via IFEO",
     "description": "Hunt for IFEO debugger keys on accessibility executables (sethc.exe, utilman.exe, narrator.exe, osk.exe) — classic backdoor enabling pre-login code execution",
     "query": "index=windows EventCode=13 TargetObject IN (\"*\\\\sethc.exe\\\\Debugger\",\"*\\\\utilman.exe\\\\Debugger\",\"*\\\\narrator.exe\\\\Debugger\",\"*\\\\osk.exe\\\\Debugger\",\"*\\\\Magnify.exe\\\\Debugger\",\"*\\\\DisplaySwitch.exe\\\\Debugger\") | stats count by host, user, TargetObject, Details, _time | sort -_time",
     "earliest": "-90d",
     "latest": "now"
   }
 ]'::jsonb, TRUE),

-- PBK-0017 ─────────────────────────────────────────────────────────────────
(gen_random_uuid(), NULL, 'PBK-0017',
 'Impacket Framework Lateral Movement Hunt',
 'Hunt for artifacts of the Impacket open-source framework used for lateral movement across the network — documented extensively in Stone Panda (APT10), Emissary Panda (APT27), Dark Seoul, and HAFNIUM campaigns. Impacket modules leave distinctive traces: PSEXESVC service for psexec, temporary batch files for smbexec, wmiprvse child processes for wmiexec, and specific SMB patterns for atexec.',
 'Lateral Movement', 'TA0008', 'Lateral Movement',
 ARRAY['T1021.002','T1047','T1570','T1550.002'],
 'CRITICAL', 7,
 ARRAY['impacket','psexec','wmiexec','smbexec','dark-seoul','apt27','lateral-movement'],
 '[
   {
     "name": "Impacket PsExec Service Installation",
     "description": "Hunt for PSEXESVC service creation — the primary Impacket psexec.py artifact left on target systems",
     "query": "index=windows EventCode=7045 ServiceName=\"PSEXESVC\" | stats count by host, ServiceFileName, ServiceType, _time | sort -_time",
     "earliest": "-30d",
     "latest": "now"
   },
   {
     "name": "Impacket smbexec Temporary Batch File",
     "description": "Hunt for the smbexec.py artifact: a temporary .bat file created in WINDOWS with execute.bat pattern, or cmd.exe launched from an SMB-mapped share",
     "query": "index=windows EventCode=11 TargetFilename IN (\"*\\\\Windows\\\\execute.bat\",\"*\\\\Windows\\\\Temp\\\\execute*.bat\") | stats count by host, Image, TargetFilename, _time | sort -_time",
     "earliest": "-30d",
     "latest": "now"
   },
   {
     "name": "Impacket wmiexec Child Process",
     "description": "Hunt for wmiprvse.exe spawning cmd.exe with the specific cmd /Q /c echo pattern used by wmiexec.py for output capture",
     "query": "index=windows EventCode=4688 ParentProcessName=\"*\\\\WmiPrvSE.exe\" NewProcessName=\"*\\\\cmd.exe\" (CommandLine=\"*/Q /c*\" OR CommandLine=\"*echo*>*\\\\Windows\\\\*\") | stats count by host, user, CommandLine, _time | sort -_time",
     "earliest": "-30d",
     "latest": "now"
   },
   {
     "name": "Lateral Tool Transfer via SMB Admin Shares",
     "description": "Hunt for the specific APT lateral tool transfer pattern: cmd.exe copying files to remote admin shares (\\\\IP\\C$\\windows\\help\\help or similar staging paths)",
     "query": "index=windows EventCode=4688 NewProcessName=\"*\\\\cmd.exe\" (CommandLine=\"*copy*\\\\\\\\*\\\\C$*\" OR CommandLine=\"*copy*\\\\\\\\*\\\\ADMIN$*\" OR CommandLine=\"*robocopy*\\\\\\\\*\\\\C$*\") | rex field=CommandLine \"\\\\\\\\\\\\\\\\(?P<dest_host>[^\\\\]+)\" | table _time, host, user, CommandLine, dest_host | sort -_time",
     "earliest": "-7d",
     "latest": "now"
   },
   {
     "name": "Pass-the-Hash via NTLM Logon Type 9",
     "description": "Hunt for NewCredentials logon type (type 9) using NTLM — the Windows logon type created by runas /netonly and used by Impacket credential reuse attacks",
     "query": "index=windows EventCode=4624 LogonType=9 AuthenticationPackageName=\"NTLM\" NOT LogonProcessName IN (\"Advapi\",\"User32\") | stats count by host, user, WorkstationName, IpAddress, _time | sort -_time",
     "earliest": "-7d",
     "latest": "now"
   }
 ]'::jsonb, TRUE),

-- PBK-0018 ─────────────────────────────────────────────────────────────────
(gen_random_uuid(), NULL, 'PBK-0018',
 'Cloud Storage Exfiltration (Dropbox / Google Drive / Yandex)',
 'Hunt for data exfiltration to cloud storage services using non-browser processes — observed in Karma Panda (Tonto Team), IronHusky, and multiple APT groups documented by Kaspersky. Attackers use curl with hardcoded API tokens to upload archived data to Dropbox, Google Drive, and Yandex Disk, bypassing corporate DLP that monitors HTTP traffic but not specific API calls. Also covers file.io and paste site uploads.',
 'Exfiltration', 'TA0010', 'Exfiltration',
 ARRAY['T1567.002','T1567','T1041','T1071.001'],
 'HIGH', 5,
 ARRAY['exfiltration','cloud-storage','dropbox','yandex','google-drive','curl','karma-panda'],
 '[
   {
     "name": "curl Upload to Cloud Storage",
     "description": "Hunt for curl.exe uploading files to cloud storage APIs with -F file= or --upload-file patterns — documented APT exfiltration technique using Dropbox/Yandex API tokens",
     "query": "index=windows EventCode=4688 NewProcessName=\"*\\\\curl.exe\" (CommandLine=\"*-F *file=@*\" OR CommandLine=\"*--upload-file*\" OR CommandLine=\"*-T *\" OR CommandLine=\"*-d @*\") (CommandLine IN (\"*dropbox*\",\"*googleapis.com*\",\"*yandex*\",\"*disk.yandex*\",\"*file.io*\",\"*transfer.sh*\",\"*0x0.st*\",\"*paste.ee*\")) | rex field=CommandLine \"Authorization:\\s*Bearer\\s+(?P<token>[A-Za-z0-9_\\-]+)\" | table _time, host, user, CommandLine, token | sort -_time",
     "earliest": "-7d",
     "latest": "now"
   },
   {
     "name": "Non-Browser Process Connecting to Cloud Storage",
     "description": "Hunt for non-browser processes making HTTPS connections to Dropbox, Google Drive, Yandex Disk, or OneDrive — CLI-based exfiltration indicators",
     "query": "index=network sourcetype=firewall (dest IN (\"*.dropbox.com\",\"*.dropboxapi.com\",\"*.drive.google.com\",\"*.googleapis.com\",\"disk.yandex.*\",\"*.yandex-team.ru\",\"*.mega.nz\",\"*.file.io\",\"*.transfer.sh\",\"wetransfer.com\")) bytes_out > 1000000 | join src_ip [search index=windows EventCode=4688 NOT NewProcessName IN (\"*\\\\chrome.exe\",\"*\\\\msedge.exe\",\"*\\\\firefox.exe\",\"*\\\\iexplore.exe\",\"*\\\\brave.exe\",\"*\\\\opera.exe\") | stats values(NewProcessName) as processes by host | eval src_ip=host] | stats sum(bytes_out) as total_bytes, values(processes) as procs by src_ip, dest | where total_bytes > 10485760 | eval total_mb=round(total_bytes/1048576,2) | sort -total_mb",
     "earliest": "-24h",
     "latest": "now"
   },
   {
     "name": "file.io or Paste Site Upload",
     "description": "Hunt for curl or PowerShell uploading files to one-time file sharing sites — a documented APT exfiltration method using ephemeral URLs to evade URL-based blocking",
     "query": "index=windows EventCode IN (4688,4104) (CommandLine=\"*file.io*\" OR CommandLine=\"*transfer.sh*\" OR CommandLine=\"*0x0.st*\" OR CommandLine=\"*paste.ee*\" OR ScriptBlockText=\"*file.io*\" OR ScriptBlockText=\"*Invoke-WebRequest*upload*\") (CommandLine=\"*curl*\" OR CommandLine=\"*Invoke-WebRequest*\" OR CommandLine=\"*iwr *\" OR NewProcessName=\"*\\\\curl.exe*\") | stats count by host, user, CommandLine, ScriptBlockText, _time | sort -_time",
     "earliest": "-7d",
     "latest": "now"
   },
   {
     "name": "certutil Download or Upload to External IP",
     "description": "Hunt for certutil.exe making network connections to external IPs for file upload or download — used in multiple APT campaigns as a proxy-bypassing transfer tool",
     "query": "index=windows EventCode=4688 NewProcessName=\"*\\\\certutil.exe\" (CommandLine=\"*-urlcache*\" OR CommandLine=\"*-split*\" OR CommandLine=\"*-f*http*\") NOT (CommandLine IN (\"*microsoft.com*\",\"*windows.com*\",\"*windowsupdate.com*\")) | rex field=CommandLine \"(?P<remote_url>https?://[^\\s''\\\"]+)\" | table _time, host, user, CommandLine, remote_url | sort -_time",
     "earliest": "-7d",
     "latest": "now"
   }
 ]'::jsonb, TRUE)

ON CONFLICT DO NOTHING;


-- ── Verification ──────────────────────────────────────────────────────────────

DO $$
DECLARE v_det_count INTEGER;
DECLARE v_pb_count  INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_det_count FROM "detections"
    WHERE "is_global" = TRUE AND "rule_id" >= 'DET-0579';
  IF v_det_count < 10 THEN
    RAISE EXCEPTION 'APT detection seed failed: expected 10 rules DET-0579..0588, found %', v_det_count;
  END IF;
  RAISE NOTICE 'APT detection seed: % rules inserted (DET-0579 to DET-0588)', v_det_count;

  SELECT COUNT(*) INTO v_pb_count FROM th_playbooks
    WHERE is_global = TRUE AND playbook_ref >= 'PBK-0009';
  IF v_pb_count < 10 THEN
    RAISE EXCEPTION 'APT playbook seed failed: expected 10 playbooks PBK-0009..0018, found %', v_pb_count;
  END IF;
  RAISE NOTICE 'APT playbook seed: % playbooks inserted (PBK-0009 to PBK-0018)', v_pb_count;
END $$;
