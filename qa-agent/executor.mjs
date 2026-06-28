// Executes a Computer Use function_call against a Playwright page.
// IMPORTANT: coordinates are NORMALIZED 0-1000 (validated empirically in spike/loop-check.mjs).

const SETTLE_MS = 400;

export async function executeAction(page, fc, viewport) {
  const a = fc.arguments || {};
  const toPx = (x, y) => ({
    x: Math.round((x / 1000) * viewport.width),
    y: Math.round((y / 1000) * viewport.height),
  });

  try {
    switch (fc.name) {
      case "click":
      case "left_click": {
        const { x, y } = toPx(a.x, a.y);
        await page.mouse.click(x, y);
        break;
      }
      case "double_click": {
        const { x, y } = toPx(a.x, a.y);
        await page.mouse.dblclick(x, y);
        break;
      }
      case "right_click": {
        const { x, y } = toPx(a.x, a.y);
        await page.mouse.click(x, y, { button: "right" });
        break;
      }
      case "hover":
      case "move":
      case "mouse_move": {
        const { x, y } = toPx(a.x, a.y);
        await page.mouse.move(x, y);
        break;
      }
      case "type":
      case "type_text": {
        if (a.x != null && a.y != null) {
          const { x, y } = toPx(a.x, a.y);
          await page.mouse.click(x, y);
        }
        if (a.text) await page.keyboard.type(String(a.text));
        break;
      }
      case "key":
      case "keypress":
      case "press_key":
      case "hotkey": {
        const raw = a.keys ?? a.key ?? a.text ?? "";
        const combo = (Array.isArray(raw) ? raw.join("+") : String(raw)).trim().replaceAll(" ", "+");
        if (combo) await page.keyboard.press(combo);
        break;
      }
      case "scroll": {
        const amount = a.amount ?? 600;
        const dir = a.direction || "down";
        const dy = dir === "up" ? -amount : dir === "down" ? amount : 0;
        const dx = dir === "left" ? -amount : dir === "right" ? amount : 0;
        await page.mouse.wheel(dx, dy);
        break;
      }
      case "navigate":
      case "goto":
      case "open_url": {
        if (a.url) await page.goto(String(a.url), { waitUntil: "load" });
        break;
      }
      case "go_back":
        await page.goBack();
        break;
      case "go_forward":
        await page.goForward();
        break;
      case "wait": {
        const ms = a.ms ?? (a.seconds ? a.seconds * 1000 : 800);
        await page.waitForTimeout(Math.min(ms, 4000));
        break;
      }
      case "take_screenshot":
        break; // the loop screenshots after every step anyway
      default:
        return { ok: false, note: `unhandled action '${fc.name}'`, raw: a };
    }
    await page.waitForTimeout(SETTLE_MS); // let navigations / animations settle
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}
