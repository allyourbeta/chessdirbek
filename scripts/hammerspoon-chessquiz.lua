-- chessquiz quick-capture
-- ============================================================================
-- Copy a board image anywhere (PDF, course, screenshot), press the hotkey,
-- pick a category from the popup, and it OCRs + saves into chessquiz in the
-- background. Focus returns to wherever you were. The app never opens.
--
-- INSTALL
--   1. Install Hammerspoon:  brew install --cask hammerspoon   (or hammerspoon.org)
--   2. Open Hammerspoon once; grant Accessibility when prompted
--      (System Settings -> Privacy & Security -> Accessibility -> enable Hammerspoon).
--   3. Put this file's contents in  ~/.hammerspoon/init.lua
--      (or keep it here and add  dofile("/full/path/to/hammerspoon-chessquiz.lua")
--       to your init.lua), then click Hammerspoon menu -> Reload Config.
--
-- USE
--   Copy a chess board image -> double-tap LEFT Command (⌘⌘) -> pick a category.
-- ============================================================================

local IMPORT_URL = "http://localhost:8000/api/ocr/import"

local CATEGORIES = {
  { text = "Tactic",   subText = "Save to Tactics",  category = "tactic" },
  { text = "Tabiya",   subText = "Save to Tabiya",   category = "tabiya" },
  { text = "Ending",   subText = "Save to Endings",  category = "ending" },
  { text = "Strategy", subText = "Save to Strategy", category = "strategy" },
}

local function notify(title, text)
  hs.notify.new({ title = title, informativeText = text, withdrawAfter = 4 }):send()
end

local function importImage(img, category)
  -- encodeAsURLString returns "data:image/png;base64,..."; backend strips the prefix.
  local body = hs.json.encode({ image_base64 = img:encodeAsURLString(), category = category })
  notify("chessquiz", "Recognizing board…")
  hs.http.asyncPost(IMPORT_URL, body, { ["Content-Type"] = "application/json" },
    function(status, respBody)
      if status == 200 or status == 201 then
        local ok, data = pcall(hs.json.decode, respBody)
        local title = (ok and data and data.title) or "position"
        notify("chessquiz \226\156\147", "Saved to " .. category .. ": " .. title)
      elseif status == 409 then
        notify("chessquiz", "Already saved (duplicate position)")
      elseif status == 503 then
        notify("chessquiz \226\156\151", "OCR not ready - check the app's OCR debug panel")
      else
        notify("chessquiz \226\156\151", "Error " .. tostring(status) .. ": " .. tostring(respBody):sub(1, 120))
      end
    end)
end

local function capture()
  local img = hs.pasteboard.readImage()
  if not img then
    notify("chessquiz", "No image on the clipboard - copy a board first")
    return
  end
  local chooser = hs.chooser.new(function(choice)
    if choice then importImage(img, choice.category) end
  end)
  chooser:choices(CATEGORIES)
  chooser:rows(#CATEGORIES)
  chooser:placeholderText("Save this board to…")
  chooser:show()
end

-- ============================================================================
-- TRIGGER: double-tap LEFT Command (⌘⌘), matching your option-option /
-- quote-quote muscle memory. Left ⌘ only (keyCode 55); right ⌘ is left alone.
-- If a clean double-tap misfires during fast ⌘-shortcut bursts, lower the gap;
-- if a deliberate double-tap is hard to land, raise it.
-- ============================================================================
local DOUBLE_TAP_GAP = 0.4  -- seconds (try 0.3 if it misfires, 0.5 if it misses)
local lastCmdTap = 0

local cmdWatcher = hs.eventtap.new({ hs.eventtap.event.types.flagsChanged }, function(e)
  local f = e:getFlags()
  if e:getKeyCode() == 55 and f.cmd and not (f.shift or f.alt or f.ctrl or f.fn) then
    local now = hs.timer.secondsSinceEpoch()
    if (now - lastCmdTap) < DOUBLE_TAP_GAP then
      lastCmdTap = 0
      capture()
    else
      lastCmdTap = now
    end
  end
  return false  -- never swallow the key; normal ⌘ keeps working everywhere
end)
cmdWatcher:start()

notify("chessquiz", "Quick-capture ready (double-tap left \226\140\152)")
