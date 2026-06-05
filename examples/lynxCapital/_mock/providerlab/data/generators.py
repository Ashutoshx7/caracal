"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Deterministic seeded data generators that build large, related, evolving entity sets for each provider without external dependencies.
"""
from __future__ import annotations

import hashlib
import random
from datetime import date, datetime, time, timedelta, timezone

_LEGAL = ("Holdings", "Industries", "Systems", "Logistics", "Components", "Partners",
          "Networks", "Capital", "Trading", "Labs", "Group", "Solutions", "Foods",
          "Materials", "Robotics", "Analytics", "Freight", "Ventures")
_ROOTS = ("Northwind", "Contoso", "Aerolux", "Meridian", "Vertex", "Apex", "Axiom",
          "Helios", "Cobalt", "Granite", "Sequoia", "Onyx", "Cinder", "Marigold",
          "Tamarind", "Borealis", "Solstice", "Kestrel", "Driftwood", "Lattice",
          "Quill", "Saffron", "Verde", "Indigo", "Crimson", "Harbor", "Cedar")
_FIRST = ("Dana", "Priya", "Marco", "Lena", "Hassan", "Yuki", "Sofia", "Diego",
          "Amara", "Noah", "Ingrid", "Tariq", "Mei", "Lucas", "Farah", "Oskar")
_LAST = ("Whitfield", "Okafor", "Bianchi", "Novak", "Haddad", "Tanaka", "Reyes",
         "Lindqvist", "Khan", "Bauer", "Costa", "Adeyemi", "Wu", "Sorensen")
_COUNTRIES = (("US", "USD"), ("GB", "GBP"), ("DE", "EUR"), ("FR", "EUR"),
              ("BR", "BRL"), ("SG", "SGD"), ("JP", "JPY"), ("CA", "CAD"))
_TERMS = ("NET15", "NET30", "NET45", "NET60")
_EPOCH = date(2026, 1, 1)

_BANK_SUBTYPES = ("CurrentAccount", "CurrentAccount", "Savings", "Loan")
_ACCOUNT_PRODUCTS = {
    "CurrentAccount": "Halcyon Business Current",
    "Savings": "Halcyon Business Reserve",
    "Loan": "Halcyon Working Capital Facility",
}
_PURPOSES = ("Operating", "Reserve", "Payroll", "Tax", "FX Settlement", "Escrow")
_BIC_BY_COUNTRY = {
    "GB": "HLCYGB2LXXX", "DE": "HLCYDEFFXXX", "FR": "HLCYFRPPXXX",
    "US": "HLCYUS33XXX", "BR": "HLCYBRSPXXX", "SG": "HLCYSGSGXXX",
    "JP": "HLCYJPJTXXX", "CA": "HLCYCATTXXX",
}
_MERCHANT_CATEGORIES = (
    ("5734", "Computer Software Stores"), ("7372", "Computer Programming Services"),
    ("4214", "Freight Carriers and Trucking"), ("5045", "Computers and Peripherals"),
    ("7311", "Advertising Services"), ("6513", "Real Estate Agents and Rentals"),
    ("4900", "Utilities"), ("5111", "Office Supplies and Printing"),
    ("8931", "Accounting and Bookkeeping"), ("5946", "Wholesale Industrial Supplies"),
)
_BANK_TXN_CODES = (
    ("PMT", "FasterPaymentsOut"), ("DD", "DirectDebit"), ("STO", "StandingOrder"),
    ("TFR", "InternalTransfer"), ("INT", "InterestCredit"), ("FEE", "ServiceCharge"),
    ("CARD", "CardPayment"), ("WIRE", "WireTransfer"), ("SEPA", "SepaCreditTransfer"),
)


def _rng(*parts: object) -> random.Random:
    key = ":".join(str(p) for p in parts)
    digest = hashlib.sha256(key.encode()).hexdigest()
    return random.Random(int(digest[:16], 16))


def _company(rng: random.Random) -> str:
    return f"{rng.choice(_ROOTS)} {rng.choice(_LEGAL)}"


def _person(rng: random.Random) -> str:
    return f"{rng.choice(_FIRST)} {rng.choice(_LAST)}"


def _slug(name: str) -> str:
    return "".join(c for c in name.lower() if c.isalnum() or c == " ").replace(" ", "-")


def _day(rng: random.Random, lo: int, hi: int) -> str:
    return (_EPOCH + timedelta(days=rng.randint(lo, hi))).isoformat()


def _instant(rng: random.Random, lo: int, hi: int) -> str:
    """An ISO-8601 UTC timestamp offset from the epoch by a day range."""
    moment = datetime.combine(_EPOCH + timedelta(days=rng.randint(lo, hi)), time.min, timezone.utc)
    moment += timedelta(seconds=rng.randint(0, 86_399))
    return moment.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _iban(rng: random.Random, country: str, account_number: str) -> str:
    check = f"{rng.randint(2, 98):02d}"
    bank = "HLCY"
    body = "".join(rng.choice("0123456789") for _ in range(8))
    return f"{country}{check}{bank}{body}{account_number}"


def vendors(seed: str, count: int) -> list[dict]:
    """Vendor / supplier master records with country, currency, terms, and tax id."""
    out = []
    for i in range(1, count + 1):
        rng = _rng(seed, "vendor", i)
        name = _company(rng)
        country, currency = rng.choice(_COUNTRIES)
        out.append({
            "id": f"VEND-{i:05d}",
            "name": name,
            "slug": _slug(name),
            "country": country,
            "currency": currency,
            "taxId": f"{country}{rng.randint(10**8, 10**9 - 1)}",
            "paymentTerms": rng.choice(_TERMS),
            "status": "active" if rng.random() > 0.08 else "on_hold",
            "riskTier": rng.choice(("low", "low", "medium", "high")),
            "createdAt": _day(rng, -540, -30),
        })
    return out


def contacts(seed: str, count: int) -> list[dict]:
    out = []
    stages = ("lead", "qualified", "customer", "vendor", "churned")
    for i in range(1, count + 1):
        rng = _rng(seed, "contact", i)
        name = _person(rng)
        company = _company(rng)
        out.append({
            "id": f"CONT-{i:05d}",
            "name": name,
            "email": f"{name.split()[0].lower()}@{_slug(company).split('-')[0]}.example",
            "company": company,
            "stage": rng.choice(stages),
            "ownerId": f"U-{rng.randint(1, 40)}",
            "createdAt": _day(rng, -400, -1),
        })
    return out


_BANK_ACCOUNT_PLAN = (
    ("US", "USD", "CurrentAccount", "Operating"),
    ("DE", "EUR", "CurrentAccount", "Operating"),
    ("GB", "GBP", "CurrentAccount", "Operating"),
    ("SG", "SGD", "CurrentAccount", "Operating"),
    ("BR", "BRL", "CurrentAccount", "Operating"),
    ("US", "USD", "Savings", "Reserve"),
)


def bank_accounts(seed: str, count: int) -> list[dict]:
    """Open-banking business accounts with identification, servicer, and balances
    shaped after OBIE/Berlin Group account resources. The leading accounts cover
    the group's primary operating currencies; any extra accounts are randomized."""
    out = []
    for i in range(1, count + 1):
        rng = _rng(seed, "bank_account", i)
        if i <= len(_BANK_ACCOUNT_PLAN):
            country, currency, subtype, purpose = _BANK_ACCOUNT_PLAN[i - 1]
        else:
            country, currency = rng.choice(_COUNTRIES)
            subtype = rng.choice(_BANK_SUBTYPES)
            purpose = rng.choice(_PURPOSES)
        account_number = f"{rng.randint(10**7, 10**8 - 1)}"
        booked = round(rng.uniform(25_000, 4_500_000), 2)
        available = round(booked * rng.uniform(0.6, 0.99), 2)
        if subtype == "Loan":
            booked = -round(rng.uniform(50_000, 2_000_000), 2)
            available = 0.0
        identification: dict = {"name": "LynxCapital Group Ltd"}
        if country == "US":
            identification["scheme"] = "US.RoutingNumberAccountNumber"
            identification["routingNumber"] = f"{rng.randint(10**8, 10**9 - 1)}"
            identification["accountNumber"] = account_number
        elif country == "GB":
            identification["scheme"] = "UK.OBIE.SortCodeAccountNumber"
            identification["sortCode"] = f"{rng.randint(0, 99):02d}-{rng.randint(0, 99):02d}-{rng.randint(0, 99):02d}"
            identification["accountNumber"] = account_number
            identification["iban"] = _iban(rng, country, account_number)
        else:
            identification["scheme"] = "IBAN"
            identification["iban"] = _iban(rng, country, account_number)
            identification["accountNumber"] = account_number
        balances = {
            "available": available,
            "booked": booked,
            "currency": currency,
            "creditLimit": round(rng.choice((0, 50_000, 250_000)) * 1.0, 2),
            "asOf": _instant(rng, -1, 0),
        }
        planned = i <= len(_BANK_ACCOUNT_PLAN)
        status = "Enabled" if planned or rng.random() > 0.1 else "Disabled"
        out.append({
            "accountId": f"ACC-{i:04d}",
            "nickname": f"{purpose} {currency}",
            "accountType": "Business",
            "accountSubType": subtype,
            "product": _ACCOUNT_PRODUCTS[subtype],
            "status": status,
            "currency": currency,
            "country": country,
            "identification": identification,
            "servicer": {"scheme": "BICFI", "bic": _BIC_BY_COUNTRY.get(country, "HLCYGB2LXXX")},
            "openingDate": _day(rng, -1460, -200),
            "balances": balances,
        })
    return out


