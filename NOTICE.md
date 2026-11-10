# Notices

- `kit/` is the MGU App Kit from
  [cauliflowermossgrape/idrive7-apps](https://github.com/cauliflowermossgrape/idrive7-apps) (as in
  eroobeeroo/idrive7-apps at 0649fe6), MIT licence: `kit/LICENSE`. Its fonts keep their own licences
  (`kit/runtime/fonts`).
- `cluster_render_client.js` (in `shared/` and each app that draws on the cluster) is the cluster render service's
  Node client from
  [robertnisipeanu/idrive-apps](https://github.com/robertnisipeanu/idrive-apps) (`native/cluster-render`),
  MPL-2.0, as its header says.
- The GT3, M and Sport layouts of Cluster Layouts (`layout_gt3.js`, `layout_m.js`, `layout_sport.js`) and the tyre
  readings follow bimmer-lab's Cluster Themes ([bimmer-lab/apps](https://github.com/bimmer-lab/apps)), MIT licence:
  its notice ships with each app in `NOTICE` (`shared/NOTICE`).
- Everything else: Copyright (C) 2026 eroobeeroo, GPL-3.0-or-later (`LICENSE`).

## Barlow Semi Condensed and Michroma (the cluster fonts)

The cluster glyph atlases (`shared/font_bold.wad`, `shared/font_light.wad`, `shared/font_wide.wad`, made by
`tools/bake_font.py`) are drawn from Barlow Semi Condensed, Copyright 2017 The Barlow Project Authors
(https://github.com/jpt/barlow), and (the wide one's figures and capitals, thickened) Michroma, Copyright 2011 The
Michroma Project Authors (https://github.com/googlefonts/Michroma-font), used under the SIL Open Font License 1.1. The licence's full text ships with each app as `NOTICE`
(`shared/NOTICE`).
