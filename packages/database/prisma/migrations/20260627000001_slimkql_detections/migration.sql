-- ============================================================
--  SlimKQL Detections AI Pack  (70 rules)
--  Source: https://github.com/SlimKQL/Detections.AI/tree/main/KQL
--  Platforms: DEFENDER (Defender XDR) · SENTINEL (Microsoft Sentinel)
--  Query Language: KQL (Kusto Query Language)
--  Rule IDs: DET-0589 – DET-0658
-- ============================================================

INSERT INTO "detections" (
  "rule_id","name","description","severity","platform",
  "mitre_attack_id","mitre_tactic","mitre_technique",
  "nist_controls","data_sources","query","query_language","tags",
  "expected_alerts_per_day","expected_fp_rate","expected_mttd_hours",
  "is_global","tenant_id"
) VALUES

-- DET-0589 ─────────────────────────────────────────────────────────────────
('DET-0589','CVE-2026-26119 Windows Admin Center Privilege Escalation',
 'Detects internet-facing devices running an unpatched Windows Admin Center (WAC) version prior to 2.6.4 listening on port 6516. CVE-2026-26119 allows local privilege escalation on vulnerable WAC hosts. Correlates WAC listener events with DeviceInfo internet-facing status.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1068','Privilege Escalation','Exploitation for Privilege Escalation',
 ARRAY['SI-2','RA-5','CM-8'],ARRAY['MDE DeviceNetworkEvents','MDE DeviceInfo'],
 $q$DeviceNetworkEvents
| where Timestamp > ago(30d)
| where ActionType == "ListeningConnectionCreated"
| where LocalPort == "6516"
| where InitiatingProcessVersionInfoFileDescription == "Windows Admin Center"
| summarize arg_max(Timestamp, *) by DeviceName
| extend WACVersion = substring(InitiatingProcessVersionInfoProductVersion, 0, 6)
| where WACVersion != "2.6.4"
| join DeviceInfo on DeviceName
| where IsInternetFacing == true and isnotempty(PublicIP)$q$,
 'KQL'::query_language,
 ARRAY['cve','privilege-escalation','windows-admin-center','internet-facing','patch-management'],
 0.5,2.0,1.0,TRUE,NULL),

-- DET-0590 ─────────────────────────────────────────────────────────────────
('DET-0590','360 Surveillance — Iran-Linked Activity (Entra + MDE)',
 'Provides 360-degree visibility into potential Iran-linked threat activity by correlating Entra ID sign-ins from Iran (country code IR) with endpoint network connections to Iranian IP ranges. Useful during heightened geopolitical tensions for rapid identification of potentially targeted assets.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1078','Initial Access','Valid Accounts',
 ARRAY['SI-4','AU-2','IR-4'],ARRAY['MDE DeviceNetworkEvents','Entra ID SignInEvents'],
 $q$let CT = dynamic(["InboundConnectionAccepted","ConnectionAcknowledged",
"ConnectionAttempt","ConnectionFailed","ConnectionSuccess","ConnectionRequest"]);
let EndpointConnection =
DeviceNetworkEvents
| where Timestamp > ago(7d)
| where ActionType has_any(CT)
| extend GeoLo = geo_info_from_ip_address(RemoteIP)
| where GeoLo has "Iran";
EntraIdSignInEvents
| where Timestamp > ago(7d)
| where Country == "IR"
| union EndpointConnection
| summarize Count=count() by bin(Timestamp,1h)$q$,
 'KQL'::query_language,
 ARRAY['geopolitical','iran','threat-intel','entra','endpoint','surveillance'],
 2.0,10.0,0.5,TRUE,NULL),

-- DET-0591 ─────────────────────────────────────────────────────────────────
('DET-0591','Admin Consent Granted to M365 MCP Client for Claude',
 'Detects an administrator granting OAuth consent to the "M365 MCP Client for Claude" application. This application enables Claude AI to access Microsoft 365 workloads via MCP. Admin consent events should be reviewed to ensure they are authorised and scoped appropriately.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1098','Persistence','Account Manipulation',
 ARRAY['AC-2','AC-6','AU-2'],ARRAY['Defender XDR CloudAppEvents'],
 $q$CloudAppEvents
| where Timestamp > ago(1h)
| where ActionType == "Consent to application." and AccountType == "Admin"
| where ObjectName == "M365 MCP Client for Claude"
| extend AdminUPN = tostring(RawEventData.UserId)
| extend ConsentData = tostring(RawEventData.ModifiedProperties)
| project Timestamp, AdminUPN, ActionType, ObjectName, ConsentData, ReportId$q$,
 'KQL'::query_language,
 ARRAY['ai','mcp','claude','oauth','admin-consent','m365'],
 1.0,5.0,0.25,TRUE,NULL),

-- DET-0592 ─────────────────────────────────────────────────────────────────
('DET-0592','Autonomous AI Agent Awaiting Commands (Listening Port)',
 'Identifies processes associated with AI agents registered in the Exposure Graph that have opened listening network connections, indicating the agent is waiting for inbound commands. Autonomous agents with open listeners represent an expanded attack surface for lateral movement or C2 abuse.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1219','Command and Control','Remote Access Software',
 ARRAY['CM-7','SI-4','CA-7'],ARRAY['MDE DeviceNetworkEvents','Exposure Graph'],
 $q$let AIAgentProcess =
ExposureGraphEdges
| where SourceNodeLabel == @"ai-agent"
| join ExposureGraphNodes on $left.SourceNodeId == $right.NodeId
| distinct tostring(parse_json(NodeProperties).rawData.aiAgentMetadata.processName);
DeviceNetworkEvents
| where Timestamp > ago(30d)
| where InitiatingProcessCommandLine has_any(AIAgentProcess)
| where ActionType == "ListeningConnectionCreated"$q$,
 'KQL'::query_language,
 ARRAY['ai','ai-agent','mcp','c2','listening-port','autonomous-agent'],
 1.0,5.0,0.5,TRUE,NULL),

-- DET-0593 ─────────────────────────────────────────────────────────────────
('DET-0593','Local AI Agent Installation Detected (Agent 365)',
 'Detects new local AI agents installed on endpoints using the AIAgentsInfo table. Flags any agent installed in the last 24 hours, capturing vendor, software name, device, OS, and account details. Enables rapid inventory of AI agent footprint and identification of shadow-IT AI deployments.',
 'MEDIUM'::detection_severity,'DEFENDER'::detection_platform,
 'T1072','Execution','Software Deployment Tools',
 ARRAY['CM-8','CM-7','SI-4'],ARRAY['MDE AIAgentsInfo'],
 $q$AIAgentsInfo
| where AgentCreationTime > ago(1d)
| where Platform == @"LocalAgents"
| project AIVendor=parse_json(RawAgentInfo).localAgentMetadata.vendor,
AISoftwareName=parse_json(RawAgentInfo).name,
DeviceName=parse_json(RawAgentInfo).localAgentMetadata.deviceName,
OSPlatform=parse_json(RawAgentInfo).localAgentMetadata.osPlatform,
UserName=parse_json(RawAgentInfo).localAgentMetadata.accountName,
AccountSid=parse_json(RawAgentInfo).localAgentMetadata.accountSid$q$,
 'KQL'::query_language,
 ARRAY['ai','ai-agent','local-agent','shadow-it','inventory'],
 3.0,15.0,1.0,TRUE,NULL),

-- DET-0594 ─────────────────────────────────────────────────────────────────
('DET-0594','AI MCP Agent Visibility and Risk Assessment',
 'Identifies endpoints running local MCP server processes (processes with "mcp" in command line listening on localhost) and correlates them with the Exposure Graph to reveal what user identities and assigned roles those MCP agents inherit. Helps assess blast radius if an MCP agent is compromised.',
 'MEDIUM'::detection_severity,'DEFENDER'::detection_platform,
 'T1090','Command and Control','Proxy',
 ARRAY['CM-7','RA-3','SI-4'],ARRAY['MDE DeviceNetworkEvents','Exposure Graph'],
 $q$let EndpointMCPAgent =
DeviceNetworkEvents
| where Timestamp > ago(30d)
| where ActionType == "ListeningConnectionCreated"
| where LocalIP == "127.0.0.1" or LocalIP == "0.0.0.0"
| where InitiatingProcessCommandLine has "mcp"
| distinct DeviceName;
ExposureGraphEdges
| where EdgeLabel == @"frequently logged in by"
| where SourceNodeName has_any(EndpointMCPAgent)
| join ExposureGraphNodes on $left.TargetNodeId == $right.NodeId$q$,
 'KQL'::query_language,
 ARRAY['ai','mcp','exposure-graph','risk-assessment','identity-risk'],
 2.0,10.0,1.0,TRUE,NULL),

-- DET-0595 ─────────────────────────────────────────────────────────────────
('DET-0595','AI MCP SaaS Provider Usage Analysis (MDE)',
 'Correlates MDE network telemetry against a curated IOC list of known AI MCP SaaS API endpoints to identify which MCP services are being accessed in the environment. Helps security teams understand AI tool proliferation and identify unapproved or risky MCP integrations.',
 'MEDIUM'::detection_severity,'DEFENDER'::detection_platform,
 'T1567','Exfiltration','Exfiltration Over Web Service',
 ARRAY['CM-7','SI-4','AU-2'],ARRAY['MDE DeviceNetworkEvents'],
 $q$let AIMCPServer=externaldata(AIModel:string,AIAPIUrl:string,RiskScore:string)
[h'https://raw.githubusercontent.com/SlimKQL/Hunting-Queries-Detection-Rules/refs/heads/main/IOC/AIMCPServer.csv']
with (format='csv', ignoreFirstRecord=true)
| project AIAPIUrl;
DeviceNetworkEvents
| where Timestamp > ago(30d)
| where RemoteUrl has_any(AIMCPServer)
| extend AIMCP = replace_string(RemoteUrl, "https://", "")
| summarize Count=count() by AIMCP
| sort by Count desc$q$,
 'KQL'::query_language,
 ARRAY['ai','mcp','saas','threat-intel','network-discovery'],
 5.0,20.0,2.0,TRUE,NULL),

-- DET-0596 ─────────────────────────────────────────────────────────────────
('DET-0596','DNS ARPA Infrastructure Weaponization',
 'Detects connections to reverse-DNS ARPA domains matching the pattern used by attackers to abuse the DNS ARPA infrastructure for C2 communications. The regex targets IPv6 ARPA hostnames with randomised 10-character alphabetic prefixes, a pattern not produced by legitimate reverse-DNS lookups.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1071.004','Command and Control','Application Layer Protocol: DNS',
 ARRAY['SI-4','SC-7','CM-7'],ARRAY['MDE DeviceNetworkEvents'],
 $q$DeviceNetworkEvents
| where Timestamp > ago(1h)
| where ActionType == "ConnectionSuccess"
| extend fqdn = replace_string(RemoteUrl, "https://", "")
| where fqdn matches regex @"^[a-z]{10}\.[0-9a-f\.]+ip6\.arpa$"$q$,
 'KQL'::query_language,
 ARRAY['dns','arpa','c2','dns-abuse','threat-intel'],
 0.5,3.0,0.25,TRUE,NULL),

-- DET-0597 ─────────────────────────────────────────────────────────────────
('DET-0597','Axios Supply Chain Compromise via 3rd-Party Library',
 'Detects authentication events and cloud app activity using compromised versions of the Axios HTTP library (1.14.1 and 0.30.4) which were injected with credential-stealing code in a supply chain attack. Any requests bearing these user-agent strings should be treated as active credential theft.',
 'CRITICAL'::detection_severity,'DEFENDER'::detection_platform,
 'T1195.001','Initial Access','Supply Chain Compromise: Compromise Software Dependencies',
 ARRAY['SA-12','SI-3','IR-4'],ARRAY['Entra ID AADSignInEventsBeta','Defender XDR CloudAppEvents'],
 $q$let CompromisedAxios =
AADSignInEventsBeta
| where Timestamp > ago(1h)
| where isnotempty(DeviceTrustType) and ErrorCode == "0"
| where UserAgent has "axios/1.14.1" or UserAgent has "axios/0.30.4";
CloudAppEvents
| where Timestamp > ago(1h)
| where UserAgent has "axios/1.14.1" or UserAgent has "axios/0.30.4"
| union CompromisedAxios$q$,
 'KQL'::query_language,
 ARRAY['supply-chain','axios','npm','credential-theft','user-agent'],
 1.0,1.0,0.1,TRUE,NULL),