def accounts(seed: str, count: int) -> list[dict]:
    """Bank or ledger accounts with balances and currency."""
    out = []
    kinds = ("operating", "reserve", "payroll", "fx", "escrow")
    for i in range(1, count + 1):
        rng = _rng(seed, "account", i)
        country, currency = rng.choice(_COUNTRIES)
        out.append({
            "id": f"ACCT-{i:04d}",
            "name": f"{rng.choice(kinds).title()} {currency}",
            "kind": rng.choice(kinds),
            "currency": currency,
            "balance": round(rng.uniform(25_000, 4_500_000), 2),
            "available": 0.0,
            "status": "active",
        })
        out[-1]["available"] = round(out[-1]["balance"] * rng.uniform(0.6, 0.99), 2)
    return out


def bank_transactions(seed: str, accounts_index: dict[str, dict], count: int) -> list[dict]:
    """Open-banking transaction entries with credit/debit indicator, booking and
    value dates, merchant enrichment, and a running booked balance per account."""
    account_ids = list(accounts_index.keys())
    running = {aid: accounts_index[aid]["balances"]["booked"] for aid in account_ids}
    drafts: list[tuple[int, dict]] = []
    for i in range(1, count + 1):
        rng = _rng(seed, "bank_txn", i)
        account_id = rng.choice(account_ids)
        account = accounts_index[account_id]
        currency = account["currency"]
        indicator = "Credit" if rng.random() > 0.62 else "Debit"
        amount = round(rng.uniform(50, 250_000), 2)
        code, sub_code = rng.choice(_BANK_TXN_CODES)
        mcc, mcc_label = rng.choice(_MERCHANT_CATEGORIES)
        booking_day = rng.randint(-180, 0)
        status = "Pending" if booking_day == 0 and rng.random() < 0.5 else "Booked"
        counterparty = _company(rng)
        drafts.append((booking_day, {
            "transactionId": f"TXN-{i:06d}",
            "accountId": account_id,
            "creditDebitIndicator": indicator,
            "status": status,
            "amount": amount,
            "currency": currency,
            "bookingDateTime": _instant(rng, booking_day, booking_day),
            "valueDateTime": _instant(rng, booking_day, min(0, booking_day + 1)),
            "transactionReference": f"E2E-{rng.randint(10**9, 10**10 - 1)}",
            "bankTransactionCode": {"code": code, "subCode": sub_code},
            "proprietaryBankTransactionCode": code,
            "merchantName": counterparty,
            "merchantCategoryCode": mcc,
            "merchantCategory": mcc_label,
            "remittanceInformation": f"Invoice {rng.choice(_ROOTS)[:3].upper()}-{rng.randint(1000, 9999)}",
            "counterparty": {
                "name": counterparty,
                "accountIdentification": f"****{rng.randint(1000, 9999)}",
            },
        }))
    out = []
    for booking_day, txn in sorted(drafts, key=lambda d: d[0]):
        if txn["status"] == "Booked":
            signed = txn["amount"] if txn["creditDebitIndicator"] == "Credit" else -txn["amount"]
            running[txn["accountId"]] = round(running[txn["accountId"]] + signed, 2)
            txn["balanceAfter"] = {"amount": running[txn["accountId"]], "currency": txn["currency"]}
        out.append(txn)
    return out


