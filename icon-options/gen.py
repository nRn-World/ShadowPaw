def svg(body, defs=""):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>' + defs +
            '<filter id="g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="9" result="b"/>'
            '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' + body + '</svg>')

def bg(a, b):
    return ('<linearGradient id="bg" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="%s"/><stop offset="1" stop-color="%s"/></linearGradient>' % (a, b),
            '<rect width="512" height="512" rx="112" fill="url(#bg)"/>')

O = {}
# 1 eyes in the dark
d, r = bg("#0d1428", "#020308")
O[1] = svg(r + """<path d="M110 250 L128 120 L230 190 Q256 184 282 190 L384 120 L402 250 Z" fill="#0c1530"/>
<g filter="url(#g)"><path d="M92 300 Q170 214 242 300 Q170 360 92 300 Z" fill="#35ff86"/><path d="M420 300 Q342 214 270 300 Q342 360 420 300 Z" fill="#35ff86"/></g>
<ellipse cx="167" cy="298" rx="12" ry="40" fill="#020a05"/><ellipse cx="345" cy="298" rx="12" ry="40" fill="#020a05"/>
<circle cx="150" cy="274" r="9" fill="#fff" opacity=".9"/><circle cx="328" cy="274" r="9" fill="#fff" opacity=".9"/>""", d)

# 2 flat bold green + black cat
O[2] = svg("""<rect width="512" height="512" rx="112" fill="#2bee79"/>
<path d="M122 96 L226 178 Q256 170 286 178 L390 96 L412 262 Q412 392 256 440 Q100 392 100 262 Z" fill="#05070d" stroke="#05070d" stroke-width="14" stroke-linejoin="round"/>
<path d="M158 276 Q198 242 236 280 Q198 306 158 276 Z M354 276 Q314 242 276 280 Q314 306 354 276 Z" fill="#2bee79"/>
<path d="M256 340 L272 356 L240 356 Z" fill="#2bee79"/>""")

# 3 cat on the moon over skyline
d, r = bg("#1a1040", "#06050f")
O[3] = svg(r + """<circle cx="256" cy="228" r="150" fill="#f4efd8"/><circle cx="300" cy="190" r="26" fill="#e3dcbd"/><circle cx="210" cy="270" r="18" fill="#e3dcbd"/>
<path d="M0 420 H512 V512 H0 Z" fill="#05040c"/>
<path d="M40 420 V380 H80 V340 H120 V400 H150 V360 H190 V420 M330 420 V370 H370 V330 H410 V390 H440 V350 H480 V420" fill="#05040c"/>
<g fill="#05040c"><path d="M224 420 Q200 340 236 300 L226 262 L246 276 Q256 274 266 276 L286 262 L276 300 Q312 340 288 420 Z"/>
<path d="M286 410 Q350 410 350 360 Q350 330 330 336" fill="none" stroke="#05040c" stroke-width="14" stroke-linecap="round"/></g>""", d)

# 4 minimal paw with hard shadow
d, r = bg("#101c3c", "#04060e")
def paw(c, dx=0):
    return ('<g fill="%s" transform="translate(%s %s)"><ellipse cx="116" cy="240" rx="34" ry="46" transform="rotate(-24 116 240)"/>'
            '<ellipse cx="204" cy="150" rx="36" ry="50" transform="rotate(-8 204 150)"/><ellipse cx="308" cy="150" rx="36" ry="50" transform="rotate(8 308 150)"/>'
            '<ellipse cx="396" cy="240" rx="34" ry="46" transform="rotate(24 396 240)"/>'
            '<path d="M256 266 C330 266 392 340 392 396 C392 440 350 450 310 436 C280 426 232 426 202 436 C162 450 120 440 120 396 C120 340 182 266 256 266 Z"/></g>') % (c, dx, dx)
O[4] = svg(r + paw("#02030a", 22) + paw("#2bee79"), d)

# 5 faceted
d, r = bg("#0c1430", "#03050c")
O[5] = svg(r + """<g stroke="#03050c" stroke-width="3" stroke-linejoin="round">
<path d="M136 100 L240 176 L150 250 Z" fill="#2fd98a"/><path d="M376 100 L272 176 L362 250 Z" fill="#1fa86b"/>
<path d="M240 176 L272 176 L256 250 Z" fill="#7dffc4"/><path d="M240 176 L256 250 L150 250 Z" fill="#26c47e"/><path d="M272 176 L362 250 L256 250 Z" fill="#168a58"/>
<path d="M150 250 L256 250 L256 440 Z" fill="#1b9a64"/><path d="M362 250 L256 250 L256 440 Z" fill="#0f6e49"/>
<path d="M150 250 L256 440 L170 360 Z" fill="#35e496"/><path d="M362 250 L256 440 L342 360 Z" fill="#0b5a3c"/></g>
<path d="M176 290 L232 292 L206 318 Z M336 290 L280 292 L306 318 Z" fill="#03050c"/>""", d)

