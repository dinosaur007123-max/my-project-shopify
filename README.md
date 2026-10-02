# MIRA Maison — Shopify theme

A dark, editorial Online Store 2.0 theme for **MIRA**, a Dubai perfume house.
All imagery and film were generated with Higgsfield (GPT Image 2.5 stills,
Seedance 2.5 video).

## What's on the home page

| Section | What it does |
| --- | --- |
| `hero-wordmark` | Giant Bodoni wordmark with the flacon breaking through it. Preloader → letters rise → bottle swings in. On scroll the stage pins, the letters part and the bottle stands upright. Mouse parallax on desktop. |
| `marquee` | Italic ingredient ticker whose speed and skew react to scroll velocity. |
| `scroll-film` | Apple-style scrubbed film: a 120-frame WebP sequence (from the Higgsfield orbit video) painted on a canvas, with three timed captions. |
| `arc-story` | Light/bold split headline, image held in a sweeping arc, gold arc strokes that draw on scroll, counting stats, rotating badge. |
| `product-spotlight` | Carousel with a big uppercase title, a ghost word behind the bottle, a price/rating/size rail, an accent colour per fragrance, numbered 01–04 tabs, swipe/arrow keys, and AJAX add to bag. |
| `notes-horizontal` | Pinned horizontal gallery of raw materials with outlined numerals and inner parallax. |
| `video-reveal` | Liquid-gold video that grows out of an arched window to full bleed as you scroll. |
| `scent-finder` | Two-question quiz that reveals the matching fragrance, with add to bag. |
| `quote-parallax` | Desert parallax with a quote whose words light up as you scroll. |
| `featured-collection` | Arched product cards with 3D tilt, hover image swap and quick add. |
| `testimonials` | Glass cards in a drag-to-scroll rail. |

Across the site: Lenis smooth scrolling, a custom cursor with labels, magnetic
buttons, a full-screen menu that swaps images as you hover the links, an AJAX
cart drawer (Section Rendering API), a sticky product page with variant
switching, and support for `prefers-reduced-motion`.

## Building the assets

The generated media isn't committed. Fetch and convert it, then package the
theme:

```bash
scripts/build-assets.sh            # → dist/mira-theme.zip
```

This needs `curl`, `ffmpeg`, `python3` with Pillow, and `zip`. Upload the zip
in **Online Store → Themes → Add theme → Upload zip file**, or run
`shopify theme push`.

## Store data

The homepage template references these product handles: `amber-nocturne`,
`oud-noir`, `rose-de-taif`, `saffron-veil`. It also references the
`signature-collection` collection. Everything else can be edited in the theme
editor.