-- DET-0598 ─────────────────────────────────────────────────────────────────
('DET-0598','Bitwarden CLI Compromise Indicator Detection',
 'Detects the creation of the specific lock file "tmp.987654321.lock" in the /tmp directory, a known indicator of a compromised Bitwarden CLI that exfiltrates vault contents. This file name is hard-coded in the malicious variant and should never appear in legitimate Bitwarden installations.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1555','Credential Access','Credentials from Password Stores',
 ARRAY['IA-5','AU-2','IR-4'],ARRAY['MDE DeviceFileEvents'],
 $q$DeviceFileEvents
| where Timestamp > ago(30d)
| where ActionType == "FileCreated"
| where FileName has "tmp.987654321.lock" and FolderPath has "tmp"$q$,
 'KQL'::query_language,
 ARRAY['bitwarden','password-manager','credential-theft','supply-chain','linux'],
 0.1,0.5,0.25,TRUE,NULL),

-- DET-0599 ─────────────────────────────────────────────────────────────────
('DET-0599','Linux LPE Chain — Remote Fetch + ELF Execution + su Abuse',
 'Hunts for a full Linux local privilege escalation chain: a remote fetch tool downloads payload to a public endpoint, a newly created ELF binary in /home runs su from /usr/bin/su, or fileless exploitation of the algif-aead kernel module is detected. Covers DirtyFrag-style post-exploitation.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1068','Privilege Escalation','Exploitation for Privilege Escalation',
 ARRAY['SI-3','SI-4','CM-7'],ARRAY['MDE DeviceNetworkEvents','MDE DeviceProcessEvents','MDE DeviceFileEvents'],
 $q$let LookBack = 1d;
let RemoteFetchCodeCmd = dynamic(["curl","wget","lftp","axel","aria2","scp","rsync","ftp"]);
let FetchCodeEP =
DeviceNetworkEvents
| where InitiatingProcessCommandLine has_any(RemoteFetchCodeCmd) and RemoteIPType == "Public"
| distinct DeviceName;
let FilelessLPE =
DeviceProcessEvents
| where Timestamp > ago(LookBack)
| where ProcessCommandLine has "algif-aead" and DeviceName has_any(FetchCodeEP);
let ElfBinaryCreatedInUserDirectory =
DeviceFileEvents
| where Timestamp > ago(LookBack)
| where ActionType == "FileCreated"
| extend FileType=tostring(parse_json(AdditionalFields)["FileType"])
| where FileType == "ElfSharedLib" or FileType == "ElfExecutable"
| where FolderPath startswith "/home/"
| distinct FileName;
DeviceProcessEvents
| where Timestamp > ago(LookBack)
| where ActionType == "ProcessCreated"
| where FileName == "su" and FolderPath == "/usr/bin/su"
| where InitiatingProcessFolderPath startswith "/home/"
| where InitiatingProcessFileName has_any(ElfBinaryCreatedInUserDirectory)
| union FilelessLPE$q$,
 'KQL'::query_language,
 ARRAY['linux','lpe','elf','privilege-escalation','kernel-exploit','dirtyfrag'],
 0.5,3.0,0.5,TRUE,NULL),

-- DET-0600 ─────────────────────────────────────────────────────────────────
('DET-0600','ClickFix NSLookup Abuse Detection (Enhanced)',
 'Enhanced version of ClickFix nslookup detection that deobfuscates the initiating process command line before matching. Detects cases where nslookup and findstr are used together with a public IP address extracted via regex — a reliable indicator of a ClickFix social engineering payload execution.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1071','Command and Control','Application Layer Protocol',
 ARRAY['SI-3','CM-7','AU-2'],ARRAY['MDE DeviceProcessEvents'],
 $q$DeviceProcessEvents
| where Timestamp > ago(1h)
| extend DeobfuscatedCL = tostring(parse_command_line(tolower(InitiatingProcessCommandLine),"windows"))
| where DeobfuscatedCL has "nslookup" and DeobfuscatedCL has "findstr"
| extend IP = extract("([0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3})", 1, DeobfuscatedCL)
| where isnotempty(IP) and not(ipv4_is_private(IP))$q$,
 'KQL'::query_language,
 ARRAY['clickfix','nslookup','social-engineering','c2','deobfuscation'],
 2.0,8.0,0.25,TRUE,NULL),

-- DET-0601 ─────────────────────────────────────────────────────────────────
('DET-0601','ClickFix NSLookup Abuse Detection',
 'Detects ClickFix social engineering attacks where a victim is tricked into running a command that calls nslookup piped into findstr to exfiltrate data or resolve a C2 IP. The combination of nslookup and findstr with a public IP in the command line is a strong indicator of ClickFix payload execution.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1071','Command and Control','Application Layer Protocol',
 ARRAY['SI-3','CM-7','AU-2'],ARRAY['MDE DeviceProcessEvents'],
 $q$DeviceProcessEvents
| where Timestamp > ago(1h)
| where InitiatingProcessCommandLine has "nslookup" and InitiatingProcessCommandLine has "findstr"
| extend IP = extract("([0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3})", 1, InitiatingProcessCommandLine)
| where isnotempty(IP) and not(ipv4_is_private(IP))$q$,
 'KQL'::query_language,
 ARRAY['clickfix','nslookup','social-engineering','c2'],
 3.0,10.0,0.25,TRUE,NULL),

-- DET-0602 ─────────────────────────────────────────────────────────────────
('DET-0602','Cloudflare EvilTokens Phishing Infrastructure Detection',
 'Detects phishing infrastructure hosted on Cloudflare Workers using the EvilTokens pattern — domains matching .(p|c)-[random].workers.dev used for adversary-in-the-middle token harvesting. Covers email URL links, user clicks, and endpoint network connections to these domains.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1566.002','Initial Access','Phishing: Spearphishing Link',
 ARRAY['SI-8','SC-7','IR-5'],ARRAY['Defender XDR EmailUrlInfo','Defender XDR UrlClickEvents','MDE DeviceNetworkEvents'],
 $q$let EvilTokenMail =
EmailUrlInfo
| where Url contains ".workers.dev"
| where Url matches regex @"\.(p|c)-[a-z0-9]{6,10}\.workers\.dev"
| project TimeGenerated, NetworkMessageId, Url;
let EvilTokenClick =
UrlClickEvents
| where Url contains ".workers.dev"
| where Url matches regex @"\.(p|c)-[a-z0-9]{6,10}\.workers\.dev"
| project TimeGenerated, AccountUpn, Url, ActionType;
DeviceNetworkEvents
| where RemoteUrl endswith ".workers.dev"
| where RemoteUrl matches regex @"\.(p|c)-[a-z0-9]{6,10}\.workers\.dev"
| extend FirstLabel = tostring(split(RemoteUrl, ".")[0])
| where FirstLabel contains "-"
| project TimeGenerated, DeviceName, RemoteUrl, InitiatingProcessFileName, InitiatingProcessCommandLine
| union EvilTokenMail, EvilTokenClick$q$,
 'KQL'::query_language,
 ARRAY['cloudflare','eviltokens','phishing','workers-dev','aitm','token-theft'],
 2.0,5.0,0.5,TRUE,NULL),

-- DET-0603 ─────────────────────────────────────────────────────────────────
('DET-0603','Cross-Tenant Helpdesk Impersonation (Teams)',
 'Detects cross-tenant Teams chats where an external account with a helpdesk-style display name (IT, Support, Admin, etc.) initiates a one-on-one conversation. This is the initial contact pattern for Teams-based social engineering attacks that escalate to RMM tool installation and data exfiltration.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1566','Initial Access','Phishing',
 ARRAY['SI-8','AT-2','IR-4'],ARRAY['Defender XDR CloudAppEvents'],
 $q$let HDKeywords = dynamic(["IT", "Support", "Helpdesk", "Desk", "Service",
"Tech", "Admin", "Ops", "Assist", "Team", "Center"]);
CloudAppEvents
| where Timestamp > ago(1h)
| where Application == "Microsoft Teams"
| where ActionType == "ChatCreated"
| where RawEventData.CommunicationType == "OneOnOne"
| where parse_json(tostring(RawEventData.ParticipantInfo)).HasForeignTenantUsers == true
| extend AccountUPN = tolower(tostring(parse_json(RawEventData)["UserId"]))
| where AccountUPN endswith ".onmicrosoft.com"
| where AccountUPN has_any(HDKeywords)$q$,
 'KQL'::query_language,
 ARRAY['teams','impersonation','cross-tenant','social-engineering','helpdesk-scam'],
 3.0,10.0,0.5,TRUE,NULL),

-- DET-0604 ─────────────────────────────────────────────────────────────────
('DET-0604','CVE-2026-26117 Azure Arc LPE & Cloud Identity Takeover',
 'Detects internet-facing devices with Azure Arc installed that are vulnerable to CVE-2026-26117, which allows local privilege escalation to SYSTEM and subsequent cloud identity takeover via the Arc managed identity. Correlates vulnerability scan data with internet exposure information.',
 'CRITICAL'::detection_severity,'DEFENDER'::detection_platform,
 'T1068','Privilege Escalation','Exploitation for Privilege Escalation',
 ARRAY['SI-2','RA-5','CM-8'],ARRAY['MDE DeviceInfo','MDE DeviceTvmSoftwareVulnerabilities'],
 $q$DeviceInfo
| where Timestamp > ago(30d)
| summarize arg_max(Timestamp, *) by DeviceName
| where IsInternetFacing == true
| where isnotempty(PublicIP)
| where CloudPlatforms has "Arc"
| join DeviceTvmSoftwareVulnerabilities on DeviceName
| where CveId == "CVE-2026-26117"$q$,
 'KQL'::query_language,
 ARRAY['cve','azure-arc','privilege-escalation','cloud-identity','internet-facing'],
 0.5,1.0,0.5,TRUE,NULL),

-- DET-0605 ─────────────────────────────────────────────────────────────────
('DET-0605','CVE-2026-31431 CopyFail Linux Kernel LPE',
 'Detects exploitation attempts for CVE-2026-31431 (CopyFail), a Linux kernel local privilege escalation vulnerability. The exploit loads three specific kernel modules (net-pf-38, algif-aead, crypto-authencesn) via modprobe in rapid succession. Three or more such calls on a single device is a near-certain indicator.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1068','Privilege Escalation','Exploitation for Privilege Escalation',
 ARRAY['SI-2','SI-3','CM-7'],ARRAY['MDE DeviceProcessEvents'],
 $q$let CopyFailCL = dynamic(["net-pf-38","algif-aead","crypto-authencesn(hmac(sha256),cbc(aes)"]);
DeviceProcessEvents
| where Timestamp > ago(1h)
| where ProcessCommandLine has "/sbin/modprobe -q" and ProcessCommandLine has_any(CopyFailCL)
| summarize Count=count() by DeviceName
| where Count >= 3
| distinct DeviceName$q$,
 'KQL'::query_language,
 ARRAY['cve','copyfail','linux','kernel-exploit','lpe','modprobe'],
 0.2,1.0,0.25,TRUE,NULL),

-- DET-0606 ─────────────────────────────────────────────────────────────────
('DET-0606','CVE-2026-33829 Snipping Tool NTLM Hash Disclosure',
 'Detects the Windows Snipping Tool (SnippingTool.exe) making outbound connections to public IP addresses when launched via the ms-screensketch URI handler, which is the exploitation pattern for CVE-2026-33829. A vulnerable Snipping Tool will leak NTLM hashes to attacker-controlled SMB servers.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1187','Credential Access','Forced Authentication',
 ARRAY['IA-5','SI-2','SI-4'],ARRAY['MDE DeviceNetworkEvents'],
 $q$DeviceNetworkEvents
| where Timestamp > ago(1h)
| where InitiatingProcessFileName has "SnippingTool.exe"
| where InitiatingProcessCommandLine has "ms-screensketch"
| where RemoteIPType == "Public"$q$,
 'KQL'::query_language,
 ARRAY['cve','snipping-tool','ntlm','credential-theft','uri-handler'],
 0.5,3.0,0.25,TRUE,NULL),

-- DET-0607 ─────────────────────────────────────────────────────────────────
('DET-0607','CVE-2026-48095 7-Zip Attack Surface Inventory',
 'Identifies all devices in the environment running 7-Zip versions prior to 26.01 that are vulnerable to CVE-2026-48095 (arbitrary code execution via malformed archive). Covers both 7-Zip DLL image loads and direct 7-Zip process execution to ensure comprehensive coverage.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1203','Execution','Exploitation for Client Execution',
 ARRAY['SI-2','RA-5','CM-8'],ARRAY['MDE DeviceImageLoadEvents','MDE DeviceProcessEvents'],
 $q$let 7ZipDll =
DeviceImageLoadEvents
| where FileName has "7z.dll"
| where InitiatingProcessVersionInfoProductName == "7-Zip"
| where toreal(InitiatingProcessVersionInfoProductVersion) < 26.01;
DeviceProcessEvents
| where InitiatingProcessCommandLine has "7zG.exe" or InitiatingProcessCommandLine has "7z.exe"
| where InitiatingProcessVersionInfoProductName == "7-Zip"
| where toreal(InitiatingProcessVersionInfoProductVersion) < 26.01
| union 7ZipDll
| distinct DeviceName
| count$q$,
 'KQL'::query_language,
 ARRAY['cve','7-zip','archive','rce','patch-management','attack-surface'],
 1.0,5.0,2.0,TRUE,NULL),