# 6 hexagon neon line art
d, r = bg("#0c1430", "#03050c")
O[6] = svg(r + """<path d="M256 56 L420 150 V362 L256 456 L92 362 V150 Z" fill="#070d1f" stroke="#2bee79" stroke-width="8" stroke-linejoin="round" filter="url(#g)"/>
<g fill="none" stroke="#7dffc4" stroke-width="9" stroke-linejoin="round" stroke-linecap="round" filter="url(#g)"><path d="M166 170 L226 214 Q256 206 286 214 L346 170 L356 276 Q352 354 256 388 Q160 354 156 276 Z"/>
<path d="M188 276 Q216 252 240 280 Q214 296 188 276 Z M324 276 Q296 252 272 280 Q298 296 324 276 Z"/><path d="M244 330 L256 342 L268 330"/></g>""", d)

# 7 negative space cat in circle
d, r = bg("#0b1128", "#02030a")
O[7] = svg(r + """<circle cx="256" cy="270" r="190" fill="#2bee79"/>
<path d="M138 120 L232 196 Q256 190 280 196 L374 120 L392 274 Q392 392 256 440 Q120 392 120 274 Z" fill="#05070d" stroke="#05070d" stroke-width="12" stroke-linejoin="round"/>
<path d="M172 290 Q208 258 244 294 Q208 318 172 290 Z M340 290 Q304 258 268 294 Q304 318 340 290 Z" fill="#2bee79"/>""", d)

# 8 synthwave outline
d, r = bg("#2a0a4a", "#07031a")
O[8] = svg(r + """<g stroke="#ff2bd6" stroke-opacity=".5" stroke-width="3"><path d="M0 400 H512 M0 440 H512 M0 480 H512 M256 370 L256 512 M140 370 L40 512 M372 370 L472 512 M20 370 L-120 512 M492 370 L632 512"/></g>
<circle cx="256" cy="250" r="150" fill="#ff2bd6" opacity=".18"/>
<g fill="none" stroke-linejoin="round" stroke-linecap="round" stroke-width="12" filter="url(#g)"><path d="M144 110 L230 182 Q256 174 282 182 L368 110 L388 262 Q388 372 256 420 Q124 372 124 262 Z" stroke="#19e3ff"/>
<path d="M178 268 L236 274 M334 268 L276 274" stroke="#ff2bd6"/><path d="M244 330 L256 342 L268 330" stroke="#ff2bd6"/></g>""", d)

# 9 leaping cat over skyline
d, r = bg("#3a1050", "#0a0620")
O[9] = svg(r + """<circle cx="256" cy="150" r="96" fill="#ff7a59" opacity=".9"/><path d="M0 430 H512 V512 H0 Z" fill="#06030f"/>
<path d="M30 430 V360 H90 V330 H130 V400 H170 V350 H220 V430 M300 430 V380 H350 V320 H400 V370 H440 V340 H490 V430" fill="#06030f"/>
<g fill="#06030f" stroke="#06030f" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="256" cy="200" rx="86" ry="34" transform="rotate(-18 256 200)"/><circle cx="332" cy="170" r="30"/>
<path d="M314 150 L318 118 L338 140 Z M344 142 L362 118 L360 156 Z"/>
<path d="M176 214 Q120 220 100 168 Q92 144 112 140" fill="none" stroke-width="12"/>
<path d="M296 224 L342 252 M276 232 L296 270 M222 216 L170 244 M206 204 L152 214" stroke-width="12" fill="none"/></g>
<circle cx="338" cy="168" r="4" fill="#ffe14a"/>""", d)

# 10 peeking over a ledge
d, r = bg("#0d1428", "#020308")
O[10] = svg(r + """<path d="M120 380 L134 190 L230 258 Q256 252 282 258 L378 190 L392 380 Z" fill="#101a38"/>
<g filter="url(#g)"><path d="M150 300 Q190 262 236 304 Q192 330 150 300 Z M362 300 Q322 262 276 304 Q320 330 362 300 Z" fill="#35ff86"/></g>
<ellipse cx="193" cy="302" rx="8" ry="22" fill="#020a05"/><ellipse cx="319" cy="302" rx="8" ry="22" fill="#020a05"/>
<rect x="0" y="372" width="512" height="140" fill="#060914"/><rect x="0" y="372" width="512" height="8" fill="#2bee79" opacity=".8"/>
<g fill="#16264f" stroke="#2bee79" stroke-width="4"><path d="M120 392 Q120 346 160 346 Q200 346 200 392 Z"/><path d="M312 392 Q312 346 352 346 Q392 346 392 392 Z"/></g>
<g stroke="#2bee79" stroke-width="4" stroke-linecap="round"><path d="M140 392 V360 M160 392 V352 M180 392 V360 M332 392 V360 M352 392 V352 M372 392 V360"/></g>""", d)

for k, v in O.items():
    open("option-%02d.svg" % k, "w").write(v)
cells = "".join('<div><img src="option-%02d.svg" width=300 height=300><div style="text-align:center;margin-top:6px">%d</div></div>' % (k, k) for k in O)
open("sheet.html", "w").write('<html><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(5,300px);gap:24px;padding:24px;font:bold 22px sans-serif;color:#fff">' + cells + "</body></html>")
