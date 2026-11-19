import json, re, sys, time, urllib.request
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:8080/"
import os
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")
os.makedirs(SHOTS, exist_ok=True)
fehler = []

def log():
    return json.loads(urllib.request.urlopen(BASE + "log").read())

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path="/usr/bin/google-chrome",
        args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--no-sandbox"],
    )
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, permissions=["microphone", "clipboard-read", "clipboard-write"], locale="de-DE")
    ctx.add_init_script("""
      localStorage.setItem('buddy.debug.ws','ws://localhost:8080/ws');
      localStorage.setItem('buddy.debug.rest','http://localhost:8080/rest/');
    """)
    page = ctx.new_page()
    page.on("pageerror", lambda e: fehler.append(f"pageerror: {e}"))
    page.on("console", lambda m: fehler.append(f"console.{m.type}: {m.text}") if m.type in ("error",) else None)
    page.on("dialog", lambda d: d.accept())

    # 1. Willkommen
    page.goto(BASE)
    expect(page.get_by_text("Willkommen bei Buddy")).to_be_visible()
    page.screenshot(path=f"{SHOTS}/01-willkommen.png", full_page=True)
    page.fill("input[name=name]", "Hanife")
    page.fill("input[name=alter]", "82")
    assert page.is_checked("input[name=tempo][value=langsam]"), "Alter 82 sollte 'langsam' vorschlagen"
    page.fill("input[name=alter]", "45")
    assert page.is_checked("input[name=tempo][value=normal]")
    page.fill("input[name=key]", "TESTKEY-abcdefghijklmnopqrstuvwxyz")
    page.check("input[name=ok]")
    page.click("button[type=submit]")
    expect(page.get_by_text("Hallo Hanife")).to_be_visible()
    page.screenshot(path=f"{SHOTS}/02-home.png", full_page=True)

    # 2. Selbst anrufen
    page.click("[data-aktion=anrufen]")
    expect(page.locator("#status")).to_have_text("verbunden", timeout=10000)
    expect(page.locator("#ut-buddy")).to_contain_text("wie war dein Tag", timeout=5000)
    expect(page.locator("#ut-du")).to_contain_text("ziemlich schlecht", timeout=8000)
    time.sleep(1.2)
    page.screenshot(path=f"{SHOTS}/03-anruf.png")
    page.click("[data-aktion=stumm]")
    expect(page.locator("#stumm-text")).to_have_text("Stumm an")
    page.click("[data-aktion=stumm]")
    page.click("[data-aktion=auflegen]")
    expect(page.get_by_text("Gespräch mit Clara beendet")).to_be_visible()
    expect(page.get_by_text("Zum Mitnehmen")).to_be_visible(timeout=8000)
    page.click("[data-aktion=bewerten][data-wert=gut]")
    page.screenshot(path=f"{SHOTS}/04-nachher.png", full_page=True)
    page.click("text=Fertig")
    expect(page.locator(".punkt.gut")).to_have_count(1)

    # 3. Gedächtnis
    page.click("text=Was sich Buddy merkt")
    expect(page.get_by_text("Hat am Freitag ein Gehaltsgespräch")).to_be_visible()
    page.fill("#f-fakt input", "Mag Philosophie")
    page.click("#f-fakt button")
    expect(page.get_by_text("Mag Philosophie")).to_be_visible()
    page.click(".zurueck")

    # 4. Verlauf
    page.click("text=Gespräche & Mitnehmen")
    expect(page.get_by_text("ein Meeting lief schlecht")).to_be_visible()
    page.screenshot(path=f"{SHOTS}/05-verlauf.png", full_page=True)
    page.click(".zurueck")

    # 5. Buddy bearbeiten + Link
    page.click("[data-aktion=bearbeiten]")
    link = page.locator("#anruf-link").inner_text()
    assert re.search(r"\?anruf=\w+$", link), link
    page.screenshot(path=f"{SHOTS}/06-buddy.png", full_page=True)
    page.click(".zurueck")

    # 6. Neuer Buddy (Sport, Französisch)
    page.click("[data-aktion=neuerBuddy]")
    page.fill("input[name=name]", "Max")
    page.select_option("select[name=rolle]", "sport")
    page.select_option("select[name=sprache]", "fr")
    page.click("button[type=submit]")
    expect(page.locator("#anruf-link")).to_be_visible()
    page.click(".zurueck")
    expect(page.locator(".buddy-karte")).to_have_count(2)

    # 7. Klingeln über Link (wie vom Wecker-Kurzbefehl)
    page.goto(link)
    expect(page.get_by_text("ruft an")).to_be_visible()
    assert "anruf=" not in page.url, "Parameter sollte aus der Adresse entfernt werden"
    page.screenshot(path=f"{SHOTS}/07-klingeln.png")
    page.click("[data-aktion=annehmen]")
    expect(page.locator("#status")).to_have_text("verbunden", timeout=10000)
    time.sleep(0.5)
    page.click("[data-aktion=auflegen]")
    expect(page.get_by_text("beendet")).to_be_visible()
    page.click("text=Fertig")

    # 8. Einstellungen: Verbindung testen, falscher Schlüssel
    page.click("text=Einstellungen")
    page.screenshot(path=f"{SHOTS}/08-einstellungen.png", full_page=True)
    page.click("[data-aktion=testen]")
    expect(page.locator("#test-ergebnis")).to_contain_text("Verbindung klappt", timeout=8000)
    page.fill("#f-schluessel input[name=key]", "FALSCHER-SCHLUESSEL-1234567890")
    page.click("#f-schluessel button[type=submit]")
    page.click("[data-aktion=testen]")
    expect(page.locator("#test-ergebnis")).to_contain_text("Schlüssel", timeout=8000)
    page.click(".zurueck")
    page.locator("[data-aktion=anrufen]").first.click()
    expect(page.get_by_text("Das hat nicht geklappt")).to_be_visible(timeout=10000)
    expect(page.locator(".dialog")).to_contain_text("lehnt den Schlüssel ab")
    page.screenshot(path=f"{SHOTS}/09-fehler.png")
    page.click("[data-aktion=dialogZu]")

    # 9. Persistenz nach Neuladen
    page.reload()
    expect(page.get_by_text("Hallo Hanife")).to_be_visible()
    expect(page.locator(".buddy-karte")).to_have_count(2)

    browser.close()

