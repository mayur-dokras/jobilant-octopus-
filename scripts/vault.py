"""Passcode lock for Job Hunt HQ.

All personal data lives in one encrypted file, data/vault.json
(AES-256-GCM, key derived from your passcode with PBKDF2-SHA256).
The GitHub Actions open it at the start of a run and seal it again at the end,
using the JOBHQ_PASSCODE repository secret. Plain files never get committed
(see .gitignore).

    python scripts/vault.py open    # vault.json -> data/*.json
    python scripts/vault.py seal    # data/*.json -> vault.json, plain files removed
"""
import base64
import json
import os
import sys
from pathlib import Path

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

DATA = Path(__file__).resolve().parent.parent / "data"
VAULT = DATA / "vault.json"
ITERATIONS = 250_000
# every personal file; terms.json (the public skills vocabulary) stays plain
FILES = ["jobs.json", "companies.json", "discovered.json", "profile.json",
         "ats_cache.json", "discover_cache.json"]


def _key(passcode: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERATIONS)
    return kdf.derive(passcode.encode("utf-8"))


def encrypt(obj, passcode: str) -> dict:
    salt, iv = os.urandom(16), os.urandom(12)
    ct = AESGCM(_key(passcode, salt)).encrypt(iv, json.dumps(obj, ensure_ascii=False).encode("utf-8"), None)
    b64 = lambda b: base64.b64encode(b).decode()
    return {"v": 1, "kdf": "PBKDF2-SHA256", "iter": ITERATIONS, "salt": b64(salt), "iv": b64(iv), "ct": b64(ct)}


def decrypt(box: dict, passcode: str):
    d = lambda k: base64.b64decode(box[k])
    salt, iv, ct = d("salt"), d("iv"), d("ct")
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=int(box.get("iter", ITERATIONS)))
    plain = AESGCM(kdf.derive(passcode.encode("utf-8"))).decrypt(iv, ct, None)
    return json.loads(plain.decode("utf-8"))


def passcode() -> str:
    pc = os.environ.get("JOBHQ_PASSCODE", "")
    if len(pc) < 8:
        sys.exit("JOBHQ_PASSCODE secret is missing or shorter than 8 characters. "
                 "Add it under Settings > Secrets and variables > Actions.")
    return pc


def open_vault():
    if not VAULT.exists():
        sys.exit("data/vault.json not found. Create it with Lock-your-data.html and upload it.")
    try:
        bundle = decrypt(json.loads(VAULT.read_text(encoding="utf-8")), passcode())
    except Exception:
        sys.exit("Could not open data/vault.json: the JOBHQ_PASSCODE secret does not match the passcode used to lock it.")
    for name in FILES:
        if name in bundle:
            (DATA / name).write_text(json.dumps(bundle[name], ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"vault opened: {', '.join(n for n in FILES if n in bundle)}")


def seal_vault():
    bundle = {}
    for name in FILES:
        p = DATA / name
        if p.exists():
            bundle[name] = json.loads(p.read_text(encoding="utf-8"))
    VAULT.write_text(json.dumps(encrypt(bundle, passcode())), encoding="utf-8")
    for name in FILES:
        (DATA / name).unlink(missing_ok=True)
    print(f"vault sealed: {len(bundle)} files")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    {"open": open_vault, "seal": seal_vault}.get(cmd, lambda: sys.exit("usage: vault.py open|seal"))()
