// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for the native operation-authority floor enforced on Gateway exchanges.

package internal

import (
	"testing"

	sharederr "github.com/garudex-labs/caracal/packages/core/go/errors"
)

func mandateSet(scopes ...string) map[string]struct{} {
	set := map[string]struct{}{}
	for _, scope := range scopes {
		set[scope] = struct{}{}
	}
	return set
}

func TestAuthorizeOperationAllowsDeclaredOperationWithScope(t *testing.T) {
	resource := &Resource{
		Identifier:           "resource://nucleus",
		OperationEnforcement: OperationEnforcementEnforced,
		Operations: []ResourceOperation{
			{Method: "GET", Path: "/api/get_payment", Scope: "cordoba:read"},
		},
	}
	if err := authorizeOperation(resource, "GET", "/api/get_payment", mandateSet("cordoba:read")); err != nil {
		t.Fatalf("declared operation with matching scope must be allowed, got %v", err)
	}
}

func TestAuthorizeOperationNormalizesMethodCase(t *testing.T) {
	resource := &Resource{
		Identifier:           "resource://nucleus",
		OperationEnforcement: OperationEnforcementEnforced,
		Operations: []ResourceOperation{
			{Method: "get", Path: "/api/get_payment", Scope: "cordoba:read"},
		},
	}
	if err := authorizeOperation(resource, "GET", "/api/get_payment", mandateSet("cordoba:read")); err != nil {
		t.Fatalf("method comparison must be case-insensitive, got %v", err)
	}
}

func TestAuthorizeOperationDeniesUndeclaredOperation(t *testing.T) {
	resource := &Resource{
		Identifier:           "resource://nucleus",
		OperationEnforcement: OperationEnforcementEnforced,
		Operations: []ResourceOperation{
			{Method: "GET", Path: "/api/get_payment", Scope: "cordoba:read"},
		},
	}
	err := authorizeOperation(resource, "POST", "/api/submit_wire", mandateSet("cordoba:read"))
	if err == nil {
		t.Fatal("an undeclared operation must be denied on an enforced resource")
	}
	if err.Code != sharederr.OperationNotPermitted {
		t.Fatalf("expected operation_not_permitted, got %s", err.Code)
	}
}

func TestAuthorizeOperationDeniesWhenMandateMissingScope(t *testing.T) {
	resource := &Resource{
		Identifier:           "resource://nucleus",
		OperationEnforcement: OperationEnforcementEnforced,
		Operations: []ResourceOperation{
			{Method: "POST", Path: "/api/submit_wire", Scope: "treasury:wire"},
		},
	}
	err := authorizeOperation(resource, "POST", "/api/submit_wire", mandateSet("cordoba:read"))
	if err == nil {
		t.Fatal("an operation whose scope the mandate lacks must be denied")
	}
	if err.Code != sharederr.OperationNotPermitted {
		t.Fatalf("expected operation_not_permitted, got %s", err.Code)
	}
}

func TestAuthorizeOperationSkipsTransportUniformResource(t *testing.T) {
	resource := &Resource{
		Identifier:           "resource://piperchat",
		OperationEnforcement: OperationEnforcementUniform,
	}
	if err := authorizeOperation(resource, "POST", "/mcp", mandateSet("piperchat:invoke")); err != nil {
		t.Fatalf("a transport_uniform resource must not be operation-gated, got %v", err)
	}
}

func TestMandateScopeSetParsesScopeClaim(t *testing.T) {
	set := mandateScopeSet(map[string]any{"scope": "cordoba:read treasury:wire"})
	if _, ok := set["cordoba:read"]; !ok {
		t.Fatal("expected cordoba:read in mandate scope set")
	}
	if _, ok := set["treasury:wire"]; !ok {
		t.Fatal("expected treasury:wire in mandate scope set")
	}
	if len(set) != 2 {
		t.Fatalf("expected 2 scopes, got %d", len(set))
	}
}

func TestMandateScopeSetEmptyWhenNoClaim(t *testing.T) {
	if set := mandateScopeSet(nil); len(set) != 0 {
		t.Fatalf("a nil mandate must yield no scopes, got %d", len(set))
	}
}
