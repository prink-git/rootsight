"""
Synthetic support ticket dataset generator.

NOTE: Kaggle is not reachable from this build environment, so this generates
data matching the standard schema used by widely-known public customer-support
ticket datasets (ticket_id, subject, body, category, priority, channel,
created_at, resolved_at, resolution_notes, csat_score). The content is
synthetic but is deliberately seeded with a fixed set of recurring root
causes (~8-10) so the clustering engine has real signal to find, the same
way a real six-month support backlog would.
"""
import csv
import random
import uuid
from datetime import datetime, timedelta

random.seed(42)

# Each root cause = a family of tickets that all stem from ONE underlying
# product/process problem, phrased many different ways by different customers.
ROOT_CAUSES = [
    {
        "id": "rc_password_reset_loop",
        "category": "Account Access",
        "templates": [
            "Password reset email never arrives, tried {n} times",
            "Reset link says expired immediately after I click it",
            "Can't log in, reset password page just spins forever",
            "Requested a new password {n} times, nothing in my inbox",
            "Reset link takes me to an error page",
            "Locked out of my account, reset flow is broken",
        ],
        "body_extra": "This has happened every time I try to reset, not just once. Checked spam folder, nothing there.",
        "fix": "Root cause: reset-email queue silently drops messages when the account has 2FA enabled. Fix: patch the reset-email trigger to bypass the 2FA gate, and add a fallback SMS option.",
        "weight": 22,
    },
    {
        "id": "rc_checkout_promo_fail",
        "category": "Billing",
        "templates": [
            "Promo code {code} says invalid but it's active on your site",
            "Discount code not applying at checkout",
            "Coupon {code} worked yesterday, now it says expired",
            "Applied {code} and got charged full price anyway",
            "Checkout won't accept any promo code I try",
        ],
        "body_extra": "I double checked the code is correct, copy-pasted it directly from your email.",
        "fix": "Root cause: promo validation service has a timezone mismatch causing codes to expire ~5 hours early. Fix: normalize promo expiry checks to UTC.",
        "weight": 18,
    },
    {
        "id": "rc_mobile_upload_crash",
        "category": "Technical / Bug",
        "templates": [
            "App crashes every time I try to upload a photo",
            "Mobile app closes itself when I attach a file",
            "Upload gets stuck at {n}% then app force closes",
            "Can't attach images on the iOS app, it just crashes",
            "Photo upload freezes and then app quits",
        ],
        "body_extra": "Happens on every attempt, only on mobile, works fine on the website.",
        "fix": "Root cause: iOS build fails to compress images >8MB before upload, causing an out-of-memory crash. Fix: add client-side image compression before upload on iOS.",
        "weight": 20,
    },
    {
        "id": "rc_invoice_confusion",
        "category": "Billing",
        "templates": [
            "Why was I charged twice this month?",
            "My invoice shows a charge I don't recognize",
            "Billed for a plan I already cancelled",
            "Charged for {n} seats but we only have {n2} users",
            "Invoice total doesn't match what the pricing page says",
        ],
        "body_extra": "Can you explain this line item, it doesn't match what we agreed on the call.",
        "fix": "Root cause: plan-downgrade events aren't syncing to the billing engine until the next cycle, so users get charged at the old tier. Fix: trigger immediate re-sync to billing on any plan change.",
        "weight": 19,
    },
    {
        "id": "rc_export_missing_data",
        "category": "Technical / Bug",
        "templates": [
            "CSV export is missing half my records",
            "Exported report doesn't match what I see in the dashboard",
            "Export only includes data from the last 7 days, I need 90",
            "Downloaded export file is empty",
            "Export button spins forever and never downloads anything",
        ],
        "body_extra": "This is blocking our monthly reporting, need this fixed urgently.",
        "fix": "Root cause: export job silently times out on date ranges >30 days without surfacing an error. Fix: chunk large exports server-side and show progress instead of a single blocking job.",
        "weight": 14,
    },
    {
        "id": "rc_notification_spam",
        "category": "Product Feedback",
        "templates": [
            "Getting way too many notification emails, please stop",
            "How do I turn off notifications, settings page doesn't save",
            "I unsubscribed but still getting emails every day",
            "Notification settings reset themselves every login",
            "Too many emails, I already turned these off once",
        ],
        "body_extra": "I've tried unsubscribing multiple times through the link in the email itself.",
        "fix": "Root cause: notification preferences are stored per-session instead of per-account, so they silently reset. Fix: move preference storage to the account record, not session cache.",
        "weight": 12,
    },
    {
        "id": "rc_onboarding_confusion",
        "category": "Onboarding",
        "templates": [
            "Not sure how to set up my first project, no guidance",
            "Onboarding checklist is stuck at step 2 for no reason",
            "Where do I invite my team, can't find the option",
            "Setup wizard closed itself before I finished",
            "Confused about what to do after signing up",
        ],
        "body_extra": "Would help to have a clearer walkthrough, I almost gave up.",
        "fix": "Root cause: onboarding checklist state isn't persisted correctly if the user navigates away before completing a step. Fix: persist step completion server-side and add inline tooltips.",
        "weight": 10,
    },
    {
        "id": "rc_api_rate_limit_unclear",
        "category": "Technical / Bug",
        "templates": [
            "Getting 429 errors with no explanation of why",
            "API suddenly stopped working, no error message that makes sense",
            "Rate limit hit but docs don't say what the actual limit is",
            "Integration broke overnight, API returns errors now",
            "API key seems valid but every request fails",
        ],
        "body_extra": "This broke our production integration with no warning.",
        "fix": "Root cause: rate limits were silently lowered for free-tier keys without updating docs or adding a warning header. Fix: return remaining-quota headers on every response and update docs.",
        "weight": 11,
    },
]

