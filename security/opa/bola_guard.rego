package convergence.security.bola

# BOLA Guard — deterministic principal-to-object authorization.
#
# This is the boundary that holds when the model is fully co-opted (OWASP LLM06).
# Default deny. An access is allowed ONLY when the authenticated principal holds a
# grant for the EXACT object within the SAME tenant and role scope. A probabilistic
# "looks safe" score from Model Armor / ShieldGemma never reaches or overrides this.
#
# On the current Lovable.ai + Supabase deployment this same logic is enforced in the
# database by Row-Level Security (see security/supabase/rls_policies.sql); this Rego
# is the portable form used at the Agent Gateway on GCP/AWS. They must agree.

import rego.v1

default allow := false

allow if count(violations) == 0

violations contains "principal not authenticated" if {
	not input.principal.authenticated
}

# Tenant isolation — the cross-tenant read the msg-82 attack tries to force.
violations contains "cross-tenant access denied" if {
	input.principal.tenant != input.object.tenant
}

violations contains msg if {
	not has_grant
	msg := sprintf("principal %v has no grant for object %v", [input.principal.id, input.object.id])
}

# Consequential actions require an explicit human approval (segregation of duties:
# the requesting agent may never be the approver).
violations contains msg if {
	consequential
	not input.approval.human_approved
	msg := sprintf("action %v requires human approval", [input.action])
}

violations contains "requester may not self-approve (segregation of duties)" if {
	consequential
	input.approval.human_approved
	input.approval.approver == input.principal.id
}

has_grant if {
	some g in input.principal.grants
	g.object == input.object.id
	input.action in g.actions
}

consequential if {
	input.action in {"send_email", "move_money", "file_document", "write_phi", "delete", "publish"}
}

decision := {
	"decision": d,
	"tier": 1,
	"control": "bola_guard",
	"verdict": "deterministic",
	"principal": input.principal.id,
	"tenant": input.principal.tenant,
	"object": input.object.id,
	"reason": reason,
} if {
	d := allow_string
	reason := reason_string
}

allow_string := "allow" if allow

allow_string := "deny" if not allow

reason_string := "authorized" if allow

reason_string := msg if {
	not allow
	msg := concat("; ", sort([v | some v in violations]))
}
