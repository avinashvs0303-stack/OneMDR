// STRIDE threat generation rules — the core intelligence of the threat modelling engine.
// Each component type maps to a set of pre-built threat templates grounded in real
// ATT&CK techniques. Data flow rules fire based on encryption, trust boundary, and
// data classification properties.

export type StrideCategory =
  | 'SPOOFING'
  | 'TAMPERING'
  | 'REPUDIATION'
  | 'INFO_DISCLOSURE'
  | 'DENIAL_OF_SERVICE'
  | 'ELEVATION_OF_PRIVILEGE';

export type ComponentType =
  | 'SERVER'
  | 'DATABASE'
  | 'API_GATEWAY'
  | 'WEBAPP'
  | 'LOAD_BALANCER'
  | 'FIREWALL'
  | 'VPN'
  | 'S3_BUCKET'
  | 'IAM_ROLE'
  | 'CONTAINER'
  | 'ACTIVE_DIRECTORY'
  | 'WORKSTATION'
  | 'SWITCH'
  | 'MESSAGE_QUEUE'
  | 'CACHE'
  | 'CDN'
  | 'IDENTITY_PROVIDER'
  | 'MONITORING'
  | 'DNS';

export interface ThreatTemplate {
  title: string;
  description: string;
  stride: StrideCategory;
  attackTactic: string;
  attackTechnique: string;
  defaultLikelihood: number;
  defaultImpact: number;
}

export interface FlowContext {
  isEncrypted: boolean;
  crossesTrustBoundary: boolean;
  dataClassification: string;
  protocol: string;
}

// ── Per-component STRIDE threat templates ─────────────────────────────────────

