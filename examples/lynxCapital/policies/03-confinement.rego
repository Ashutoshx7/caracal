# caracal:data-document
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Customer confinement data: label prefixes whose agent sessions are capped to a fixed
# scope surface. The platform decision contract reads this document; it never decides.
package caracal.authz

import rego.v1

confinement := [{
	"label_prefix": "customer:",
	"scopes": [
		"corebilling:collect",
		"corebilling:post",
		"corebilling:read",
		"vela:read",
		"vela:send",
	],
}]