def bank_statements(seed: str, accounts_index: dict[str, dict],
                    transactions: list[dict], periods: int = 3) -> list[dict]:
    """Periodic account statements summarizing booked activity per month."""
    out = []
    serial = 0
    by_account: dict[str, list[dict]] = {}
    for txn in transactions:
        by_account.setdefault(txn["accountId"], []).append(txn)
    for account_id, account in accounts_index.items():
        currency = account["currency"]
        closing = account["balances"]["booked"]
        for p in range(periods):
            serial += 1
            rng = _rng(seed, "statement", account_id, p)
            end = _EPOCH - timedelta(days=30 * p)
            start = end - timedelta(days=30)
            window = [
                t for t in by_account.get(account_id, [])
                if t["status"] == "Booked" and start.isoformat() <= t["bookingDateTime"][:10] < end.isoformat()
            ]
            credits = round(sum(t["amount"] for t in window if t["creditDebitIndicator"] == "Credit"), 2)
            debits = round(sum(t["amount"] for t in window if t["creditDebitIndicator"] == "Debit"), 2)
            opening = round(closing - credits + debits, 2)
            out.append({
                "statementId": f"STMT-{serial:05d}",
                "accountId": account_id,
                "type": "RegularPeriodic",
                "currency": currency,
                "startDateTime": f"{start.isoformat()}T00:00:00Z",
                "endDateTime": f"{end.isoformat()}T00:00:00Z",
                "creationDateTime": f"{end.isoformat()}T02:00:00Z",
                "openingBalance": opening,
                "closingBalance": closing,
                "totalCredits": credits,
                "totalDebits": debits,
                "creditCount": sum(1 for t in window if t["creditDebitIndicator"] == "Credit"),
                "debitCount": sum(1 for t in window if t["creditDebitIndicator"] == "Debit"),
                "transactionCount": len(window),
            })
            closing = opening
    return out


