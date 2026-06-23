-- THaaS: Playbooks, Schedules, Schedule Runs
-- Adds th_playbooks, th_schedules, th_schedule_runs tables

-- ── th_playbooks ──────────────────────────────────────────────────────────────

CREATE TABLE th_playbooks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID REFERENCES tenants(id) ON DELETE CASCADE,
  playbook_ref     TEXT NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  category         TEXT NOT NULL DEFAULT 'General',
  mitre_tactic_id  TEXT,
  mitre_tactic     TEXT,
  mitre_techniques TEXT[] NOT NULL DEFAULT '{}',
  severity         TEXT NOT NULL DEFAULT 'HIGH',
  estimated_hours  INTEGER NOT NULL DEFAULT 4,
  tags             TEXT[] NOT NULL DEFAULT '{}',
  queries          JSONB NOT NULL DEFAULT '[]',
  is_global        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_th_playbooks_tenant_ref UNIQUE (tenant_id, playbook_ref)
);

CREATE INDEX idx_th_playbooks_tenant    ON th_playbooks(tenant_id);
CREATE INDEX idx_th_playbooks_is_global ON th_playbooks(is_global);

ALTER TABLE th_playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass" ON th_playbooks TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── th_schedules ─────────────────────────────────────────────────────────────

CREATE TABLE th_schedules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  playbook_id         UUID NOT NULL REFERENCES th_playbooks(id),
  integration_id      UUID NOT NULL REFERENCES integrations(id),
  schedule_ref        TEXT NOT NULL,
  name                TEXT NOT NULL,
  cron_expression     TEXT NOT NULL,
  is_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  next_run_at         TIMESTAMPTZ,
  last_run_at         TIMESTAMPTZ,
  last_run_status     TEXT,
  auto_create_mission BOOLEAN NOT NULL DEFAULT TRUE,
  min_result_count    INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_th_schedules_tenant_ref UNIQUE (tenant_id, schedule_ref)
);

CREATE INDEX idx_th_schedules_tenant          ON th_schedules(tenant_id);
CREATE INDEX idx_th_schedules_enabled_next    ON th_schedules(is_enabled, next_run_at);

ALTER TABLE th_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass" ON th_schedules TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── th_schedule_runs ─────────────────────────────────────────────────────────

CREATE TABLE th_schedule_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id   UUID NOT NULL REFERENCES th_schedules(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'RUNNING',
  result_count  INTEGER NOT NULL DEFAULT 0,
  mission_id    UUID,
  error_message TEXT,
  query_summary JSONB,

  CONSTRAINT chk_th_run_status CHECK (status IN ('RUNNING','SUCCESS','FAILED','NO_RESULTS'))
);

CREATE INDEX idx_th_schedule_runs_schedule ON th_schedule_runs(schedule_id);
CREATE INDEX idx_th_schedule_runs_tenant   ON th_schedule_runs(tenant_id);

ALTER TABLE th_schedule_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass" ON th_schedule_runs TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── updated_at triggers ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_th_playbooks_updated_at') THEN
    CREATE TRIGGER set_th_playbooks_updated_at
      BEFORE UPDATE ON th_playbooks
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_th_schedules_updated_at') THEN
    CREATE TRIGGER set_th_schedules_updated_at
      BEFORE UPDATE ON th_schedules
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ── Global playbook seeds ─────────────────────────────────────────────────────
-- 8 platform-provided hunt playbooks (is_global = TRUE, tenant_id = NULL)

INSERT INTO th_playbooks (
  id, tenant_id, playbook_ref, title, description, category,
  mitre_tactic_id, mitre_tactic, mitre_techniques,
  severity, estimated_hours, tags, queries, is_global
) VALUES

-- 1. Ransomware Precursor Activity
(gen_random_uuid(), NULL, 'PBK-0001',
 'Ransomware Precursor Activity',
 'Hunt for pre-ransomware behaviors including volume shadow deletion, backup removal, and mass encryption staging before detonation.',
 'Ransomware', 'TA0040', 'Impact', ARRAY['T1486','T1490','T1485'],
 'CRITICAL', 6, ARRAY['ransomware','impact','pre-attack'],
 '[
   {"name":"Volume Shadow Copy Deletion","description":"Detect vssadmin or wmic commands deleting shadow copies — a primary ransomware pre-indicator","query":"index=* (\"vssadmin delete shadows\" OR \"wmic shadowcopy delete\" OR \"wbadmin delete catalog\") | stats count by host, user, process, _time | where count > 0","earliest":"-24h","latest":"now"},
   {"name":"Backup Catalog Destruction","description":"Detect deletion of Windows backup catalogs and recovery points","query":"index=* EventCode=4688 (CommandLine=\"*wbadmin*delete*\" OR CommandLine=\"*bcdedit*recoveryenabled*no*\") | stats count by host, user, CommandLine, _time","earliest":"-24h","latest":"now"},
   {"name":"Mass File Rename / Encryption Pattern","description":"Detect rapid file extension changes indicative of encryption activity","query":"index=* EventCode=4663 ObjectName=*.* | eval ext=mvindex(split(ObjectName,\".\"),-1) | stats count by host, user, ext | where count > 100 | sort -count","earliest":"-1h","latest":"now"}
 ]'::jsonb, TRUE),

