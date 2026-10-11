# Parts and buying guide

**One complete 36-key split. Quantities cover both halves.**

This is the selected purchasing BOM for the routed revI prototype, an original design by Eduardo Ruiz. The display uses the connector supplied with nice!view; the controller sockets and pins are specified below. **Physical assembly has not been qualified:** supplied-part tolerances, printed fit, magnetic retention and electrical operation still need the [build checks](build.md).

[Custom PCBs](electronics.md) · [Typeractive shopping list](#typeractive-shopping-list) · [Controllers](#controllers) · [Displays](#displays) · [Switches](#switches-and-hot-swap) · [Battery](#battery) · [Connectors](#removable-connectors) · [Small parts](#small-electrical-parts) · [Printed parts](#printed-parts)

**Custom PCBs: 1 left + 1 right**, two layers, 1.6 mm FR4, nominal 1 oz copper. Download the [left fabrication ZIP](https://raw.githubusercontent.com/eduarbo/flan36/main/hardware/revI/fabrication/flan36-left-revI-prototype.zip) and [right fabrication ZIP](https://raw.githubusercontent.com/eduarbo/flan36/main/hardware/revI/fabrication/flan36-right-revI-prototype.zip), then follow the [ordering settings](electronics.md#order-the-two-pcbs). The supplied pin maps differ between halves; neither board is interchangeable with Piantor or the historical placement studies.

## Typeractive shopping list

| Item | Quantity / store selection | Assembly note |
|---|---|---|
| [nice!nano v2](https://typeractive.xyz/products/nice-nano) | **2 units** | Install with the specified Mill-Max sockets/pins at Z8.20 mm |
| [nice!view](https://typeractive.xyz/products/nice-view) | **2 units** | Use each display's supplied 5-pin socket and header; 7.00 mm board separation |
| [Choc v1 switches](https://typeractive.xyz/products/choc-switches) | **4 packs of 10**; Pro Red baseline | 36 required, 4 spares |
| [Kailh hot-swap sockets](https://typeractive.xyz/products/hotswap-sockets) | **4 packs of 10; select Choc** | Do not select MX |
| [1N4148W SMD diodes](https://typeractive.xyz/products/smd-diodes) | **4 packs of 10** | SOD-123 family; verify supplied marking/footprint |
| [Battery jack](https://typeractive.xyz/products/battery-jack) | **1 pack of 2; white** | JST S2B-PH-K-S side-entry reference; 2 mm nominal footprint |

No additional display connector pack is needed. The selected controller connectors, battery, power switch and reset button are in the following list; the similarly named Typeractive alternatives are not the selected parts.

## DigiKey shopping list

| Item | Quantity | Selection |
|---|---:|---|
| [Adafruit 1570](https://www.digikey.com/en/products/detail/adafruit-industries-llc/1570/5054546) | **2** | Protected 1S 100 mAh LiPo; keep the nice!nano BOOST jumper open |
| [C&K PCM12SMTR](https://www.digikey.com/en/products/detail/c-k/PCM12SMTR/1640112) | **2** | Exact power-switch reference; cut tape |
| [E-Switch TL3342F160QG/TR](https://www.digikey.com/en/products/detail/e-switch/TL3342F160QG-TR/379003) | **2** | Exact reset-button reference; cut tape |
| [Mill-Max 315-43-164-41-003000](https://www.digikey.com/en/products/detail/mill-max-manufacturing-corp/315-43-164-41-003000/1212143) | **1 strip of 64** | Cut four 12-contact strips, using sacrificial contacts at the cuts |
| [Mill-Max 3320-0-00-15-00-00-03-0](https://www.digikey.com/en/products/detail/mill-max-manufacturing-corp/3320-0-00-15-00-00-03-0/4147392) | **50** | Round pins; 48 used, 2 spares |
| [Essentra RBS-5BK](https://www.digikey.com/en/products/detail/essentra-components/RBS-5BK/1878940) | **8** | Adhesive feet, Ø12.7 × 1.6 mm; DigiKey RPC1381-ND |
| [Adafruit 4199](https://www.digikey.com/en/products/detail/adafruit-industries-llc/4199/10230016) | **1** | USB-C to USB-C data cable, 1 m; DigiKey 1528-4199-ND; $9.95 when checked |
| [Olimex KAPTON-TAPE10MM](https://www.digikey.com/en/products/detail/olimex-ltd/KAPTON-TAPE10MM/19204468) | **1 roll** | Insulating tape, 10 mm × 30 m; DigiKey 1188-KAPTON-TAPE10MM-ND; $2.88 when checked |

The 64-position strip replaces the unavailable 12-position version in the same 315 family and suffix. The PCM12SMTR is obsolete but was stocked when this list was checked; a different switch requires a footprint check. Prices and availability were checked on October 10, 2026 and can change at checkout. Lithium batteries require an eligible US ground service; do not select an air or prohibited postal service. Custom PCBs and printed parts are separate.

## Magnets from existing stock

Use **12 axially magnetized neodymium magnets from existing stock: 6 × Ø2 × 3 mm in the bases and 6 × Ø2 × 4 mm in the frames**, three of each per half. No magnetic hardware purchase is required. Each additional pair of frames needs six more Ø2 × 4 mm magnets; the base magnets stay in place. Measure the actual magnets before printing; the existing pocket geometry is unchanged.

Before closing any captive pocket, verify that every matching pair attracts in its final assembled orientation. Keep the same mating-face polarity across the bases and the opposite mating-face polarity across all interchangeable frames. Use the [polarity, capture and heat checks](build.md#magnetic-frame-and-service); the stock's grade, temperature limit and holding force have not been qualified.

## Controllers

<a href="https://typeractive.xyz/products/nice-nano"><img src="https://cdn.shopify.com/s/files/1/0618/5674/3655/products/new-nano-side-small.jpg?v=1671313846" width="210" alt="nice!nano v2.0 — supplier product photo"></a>

**2 × nice!nano v2.** nRF52840 wireless controllers with USB-C and battery charging. They provide the intended BLE link between halves and to the host.

**Technical reference:** [v2 pinout and schematic](https://nicekeyboards.com/docs/nice-nano/pinout-schematic/). **Full documentation:** [nice!nano](https://nicekeyboards.com/docs/nice-nano/). **Buy:** [Typeractive](https://typeractive.xyz/products/nice-nano).

Alternatives: clones require independent pinout, charger and idle-current checks. XIAO or other controller formats require a PCB and mounting redesign. No alternative is approved as a direct replacement.

## Displays

<a href="https://typeractive.xyz/products/nice-view"><img src="https://cdn.shopify.com/s/files/1/0618/5674/3655/products/niceviewangle-cleaned-more-small.jpg?v=1671314667" width="210" alt="nice!view — supplier product photo"></a>

**2 × nice!view**, with a single left display as the fallback. Reflective memory LCD; selected for low power. Each cover leaves the glass visible and hides the surrounding electronics.

**Technical reference:** [dimensions, pinout and schematic](https://nicekeyboards.com/docs/nice-view/pinout-schematic/). **Full specifications/setup:** [nice!view documentation](https://nicekeyboards.com/docs/nice-view/). **Buy:** [Typeractive](https://typeractive.xyz/products/nice-view).

A separate board PDF datasheet is not linked by the manufacturer; its dimensioned drawings and schematic are the authoritative board references. OLED offers dark-room visibility at a power cost. E-paper needs a different mount and firmware. Neither fits this design as a drop-in alternative.

## Switches and hot-swap

<a href="https://typeractive.xyz/products/choc-switches"><img src="https://cdn.shopify.com/s/files/1/0618/5674/3655/products/choc-four.jpg?v=1674353978" width="210" alt="Kailh Choc v1 Low Profile Switches — supplier product photo"></a>

**36 × Kailh Choc v1; 40 provides spares.** Pro Red 35 gf is the baseline; Pink 20 gf is lighter, Red 50 gf firmer, Brown tactile and White clicky. Silent Ambients are another Choc-family option to measure before adopting.

**Technical information:** [Kailh PG1350 family](https://www.kailhswitch.com/info/kailh-kl-switches-pg1350-series-23772219.html). **Variant specifications and purchase:** [Typeractive Choc v1](https://typeractive.xyz/products/choc-switches). **Silent alternative:** [LowproKB Ambients](https://lowprokb.ca/products/ambients-silent-choc-switches).

An exact Pro Red manufacturer PDF has not been verified here; the family page is not a substitute for a variant-specific drawing. Choc v2/MX-stem switches are outside this build.

<a href="https://typeractive.xyz/products/hotswap-sockets"><img src="https://cdn.shopify.com/s/files/1/0618/5674/3655/products/hotswap-both.jpg?v=1671586185" width="210" alt="Kailh Hotswap Sockets — supplier product photo"></a>

**36 × Kailh CPG135001S30 Choc sockets; 40 provides spares.**

**Datasheet/drawing:** [Kailh CPG135001S30 PDF](https://www.kailhswitch.com/Content/upload/pdf/202115927/CPG135001S30-data-sheet.pdf). **Info and purchase:** [Typeractive — select Choc](https://typeractive.xyz/products/hotswap-sockets). The product photo includes both families; the **MX** variant is incompatible.

All 36 sockets are represented in the nominal assembly and registered to their PCB mounting bores and solder-contact planes. The case includes a local H3 support relief, measured at **0.25 mm nominal clearance** from thumb socket K30 on both halves. [Component geometry and clearance evidence](../components/README.md) do not qualify a purchased variant, solder thickness or printed fit.

## Battery

<a href="https://www.adafruit.com/product/1570"><img src="https://cdn-shop.adafruit.com/145x109/1570-00.jpg" width="210" alt="Adafruit 1570 battery — supplier product photo"></a>

**CAD reference: 2 × Adafruit 1570, protected 1S LiPo, sold as 100 mAh.** The model uses the product page’s **11.5 × 31 × 3.8 mm** envelope; two continuous nominal 105 mm lead paths include cell-end bends and plug interfaces. Their 0.6 mm insulation diameter and terminal positions remain assumptions.

**Datasheet:** [supplier-linked PKCELL PDF](https://cdn-shop.adafruit.com/product-files/1570/1570datasheet.pdf). **Full information and purchase:** [Adafruit 1570](https://www.adafruit.com/product/1570). The linked PDF names a **401230 / 105 mAh** cell, while the listing says 100 mAh: confirm the actual supplied pack and its dimensions before closing the cradle. The product page limits charging to **100 mA or less**; the nice!nano charger configuration must respect the actual cell’s limit.

<a href="https://typeractive.xyz/products/lithium-battery-110mah"><img src="https://cdn.shopify.com/s/files/1/0618/5674/3655/products/battery-corner-small.jpg?v=1671314267" width="210" alt="Lithium Battery 110mAh — supplier product photo"></a>

**Typeractive alternative: 301230, 110 mAh, 3 × 12 × 30 mm.** [Product and connector variants](https://typeractive.xyz/products/lithium-battery-110mah). The black PH connector version has shorter leads; the white version includes a mating wired jack. No cell-specific datasheet is linked on the listing.

**Both profiles use the same case, PCB opening, open-bottom locator and cage.** The cell rests at **Z = 1.4 mm** on the case floor; there is no printed saddle beneath it. Select the battery in **Battery** in the sidebar in the viewer; configuration JSON and FreeCAD retain the choice per half.

| Profile | Nominal W × L × H | Aperture side gap | Gap below rigid cage roof |
|---|---|---:|---:|
| Adafruit 1570 | 11.5 × 31 × 3.8 mm | 0.50 mm per side | 0.40 mm |
| 301230 | 12 × 30 × 3 mm | 0.25 mm per side | 1.20 mm |

These are nominal clearances, not maximum finished-pack tolerances. Confirm protection-board wrapping, insulation at PCB edges, lead exit, connector polarity and charging limits on the delivered pack. The smaller pack can move within the cage; delivered-pack retention and lead strain still need a physical check. No autonomy estimate is promised.

## Removable connectors


**Selected controller connectors:** 1 × 64-position Mill-Max **315-43-164-41-003000** strip, cut into **four 12-contact strips**, and **50 × 3320-0-00-15-00-00-03-0** round pins. Reserve sacrificial contacts at each cut; 64 positions cover the 48 installed contacts and cut losses. The strip has the same 315-family geometry and suffix as the earlier 315-43-112-41-003000 reference. [315-family drawing](https://media.digikey.com/pdf/Data%20Sheets/Mill%20Max%20PDFs/310,%20311,%20315%20Series%20(in.).pdf) · [3320 pin drawing](https://www.mouser.com/datasheet/2/273/3320-0-00-15-00-00-03-0-780142.pdf).

The round pin is nominally Ø0.020 in (0.508 mm), within the socket's Ø0.015–0.022 in accepted range. Its **6.35 mm length does not set the board separation**. Before soldering, use the printed controller support to hold the nice!nano underside at **Z8.20 mm**, **2.80 mm above the main PCB top at Z5.40 mm**, with the controller level. Verify engagement and insulation before applying power. The Typeractive 310 and taller EZ-Solder kits are not selected substitutes; do not force square pins into turned sockets.

<a href="https://typeractive.xyz/products/5-pin-sockets"><img src="https://cdn.shopify.com/s/files/1/0618/5674/3655/products/nice-view-sockets.jpg?v=1671232737" width="210" alt="5-Pin Sockets — supplier product photo"></a>

**Selected display connectors:** the **two supplied nice!view socket/header pairs**, one per display. The stated **5 mm socket + 2 mm header** gives **7.00 mm** board separation. The current display PCB underside is **Z12.40 mm**, glass top **Z14.30 mm**, and frame/Level roof **Z14.50 mm**. [Stack dimensions and service well](level-stack.md).

Put the male header's **short solder tails into the display PCB** and its long mating posts into the supplied socket. Trim only the free solder tails to **at most 0.30 mm above the display PCB**, with a **0.50 mm maximum solder-joint envelope**. Do not shorten the mating posts. Trim the main-board socket's free solder tails to **at most 1.00 mm below the main PCB**. Check the joints and clearances before fitting the frame. [Supplier connector reference](https://typeractive.xyz/products/5-pin-sockets).

**Superseded study:** the Samtec SLW-105-01-L-S / TLW-105-06-G-S pair proposed a 6.09 mm stack, but its square post had no established tolerance allowance in the nice!view's undimensioned finished holes. It is no longer the purchasing recommendation. The frame and Level roof were raised 0.91 mm to use the supplied connector instead.

[No-solder spring headers](https://typeractive.xyz/products/no-solder-spring-headers) require the supplier’s specified **0.8–0.9 mm holes** and different installed heights. They are not qualified for the current Flan36 hole/contact geometry. Do not buy them as an assumed shortcut.

## Small electrical parts

<a href="https://typeractive.xyz/products/smd-diodes"><img src="https://cdn.shopify.com/s/files/1/0618/5674/3655/products/diode-all.jpg?v=1670363837" width="210" alt="SMD Diodes — supplier product photo"></a>

**36 × 1N4148W, SOD-123; four 10-packs give spares.** [Typeractive info/buy](https://typeractive.xyz/products/smd-diodes) · [Semtech datasheet](https://cdn.shopify.com/s/files/1/0618/5674/3655/files/Semtech-1N4148W.pdf?v=1670451309). Match package and cathode orientation to the final PCB.

<a href="https://typeractive.xyz/products/battery-jack"><img src="https://cdn.shopify.com/s/files/1/0618/5674/3655/products/jst-all_ea8f3d9e-2644-4b11-91c9-7098c3b8c07c.jpg?v=1674443612" width="210" alt="Battery Jack — supplier product photo"></a>

**2 × battery jacks.** [Typeractive JST PH 2.0 mm](https://typeractive.xyz/products/battery-jack) · [JST S2B-PH-K drawing](https://cdn.shopify.com/s/files/1/0618/5674/3655/files/JST-S2B-PH-K.pdf?v=1670451309). The PCB study now uses a 2 mm side-entry footprint and the CAD uses a nominal mated header/PHR-2 envelope. Check the purchased pack's polarity and terminal dimensions before assembly.


**2 × C&K PCM12SMTR power switches**, selected from [DigiKey](https://www.digikey.com/en/products/detail/c-k/PCM12SMTR/1640112). [Manufacturer datasheet](https://www.ckswitches.com/media/1424/pcm.pdf). Typeractive's **Alps SSSS811101** has a different footprint and is not the selected part.


**2 × E-Switch TL3342F160QG/TR reset buttons**, selected from [DigiKey](https://www.digikey.com/en/products/detail/e-switch/TL3342F160QG-TR/379003). [Full product information](https://www.e-switch.com/product/tl3342-series-low-profile-smt-tactile-switch/) · [datasheet](https://configured-product-images.s3.amazonaws.com/2D/specs/TL3342F160QG.pdf). Typeractive's **Panasonic EVQPUC02K** is not the selected part. The E-Switch reference is mounted below the PCB with recessed tool access through the case floor; a different switch requires footprint, actuation-height and clearance checks.

## Printed parts

![Flan36 revI case CAD and KLP Lamé reference assembly](images/revI-assembled.png)

| Part | Quantity | Files / options |
|---|---:|---|
| KLP Lamé keycaps | 36 | [Variant guide](customize.md); [38 source STLs](../keycaps/variants); original preset: 28 Normal + 2 Homing + 6 Thumb |
| Case bases and key plates / upper shells | 2 each | Level, Solid, Color rim or Terrace; [editable CAD, STEP and STL](cad.md) |
| Display frames | 2 | Six selectable approved designs; 14.50 mm shared roof, separate color per half |
| Battery locators and retainers | 2 each | Open-bottom locator and rigid cage; cell on the floor, cage feet captured under PCB |
| Controller supports and display sleds | 2 each | Independent from the cover |
| Printed spacers/washers | 6 | Check printed dimensions and screw fit |

**Technical source for keycaps:** [KLP Lamé files and print guidance](https://github.com/braindefender/KLP-Lame-Keycaps). No commercial datasheet applies to the custom printed parts; the FCStd and dimensioned parameters are their design source. PLA Basic, PETG HF and ABS are candidate materials, not validated print profiles. Start with a fit coupon and three caps.

## Fasteners, cable and tools

- **6 × M2 × 6 low-head screws:** nominal NBK SLH envelope, Ø3.8 × 1.3 mm head. [Drawing](https://static.nbk1560.com/images/en/product/lowsmallheadscrew/SLH-TZB/SLH-TZB_1.pdf). **4 × M2 × 4:** NBK SSH envelope, Ø4 × 1.1 mm head. [Drawing](https://static.nbk1560.com/images/en/product/lowsmallheadscrew/SSH/SSH_1.pdf). Tap the printed Ø1.7 mm pilots M2; engagement is 2.2–2.4 mm. Thread strength remains untested.
- **6 × Ø2 × 3 mm axial neodymium magnets from existing stock:** three stay in each base. The original S-02-03-N, N45 reference has [product information](https://www.supermagnete.de/stabmagnete-neodym-rund/stabmagnet-2mm-3mm_S-02-03-N) and a [datasheet](https://www.supermagnete.fr/data_sheet_S-02-03-N.pdf); its 80°C limit does not establish the grade or thermal limit of the actual stock. Qualify the capture process using the actual magnets.
- **6 × Ø2 × 4 mm axial neodymium magnets from existing stock:** three per frame; see [magnet quantities and polarity](#magnets-from-existing-stock). Every additional pair of frames needs six more. No steel targets are required.
- **8 × Essentra RBS-5BK adhesive feet:** Ø12.7 × 1.6 mm, [DigiKey RPC1381-ND](https://www.digikey.com/en/products/detail/essentra-components/RBS-5BK/1878940). The checked eight-piece line was $1.30. Their 1.6 mm height adds externally without changing the internal stack; place them clear of reset access and screw holes.
- **1 roll Olimex KAPTON-TAPE10MM:** 10 mm × 30 m insulating tape for local electrical isolation. [Manufacturer specifications](https://www.olimex.com/Products/Tools/Soldering/KAPTON-TAPE10MM/) give 20 µm thickness. Do not cover connector contacts or use tape to compress the battery pouch; the printed locator and cage provide mechanical retention. Printed retention remains untested.
- **1 × Adafruit 4199 USB-C to USB-C data cable, 1 m:** [manufacturer information](https://www.adafruit.com/product/4199). Use it to flash and charge each half in sequence from a USB-C computer. The cable carries data as well as power; inspect complete plug insertion without forcing the case. No second cable or USB-A adapter is required for that sequence. Omit this purchase only if an equivalent USB-C data cable is already available.
- Fine-tip soldering iron, solder, flux, tweezers, cutters and a multimeter. The printer makes mechanical parts; the custom PCB needs fabrication. [Routed prototype files and remaining checks](electronics.md).

## Sources and images

The selected Typeractive and DigiKey products and pack quantities were checked during the **2026-10-10** procurement review. Earlier battery and magnetic hardware references date from **2026-09-22**. Manufacturer/supplier documentation takes precedence over approximate CAD envelopes; the assembly checks apply to delivered parts, not merely their catalog names.

Product photos are embedded from Typeractive/Adafruit and linked to their original listings. They remain the property of their respective owners; they are not relicensed under this repository’s license. They need internet access and are not bundled in the offline 3D viewer. Flan36 renders have separate [attribution](../ATTRIBUTION.md).

## What the component models represent

The explorer now distinguishes commercial model sources from fit reserves. See [component fidelity and dimensions](../components/README.md) for the nice!nano v2 reconstruction, nice!view drawing, licensed library models and the remaining connector/measurement gaps.