def invoices(seed: str, vendor_ids: list[str], count: int) -> list[dict]:
    out = []
    for i in range(1, count + 1):
        rng = _rng(seed, "invoice", i)
        currency = rng.choice(_COUNTRIES)[1]
        amount = round(rng.uniform(250, 180_000), 2)
        issued = _EPOCH + timedelta(days=rng.randint(-150, -5))
        out.append({
            "id": f"INV-{i:06d}",
            "vendorId": rng.choice(vendor_ids),
            "number": f"{rng.choice(_ROOTS)[:3].upper()}-{rng.randint(1000, 9999)}",
            "amount": amount,
            "currency": currency,
            "tax": round(amount * rng.choice((0.0, 0.07, 0.19, 0.0825)), 2),
            "issuedAt": issued.isoformat(),
            "dueAt": (issued + timedelta(days=rng.choice((15, 30, 45)))).isoformat(),
            "status": rng.choice(("open", "open", "matched", "paid", "disputed")),
        })
    return out


def users(seed: str, count: int) -> list[dict]:
    out = []
    roles = ("analyst", "controller", "treasurer", "approver", "auditor", "admin")
    for i in range(1, count + 1):
        rng = _rng(seed, "user", i)
        name = _person(rng)
        out.append({
            "id": f"U-{i}",
            "name": name,
            "email": f"{name.split()[0].lower()}.{name.split()[1].lower()}@lynxcapital.example",
            "role": rng.choice(roles),
            "active": rng.random() > 0.06,
            "groups": sorted({f"grp-{rng.choice(('finance','treasury','compliance','ap','ar'))}"
                              for _ in range(rng.randint(1, 3))}),
        })
    return out


