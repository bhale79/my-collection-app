// ══ atlas-diagrams-config.js — Atlas's parts diagrams, and which item gets which ══
//
// v0.9.1802 (Brad, 2026-09-26: Atlas parts on the Maintenance page "the same
// way as MTH"). This list used to live inside maintenance.js, where only the
// "Parts diagram" buttons could reach it. It now lives HERE, once, and two
// things read it:
//   1. the Maintenance page's "Parts diagram" buttons (maintenance.js), and
//   2. the parts lookup (app-data.js _partsForItem), which lists every part
//      Atlas printed on those same diagrams — the "Atlas Parts" catalog tab
//      files each part under the diagram(s) it is printed on ("Parts Lists"
//      column = the diagram's PDF path, the `u` below).
// One list and one matcher, so the parts shown can never disagree with the
// diagrams shown. The KEY is the PDF path, never a position in this list.
//
// Each entry: s = scale (O / HO / N), t = title, u = PDF path on ATLAS_DL,
// r = '2' / '3' for O-scale 2-rail / 3-rail sheets ('' = either),
// m = model keys ("gp35|emdgp35"), st = exact Sub Type names (freight cars).
//
// HOW AN ITEM IS MATCHED (v0.9.1802 — the old matcher, measured on the real
// master 2026-09-26, gave 373 HO "PS-2 Hopper" rows the S-2 LOCOMOTIVE sheet,
// the "40' PS-1" box cars the 50' PS-1 sheet, every 2-rail O engine its 3-rail
// sheets, and could never match most freight cars at all):
//   · a freight car matches ONLY by its exact Sub Type (st). Freight-car
//     titles are lengths and ton-ratings ("40'", "50 Ton") — words that are
//     in half the catalog. A wrong parts list is worse than none.
//   · a model key must START a word ("PS-2" does not contain the key "s2";
//     "SD-40" does contain "sd40"). A digits-only key needs 4+ digits.
//   · a key inside a longer matched key loses to it (GP40-2 → gp402, not
//     gp40), but different models in one Sub Type all count ("SD-50, SD-60,
//     SD-60M" gets all three families).
//   · every sheet of every winning family comes back (body, chassis, trucks,
//     Silver and Gold), in list order.
//   · O scale: the item's own Track/Power picks the rail; 3-rail when unsaid.
(function () {
  var ATLAS_DL = 'https://download.atlasrr.com';
  var ATLAS_PAGE = 'https://shop.atlasrr.com/t-partsdiagrams.aspx';
  var ATLAS_DOCS = [
    {s:'N',m:'',r:'',t:'N 2-6-0 Mogul Steam Locomotive',u:'/PartsPDF/NScale/n260mogul.pdf',st:['2-6-0 Mogul Steam Locomotive']},
    {s:'N',m:'',r:'',t:'N 4-4-0 Steam Locomotive',u:'/PartsPDF/NScale/n440loco.pdf',st:['4-4-0 Locomotive']},
    {s:'N',m:'840b|dash840b',r:'',t:'N DASH 8-40B Loco',u:'/PartsPDF/NScale/NDASH840B-1.pdf'},
    {s:'N',m:'840bw|dash840bw',r:'',t:'N DASH 8-40BW/BHW Loco',u:'/PartsPDF/NScale/NDASH840BWBHWLoco-1.pdf'},
    {s:'N',m:'840c|dash840c',r:'',t:'N DASH 8-40C Loco',u:'/PartsPDF/NScale/NDash840C.pdf'},
    {s:'N',m:'840cw|dash840cw',r:'',t:'N DASH 8-40CW Loco',u:'/PartsPDF/NScale/NDash840CW.pdf'},
    {s:'N',m:'e7a',r:'',t:'N E7A Loco - Austria',u:'/pdf/N%20E7A%20LOCO%20AUSTRIA.pdf'},
    {s:'N',m:'fa1',r:'',t:'N FA-1 Loco - Austria',u:'/pdf/N%20FA-1%20LOCO%20AUSTRIA.pdf'},
    {s:'N',m:'b237',r:'',t:'N B23-7 High Hood Loco',u:'/PartsPDF/NScale/N%20B23-7%20HI-HOOD%20LOCO%20CHINA.pdf'},
    {s:'N',m:'b237',r:'',t:'N B23-7 Chassis',u:'/PartsPDF/NScale/N%20B23-7%20LOCO%20CHASSIS%20CHINA.pdf'},
    {s:'N',m:'b237',r:'',t:'N B23-7 Loco',u:'/PartsPDF/NScale/N%20GE%20B23-7%20DIESEL%20LOCO%20A.pdf'},
    {s:'N',m:'c420',r:'',t:'N C420 Loco',u:'/PartsPDF/NScale/NC420Loco.pdf'},
    {s:'N',m:'c420',r:'',t:'N C420 Ph. 1 Locomotive',u:'/PartsPDF/NScale/NC420Ph1Loco.pdf'},
    {s:'N',m:'c628',r:'',t:'N C628 Loco',u:'/PartsPDF/NScale/NC628Loco.pdf'},
    {s:'N',m:'c630',r:'',t:'N C630 Loco',u:'/PartsPDF/NScale/NC630Loco.pdf'},
    {s:'N',m:'gp7',r:'',t:'N GP-7 Phase 1 Loco',u:'/PartsPDF/NScale/N%20GP-7%20PHASE%201%20LOCO%20CHINA.pdf'},
    {s:'N',m:'gp7',r:'',t:'N GP-7 Phase 2 Loco',u:'/PartsPDF/NScale/N%20GP-7%20PHASE%202%20LOCO.pdf'},
    {s:'N',m:'gp7',r:'',t:'N GP-7 Locomotive - Japan',u:'/pdf/PartsPDFs/NRepairManual/NGP7Locomotive.pdf'},
    {s:'N',m:'gp9|emdgp9',r:'',t:'N EMD GP-9 Loco-Japan',u:'/pdf/N%20EMD%20GP9DIESEL%20LOCO.pdf'},
    {s:'N',m:'gp9|emdgp9',r:'',t:'N EMD GP-9 Phase 2',u:'/PartsPDF/NScale/N%20EMD%20GP9%20PH%202%20DIESEL%20LOCO.pdf'},
    {s:'N',m:'gp9|emdgp9',r:'',t:'N EMD GP-9 Torpedo Tube Locomotive',u:'/PartsPDF/NScale/NGP9TTLoco.pdf'},
    {s:'N',m:'gp151',r:'',t:'N Trainman® GP15-1 Locomotive',u:'/PartsPDF/NScale/NTMGP15Loco.pdf'},
    {s:'N',m:'gp30',r:'',t:'N GP-30 Loco - Japan',u:'/pdf/N%20GP-30%20LOCO%20JAPAN.pdf'},
    {s:'N',m:'gp30',r:'',t:'N GP-30 Loco',u:'/PartsPDF/NScale/NGP30Loco.pdf'},
    {s:'N',m:'gp35',r:'',t:'N GP-35 Loco',u:'/PartsPDF/NScale/NGP35Loco.pdf'},
    {s:'N',m:'gp35',r:'',t:'N GP-35 Loco - Classic',u:'/PartsPDF/NScale/N%20GP-35%20CLASSIC%20DIESEL%20LOCO.pdf'},
    {s:'N',m:'gp35',r:'',t:'N GP-35 Loco-Japan',u:'/pdf/N%20EMD%20GP35%20DIESEL%20LOCO.pdf'},
    {s:'N',m:'gp38',r:'',t:'N GP-38 Loco',u:'/PartsPDF/NScale/N%20GP-38%20DIESEL%20LOCO%20CHINA.pdf'},
    {s:'N',m:'gp38',r:'',t:'N GP-38 Early Version Loco',u:'/PartsPDF/NScale/NEarlyGP38Loco.pdf'},
    {s:'N',m:'gp38',r:'',t:'N GP-38 High Hood Loco',u:'/PartsPDF/NScale/N%20GP-38%20HI-HOOD%20LOCO%20CHINA.pdf'},
    {s:'N',m:'gp382',r:'',t:'N GP-38-2 Loco',u:'/PartsPDF/NScale/NGP38-2Loco.pdf'},
    {s:'N',m:'gp392',r:'',t:'N GP39-2 Locomotive',u:'/PartsPDF/NScale/NGP39-2Diagram.pdf'},
    {s:'N',m:'gp40',r:'',t:'N GP-40 Loco',u:'/PartsPDF/NScale/N%20GP-40%20LOCO.pdf'},
    {s:'N',m:'gp402|gp402w',r:'',t:'N GP-40-2 Loco',u:'/PartsPDF/NScale/N%20EMD%20GP-40-2%20LOCO.pdf'},
    {s:'N',m:'h15|1644|h1644',r:'',t:'N H15/16-44 Loco',u:'/PartsPDF/NScale/NH1516Loco.pdf'},
    {s:'N',m:'h15|1644|h1644',r:'',t:'N H15/16-44 Loco (2022)',u:'/PartsPDF/NScale/NH1544Loco2025.pdf'},
    {s:'N',m:'mp15dc',r:'',t:'N MP15DC Loco',u:'/PartsPDF/NScale/NMP15DCLoco.pdf'},
    {s:'N',m:'rs1',r:'',t:'N RS-1 Loco-China',u:'/PartsPDF/NScale/N%20RS-1%20DIESEL%20LOCO%20CHINA.pdf'},
    {s:'N',m:'rs1',r:'',t:'N RS-1 Loco-Japan',u:'/pdf/N%20ALCO%20RS1%20DIESEL%20LOCO.pdf'},
    {s:'N',m:'rs3',r:'',t:'N RS-3 Loco-China',u:'/PartsPDF/NScale/N%20RS-3%20DIESEL%20LOCO%20CHINA.pdf'},
    {s:'N',m:'rs3',r:'',t:'N RS-3 Loco-Japan',u:'/pdf/N%20ALCO%20RS3%20DIESEL%20LOCO.pdf'},
    {s:'N',m:'rsd4',r:'',t:'N RSD-4/5 Loco',u:'/PartsPDF/NScale/N%20RSD-4-5%20DIESEL%20LOCO%20CHINA.pdf'},
    {s:'N',m:'rsd4',r:'',t:'N RSD-4/5 Locomotive - Japan',u:'/pdf/PartsPDFs/NRepairManual/NRSD45Locomotive.pdf'},
    {s:'N',m:'rs11',r:'',t:'N RS-11 Loco-Japan',u:'/pdf/N%20ALCO%20RS11%20DIESEL%20LOCO.pdf'},
    {s:'N',m:'rs11',r:'',t:'N RS-11 Loco',u:'/PartsPDF/NScale/NRS11Loco.pdf'},
    {s:'N',m:'rsd12',r:'',t:'N RSD-12 Loco-Japan',u:'/pdf/N%20ALCO%20RSD12%20DIESEL%20LOCO.pdf'},
    {s:'N',m:'s2',r:'',t:'N S-2 Locomotive (Gold)',u:'/PartsPDF/NScale/NS2Locomotive-1.pdf'},
    {s:'N',m:'sd7',r:'',t:'N SD-7 Loco',u:'/PartsPDF/NScale/NSD7Loco.pdf'},
    {s:'N',m:'sd9',r:'',t:'N SD-9 Loco',u:'/PartsPDF/NScale/NSD9Loco.pdf'},
    {s:'N',m:'sd7|sd9',r:'',t:'N SD-7/9 Locomotive - Japan',u:'/pdf/PartsPDFs/NRepairManual/NSD79Locomotive.pdf'},
    {s:'N',m:'sd24',r:'',t:'N SD-24 Loco',u:'/PartsPDF/NScale/NSD24Loco.pdf'},
    {s:'N',m:'sd26',r:'',t:'N SD-26 Loco',u:'/PartsPDF/NScale/NSD26Loco.pdf'},
    {s:'N',m:'sd35|emdsd35',r:'',t:'N EMD SD-35 Loco',u:'/PartsPDF/NScale/N%20EMD%20SD35%20DIESEL%20LOCO%20A.pdf'},
    {s:'N',m:'sd35|emdsd35',r:'',t:'N EMD SD-35 (2018)',u:'/PartsPDF/NScale/Atlas%20N%20SD35%202018-1.pdf'},
    {s:'N',m:'sd45',r:'',t:'N SD45 Locomotive',u:'/PartsPDF/NScale/NSD45Locomotive.pdf'},
    {s:'N',m:'sd50',r:'',t:'N SD-50 Loco',u:'/PartsPDF/NScale/N%20SD-50%20DIESEL%20LOCO%20CHINA.pdf'},
    {s:'N',m:'sd60',r:'',t:'N SD-60 Loco',u:'/PartsPDF/NScale/N%20SD-60%20DIESEL%20LOCO%20CHINA.pdf'},
    {s:'N',m:'sd60e',r:'',t:'N SD-60E Loco',u:'/PartsPDF/NScale/SD60E%20Diagram.pdf'},
    {s:'N',m:'sd60m|emdsd60m',r:'',t:'N EMD SD60M',u:'/PartsPDF/NScale/N%20EMD%20SD60M%20DIESEL%20LOCO.pdf'},
    {s:'N',m:'u23b',r:'',t:'N U23B Loco',u:'/PartsPDF/NScale/NU23BLoco.pdf'},
    {s:'N',m:'u25b',r:'',t:'N U25B Loco',u:'/PartsPDF/NScale/N%20GE%20U25B%20DIESEL%20LOCO.pdf'},
    {s:'N',m:'u25b',r:'',t:'N U25B Loco-Japan',u:'/pdf/N%20GE%20U25B%20Loco-Japan.pdf'},
    {s:'N',m:'vo1000',r:'',t:'N VO-1000 Locomotive',u:'/PartsPDF/NScale/NVO1000.pdf'},
    {s:'N',m:'',r:'',t:'N 2-Bay Centerflow Hopper',u:'/PartsPDF/NScale/NACF2BayCenterFlow.pdf',st:['2-Bay Centerflow Hopper','2-Bay Centerflow Hoppers']},
    {s:'N',m:'',r:'',t:'N 4-Bay Centerflow Hopper',u:'/pdf/NFreightCarPDF/NACF4BayCentFlowHop.pdf',st:['4-Bay 5250 Centerflow Hopper']},
    {s:'N',m:'',r:'',t:'N 40\' Airslide Hopper',u:'/pdf/NFreightCarPDF/Ngatx40airslide.pdf',st:['40\' Airslide Hopper']},
    {s:'N',m:'',r:'',t:'N 40\' Plug Door Box Car',u:'/PartsPDF/NScale/N40ft%20PlugDoorBoxCar.pdf',st:['40\' Plug Door Box Car','40\' Plug Door Box Cars']},
    {s:'N',m:'',r:'',t:'N 40\' PS-1 Box Car',u:'/PartsPDF/NScale/N40ft%20PS-1BoxCar.pdf',st:['40\' PS-1 Box Car']},
    {s:'N',m:'',r:'',t:'N 40\' Stock Car',u:'/PartsPDF/NScale/N40ft%20StockCar.pdf',st:['40\' Stock Car']},
    {s:'N',m:'',r:'',t:'N 40\' Wood Reefer',u:'/PartsPDF/NScale/N40ft%20WoodReefer.pdf',st:['40\' Wood Reefer']},
    {s:'N',m:'',r:'',t:'N 42\' Gondola with Containers',u:'/pdf/NFreightCarPDF/N42%27GONDOLAwCONTAINERS.pdf',st:['42\' Gondola']},
    {s:'N',m:'',r:'',t:'N 45\' Pines Trailer',u:'/pdf/NFreightCarPDF/N45ft%20Pines%20Trailer.pdf'},
    {s:'N',m:'',r:'',t:'N 50\' FGE Box Car',u:'/PartsPDF/NScale/NFGE%2050ft%20Box%20Car.pdf',st:['Fruit Growers Express Box Car']},
    {s:'N',m:'',r:'',t:'N 50\' Flat Car with Stakes',u:'/pdf/NFreightCarPDF/Flat%20w%20Stakes.pdf',st:['50\' Flat Car w/Stakes']},
    {s:'N',m:'',r:'',t:'N 50\' Flat Car with Trailer',u:'/pdf/NFreightCarPDF/Flat%20%20Car%20w%20Trailer.pdf',st:['50\' Flat Car w/40\' Trailer']},
    {s:'N',m:'',r:'',t:'N 50\' Flat Car with Two Trailers',u:'/PartsPDF/NScale/Piggy%20Back%20Flat%20w%20Trailers.pdf',st:['50\' Flat Car w/ Two Trailers']},
    {s:'N',m:'',r:'',t:'N 50\' Mechanical Reefer',u:'/PartsPDF/NScale/N50ftMechReefer.pdf',st:['50\' Mechanical Reefer']},
    {s:'N',m:'',r:'',t:'N 50\' Precision Design Box Car',u:'/PartsPDF/NScale/NACF50PrecisionBoxCar-Online.pdf',st:['50\' ACF® Precision Design Box Car']},
    {s:'N',m:'',r:'',t:'N 50\' Stock Car',u:'/pdf/NFreightCarPDF/N50ft%20StockCar.pdf',st:['50\' Stock Car']},
    {s:'N',m:'',r:'',t:'N 50\' Staggered Double Door Box Car',u:'/PartsPDF/NScale/N50ft%20STAG%20DD%20BOX%20Car.pdf'},
    {s:'N',m:'',r:'',t:'N 55 Ton Fishbelly Hopper - Flat Ends',u:'/PartsPDF/NScale/55TonFishbellyHopper_Flat.pdf',st:['55 Ton Fishbelly Hopper']},
    {s:'N',m:'',r:'',t:'N 55 Ton Fishbelly Hopper - Peaked Ends',u:'/PartsPDF/NScale/55TonFishbellyHopper_Peaked.pdf',st:['55 Ton Fishbelly Hopper']},
    {s:'N',m:'',r:'',t:'N 60\' Double Door Auto Parts Box Car',u:'/PartsPDF/NScale/N60ft%20ACF%20DD%20Auto%20Parts%20Car.pdf',st:['60\' Auto Parts Box Car']},
    {s:'N',m:'',r:'',t:'N 60\' Single Door Auto Parts Box Car',u:'/PartsPDF/NScale/N60ft%20ACF%20SD%20Auto%20Parts%20Car.pdf',st:['60\' Auto Parts Box Car']},
    {s:'N',m:'',r:'',t:'N 70 Ton Ore Ca',u:'/PartsPDF/NScale/NOreCarWithLoad.pdf',st:['70 Ton Ore Car']},
    {s:'N',m:'',r:'',t:'N 90 Ton Hopper',u:'/PartsPDF/NScale/90%20ton%20hopper.pdf',st:['90 Ton Hopper','90 Ton Hoppers']},
    {s:'N',m:'',r:'',t:'N 11,000 Gallon Tank Car',u:'/PartsPDF/NScale/N11000GalTank.pdf',st:['11,000 Gallon Tank Car']},
    {s:'N',m:'',r:'',t:'N 17,360 Gallon Tank Car',u:'/PartsPDF/NScale/N17360GalTank.pdf',st:['17,360 Gallon Tank Car']},
    {s:'N',m:'',r:'',t:'N 23, 500 Gallon Tank Car',u:'/PartsPDF/NScale/N23500GalTank.pdf',st:['23,500 Gallon Tank Car']},
    {s:'N',m:'',r:'',t:'N 33,000 Gallon Tank Car',u:'/pdf/NFreightCarPDF/NACF33000GalTankCar.pdf',st:['33,000 Gallon Tank Car']},
    {s:'N',m:'',r:'',t:'N PS-2 Covered Hopper',u:'/PartsPDF/NScale/N-PS-2%202%20Bay%20Cvd%20Hop.pdf',st:['PS-2 Hopper']},
    {s:'N',m:'f150|fordf150',r:'',t:'N Ford® F-150 Pickup Trucks',u:'/pdf/NFreightCarPDF/NFORDF150_2Versions.pdf'},
    {s:'HO',m:'aem7|alp44',r:'',t:'HO AEM-7/ALP-44 Loco',u:'/PartsPDF/HOScale/HO%20AEM-7%20ELECTRIC%20LOCO%201.pdf'},
    {s:'HO',m:'aem7|alp44',r:'',t:'HO AEM-7/ALP-44 Loco',u:'/PartsPDF/HOScale/AEM7Diagrams.pdf'},
    {s:'HO',m:'alp45dp',r:'',t:'HO ALP45DP Loco',u:'/PartsPDF/HOScale/HOalp45dp.pdf'},
    {s:'HO',m:'b237',r:'',t:'HO B23-7 Locomotive - Silver',u:'/PartsPDF/HOScale/HOB23SilverLoco.pdf'},
    {s:'HO',m:'b237',r:'',t:'HO B23-7 Locomotive - Gold',u:'/PartsPDF/HOScale/HOB23GoldLoco.pdf'},
    {s:'HO',m:'b237|307|c307',r:'',t:'HO B23-7/30-7 Locomotive - Analog',u:'/PartsPDF/HOScale/HOB237307LocoAnalog.pdf'},
    {s:'HO',m:'c307',r:'',t:'HO C30-7 Locomotive',u:'/PartsPDF/HOScale/HOC30-7Locomotive.pdf'},
    {s:'HO',m:'c420',r:'',t:'HO C420 Phase 1 Locomotive - Silver',u:'/PartsPDF/HOScale/HOC420SilverLocomotive.pdf'},
    {s:'HO',m:'c420',r:'',t:'HO C420 Phase 1 Locomotive - Gold',u:'/PartsPDF/HOScale/HOC420GoldLocomotive.pdf'},
    {s:'HO',m:'c420',r:'',t:'HO C420 Phase 1 High Nose Locomotive - Silver',u:'/PartsPDF/HOScale/HOC420Ph1SilverLocomotive.pdf'},
    {s:'HO',m:'c420',r:'',t:'HO C420 Phase 1 High Nose Locomotive - Gold',u:'/PartsPDF/HOScale/HOC420Ph1GoldLocomotive.pdf'},
    {s:'HO',m:'c424|425',r:'',t:'HO C424/425 Loco',u:'/pdf/HO%20C-424-425%20LOCOS%20JAPAN.pdf'},
    {s:'HO',m:'c424|425',r:'',t:'HO C424/425 Locomotive',u:'/PartsPDF/HOScale/HOC424425Locomotive.pdf'},
    {s:'HO',m:'c424|425',r:'',t:'HO C424/425 Locomotive',u:'/PartsPDF/HOScale/HOC424425LocomotiveGold.pdf'},
    {s:'HO',m:'c424|425',r:'',t:'HO C424/425 Locomotive (Japan)',u:'/pdf/PartsPDFs/HORepairManual/HOC424425Locomotive.pdf'},
    {s:'HO',m:'c425',r:'',t:'HO C425 Locomotive',u:'/PartsPDF/HOScale/HOC425Locomotive.pdf'},
    {s:'HO',m:'840bw|dash840bw',r:'',t:'HO DASH 8-40BW Loco',u:'/PartsPDF/HOScale/HODASH840BW.pdf'},
    {s:'HO',m:'840b|dash840b',r:'',t:'HO DASH 8-40B Locomotive',u:'/PartsPDF/HOScale/HO%20DASH8%20DIESEL%20LOCO%20CHINA1.pdf'},
    {s:'HO',m:'840c|dash840c',r:'',t:'HO DASH 8-40C Locomotive - Silver',u:'/PartsPDF/HOScale/HODash8Silver.pdf'},
    {s:'HO',m:'840c|dash840c',r:'',t:'HO DASH 8-40C Locomotive - Gold',u:'/PartsPDF/HOScale/HODash8Gold.pdf'},
    {s:'HO',m:'840c|dash840c',r:'',t:'HO DASH 8-40C Locomotive - Gold (ESU)',u:'/PartsPDF/HOScale/HODASH840CESU.pdf'},
    {s:'HO',m:'840cw|dash840cw',r:'',t:'HO DASH 8-40CW Locomotive - Silver',u:'/PartsPDF/HOScale/HODash840CWSilverLocomotive.pdf'},
    {s:'HO',m:'840cw|dash840cw',r:'',t:'HO DASH 8-40CW Locomotive - Gold',u:'/PartsPDF/HOScale/HODash840CWGoldLocomotive.pdf'},
    {s:'HO',m:'fp7',r:'',t:'HO FP-7 Loco',u:'/pdf/HO%20FP-7%20LOCOS%20AUSTRIA.pdf'},
    {s:'HO',m:'fp7',r:'',t:'HO FP-7 Truck Assembly',u:'/pdf/HO%20FP-7%20TRUCK%20ASS.%20AUSTRIA.pdf'},
    {s:'HO',m:'u23b|geu23b',r:'',t:'HO GE U23B Loco',u:'/PartsPDF/HOScale/HO%20GE%20U23B%20DIESEL%20LOCO%201.pdf'},
    {s:'HO',m:'gp7',r:'',t:'HO GP-7 Locomotive',u:'/PartsPDF/HOScale/HOGP7Locomotive.pdf'},
    {s:'HO',m:'gp7',r:'',t:'HO GP-7 Locomotive',u:'/PartsPDF/HOScale/HO_GP-7.pdf'},
    {s:'HO',m:'gp7',r:'',t:'HO GP-7 Locomotive (Japan)',u:'/pdf/PartsPDFs/HORepairManual/HOGP7Locomotive.pdf'},
    {s:'HO',m:'gp38',r:'',t:'HO GP-38 Early Version Loco',u:'/PartsPDF/HOScale/HO%20EARLY%20GP-38%20LOCO%201.pdf'},
    {s:'HO',m:'gp382',r:'',t:'HO Trainman® GP38-2 Locomotive',u:'/PartsPDF/HOScale/HOTMGP38-2Locomotive.pdf'},
    {s:'HO',m:'gp392',r:'',t:'HO Trainman® GP39-2 Phase 1 Locomotive',u:'/PartsPDF/HOScale/HOTMGP39-2.pdf'},
    {s:'HO',m:'gp392',r:'',t:'HO Trainman® GP39-2 Locomotive',u:'/PartsPDF/HOScale/HOGP39-2.pdf'},
    {s:'HO',m:'gp38',r:'',t:'HO GP-38 (2017) Silver Page 2',u:'/PartsPDF/HOScale/HO_GP-38_Analog_2017_P2.pdf'},
    {s:'HO',m:'gp38',r:'',t:'HO GP-38 (2017) Gold Page 2',u:'/PartsPDF/HOScale/HO_GP-38_Sound_2017_P2.pdf'},
    {s:'HO',m:'gp38|40',r:'',t:'HO GP-38/40 Loco A-Roco',u:'/pdf/HO%20EMD%20GP38-40%20LOCO%20A.pdf'},
    {s:'HO',m:'gp38|40',r:'',t:'HO GP-38/40 Loco B-Roco',u:'/pdf/HO%20EMD%20GP38-40%20LOCO%20b.pdf'},
    {s:'HO',m:'gp38|40',r:'',t:'HO GP-38/40 Brush Replacement',u:'/pdf/HO%20GP-38-40%20BRUSH%20REPLACE.pdf'},
    {s:'HO',m:'gp38|40',r:'',t:'HO GP-38/40 Truck Assembly',u:'/pdf/HO%20GP-38-40%20TRUCK%20ASSEMBLY.pdf'},
    {s:'HO',m:'gp38|40',r:'',t:'HO GP-38/40 Loco (Old Version)',u:'/pdf/PartsPDFs/HOGP3840old.pdf'},
    {s:'HO',m:'gp40',r:'',t:'HO GP-40 (2017) Silver',u:'/PartsPDF/HOScale/HO_GP-40_Analog_2017.pdf'},
    {s:'HO',m:'gp40',r:'',t:'HO GP-40 (2017) Gold',u:'/PartsPDF/HOScale/HO_GP-40_Sound_2017.pdf'},
    {s:'HO',m:'gp40',r:'',t:'HO GP-40 High Nose (2017) Silver',u:'/PartsPDF/HOScale/HO_GP-40_HiNose%20Analog_2017.pdf'},
    {s:'HO',m:'gp40',r:'',t:'HO GP-40 High Nose (2017) Gold',u:'/PartsPDF/HOScale/HO_GP-40_HiNose_Sound_2017.pdf'},
    {s:'HO',m:'gp40',r:'',t:'HO GP-40 High Hood Loco',u:'/PartsPDF/HOScale/HO%20GP-40%20HI-HOOD%20LOCO%20CHINA.pdf'},
    {s:'HO',m:'gp402',r:'',t:'HO GP40-2 Locomotive (ESU Sound)',u:'/PartsPDF/HOScale/HOGP40-2ESU.pdf'},
    {s:'HO',m:'gp402',r:'',t:'HO GP40-2 Phase 1 Locomotive - Silver',u:'/PartsPDF/HOScale/HOGP40-2Silver.pdf'},
    {s:'HO',m:'gp402',r:'',t:'HO GP40-2 Phase 1 Locomotive - Gold',u:'/PartsPDF/HOScale/HOGP40-2Gold.pdf'},
    {s:'HO',m:'gp402',r:'',t:'HO GP40-2 Phase 2 Locomotive',u:'/PartsPDF/HOScale/HO_GP40-2_Phase_2_Page_1.pdf'},
    {s:'HO',m:'gp402w',r:'',t:'HO GP40-2W Locomotive',u:'/PartsPDF/HOScale/HOGP40-2WLocomotive.pdf'},
    {s:'HO',m:'h15|1644|h1644',r:'',t:'HO H15/16-44 Locomotive',u:'/PartsPDF/HOScale/HOH15-44Locomotive.pdf'},
    {s:'HO',m:'h15|1644|h1644',r:'',t:'HO H15/16-44 Locomotive (New Version)',u:'/PartsPDF/HOScale/HOH15-44Locomotive2018.pdf'},
    {s:'HO',m:'hh600|660|hh660',r:'',t:'HO HH600/660 Locomotive',u:'/PartsPDF/HOScale/HOHH600.pdf'},
    {s:'HO',m:'mp15dc',r:'',t:'HO MP15DC Locomotive - Silver',u:'/PartsPDF/HOScale/HOMP15DCLocomotive.pdf'},
    {s:'HO',m:'mp15dc',r:'',t:'HO MP15DC Locomotive - Gold',u:'/PartsPDF/HOScale/HOMP15DCGoldLocomotive.pdf'},
    {s:'HO',m:'rs1',r:'',t:'HO RS-1 Loco',u:'/PartsPDF/HOScale/HO%20ALCO%20RS1%20LOCO.pdf'},
    {s:'HO',m:'rs1',r:'',t:'HO RS-1 Loco (Gold)',u:'/PartsPDF/HOScale/HORS-1.pdf'},
    {s:'HO',m:'rs1',r:'',t:'HO RS-1 Locomotive (Japan)',u:'/pdf/PartsPDFs/HORepairManual/HORS1Locomotive.pdf'},
    {s:'HO',m:'rs3',r:'',t:'HO RS-3 Loco',u:'/PartsPDF/HOScale/HO%20RS-3%20DIESEL%20LOCO.pdf'},
    {s:'HO',m:'rs3',r:'',t:'HO RS-3 Locomotive (Japan)',u:'/pdf/PartsPDFs/HORepairManual/HORS3Locomotive.pdf'},
    {s:'HO',m:'rs11',r:'',t:'HO RS-11 Locomotive (2016 and later)',u:'/PartsPDF/HOScale/HORS11Locomotive.pdf'},
    {s:'HO',m:'rs11',r:'',t:'HO RS-11 Locomotive',u:'/PartsPDF/HOScale/HORS-11Locomotive.pdf'},
    {s:'HO',m:'rs11',r:'',t:'HO RS-11 Locomotive (Japan)',u:'/pdf/PartsPDFs/HORepairManual/HORS11Locomotive.pdf'},
    {s:'HO',m:'rsd4|rsd12',r:'',t:'HO RSD-4/5 & RSD-12 Locomotives (Japan)',u:'/pdf/PartsPDFs/HORepairManual/HORSD4512Locomotive.pdf'},
    {s:'HO',m:'rs32|36|rs36',r:'',t:'HO Trainman® RS32/36 Locomotives',u:'/PartsPDF/HOScale/HORS32.pdf'},
    {s:'HO',m:'s1|s3',r:'',t:'HO S-1/S-3 Locomotive',u:'/PartsPDF/HOScale/HOS1S3Locomotive.pdf'},
    {s:'HO',m:'s2',r:'',t:'HO S-2 Locomotive',u:'/PartsPDF/HOScale/HOS2Locomotive.pdf'},
    {s:'HO',m:'s2|s4',r:'',t:'HO S-2/S-4 Loco',u:'/PartsPDF/HOScale/S4%20SWITCHER.pdf'},
    {s:'HO',m:'sd24',r:'',t:'HO SD-24 Analog',u:'/PartsPDF/HOScale/HO%20SD24%20Analog%20final-Model.pdf'},
    {s:'HO',m:'sd24',r:'',t:'HO SD-24 w/Sound',u:'/PartsPDF/HOScale/HO%20SD24%20Soundfinal-Model.pdf'},
    {s:'HO',m:'sd26',r:'',t:'HO SD-26 Analog',u:'/PartsPDF/HOScale/HO%20SD26%20Analogffinal-Model.pdf'},
    {s:'HO',m:'sd26',r:'',t:'HO SD-26 w/Sound',u:'/PartsPDF/HOScale/HO%20SD26%20Sound1%20final-Model.pdf'},
    {s:'HO',m:'sd2435',r:'',t:'HO SD-24-35 Loco A-Roco',u:'/pdf/HO%20EMD%20SD24-35%20LOCO%20A.pdf'},
    {s:'HO',m:'sd2435',r:'',t:'HO SD-24-35 Loco B-Roco',u:'/pdf/HO%20EMD%20SD24-35%20LOCO%20b.pdf'},
    {s:'HO',m:'sd24|sd35',r:'',t:'HO SD-24 & SD-35 Truck A',u:'/pdf/HO%20SD24%20%26%20SD35%20TRUCK%20A.pdf'},
    {s:'HO',m:'sd24|sd35',r:'',t:'HO SD-24 & SD-35 Truck B',u:'/pdf/HO%20SD24%20%26%20SD35%20TRUCK%20B.pdf'},
    {s:'HO',m:'sd35',r:'',t:'HO SD-35 Locomotive',u:'/PartsPDF/HOScale/HOSD35Locomotive.pdf'},
    {s:'HO',m:'sd35|sdp35',r:'',t:'HO SD-35/SDP-35 Locomotive - Silver',u:'/PartsPDF/HOScale/HOSD35Silver.pdf'},
    {s:'HO',m:'sd35|sdp35',r:'',t:'HO SD-35/SDP-35 Locomotive - Gold',u:'/PartsPDF/HOScale/HOSD35Gold.pdf'},
    {s:'HO',m:'u23b',r:'',t:'HO U23B Locomotive',u:'/PartsPDF/HOScale/HOU23BLocomotive.pdf'},
    {s:'HO',m:'u23b',r:'',t:'HO U23B Shell Removal Instructions',u:'/pdf/Instructions/U23B%20Shell%20Removal%20Instructions.pdf'},
    {s:'HO',m:'u23b|u30b',r:'',t:'HO U23B/U30B Locomotive',u:'/pdf/HOU2330BLoco.pdf'},
    {s:'HO',m:'u30b',r:'',t:'HO U30B Locomotive',u:'/PartsPDF/HOScale/HOU30B.pdf'},
    {s:'HO',m:'u30b|2nd',r:'',t:'HO U30B Locomotive 2nd Version',u:'/PartsPDF/HOScale/HOU30B2.pdf'},
    {s:'HO',m:'u30c',r:'',t:'HO U30C Locomotive Phase 3',u:'/PartsPDF/HOScale/HOU30C.pdf'},
    {s:'HO',m:'u30c',r:'',t:'HO U30C Dual-Model Decoder Settings',u:'/pdf/PartsPDFs/HOU30CDMD.pdf'},
    {s:'HO',m:'u33b|36b|u36b',r:'',t:'HO U33B/36B Locomotive Part 1',u:'/pdf/HO%20U33-36B%20Page%201.pdf'},
    {s:'HO',m:'u33b|36b|u36b',r:'',t:'HO U33B/36B Locomotive Part 2',u:'/pdf/HO%20U33-36B%20Page%202.pdf'},
    {s:'HO',m:'u33c|u36c',r:'',t:'HO U33C/U36C Locomotive',u:'/pdf/PartsPDFs/HOU33C.pdf'},
    {s:'HO',m:'',r:'',t:'HO 4650 Centerflow Hopper',u:'/PartsPDF/HOScale/HO4650Centerflow.pdf',st:['4650 3-Bay Centerflow Hopper']},
    {s:'O',m:'aem7|alp44',r:'',t:'O AEM-7 / ALP-44 Electric Locomotive Body',u:'/PartsPDF/OScale/oAe7Body.pdf'},
    {s:'O',m:'aem7|alp44',r:'3',t:'O AEM-7 / ALP-44 Electric Locomotive (3-Rail)',u:'/PartsPDF/OScale/oAEM73ra.pdf'},
    {s:'O',m:'aem7|alp44',r:'2',t:'O AEM-7 / ALP-44 Electric Locomotive (2-Rail)',u:'/PartsPDF/OScale/oAEM72ra.pdf'},
    {s:'O',m:'c628',r:'3',t:'O C628 Locomotive Body (3-Rail)',u:'/PartsPDF/OScale/C%20628%20body%203%20rail%20complete.pdf'},
    {s:'O',m:'c628',r:'3',t:'O C628 Locomotive Chassis (3-Rail)',u:'/PartsPDF/OScale/C%20628%203rail%20chassis%20complete.pdf'},
    {s:'O',m:'c628',r:'3',t:'O C628 Trucks (3-Rail)',u:'/PartsPDF/OScale/C%20628%20truck%203%20rail%20complete.pdf'},
    {s:'O',m:'c628',r:'2',t:'O C628 Locomotive Body (2-Rail)',u:'/PartsPDF/OScale/C%20628%20body%202%20rail%20complete.pdf'},
    {s:'O',m:'c628',r:'2',t:'O C628 Locomotive Chassis (2-Rail)',u:'/PartsPDF/OScale/C%20628%202%20rail%20chassis%20complete.pdf'},
    {s:'O',m:'c628',r:'2',t:'O C628 Trucks (2-Rail)',u:'/PartsPDF/OScale/C%20628%202%20rail%20truck%20complete.pdf'},
    {s:'O',m:'c630',r:'3',t:'O C630 Locomotive Body (3-Rail)',u:'/PartsPDF/OScale/C%20630%20body%203%20rail%20complete.pdf'},
    {s:'O',m:'c630',r:'3',t:'O C630 Locomotive Chassis (3-Rail)',u:'/PartsPDF/OScale/C%20630%20chassis%203%20rail%20complete.pdf'},
    {s:'O',m:'c630',r:'3',t:'O C630 Trucks (3-Rail)',u:'/PartsPDF/OScale/C%20630%203rail%20truck%20complete.pdf'},
    {s:'O',m:'c630',r:'2',t:'O C630 Locomotive Body (2-Rail)',u:'/PartsPDF/OScale/C%20630%202%20body%20rail%20complete.pdf'},
    {s:'O',m:'c630',r:'2',t:'O C630 Locomotive Chassis (2-Rail)',u:'/PartsPDF/OScale/C%20630%20chassis%202%20rail%20complete.pdf'},
    {s:'O',m:'c630',r:'2',t:'O C630 Trucks (2-Rail)',u:'/PartsPDF/OScale/C%20630%202%20rail%20truck%20complete.pdf'},
    // v0.9.1744: on Atlas's page since at least 2026-09-14, missing from the v1643 harvest
    {s:'O',m:'eriebuilt|fmerie|erieblt',r:'3',t:'O FM Erie Built Locomotive Body (3-Rail)',u:'/PartsPDF/OScale/FM%20Erie%20Blt.%20A%20body%203%20rail%20complete.pdf'},
    {s:'O',m:'eriebuilt|fmerie|erieblt',r:'3',t:'O FM Erie Built Locomotive Chassis (3-Rail)',u:'/PartsPDF/OScale/FM%20Erie%20Blt%20A%203%20rail%20chassis%20complete.pdf'},
    {s:'O',m:'eriebuilt|fmerie|erieblt',r:'3',t:'O FM Erie Built Locomotive Trucks (3-Rail)',u:'/PartsPDF/OScale/FM%20Erie%20Blt%20A%203%20rail%20truck%20complete.pdf'},
    {s:'O',m:'eriebuilt|fmerie|erieblt',r:'2',t:'O FM Erie Built Locomotive Body (2-Rail)',u:'/PartsPDF/OScale/FM%20Erie%20Blt%20A%20body%202%20rail%20complete.pdf'},
    {s:'O',m:'eriebuilt|fmerie|erieblt',r:'2',t:'O FM Erie Built Locomotive Chassis (2-Rail)',u:'/PartsPDF/OScale/FM%20Erie%20Blt%20a%20chassis%202%20rail%20complete.pdf'},
    {s:'O',m:'eriebuilt|fmerie|erieblt',r:'2',t:'O FM Erie Built Locomotive Trucks (2-Rail)',u:'/PartsPDF/OScale/FM%20Erie%20Blt.%20A%20truck%202%20rail%20complete.pdf'},
    {s:'O',m:'gp7',r:'3',t:'O GP-7 Locomotive Body (3-Rail)',u:'/PartsPDF/OScale/O_GP-7_3rail_Body.pdf'},
    {s:'O',m:'gp7',r:'3',t:'O GP-7 Locomotive Chassis (3-Rail)',u:'/PartsPDF/OScale/O_GP-7_3rail_Chassis.pdf'},
    {s:'O',m:'gp7',r:'3',t:'O GP-7 Locomotive Trucks (3-Rail)',u:'/PartsPDF/OScale/O_GP-7_3rail_Trucks.pdf'},
    {s:'O',m:'gp7',r:'2',t:'O GP-7 Locomotive Body (2-Rail)',u:'/PartsPDF/OScale/O_GP-7_2rail_Body.pdf'},
    {s:'O',m:'gp7',r:'2',t:'O GP-7 Locomotive Chassis (2-Rail)',u:'/PartsPDF/OScale/O_GP-7_2rail_Chassis.pdf'},
    {s:'O',m:'gp7',r:'2',t:'O GP-7 Locomotive Trucks (2-Rail)',u:'/PartsPDF/OScale/O_GP-7_2rail_Trucks.pdf'},
    {s:'O',m:'gp9',r:'3',t:'O GP-9 Locomotive Body (3-Rail)',u:'/PartsPDF/OScale/GP%209%203rail%20body%20complete.pdf'},
    {s:'O',m:'gp9',r:'3',t:'O GP-9 Locomotive Chassis (3-Rail)',u:'/PartsPDF/OScale/GP%209%203rail%20chassis%20complete.pdf'},
    {s:'O',m:'gp9',r:'3',t:'O GP-9 Trucks (3-Rail)',u:'/PartsPDF/OScale/GP%209%203%20rail%20truck%20complete.pdf'},
    {s:'O',m:'gp9',r:'2',t:'O GP-9 Locomotive Body (2-Rail)',u:'/PartsPDF/OScale/GP 9 body 2 rail complete.pdf'},
    {s:'O',m:'gp9',r:'2',t:'O GP-9 Locomotive Chassis (2-Rail)',u:'/PartsPDF/OScale/GP%209%20chassis%202%20rail%20complete.pdf'},
    {s:'O',m:'gp9',r:'2',t:'O GP-9 Trucks (2-Rail)',u:'/PartsPDF/OScale/GP%209%20truck%202%20rail%20complete.pdf'},
    {s:'O',m:'gp35',r:'3',t:'O GP-35 Locomotive Body (3-Rail)',u:'/PartsPDF/OScale/GP%2035%20body%203%20rail%20complete.pdf'},
    {s:'O',m:'gp35',r:'3',t:'O GP-35 Locomotive Chassis (3-Rail)',u:'/PartsPDF/OScale/GP%2035%20chassis%203%20rail%20complete.pdf'},
    {s:'O',m:'gp35',r:'3',t:'O GP-35 Locomotive Trucks (3-Rail)',u:'/PartsPDF/OScale/GP%2035%203%20rail%20truck%20complete.pdf'},
    {s:'O',m:'gp35',r:'2',t:'O GP-35 Locomotive Body (2-Rail)',u:'/PartsPDF/OScale/GP%2035%20body%202%20rail%20complete.pdf'},
    {s:'O',m:'gp35',r:'2',t:'O GP-35 Locomotive Chassis (2-Rail)',u:'/PartsPDF/OScale/GP%2035%20chassis%202%20rail%20complete.pdf'},
    {s:'O',m:'gp35',r:'2',t:'O GP-35 Locomotive Trucks (2-Rail)',u:'/PartsPDF/OScale/GP%2035%202%20rail%20truck%20complete.pdf'},
    {s:'O',m:'gp60',r:'3',t:'O GP60 Locomotive Body (3-Rail)',u:'/PartsPDF/OScale/GP%2060%203%20rail%20body%20complete.pdf'},
    {s:'O',m:'gp60',r:'3',t:'O GP60 Locomotive Chassis (3-Rail)',u:'/PartsPDF/OScale/GP%2060%203%20rail%20chassis%20complete.pdf'},
    {s:'O',m:'gp60',r:'3',t:'O GP60 Trucks (3-Rail)',u:'/PartsPDF/OScale/GP%2060%203rail%20truck%20complete.pdf'},
    {s:'O',m:'gp60',r:'2',t:'O GP60 Locomotive Body (2-Rail)',u:'/PartsPDF/OScale/GP%2060%202%20rail%20body%20complete.pdf'},
    {s:'O',m:'gp60',r:'2',t:'O GP60 Locomotive Chassis (2-Rail)',u:'/PartsPDF/OScale/GP%2060%20Chassis%202%20rail%20complete.pdf'},
    {s:'O',m:'gp60',r:'2',t:'O GP60 Trucks (2-Rail)',u:'/PartsPDF/OScale/GP%2060%20truck%202%20rail%20complete.pdf'},
    {s:'O',m:'gp60b',r:'3',t:'O GP60B Locomotive Body (3-Rail)',u:'/PartsPDF/OScale/Gp%2060%20B%20body%203%20rail%20complete.pdf'},
    {s:'O',m:'gp60b',r:'3',t:'O GP60B Locomotive Chassis (3-Rail)',u:'/PartsPDF/OScale/GP%2060%20B%20chassis%203%20rail%20complete.pdf'},
    {s:'O',m:'gp60b',r:'3',t:'O GP60B Trucks (3-Rail)',u:'/PartsPDF/OScale/GP%2060%20B%20truck%203%20rail%20complete.pdf'},
    {s:'O',m:'gp60b',r:'2',t:'O GP60B Locomotive Body (2-Rail)',u:'/PartsPDF/OScale/GP%2060%20B%202%20rail%20body%20complete.pdf'},
    {s:'O',m:'gp60b',r:'2',t:'O GP60B Locomotive Chassis (2-Rail)',u:'/PartsPDF/OScale/GP%2060%20B%20chassis%202%20rail%20complete.pdf'},
    {s:'O',m:'gp60b',r:'2',t:'O GP60B Trucks (2-Rail)',u:'/PartsPDF/OScale/GP%2060%20%20B%20truck%202%20rail%20complete.pdf'},
    {s:'O',m:'rs1',r:'3',t:'O RS-1 Locomotive (3-Rail)',u:'/PartsPDF/OScale/O_RS1_3_Rail.pdf'},
    {s:'O',m:'rs1',r:'2',t:'O RS-1 Locomotive (2-Rail)',u:'/PartsPDF/OScale/O_RS1_2_Rail.pdf'},
    {s:'O',m:'sd40',r:'3',t:'O SD40 Locomotive Body (3-Rail)',u:'/PartsPDF/OScale/SD%2040%203%20rail%20body.pdf'},
    {s:'O',m:'sd40',r:'3',t:'O SD40 Locomotive Chassis (3-Rail)',u:'/PartsPDF/OScale/sd%2040%203%20rail%20chassis.pdf'},
    {s:'O',m:'sd40',r:'3',t:'O SD40 Trucks (3-Rail)',u:'/PartsPDF/OScale/SD%2040_3rail_Truck.pdf'},
    {s:'O',m:'sd40',r:'2',t:'O SD40 Locomotive Body (2-Rail)',u:'/PartsPDF/OScale/SD%2040%202%20rail%20body.pdf'},
    {s:'O',m:'sd40',r:'2',t:'O SD40 Locomotive Chassis (2-Rail)',u:'/PartsPDF/OScale/SD%2040%202%20rail%20chassis%20complete.pdf'},
    {s:'O',m:'sd40',r:'2',t:'O SD40 Trucks (2-Rail)',u:'/PartsPDF/OScale/SD%2040%202%20rail%20truck%20complete.pdf'},
    {s:'O',m:'',r:'3',t:'O 3-Bay Cylindrical Hopper (3-Rail)',u:'/PartsPDF/OScale/O_3BayCylinHopper_3rail.pdf',st:['3-Bay Cylindrical Hopper','3 & 6 Bay Cylindrical Hoppers']},
    {s:'O',m:'',r:'2',t:'O 3-Bay Cylindrical Hopper (2-Rail)',u:'/PartsPDF/OScale/O_3BayCylinHopper_2rail.pdf',st:['3-Bay Cylindrical Hopper','3 & 6 Bay Cylindrical Hoppers']},
    {s:'O',m:'',r:'3',t:'O 33,000 Gallon Tank Car (3-Rail)',u:'/PartsPDF/OScale/ACF_33kgal_tankcar_3rail.pdf',st:['33000 Gallon Tank Car']},
    {s:'O',m:'',r:'2',t:'O 33,000 Gallon Tank Car (2-Rail)',u:'/PartsPDF/OScale/ACF_33kgal_tankcar_2rail.pdf',st:['33000 Gallon Tank Car']},
    {s:'O',m:'',r:'3',t:'O 40\' Wood Reefer (3-Rail)',u:'/PartsPDF/OScale/O_woodside_reefer_3_rail.pdf'},
    {s:'O',m:'',r:'2',t:'O 40\' Wood Reefer (2-Rail)',u:'/PartsPDF/OScale/O_woodside_reefer_2_rail.pdf'},
    {s:'O',m:'',r:'',t:'O 50\' PS-1 Box Car Cushion Underframe',u:'/PartsPDF/OScale/o_ps1-50ft%20cushion_boxcar.pdf',st:['50\' PS-1 Single Door & Double Door Box Cars','50\' PS-1 Double Door Box Cars','50\' PS-1 Plug Door Box Car','Modernized 50\' PS-1 Plug Door Box Car w/o Roofwalks']},
    {s:'O',m:'',r:'',t:'O 50\' PS-1 Box Car Standard',u:'/PartsPDF/OScale/o_ps1-50ft%20standard_boxcar.pdf',st:['50\' PS-1 Single Door & Double Door Box Cars','50\' PS-1 Double Door Box Cars','50\' PS-1 Plug Door Box Car','Modernized 50\' PS-1 Plug Door Box Car w/o Roofwalks']},
    {s:'O',m:'',r:'3',t:'O 50 Ton War Hopper (3-Rail)',u:'/PartsPDF/OScale/O_50ton_War_Hopper_3Rail.pdf',st:['50 Ton War Emergency Hopper','50 Ton War Rebuilt Emergency Hopper w/Steel Sides']},
    {s:'O',m:'',r:'2',t:'O 50 Ton War Hopper (2-Rail)',u:'/PartsPDF/OScale/O_50ton_War_Hopper_2Rail%20[Converted].ai.pdf',st:['50 Ton War Emergency Hopper','50 Ton War Rebuilt Emergency Hopper w/Steel Sides']},
    {s:'O',m:'',r:'3',t:'O 6-Bay Cylindrical Hopper (3-Rail)',u:'/PartsPDF/OScale/O_6BayCylinHopper_3rail.pdf',st:['6-Bay Cylindrical Hopper','3 & 6 Bay Cylindrical Hoppers']},
    {s:'O',m:'',r:'2',t:'O 6-Bay Cylindrical Hopper (2-Rail)',u:'/PartsPDF/OScale/O_6BayCylinHopper_2rail.pdf',st:['6-Bay Cylindrical Hopper','3 & 6 Bay Cylindrical Hoppers']},
    {s:'O',m:'',r:'',t:'O 60\' Auto Parts Box Car Single Door',u:'/PartsPDF/OScale/o_60ft_singledoor_autopartscar.pdf'},
    {s:'O',m:'',r:'',t:'O 60\' Auto Parts Box Car Double Door',u:'/PartsPDF/OScale/o_60ft_doubledoor_autopartscar.pdf'},
    {s:'O',m:'',r:'3',t:'O 89\' 4" Flat Car (3-Rail)',u:'/PartsPDF/OScale/o_89ft_4in_flatcar_3rail.pdf',st:['89ft Flatcar']},
    {s:'O',m:'',r:'2',t:'O 89\' 4" Flat Car (2-Rail)',u:'/PartsPDF/OScale/o_89ft_4in_flatcar_2rail.pdf',st:['89ft Flatcar']},
    {s:'O',m:'',r:'3',t:'O Trinity 5161 - Round Hatches (3-Rail)',u:'/PartsPDF/OScale/O_Trinity_5161_Round%20Hatches%203%20Rail.pdf',st:['5161 Covered Hopper']},
    {s:'O',m:'',r:'2',t:'O Trinity 5161 - Round Hatches (2-Rail)',u:'/PartsPDF/OScale/O_Trinity_5161_Round%20Hatches.pdf',st:['5161 Covered Hopper']},
    {s:'O',m:'',r:'3',t:'O Trinity 5161 - Trough Hatches (3-Rail)',u:'/PartsPDF/OScale/O_Trinity_5161%20Trough%20Hatches%203%20Rail.pdf',st:['5161 Covered Hopper']},
    {s:'O',m:'',r:'2',t:'O Trinity 5161 - Trough Hatches (2-Rail)',u:'/PartsPDF/OScale/O_Trinity_5161%20Trough%20Hatches.pdf',st:['5161 Covered Hopper']},
    {s:'O',m:'gp15',r:'3',t:'O TM GP15 Locomotive (3-Rail)',u:'/PartsPDF/OScale/gp-15_trainman_3rail.pdf'},
    {s:'O',m:'gp15',r:'2',t:'O TM GP15 Locomotive (2-Rail)',u:'/PartsPDF/OScale/GP-152-rail.pdf'},
    {s:'O',m:'rsd4',r:'3',t:'O TM RSD-4/5 Locomotive (3-Rail)',u:'/PartsPDF/OScale/rsd-4_5_3rail.pdf'},
    {s:'O',m:'rsd4',r:'2',t:'O TM RSD-4/5 Locomotive (2-Rail)',u:'/PartsPDF/OScale/rsd-4_5_2rail.pdf'},
    {s:'O',m:'u23b',r:'3',t:'O TM U23B Locomotive (3-Rail)',u:'/PartsPDF/OScale/Trainman_U23B_3Rail.pdf'},
    {s:'O',m:'u23b',r:'2',t:'O TM U23B Locomotive (2-Rail)',u:'/PartsPDF/OScale/Trainman_U23B_2%20Rail.pdf'},
    {s:'O',m:'',r:'2',t:'O TM 40\' Plug Door Box Car (2-Rail)',u:'/PartsPDF/OScale/trainman_40_ft_plugdoor_2rail.pdf',st:['Trainman® 40\' Plug Door Box Car']},
    {s:'O',m:'',r:'3',t:'O TM 40\' Plug Door Box Car (3-Rail)',u:'/PartsPDF/OScale/trainman_40_ft_plugdoor_3rail.pdf',st:['Trainman® 40\' Plug Door Box Car']},
    {s:'O',m:'',r:'2',t:'O TM 40\' Sliding Door Box Car (2-Rail)',u:'/PartsPDF/OScale/trainman_40_ft_singledoor_boxcar_2rail.pdf',st:['Trainman® 40\' Sliding Door Box Car']},
    {s:'O',m:'',r:'3',t:'O TM 40\' Sliding Door Box Car (3-Rail)',u:'/PartsPDF/OScale/trainman_40_ft_singledoor_boxcar_3rail.pdf',st:['Trainman® 40\' Sliding Door Box Car']},
    {s:'O',m:'',r:'2',t:'O TM 40\' Stock Car (2-Rail)',u:'/PartsPDF/OScale/trainman_40_ft_stockcar_2rail.pdf',st:['Trainman® 40\' Stock Car']},
    {s:'O',m:'',r:'3',t:'O TM 40\' Stock Car (3-Rail)',u:'/PartsPDF/OScale/trainman_40_ft_stockcar_3rail.pdf',st:['Trainman® 40\' Stock Car']},
    {s:'O',m:'',r:'2',t:'O TM 52\' Gondola (2-Rail)',u:'/OPartsPDF/RollingStock/trainman_Gondola_2rail.pdf',st:['Trainman® 52\'6" Gondola']},
    {s:'O',m:'',r:'3',t:'O TM 52\' Gondola (3-Rail)',u:'/OPartsPDF/RollingStock/trainman_Gondola_3rail.pdf',st:['Trainman® 52\'6" Gondola']}
  ];

  function atlasScale(eraKey) {
    return eraKey === 'atlas' ? 'O' : eraKey === 'atlas_ho' ? 'HO' : eraKey === 'atlas_n' ? 'N' : eraKey === 'atlas_z' ? 'Z' : null;
  }
  function _sq(s) { return String(s == null ? '' : s).toLowerCase().replace(/[®™]/g, '').replace(/[^a-z0-9]/g, ''); }

  // Every matching sheet for an item, best first; null when Atlas has none.
  function atlasDiagramsFor(item, eraKey) {
    var sc = atlasScale(eraKey);
    if (!sc || !item) return null;
    var hits = [];
    // 1 · freight cars (and anything else carrying st): exact Sub Type
    var sub = _sq(item.subType);
    if (sub) {
      ATLAS_DOCS.forEach(function (e) {
        if (e.s === sc && e.st && e.st.some(function (x) { return _sq(x) === sub; })) hits.push(e);
      });
    }
    // 2 · model keys, each starting a word
    if (!hits.length) {
      var text = String((item.subType || '') + ' ' + (item.description || '') + ' ' + (item.itemName || ''))
        .toLowerCase().replace(/[®™]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
      if (!text) return null;
      var sq = '', starts = {}, ends = {};
      for (var i = 0; i < text.length; i++) {
        if (text[i] === ' ') continue;
        if (i === 0 || text[i - 1] === ' ') starts[sq.length] = 1;
        sq += text[i];
        if (i === text.length - 1 || text[i + 1] === ' ') ends[sq.length] = 1;
      }
      var occ = [];   // {e, a, b} = entry e matched text sq[a..b)
      ATLAS_DOCS.forEach(function (e) {
        if (e.s !== sc || !e.m || e.st) return;
        e.m.split('|').forEach(function (k) {
          if (!k || (!/[a-z]/.test(k) && k.length < 4)) return;
          var from = 0, p;
          while ((p = sq.indexOf(k, from)) >= 0) { if (starts[p] && ends[p + k.length]) occ.push({ e: e, a: p, b: p + k.length }); from = p + 1; }
        });
      });
      occ.forEach(function (o) {
        var inside = occ.some(function (q) { return q !== o && q.a <= o.a && q.b >= o.b && (q.b - q.a) > (o.b - o.a); });
        if (!inside && hits.indexOf(o.e) < 0) hits.push(o.e);
      });
      hits.sort(function (x, y) { return ATLAS_DOCS.indexOf(x) - ATLAS_DOCS.indexOf(y); });
    }
    if (!hits.length) return null;
    // 3 · O scale: the item's own rail
    if (hits.some(function (e) { return e.r; })) {
      var tp = String(item.trackPower || '');
      var want = /2[\s-]*rail/i.test(tp) ? '2' : '3';
      if (!hits.some(function (e) { return e.r === want; })) want = want === '2' ? '3' : '2';
      hits = hits.filter(function (e) { return !e.r || e.r === want; });
    }
    return hits;
  }

  // The locomotive families Atlas HAS published for a scale — for the
  // no-match line, so the reader knows what is there without a trip.
  function atlasFamilies(sc) {
    var seen = {}, out = [];
    ATLAS_DOCS.forEach(function (e) {
      if (e.s !== sc || !/\b(loco|locomotive)\b/i.test(e.t)) return;
      var f = e.t.replace(/^(HO|N|O|Z) (TM |Trainman® )?/, '').replace(/ (Locomotive|Loco)\b.*$/, '').replace(/ - .*$/, '').trim();
      if (f && !seen[f]) { seen[f] = 1; out.push(f); }
    });
    return out;
  }

  // For the parts lookup (app-data.js _partsForItem): the parts lists an item
  // uses, in the same shape the "Parts Lists" column gives an MTH item —
  // [{ maker, ids }]. Atlas's list ids are the diagram PDF paths.
  function atlasItemPartsLists(item, eraKey) {
    var d = atlasDiagramsFor(item, eraKey);
    return d ? [{ maker: 'Atlas', ids: d.map(function (e) { return e.u; }) }] : [];
  }

  window.ATLAS_DL = ATLAS_DL;
  window.ATLAS_PAGE = ATLAS_PAGE;
  window.ATLAS_DOCS = ATLAS_DOCS;
  window.atlasScale = atlasScale;
  window.atlasDiagramsFor = atlasDiagramsFor;
  window.atlasFamilies = atlasFamilies;
  window.atlasItemPartsLists = atlasItemPartsLists;
  window.ITEM_PARTS_LIST_SOURCES = (window.ITEM_PARTS_LIST_SOURCES || []).concat([atlasItemPartsLists]);
})();
