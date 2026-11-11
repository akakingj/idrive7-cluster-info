# 개인판 (G20 320i 가솔린) — 원작 0.28.1 기준

원작: eroobeeroo/idrive7-cluster-info (PolyForm Noncommercial 1.0.0, 비상업 용도로만 수정·공유 가능)
포함: PR #8 (lb-ft, 압력 단위 설정)

## 기본값 변경
| 앱 | 항목 | 원작 기본값 → 개인판 |
|---|---|---|
| Layouts / Centre | 차량 | Auto → Petrol or diesel |
| Layouts / Centre | 연료탱크 | 69 → 59 L |
| Layouts / Centre | 속도 / 온도 | mph, °F → km/h, °C |
| Layouts / Centre / Info | 토크 / 압력 | Nm(또는 lb-ft), auto → kgm, psi |
| Layouts / Centre | 마력 (새 설정) | hp (PS, kW 선택 가능) |
| Layouts / Centre | 시간대 | US Eastern → Korea / Japan (UTC+9) |
| Layouts | 레드라인 / rpm 눈금 최대 | 7000 / 8000 → 6000 / 7000 |
| Centre | 레드라인(Rev limit when warm) / 시프트 라이트 깜빡임 | 6500 / 6200 → 6000 / 5700 |
| Info | 패널 항목 1·2·3 | power, battery, oil → boost, torque, oil |

## 새 기능
- Layouts > Readout 1 / Readout 2 / Main readout (가솔린·디젤 차량)
  - Readout 1·2: 가운데 표시창 위쪽 왼쪽·오른쪽 (순정 하단 줄을 쓸 때 시계·외기온 자리). 기본 흡기온·미션오일 온도
  - Main readout: 디지털 속도 아래 (원래 엔진 토크 자리). 기본 엔진 토크
  - 고를 수 있는 항목: 흡기온, 미션오일, 엔진오일, 냉각수, 부스트, 마력, 토크, 가속 페달 %, 점화시기 (1·2는 '없음'도 가능)
  - 좁은 칸에서는 짧은 이름 (IAT 31°, TRANS 78°, BST 14.5, HP 211, TQ 30.6, THR 85%) → 흡기·미션 글자 겹침 해결
- Layouts > Speedometer gauge / Tach gauge: 아날로그 계열(Analog sport, Digital round, Retro, Classic M) 속도계·rpm계 안 작은 게이지
  - Auto(레이아웃 원래 것) 또는 냉각수, 엔진오일, 흡기온, 미션오일(TRANS), 부스트, 마력, 토크, 가속 페달, 점화시기, 연료
- M / Sport: rpm 레드존을 가는 선 대신 칸 전체 빨간색으로, 그 앞 노란 점선 구간(레드존 −700rpm)도 칸 전체 노란색으로 채움
- 변속 시점·레드존을 Redline 앱(cauliflowermossgrape/idrive7-apps) 방식으로: 변속 시점 = Redline − Shift point before redline(300),
  Cold-engine rev guard(켬): 오일 30°C에서 Cold rev limit(4500)까지 내려갔다가 Oil warm at(80°C)에 원래대로. 레드존·노란 점선·M 빨간 칸·기어 빨강이 함께 움직임
  (M, Sport, Analog sport, Digital round, Retro, Classic M, GT3, Track 시프트 라이트)
- 마력 = 엔진 토크(FES statusActualValueTorque2) × rpm ÷ 9549 (계산값, JB4 등 튠 차량은 실제와 다를 수 있음)
- 가속 페달 = de.bmw.powertrain.AcceleratorPedal / AngleAcceleratorPedal (실차 확인 필요: 로그 'raw AngleAcceleratorPedal')
- Centre 커스텀 페이지 칸에도 Engine power, Accelerator pedal 추가

## 데모
cluster_demo.bat (Windows) 또는 `node tools/cluster_demo.js` → 레이아웃 탭 '가운데 표시 항목'
