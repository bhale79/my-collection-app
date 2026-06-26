// cott-anchors.js  —  Deep-link Cornucopia Of Toy Trains (COTT) reference links
// straight to the specific item on the page, instead of the page top.
//
// HOW IT WORKS
//   Every COTT page anchors its items with <PAGE-PREFIX><itemNumber>, where the
//   item number has dashes/spaces removed and the prefix is SPECIFIC to that page
//   (e.g. the flatcars page uses "FLAT" -> #FLAT6825; the 6464 boxcar pages use a
//   bare number -> #646425; the F-3 page uses "F3" -> #F32343). The prefix is not
//   derivable from item type, so it was captured by scraping all 144 live COTT
//   pages (June 2026). "" means a number-only page.
//
//   SAFE BY DESIGN: if a page is not in the map, or the constructed anchor does
//   not exist on the page, the browser simply lands at the top of the (correct)
//   page -- exactly today's behavior. So this only ever improves a link, never
//   breaks one.
(function(){
  var PREFIX = {
    "boxcars-6464-page-1-a": "",
    "boxcars-6464-page-2a": "",
    "boxcars-6464-type-a": "6464T",
    "boxcars-9-1-4-inch-with-operating-doors": "BO",
    "boxcars-automobile-double-door-a": "ABOX",
    "boxcars-other-large-boxcars-a": "OLB",
    "boxcars-small-with-non-operating-doors": "SDBX",
    "boxcars-space-and-military-a": "SAM",
    "bulbs-dealer-display-assortments": "DLRBULB",
    "bulbs-master-cartons": "BMC",
    "bulbs-replacement-page-1": "BULB",
    "bulbs-replacement-page-2": "BULB2",
    "cabooses-bay-window-a": "BWC",
    "cabooses-later-work-cabooses-a": "LWC",
    "cabooses-metal-center-cab-cobooses-a": "MCC",
    "cabooses-plastic-center-cupola-cabooses-a": "PCC",
    "cabooses-sp-type-page-1-a": "SPC",
    "cabooses-sp-type-page-2-a": "SP",
    "construction-sets": "CON",
    "dealer-displays-a": "DD",
    "flatcars-10-inch-type-page-1-a": "FLATS1",
    "flatcars-10-inch-type-page-2-a": "FLATS",
    "flatcars-10-inch-type-page-3-a": "FLAT",
    "flatcars-diecast-4-truck-depressed-center": "FDPC4",
    "flatcars-diecast-depressed-center-with-two-trucks": "FDPC2",
    "flatcars-search-light-cars": "SCH",
    "flatcars-sheet-metal-flatcars": "SMF",
    "flatcars-small-diecast-flatcars": "DF",
    "flatcars-space-and-military-page-2": "SMF",
    "gondolas-large-non-operating-a": "NOLG",
    "gondolas-large-operating-gondolas-a": "LGON",
    "gondolas-small-gondols-a": "SG",
    "hoppers-quad-a": "QH",
    "hoppers-small-two-bay-a": "SH",
    "lionel-miscellaneous": "MIS",
    "lionel-nabisco-shreaded-wheat-train-o-rama-1956": "TO",
    "motive-power-44-ton-switchers": "44T",
    "motive-power-early-alcos-a": "EALCO",
    "motive-power-ep-5s-virginian-rectifiers": "EP5",
    "motive-power-f-3s-a": "F3",
    "motive-power-f-3s-with-single-motor-a": "MU",
    "motive-power-fairbanks-morse-fms-a": "FM",
    "motive-power-gg-1-electrics-a": "GG1",
    "motive-power-gp-7-gp-9-a": "GP",
    "motive-power-later-alcos-a": "ESW",
    "motive-power-later-alcos-a-2": "LAL",
    "motive-power-later-switchers-a": "LSW",
    "packets-engines-rolling-stock": "EPAK",
    "packets-miscellaneous": "PM",
    "passenger-extruded-aluminum-passenger-cars": "OPAS",
    "passenger-general-type-passenger-cars": "GPC",
    "passenger-madison-cars": "MAD",
    "passenger-small-metal-passenger-cars-a": "SMP",
    "passenger-small-plastic-passenger-cars-a": "PC",
    "postwar-accessories-no-0-thru-no-99": "ACC",
    "postwar-accessories-no-200-thru-no-299": "ACC",
    "postwar-accessories-no-400-thru-no-499": "ACC",
    "postwar-accessories-no-900-thru-no-ltc": "ACC",
    "postwar-early-work-cabooses": "EWC",
    "postwar-space-military-flatcars": "MILFLAT",
    "pw-flatcars-page-2": "FLAT",
    "pw-small-flatcars-type-mold-1877-3": "SFTS",
    "separate-sale-items": "SSI",
    "service-station-tools": "STA",
    "steam-200-type-2-4-2": "S",
    "steam-general-type-locomotives": "GE",
    "steam-the-birkshires-2-8-4": "BERK",
    "steam-the-small-hudsons": "SH",
    "steamers-1000-series-2-4-2-2-4-0": "S",
    "steamers-no-746-no-773": "S",
    "steamers-switchers-no-1656-0-4-0": "SS",
    "tank-cars-single-dome-metal": "TCSD",
    "tank-cars-single-dome-plastic": "TCSDP",
    "tank-cars-small-single-dome-plastic": "SSDC",
    "tank-cars-tripple-dome-plastic": "TDT",
    "tank-cars-two-dome-plastic": "2DTC",
    "tank-cars-vat-cars": "TCV",
    "track-super-o": "SO",
    "transformers": "TRANS",
  };
  // Return refLink with a #item-anchor appended, or refLink unchanged if we
  // can't/ shouldn't. itemNum is the catalog number (dashes ok).
  window.cottAnchorUrl = function(refLink, itemNum){
    try{
      if(!refLink) return refLink || '';
      if(refLink.indexOf('#') >= 0) return refLink;            // already anchored
      var m = refLink.match(/cornucopiaoftoytrains\.com\/([^\/#?]+)/i);
      if(!m) return refLink;                                   // not a COTT link
      var slug = m[1].toLowerCase();
      if(!Object.prototype.hasOwnProperty.call(PREFIX, slug)) return refLink;
      var norm = String(itemNum == null ? '' : itemNum).toUpperCase().replace(/[^A-Z0-9]/g, '');
      if(!norm) return refLink;
      var base = refLink.replace(/[#?].*$/, '').replace(/\/+$/, '');
      return base + '/#' + PREFIX[slug] + norm;
    }catch(e){ return refLink || ''; }
  };
  window.COTT_PAGE_PREFIX = PREFIX;
})();
