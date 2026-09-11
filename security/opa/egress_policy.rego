package convergence.security.egress

# Zero-egress by default (OWASP LLM08 / SSRF containment).
#
# An agent-invoked tool or sandboxed code may reach a destination ONLY if it is on
# the vertical's explicit allowlist AND is not a known internal/metadata host.
# This is enforced at the network boundary (VPC/SG on GCP/AWS; edge-function fetch
# allowlist on the current Lovable/Supabase deployment) — not by trusting the model.

import rego.v1

# Cloud metadata / link-local endpoints an SSRF payload would target. Always denied.
blocked_hosts := {
	"169.254.169.254", # GCP + AWS instance metadata
	"metadata.google.internal", # GCP metadata
	"169.254.170.2", # AWS ECS task metadata
	"localhost",
	"127.0.0.1",
	"0.0.0.0",
	"::1",
}

default allow := false

allow if {
	not blocked
	allowed_by_vertical
}

blocked if {
	input.destination_host in blocked_hosts
}

# Deny private RFC1918 ranges unless the vertical explicitly allows the exact host.
blocked if {
	private_ip(input.destination_host)
	not input.destination_host in object.get(input.vertical_policy, "egress_allowlist", [])
}

allowed_by_vertical if {
	some d in input.vertical_policy.egress_allowlist
	host_match(d, input.destination_host)
}

# Exact host or single-label wildcard suffix match (e.g. "*.courtlistener.com").
host_match(pattern, host) if {
	pattern == host
}

host_match(pattern, host) if {
	startswith(pattern, "*.")
	suffix := substring(pattern, 1, -1) # ".courtlistener.com"
	endswith(host, suffix)
}

private_ip(host) if {
	startswith(host, "10.")
}

private_ip(host) if {
	startswith(host, "192.168.")
}

private_ip(host) if {
	parts := split(host, ".")
	parts[0] == "172"
	second := to_number(parts[1])
	second >= 16
	second <= 31
}