-- DET-0608 ─────────────────────────────────────────────────────────────────
('DET-0608','CVE-2026-41089 CVSS 9.8 — Internet-Facing SMB/RPC Exploitation',
 'Detects exploitation of CVE-2026-41089 (CVSS 9.8), a critical RCE vulnerability in Windows network services. Identifies vulnerable internet-facing devices receiving inbound SMB (port 445) connections from public IPs or inbound Netlogon RPC calls (interface 12345678-...-cffb). Both vectors represent active exploitation attempts.',
 'CRITICAL'::detection_severity,'DEFENDER'::detection_platform,
 'T1210','Lateral Movement','Exploitation of Remote Services',
 ARRAY['SI-2','SC-7','RA-5'],ARRAY['MDE DeviceTvmSoftwareVulnerabilities','MDE DeviceInfo','MDE DeviceNetworkEvents','MDE DeviceEvents'],
 $q$let VulnerableEP =
DeviceTvmSoftwareVulnerabilities
| where CveId == "CVE-2026-41089"
| distinct DeviceId;
let InternetFacingVEP =
DeviceInfo
| where IsInternetFacing == true and isnotempty(PublicIP)
| where DeviceId has_any(VulnerableEP);
let InboundRPCNetlogon =
DeviceEvents
| where ActionType == "InboundRemoteRpcCall"
| extend AdditionalFields = parse_json(AdditionalFields)
| where AdditionalFields.RpcInterfaceUuid == "12345678-1234-abcd-ef00-01234567cffb";
DeviceNetworkEvents
| where DeviceId has_any(InternetFacingVEP)
| where ActionType == @"InboundConnectionAttempt"
| where not(ipv4_is_private(RemoteIP))
| where LocalPort == "445"
| union InboundRPCNetlogon$q$,
 'KQL'::query_language,
 ARRAY['cve','smb','rpc','netlogon','internet-facing','critical-rce'],
 1.0,2.0,0.25,TRUE,NULL),

-- DET-0609 ─────────────────────────────────────────────────────────────────
('DET-0609','BlueHammer Malware Detection (Defender XDR)',
 'Detects the BlueHammer malware family using three-way correlation: low-prevalence executable creation, EICAR test file triggering on the device (indicating AV was probed), and a SYSTEM-privileged conhost.exe spawned by the low-prevalence executable. This triple correlation eliminates virtually all false positives.',
 'CRITICAL'::detection_severity,'DEFENDER'::detection_platform,
 'T1055','Defense Evasion','Process Injection',
 ARRAY['SI-3','SI-4','IR-5'],ARRAY['MDE DeviceFileEvents','MDE DeviceEvents','MDE DeviceProcessEvents'],
 $q$let SuspiciousExe =
DeviceFileEvents
| where Timestamp > ago(1d)
| where ActionType == "FileCreated"
| where FileName endswith ".exe"
| invoke FileProfile("SHA1",1000)
| where isnotempty(GlobalPrevalence)
| where GlobalPrevalence < 5
| distinct FileName;
let EICARTriggered =
DeviceEvents
| where Timestamp > ago(1h)
| where ActionType == "AntivirusDetection"
| extend ParsedFields = parse_json(AdditionalFields)
| where ParsedFields.ThreatName has "EICAR"
| distinct DeviceName;
DeviceProcessEvents
| where Timestamp > ago(1h)
| where InitiatingProcessAccountSid == "S-1-5-18" or AccountSid == "S-1-5-18"
| where FileName == "conhost.exe" and InitiatingProcessFileName has_any(SuspiciousExe)
| where DeviceName has_any(EICARTriggered)$q$,
 'KQL'::query_language,
 ARRAY['bluehammer','malware','conhost','eicar','system-privilege','low-prevalence'],
 0.5,1.0,0.25,TRUE,NULL),

-- DET-0610 ─────────────────────────────────────────────────────────────────
('DET-0610','Cloudflare Win+R ClickFix Network Payload Detection',
 'Detects ClickFix attacks delivered via Cloudflare pages that trick users into pressing Win+R and pasting a WebDAV command. Correlates three signals: Win+R Run dialog registry MRU entry with http/webdav content, clipboard access, and an outbound WebDAV connection to a public IP — all within the same timeframe.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1566','Initial Access','Phishing',
 ARRAY['SI-3','CM-7','AU-2'],ARRAY['MDE DeviceRegistryEvents','MDE DeviceEvents','MDE DeviceNetworkEvents'],
 $q$let Lookup = 1h;
let Parameters = dynamic(['http', 'https', 'webdav']);
let Executables = dynamic(["cmd", "net use"]);
let WinR =
DeviceRegistryEvents
| where Timestamp > ago(Lookup)
| where ActionType == "RegistryValueSet"
| where RegistryKey has "RunMRU"
| where RegistryValueData has_any (Parameters) and RegistryValueData has_any (Executables)
| distinct DeviceName;
let GetClipboard =
DeviceEvents
| where Timestamp > ago(Lookup)
| where ActionType == "GetClipboardData"
| distinct DeviceName;
DeviceNetworkEvents
| where Timestamp > ago(Lookup)
| where InitiatingProcessCommandLine has "webdav"
| where RemoteIPType == "Public"
| where DeviceName has_any(GetClipboard)
| where DeviceName has_any(WinR)$q$,
 'KQL'::query_language,
 ARRAY['clickfix','cloudflare','webdav','win-r','clipboard','social-engineering'],
 1.0,5.0,0.25,TRUE,NULL),

-- DET-0611 ─────────────────────────────────────────────────────────────────
('DET-0611','Azure Monitor Alert Phishing Callback Detection (v1)',
 'Detects phishing emails spoofing Azure Monitor alert notifications sent to users who have never used the Azure Portal, exploiting the trusted azure-noreply@microsoft.com sender address. Targets users unfamiliar with Azure who may mistake the notification for a legitimate alert requiring action.',
 'MEDIUM'::detection_severity,'DEFENDER'::detection_platform,
 'T1566.001','Initial Access','Phishing: Spearphishing Attachment',
 ARRAY['SI-8','AT-2','SC-7'],ARRAY['Defender XDR EmailEvents'],
 $q$let MonitorKeywordSubject = dynamic(["severity", "activated", "deactivated",
"alert", "invoice", "payment", "order", "fund"]);
EmailEvents
| where Timestamp > ago(30d)
| where SenderFromAddress == "azure-noreply@microsoft.com" and EmailDirection == "Inbound"
| where DeliveryAction == "Delivered" and DeliveryLocation == "Inbox/folder"
| where IsFirstContact == true
| where Subject has_any(MonitorKeywordSubject)$q$,
 'KQL'::query_language,
 ARRAY['phishing','azure-monitor','email-spoofing','social-engineering','callback-phishing'],
 5.0,15.0,1.0,TRUE,NULL),

-- DET-0612 ─────────────────────────────────────────────────────────────────
('DET-0612','Azure Monitor Alert Phishing Callback Detection (v2 — High Precision)',
 'High-precision version: excludes actual Azure Portal users from the alert pool, leaving only recipients who would have no legitimate reason to receive an Azure Monitor alert. This dramatically reduces false positives and surfaces only phishing attempts targeting non-Azure users.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1566.001','Initial Access','Phishing: Spearphishing Attachment',
 ARRAY['SI-8','AT-2','SC-7'],ARRAY['Entra ID AADSignInEventsBeta','Defender XDR EmailEvents'],
 $q$let AzureUsers =
AADSignInEventsBeta
| where Timestamp > ago(30d)
| where Application == "Azure Portal" and ErrorCode == "0"
| distinct AccountUpn;
EmailEvents
| where Timestamp > ago(30d)
| where SenderFromAddress == "azure-noreply@microsoft.com" and EmailDirection == "Inbound"
| where DeliveryAction == "Delivered" and DeliveryLocation == "Inbox/folder"
| where not (RecipientEmailAddress has_any(AzureUsers))
| where IsFirstContact == true$q$,
 'KQL'::query_language,
 ARRAY['phishing','azure-monitor','email-spoofing','high-precision','callback-phishing'],
 1.0,3.0,0.5,TRUE,NULL),

-- DET-0613 ─────────────────────────────────────────────────────────────────
('DET-0613','WhatsApp VBScript Malware Campaign Detection',
 'Detects a campaign where attackers deliver VBScript files (.vbs) through the WhatsApp Desktop application. Correlates three events: successful connection to web.whatsapp.com, a .vbs file created in the WhatsApp application folder, and subsequent wscript.exe execution on the same device.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1059.005','Execution','Command and Scripting Interpreter: Visual Basic',
 ARRAY['SI-3','CM-7','AU-2'],ARRAY['MDE DeviceNetworkEvents','MDE DeviceFileEvents','MDE DeviceProcessEvents'],
 $q$let LookBack = 1h;
let WhatsAppDevice =
DeviceNetworkEvents
| where Timestamp > ago(LookBack)
| where ActionType == "ConnectionSuccess"
| where RemoteUrl == "web.whatsapp.com"
| distinct DeviceName;
let WAVBSCreated =
DeviceFileEvents
| where Timestamp > ago(LookBack)
| where ActionType=="FileCreated"
| where FolderPath has "WhatsAppDesktop"
| where tolower(FileName) endswith ".vbs"
| where DeviceName has_any(WhatsAppDevice)
| distinct DeviceName;
DeviceProcessEvents
| where Timestamp > ago(LookBack)
| where FileName =~ "wscript.exe"
| where DeviceName has_any(WAVBSCreated)$q$,
 'KQL'::query_language,
 ARRAY['whatsapp','vbscript','malware-delivery','wscript','messenger-threat'],
 1.0,5.0,0.25,TRUE,NULL),

-- DET-0614 ─────────────────────────────────────────────────────────────────
('DET-0614','Linux LPE via DirtyFrag or CopyFail (ELF su Abuse)',
 'Detects Linux local privilege escalation attacks associated with DirtyFrag or CopyFail by identifying the common post-exploitation pattern: an ELF executable or shared library created in a user home directory then used to invoke /usr/bin/su, indicating privilege escalation via a user-controlled binary.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1068','Privilege Escalation','Exploitation for Privilege Escalation',
 ARRAY['SI-2','CM-7','AU-2'],ARRAY['MDE DeviceFileEvents','MDE DeviceProcessEvents'],
 $q$let LookBack = 1h;
let ElfBinaryCreatedInUserDirectory =
DeviceFileEvents
| where Timestamp > ago(LookBack)
| where ActionType == "FileCreated"
| extend FileType=tostring(parse_json(AdditionalFields)["FileType"])
| where FileType == "ElfSharedLib" or FileType == "ElfExecutable"
| where FolderPath startswith "/home/"
| distinct FileName;
DeviceProcessEvents
| where Timestamp > ago(LookBack)
| where ActionType == "ProcessCreated"
| where FileName == "su" and FolderPath == "/usr/bin/su"
| where InitiatingProcessFolderPath startswith "/home/"
| where InitiatingProcessFileName has_any(ElfBinaryCreatedInUserDirectory)$q$,
 'KQL'::query_language,
 ARRAY['linux','lpe','dirtyfrag','copyfail','elf','privilege-escalation'],
 0.5,2.0,0.25,TRUE,NULL),

-- DET-0615 ─────────────────────────────────────────────────────────────────
('DET-0615','NTLM Hash Leakage via Windows Search URI Handler',
 'Detects the CVE-exploiting pattern where a phishing email contains a Windows Search URI (search:?query=...&crumb=...) that triggers an SMB connection to a public IP, leaking the user''s NTLM hash. Correlates email URL clicks to Windows Search URIs with subsequent outbound SMB from the same user''s device.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1187','Credential Access','Forced Authentication',
 ARRAY['IA-5','SI-4','SC-7'],ARRAY['Defender XDR UrlClickEvents','Entra ID IdentityInfo','MDE DeviceNetworkEvents','MDE DeviceInfo'],
 $q$let LookBack = 1h;
let SearchURI = dynamic(["search:"]);
let SearchURIParameters = dynamic(["query=","crumb="]);
let SearchURIClicker =
UrlClickEvents
| where Timestamp > ago(LookBack)
| where ActionType == @"ClickAllowed"
| where UrlChain has_any(SearchURI) and UrlChain has_any(SearchURIParameters)
| distinct AccountUpn
| join IdentityInfo on AccountUpn
| distinct OnPremSid;
DeviceNetworkEvents
| where Timestamp > ago(LookBack)
| where ActionType == "ConnectionSuccess"
| where RemotePort == 445 and RemoteIPType == "Public"
| join DeviceInfo on DeviceId
| where LoggedOnUsers has_any(SearchURIClicker)$q$,
 'KQL'::query_language,
 ARRAY['ntlm','credential-theft','windows-search','uri-handler','forced-auth'],
 0.5,3.0,0.25,TRUE,NULL),

