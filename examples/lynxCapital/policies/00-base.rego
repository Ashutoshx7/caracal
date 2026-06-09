# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Base decision document that aggregates the Lynx Capital scenario policies into the
# Caracal token-exchange result and enforces per-customer subject scoping.
package caracal.authz

import rego.v1

# The token-exchange result the STS evaluates. decision, determining_policies, and
# diagnostics are computed below from the scenario policies in this package.
result := {
	"decision": decision,
	"evaluation_status": "complete",
	"determining_policies": determining_policies,
	"diagnostics": diagnostics,
}

# An exchange is allowed when it is a token exchange, requests at least one scope, and
# every requested scope is permitted by a scenario policy for this principal, resource,
# and customer. allowed_scopes is a partial set contributed by the scenario policies.
default decision := "deny"

decision := "allow" if {
	input.action.id == "TokenExchange"
	count(input.context.requested_scopes) > 0
	every scope in input.context.requested_scopes {
		scope in allowed_scopes
	}
}

# Name the scenario policies that determined an allow; empty on deny.
default determining_policies := []

determining_policies := [{"policy": name} | some name in determining] if {
	decision == "allow"
}

# Diagnostics raised by scenario policies (for example a required step-up challenge).
diagnostics := [entry | some entry in diagnostic]

# The customer the request acts for. Every Lynx agent runs on behalf of an identified
# customer subject; the policy set reads the customer from the subject claims, never from
# a label or a scope name.
customer_id := id if {
	id := input.context.subject_claims.customer_id
	id != ""
}

# Customer scoping: a request against a customer-scoped resource must carry a customer
# subject. The shared managed-application credential, with no customer subject, can never
# read customer data — it can only spawn the agents that act for a customer.
customer_scoped if customer_id

# The customer's plan entitlement, a subject claim that premium capabilities key on.
customer_plan := plan if {
	plan := input.context.subject_claims.plan
}

# Administrative and break-glass capabilities are only available to customers on a premium
# plan. A lower tier may carry the same capability label but is denied by this gate, so the
# same role definition yields different authority per customer.
premium_plan if {
	customer_plan in {"scale", "enterprise"}
}

# A capability label set on the agent session at spawn time, e.g. "portfolio-write".
has_capability(capability) if {
	some label in input.principal.labels
	label == capability
}

# A Lynx Capital domain resource.
lynx_resource if {
	input.resource.identifier in {
		"resource://portfolio",
		"resource://research",
		"resource://compliance",
	}
}