def instruments(seed: str) -> list[dict]:
    pairs = ("USD/EUR", "USD/GBP", "USD/JPY", "USD/BRL", "USD/SGD", "EUR/GBP",
             "EUR/JPY", "GBP/JPY", "USD/CAD", "EUR/CHF")
    out = []
    for sym in pairs:
        rng = _rng(seed, "instrument", sym)
        out.append({
            "symbol": sym,
            "mid": round(rng.uniform(0.6, 160.0), 4),
            "spreadBps": rng.randint(2, 18),
            "venue": rng.choice(("LDN", "NYC", "SGP", "TKY")),
        })
    return out


def recipients(seed: str, count: int) -> list[dict]:
    out = []
    methods = ("bank", "wallet", "card")
    for i in range(1, count + 1):
        rng = _rng(seed, "recipient", i)
        country, currency = rng.choice(_COUNTRIES)
        out.append({
            "id": f"RCPT-{i:05d}",
            "name": _company(rng) if rng.random() > 0.4 else _person(rng),
            "country": country,
            "currency": currency,
            "method": rng.choice(methods),
            "verified": rng.random() > 0.15,
        })
    return out


_MERIDIAN_EPOCH = int(datetime(2026, 1, 1, tzinfo=timezone.utc).timestamp())

# (brand, last4, funding, network) — shaped after the canonical test cards real
# card platforms publish so the wire surface looks like a live acceptance gateway.
_CARDS = (
    ("visa", "4242", "credit", "Visa"),
    ("visa", "4000", "debit", "Visa"),
    ("mastercard", "5555", "credit", "Mastercard"),
    ("mastercard", "2223", "debit", "Mastercard"),
    ("amex", "0005", "credit", "American Express"),
    ("discover", "1117", "credit", "Discover"),
)
_WALLETS = ("apple_pay", "google_pay", "link")
_DISPUTE_REASONS = ("fraudulent", "duplicate", "product_not_received",
                    "subscription_canceled", "credit_not_processed", "general")
_DISPUTE_NETWORK_CODE = {
    "fraudulent": "10.4", "duplicate": "12.6.1", "product_not_received": "13.1",
    "subscription_canceled": "13.2", "credit_not_processed": "13.6", "general": "13.7",
}
_REFUND_REASONS = ("requested_by_customer", "duplicate", "fraudulent")
_RISK_LEVELS = ("normal", "normal", "normal", "elevated", "highest")
_CHARGE_EVENT_TYPE = {
    "succeeded": "charge.succeeded",
    "failed": "charge.failed",
    "requires_capture": "charge.updated",
}


def _meridian_ts(rng: random.Random, lo_days: int, hi_days: int) -> int:
    """A unix timestamp offset back from the Meridian epoch by a day range."""
    return _MERIDIAN_EPOCH - rng.randint(lo_days, hi_days) * 86_400 - rng.randint(0, 86_399)


def _processing_fee(amount: float, currency: str) -> float:
    """Blended acceptance fee: 2.9% + a fixed minor-unit component, as US card
    platforms charge. Non-USD settlement adds a one-percent cross-border uplift."""
    rate = 0.029 if currency == "USD" else 0.039
    fixed = 0.30 if currency == "USD" else 0.25
    return round(amount * rate + fixed, 2)