-- 2. PowerShell Abuse & LOLBIN
(gen_random_uuid(), NULL, 'PBK-0002',
 'PowerShell Abuse & Living Off the Land',
 'Hunt for malicious use of PowerShell, WScript, CScript, and other native Windows tools to execute payloads without dropping files.',
 'Living Off the Land', 'TA0002', 'Execution', ARRAY['T1059.001','T1059.003','T1218'],
 'HIGH', 4, ARRAY['powershell','lolbin','execution','fileless'],
 '[
   {"name":"Encoded PowerShell Execution","description":"Detect PowerShell using -EncodedCommand or -enc flags — common evasion technique","query":"index=* EventCode=4688 (CommandLine=\"*-EncodedCommand*\" OR CommandLine=\"*-enc *\" OR CommandLine=\"*-e *JAB*\") | stats count by host, user, CommandLine, _time | sort -_time","earliest":"-7d","latest":"now"},
   {"name":"PowerShell Download Cradles","description":"Detect PowerShell downloading payloads via IEX, Invoke-WebRequest, WebClient","query":"index=* EventCode=4688 CommandLine=\"*powershell*\" (CommandLine=\"*IEX*\" OR CommandLine=\"*Invoke-Expression*\" OR CommandLine=\"*DownloadString*\" OR CommandLine=\"*WebClient*\") | stats count by host, user, CommandLine, _time","earliest":"-7d","latest":"now"},
   {"name":"LOLBIN Proxy Execution","description":"Detect execution via living-off-the-land binaries: regsvr32, certutil, mshta, rundll32 used to proxy code execution","query":"index=* EventCode=4688 (process_name=\"regsvr32.exe\" OR process_name=\"certutil.exe\" OR process_name=\"mshta.exe\" OR process_name=\"rundll32.exe\") | stats count by host, user, process_name, CommandLine, _time | sort -_time","earliest":"-7d","latest":"now"}
 ]'::jsonb, TRUE),

-- 3. Credential Harvesting
(gen_random_uuid(), NULL, 'PBK-0003',
 'Credential Harvesting & LSASS Attacks',
 'Hunt for credential theft techniques targeting LSASS memory, SAM database, NTDS.dit, and in-memory credential stores.',
 'Credential Access', 'TA0006', 'Credential Access', ARRAY['T1003','T1003.001','T1555'],
 'CRITICAL', 5, ARRAY['credentials','lsass','mimikatz','sam'],
 '[
   {"name":"LSASS Memory Access","description":"Detect processes accessing LSASS memory — Mimikatz primary indicator","query":"index=* EventCode=10 TargetImage=\"*lsass.exe\" | stats count by host, SourceImage, GrantedAccess, _time | where count > 0 | sort -_time","earliest":"-24h","latest":"now"},
   {"name":"SAM Database Access","description":"Detect access to the SAM registry hive — password hash extraction","query":"index=* EventCode=4663 ObjectName=\"*\\\\SAM\" | stats count by host, user, ObjectName, _time","earliest":"-24h","latest":"now"},
   {"name":"Mimikatz / Credential Tool Signatures","description":"Detect known Mimikatz command patterns and credential dumping tool artifacts","query":"index=* (\"sekurlsa::\" OR \"lsadump::\" OR \"kerberos::\" OR \"mimikatz\" OR \"procdump*lsass\") | stats count by host, user, _raw, _time | sort -_time","earliest":"-7d","latest":"now"},
   {"name":"NTDS.dit Extraction Attempt","description":"Detect attempts to copy or access NTDS.dit — Active Directory credential database","query":"index=* (CommandLine=\"*ntds.dit*\" OR CommandLine=\"*ntdsutil*\" OR (CommandLine=\"*vssadmin*\" AND CommandLine=\"*ntds*\")) | stats count by host, user, CommandLine, _time","earliest":"-7d","latest":"now"}
 ]'::jsonb, TRUE),