-- DET-0616 ─────────────────────────────────────────────────────────────────
('DET-0616','SVG Payload Phishing Campaign Detection',
 'Detects phishing emails delivering SVG files that are actually HTML payloads — a technique that bypasses file-type filters. The detection specifically targets SVG attachments with base64-encoded filenames (indicating obfuscation) that were delivered to the inbox without remediation.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1566.001','Initial Access','Phishing: Spearphishing Attachment',
 ARRAY['SI-8','SC-18','AU-2'],ARRAY['Defender XDR EmailAttachmentInfo','Defender XDR EmailEvents'],
 $q$EmailAttachmentInfo
| where Timestamp > ago(30d)
| where FileExtension has ".svg" and FileType == "html"
| where FileName matches regex @"[A-Za-z0-9+/=]{20,}"
| join EmailEvents on NetworkMessageId
| where EmailDirection == "Inbound"
| where DeliveryAction == "Delivered" and isempty(EmailAction)$q$,
 'KQL'::query_language,
 ARRAY['phishing','svg','html-smuggling','base64','email-delivery'],
 3.0,10.0,0.5,TRUE,NULL),

-- DET-0617 ─────────────────────────────────────────────────────────────────
('DET-0617','Teams Impersonation via RMM Tool Exfiltration',
 'Detects a sophisticated attack chain: Teams impersonation of IT/support personnel combined with victim devices that have recently connected to remote management and monitoring (RMM) tool infrastructure. The presence of both signals indicates the attacker has successfully installed an RMM tool for persistent access.',
 'CRITICAL'::detection_severity,'DEFENDER'::detection_platform,
 'T1566','Initial Access','Phishing',
 ARRAY['SI-4','IR-4','AT-2'],ARRAY['MDE DeviceNetworkEvents','Defender XDR CloudAppEvents'],
 $q$let LookBack = 3h;
let RMMUrl=externaldata(URI: string, RMMTool: string)
[h'https://raw.githubusercontent.com/jischell-msft/RemoteManagementMonitoringTools/refs/heads/main/Network%20Indicators/RMM_SummaryNetworkURI.csv']
| project URI;
let UPNUseRMM =
DeviceNetworkEvents
| where Timestamp > ago(LookBack)
| where ActionType == @"ConnectionSuccess"
| where RemoteUrl has_any(RMMUrl)
| distinct InitiatingProcessAccountUpn;
CloudAppEvents
| where Timestamp > ago(LookBack)
| where ActionType == "TeamsImpersonationDetected"
| extend ImpersonationDisplayName = tostring(parse_json(tostring(RawEventData.Sender)).DisplayName)
| extend ImpersonationUPN = tostring(parse_json(tostring(RawEventData.Sender)).UPN)
| extend ImpactedUserUPN = tostring(RawEventData.UserId)
| where (tolower(ImpersonationDisplayName) matches regex @"(compliance|security|secops|help|desk|support|^tech|tech$|tech\s|assistance|troubleshoot|admin|^it|it$|it\s)"
or tolower(ImpersonationUPN) matches regex @"(compliance|security|secops|onmicrosoft|help|desk|support|^tech|tech$|tech\s|assistance|troubleshoot|admin|^it|it$|it\s)")
| where ImpactedUserUPN has_any(UPNUseRMM)
| project Timestamp, ImpactedUserUPN, ImpersonationDisplayName, ImpersonationUPN$q$,
 'KQL'::query_language,
 ARRAY['teams','impersonation','rmm','exfiltration','social-engineering','vishing'],
 0.5,2.0,0.25,TRUE,NULL),

-- DET-0618 ─────────────────────────────────────────────────────────────────
('DET-0618','MOIS (Iranian MoIS) Campaign Detection',
 'Detects activity associated with Iranian Ministry of Intelligence and Security (MOIS) threat actor campaigns. Matches known malware executable names used for process masquerading and file hashes from the MOIS IOC list, combined with Telegram API C2 communications from masquerading processes.',
 'CRITICAL'::detection_severity,'DEFENDER'::detection_platform,
 'T1071','Command and Control','Application Layer Protocol',
 ARRAY['SI-3','SI-4','IR-5'],ARRAY['MDE DeviceFileEvents','MDE DeviceNetworkEvents'],
 $q$let MasqueradeExes = dynamic(["MicDriver.exe", "Winappx.exe", "MsCache.exe", "RuntimeSSH.exe", "smqdservice.exe"]);
let MOIS=externaldata(FileName:string,MD5:string)
[h'https://raw.githubusercontent.com/SlimKQL/Hunting-Queries-Detection-Rules/refs/heads/main/IOC/MOISIOC.csv']
with (format='csv', ignoreFirstRecord=true)
| project MD5;
let FileHash =
DeviceFileEvents
| where Timestamp > ago(30d)
| where MD5 has_any(MOIS);
DeviceNetworkEvents
| where Timestamp > ago(30d)
| where RemoteUrl has "api.telegram.org"
| where InitiatingProcessFileName has_any(MasqueradeExes)
| union FileHash$q$,
 'KQL'::query_language,
 ARRAY['mois','iran','apt','telegram-c2','masquerading','threat-intel'],
 0.5,1.0,0.25,TRUE,NULL),

-- DET-0619 ─────────────────────────────────────────────────────────────────
('DET-0619','DocMagic Impersonation → Tycoon2FA Phishing (Email)',
 'Detects the DocMagic impersonation phishing campaign where emails spoofing donotreply@docmagic.com arrive from noreply@frigoarrobba.com.br to redirect victims to Tycoon2FA adversary-in-the-middle phishing pages. Targets the specific date window of the observed campaign.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1566.001','Initial Access','Phishing: Spearphishing Attachment',
 ARRAY['SI-8','SC-7','IR-4'],ARRAY['Defender XDR EmailEvents'],
 $q$EmailEvents
| where Timestamp between (datetime(2026-02-04 00:00:00) .. datetime(2026-02-04 23:59:59))
| where SenderDisplayName has "donotreply@docmagic.com"
| where SenderFromAddress has "noreply@frigoarrobba.com.br"
| where EmailDirection == "Inbound" and DeliveryAction != "Blocked"$q$,
 'KQL'::query_language,
 ARRAY['docmagic','tycoon2fa','phishing','aitm','email-spoofing'],
 2.0,5.0,0.5,TRUE,NULL),

-- DET-0620 ─────────────────────────────────────────────────────────────────
('DET-0620','DocMagic Impersonation → Tycoon2FA Phishing (Network IoC)',
 'Network-side detection for the DocMagic/Tycoon2FA phishing campaign. Detects connections to listener.facraivo.sa.com, a known C2 infrastructure domain used in the Tycoon2FA adversary-in-the-middle proxy campaign that harvests M365 session tokens.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1566.002','Initial Access','Phishing: Spearphishing Link',
 ARRAY['SI-8','SC-7','IR-4'],ARRAY['MDE DeviceNetworkEvents'],
 $q$DeviceNetworkEvents
| where Timestamp > ago(7d)
| where RemoteUrl has "listener.facraivo.sa.com"$q$,
 'KQL'::query_language,
 ARRAY['docmagic','tycoon2fa','phishing','c2-domain','network-ioc'],
 1.0,2.0,0.25,TRUE,NULL),

-- DET-0621 ─────────────────────────────────────────────────────────────────
('DET-0621','EDRChoker — EDR Sensor Deactivation via Malicious Executable',
 'Detects the EDRChoker attack tool that deliberately deactivates endpoint detection sensors. Correlates: a non-system user creating a low-prevalence .exe, that executable being run via cmd.exe with arguments, and the MDE sensor on the same device subsequently going Inactive — a strong indicator the tool succeeded.',
 'CRITICAL'::detection_severity,'DEFENDER'::detection_platform,
 'T1562.001','Defense Evasion','Impair Defenses: Disable or Modify Tools',
 ARRAY['SI-3','SI-4','IR-4'],ARRAY['MDE DeviceFileEvents','MDE DeviceProcessEvents','MDE DeviceInfo'],
 $q$let LookBack= 1h;
let SuspectedChoker =
DeviceFileEvents
| where Timestamp > ago(LookBack)
| where ActionType == "FileCreated"
| where FileName endswith ".exe"
| where InitiatingProcessAccountName != @"system"
| distinct FileName;
let SuspectedDevice =
DeviceProcessEvents
| where Timestamp > ago(LookBack)
| where FileName has_any(SuspectedChoker)
| where ProcessCommandLine has " "
| where InitiatingProcessFileName == @"cmd.exe"
| distinct DeviceName;
DeviceInfo
| where Timestamp > ago(LookBack)
| where SensorHealthState == @"Inactive"
| where DeviceName has_any(SuspectedDevice)$q$,
 'KQL'::query_language,
 ARRAY['edrchoker','edr-tampering','defense-evasion','sensor-kill','endpoint-security'],
 0.2,1.0,0.1,TRUE,NULL),

-- DET-0622 ─────────────────────────────────────────────────────────────────
('DET-0622','Email Bombing + Teams Impersonation (Combo Attack)',
 'Detects the combined email bombing + Teams impersonation attack pattern where a victim is first overwhelmed with emails (>100 in 1 hour) to bury security alerts, then targeted by a Teams impersonation from an account mimicking IT/support personnel — a precursor to RMM tool installation.',
 'CRITICAL'::detection_severity,'DEFENDER'::detection_platform,
 'T1566','Initial Access','Phishing',
 ARRAY['SI-8','IR-4','AT-2'],ARRAY['Defender XDR EmailEvents','Defender XDR CloudAppEvents'],
 $q$let LookBack = 1h;
let MailBombUser =
EmailEvents
| where Timestamp > ago(LookBack)
| summarize MailCount=count() by RecipientEmailAddress
| where MailCount > 100
| distinct RecipientEmailAddress;
CloudAppEvents
| where Timestamp > ago(LookBack)
| where ActionType == "TeamsImpersonationDetected"
| extend ImpersonationDisplayName = tostring(parse_json(tostring(RawEventData.Sender)).DisplayName)
| extend ImpersonationUPN = tostring(parse_json(tostring(RawEventData.Sender)).UPN)
| extend ImpactedUserUPN = tostring(RawEventData.UserId)
| where (tolower(ImpersonationDisplayName) matches regex
@"(compliance|security|secops|help|desk|support|^tech|tech$|tech\s|assistance|troubleshoot|admin|^it|it$|it\s)"
or tolower(ImpersonationUPN) matches regex
@"(compliance|security|secops|onmicrosoft|help|desk|support|^tech|tech$|tech\s|assistance|troubleshoot|admin|^it|it$|it\s)")
| where ImpactedUserUPN has_any(MailBombUser)
| project TimeGenerated, ImpactedUserUPN, ImpersonationDisplayName, ImpersonationUPN$q$,
 'KQL'::query_language,
 ARRAY['email-bombing','teams','impersonation','social-engineering','it-helpdesk-scam'],
 0.5,2.0,0.1,TRUE,NULL),

-- DET-0623 ─────────────────────────────────────────────────────────────────
('DET-0623','Legacy TLS on Exchange Online POP/IMAP Connections',
 'Identifies accounts authenticating to Exchange Online (POP/IMAP) using deprecated TLS 1.0, TLS 1.1, or 3DES cipher suites after Microsoft retirement of legacy TLS. These connections represent a compliance risk and may indicate legacy mail clients or malicious tools deliberately using downgraded encryption.',
 'MEDIUM'::detection_severity,'DEFENDER'::detection_platform,
 'T1040','Credential Access','Network Sniffing',
 ARRAY['SC-8','SC-28','IA-5'],ARRAY['Entra ID SignInEvents'],
 $q$EntraIdSignInEvents
| where Timestamp > ago(30d)
| where ErrorCode == "0"
| where ResourceDisplayName == "Office 365 Exchange Online" or
ResourceDisplayName == "Office 365 Exchange Microservices" or
ResourceDisplayName == "Microsoft Exchange Online Protection"
| mv-expand todynamic(AuthenticationProcessingDetails)
| where AuthenticationProcessingDetails.key == "Legacy TLS (TLS 1.0, 1.1, 3DES)"
| where AuthenticationProcessingDetails.value == "True"
| project Timestamp, AccountDisplayName, AccountUpn, ResourceDisplayName, DeviceName$q$,
 'KQL'::query_language,
 ARRAY['tls','legacy-protocol','exchange-online','pop-imap','compliance'],
 5.0,20.0,2.0,TRUE,NULL),

