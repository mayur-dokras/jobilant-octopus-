/* Opens and seals data/vault.json in the browser (Web Crypto).
   Same format as scripts/vault.py: PBKDF2-SHA256 -> AES-256-GCM. */
window.Vault = (function () {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function key(pass, salt, iter, usage) {
    const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, base, { name: "AES-GCM", length: 256 }, false, [usage]);
  }
  async function open(box, pass) {
    const k = await key(pass, unb64(box.salt), box.iter || 250000, "decrypt");
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, k, unb64(box.ct));
    return JSON.parse(dec.decode(plain));
  }
  async function seal(obj, pass, iter = 250000) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const k = await key(pass, salt, iter, "encrypt");
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, enc.encode(JSON.stringify(obj)));
    return { v: 1, kdf: "PBKDF2-SHA256", iter, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
  }
  return { open, seal };
})();
