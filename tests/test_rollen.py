import json, os, urllib.request
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots"); os.makedirs(SHOTS, exist_ok=True)
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream","--no-sandbox"])
    c = b.new_context(permissions=["microphone"], viewport={"width":390,"height":844})
    c.add_init_script("localStorage.setItem('buddy.debug.ws','ws://localhost:8080/ws');localStorage.setItem('buddy.debug.rest','http://localhost:8080/rest/');")
    pg = c.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: d.accept())
    pg.goto("http://localhost:8080/")
    pg.fill("input[name=name]","Hanife"); pg.fill("input[name=key]","TESTKEY-rollen-abcdefghijklmno"); pg.check("input[name=ok]"); pg.click("button[type=submit]")
    for rolle, name in [("marketing","Richard"),("recruiting","Ela"),("chef","Paul"),("it","Kiril")]:
        pg.click("[data-aktion=neuerBuddy]")
        assert not pg.is_visible("#rollen-text")
        pg.select_option("select[name=rolle]", rolle)
        assert pg.input_value("input[name=name]") == name, (rolle, pg.input_value("input[name=name]"))
        pg.click("button[type=submit]"); pg.click(".zurueck")
    pg.click("[data-aktion=neuerBuddy]")
    pg.select_option("select[name=rolle]", "eigene")
    expect(pg.locator("#rollen-text")).to_be_visible()
    pg.fill("input[name=name]","Gärtnerin Rosa")
    pg.fill("textarea[name=rollenText]","Eine erfahrene Gärtnerin, die beim Balkon hilft")
    pg.click("button[type=submit]"); pg.click(".zurueck")
    expect(pg.locator(".buddy-karte")).to_have_count(6)
    pg.screenshot(path=os.path.join(SHOTS, "10-rollen.png"), full_page=True)
    # Paul anrufen
    pg.locator(".buddy-karte", has_text="Paul").locator("[data-aktion=anrufen]").click()
    expect(pg.locator("#status")).to_have_text("verbunden", timeout=10000)
    pg.click("[data-aktion=auflegen]")
    pg.click("text=Fertig")
    pg.locator(".buddy-karte", has_text="Rosa").locator("[data-aktion=anrufen]").click()
    expect(pg.locator("#status")).to_have_text("verbunden", timeout=10000)
    pg.click("[data-aktion=auflegen]")
    b.close()
L = json.loads(urllib.request.urlopen("http://localhost:8080/log").read())
st = [e["setup"]["systemInstruction"]["parts"][0]["text"] for e in L if e["typ"]=="setup" and e["key"].startswith("TESTKEY-rollen")]
assert "fiktive Figur" in st[0] and "Vertraulichkeit" in st[0] and "Paul" in st[0]
assert "Gärtnerin" in st[1] and "Vertraulichkeit" not in st[1]
setups = [e["setup"] for e in L if e["typ"]=="setup" and e["key"].startswith("TESTKEY-rollen")]
assert setups[0].get("tools") == [{"googleSearch": {}}], setups[0].get("tools")
assert "tools" not in setups[1]
assert "Google-Suche nutzen" in st[0] and "Google-Suche nutzen" not in st[1]
print("Fehler:", errs); print("ROLLEN OK")