-- DET-0624 ─────────────────────────────────────────────────────────────────
('DET-0624','AI Agent Exposure Management Inventory',
 'Provides a comprehensive inventory of all AI agents tracked in Microsoft Security Exposure Management, showing the agent name, which user accounts use it, the platform type, process name, and version. Useful for understanding the AI agent attack surface and identifying high-risk or unrecognised agents.',
 'INFO'::detection_severity,'DEFENDER'::detection_platform,
 NULL,NULL,NULL,
 ARRAY['CM-8','RA-3'],ARRAY['Exposure Graph'],
 $q$ExposureGraphEdges
| where SourceNodeLabel == @"ai-agent"
| join ExposureGraphNodes on $left.SourceNodeId == $right.NodeId
| project AISoftwareName=SourceNodeName, UsedByUser=TargetNodeName,
AgentType=parse_json(NodeProperties).rawData.aiAgentMetadata.platform,
ProcessName=parse_json(NodeProperties).rawData.aiAgentMetadata.processName,
AgentVersion=parse_json(NodeProperties).rawData.aiAgentMetadata.agentVersion$q$,
 'KQL'::query_language,
 ARRAY['ai','ai-agent','inventory','exposure-management','discovery'],
 10.0,50.0,4.0,TRUE,NULL),

-- DET-0625 ─────────────────────────────────────────────────────────────────
('DET-0625','External Copilot Prompt Injection via Email/Teams URL',
 'Detects adversarial Copilot prompt injection attacks where a malicious prompt is embedded in a URL and clicked by a user from a non-Copilot workload (email or Teams). The attacker crafts a URL containing a Copilot search query that causes Copilot to execute commands on the victim''s behalf.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1566.002','Initial Access','Phishing: Spearphishing Link',
 ARRAY['SI-8','SC-18','IR-4'],ARRAY['Defender XDR UrlClickEvents'],
 $q$let LookBack = 1h;
UrlClickEvents
| where Timestamp > ago(LookBack)
| where ActionType == @"ClickAllowed"
| where Workload != @"Copilot"
| where UrlChain has "https://m365.cloud.microsoft/search/?auth=2&origindomain=microsoft365&q="$q$,
 'KQL'::query_language,
 ARRAY['copilot','prompt-injection','ai-attack','url-phishing','m365'],
 1.0,5.0,0.25,TRUE,NULL),

-- DET-0626 ─────────────────────────────────────────────────────────────────
('DET-0626','GreatXML — Unattend.xml Credential Exfiltration',
 'Detects creation, modification, or renaming of an unattend.xml file at the root of a drive (e.g. C:\\unattend.xml). Unattend files at the drive root can contain plaintext administrator credentials from Windows deployment, and their presence or modification can indicate credential harvesting.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1552','Credential Access','Unsecured Credentials',
 ARRAY['IA-5','CM-6','AU-2'],ARRAY['MDE DeviceFileEvents'],
 $q$DeviceFileEvents
| where Timestamp > ago(1h)
| where ActionType in ("FileCreated", "FileModified", "FileRenamed")
| where FileName =~ "unattend.xml"
| where FolderPath matches regex @"^[A-Za-z]:\\unattend\.xml$"$q$,
 'KQL'::query_language,
 ARRAY['unattend-xml','credential-exposure','windows-deployment','greatxml','misconfiguration'],
 0.5,3.0,0.5,TRUE,NULL),

-- DET-0627 ─────────────────────────────────────────────────────────────────
('DET-0627','High-Fidelity Device Code Phishing Abuse Detection',
 'Detects device code phishing by correlating two events: a user clicking a Microsoft device authentication URL from an email (the phishing lure), followed by a device registration event for the same user via the Device Registration Service. This two-signal approach provides very high confidence with minimal false positives.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1528','Credential Access','Steal Application Access Token',
 ARRAY['IA-5','IA-8','AC-2'],ARRAY['Defender XDR UrlClickEvents','Defender XDR CloudAppEvents','Entra ID IdentityInfo'],
 $q$let UserVisitedDeviceAuth =
UrlClickEvents
| where Timestamp > ago(1h)
| where ActionType in ("ClickAllowed", "UrlScanInProgress", "UrlErrorPage") or IsClickedThrough != "0"
| where UrlChain has_any ("microsoft.com/devicelogin", "login.microsoftonline.com/common/oauth2/deviceauth")
| where Workload == "Email"
| distinct AccountUpn;
CloudAppEvents
| where Timestamp > ago(1h)
| where AccountDisplayName == "Device Registration Service"
| extend ID = extract("Device_(.*)", 1, tostring(RawEventData.ObjectId))
| join IdentityInfo on $left.ID == $right.AccountObjectId
| where AccountUpn has_any(UserVisitedDeviceAuth)$q$,
 'KQL'::query_language,
 ARRAY['device-code-phishing','oauth','token-theft','mfa-bypass','high-fidelity'],
 0.5,2.0,0.25,TRUE,NULL),

-- DET-0628 ─────────────────────────────────────────────────────────────────
('DET-0628','High-Precision Teams Impersonation Detection',
 'Detects Teams impersonation attacks where an external account with a helpdesk-style display name or UPN targets internal users. The additional filter requiring the impersonator UPN to end with .onmicrosoft.com increases precision by focusing on newly created or throwaway Microsoft tenants commonly used in these attacks.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1566','Initial Access','Phishing',
 ARRAY['SI-8','AT-2','IR-4'],ARRAY['Defender XDR CloudAppEvents'],
 $q$let LookBack = 1h;
CloudAppEvents
| where Timestamp > ago(LookBack)
| where ActionType == "TeamsImpersonationDetected"
| extend ImpersonationDisplayName = tostring(parse_json(tostring(RawEventData.Sender)).DisplayName)
| extend ImpersonationUPN = tostring(parse_json(tostring(RawEventData.Sender)).UPN)
| extend ImpactedUserUPN = tostring(RawEventData.UserId)
| where (tolower(ImpersonationDisplayName) matches regex @"(compliance|security|secops|help|desk|support|^tech|tech$|tech\s|assistance|troubleshoot|admin|^it|it$|it\s)"
or tolower(ImpersonationUPN) matches regex @"(compliance|security|secops|help|desk|support|^tech|tech$|tech\s|assistance|troubleshoot|admin|^it|it$|it\s)")
| where ImpersonationUPN endswith ".onmicrosoft.com"
| project Timestamp, ImpactedUserUPN, ImpersonationDisplayName, ImpersonationUPN$q$,
 'KQL'::query_language,
 ARRAY['teams','impersonation','onmicrosoft','high-precision','social-engineering'],
 1.0,3.0,0.25,TRUE,NULL),

-- DET-0629 ─────────────────────────────────────────────────────────────────
('DET-0629','NanoClaw AI Agent Installation Detection',
 'Detects installation of the NanoClaw AI agent — a malicious Claude-based agent toolkit installed via git clone from github.com/qwibitai/nanoclaw on devices that already have Node.js running Claude processes. The combination of Claude process presence and NanoClaw installation is high confidence.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1072','Execution','Software Deployment Tools',
 ARRAY['CM-7','CM-8','SI-3'],ARRAY['MDE DeviceProcessEvents'],
 $q$let Lookback = 7d;
let InstallCmd = "https://github.com/qwibitai/nanoclaw";
let ClaudeEP =
DeviceProcessEvents
| where Timestamp > ago(Lookback)
| where (FileName has "node" or FileName has "node.exe") and
(InitiatingProcessCommandLine has "claude" or ProcessCommandLine has "claude")
| distinct DeviceName;
DeviceProcessEvents
| where Timestamp > ago(Lookback)
| where InitiatingProcessCommandLine has InstallCmd or ProcessCommandLine has InstallCmd
| where InitiatingProcessCommandLine has "git" or ProcessCommandLine has "git"
| where InitiatingProcessCommandLine has "clone" or ProcessCommandLine has "clone"
| where DeviceName has_any(ClaudeEP)$q$,
 'KQL'::query_language,
 ARRAY['nanoclaw','ai-agent','claude','malicious-agent','git-clone'],
 0.5,2.0,0.5,TRUE,NULL),

-- DET-0630 ─────────────────────────────────────────────────────────────────
('DET-0630','NullClaw AI Agent Installation Detection',
 'Detects installation of the NullClaw AI agent compiled with Zig (zig build-exe) cloned from github.com/nullclaw/nullclaw.git. Correlates prior Zig compilation activity on the device with the nullclaw git clone command, indicating deliberate installation of this AI agent toolkit.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1072','Execution','Software Deployment Tools',
 ARRAY['CM-7','CM-8','SI-3'],ARRAY['MDE DeviceProcessEvents'],
 $q$let Lookback = 30d;
let InstallCmd = "https://github.com/nullclaw/nullclaw.git";
let ZigEP =
DeviceProcessEvents
| where Timestamp > ago(Lookback)
| where InitiatingProcessCommandLine == "zig build-exe"
| distinct DeviceName;
DeviceProcessEvents
| where Timestamp > ago(1h)
| where InitiatingProcessCommandLine has InstallCmd or ProcessCommandLine has InstallCmd
| where DeviceName has_any(ZigEP)$q$,
 'KQL'::query_language,
 ARRAY['nullclaw','ai-agent','zig','malicious-agent','git-clone'],
 0.2,1.0,0.5,TRUE,NULL),

-- DET-0631 ─────────────────────────────────────────────────────────────────
('DET-0631','PayPal DKIM Replay Attack Detection',
 'Detects PayPal DKIM replay attacks where attackers send emails that pass DKIM and DMARC validation by replaying genuine PayPal email infrastructure but originate from IP ranges outside PayPal''s known sending infrastructure. Such emails appear legitimate to email security systems and deliver phishing content.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1566.001','Initial Access','Phishing: Spearphishing Attachment',
 ARRAY['SI-8','SC-7','IR-4'],ARRAY['Defender XDR EmailEvents'],
 $q$EmailEvents
| where Timestamp > ago(1h)
| where SenderFromAddress == "service@paypal.com"
| where parse_json(AuthenticationDetails).DKIM == "pass" and
parse_json(AuthenticationDetails).DMARC == "pass"
| where not (ipv4_is_in_range(SenderIPv4,"64.4.240.0/21") or
ipv4_is_in_range(SenderIPv4,"64.4.248.0/22") or
ipv4_is_in_range(SenderIPv4,"66.211.168.0/22") or
ipv4_is_in_range(SenderIPv4,"91.243.72.0/23") or
ipv4_is_in_range(SenderIPv4,"173.0.80.0/20") or
ipv4_is_in_range(SenderIPv4,"185.177.52.0/22") or
ipv4_is_in_range(SenderIPv4,"192.160.215.0/24") or
ipv4_is_in_range(SenderIPv4,"198.54.216.0/23"))
| where EmailDirection == "Inbound" and DeliveryAction != "Blocked"$q$,
 'KQL'::query_language,
 ARRAY['paypal','dkim-replay','email-spoofing','dmarc-bypass','phishing'],
 1.0,5.0,0.5,TRUE,NULL),

-- DET-0632 ─────────────────────────────────────────────────────────────────
('DET-0632','RedSun Malware — Triple-Signal Detection',
 'Detects RedSun malware using a high-fidelity triple correlation: low-prevalence executable creation, EICAR AV probe triggering, named pipe creation by the suspicious executable, and SYSTEM-privileged conhost.exe spawned by the same executable. All four signals together have near-zero false positive rate.',
 'CRITICAL'::detection_severity,'DEFENDER'::detection_platform,
 'T1055','Defense Evasion','Process Injection',
 ARRAY['SI-3','SI-4','IR-5'],ARRAY['MDE DeviceFileEvents','MDE DeviceEvents','MDE DeviceProcessEvents'],
 $q$let SuspiciousExe =
DeviceFileEvents
| where Timestamp > ago(1d)
| where ActionType == "FileCreated"
| where FileName endswith ".exe"
| invoke FileProfile("SHA1",1000)
| where isnotempty(GlobalPrevalence)
| where GlobalPrevalence < 5
| distinct FileName;
let EICARTriggered =
DeviceEvents
| where Timestamp > ago(1h)
| where ActionType == "AntivirusDetection"
| extend ParsedFields = parse_json(AdditionalFields)
| where ParsedFields.ThreatName has "EICAR"
| distinct DeviceName;
let NamePipeCreationbySuspiciousFile =
DeviceEvents
| where Timestamp > ago(1h)
| where ActionType == "NamedPipeEvent" and InitiatingProcessFileName has_any(SuspiciousExe)
| distinct DeviceName;
DeviceProcessEvents
| where Timestamp > ago(1h)
| where InitiatingProcessAccountSid == "S-1-5-18" or AccountSid == "S-1-5-18"
| where FileName == "conhost.exe" and InitiatingProcessFileName has_any(SuspiciousExe)
| where DeviceName has_any(EICARTriggered) and DeviceName has_any(NamePipeCreationbySuspiciousFile)$q$,
 'KQL'::query_language,
 ARRAY['redsun','malware','named-pipe','eicar','system-privilege','low-prevalence'],
 0.2,0.5,0.1,TRUE,NULL),