def _card_payment_method(rng: random.Random) -> dict:
    brand, last4, funding, network = rng.choice(_CARDS)
    country, _ = rng.choice(_COUNTRIES)
    wallet = rng.choice(_WALLETS) if rng.random() < 0.25 else None
    return {
        "type": "card",
        "card": {
            "brand": brand,
            "last4": last4,
            "expMonth": rng.randint(1, 12),
            "expYear": 2027 + rng.randint(0, 4),
            "funding": funding,
            "network": network,
            "country": country,
            "fingerprint": f"fp_{_rng('fp', brand, last4, rng.random()).getrandbits(48):012x}",
            "threeDSecure": "authenticated" if rng.random() < 0.4 else "not_required",
            "wallet": wallet,
            "checks": {
                "cvcCheck": "pass",
                "addressLine1Check": rng.choice(("pass", "pass", "unchecked")),
                "addressPostalCodeCheck": rng.choice(("pass", "pass", "fail")),
            },
        },
    }


def _outcome(rng: random.Random, risk: str) -> dict:
    score = {"normal": rng.randint(2, 40), "elevated": rng.randint(60, 74),
             "highest": rng.randint(75, 95)}[risk]
    return {
        "networkStatus": "approved_by_network",
        "reason": None,
        "riskLevel": risk,
        "riskScore": score,
        "sellerMessage": "Payment complete.",
        "type": "authorized",
    }


def _new_charge(rng: random.Random, idx: int, currency: str, created: int) -> dict:
    amount = round(rng.uniform(18, 9800), 2)
    pm = _card_payment_method(rng)
    risk = rng.choice(_RISK_LEVELS)
    fee = _processing_fee(amount, currency)
    charge_id = f"ch_{rng.getrandbits(60):015x}"
    name = _person(rng)
    customer_no = rng.randint(10000, 99999)
    return {
        "id": charge_id,
        "chargeId": charge_id,
        "object": "charge",
        "amount": amount,
        "amountCaptured": amount,
        "amountRefunded": 0.0,
        "currency": currency,
        "status": "succeeded",
        "captured": True,
        "paid": True,
        "refunded": False,
        "disputed": False,
        "description": f"LynxCapital receivable {created}",
        "statementDescriptor": "MERIDIAN* LYNXCAPITAL",
        "source": f"tok_{pm['card']['brand']}",
        "paymentMethod": f"pm_{rng.getrandbits(56):014x}",
        "paymentMethodDetails": pm,
        "billingDetails": {
            "name": name,
            "email": f"{name.split()[0].lower()}.{name.split()[1].lower()}@payer.example",
            "phone": None,
            "address": {"country": pm["card"]["country"], "postalCode": f"{rng.randint(10000, 99999)}"},
        },
        "outcome": _outcome(rng, risk),
        "processingFee": fee,
        "net": round(amount - fee, 2),
        "balanceTransaction": f"txn_{rng.getrandbits(56):014x}",
        "receiptUrl": f"https://pay.meridianpay.test/receipts/{charge_id}",
        "customer": f"cus_{customer_no:08x}",
        "metadata": {"invoiceId": f"INV-{idx:05d}", "region": pm["card"]["country"]},
        "settlementId": None,
        "payoutId": None,
        "created": created,
        "livemode": False,
    }


def _new_refund(rng: random.Random, charge: dict, amount: float, created: int) -> dict:
    refund_id = f"re_{rng.getrandbits(60):015x}"
    return {
        "id": refund_id,
        "refundId": refund_id,
        "object": "refund",
        "amount": amount,
        "currency": charge["currency"],
        "chargeId": charge["chargeId"],
        "status": "succeeded",
        "reason": rng.choice(_REFUND_REASONS),
        "receiptNumber": f"{rng.randint(1000, 9999)}-{rng.randint(1000, 9999)}",
        "balanceTransaction": f"txn_{rng.getrandbits(56):014x}",
        "created": created,
        "metadata": {},
    }