L = log()
setups = [e for e in L if e["typ"] == "setup"]
s = setups[0]["setup"]
assert s["model"] == "models/gemini-3.8-live", s["model"]
assert s["generationConfig"]["responseModalities"] == ["AUDIO"]
assert s["generationConfig"]["speechConfig"]["voiceConfig"]["prebuiltVoiceConfig"]["voiceName"] == "Kore"
st = s["systemInstruction"]["parts"][0]["text"]
assert "Hanife" in st and "TelefonSeelsorge" in st and "Clara" in st
assert s["realtimeInputConfig"]["automaticActivityDetection"]["silenceDurationMs"] == 800
erst = [e for e in L if e["typ"] == "audio-erstes"][0]
assert erst["mime"] == "audio/pcm;rate=16000" and erst["bytes"] == 3200, erst
rest = [e for e in L if e["typ"] == "rest"]
assert rest[0]["modell"] == "gemini-3.5-flash-lite" and rest[1]["modell"] == "gemini-3.1-flash-lite", [r["modell"] for r in rest]
assert "Mein Meeting lief heute ziemlich schlecht." in rest[1]["prompt"], rest[1]["prompt"][-400:]
# Zweiter Anruf (Klingeln) soll das Gedächtnis aus dem ersten enthalten
st2 = setups[1]["setup"]["systemInstruction"]["parts"][0]["text"]
assert "Gehaltsgespräch" in st2 and "Mag Philosophie" in st2 and "gut" in st2, st2[-800:]
texte = [e["text"] for e in L if e["typ"] == "text"]
assert "Du bist der Anrufer" in texte[1], texte
print("Setups:", len(setups), "| REST:", [r["modell"] for r in rest])
print("Fehler im Browser:", fehler if fehler else "keine")
ok = not [f for f in fehler if "pageerror" in f]
print("ALLES OK" if ok else "PROBLEME")
