# Chessdirbek Bookmarklet

## What it does
When you're viewing a position on **Lichess** or **Chess.com**, click the bookmarklet 
and it opens Chessdirbek with that position pre-loaded, ready to save.

## Setup

1. Create a new bookmark in your browser (Cmd+D or right-click bookmarks bar → "Add Page")
2. Name it: **→ Chessdirbek**  
3. Replace the URL with this entire line (copy everything below between the dashes):

---

javascript:void(function(){var fen=null;try{var el=document.querySelector('input.copyable[value*="/"]')||document.querySelector('.fen input')||document.querySelector('[data-fen]')||document.querySelector('.analyse__board');if(el){fen=el.value||el.getAttribute('data-fen')||el.dataset.fen}if(!fen){var m=document.body.innerHTML.match(/"fen":"([^"]+)"/);if(m)fen=m[1]}if(!fen){var txt=document.querySelectorAll('input,textarea');for(var i=0;i<txt.length;i++){var v=txt[i].value;if(v&&v.match(/^[rnbqkpRNBQKP1-8\/]+ [wb] /)){fen=v;break}}}}catch(e){}if(fen){window.open('http://localhost:8000?fen='+encodeURIComponent(fen),'_blank')}else{prompt('FEN not found automatically. Paste it here and click OK:','').length>0&&window.open('http://localhost:8000?fen='+encodeURIComponent(arguments[0]),'_blank')}}())

---

4. Save the bookmark.

## Usage

1. Go to a game or analysis board on Lichess or Chess.com
2. Click the **→ Chessdirbek** bookmark
3. Chessdirbek opens with the position loaded, ready to tag and save
4. Press **Cmd+S** (or Ctrl+S) to quick-save

## How it finds the FEN

The bookmarklet tries several methods:
- Lichess: Looks for the FEN input field in analysis mode
- Chess.com: Looks for `data-fen` attributes on the board
- Fallback: Searches the page HTML for a FEN pattern in JSON data
- Last resort: Prompts you to paste the FEN manually

## Changing the server URL

If you deploy Chessdirbek somewhere other than localhost:8000, find-and-replace 
`http://localhost:8000` in the bookmarklet URL with your actual server address.
