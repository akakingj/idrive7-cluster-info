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
  air, gearbox oil (TRANS), oil, coolant, boost, engine power, torque, accelerator pedal, timing. Short names where
  the box is narrow (IAT 31°, TRANS 78°, BST 14.5, HP 211).
- Layouts > Speedometer gauge / Tach gauge: the small gauge in the analog dials (Analog sport, Digital round, Retro,
  Classic M): the layout's own, or any of the readings above, or fuel.
- Shift point and red zone as cauliflowermossgrape's Redline app: the red line less Shift point before redline
  (300 rpm); Cold-engine rev guard (on/off) lowers it to Cold rev limit (4500 rpm) with the oil at 30 °C, back at
  Oil warm at (80 °C). The red zone, amber zone, M's lit blades and the red gear follow it (M, Sport, Analog sport,
  Digital round, Retro, Classic M, GT3, Track's shift lights).
- M and Sport: the red zone and the amber zone before it (Amber zone before the red zone, 700 rpm; 0: none) filled
  across the blade / band, not a thin line.
- Engine power = crankshaft torque (FES statusActualValueTorque2) x rpm / 9549: a calculation; on a tuned car
  (JB4) it may differ from the real power.
- Accelerator pedal: `de.bmw.powertrain.AcceleratorPedal` / `AngleAcceleratorPedal`, to confirm on the car (raw
  values in the log, 'raw AngleAcceleratorPedal').
- Centre: engine power and the accelerator pedal for the custom pages' slots.

## Demo
`cluster_demo.bat` (Windows) or `node tools/cluster_demo.js`.
