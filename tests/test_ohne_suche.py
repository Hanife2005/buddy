import json, urllib.request
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream","--no-sandbox"])
    c = b.new_context(permissions=["microphone"])
    c.add_init_script("localStorage.setItem('buddy.debug.ws','ws://localhost:8080/ws');localStorage.setItem('buddy.debug.rest','http://localhost:8080/rest/');")
    pg = c.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("http://localhost:8080/")
    pg.fill("input[name=name]","Test"); pg.check("input[name=rolle][value=it]"); pg.fill("input[name=key]","TESTKEY-ohnesuche-abcdefghijk"); pg.check("input[name=ok]"); pg.click("button[type=submit]")
    pg.click("[data-aktion=anrufen]")
    expect(pg.locator("#status")).to_have_text("verbunden", timeout=10000)
    pg.click("[data-aktion=auflegen]")
    pg.click("text=Fertig"); pg.click("text=Einstellungen"); pg.click("[data-aktion=testen]")
    expect(pg.locator("#test-ergebnis")).to_contain_text("ohne Google-Suche", timeout=10000)
    b.close()
L = json.loads(urllib.request.urlopen("http://localhost:8080/log").read())
s = [e["setup"] for e in L if e["typ"]=="setup"]
assert "tools" in s[0] and "tools" not in s[1] and "realtimeInputConfig" in s[1], s[:2]
print("errors:", errs); print("OHNE SUCHE OK")
