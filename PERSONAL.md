# Personal build (akakingj) — G20 320i petrol

Based on eroobeeroo/idrive7-cluster-info 0.28.1 (PolyForm Noncommercial 1.0.0: change and share for
noncommercial use only), with PR #8 (lb-ft and a pressure unit setting).

## Apps (installed beside the originals, never in their place)
| Original | ID here | Title |
|---|---|---|
| cluster_layouts | akakingj_cluster_layouts | AK Cluster Layouts |
| cluster_centre | akakingj_cluster_centre | AK Cluster Centre |
| cluster_info | akakingj_cluster_info | AK Cluster Info |

The `akakingj_` prefix is used by no other app in the Store's known sources (cauliflowermossgrape/idrive7-apps,
robertnisipeanu/idrive-apps, eroobeeroo/idrive7-apps, IterioDev/car-apps; checked 11 Nov 2026).
Icons: a gauge with an M-coloured accent and L / C / I (`icon.png` in each app's folder; `kit/tools/make_icon.js krgauge-L`).

MGU Store: Settings > Add source > `akakingj/idrive7-cluster-info` > branch `personal-kr`.
Remove the original Cluster Layouts / Centre / Info (or turn their Show off): both would draw on the cluster.

## Defaults
| App | Setting | Original > here |
|---|---|---|
| Layouts, Centre | Vehicle | Auto > Petrol or diesel |
| Layouts, Centre | Fuel tank | 69 > 59 L |
| Layouts, Centre | Speed, temperature | mph, °F > km/h, °C |
| Layouts, Centre, Info | Torque, pressure | Nm (lb-ft), auto > kgm, psi |
| Layouts, Centre | Power unit (new) | hp (PS, kW) |
| Layouts, Centre | Time zone | US Eastern > Korea / Japan (UTC+9) |
| Layouts | Red zone from, rev scale | 7000, 8000 > 6000, 7000 |
| Centre | Rev limit when warm, shift light flashes at | 6500, 6200 > 6000, 5700 |
| Info | Panel slots 1-3 | power, battery, oil > boost, torque, oil |

## Added
- Layouts > Readout 1 / Readout 2 / Main readout (petrol or diesel): the centre display's top left and right (where the
  time and outside temperature were over the car's own bottom strip) and the line under the digital speed: intake
  air, gearbox oil (TRANS), oil, coolant, boost, engine power, torque, throttle, accelerator pedal, timing.
  Classic M: Centre readout: bottom line (the coolant by default). Short names where
  the box is narrow (IAT 31°, TRANS 78°, BST 14.5, HP 211).
- Layouts > Speedometer gauge / Tach gauge: the small gauge in the analog dials (Analog sport, Digital round, Retro,
  Classic M): the layout's own, or any of the readings above, or fuel.
- Shift point and red zone as cauliflowermossgrape's Redline app: the red line less Shift point before redline
  (300 rpm); Cold-engine rev guard (on/off) lowers it to Cold rev limit (4500 rpm) with the oil at 30 °C, back at
  Oil warm at (80 °C). The red zone, amber zone, M's lit blades and the red gear follow it (M, Sport, Analog sport,
  Digital round, Retro, Classic M, GT3, Track's shift lights).
- M and Sport: the red zone and the amber zone before it (Amber zone before the red zone, 700 rpm; 0: none) filled
  across the blade / band, not a thin line.
- Layout in Sport / Layout in ECO PRO: another layout while the car's drive mode switch is in a sport mode or ECO PRO
  ('Same as Layout' by default), switched once the mode has held 1.5 s; the gear selector's S doesn't switch it.
- Temperature gauges (C - H, the default; or the original's scale and figures): the analog layouts' coolant, oil and
  gearbox oil gauges as the car's own, C at the cold end, H at the hot end, the needle in the middle once warm
  (coolant 80-105 °C, oil 85-115, gearbox oil 65-95), red towards H.
- Temperature colours (on): the readouts' and the small gauges' temperatures blue while cold (oil and coolant under
  60 °C, gearbox oil under 50) and red when too hot (130, 118, 115; intake air from 60).
- Shift warning (off): the digital speed and the gear red at the shift point, in the layouts without their own
  (not M, Sport, GT3, Track).
- Settings in sections (the app's own settings page): Show, Layout and Colours at the top, then Display, Readouts and
  gauges, Red zone and shift, Units and clock, Car, each opening its own list (kit/runtime/sheet.js: a setting's
  "section" in app.json; none: one list, as before). Cluster Centre: Show, then Pages, Custom page 1, Custom page 2,
  Look and size, Shift light and warm-up, Warnings, Units and clock, Car. Cluster Info: Show and Panel position, then
  Panel items, HUD, Units, Screen. The HMI's own list (only without the renderer) stays one list, each heading
  with its section ahead ('Custom page 1: Slot 1').
- Engine power = crankshaft torque (FES statusActualValueTorque2) x rpm / 9549: a calculation; on a tuned car
  (JB4) it may differ from the real power.
- Accelerator pedal and throttle, apart (the pedal is the driver's request, the throttle the valve's opening): both
  from the engine unit as Live Data reads them (pedal: DIDs 5814, 480B, OBD 0x49; throttle: 4600, 5858, OBD 0x11),
  read twice a round while shown and kept 8 s (a round can take 3 s or more while driving). The car's
  `AcceleratorPedal` signal is not used (its scaling unconfirmed). Check against Live Data.
- Centre: engine power and the accelerator pedal for the custom pages' slots.
- Layout 'Three pods' (an original design): a big centre tach (to Max rpm, 7000) with the digital speed in its face
  and the Main readout at its foot; a separate pod either side with the coolant and oil gauges (C - H, or the
  Speedometer gauge / Tach gauge setting) and Readout 1 / 2 in them over the car's own strip. With the map: the tach
  left, a pod right; with the car's own centre: the tach and one pod. The layout's own strip on an M car: the tach
  left, the pods lower, under its boxes.
- Layout 'Arc tach' (an original design): the engine speed as a solid arc three quarters round, filling as it climbs (0 to Max rpm,
  from just left of six o'clock up the left, over the top, to three o'clock), the numerals inside it, a thin red arc
  inside it where the red zone starts now (the shift point's: lower while the oil is cold); the digital speed in the
  quarter the arc leaves open, under its red end; the Main readout inside the arc; Three pods' side pods either
  side. With the map: the arc left, a pod right; the car's own centre: the arc and one pod; the layout's own strip
  on an M car: the pods lower, under its boxes. A plug-in hybrid in an electric mode: the arc reads the power.

## Demo
`cluster_demo.bat` (Windows) or `node tools/cluster_demo.js`.