CUSTOMER_NAMES = ["Alex","Jordan","Sam","Taylor","Morgan","Casey","Riley","Jamie","Drew","Cameron",
                   "Priya","Wei","Fatima","Lucas","Elena","Noah","Ines","Omar","Grace","Diego"]

CHANNELS = ["email", "chat", "web_form", "phone"]
PRIORITIES = ["low", "medium", "high", "urgent"]

def rand_code():
    return random.choice(["SAVE10","WELCOME20","SPRING25","LOYAL15","FLASH30"])

def fill(template):
    return template.format(
        n=random.randint(2,6),
        n2=random.randint(1,2),
        code=rand_code(),
    )

def gen_tickets(total=260, out_path="data/tickets.csv"):
    rows = []
    weights = [rc["weight"] for rc in ROOT_CAUSES]
    start_date = datetime(2026, 4, 1)

    # Also sprinkle some genuinely unique one-off tickets (noise) so clustering
    # has to actually separate signal from noise, like a real backlog.
    noise_subjects = [
        "Question about enterprise pricing tiers",
        "Feature request: dark mode for reports",
        "Can I get a demo for my team",
        "Is there a Zapier integration",
        "Feedback on the new dashboard layout",
        "Request to change account email address",
        "Asking about data residency for EU customers",
        "Wondering if there's a student discount",
    ]

    n_noise = max(8, int(total * 0.08))
    n_clustered = total - n_noise

    counts = random.choices(ROOT_CAUSES, weights=weights, k=n_clustered)
    for rc in counts:
        name = random.choice(CUSTOMER_NAMES)
        subj = fill(random.choice(rc["templates"]))
        body = f"{subj}. {rc['body_extra']}"
        created = start_date + timedelta(
            days=random.randint(0, 89),
            hours=random.randint(0,23),
            minutes=random.randint(0,59),
        )
        resolved = created + timedelta(hours=random.randint(1, 72))
        rows.append({
            "ticket_id": str(uuid.uuid4())[:8],
            "customer_name": name,
            "subject": subj,
            "body": body,
            "category": rc["category"],
            "priority": random.choice(PRIORITIES),
            "channel": random.choice(CHANNELS),
            "created_at": created.isoformat(),
            "resolved_at": resolved.isoformat(),
            "resolution_notes": "Resolved after troubleshooting with customer; workaround provided, underlying issue not yet fixed in product.",
            "csat_score": random.choice([1,2,2,3,3,4]),  # skewed low since these are recurring pain
            "_true_root_cause": rc["id"],  # hidden ground truth, for our own eval only
        })

    for i in range(n_noise):
        subj = random.choice(noise_subjects)
        created = start_date + timedelta(days=random.randint(0, 89), hours=random.randint(0,23))
        resolved = created + timedelta(hours=random.randint(1, 48))
        rows.append({
            "ticket_id": str(uuid.uuid4())[:8],
            "customer_name": random.choice(CUSTOMER_NAMES),
            "subject": subj,
            "body": subj + ". Just curious, not urgent.",
            "category": "General Inquiry",
            "priority": "low",
            "channel": random.choice(CHANNELS),
            "created_at": created.isoformat(),
            "resolved_at": resolved.isoformat(),
            "resolution_notes": "Answered directly, no follow-up needed.",
            "csat_score": random.choice([4,5,5]),
            "_true_root_cause": "none",
        })

    random.shuffle(rows)
    fieldnames = list(rows[0].keys())
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} tickets to {out_path} ({n_clustered} clustered, {n_noise} noise)")

if __name__ == "__main__":
    gen_tickets()
