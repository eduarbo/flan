# Notes for a second PCB version

Collected from the first build of Flan36 revI (2026-11-24). Nothing here is designed yet.

- **Silkscreen labels.** Mark ON and OFF at SW1, BAT+ and GND at J1, and the name of each part by its footprint.
- **Same switch direction on both halves.** SW1 connects the battery when its lever is toward pad 1. Pad 1 is toward the USB end on the right half and toward the thumb keys on the left half. Wire BAT+ to pad 3 on one half, or turn that footprint, so both switch on the same way.
- **Battery polarity.** JST PH plugs are not wired to one standard, and a Typeractive 301230 arrived reversed for J1. Consider reverse-polarity protection, a solder jumper that swaps J1, or the footprint order that matches that battery as delivered.
- **Battery capacity.** Under the controller there is 5.7 mm between the case floor (Z1.4) and the underside of the nice!nano USB connector (Z7.1); the PCB opening is 12.5 × 34.4 mm. A 501230 cell (about 130–150 mAh, up to 12.5 × 31 × 5.3 mm by one maker's sheet) fits in height with a new cradle and cage; a 601230 (about 180 mAh) or two stacked 301230 cells do not. The width is at the limit and must be measured on the real cell.
- **Thinner stack.** The overall height is set by the Choc switches and keycaps. Under the keys the hot-swap sockets leave about 0.5 mm to spare. The electronics could sit 2–3 mm lower with the controller soldered without sockets, at the cost of the battery space above.
