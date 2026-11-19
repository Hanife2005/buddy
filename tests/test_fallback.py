import json, urllib.request
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream","--no-sandbox"])
    c = b.new_context(permissions=["microphone"])
    c.add_init_script("localStorage.setItem('buddy.debug.ws','ws://localhost:8080/ws');localStorage.setItem('buddy.debug.rest','http://localhost:8080/rest/');")
    pg = c.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("http://localhost:8080/")
    pg.fill("input[name=name]","Test"); pg.fill("input[name=key]","TESTKEY-abcdefghijklmnopqrstuvwxyz"); pg.check("input[name=ok]"); pg.click("button[type=submit]")
    pg.click("[data-aktion=anrufen]")
    expect(pg.locator("#status")).to_have_text("verbunden", timeout=10000)
    pg.click("[data-aktion=auflegen]")
    b.close()
L = json.loads(urllib.request.urlopen("http://localhost:8080/log").read())
s = [e["setup"] for e in L if e["typ"]=="setup"]
print(len(s), ["realtimeInputConfig" in x for x in s], "errors:", errs)
assert len(s)==2 and "realtimeInputConfig" in s[0] and "realtimeInputConfig" not in s[1]
print("FALLBACK OK")