-- DET-0633 ─────────────────────────────────────────────────────────────────
('DET-0633','KongTukes / Evolved ModeloRAT Teams Impersonation',
 'Detects the evolved ModeloRAT malware (KongTukes variant) which uses a WinPython portable environment in AppData\\Roaming\\WPy64-* to launch pythonw.exe. When a victim device running ModeloRAT also receives a Teams impersonation from IT/support accounts, it indicates active attack execution.',
 'CRITICAL'::detection_severity,'DEFENDER'::detection_platform,
 'T1566','Initial Access','Phishing',
 ARRAY['SI-3','SI-4','IR-5'],ARRAY['MDE DeviceProcessEvents','Defender XDR CloudAppEvents'],
 $q$let LookBack = 1h;
let ModeloRAT =
DeviceProcessEvents
| where Timestamp > ago(LookBack)
| where InitiatingProcessCommandLine has "\\AppData\\Roaming\\WPy64-" and InitiatingProcessCommandLine has "pythonw.exe"
| distinct InitiatingProcessAccountUpn;
CloudAppEvents
| where Timestamp > ago(LookBack)
| where ActionType == "TeamsImpersonationDetected"
| extend ImpersonationDisplayName = tostring(parse_json(tostring(RawEventData.Sender)).DisplayName)
| extend ImpersonationUPN = tostring(parse_json(tostring(RawEventData.Sender)).UPN)
| extend ImpactedUserUPN = tostring(RawEventData.UserId)
| where (tolower(ImpersonationDisplayName) matches regex
@"(compliance|security|secops|help|desk|support|^tech|tech$|tech\s|assistance|troubleshoot|admin|^it|it$|it\s)"
or tolower(ImpersonationUPN) matches regex
@"(compliance|security|secops|onmicrosoft|help|desk|support|^tech|tech$|tech\s|assistance|troubleshoot|admin|^it|it$|it\s)")
| where ImpactedUserUPN has_any(ModeloRAT)
| project Timestamp, ImpactedUserUPN, ImpersonationDisplayName, ImpersonationUPN$q$,
 'KQL'::query_language,
 ARRAY['kongtukes','modelorat','rat','winpython','teams-impersonation','malware'],
 0.5,1.0,0.1,TRUE,NULL),

-- DET-0634 ─────────────────────────────────────────────────────────────────
('DET-0634','MDI Password Protection — Leaked Credential Insight',
 'Identifies active user accounts in the Exposure Graph that have leaked credentials flagged by Microsoft Defender for Identity (MDI) password protection. Surfaces accounts with either general leaked credential indicators or Active Directory-specific leaked credential flags, enabling rapid remediation prioritisation.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1589.001','Reconnaissance','Gather Victim Identity Information: Credentials',
 ARRAY['IA-5','AC-2','IR-4'],ARRAY['Exposure Graph'],
 $q$ExposureGraphNodes
| where NodeLabel == "user"
| where parse_json(NodeProperties)["rawData.isActive"] == 'true'
| where parse_json(NodeProperties)["rawData.hasLeakedCredentials"] == 'true'
or parse_json(NodeProperties)["rawData.hasAdLeakedCredentials"] == 'true'
| join ExposureGraphEdges on $left.NodeId == $right.TargetNodeId$q$,
 'KQL'::query_language,
 ARRAY['mdi','leaked-credentials','password-protection','identity-risk','exposure-graph'],
 2.0,10.0,1.0,TRUE,NULL),

-- DET-0635 ─────────────────────────────────────────────────────────────────
('DET-0635','M365 MCP Connector for Claude — Sign-In Detection',
 'Detects successful sign-ins or admin consent events for the M365 MCP Client for Claude applications (two known App IDs). Monitors for the Claude AI connector accessing Microsoft 365 resources, enabling security teams to track and audit AI-driven access to corporate data.',
 'MEDIUM'::detection_severity,'SENTINEL'::detection_platform,
 'T1078','Initial Access','Valid Accounts',
 ARRAY['AC-2','AC-6','AU-2'],ARRAY['Microsoft Sentinel SigninLogs'],
 $q$SigninLogs
| where TimeGenerated > ago(1h)
| where ResultType == "0" or ResultType == "90095"
| where AppId == "08ad6f98-a4f8-4635-bb8d-f1a3044760f0"
or AppId == "07c030f6-5743-41b7-ba00-0a6e85f37c17"$q$,
 'KQL'::query_language,
 ARRAY['claude','m365','mcp','oauth','ai-access','sign-in-monitoring'],
 5.0,20.0,1.0,TRUE,NULL),

-- DET-0636 ─────────────────────────────────────────────────────────────────
('DET-0636','M365 Connector for Claude — Workload Access Monitoring',
 'Tracks which users and workloads the Claude M365 MCP connector is accessing via the Microsoft Graph API. Summarises Claude access counts by user and target workload (Mail, Teams, Calendar, etc.) to enable data governance reviews and detect unexpected or overly broad AI data access.',
 'INFO'::detection_severity,'DEFENDER'::detection_platform,
 NULL,NULL,NULL,
 ARRAY['AC-2','AU-2','CA-7'],ARRAY['Defender XDR GraphAPIAuditEvents'],
 $q$GraphAPIAuditEvents
| where ApplicationId  == "08ad6f98-a4f8-4635-bb8d-f1a3044760f0" or ApplicationId == "07c030f6-5743-41b7-ba00-0a6e85f37c17"
| where RequestMethod == "GET"
| join IdentityInfo on AccountObjectId
| summarize ClaudeAccessCount=count() by AccountUpn, TargetWorkload
| sort by ClaudeAccessCount, AccountUpn desc$q$,
 'KQL'::query_language,
 ARRAY['claude','m365','mcp','graph-api','data-governance','workload-access'],
 10.0,30.0,2.0,TRUE,NULL),

-- DET-0637 ─────────────────────────────────────────────────────────────────
('DET-0637','AI Model Provider Usage Analysis (MDE Network Telemetry)',
 'Correlates MDE endpoint network telemetry against a curated list of AI model provider API endpoints to identify which AI services (OpenAI, Anthropic, Gemini, Cohere, etc.) are being used in the environment. Enables AI tool governance and detection of unapproved AI model usage.',
 'INFO'::detection_severity,'DEFENDER'::detection_platform,
 NULL,NULL,NULL,
 ARRAY['CM-7','CM-8','AU-2'],ARRAY['MDE DeviceNetworkEvents'],
 $q$let AIModelProvider=externaldata(AIModel:string,AIAPIUrl:string,RiskScore:string)
[h'https://raw.githubusercontent.com/SlimKQL/Hunting-Queries-Detection-Rules/refs/heads/main/IOC/AIModelProvider.csv']
with (format='csv', ignoreFirstRecord=true)
| project AIAPIUrl;
DeviceNetworkEvents
| where Timestamp > ago(30d)
| where RemoteUrl has_any(AIModelProvider)
| extend AIProvider = replace_string(RemoteUrl, "https://", "")
| summarize Count=count() by AIProvider
| sort by Count desc$q$,
 'KQL'::query_language,
 ARRAY['ai','llm','shadow-ai','governance','network-discovery','model-provider'],
 10.0,30.0,4.0,TRUE,NULL),

-- DET-0638 ─────────────────────────────────────────────────────────────────
('DET-0638','ADWSDomainDump Active Directory Reconnaissance (Sentinel)',
 'Detects ADWSDomainDump tool usage by identifying ADWS (Active Directory Web Services) inbound connections on port 9389 combined with Windows Event IDs 1644 (LDAP expensive search) or 4662 (AD object access) on the same domain controller. Indicates automated AD reconnaissance targeting domain enumeration.',
 'HIGH'::detection_severity,'SENTINEL'::detection_platform,
 'T1087.002','Discovery','Account Discovery: Domain Account',
 ARRAY['AU-2','SI-4','AC-6'],ARRAY['MDE DeviceNetworkEvents','Windows Security Events'],
 $q$let ADWSSrv =
DeviceNetworkEvents
| where TimeGenerated > ago(1h)
| where ActionType == "InboundConnectionAccepted"
| where LocalPort == 9389
| distinct DeviceName;
SecurityEvent
| where TimeGenerated > ago(1h)
| where EventID == 1644 or EventID == 4662
| where Computer has_any(ADWSSrv)$q$,
 'KQL'::query_language,
 ARRAY['adws','active-directory','reconnaissance','domain-enumeration','adwsdomaindump'],
 1.0,5.0,0.5,TRUE,NULL),

-- DET-0639 ─────────────────────────────────────────────────────────────────
('DET-0639','MiniPlasma Malware — SYSTEM conhost via Low-Prevalence Executable',
 'Detects MiniPlasma malware using file-prevalence enrichment: identifies low-prevalence executables created by non-system users, then detects conhost.exe running at SYSTEM integrity level with one of those low-prevalence files as the initiating process — a strong indicator of privilege escalation or process injection.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1055','Defense Evasion','Process Injection',
 ARRAY['SI-3','SI-4','IR-5'],ARRAY['MDE DeviceFileEvents','MDE DeviceProcessEvents'],
 $q$let LookBack = 1d;
let LowGPExeByUser =
DeviceFileEvents
| where Timestamp > ago(LookBack)
| where ActionType == "FileCreated" and tostring(FileName) endswith ".exe"
| where InitiatingProcessAccountName != "system"
| invoke FileProfile("SHA1",1000)
| where GlobalPrevalence < 5
| distinct FileName;
DeviceProcessEvents
| where Timestamp > ago(LookBack)
| where ActionType == "ProcessCreated"
| where FileName == "conhost.exe" and InitiatingProcessIntegrityLevel == "System"
| where InitiatingProcessVersionInfoInternalFileName has_any(LowGPExeByUser)
| project Timestamp, DeviceName, ActionType, InitiatingProcessIntegrityLevel,
InitiatingProcessVersionInfoInternalFileName, InitiatingProcessFolderPath$q$,
 'KQL'::query_language,
 ARRAY['miniplasma','malware','conhost','system-privilege','low-prevalence','process-injection'],
 0.3,1.0,0.25,TRUE,NULL),

-- DET-0640 ─────────────────────────────────────────────────────────────────
('DET-0640','ModeloRAT CrashFix Registry Persistence Detection',
 'Detects the ModeloRAT CrashFix campaign''s persistence mechanism — creation of a registry Run key named "MonitoringService" under HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run. This registry key name is used exclusively by ModeloRAT variants and should not appear in legitimate software.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1547.001','Persistence','Boot or Logon Autostart Execution: Registry Run Keys',
 ARRAY['CM-7','SI-3','AU-2'],ARRAY['MDE DeviceRegistryEvents'],
 $q$DeviceRegistryEvents
| where Timestamp > ago(1h)
| where ActionType == "RegistryKeyCreated"
| where RegistryKey has "\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run\\MonitoringService"$q$,
 'KQL'::query_language,
 ARRAY['modelorat','rat','persistence','registry-run','crashfix','malware'],
 0.2,1.0,0.1,TRUE,NULL),

-- DET-0641 ─────────────────────────────────────────────────────────────────
('DET-0641','Claude Cowork on Microsoft 365 — Access Monitoring',
 'Detects successful Entra ID sign-ins by the Claude Cowork service (identified by M365 Connector App IDs) originating from devices running the cowork-svc process. Provides visibility into which devices are participating in Claude AI-assisted M365 collaboration and tracks the scope of AI access.',
 'INFO'::detection_severity,'DEFENDER'::detection_platform,
 NULL,NULL,NULL,
 ARRAY['CM-8','AU-2','CA-7'],ARRAY['MDE DeviceNetworkEvents','Entra ID SignInEvents'],
 $q$let LookBack = 30d;
let CoworkDevice =
DeviceNetworkEvents
| where Timestamp > ago(LookBack)
| where ActionType == "ConnectionSuccess"
| where InitiatingProcessFileName has "cowork-svc"
| distinct DeviceName;
EntraIdSignInEvents
| where Timestamp > ago(LookBack)
| where ErrorCode == "0"
| where ApplicationId == "08ad6f98-a4f8-4635-bb8d-f1a3044760f0"
or ApplicationId == "07c030f6-5743-41b7-ba00-0a6e85f37c17"
| where DeviceName has_any(CoworkDevice)$q$,
 'KQL'::query_language,
 ARRAY['claude','cowork','m365','ai-access','monitoring','governance'],
 5.0,20.0,2.0,TRUE,NULL),