export const COMPONENT_THREATS: Partial<Record<ComponentType, ThreatTemplate[]>> = {
  SERVER: [
    {
      title: 'Remote Code Execution via Unpatched Vulnerability',
      description:
        'Attacker exploits an unpatched CVE to execute arbitrary code on the server, achieving full system compromise.',
      stride: 'TAMPERING',
      attackTactic: 'Execution',
      attackTechnique: 'T1203',
      defaultLikelihood: 3,
      defaultImpact: 5,
    },
    {
      title: 'Local Privilege Escalation',
      description:
        'Attacker with low-privilege shell exploits misconfiguration or kernel vulnerability to gain root/SYSTEM.',
      stride: 'ELEVATION_OF_PRIVILEGE',
      attackTactic: 'Privilege Escalation',
      attackTechnique: 'T1068',
      defaultLikelihood: 3,
      defaultImpact: 4,
    },
    {
      title: 'Credential Dumping from Memory',
      description:
        'Attacker dumps LSASS or /etc/shadow to obtain password hashes for offline cracking or pass-the-hash.',
      stride: 'INFO_DISCLOSURE',
      attackTactic: 'Credential Access',
      attackTechnique: 'T1003',
      defaultLikelihood: 3,
      defaultImpact: 4,
    },
    {
      title: 'Resource Exhaustion DoS',
      description:
        'Attacker saturates CPU, memory, or disk I/O to cause service degradation or outage.',
      stride: 'DENIAL_OF_SERVICE',
      attackTactic: 'Impact',
      attackTechnique: 'T1499',
      defaultLikelihood: 2,
      defaultImpact: 3,
    },
    {
      title: 'Log Tampering / Indicator Removal',
      description:
        'Attacker clears or modifies system logs to destroy forensic evidence and cover tracks.',
      stride: 'REPUDIATION',
      attackTactic: 'Defense Evasion',
      attackTechnique: 'T1070',
      defaultLikelihood: 3,
      defaultImpact: 3,
    },
  ],
  DATABASE: [
    {
      title: 'SQL Injection',
      description:
        'Attacker injects malicious SQL via unsanitized input parameters to exfiltrate, modify, or delete data.',
      stride: 'TAMPERING',
      attackTactic: 'Initial Access',
      attackTechnique: 'T1190',
      defaultLikelihood: 3,
      defaultImpact: 5,
    },
    {
      title: 'Sensitive Data Exfiltration',
      description:
        'Attacker extracts sensitive records using compromised credentials, SQL injection, or direct DB access.',
      stride: 'INFO_DISCLOSURE',
      attackTactic: 'Exfiltration',
      attackTechnique: 'T1530',
      defaultLikelihood: 3,
      defaultImpact: 5,
    },
    {
      title: 'Weak or Default Database Credentials',
      description:
        'Attacker authenticates with default, weak, or brute-forced database credentials, bypassing application-layer auth.',
      stride: 'SPOOFING',
      attackTactic: 'Initial Access',
      attackTechnique: 'T1078',
      defaultLikelihood: 2,
      defaultImpact: 5,
    },
    {
      title: 'Connection Pool Exhaustion',
      description:
        'Attacker floods the database with connection requests, denying service to legitimate application connections.',
      stride: 'DENIAL_OF_SERVICE',
      attackTactic: 'Impact',
      attackTechnique: 'T1499',
      defaultLikelihood: 2,
      defaultImpact: 3,
    },
    {
      title: 'Ransomware / Data Destruction',
      description: 'Attacker with DB write access drops tables or encrypts data for ransom.',
      stride: 'TAMPERING',
      attackTactic: 'Impact',
      attackTechnique: 'T1485',
      defaultLikelihood: 2,
      defaultImpact: 5,
    },
  ],
  API_GATEWAY: [
    {
      title: 'Broken Object Level Authorization (BOLA)',
      description:
        'Attacker accesses resources belonging to other users by manipulating object IDs in API requests.',
      stride: 'TAMPERING',
      attackTactic: 'Discovery',
      attackTechnique: 'T1590',
      defaultLikelihood: 4,
      defaultImpact: 4,
    },
    {
      title: 'API Key / Token Exposure',
      description: 'API keys or tokens exposed in client-side code, logs, or error responses.',
      stride: 'INFO_DISCLOSURE',
      attackTactic: 'Credential Access',
      attackTechnique: 'T1552',
      defaultLikelihood: 3,
      defaultImpact: 4,
    },
    {
      title: 'Authentication Bypass via Misconfigured Middleware',
      description:
        'Attacker reaches protected endpoints due to incorrectly configured auth middleware or route ordering.',
      stride: 'SPOOFING',
      attackTactic: 'Initial Access',
      attackTechnique: 'T1078',
      defaultLikelihood: 2,
      defaultImpact: 5,
    },
    {
      title: 'Rate Limit Bypass — Brute Force / Enumeration',
      description:
        'Attacker circumvents rate limiting via IP rotation or header manipulation to perform credential stuffing or enumeration.',
      stride: 'DENIAL_OF_SERVICE',
      attackTactic: 'Credential Access',
      attackTechnique: 'T1110',
      defaultLikelihood: 3,
      defaultImpact: 3,
    },
    {
      title: 'Mass Assignment / Parameter Pollution',
      description:
        'Attacker sends extra fields in request body that are bound to privileged model properties.',
      stride: 'ELEVATION_OF_PRIVILEGE',
      attackTactic: 'Privilege Escalation',
      attackTechnique: 'T1548',
      defaultLikelihood: 3,
      defaultImpact: 4,
    },
  ],
  WEBAPP: [
    {
      title: 'Cross-Site Scripting (XSS)',
      description:
        "Attacker injects scripts executed in the victim's browser, enabling session theft or credential harvesting.",
      stride: 'TAMPERING',
      attackTactic: 'Execution',
      attackTechnique: 'T1059.007',
      defaultLikelihood: 3,
      defaultImpact: 3,
    },
    {
      title: 'Session Hijacking',
      description:
        'Attacker steals authenticated session tokens via XSS, network sniffing, or insecure cookie attributes.',
      stride: 'SPOOFING',
      attackTactic: 'Credential Access',
      attackTechnique: 'T1539',
      defaultLikelihood: 3,
      defaultImpact: 4,
    },
    {
      title: 'Sensitive Data Exposure via Client-Side Storage',
      description:
        'Sensitive data stored in localStorage, sessionStorage, or cookies without proper security attributes.',
      stride: 'INFO_DISCLOSURE',
      attackTactic: 'Collection',
      attackTechnique: 'T1005',
      defaultLikelihood: 2,
      defaultImpact: 4,
    },
    {
      title: 'Cross-Site Request Forgery (CSRF)',
      description:
        'Attacker tricks authenticated user into performing unintended state-changing actions.',
      stride: 'TAMPERING',
      attackTactic: 'Initial Access',
      attackTechnique: 'T1566',
      defaultLikelihood: 2,
      defaultImpact: 3,
    },
  ],
  IAM_ROLE: [
    {
      title: 'Overly Permissive IAM Role (Privilege Creep)',
      description:
        'IAM role granted permissions beyond least-privilege, enabling lateral movement or privilege escalation if compromised.',
      stride: 'ELEVATION_OF_PRIVILEGE',
      attackTactic: 'Privilege Escalation',
      attackTechnique: 'T1078.004',
      defaultLikelihood: 4,
      defaultImpact: 5,
    },
    {
      title: 'IMDS Credential Theft (SSRF → IAM)',
      description:
        'Attacker exploits SSRF or local access to query the Instance Metadata Service and steal temporary IAM credentials.',
      stride: 'SPOOFING',
      attackTactic: 'Credential Access',
      attackTechnique: 'T1552.005',
      defaultLikelihood: 3,
      defaultImpact: 5,
    },
    {
      title: 'Cross-Account Role Assumption Abuse',
      description:
        'Misconfigured trust policy allows unintended principals to assume the role and pivot to another account.',
      stride: 'ELEVATION_OF_PRIVILEGE',
      attackTactic: 'Privilege Escalation',
      attackTechnique: 'T1484.001',
      defaultLikelihood: 2,
      defaultImpact: 5,
    },
    {
      title: 'Long-Lived Access Keys in Code / Config',
      description:
        'IAM access keys hard-coded in source code or config files leak via version control or misconfigured storage.',
      stride: 'INFO_DISCLOSURE',
      attackTactic: 'Credential Access',
      attackTechnique: 'T1552.001',
      defaultLikelihood: 4,
      defaultImpact: 4,
    },
  ],
  S3_BUCKET: [
    {
      title: 'Publicly Accessible Bucket',
      description:
        'S3 bucket misconfigured with public ACL or bucket policy, exposing sensitive objects to the internet.',
      stride: 'INFO_DISCLOSURE',
      attackTactic: 'Collection',
      attackTechnique: 'T1530',
      defaultLikelihood: 3,
      defaultImpact: 5,
    },
    {
      title: 'Malicious Object Upload',
      description:
        'Attacker with write permissions uploads malware, web shells, or tampered files consumed by downstream services.',
      stride: 'TAMPERING',
      attackTactic: 'Resource Development',
      attackTechnique: 'T1583',
      defaultLikelihood: 2,
      defaultImpact: 4,
    },
    {
      title: 'Data Destruction — Versioning Disabled',
      description:
        'Without object versioning, ransomware or accidental deletion causes permanent and irreversible data loss.',
      stride: 'DENIAL_OF_SERVICE',
      attackTactic: 'Impact',
      attackTechnique: 'T1485',
      defaultLikelihood: 2,
      defaultImpact: 4,
    },
    {
      title: 'Exfiltration via Pre-Signed URL Leakage',
      description:
        'Pre-signed URLs with long expiry or insufficient scope leaked via logs or referrer headers allow unauthorized access.',
      stride: 'INFO_DISCLOSURE',
      attackTactic: 'Exfiltration',
      attackTechnique: 'T1048',
      defaultLikelihood: 2,
      defaultImpact: 3,
    },
  ],
  ACTIVE_DIRECTORY: [
    {
      title: 'Pass-the-Hash / Pass-the-Ticket',
      description:
        'Attacker uses captured NTLM hash or Kerberos TGT/TGS to authenticate without knowing the plaintext password.',
      stride: 'SPOOFING',
      attackTactic: 'Lateral Movement',
      attackTechnique: 'T1550.002',
      defaultLikelihood: 4,
      defaultImpact: 5,
    },
    {
      title: 'Kerberoasting',
      description:
        'Attacker requests Kerberos service tickets for service accounts and cracks them offline to recover passwords.',
      stride: 'SPOOFING',
      attackTactic: 'Credential Access',
      attackTechnique: 'T1558.003',
      defaultLikelihood: 4,
      defaultImpact: 4,
    },
    {
      title: 'DCSync — Domain Credential Dump',
      description:
        'Attacker with replication rights impersonates a DC to dump NTDS.dit and obtain all domain credentials.',
      stride: 'ELEVATION_OF_PRIVILEGE',
      attackTactic: 'Credential Access',
      attackTechnique: 'T1003.006',
      defaultLikelihood: 2,
      defaultImpact: 5,
    },
    {
      title: 'GPO Modification for Persistence',
      description:
        'Attacker with GPO write permissions deploys malicious policy (startup scripts, scheduled tasks) to all domain machines.',
      stride: 'TAMPERING',
      attackTactic: 'Defense Evasion',
      attackTechnique: 'T1484.001',
      defaultLikelihood: 2,
      defaultImpact: 5,
    },
    {
      title: 'AS-REP Roasting',
      description:
        'Accounts with Kerberos pre-authentication disabled allow offline cracking without any prior authentication.',
      stride: 'SPOOFING',
      attackTactic: 'Credential Access',
      attackTechnique: 'T1558.004',
      defaultLikelihood: 3,
      defaultImpact: 4,
    },
    {
      title: 'BloodHound — Attack Path Discovery',
      description:
        'Attacker uses AD object relationships to enumerate privilege escalation paths to Domain Admin.',
      stride: 'INFO_DISCLOSURE',
      attackTactic: 'Discovery',
      attackTechnique: 'T1087',
      defaultLikelihood: 4,
      defaultImpact: 3,
    },
  ],
  CONTAINER: [
    {
      title: 'Container Escape to Host',
      description:
        'Attacker exploits privileged mode, mounted host paths, or kernel vulnerability to break out of the container to the host OS.',
      stride: 'ELEVATION_OF_PRIVILEGE',
      attackTactic: 'Privilege Escalation',
      attackTechnique: 'T1611',
      defaultLikelihood: 2,
      defaultImpact: 5,
    },
    {
      title: 'Compromised Base Image / Supply Chain',
      description:
        'Malicious code embedded in a public base image or third-party dependency executes inside the container at runtime.',
      stride: 'TAMPERING',
      attackTactic: 'Supply Chain Compromise',
      attackTechnique: 'T1195.002',
      defaultLikelihood: 3,
      defaultImpact: 4,
    },
    {
      title: 'Secrets in Environment Variables',
      description:
        'Sensitive credentials stored in container env vars are accessible to any process in the container and visible in orchestrator logs.',
      stride: 'INFO_DISCLOSURE',
      attackTactic: 'Credential Access',
      attackTechnique: 'T1552.007',
      defaultLikelihood: 4,
      defaultImpact: 4,
    },
    {
      title: 'Lateral Movement via Shared Network Namespace',
      description:
        'Containers sharing a network namespace allow an attacker in one container to reach services bound to localhost in another.',
      stride: 'TAMPERING',
      attackTactic: 'Lateral Movement',
      attackTechnique: 'T1021',
      defaultLikelihood: 2,
      defaultImpact: 4,
    },
  ],
  FIREWALL: [
    {
      title: 'Overly Permissive Firewall Rules',
      description:
        'Misconfigured rules allow lateral movement between network segments that should be isolated.',
      stride: 'TAMPERING',
      attackTactic: 'Defense Evasion',
      attackTechnique: 'T1562.007',
      defaultLikelihood: 3,
      defaultImpact: 4,
    },
    {
      title: 'Admin Interface Exposed to Untrusted Network',
      description:
        'Management interface reachable from the internet or DMZ enables unauthorized configuration changes.',
      stride: 'SPOOFING',
      attackTactic: 'Initial Access',
      attackTechnique: 'T1078',
      defaultLikelihood: 2,
      defaultImpact: 5,
    },
  ],
  VPN: [
    {
      title: 'Credential Stuffing Against VPN',
      description:
        'Attacker uses leaked credential lists against VPN endpoints without MFA, gaining network-level access.',
      stride: 'SPOOFING',
      attackTactic: 'Initial Access',
      attackTechnique: 'T1078',
      defaultLikelihood: 4,
      defaultImpact: 4,
    },
    {
      title: 'Split Tunneling — Traffic Bypass',
      description:
        'Attacker on a split-tunnel VPN routes traffic through the local network, bypassing corporate security controls.',
      stride: 'INFO_DISCLOSURE',
      attackTactic: 'Defense Evasion',
      attackTechnique: 'T1572',
      defaultLikelihood: 3,
      defaultImpact: 3,
    },
    {
      title: 'VPN Client Vulnerability Exploitation',
      description:
        'Unpatched CVE in VPN client software (e.g. Pulse Secure, Fortinet) exploited pre-authentication for RCE.',
      stride: 'TAMPERING',
      attackTactic: 'Initial Access',
      attackTechnique: 'T1190',
      defaultLikelihood: 2,
      defaultImpact: 5,
    },
  ],
  LOAD_BALANCER: [
    {
      title: 'Volumetric DDoS Attack',
      description:
        "Attacker generates traffic exceeding the load balancer's capacity, causing service unavailability for legitimate users.",
      stride: 'DENIAL_OF_SERVICE',
      attackTactic: 'Impact',
      attackTechnique: 'T1498',
      defaultLikelihood: 3,
      defaultImpact: 4,
    },
    {
      title: 'HTTP Header Injection / IP Spoofing',
      description:
        'Attacker injects X-Forwarded-For or Host headers to bypass IP-based access controls or poison logs.',
      stride: 'SPOOFING',
      attackTactic: 'Defense Evasion',
      attackTechnique: 'T1036',
      defaultLikelihood: 2,
      defaultImpact: 3,
    },
  ],
  WORKSTATION: [
    {
      title: 'Spear Phishing / Malware Delivery',
      description:
        'Targeted phishing email delivers malicious attachment or link, compromising the workstation and establishing foothold.',
      stride: 'TAMPERING',
      attackTactic: 'Initial Access',
      attackTechnique: 'T1566',
      defaultLikelihood: 5,
      defaultImpact: 3,
    },
    {
      title: 'Local Admin Privilege Abuse',
      description:
        'User operating as local admin installs unauthorized software, modifies security settings, or facilitates malware persistence.',
      stride: 'ELEVATION_OF_PRIVILEGE',
      attackTactic: 'Privilege Escalation',
      attackTechnique: 'T1078.003',
      defaultLikelihood: 3,
      defaultImpact: 3,
    },
    {
      title: 'Browser Credential Harvesting',
      description:
        'Malware extracts saved passwords and session cookies from browser credential stores.',
      stride: 'INFO_DISCLOSURE',
      attackTactic: 'Credential Access',
      attackTechnique: 'T1555.003',
      defaultLikelihood: 3,
      defaultImpact: 4,
    },
  ],
  MESSAGE_QUEUE: [
    {
      title: 'Unauthorized Message Injection',
      description:
        'Attacker injects malicious payloads into the queue, causing downstream consumers to execute attacker-controlled commands.',
      stride: 'TAMPERING',
      attackTactic: 'Execution',
      attackTechnique: 'T1059',
      defaultLikelihood: 2,
      defaultImpact: 4,
    },
    {
      title: 'Queue Flooding DoS',
      description:
        'Attacker floods the queue with high volumes of messages, exhausting processing capacity and starving legitimate messages.',
      stride: 'DENIAL_OF_SERVICE',
      attackTactic: 'Impact',
      attackTechnique: 'T1499',
      defaultLikelihood: 2,
      defaultImpact: 3,
    },
  ],
  IDENTITY_PROVIDER: [
    {
      title: 'SAML Assertion Forgery / XML Signature Wrapping',
      description:
        'Attacker exploits XML signature validation flaws to forge SAML assertions and authenticate as any user.',
      stride: 'SPOOFING',
      attackTactic: 'Defense Evasion',
      attackTechnique: 'T1550.002',
      defaultLikelihood: 2,
      defaultImpact: 5,
    },
    {
      title: 'OAuth Token Theft via Phishing',
      description:
        'Attacker uses a fake consent page or malicious redirect URI to steal OAuth access/refresh tokens.',
      stride: 'SPOOFING',
      attackTactic: 'Credential Access',
      attackTechnique: 'T1528',
      defaultLikelihood: 3,
      defaultImpact: 5,
    },
    {
      title: 'MFA Fatigue / Push Bombing',
      description:
        'Attacker bombards the user with MFA push notifications until they approve out of frustration.',
      stride: 'SPOOFING',
      attackTactic: 'Credential Access',
      attackTechnique: 'T1621',
      defaultLikelihood: 3,
      defaultImpact: 4,
    },
  ],
  CACHE: [
    {
      title: 'Cache Poisoning',
      description:
        'Attacker injects malicious content into the cache, serving it to all subsequent users of that cache key.',
      stride: 'TAMPERING',
      attackTactic: 'Defense Evasion',
      attackTechnique: 'T1036',
      defaultLikelihood: 2,
      defaultImpact: 4,
    },
    {
      title: 'Sensitive Data in Cache',
      description:
        'Cached responses contain sensitive data accessible to anyone who can read the cache store.',
      stride: 'INFO_DISCLOSURE',
      attackTactic: 'Collection',
      attackTechnique: 'T1005',
      defaultLikelihood: 3,
      defaultImpact: 3,
    },
  ],
  DNS: [
    {
      title: 'DNS Hijacking / Cache Poisoning',
      description:
        'Attacker poisons DNS cache or hijacks DNS records to redirect traffic to malicious infrastructure.',
      stride: 'SPOOFING',
      attackTactic: 'Command and Control',
      attackTechnique: 'T1568',
      defaultLikelihood: 2,
      defaultImpact: 4,
    },
    {
      title: 'DNS Tunneling for C2',
      description:
        'Attacker uses DNS queries/responses as a covert channel to exfiltrate data or maintain C2 communication.',
      stride: 'INFO_DISCLOSURE',
      attackTactic: 'Exfiltration',
      attackTechnique: 'T1071.004',
      defaultLikelihood: 2,
      defaultImpact: 3,
    },
  ],
  MONITORING: [
    {
      title: 'Alert Suppression / Log Tampering',
      description:
        'Attacker disables or tampers with monitoring agents to prevent detection of malicious activity.',
      stride: 'REPUDIATION',
      attackTactic: 'Defense Evasion',
      attackTechnique: 'T1562.001',
      defaultLikelihood: 3,
      defaultImpact: 4,
    },
  ],
  SWITCH: [
    {
      title: 'VLAN Hopping',
      description:
        'Attacker exploits misconfigured trunk ports or double-tagging to access traffic on other VLANs.',
      stride: 'INFO_DISCLOSURE',
      attackTactic: 'Lateral Movement',
      attackTechnique: 'T1599',
      defaultLikelihood: 2,
      defaultImpact: 4,
    },
    {
      title: 'ARP Spoofing / MAC Flooding',
      description:
        'Attacker poisons ARP tables or floods CAM table to intercept LAN traffic (MITM).',
      stride: 'SPOOFING',
      attackTactic: 'Collection',
      attackTechnique: 'T1557',
      defaultLikelihood: 2,
      defaultImpact: 4,
    },
  ],
  CDN: [
    {
      title: 'CDN Origin Pull Bypass',
      description:
        'Attacker queries the origin server directly, bypassing CDN-level WAF and DDoS protections.',
      stride: 'TAMPERING',
      attackTactic: 'Defense Evasion',
      attackTechnique: 'T1562',
      defaultLikelihood: 3,
      defaultImpact: 3,
    },
    {
      title: 'Malicious Content Injection via CDN Compromise',
      description:
        'Compromise of CDN account or edge node allows injection of malicious scripts into served content at scale.',
      stride: 'TAMPERING',
      attackTactic: 'Supply Chain Compromise',
      attackTechnique: 'T1195.002',
      defaultLikelihood: 1,
      defaultImpact: 5,
    },
  ],
};