def _new_dispute(rng: random.Random, charge: dict, created: int) -> dict:
    reason = rng.choice(_DISPUTE_REASONS)
    status = rng.choice(("warning_needs_response", "needs_response", "needs_response",
                         "under_review", "won", "lost"))
    has_evidence = status in ("under_review", "won", "lost")
    dispute_id = f"dp_{rng.getrandbits(60):015x}"
    return {
        "id": dispute_id,
        "disputeId": dispute_id,
        "object": "dispute",
        "amount": charge["amount"],
        "currency": charge["currency"],
        "chargeId": charge["chargeId"],
        "reason": reason,
        "status": status,
        "networkReasonCode": _DISPUTE_NETWORK_CODE[reason],
        "isChargeRefundable": status in ("warning_needs_response", "needs_response"),
        "evidenceDueBy": created + 21 * 86_400,
        "evidenceDetails": {
            "dueBy": created + 21 * 86_400,
            "hasEvidence": has_evidence,
            "submissionCount": 1 if has_evidence else 0,
            "pastDue": False,
        },
        "evidence": {},
        "balanceTransactions": [{
            "id": f"txn_{rng.getrandbits(56):014x}",
            "amount": -charge["amount"],
            "fee": 15.00,
            "type": "adjustment",
        }],
        "created": created,
        "metadata": {},
    }


def _event(rng: random.Random, kind: str, obj: dict, created: int) -> dict:
    return {
        "id": f"evt_{rng.getrandbits(60):015x}",
        "object": "event",
        "type": kind,
        "apiVersion": "2026-01-15",
        "created": created,
        "livemode": False,
        "pendingWebhooks": 0,
        "request": {"id": f"req_{rng.getrandbits(48):012x}", "idempotencyKey": None},
        "data": {"object": obj},
    }