-- DET-0642 ─────────────────────────────────────────────────────────────────
('DET-0642','CVE-2026-32202 Windows Shell Exploitation — NTLM Hash Theft',
 'Detects exploitation of CVE-2026-32202 (Windows Shell .lnk file vulnerability) on devices that are vulnerable, have internet-facing SMB, and have NTLM hashes exposed in the Exposure Graph. An explorer.exe-initiated .lnk execution followed by public SMB outbound on a device with all three risk factors indicates active exploitation.',
 'CRITICAL'::detection_severity,'DEFENDER'::detection_platform,
 'T1187','Credential Access','Forced Authentication',
 ARRAY['SI-2','SI-4','IA-5'],ARRAY['MDE DeviceTvmSoftwareVulnerabilities','Exposure Graph','MDE DeviceNetworkEvents','MDE DeviceProcessEvents'],
 $q$let LookBack = 1h;
let VulnerableEP =
DeviceTvmSoftwareVulnerabilities
| where CveId == "CVE-2026-32202"
| project DeviceName;
let EndpointWithNTLMHash =
ExposureGraphEdges
| where EdgeLabel == @"has credentials of"
| where EdgeProperties.rawData.ntlmHash.ntlmHash == "true"
| distinct SourceNodeName;
let OutboundSMB =
DeviceNetworkEvents
| where Timestamp > ago(LookBack)
| where ActionType == "ConnectionSuccess"
| where RemotePort == "445" and RemoteIPType == "Public"
| project DeviceName;
DeviceProcessEvents
| where Timestamp > ago(LookBack)
| where FileName endswith ".lnk" and InitiatingProcessFileName =~ "explorer.exe"
| where DeviceName has_any(VulnerableEP) and DeviceName has_any(OutboundSMB) and DeviceName has_any(EndpointWithNTLMHash)$q$,
 'KQL'::query_language,
 ARRAY['cve','windows-shell','lnk','ntlm','smb','credential-theft','internet-facing'],
 0.5,2.0,0.25,TRUE,NULL),

-- DET-0643 ─────────────────────────────────────────────────────────────────
('DET-0643','OAuth Phishing Targeting DocuSign Users (Cloudflare Workers)',
 'Detects a phishing campaign targeting DocuSign users that uses Cloudflare Workers domains matching the pattern page-docusign-[random].workers.dev. Covers both the email delivery vector (EmailUrlInfo) and the endpoint network connection when a victim clicks the link.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1566.002','Initial Access','Phishing: Spearphishing Link',
 ARRAY['SI-8','SC-7','IR-4'],ARRAY['Defender XDR EmailUrlInfo','MDE DeviceNetworkEvents'],
 $q$let Lookback = 1h;
let OauthMSPhish =
EmailUrlInfo
| where Timestamp > ago(Lookback)
| where Url matches regex @"page-docusign-[a-z0-9]+\.workers\.dev";
DeviceNetworkEvents
| where Timestamp > ago(Lookback)
| where RemoteUrl matches regex @"page-docusign-[a-z0-9]+\.workers\.dev"
| union OauthMSPhish$q$,
 'KQL'::query_language,
 ARRAY['docusign','oauth','phishing','cloudflare','workers-dev','aitm'],
 2.0,5.0,0.25,TRUE,NULL),

-- DET-0644 ─────────────────────────────────────────────────────────────────
('DET-0644','OAuth Redirection Abuse — Silent Auth Phishing',
 'Detects phishing emails containing OAuth silent-authentication URLs (prompt=none) that redirect victims transparently without showing a login prompt. This technique allows attackers to harvest tokens or test existing sessions without triggering MFA prompts, making it a stealthy phishing vector.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1566.002','Initial Access','Phishing: Spearphishing Link',
 ARRAY['SI-8','IA-5','SC-7'],ARRAY['Defender XDR EmailUrlInfo','Defender XDR EmailEvents'],
 $q$let Lookback = 1h;
EmailUrlInfo
| where Timestamp > ago(Lookback)
| where Url startswith "https://login.microsoftonline.com/common/oauth2/v2.0/authorize" and Url has "prompt=none"
| join EmailEvents on NetworkMessageId
| where EmailDirection == "Inbound"
| where DeliveryAction <> "Blocked"$q$,
 'KQL'::query_language,
 ARRAY['oauth','silent-auth','phishing','prompt-none','token-theft'],
 3.0,10.0,0.5,TRUE,NULL),

-- DET-0645 ─────────────────────────────────────────────────────────────────
('DET-0645','OAuthMSPhish — Cloudflare Workers Phishing Infrastructure',
 'Detects OAuthMSPhish infrastructure hosted on Cloudflare Workers matching the pattern index-[random].workers.dev. Covers both email delivery (URLs in phishing emails) and endpoint network connections when victims click links, providing end-to-end visibility of the phishing campaign.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1566.002','Initial Access','Phishing: Spearphishing Link',
 ARRAY['SI-8','SC-7','IR-4'],ARRAY['Defender XDR EmailUrlInfo','Defender XDR EmailEvents','MDE DeviceNetworkEvents'],
 $q$let Lookback = 1h;
let OauthMSPhish =
EmailUrlInfo
| where Timestamp > ago(Lookback)
| where UrlDomain matches regex @"index-[a-z0-9]+(\.[a-z0-9\-]+)*\.workers\.dev"
| join EmailEvents on NetworkMessageId
| where EmailDirection == "Inbound"
| where DeliveryAction <> "Blocked";
DeviceNetworkEvents
| where Timestamp > ago(Lookback)
| where RemoteUrl matches regex @"index-[a-z0-9]+(\.[a-z0-9\-]+)*\.workers\.dev"
| union OauthMSPhish$q$,
 'KQL'::query_language,
 ARRAY['oauthmsphish','cloudflare','workers-dev','phishing','aitm','token-theft'],
 2.0,5.0,0.25,TRUE,NULL),

-- DET-0646 ─────────────────────────────────────────────────────────────────
('DET-0646','Axios Supply Chain Compromise — One-Click Defender XDR Scan',
 'Rapid IOC scan for the Axios npm library supply chain compromise. Checks file SHA1/SHA256 hashes against three known malicious Axios packages and network connections to the attacker C2 IP (142.11.206.73) and domain (sfrclak.com). Run immediately when the Axios compromise is reported to assess environment impact.',
 'CRITICAL'::detection_severity,'DEFENDER'::detection_platform,
 'T1195.001','Initial Access','Supply Chain Compromise: Compromise Software Dependencies',
 ARRAY['SA-12','SI-3','IR-4'],ARRAY['MDE DeviceFileEvents','MDE DeviceNetworkEvents'],
 $q$let ScanPeriod = 3d;
let AxiosIOCSHA1 = dynamic([
"2553649f2322049666871cea80a5d0d6adc700ca",
"d6f3f62fd3b9f5432f5782b62d8cfd5247d5ee71",
"07d889e2dadce6f3910dcbc253317d28ca61c766"]);
let AxiosIOCSHA256 = dynamic([
"92ff08773995ebc8d55ec4b8e1a225d0d1e51efa4ef88b8849d0071230c9645a",
"617b67a8e1210e4fc87c92d1d1da45a2f311c08d26e89b12307cf583c900d101",
"fcb81618bb15edfdedfb638b4c08a2af9cac9ecfa551af135a8402bf980375cf"]);
let FileHashScan =
DeviceFileEvents
| where Timestamp > ago(ScanPeriod)
| where SHA1 has_any(AxiosIOCSHA1) or SHA256 has_any(AxiosIOCSHA256);
DeviceNetworkEvents
| where Timestamp > ago(ScanPeriod)
| where RemoteIP == "142.11.206.73" or RemoteUrl has "sfrclak.com"
| union FileHashScan$q$,
 'KQL'::query_language,
 ARRAY['axios','supply-chain','npm','ioc','file-hash','c2'],
 0.5,1.0,0.1,TRUE,NULL),

-- DET-0647 ─────────────────────────────────────────────────────────────────
('DET-0647','OpenClaw AI Agent Installation Detection (MDE)',
 'Detects installation of the OpenClaw AI agent framework on endpoints. Monitors for node-based npm install of openclaw, direct git clone from openclaw.ai or the GitHub repository, or any use of OpenClaw installation scripts. Identifies potential shadow-IT or malicious AI agent deployments.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1072','Execution','Software Deployment Tools',
 ARRAY['CM-7','CM-8','SI-3'],ARRAY['MDE DeviceProcessEvents'],
 $q$DeviceProcessEvents
| where Timestamp > ago(1h)
| where (InitiatingProcessFileName == "node" and InitiatingProcessCommandLine has "install" and InitiatingProcessCommandLine has "openclaw") or InitiatingProcessCommandLine has "https://openclaw.ai/install." or InitiatingProcessCommandLine has "https://github.com/openclaw/openclaw.git"
| project Timestamp, ActionType, DeviceName, AccountUpn, InitiatingProcessCommandLine$q$,
 'KQL'::query_language,
 ARRAY['openclaw','ai-agent','npm-install','git-clone','shadow-it'],
 0.5,3.0,0.5,TRUE,NULL),

-- DET-0648 ─────────────────────────────────────────────────────────────────
('DET-0648','Unnecessary Inbound Internet Exposure on Internet-Facing Devices',
 'Identifies internet-facing devices that fail the "Reduce unnecessary inbound internet exposure" secure configuration check and lists all listening ports exposed on those devices. Provides a prioritised view of attack surface by counting exposed ports per device, enabling rapid remediation of the highest-risk endpoints.',
 'MEDIUM'::detection_severity,'DEFENDER'::detection_platform,
 'T1190','Initial Access','Exploit Public-Facing Application',
 ARRAY['SC-7','CM-7','RA-5'],ARRAY['MDE DeviceTvmSecureConfigurationAssessment','MDE DeviceNetworkEvents'],
 $q$let InternetExposedEP =
DeviceTvmSecureConfigurationAssessmentKB
| where ConfigurationName == @"Reduce unnecessary inbound internet exposure on internet-facing devices"
| join DeviceTvmSecureConfigurationAssessment on ConfigurationId
| where IsCompliant !=1 and IsApplicable==1
| distinct DeviceName;
DeviceNetworkEvents
| where Timestamp > ago(30d)
| where ActionType == "ListeningConnectionCreated"
| where DeviceName has_any(InternetExposedEP)
| where LocalIP != @"127.0.0.1"
| summarize ListeningPortExposed=dcount(LocalPort) by DeviceName
| sort by ListeningPortExposed desc$q$,
 'KQL'::query_language,
 ARRAY['attack-surface','internet-exposure','listening-ports','secure-configuration','tvm'],
 10.0,20.0,4.0,TRUE,NULL),

-- DET-0649 ─────────────────────────────────────────────────────────────────
('DET-0649','Kali365.de Domain Infrastructure Detection',
 'Detects connections to domains from the Kali365 campaign — a phishing and C2 infrastructure using .de top-level domains. Correlates MDE network telemetry against a curated IOC list of Kali365 root domains, enabling detection of endpoints that have established connections to this campaign infrastructure.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1071','Command and Control','Application Layer Protocol',
 ARRAY['SI-4','SC-7','IR-5'],ARRAY['MDE DeviceNetworkEvents'],
 $q$let Kali365IOC=externaldata(Domain:string,Date:string)
[h'https://raw.githubusercontent.com/SlimKQL/Hunting-Queries-Detection-Rules/refs/heads/main/IOC/Kali365June.csv']
with (format='csv', ignoreFirstRecord=true)
| extend RootDomain = extract(@"([^.]+\.[^.]+)$", 1, Domain)
| distinct RootDomain;
DeviceNetworkEvents
| where Timestamp > ago(30d)
| where ActionType == "ConnectionSuccess"
| where RemoteUrl has_any(Kali365IOC)$q$,
 'KQL'::query_language,
 ARRAY['kali365','threat-intel','domain-ioc','c2','phishing-infrastructure'],
 2.0,5.0,0.5,TRUE,NULL),

