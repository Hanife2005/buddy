import json, time, urllib.request
from playwright.sync_api import sync_playwright, expect
def lauf(key, warte_auf_text, max_s):
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream","--no-sandbox"])
        c = b.new_context(permissions=["microphone"])
        c.add_init_script("localStorage.setItem('buddy.debug.ws','ws://localhost:8080/ws');localStorage.setItem('buddy.debug.rest','http://localhost:8080/rest/');")
        pg = c.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://localhost:8080/")
        pg.fill("input[name=name]","Hanife"); pg.fill("input[name=key]",key); pg.check("input[name=ok]"); pg.click("button[type=submit]")
        pg.click("[data-aktion=anrufen]")
        expect(pg.locator("#status")).to_have_text("verbunden", timeout=10000)
        t0=time.time()
        while time.time()-t0 < max_s:
            L = json.loads(urllib.request.urlopen("http://localhost:8080/log").read())
            setups=[e for e in L if e["typ"]=="setup" and e["key"]==key]
            if len(setups)>=2: break
            time.sleep(0.5)
        expect(pg.locator("#status")).to_have_text("verbunden", timeout=10000)
        zeit_vorher = pg.locator("#zeit").inner_text()
        time.sleep(1)
        pg.click("[data-aktion=auflegen]")
        expect(pg.get_by_text("beendet")).to_be_visible()
        proto = pg.locator(".protokoll pre").first.text_content()
        b.close()
    s2 = setups[1]["setup"]["systemInstruction"]["parts"][0]["text"]
    assert "Bisheriger Verlauf" in s2, s2[-500:]
    assert warte_auf_text in s2, s2[-500:]
    L = json.loads(urllib.request.urlopen("http://localhost:8080/log").read())
    texte=[e["text"] for e in L if e["typ"]=="text"]
    assert any("Leitung war kurz unterbrochen" in t for t in texte)
    print(key[:16], "| Uhr lief weiter:", zeit_vorher, "| Fehler:", errs)
    print(proto); print("---")
lauf("TESTKEY-abbruch-abcdefghijklmnop", "ziemlich schlecht", 15)
lauf("TESTKEY-stumm-abcdefghijklmnopqr", "hörst du mich", 25)
print("ROBUST OK")