-- 4. Lateral Movement
(gen_random_uuid(), NULL, 'PBK-0004',
 'Lateral Movement Detection',
 'Hunt for attacker movement between hosts using SMB, WMI, PsExec, RDP, and Pass-the-Hash/Ticket techniques.',
 'Lateral Movement', 'TA0008', 'Lateral Movement', ARRAY['T1021','T1021.001','T1021.002','T1075'],
 'HIGH', 5, ARRAY['lateral-movement','smb','wmi','psexec','rdp'],
 '[
   {"name":"PsExec & Remote Service Creation","description":"Detect PsExec usage and remote service creation — lateral movement indicator","query":"index=* EventCode=7045 (ServiceName=\"PSEXESVC\" OR ServiceFileName=\"*psexec*\" OR ServiceFileName=\"*\\\\admin$\\\\*\") | stats count by host, ServiceName, ServiceFileName, _time | sort -_time","earliest":"-7d","latest":"now"},
   {"name":"WMI Remote Execution","description":"Detect WMI used for remote command execution — wmiprvse spawning child processes","query":"index=* EventCode=4688 ParentProcessName=\"*wmiprvse.exe*\" | stats count by host, user, process_name, CommandLine, _time | sort -_time","earliest":"-7d","latest":"now"},
   {"name":"Pass-the-Hash Indicators","description":"Detect NTLM logon type 3 from workstations using NTLM credentials — PtH indicator","query":"index=* EventCode=4624 LogonType=3 AuthenticationPackageName=NTLM WorkstationName!=\"\" | stats count by host, user, WorkstationName, IpAddress, _time | where count > 5","earliest":"-24h","latest":"now"},
   {"name":"Unusual RDP Connections","description":"Detect RDP connections from unusual source IPs or during off-hours","query":"index=* EventCode=4624 LogonType=10 | stats count by host, user, IpAddress, _time | where count > 0 | sort -_time","earliest":"-24h","latest":"now"}
 ]'::jsonb, TRUE),

-- 5. Command and Control
(gen_random_uuid(), NULL, 'PBK-0005',
 'Command & Control Beacon Detection',
 'Hunt for C2 beacon patterns, DNS tunneling, unusual outbound connections, and covert channel communication.',
 'Command and Control', 'TA0011', 'Command and Control', ARRAY['T1071','T1071.001','T1071.004','T1572'],
 'HIGH', 6, ARRAY['c2','beacon','dns-tunneling','covert-channel'],
 '[
   {"name":"Periodic Beacon Pattern","description":"Detect consistent low-interval outbound connections to the same external IP — beacon heartbeat pattern","query":"index=* sourcetype=firewall action=allow | bin _time span=1h | stats count by src_ip, dest_ip, _time | where count > 20 | stats stdev(count) as jitter by src_ip, dest_ip | where jitter < 2 | sort -count","earliest":"-24h","latest":"now"},
   {"name":"DNS Tunneling Indicators","description":"Detect abnormally long DNS query names or high query volume to single domain — DNS tunneling","query":"index=* sourcetype=dns | eval qlen=len(query) | stats count, avg(qlen) as avg_len by src, query | where avg_len > 50 OR count > 200 | sort -count","earliest":"-24h","latest":"now"},
   {"name":"Unusual Outbound Ports","description":"Detect outbound connections on non-standard ports that may indicate C2 traffic","query":"index=* sourcetype=firewall action=allow dest_port!=80 dest_port!=443 dest_port!=53 dest_port!=25 | stats count by src_ip, dest_ip, dest_port | where count > 10 | sort -count","earliest":"-24h","latest":"now"}
 ]'::jsonb, TRUE),

-- 6. Persistence Mechanisms
(gen_random_uuid(), NULL, 'PBK-0006',
 'Persistence Mechanism Hunt',
 'Hunt for attacker persistence via scheduled tasks, registry run keys, startup folders, WMI subscriptions, and service installation.',
 'Persistence', 'TA0003', 'Persistence', ARRAY['T1053','T1547','T1543','T1546'],
 'MEDIUM', 4, ARRAY['persistence','scheduled-tasks','registry','startup'],
 '[
   {"name":"Suspicious Scheduled Task Creation","description":"Detect scheduled tasks created by non-system processes or pointing to unusual locations","query":"index=* EventCode=4698 | rex field=TaskContent \"<Command>(?P<cmd>[^<]+)\" | where NOT match(cmd, \"(?i)(system32|program files|windows)\" ) | stats count by host, user, TaskName, cmd, _time | sort -_time","earliest":"-7d","latest":"now"},
   {"name":"Registry Run Key Persistence","description":"Detect modifications to autorun registry keys used for persistence","query":"index=* EventCode=13 (TargetObject=\"*\\\\CurrentVersion\\\\Run*\" OR TargetObject=\"*\\\\CurrentVersion\\\\RunOnce*\" OR TargetObject=\"*Winlogon\\\\Shell*\") | stats count by host, user, TargetObject, Details, _time | sort -_time","earliest":"-7d","latest":"now"},
   {"name":"WMI Event Subscription","description":"Detect WMI permanent event subscriptions — a stealthy persistence mechanism","query":"index=* EventCode=5861 | stats count by host, user, _raw, _time | sort -_time","earliest":"-7d","latest":"now"},
   {"name":"New Service Installation","description":"Detect new Windows services pointing to unusual binary paths","query":"index=* EventCode=7045 | where NOT match(ServiceFileName, \"(?i)(system32|program files|windows|sysmon)\") | stats count by host, ServiceName, ServiceFileName, ServiceType, _time | sort -_time","earliest":"-7d","latest":"now"}
 ]'::jsonb, TRUE),

