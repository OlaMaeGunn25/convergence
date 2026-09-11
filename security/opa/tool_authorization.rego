package convergence.security.tools

# Tool authorization (OWASP LLM06/LLM07 — excessive agency, insecure workflows).
#
# An agent may invoke a tool ONLY if the tool is on its vertical's allowlist, the
# requested scope is within the granted scope, and the vertical's compliance floor
# permits the action. Default deny. Read-only tools (e.g. the CourtListener and
# RentCast MCP servers) can never be escalated to a write scope.

import rego.v1

default allow := false

allow if count(deny) == 0

deny contains msg if {
	not tool_in_vertical
	msg := sprintf("tool %v not allowed for vertical %v", [input.tool, input.vertical])
}

deny contains msg if {
	some s in input.requested_scopes
	not s in granted_scopes
	msg := sprintf("scope %v exceeds grant", [s])
}

# Read-only tools may never be invoked with a write/mutating scope.
deny contains msg if {
	input.tool_metadata.read_only == true
	some s in input.requested_scopes
	s in {"write", "delete", "move_money", "send"}
	msg := sprintf("read-only tool %v cannot take mutating scope %v", [input.tool, s])
}

# Vertical compliance floor: hard blocks that no tool call may cross.
deny contains "no autonomous money movement (finance floor)" if {
	input.vertical == "finance"
	input.action == "move_money"
	not input.approval.human_approved
}

deny contains "PHI write requires HITL (medical floor)" if {
	input.vertical == "medical"
	input.action == "write_phi"
	not input.approval.human_approved
}

deny contains "Fair-Housing screen not passed (real-estate floor)" if {
	input.vertical == "realestate"
	input.action in {"send", "publish"}
	not input.fair_housing.passed
}

deny contains "citation audit not passed (legal floor)" if {
	input.vertical == "legal"
	input.action in {"send", "file_document", "publish"}
	not input.citation_audit.releasable
}

tool_in_vertical if {
	some t in input.vertical_policy.allowed_tools
	t == input.tool
}

granted_scopes := object.get(input.vertical_policy, "granted_scopes", [])
