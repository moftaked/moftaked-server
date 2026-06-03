# Skill: `<!-- SKILL-NAME -->`
> SecuritySkills — UnitOne.ai
> Author: <!-- name / agent session ID -->
> Created: <!-- DATE -->
> Version: 1.0.0
> Status: `<!-- DRAFT | REVIEW | STABLE | DEPRECATED -->`

---

## Metadata

```yaml
name: <!-- kebab-case-skill-name -->
bundle: <!-- AppSec | DevSecOps | Infra | Red Team | Security Engineer -->
vulnerability_class: <!-- Prompt Injection | Secret Leakage | Tool Misuse | SSRF | Blast Radius | Context Poisoning | ... -->
severity: <!-- CRITICAL | HIGH | MEDIUM | LOW -->
cwe: <!-- e.g. CWE-89, CWE-798 — see /references/cwe-map.md -->
mitre_attack: <!-- e.g. T1552 - Unsecured Credentials -->
ave_taxonomy: <!-- Agent Vulnerability Enumeration ref — see /references/ave-taxonomy.md -->
parallelizable: <!-- true | false -->
runtimes:
  - <!-- Claude Code | Cursor | Codex CLI | Gemini CLI | OpenClaw -->
precision_score: <!-- 0.0–1.0 — set after first synthetic test run -->
last_verified: <!-- DATE -->
```

---

## Intent

> ONE sentence. What security outcome does this skill protect?
> Lead with the agent behavior being governed, not the vulnerability class name.

```
<!-- Example: Prevent an AI coding agent from embedding secrets into
     generated source files, environment configs, or commit history. -->
```

---

## Why This Matters in Agentic Systems

> 2–3 sentences. Why do traditional controls fail here?
> What does an agent do that a human developer wouldn't?
> What is the blast radius if this skill is absent?

```
<!-- Example: Static secret scanners run post-generation — by the time
     they fire, the agent has already committed the credential. Agents
     operating across multiple tool calls can propagate a secret across
     five files in a single session with no human review checkpoint.
     Without this skill, a single compromised context window becomes a
     credential exfiltration surface. -->
```

---

## Detection Patterns

> What signals tell the agent this vulnerability class is present?
> Be precise. Include patterns the agent can match against — not just descriptions.

### Signal Types

| Signal | Pattern | Confidence |
|---|---|---|
| <!-- e.g. AST pattern --> | <!-- e.g. hardcoded string assigned to key/token/secret var --> | <!-- HIGH / MEDIUM / LOW --> |
| <!-- e.g. Regex --> | <!-- e.g. `(api_key\|secret\|token)\s*=\s*['"][A-Za-z0-9]{16,}['"]` --> | |
| <!-- e.g. Structural --> | <!-- e.g. .env file committed alongside source --> | |
| <!-- e.g. Behavioral --> | <!-- e.g. agent reads from environment then writes to generated file --> | |

### Reference Patterns
```
→ /references/<!-- pattern-file.md -->
```

---

## Constraints

> Hard rules only. What the agent MUST or MUST NOT do.
> No suggestions. No "consider" language. Falsifiable and enforceable.

- **MUST NOT** <!-- e.g. generate code containing hardcoded credentials under any condition -->
- **MUST NOT** <!-- e.g. pass secrets as positional CLI arguments -->
- **MUST** <!-- e.g. replace any detected secret with an environment variable reference -->
- **MUST** <!-- e.g. flag the file for human review before committing -->
- **MUST** <!-- e.g. check generated output against detection patterns before marking task complete -->

---

## Remediation

> What does the agent emit or change when this skill fires?
> Link to /scripts/ and /templates/ — do not inline complex logic here.

### Fix Strategy
```
<!-- Describe the remediation approach in 2–3 sentences.
     What is being replaced, with what, and why that preserves intent. -->
```

### Fix Template
```
→ /templates/<!-- fix-template-name -->
<!-- OR paste a short inline template if < 15 lines -->
```

### Automated Fix Script
```
→ /scripts/<!-- fix-script-name -->
<!-- OR describe what the script does if not yet created -->
```

### Remediation Output Example

**Before (vulnerable):**
```
<!-- Paste a minimal code/config example showing the vulnerability -->
```

**After (remediated):**
```
<!-- Paste what the agent should emit as the fixed version -->
```

---

## Verification

> The agent does not mark this skill RESOLVED until all three pass.
> Senior engineer gate: would a principal security engineer accept this as verified?

### Expected Behavior
```
<!-- Describe exactly what the component looks like when this
     vulnerability class is correctly mitigated. Be specific. -->
```

### Actual Behavior Check
> Step-by-step confirmation the fix held after remediation.

1. <!-- e.g. Re-scan the modified file with detection pattern from above -->
2. <!-- e.g. Confirm no matches returned -->
3. <!-- e.g. Run the verification script at /scripts/verify-<skill-name>.sh -->
4. <!-- e.g. Check that agent behavior (function output) is unchanged -->

### Falsifiable Test

| | |
|---|---|
| **Input** | <!-- Minimal vulnerable input the agent can use as a test case --> |
| **Expected output** | <!-- What the remediated version should produce --> |
| **Pass condition** | <!-- What a PASS looks like — specific and binary --> |
| **Fail condition** | <!-- What a FAIL looks like — specific and binary --> |

### Verification Script
```
→ /scripts/verify-<!-- skill-name -->.sh
<!-- OR describe manual verification steps if script not yet created -->
```