def meridian_dataset(seed: str) -> dict[str, dict]:
    """Build a coherent payment-acceptance dataset: charges that settle into
    payouts via settlement batches, with refunds, disputes, and the event stream
    a real platform would have emitted as webhooks."""
    charges: dict[str, dict] = {}
    refunds: dict[str, dict] = {}
    disputes: dict[str, dict] = {}
    payouts: dict[str, dict] = {}
    settlements: dict[str, dict] = {}
    events: dict[str, dict] = {}

    for i in range(1, 71):
        rng = _rng(seed, "charge", i)
        currency = "USD" if rng.random() < 0.82 else rng.choice(("EUR", "GBP"))
        created = _meridian_ts(rng, 1, 75)
        charge = _new_charge(rng, i, currency, created)

        roll = rng.random()
        if roll < 0.07:
            charge.update(status="failed", captured=False, paid=False,
                          amountCaptured=0.0, net=0.0, processingFee=0.0,
                          balanceTransaction=None)
            charge["outcome"].update(networkStatus="declined_by_network", type="issuer_declined",
                                     reason="card_declined", sellerMessage="The bank declined this charge.")
            charge["source"] = "tok_chargeDeclined"
        elif roll < 0.10:
            charge.update(status="requires_capture", captured=False, paid=False,
                          amountCaptured=0.0)
            charge["outcome"]["type"] = "manual"
        events[charge["id"]] = _event(
            rng, _CHARGE_EVENT_TYPE.get(charge["status"], "charge.updated"),
            charge, created)
        charges[charge["chargeId"]] = charge

    succeeded = [c for c in charges.values() if c["status"] == "succeeded"]

    refundable = [c for c in succeeded if _rng(seed, "refund_pick", c["chargeId"]).random() < 0.18]
    for c in refundable:
        rng = _rng(seed, "refund", c["chargeId"])
        full = rng.random() < 0.6
        amount = c["amount"] if full else round(c["amount"] * rng.uniform(0.2, 0.7), 2)
        created = c["created"] + rng.randint(1, 10) * 86_400
        refund = _new_refund(rng, c, amount, created)
        refunds[refund["refundId"]] = refund
        c["amountRefunded"] = amount
        c["refunded"] = full
        c["status"] = "refunded" if full else "succeeded"
        events[refund["refundId"]] = _event(rng, "charge.refunded", refund, created)

    disputed = [c for c in succeeded if _rng(seed, "dispute_pick", c["chargeId"]).random() < 0.12][:8]
    for c in disputed:
        rng = _rng(seed, "dispute", c["chargeId"])
        created = c["created"] + rng.randint(2, 20) * 86_400
        dispute = _new_dispute(rng, c, created)
        disputes[dispute["disputeId"]] = dispute
        c["disputed"] = True
        events[dispute["disputeId"]] = _event(rng, "charge.dispute.created", dispute, created)

    usd_settled = sorted((c for c in succeeded if c["currency"] == "USD"),
                         key=lambda c: c["created"])
    batch_size = max(1, len(usd_settled) // 6)
    for b in range(0, len(usd_settled), batch_size):
        batch = usd_settled[b:b + batch_size]
        if not batch:
            continue
        idx = b // batch_size + 1
        rng = _rng(seed, "settlement", idx)
        gross = round(sum(c["amount"] for c in batch), 2)
        fee = round(sum(c["processingFee"] for c in batch), 2)
        refund_total = round(sum(c["amountRefunded"] for c in batch), 2)
        net = round(gross - fee - refund_total, 2)
        period_end = max(c["created"] for c in batch) + 2 * 86_400
        status = "paid" if idx <= 4 else rng.choice(("paid", "in_transit", "in_transit"))
        payout_id = f"po_{rng.getrandbits(60):015x}"
        settlement_id = f"st_{rng.getrandbits(56):014x}"
        arrival = period_end + 2 * 86_400
        method = "instant" if rng.random() < 0.2 else "standard"
        failure = None
        if idx == 6 and status != "paid":
            status = "failed"
            failure = "account_closed"
        payout = {
            "id": payout_id,
            "payoutId": payout_id,
            "object": "payout",
            "amount": net,
            "currency": "USD",
            "status": status,
            "type": "bank_account",
            "method": method,
            "destination": f"ba_{rng.getrandbits(48):012x}",
            "statementDescriptor": "MERIDIAN PAYOUT",
            "sourceType": "card",
            "automatic": True,
            "arrivalDate": arrival,
            "settlementId": settlement_id,
            "failureCode": failure,
            "failureMessage": "The bank account has been closed." if failure else None,
            "created": period_end,
            "metadata": {},
        }
        payouts[payout_id] = payout
        settlements[settlement_id] = {
            "id": settlement_id,
            "settlementId": settlement_id,
            "object": "settlement",
            "status": status,
            "currency": "USD",
            "grossAmount": gross,
            "feeAmount": fee,
            "refundAmount": refund_total,
            "netAmount": net,
            "chargeCount": len(batch),
            "refundCount": sum(1 for c in batch if c["amountRefunded"] > 0),
            "payoutId": payout_id,
            "periodStart": min(c["created"] for c in batch),
            "periodEnd": period_end,
            "reportUrl": f"https://pay.meridianpay.test/settlements/{settlement_id}/report.csv",
            "created": period_end,
        }
        for c in batch:
            c["settlementId"] = settlement_id
            c["payoutId"] = payout_id
        if status == "paid":
            events[payout_id] = _event(rng, "payout.paid", payout, arrival)
        elif status == "failed":
            events[payout_id] = _event(rng, "payout.failed", payout, arrival)

    return {
        "charges": charges,
        "refunds": refunds,
        "disputes": disputes,
        "payouts": payouts,
        "settlements": settlements,
        "events": events,
    }


def index_by(records: list[dict], key: str = "id") -> dict[str, dict]:
    return {r[key]: r for r in records}
