package convergence.security.bola_test

import data.convergence.security.bola
import rego.v1

# Authorized same-tenant read of an owned object.
test_allow_owned_object if {
	bola.allow with input as {
		"principal": {"authenticated": true, "id": "u1", "tenant": "t1", "grants": [{"object": "acct-1", "actions": ["read"]}]},
		"object": {"id": "acct-1", "tenant": "t1"},
		"action": "read",
	}
}

# The msg-82 attack: cross-tenant read must be denied even if everything else looks fine.
test_deny_cross_tenant if {
	not bola.allow with input as {
		"principal": {"authenticated": true, "id": "u1", "tenant": "t1", "grants": [{"object": "acct-4471", "actions": ["read"]}]},
		"object": {"id": "acct-4471", "tenant": "t2"},
		"action": "read",
	}
}

# No grant for the object -> deny.
test_deny_no_grant if {
	not bola.allow with input as {
		"principal": {"authenticated": true, "id": "u1", "tenant": "t1", "grants": []},
		"object": {"id": "acct-1", "tenant": "t1"},
		"action": "read",
	}
}

# Unauthenticated -> deny.
test_deny_unauthenticated if {
	not bola.allow with input as {
		"principal": {"authenticated": false, "id": "u1", "tenant": "t1", "grants": [{"object": "acct-1", "actions": ["read"]}]},
		"object": {"id": "acct-1", "tenant": "t1"},
		"action": "read",
	}
}

# Consequential action without human approval -> deny.
test_deny_consequential_without_approval if {
	not bola.allow with input as {
		"principal": {"authenticated": true, "id": "u1", "tenant": "t1", "grants": [{"object": "inv-9", "actions": ["move_money"]}]},
		"object": {"id": "inv-9", "tenant": "t1"},
		"action": "move_money",
	}
}

# Consequential action with a DIFFERENT human approver -> allow.
test_allow_consequential_with_approval if {
	bola.allow with input as {
		"principal": {"authenticated": true, "id": "u1", "tenant": "t1", "grants": [{"object": "inv-9", "actions": ["move_money"]}]},
		"object": {"id": "inv-9", "tenant": "t1"},
		"action": "move_money",
		"approval": {"human_approved": true, "approver": "u2"},
	}
}

# Self-approval is refused (segregation of duties).
test_deny_self_approval if {
	not bola.allow with input as {
		"principal": {"authenticated": true, "id": "u1", "tenant": "t1", "grants": [{"object": "inv-9", "actions": ["move_money"]}]},
		"object": {"id": "inv-9", "tenant": "t1"},
		"action": "move_money",
		"approval": {"human_approved": true, "approver": "u1"},
	}
}