// ── Data flow threat rules ─────────────────────────────────────────────────────

export interface FlowThreatRule {
  id: string;
  condition: (flow: FlowContext) => boolean;
  template: ThreatTemplate;
}

export const FLOW_THREAT_RULES: FlowThreatRule[] = [
  {
    id: 'cleartext-transmission',
    condition: (f) => !f.isEncrypted,
    template: {
      title: 'Cleartext Data Transmission',
      description:
        'Data transmitted over the network without encryption is vulnerable to interception (MITM), enabling credential theft and data exfiltration.',
      stride: 'INFO_DISCLOSURE',
      attackTactic: 'Collection',
      attackTechnique: 'T1040',
      defaultLikelihood: 3,
      defaultImpact: 4,
    },
  },
  {
    id: 'mitm-trust-boundary',
    condition: (f) => !f.isEncrypted && f.crossesTrustBoundary,
    template: {
      title: 'Man-in-the-Middle Across Trust Boundary',
      description:
        'Unencrypted flow crossing a trust boundary (e.g. internet, DMZ, cloud↔DC link) is highly vulnerable to active interception and data manipulation.',
      stride: 'TAMPERING',
      attackTactic: 'Collection',
      attackTechnique: 'T1557',
      defaultLikelihood: 3,
      defaultImpact: 5,
    },
  },
  {
    id: 'spoofed-source-boundary',
    condition: (f) => f.crossesTrustBoundary,
    template: {
      title: 'Spoofed Source Identity Across Trust Boundary',
      description:
        'Flows crossing trust boundaries are high-value targets for impersonation attacks where the caller identity is forged to gain unauthorized access.',
      stride: 'SPOOFING',
      attackTactic: 'Defense Evasion',
      attackTechnique: 'T1036',
      defaultLikelihood: 2,
      defaultImpact: 4,
    },
  },
  {
    id: 'repudiation-boundary',
    condition: (f) => f.crossesTrustBoundary,
    template: {
      title: 'Insufficient Logging of Cross-Boundary Transactions',
      description:
        'Without comprehensive logging of cross-boundary flows, attackers can deny performing malicious actions and forensic investigations are impaired.',
      stride: 'REPUDIATION',
      attackTactic: 'Defense Evasion',
      attackTechnique: 'T1070',
      defaultLikelihood: 3,
      defaultImpact: 3,
    },
  },
  {
    id: 'sensitive-data-exfil',
    condition: (f) => ['CONFIDENTIAL', 'SECRET'].includes(f.dataClassification),
    template: {
      title: 'High-Value Data Flow — Exfiltration Target',
      description:
        'Flows carrying confidential or secret-classified data are primary exfiltration targets. Any compromise of this flow results in significant data breach.',
      stride: 'INFO_DISCLOSURE',
      attackTactic: 'Exfiltration',
      attackTechnique: 'T1048',
      defaultLikelihood: 2,
      defaultImpact: 5,
    },
  },
  {
    id: 'insecure-protocol',
    condition: (f) => ['HTTP', 'FTP', 'TELNET', 'SMTP', 'SNMP'].includes(f.protocol.toUpperCase()),
    template: {
      title: 'Insecure Protocol Without Encryption',
      description: `Cleartext protocol (${''}) provides no confidentiality or integrity protection. Credentials and data are fully visible to any network observer.`,
      stride: 'INFO_DISCLOSURE',
      attackTactic: 'Credential Access',
      attackTechnique: 'T1040',
      defaultLikelihood: 3,
      defaultImpact: 3,
    },
  },
];

// ── Risk label helper ─────────────────────────────────────────────────────────

export function riskLabel(score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 15) return 'CRITICAL';
  if (score >= 10) return 'HIGH';
  if (score >= 5) return 'MEDIUM';
  return 'LOW';
}
