# BFF brand palette — extracted from beyondfreedomfinancial.com

Method: opened the live site in Chrome, ran a computed-style sweep across every element with `getComputedStyle`, counted color occurrences by property, recorded `:root` CSS variables.

## CSS variables declared at :root

```
--color-m3xbc5f1: #001532   (deep navy — most-used heading + dark-section background)
--color-m3xdljs7: #002137   (navy — secondary dark background)
--color-m3xb1vli: #3498DB   (sky blue — primary CTA / chip / icon fill)
--color-m3yf9q4b: rgb(1, 21, 50)  ≈ #011532  (near-duplicate of deep navy)
--color-m3xd0iwh: #F3F3F3   (cool light gray surface)
--color-m3xc1b0b: #313131   (text on light)
--color-m3xc0bmr: #ABABAB   (muted text)
--color-m3yw25kz: #EEEEEE   (text on dark)
--brandboards-new_color_9964: #101b47ff (decorative deep blue-violet)
--cobalt:        #155eef
--secondary:     #188bf6
--link-color:    #188bf6
--malibu:        #63b3ed   (sky tint)
--white:         #ffffff
--smoke:         #f5f5f5
--gray:          #cbd5e0
--headlinefont:  'Montserrat'
--contentfont:   'DM Sans'
```

## Top color occurrences

| Hex | Property usage | Role |
| --- | --- | --- |
| `#EEEEEE` | 152 text + 152 border | Body text on dark sections |
| `#313131` | 68 text + 68 border | Body text on light |
| `#001532` | 48 text + 6 background + 1 row bg | Headlines on light; secondary dark surface |
| `#3498DB` | 21 text + 15 background | Primary accent — CTAs, chips, icons |
| `#002137` | 20 background | Primary dark surface |
| `#ABABAB` | 14 text | Muted captions |
| `#F3F3F3` | 7 background | Inset light surface |
| `#188bf6` | 2 link | Inline links |

## Typography

- Headlines: `Montserrat`, 700, observed at 48px / 62.4px line-height on hero h1
- Body: `DM Sans`, 400, observed at 15-16px

## Take-aways for the redesign

1. **Primary surface system is white + navy** — no cream, no paper. Confirmed in code.
2. **Primary action color is sky-blue `#3498DB`**, not the navy itself.
3. **Headlines live in deep navy `#001532`** on light, and white on dark.
4. **Cool gray (`#F3F3F3` / derived `#F7F9FC`) for raised panels** — not warm gray.
5. **Type pairing: Montserrat display + DM Sans body** — keep this; it is the brand's voice.