-- 7. Data Exfiltration
(gen_random_uuid(), NULL, 'PBK-0007',
 'Data Exfiltration Detection',
 'Hunt for large data transfers, cloud storage uploads, DNS exfiltration, and staging activities prior to data theft.',
 'Exfiltration', 'TA0010', 'Exfiltration', ARRAY['T1041','T1048','T1567'],
 'HIGH', 5, ARRAY['exfiltration','data-theft','cloud-upload','dns-exfil'],
 '[
   {"name":"Large Outbound Data Transfer","description":"Detect unusually large volumes of outbound network traffic that may indicate data exfiltration","query":"index=* sourcetype=firewall action=allow | stats sum(bytes_out) as total_out by src_ip, dest_ip | where total_out > 104857600 | sort -total_out | eval total_mb=round(total_out/1048576,2)","earliest":"-24h","latest":"now"},
   {"name":"Cloud Storage Upload Detection","description":"Detect uploads to cloud storage providers (OneDrive, Dropbox, Box, Google Drive, S3)","query":"index=* sourcetype=proxy (dest=\"*.onedrive.com\" OR dest=\"*.dropbox.com\" OR dest=\"*.box.com\" OR dest=\"*.drive.google.com\" OR dest=\"s3.amazonaws.com\") method=PUT | stats sum(bytes_out) as uploaded by src_ip, dest | sort -uploaded","earliest":"-24h","latest":"now"},
   {"name":"Sensitive File Access Pattern","description":"Detect mass access to sensitive files (credentials, configs, docs) from a single user session","query":"index=* EventCode=4663 (ObjectName=\"*.xlsx\" OR ObjectName=\"*.docx\" OR ObjectName=\"*.pdf\" OR ObjectName=\"*.kdbx\" OR ObjectName=\"*.config\") | stats count by host, user | where count > 50 | sort -count","earliest":"-24h","latest":"now"}
 ]'::jsonb, TRUE),

-- 8. Privilege Escalation
(gen_random_uuid(), NULL, 'PBK-0008',
 'Privilege Escalation Hunt',
 'Hunt for token impersonation, UAC bypass, exploit attempts, and other techniques used to elevate from user to administrator.',
 'Privilege Escalation', 'TA0004', 'Privilege Escalation', ARRAY['T1055','T1548','T1134'],
 'CRITICAL', 5, ARRAY['privesc','token','uac-bypass','elevation'],
 '[
   {"name":"Token Impersonation","description":"Detect processes impersonating SYSTEM or other elevated tokens","query":"index=* EventCode=4624 LogonType=9 | stats count by host, user, LogonProcessName, _time | where count > 0 | sort -_time","earliest":"-24h","latest":"now"},
   {"name":"UAC Bypass Techniques","description":"Detect common UAC bypass methods including fodhelper, eventvwr, and CMSTPLUA","query":"index=* EventCode=4688 (ParentProcessName=\"*fodhelper.exe*\" OR ParentProcessName=\"*eventvwr.exe*\" OR CommandLine=\"*cmstplua*\" OR CommandLine=\"*computerdefaults*\") | stats count by host, user, process_name, ParentProcessName, _time | sort -_time","earliest":"-7d","latest":"now"},
   {"name":"Suspicious High-Privilege Process Spawn","description":"Detect non-standard parent processes spawning privileged children (SYSTEM-level executables)","query":"index=* EventCode=4688 IntegrityLevel=\"System\" | where NOT match(ParentProcessName, \"(?i)(services.exe|wininit.exe|lsass.exe|svchost.exe|system)\") | stats count by host, user, process_name, ParentProcessName, CommandLine, _time | sort -_time","earliest":"-24h","latest":"now"}
 ]'::jsonb, TRUE);
