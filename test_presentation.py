from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(viewport={"width": 1280, "height": 800})
    page = context.new_page()

    page.goto("http://localhost:5176")
    time.sleep(2)
    page.screenshot(path="/Users/aleksanderobuchowski/MarpEditorKimi/screenshot-1-editor.png")
    print("Screenshot 1: Editor view")

    # Click Present button
    present_btn = page.locator('button[title="Start presentation (F5)"]')
    if present_btn.count() > 0:
        present_btn.click()
        time.sleep(1)
        page.screenshot(path="/Users/aleksanderobuchowski/MarpEditorKimi/screenshot-2-presentation.png")
        print("Screenshot 2: Presentation mode")

        # Press right arrow
        page.keyboard.press("ArrowRight")
        time.sleep(0.5)
        page.screenshot(path="/Users/aleksanderobuchowski/MarpEditorKimi/screenshot-3-next-slide.png")
        print("Screenshot 3: Next slide")

        # Press Escape
        page.keyboard.press("Escape")
        time.sleep(0.5)
        page.screenshot(path="/Users/aleksanderobuchowski/MarpEditorKimi/screenshot-4-back.png")
        print("Screenshot 4: Back to editor")
    else:
        print("Present button not found")

    browser.close()