-- DET-0650 ─────────────────────────────────────────────────────────────────
('DET-0650','OAuth Redirection Abuse — Phishing & Malware Delivery (Sentinel)',
 'Detects OAuth redirection abuse phishing attacks using a curated IOC list of malicious OAuth application IDs embedded in Microsoft login or Google OAuth URLs. Emails containing these OAuth app IDs as redirect targets are used to silently authorise malicious apps or deliver malware to victims.',
 'HIGH'::detection_severity,'SENTINEL'::detection_platform,
 'T1566.002','Initial Access','Phishing: Spearphishing Link',
 ARRAY['SI-8','SC-7','IR-4'],ARRAY['Defender for O365 EmailUrlInfo','Defender for O365 EmailEvents'],
 $q$let OauthID=externaldata(OAID:string)
[h'https://raw.githubusercontent.com/SlimKQL/Hunting-Queries-Detection-Rules/refs/heads/main/IOC/OauthRedirPhishing.csv']
| project OAID;
EmailUrlInfo
| where TimeGenerated > ago(90d)
| where Url startswith "https://login.microsoftonline.com/common/oauth2/v2.0/authorize" or
Url startswith "https://accounts.google.com/o/oauth2/v2/auth"
| where Url has_any(OauthID)
| join EmailEvents on NetworkMessageId$q$,
 'KQL'::query_language,
 ARRAY['oauth','phishing','redirect-abuse','ioc','google-auth','microsoft-login'],
 3.0,10.0,0.5,TRUE,NULL),

-- DET-0651 ─────────────────────────────────────────────────────────────────
('DET-0651','ShinyHunters Threat Actor Infrastructure Detection',
 'Detects connections to domains associated with the ShinyHunters threat actor group, known for large-scale data breaches and credential theft targeting cloud services. Covers known fake Okta portals, SSO guide domains, and passkey setup phishing domains used in ShinyHunters campaigns.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1566.002','Initial Access','Phishing: Spearphishing Link',
 ARRAY['SI-8','SC-7','IR-5'],ARRAY['Defender XDR EmailUrlInfo','MDE DeviceNetworkEvents'],
 $q$let ShinyHuntersInfra = dynamic([".acess-terms.com",".okta.guide",".sso.guide",
".okta.domains",".setup-okta.com",".help-okta.com",".desk-okta.com",".safe-okta.com",
".prod-okta.com",".lock-okta.com",".passkeysetup.com"]);
let EmailUrlThreat =
EmailUrlInfo
| where Timestamp > ago(1h)
| where Url has_any(ShinyHuntersInfra);
DeviceNetworkEvents
| where Timestamp > ago(1h)
| where RemoteUrl has_any(ShinyHuntersInfra)
| union EmailUrlThreat$q$,
 'KQL'::query_language,
 ARRAY['shinyhunters','okta','phishing','threat-actor','passkey-phishing','c2'],
 1.0,3.0,0.25,TRUE,NULL),

-- DET-0652 ─────────────────────────────────────────────────────────────────
('DET-0652','SymLeak — NTLM Hash Disclosure via Git Clone (CVE-2026-32631)',
 'Detects exploitation of CVE-2026-32631 (Git symlink NTLM leak) where a git clone of a malicious repository triggers outbound SMB on port 445 to a public IP, leaking the user NTLM hash. Only fires on devices confirmed vulnerable by TVM, reducing false positives.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1187','Credential Access','Forced Authentication',
 ARRAY['IA-5','SI-2','SC-7'],ARRAY['MDE DeviceTvmSoftwareVulnerabilities','MDE DeviceNetworkEvents'],
 $q$let VulnerableEP =
DeviceTvmSoftwareVulnerabilities
| where CveId == "CVE-2026-32631"
| distinct DeviceName;
DeviceNetworkEvents
| where Timestamp > ago(1h)
| where InitiatingProcessFileName has "git"
| where InitiatingProcessCommandLine has "git clone"
| where RemoteIPType == "Public" and RemotePort == 445
| where DeviceName has_any(VulnerableEP)$q$,
 'KQL'::query_language,
 ARRAY['symleak','git','ntlm','smb','credential-theft','cve','symlink'],
 0.5,2.0,0.25,TRUE,NULL),

-- DET-0653 ─────────────────────────────────────────────────────────────────
('DET-0653','Teams / Zoom TURN Relay Process Abuse Monitoring',
 'Detects non-browser, non-Teams processes connecting to Microsoft Teams or Zoom TURN relay servers. Legitimate TURN relay connections should only come from official meeting clients. Non-whitelisted processes using TURN relay infrastructure may indicate C2 traffic tunnelled through trusted video conferencing infrastructure.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1090','Command and Control','Proxy',
 ARRAY['SC-7','CM-7','SI-4'],ARRAY['MDE DeviceNetworkEvents'],
 $q$let WhitelistProcess = dynamic([
"ms-teams.exe",
"chrome.exe",
"msedge.exe",
"firefox.exe",
"msedgewebview2.exe"
]);
let TURN = dynamic(["default.relay.teams.microsoft.com",
"worldaz.relay.teams.microsoft.com","worldaz.relay.teams.trafficmanager.net",
"turnsg01.cloud.zoom.us","turnsg02.cloud.zoom.us"]);
DeviceNetworkEvents
| where Timestamp > ago(1h)
| where ActionType == "ConnectionSuccess"
| where RemoteUrl has_any(TURN)
| where not (InitiatingProcessVersionInfoOriginalFileName has_any(WhitelistProcess))$q$,
 'KQL'::query_language,
 ARRAY['teams','zoom','turn-relay','c2-tunnelling','process-abuse','conference-abuse'],
 1.0,5.0,0.25,TRUE,NULL),

-- DET-0654 ─────────────────────────────────────────────────────────────────
('DET-0654','Ultimate Claw AI Agent Hunting Query (30+ Variants)',
 'Comprehensive hunting query for all known Claw AI agent variants (OpenClaw, NanoClaw, NullClaw, IronClaw, MicroClaw, SlackClaw, etc. — 30+ variants). Detects git clone installations and active network connections by Claw agent processes, excluding browser processes to reduce noise.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1072','Execution','Software Deployment Tools',
 ARRAY['CM-7','CM-8','SI-4'],ARRAY['MDE DeviceProcessEvents','MDE DeviceNetworkEvents'],
 $q$let BrowserList = dynamic(["chrome.exe","chromium.exe","firefox.exe","msedge.exe","opera.exe"]);
let ClawAgents = dynamic(["OpenClaw","Clawdbot","Moltbot","Molty","Ironclaw","NemoClaw","VisionClaw",
"MobileClaw","MicroClaw","NanoClaw","EdgeClaw","LiteClaw","TinyClaw","MiniClaw","ChipClaw","IoTClaw",
"SensorClaw","PocketClaw","StreamClaw","Moltbook","CommunityClaw","HubClaw","ZeroClaw","MaxClaw","QClaw",
"KimiClaw","SwarmClaw","SlackClaw","PhoneClaw","WebClaw","MimiClaw","JVSClaw","MalClaw"]);
let AIAgentProcess =
DeviceProcessEvents
| where Timestamp > ago(30d)
| where InitiatingProcessCommandLine has_any (ClawAgents) and InitiatingProcessCommandLine has "clone";
DeviceNetworkEvents
| where Timestamp > ago(30d)
| where InitiatingProcessCommandLine has_any(ClawAgents)
| where not (InitiatingProcessFileName has_any(BrowserList))
| union AIAgentProcess$q$,
 'KQL'::query_language,
 ARRAY['ai-agent','claw-agents','git-clone','threat-hunting','comprehensive'],
 5.0,15.0,2.0,TRUE,NULL),

-- DET-0655 ─────────────────────────────────────────────────────────────────
('DET-0655','UnDefend — AV Signature Failure + Low-Prevalence Executable',
 'Detects the UnDefend attack pattern where an endpoint''s AV signatures are allowed to go out of date (AvIsSignatureUptoDate = false), then a low-prevalence executable is dropped. The combination of outdated AV and new low-prevalence file creation indicates deliberate AV weakening before malware deployment.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1562.001','Defense Evasion','Impair Defenses: Disable or Modify Tools',
 ARRAY['SI-3','SI-4','CM-7'],ARRAY['MDE DeviceTvmInfoGathering','MDE DeviceFileEvents'],
 $q$let LookBackup = 3d;
let DeviceFailedAVUpdate =
DeviceTvmInfoGathering
| where Timestamp > ago(LookBackup)
| where parse_json(AdditionalFields)["AvIsSignatureUptoDate"] == 'false'
| distinct DeviceName;
DeviceFileEvents
| where Timestamp > ago(LookBackup)
| where DeviceName has_any(DeviceFailedAVUpdate)
| where ActionType == "FileCreated"
| where FileName endswith ".exe"
| invoke FileProfile("SHA1",1000)
| where isnotempty(GlobalPrevalence)
| where GlobalPrevalence < 5$q$,
 'KQL'::query_language,
 ARRAY['undefend','av-tampering','signature-outdated','low-prevalence','defense-evasion'],
 1.0,5.0,0.5,TRUE,NULL),

-- DET-0656 ─────────────────────────────────────────────────────────────────
('DET-0656','VPN-Linked Password Spray Visualisation',
 'Detects and visualises password spray attacks originating from VPN infrastructure by correlating failed authentication events (error 50053 = locked out, 50126 = invalid credentials) with IP addresses identified as VPN by the ISP field in CloudAppEvents. Enables trend analysis of spray campaigns over time.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1110.003','Credential Access','Brute Force: Password Spraying',
 ARRAY['IA-5','AU-2','SI-4'],ARRAY['Defender XDR CloudAppEvents','Entra ID AADSignInEventsBeta'],
 $q$let VPNInfo =
CloudAppEvents
| where Timestamp > ago(30d)
| where ISP has "vpn"
| distinct IPAddress, ISP;
AADSignInEventsBeta
| where Timestamp > ago(30d)
| where ErrorCode == "50053" or ErrorCode == "50126"
| join VPNInfo on $left.IPAddress == $right.IPAddress
| summarize PasswordSpray = count() by bin(Timestamp, 1d)$q$,
 'KQL'::query_language,
 ARRAY['password-spray','vpn','brute-force','credential-attack','visualisation'],
 5.0,15.0,1.0,TRUE,NULL),

-- DET-0657 ─────────────────────────────────────────────────────────────────
('DET-0657','VSCode Extension Inventory in MDE Tenant',
 'Generates a comprehensive inventory of all Visual Studio Code extensions running on devices managed by MDE, by detecting extension-related process executions. Enables security teams to identify unauthorised, malicious, or supply-chain-compromised VSCode extensions across the enterprise.',
 'INFO'::detection_severity,'DEFENDER'::detection_platform,
 NULL,NULL,NULL,
 ARRAY['CM-8','CM-7','AU-2'],ARRAY['MDE DeviceProcessEvents'],
 $q$DeviceProcessEvents
| where Timestamp > ago(30d)
| where InitiatingProcessCommandLine has "\\.vscode\\extensions\\" and InitiatingProcessCommandLine has "code.exe"
| extend ExtensionName = extract(@"extensions\\([^\\]+)", 1, InitiatingProcessCommandLine)
| distinct DeviceName, ExtensionName
| sort by DeviceName asc$q$,
 'KQL'::query_language,
 ARRAY['vscode','extensions','inventory','supply-chain','shadow-it','developer-tools'],
 20.0,50.0,4.0,TRUE,NULL),

-- DET-0658 ─────────────────────────────────────────────────────────────────
('DET-0658','Windows Notepad RCE Vulnerability Detection (CVE)',
 'Detects exploitation of the Windows Notepad RCE vulnerability by identifying child processes spawned from Notepad.exe running in a vulnerable WindowsApps version (not 11.2510 or later) when opening a Markdown (.md) file. The .md file trigger and vulnerable version combination indicate an active exploitation attempt.',
 'HIGH'::detection_severity,'DEFENDER'::detection_platform,
 'T1203','Execution','Exploitation for Client Execution',
 ARRAY['SI-2','SI-3','AU-2'],ARRAY['MDE DeviceProcessEvents'],
 $q$DeviceProcessEvents
| where Timestamp > ago(1h)
| where InitiatingProcessFileName has "notepad.exe"
| where FolderPath has "\\Program Files\\WindowsApps\\Microsoft.WindowsNotepad"
 and FolderPath !has "11.2510"
| where InitiatingProcessCommandLine has ".md"$q$,
 'KQL'::query_language,
 ARRAY['notepad','rce','cve','windows-apps','exploitation','markdown'],
 0.3,2.0,0.25,TRUE,NULL);

-- ── Propagate to all existing tenants ─────────────────────────────────────
INSERT INTO "tenant_detections" ("tenant_id","detection_id","is_enabled","is_pinned","custom_name","notes")
SELECT t.id, d.id, TRUE, FALSE, NULL, NULL
FROM "tenants" t
CROSS JOIN "detections" d
WHERE d."is_global" = TRUE AND d."rule_id" >= 'DET-0589' AND d."rule_id" <= 'DET-0658'
ON CONFLICT ("tenant_id","detection_id") DO NOTHING;