---

## Flexibility Guidance

> Where the agent has discretion. What context changes the right answer.
> Prevents over-constraining — the agent should reason here, not just execute.

- **When context changes the constraint:** <!-- e.g. Test fixtures may contain fake credentials — agent should detect `fake` / `test` / `example` prefixes and downgrade severity -->
- **Acceptable variation:** <!-- e.g. Secrets injected via CI environment variables at runtime are acceptable; hardcoded fallbacks are not -->
- **Escalate to human when:** <!-- e.g. Agent cannot determine whether a pattern is a real credential or documentation example -->
- **Do NOT flag:** <!-- e.g. Example.com URLs, placeholder values like `YOUR_API_KEY_HERE`, clearly mocked test data -->

---

## Gotchas

> Minimum 2 entries on creation. Add more after each production run.
> This section is the self-improvement loop — it evolves the skill over time.

### False Positives

- **Pattern:** <!-- Describe the false positive trigger -->
  **Why it fires:** <!-- What context causes the agent to incorrectly flag this -->
  **How to suppress:** <!-- Specific guidance to avoid flagging valid code -->

- **Pattern:** <!-- Second false positive pattern -->
  **Why it fires:**
  **How to suppress:**

### Precision Traps

- **Trap:** <!-- Describe where the remediation breaks agent behavior -->
  **Scenario:** <!-- When does this happen? What is the agent trying to do? -->
  **Mitigation:** <!-- How to preserve intent while maintaining the security control -->

### Exploit Pattern Lessons

- **Observed in:** <!-- CVE ref | agentic attack pattern | internal finding | research -->
  **Lesson:** <!-- What this revealed about detection or remediation gaps in this skill -->

---

## Subagent Execution Profile

> This skill must be executable by ONE focused subagent with no cross-bundle context.

| Property | Value |
|---|---|
| **Single responsibility** | <!-- YES / NO — if NO, split the skill --> |
| **Cross-bundle dependency** | <!-- NONE | list dependencies if any --> |
| **Parallelizable with** | <!-- list skill names this can run alongside, or NONE --> |
| **Estimated tokens (context load)** | <!-- LOW <2k | MEDIUM 2–5k | HIGH 5k+ --> |
| **Recommended subagent role** | <!-- e.g. Security Scanner | Fix Generator | Verifier --> |

---

## File Structure

> All supporting assets must live in the correct directories.
> Inline only what is < 15 lines. Everything else is a file reference.

```
skills/
└── <bundle>/
    └── <skill-name>/
        ├── SKILL.md                    ← this file
        ├── references/
        │   ├── <!-- cve-refs.md -->    ← CVE / MITRE / AVE links
        │   └── <!-- patterns.md -->   ← detection pattern library
        ├── scripts/
        │   ├── <!-- fix.sh -->        ← automated fix script
        │   └── <!-- verify.sh -->     ← verification script
        └── templates/
            └── <!-- fix-template --> ← scaffolding agent emits on remediation
```

---

## Changelog

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0.0 | <!-- DATE --> | <!-- author --> | Initial creation |

---

## Skill Sign-Off Checklist

> Complete before setting Status to `STABLE`. Every item must be checked.

### Authoring
- [ ] Metadata YAML complete and valid
- [ ] Intent is one sentence, agent-behavior-first
- [ ] Why This Matters explains agentic-specific blast radius
- [ ] Detection patterns include at least one machine-matchable signal (regex / AST / structural)
- [ ] Constraints are hard rules — no "consider" or "may" language
- [ ] Remediation links to `/scripts/` and `/templates/` (not inlined if > 15 lines)
- [ ] Before/After remediation example present

### Verification
- [ ] Falsifiable test defined (binary pass/fail)
- [ ] Verification script exists at `/scripts/verify-<skill-name>`
- [ ] Actual behavior check is step-by-step, not aspirational
- [ ] Verified against synthetic agent session
- [ ] Precision score set after test run

### Elegance
- [ ] No redundant sub-bullets that restate the parent
- [ ] No overlap with existing skills in the same bundle (checked against bundle index)
- [ ] Flexibility Guidance prevents over-constraining the agent
- [ ] Intent-first structure: Intent → Why → Detection → Constraints → Remediation → Verification → Flexibility → Gotchas

### System Layer
- [ ] `/references/` directory created with CVE / MITRE / pattern files
- [ ] `/scripts/` contains fix and verify scripts (or stub with TODO)
- [ ] `/templates/` contains remediation scaffolding (or stub with TODO)
- [ ] No external knowledge left inline that belongs in `/references/`

### Self-Improvement
- [ ] Gotchas section has minimum 2 false positive entries
- [ ] Gotchas section has minimum 1 precision trap entry
- [ ] Gotchas section has minimum 1 exploit pattern lesson

### Subagent Fit
- [ ] Single responsibility confirmed (no mixed concerns)
- [ ] No cross-bundle context dependency
- [ ] Parallelizable field set correctly

### Bundle Integration
- [ ] Skill added to bundle index (`/bundles/<bundle-name>/INDEX.md`)
- [ ] Skill tagged in AVE taxonomy (`/references/ave-taxonomy.md`)
- [ ] Commit message follows: `feat(skill): <skill-name> — <vulnerability-class>`

---

*SecuritySkills Skill Template v1.0 — UnitOne.ai*
*Systems > Prompts · Verification > Generation · No Lazy Fixes — Solve Root Cause*
