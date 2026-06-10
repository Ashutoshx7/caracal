# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Audit boundary: read-only evidence views over shared partner providers.
package caracal.authz

import rego.v1

# A spawned audit agent minting a resource mandate: the requested scopes must sit
# inside both its delegation edge and its role's grant on the view.
result := allow_result("lynx-audit-mint") if {
principal_app == "audit"
principal_owns_resource
worker_mint
mint_role_allowed
}

# A spawned audit agent presenting its mandate at the Gateway for this view.
result := allow_result("lynx-audit-use") if {
principal_app == "audit"
principal_owns_resource
mandate_use
use_role_allowed
}
