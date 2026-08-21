// ══════════════════════════════════════════════════════════════
//  help-guides.js — step-by-step written guides (v0.9.14xx)
//
//  Brad: "we need to do the step by step instructions, like we did
//  for the photo inbox, for adding an item, adding something to the
//  want list, adding a part to the want list, buying a part and
//  installing that part on another item, adding to the sale list,
//  report a sale, add to the contact list, how to research an item,
//  how to find things you may want by searching the master catalog."
//
//  SELF-CONTAINED FEATURE (same rule as dispatch-board.js): this file
//  is the ENTIRE feature. Delete the one script line in index.html and
//  the guides disappear with no other edits.
//
//  TWO DESIGN DECISIONS, both Brad's:
//  1. BRANCHING. "Can we have the user select which one they are
//     doing, so it pulls up the correct set of instructions." A guide
//     with `paths` opens on a chooser and then shows ONLY that path.
//     Nobody reads about mock-ups while entering a boxcar.
//  2. NO ICONS. Plain text headings throughout.
//
//  Content is DATA (RRG) and the shell is ONE renderer — a tenth
//  guide is a data entry, not another copy of the modal code.
// ══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // A real-looking button, so the guide shows what to LOOK for.
  function chip(text, kind) {
    var c = {
      primary: 'background:var(--accent,#e8401c);color:#fff;border:1px solid var(--accent,#e8401c)',
      gold:    'background:rgba(212,168,67,0.16);color:var(--gold,#d4a843);border:1px solid rgba(212,168,67,0.55)',
      green:   'background:rgba(46,204,113,0.14);color:#2ecc71;border:1px solid rgba(46,204,113,0.5)',
      blue:    'background:rgba(41,128,185,0.14);color:#2980b9;border:1px solid rgba(41,128,185,0.5)',
      ghost:   'background:var(--surface2,#242440);color:var(--text,#eee);border:1px solid var(--border,#444)'
    }[kind || 'ghost'];
    return '<span style="display:inline-block;' + c + ';border-radius:7px;padding:0.1rem 0.5rem;'
      + 'font-size:0.95em;font-weight:700;white-space:nowrap;line-height:1.5">' + esc(text) + '</span>';
  }
  function callout(label, body, colour) {
    var col = colour || '#d4a843';
    return '<div style="border-left:3px solid ' + col + ';background:rgba(255,255,255,0.03);'
      + 'border-radius:0 9px 9px 0;padding:0.7rem 0.9rem;margin:0.9rem 0">'
      + '<div style="font-size:0.95rem;font-weight:700;color:' + col + ';margin-bottom:0.2rem">' + esc(label) + '</div>'
      + '<div style="font-size:1.08rem;color:var(--text-mid,#ccc);line-height:1.6">' + body + '</div></div>';
  }

  // ── The guides. Content only. ────────────────────────────────
  // { title, blurb, intro, steps[], notes[] }              — linear
  // { title, blurb, intro, choose, paths[] }               — branching
  // step = { do, why }   note = [label, body]
  var RRG = {

    addItem: {
      title: 'Adding an item to your collection',
      blurb: 'Six kinds of item, each with its own path.',
      intro: 'First decide what kind of item you are entering. Each one asks its own set of questions, so picking the right type up front saves you answering things that do not apply.',
      choose: 'Tap the type you are adding:',
      paths: [
        { id: 'cat', label: 'Cataloged item',
          desc: 'Items the manufacturers put in their catalogs. They have an item number, and hopefully I have them covered — or will soon — in the Master List.',
          steps: [
            { do: 'Dashboard → ' + chip('Add to My Collection', 'primary') + ', or ' + chip('+ Add') + ' on any page. Leave <b>Item Type</b> on <i>Cataloged Item</i>.',
              why: 'This is the path most of your collection will take.' },
            { do: 'Type the number stamped on the item — 2343, 6464-25, 736.',
              why: 'This one field does the heavy lifting: road name, year and what the catalogue says it should look like all come from it.' },
            { do: 'If several items share that number, pick yours on <b>Select an item</b>.',
              why: 'Lionel reused numbers across eras. The list shows enough to tell them apart.' },
            { do: 'If the number heads a dashed family — 6464 has dozens — the app lists the relatives with reference links.',
              why: 'The dash number is on the BOX, not the car, so the app will not guess it. Open a link, compare the picture, pick yours.' },
            { do: 'Choose the variation on <b>Which variation is it?</b> (skipped when there is only one).',
              why: 'On postwar items this is where the value lives — a colour or lettering style separates common from rare.' },
            { do: 'If the number is an engine, buttons appear for what you actually have: ' + chip('Engine Only') + ' ' + chip('Engine + Tender') + ' — or for a diesel A unit, ' + chip('A Powered') + ' ' + chip('A Dummy') + ' ' + chip('AA set') + ' ' + chip('AB set') + ' ' + chip('ABA set') + '.',
              why: 'This is the biggest fork in the flow. It decides how many items get saved and which photo steps you are asked for — an AA saves as two linked items, an ABA as three.' },
            { do: '<b>Engine + Tender</b> adds tender photo steps and a <i>Photo of engine and tender together</i>. <b>AA</b> or <b>AB</b> add a second unit; <b>ABA</b> adds a third.',
              why: 'Each unit gets its own photos and its own box question, because each is its own record. The together shot becomes the group\'s cover picture.' },
            { do: 'On <b>Condition &amp; Details</b>, answer the five toggles — each one changes what you are asked next.',
              why: 'They are not decoration: ' + chip('Has Box') + ' Yes brings up box condition and box photos, ' + chip('Instr. Sheet') + ' Yes adds instruction-sheet photos, ' + chip('Master Box') + ' Yes adds master-box photos, ' + chip('Error Item') + ' Yes adds close-ups of the error, and ' + chip('All Original') + ' No opens a box to say what was changed.' },
            { do: 'Fill in <b>Purchase &amp; Value</b>.',
              why: 'Rough answers are fine. Condition is 1–10 and editable later; price paid can stay blank.' },
            { do: 'Add photos, or press Next to skip.',
              why: 'They can be added later from the item\'s own page. Do not let a missing camera stop you finishing the entry.' },
            { do: 'Check the summary and save.',
              why: 'That is the moment it reaches your Google Sheet. The toast confirms it.' }
          ],
          notes: [['Box but no train?', 'Tick <b>Box Only</b> on the Item Number step. The wizard then asks about the box and nothing else.']] },

        { id: 'set', label: 'Lionel Postwar Set',
          desc: 'The numbered sets Lionel cataloged in the postwar period. Modern sets are listed among the regular item numbers.',
          steps: [
            { do: 'Set <b>Item Type</b> to <i>Lionel Postwar Set</i>.',
              why: 'Only postwar has set-composition data, which is why this path exists on its own.' },
            { do: 'Answer <b>Do you know the set number?</b> — ' + chip('Yes') + ' or ' + chip('No') + '.',
              why: 'The set number is on the box, not on the trains. Most people opening a box know it; most people who inherited a shelf of trains do not. Both answers work.' },
            { do: '<b>Yes</b> → <b>Enter the set number</b> (1467W, 2190W).',
              why: 'The fastest route. The app already knows which engine and cars belong to that set.' },
            { do: '<b>No</b> → <b>What is the locomotive item number?</b> — the number on the engine itself (736, 2383P, 2023).',
              why: 'The engine is the fingerprint. Only a handful of sets were built around any one locomotive, so naming it narrows the field to a short list.' },
            { do: 'On <b>Identify your set</b>, pick yours from the candidates and confirm the cars.',
              why: 'Both routes meet here. Tick off what you actually have — a set that lost a car over sixty years is still that set, and the app records what is present.' },
            { do: 'On the <b>Set details</b> screen, enter an Est. Worth and tick the <b>Set Box</b> checkbox if you have the box, then press ' + chip('📋 Add each item →', 'primary') + '.',
              why: 'That checkbox IS the box question — tick it and you get set-box condition and photo steps later; leave it and both are skipped. Est. Worth is required here, so the wizard will not move on without it.' },
            { do: 'Walk each item in turn — every car gets its own condition, value and photos.',
              why: 'Sets are always entered item by item, so a car that was swapped over the years is recorded as what it actually is rather than what the catalogue says.' },
            { do: 'Finish the set box steps if you ticked the box, then save.',
              why: 'The set box is its own record. A complete set with its original box is a different animal from the pieces alone.' }
          ],
          notes: [['No engine either?', 'If you cannot read the locomotive number, go back and add the pieces as individual cataloged items instead. Nothing is lost — a set can be reconstructed later, but a wrong set number is harder to unpick.']] },

        { id: 'paper', label: 'Paper Item',
          desc: 'Catalogs, instruction sheets, advertisements, books and more.',
          steps: [
            { do: 'Set <b>Item Type</b> to <i>Paper Item</i>.',
              why: 'One door for all paper — catalogs included. There used to be a second, shorter route for catalogs; it asked fewer questions, so it is gone.' },
            { do: 'Pick what it is on <b>What type of paper item is this?</b> — Catalog, Instruction Sheet, Operating Manual, Magazine, Dealer Paper, Dealer Promo Kit, Dealer Display Poster, Reference Book, Promotional Item, Blueprint / Drawing, or Other.',
              why: 'This choice decides everything that follows, and two of them change flow entirely.' },
            { do: '<b>Instruction Sheet</b> switches to its own flow — it asks which item the sheet goes with, and offers to group it with that item if you own it.',
              why: 'A sheet belongs beside its train, not on a pile of paper. Answer ' + chip('Yes') + ' to attach it, ' + chip('No') + ' to keep it standalone.' },
            { do: '<b>Catalog</b>, <b>Magazine</b> and <b>Dealer Paper</b> ask a sub-type next — for a catalog: <i>Consumer Postwar</i>, <i>Consumer Pre-war</i>, <i>Advance/Dealer</i>, <i>Display</i>, <i>Accessory</i>, <i>HO</i>, <i>Science/Other</i>.',
              why: 'Worth doing properly: an Advance/Dealer catalog is a different item from the consumer one of the same year. <b>Other</b> and <b>Blueprint / Drawing</b> skip straight to the title.' },
            { do: 'If a picker appears, find your item in it — or skip it and type the title yourself.',
              why: 'Picking from the list fills in the title and year for you and skips both questions. Skipping means you fill them in by hand.' },
            { do: 'Add condition, value and photos, then save.',
              why: 'Catalogs entered this way land on the Catalogs tab — same destination as the old short route, with the sub-type recorded.' }
          ], notes: [] },

        { id: 'mock', label: 'Mock-Up',
          desc: 'One-offs. I tried to include everything I could think of.',
          steps: [
            { do: 'Set <b>Item Type</b> to <i>Mock-Up</i>.',
              why: 'For prototypes and one-offs that never reached production.' },
            { do: 'Give it a title and, if you know it, the related item number.',
              why: '"2344 Santa Fe prototype" — the number links it to the production item it became.' },
            { do: 'Set the production status: <i>Concept, never produced</i> · <i>Pre-production concept</i> · <i>Produced as shown</i>.',
              why: 'This is the fact that defines a mock-up, so it gets its own question.' },
            { do: 'Add provenance, description, condition and photos, then save.',
              why: 'Provenance matters more here than anywhere else — with a one-off, the story IS the documentation.' }
          ], notes: [] },

        { id: 'other', label: 'Other',
          desc: 'Things that do not fit under toy trains but you want to include — your railroad lanterns, or that Pennsylvania spittoon.',
          steps: [
            { do: 'Set <b>Item Type</b> to <i>Other</i>.',
              why: 'Railroad lanterns, station signs, depot china — part of the collection, not a train.' },
            { do: 'Give it a title and description in your own words.',
              why: 'There is no catalog to check against, so write what you would tell somebody holding it.' },
            { do: 'Add year, condition, value, photos and notes, then save.',
              why: 'Notes are the useful field here. Where it came from and why it matters will not be obvious in ten years.' }
          ], notes: [] },

        { id: 'manual', label: 'Manual',
          desc: 'Items that have a number, but I have not got them into the Master List just yet.',
          steps: [
            { do: 'Set <b>Item Type</b> to <i>Manual — item not in our catalogs</i>.',
              why: 'For a real item with a real number that the Master List has not caught up with.' },
            { do: 'Answer <b>Who made this item?</b> — tap a maker, or type one and press ' + chip('＋ Add & remember', 'blue') + ' so it becomes a button next time.',
              why: 'There is also an Other / Unknown option for when the maker genuinely is not known.' },
            { do: 'Give the item number if you have it, then the type and description.',
              why: 'You are supplying what the catalogue would have — so describe it the way a catalogue would.' },
            { do: 'Answer <b>Does it have the original box?</b> — ' + chip('Yes') + ' adds a box-condition question, ' + chip('No') + ' skips it.',
              why: 'If you already photographed a box label the app knows the answer and does not ask twice.' },
            { do: 'Condition, purchase and value, photos, notes, then save.',
              why: 'It saves exactly like a cataloged item and behaves the same everywhere else in the app.' }
          ],
          notes: [['Tell me what is missing', 'If you entered something manually because the Master List did not have it, send it in with <b>Report a problem</b>. That is how the catalogue grows.']] }
      ]
    },

    addWant: {
      title: 'Adding something to your Want List',
      blurb: 'Track what you are hunting for.',
      intro: 'The Want List is your hunting list — what you are looking for, how badly, and what you are willing to pay. Take it to a train show on your phone instead of a folded piece of paper.',
      choose: 'Two ways in — pick the one you are doing:',
      paths: [
        { id: 'scratch', label: 'I know what I want',
          desc: 'Start from the Dashboard and type the number.',
          steps: [
            { do: 'Dashboard → ' + chip('Add to Want List', 'primary') + ', or ' + chip('+ Add') + ' → Add to Want List.',
              why: 'Same opening steps as adding to your collection, so it will feel familiar.' },
            { do: 'Type the item number and pick the variation. If it is an engine, the same ' + chip('Engine + Tender') + ' / ' + chip('AA set') + ' buttons appear as on the add flow.',
              why: 'Being specific pays off — "6464-475" tells you which Boston &amp; Maine to buy, "6464" does not. Choosing Engine + Tender also asks which tender came with it.' },
            { do: 'Set <b>How high is your priority?</b> — ' + chip('High') + ' ' + chip('Medium') + ' ' + chip('Low') + '.',
              why: 'Sorts the list so what you actually want floats to the top when you are at a table with limited cash.' },
            { do: 'Set <b>Target condition</b> and <b>What do you expect to pay?</b>',
              why: 'These are the numbers that stop an impulse buy. If the tag says double your expected price, you will know at a glance.' },
            { do: 'Confirm on <b>Ready to add to Want List!</b>',
              why: 'It appears under Want with a ' + chip('Want') + ' chip. Upgrades — better copies of things you already own — get their own chip.' }
          ], notes: [] },
        { id: 'browse', label: 'I found it while browsing',
          desc: 'Add it straight from the Master Catalog.',
          steps: [
            { do: 'In the Master Catalog, click the item you want.',
              why: 'Works on anything in the catalogue, owned or not.' },
            { do: 'In the pop-up, press the green ' + chip('+ Want List', 'green') + ' button.',
              why: 'The number and variation come from the row, so there is nothing to retype.' },
            { do: 'Answer priority, target condition and expected price.',
              why: 'It jumps straight to these — the identification is already done.' }
          ],
          notes: [['Already on the list?', 'The button is replaced by <b>✓ On Want List</b>, so you cannot wish for the same thing twice by accident.']] }
      ]
    },

    addPart: {
      title: 'Adding a part to your Parts Needed list',
      blurb: 'Track the pickup roller you keep forgetting.',
      intro: 'Parts Needed is the small-pieces list: a missing pickup roller, a cracked truck side, a coupler that will not stay shut. Keeping it in the app means you can search for it from the table at a show instead of trying to remember which engine it belonged to.',
      steps: [
        { do: 'Open ' + chip('Parts') + ' in the left menu, then press ' + chip('+ Add Part', 'primary') + '.',
          why: 'The badge on that menu item is a running count of what you still need.' },
        { do: 'Fill in <b>Description</b> — the one required field. "Pickup roller assembly", "E-unit drum".',
          why: 'Write it the way you would say it to a parts dealer, because that is exactly what you will do with it later.' },
        { do: 'Add the <b>Part Number</b> if you know it.',
          why: 'Optional, but a real Lionel part number turns a vague search into an exact one.' },
        { do: 'Use <b>For which item?</b> to link the part to something you own — type an item number or a road name to find it.',
          why: 'This is the important one, and it unlocks the ' + chip('✓ Installed', 'green') + ' button later. Leave it on ' + chip('— none —') + ' and the part still saves, but with nowhere to write the history it gets no Installed button at all.' },
        { do: 'Add a <b>Reference Photo</b> and <b>Notes</b> if they help, then press ' + chip('+ Add Part', 'primary') + '.',
          why: 'A photo of the broken piece saves explaining it twice at a swap meet.' }
      ],
      notes: [
        ['Shopping for it', 'Each row has a ' + chip('Google', 'blue') + ' button that searches for the part — anywhere, on eBay, or at one of your preferred vendors from Contacts.'],
        ['Link the item, always', 'It is worth the extra ten seconds. Everything in the next guide depends on it.']
      ]
    },

    installPart: {
      title: 'Buying a part and recording it on the item',
      blurb: 'Keep an honest history of what was replaced.',
      intro: 'When you fit a replacement part the item is no longer all-original — and in five years you will not remember which of your engines got a new motor brush. Recording it takes fifteen seconds and permanently answers the question, on the item itself.',
      steps: [
        { do: 'Find the part on the ' + chip('Parts') + ' page and press ' + chip('Google', 'blue') + ' to go shopping.',
          why: 'On <b>Where do you want to look?</b> you get ' + chip('Any site') + ', ' + chip('eBay') + ', and your own vendors — ones you type in, plus contacts you ticked as preferred vendors. It remembers your last choice.' },
        { do: 'Once the part is fitted, press the green ' + chip('✓ Installed', 'green') + ' button on that row.',
          why: 'This button only appears when the part is linked to an item you own — that link is what tells the app where to write the history.' },
        { do: 'Check the item named at the top of the <b>Mark Part Installed</b> box.',
          why: 'It says plainly which item is about to be changed. Read it before going on.' },
        { do: 'Fill in <b>Price Paid</b>, <b>Vendor</b> and <b>Date Installed</b>.',
          why: 'Vendor is worth doing properly — "eBay seller trainguy52" is what you will want when the next one breaks.' },
        { do: 'Answer <b>Still all original?</b> — ' + chip('No — a part was replaced') + ' is already selected; the alternatives are ' + chip('Yes — this is a correct original part') + ' and ' + chip('Unknown') + '.',
          why: 'This sets the item\'s All Original flag. An honest record protects you when you sell: a buyer who finds an undisclosed replacement stops trusting everything else you said.' },
        { do: 'Press ' + chip('✓ Save to item', 'primary') + '.',
          why: 'A dated line is added to that item\'s notes, the original flag is updated, and the part drops off Parts Needed automatically.' }
      ],
      notes: [
        ['Where it ends up', 'Open the item and look at its Notes — a dated line with the part, the price and the vendor. It travels with the item if you ever sell it.'],
        ['Original parts too', 'If you replaced a part with a correct original, choose ' + chip('Yes — this is a correct original part') + '. The work is still recorded and the item keeps its all-original standing.']
      ]
    },

    forSale: {
      title: 'Putting an item on your For Sale list',
      blurb: 'Price it, list it, share it.',
      intro: 'The For Sale list is your table inventory. It holds the asking price, the condition and the photos in one place — and it can be shared with a customer as a proper list instead of a phone photo of a spreadsheet.',
      choose: 'Where is the item now?',
      paths: [
        { id: 'own', label: 'It is already in my collection',
          desc: 'The quick route — two presses and a price.',
          steps: [
            { do: 'Open the item from your collection and press the orange ' + chip('List for Sale', 'primary') + ' button.',
              why: 'Everything the app already knows comes along. You only supply the price.' },
            { do: 'Set your asking price and the date listed.',
              why: 'The date matters more than it looks — it tells you which pieces have been sitting unsold for a year.' },
            { do: 'Done. The button now reads ' + chip('Remove from For Sale') + '.',
              why: 'The item is flagged in your collection too, so you cannot double-sell it by mistake.' }
          ], notes: [] },
        { id: 'new', label: 'It is not in my collection',
          desc: 'Selling for somebody else, or a piece you never entered.',
          steps: [
            { do: 'Dashboard → ' + chip('Add to For Sale List', 'primary') + ' and enter the item number.',
              why: 'Use this for consignment pieces or anything you never added to your own collection.' },
            { do: 'On <b>Which item are you listing?</b> pick your copy if it is there — the app then jumps straight to the asking price.',
              why: 'Picking a copy you own means condition, box and originality are already on record, so it does not ask again.' },
            { do: 'No copy in the list? Press <b>Not in my collection — enter details manually</b>.',
              why: 'This runs the FULL add-to-collection flow first, then adds the price questions. On save the item lands in both your collection AND your For Sale list — one pass, two records.' },
            { do: 'On that manual route you are asked <b>Does it have the original box?</b> and <b>Is it all original?</b> — ' + chip('Yes') + ' ' + chip('No') + ' ' + chip('Unknown') + '.',
              why: 'These are what serious buyers ask first. Written down, your answer is the same every time you are asked.' },
            { do: 'Set the asking price and date listed, then finish.',
              why: 'It lands on the For Sale page ready to share.' }
          ], notes: [] }
      ]
    },

    recordSale: {
      title: 'Recording a sale',
      blurb: 'What it sold for, and what you made.',
      intro: 'Recording the sale turns the app from a list of things into a record of a hobby. It keeps what you paid beside what you got, so the Reports page can tell you the truth about a year of buying and selling.',
      choose: 'Start from wherever you are:',
      paths: [
        { id: 'listed', label: 'It was on my For Sale list',
          desc: 'The shortest path.',
          steps: [
            { do: 'On the For Sale page, press ' + chip('Mark as Sold', 'primary') + ' on its row.',
              why: 'It already knows the item and the asking price, so it only asks what it actually sold for.' },
            { do: 'Enter the final price and the date.',
              why: 'The asking price and the real price are both kept — the gap between them is worth knowing.' }
          ], notes: [] },
        { id: 'item', label: 'It is in my collection',
          desc: 'Sold without ever listing it.',
          steps: [
            { do: 'Open the item and press the green ' + chip('Record Sale', 'green') + ' button.',
              why: 'For the sale that happens in a car park at a show before you ever listed it.' },
            { do: 'On <b>Which item are you selling?</b> pick your copy.',
              why: 'Picking a copy carries its condition and what you paid straight across, so those two questions are skipped and you land on the sale price.' },
            { do: 'Enter what you sold it for and when, then save.',
              why: 'It moves to the Sold page and leaves your collection count.' }
          ],
          notes: [['Sold part of a set?', 'Group items — an AA pair, an engine and tender — offer ' + chip('Sell from this group') + ' so you can sell one unit without breaking the record of the rest.']] },
        { id: 'scratch', label: 'It was never in the app',
          desc: 'Recording an old sale after the fact.',
          steps: [
            { do: 'Dashboard → ' + chip('Record a Sale', 'primary') + ' and enter the item number.',
              why: 'Useful when catching up records, or for something you bought and flipped quickly.' },
            { do: 'Choose <b>Not in my collection — enter details manually</b>, then give what you sold it for and when.',
              why: 'On this route the condition and original-price questions are skipped — if you want those recorded, add the item to your collection first, then sell it from there.' },
            { do: 'Save on the confirm step.',
              why: 'It appears on the Sold page with everything else.' }
          ], notes: [] }
      ]
    },

    contacts: {
      title: 'Adding someone to your Contacts',
      blurb: 'The dealer with the good parts bin.',
      intro: 'Contacts is the shoebox of business cards, made searchable. The part worth doing properly is marking the good ones as preferred vendors — that puts them into the app\'s own search buttons.',
      choose: 'Do you have their card in hand?',
      paths: [
        { id: 'card', label: 'I have their business card',
          desc: 'Let the app read it.',
          steps: [
            { do: 'Contacts → ' + chip('+ Add Contact', 'primary') + ', then ' + chip('📷 Take photo of card') + ' or ' + chip('🖼 From gallery') + '.',
              why: 'It fills in name, phone and email from the picture.' },
            { do: 'Check what it read before saving.',
              why: 'Cards use strange fonts and the reader is not perfect. Ten seconds of checking beats a wrong phone number.' },
            { do: 'Add the era and <b>Deals in</b> chips, tick <b>Preferred Vendor</b> if they are a good source, then ' + chip('Save Contact', 'primary') + '.',
              why: 'The chips are what make the list searchable later — "who did I meet that handles prewar standard gauge?"' }
          ], notes: [] },
        { id: 'manual', label: 'I am typing it in',
          desc: 'Met at a show, no card.',
          steps: [
            { do: 'Contacts → ' + chip('+ Add Contact', 'primary') + ' and fill in name, business, phone and email.',
              why: 'Only a name is required. A contact with nothing but a name and "met at York" still beats a lost card.' },
            { do: 'Tick the era chips and the <b>Deals in</b> specialties that fit them.',
              why: 'This is what you will search on months later.' },
            { do: 'If they are a good source, tick <b>Preferred Vendor</b>.',
              why: 'Their website joins the search list in the Photo Inbox and on Parts Needed, so you can search THEIR stock in one press.' },
            { do: 'Add <b>Met at</b> and <b>Notes</b>, then save.',
              why: '"York April 2026, blue tent, bin of postwar trucks" is worth more than a job title.' }
          ], notes: [] }
      ]
    },

    research: {
      title: 'Researching an item',
      blurb: 'What is it, and what is it worth?',
      intro: 'Two different questions, two different tools. "What IS this?" is answered by the reference books and links. "What is it WORTH?" is only ever answered by what one actually sold for — never by what somebody is asking.',
      choose: 'Which question are you asking?',
      paths: [
        { id: 'what', label: 'What is this item?',
          desc: 'Identify it and confirm the variation.',
          steps: [
            { do: 'Open the item and scroll to <b>Reference Information</b>, then open the ' + chip('COTT Reference', 'blue') + ' link.',
              why: 'Goes to the reference page for that exact number — photos and variation details from people who have handled hundreds of them.' },
            { do: 'Compare your item against the pictures, paying attention to colour and lettering.',
              why: 'On a dashed family like 6464, the dash number is on the box — the car itself only tells you through its paint and lettering.' },
            { do: 'Not sure what you have at all? Dashboard → ' + chip('Research an Item', 'primary') + ' works from a photo or a number.',
              why: 'The result card offers price checks, eBay, and a one-press ' + chip('➕ Add to My Want List') + '.' }
          ], notes: [] },
        { id: 'worth', label: 'What is it worth?',
          desc: 'Price it from real sales.',
          steps: [
            { do: 'Inside any add or edit flow, press ' + chip('eBay Sold Listings', 'blue') + ' beside the value field.',
              why: 'This is the important one. Active listings show hopes; sold listings show what somebody actually paid.' },
            { do: 'From an item\'s page, press ' + chip('Find on eBay') + ' for the full search box.',
              why: 'Switch between ' + chip('Active Listings') + ' and ' + chip('Sold Listings') + ', filter by condition, set a price range.' },
            { do: 'Compare like for like — condition and box included.',
              why: 'A postwar boxcar in a beaten box and the same car with a crisp box are not the same item at auction.' }
          ],
          notes: [['Variations move the price', 'On a dashed family the dash number can multiply the value. Confirm which one you have on the reference page before pricing it.']] }
      ]
    },

    catalogSearch: {
      title: 'Finding things in the Master Catalog',
      blurb: 'Browse by road name, era or type.',
      intro: 'The Master Catalog is every item the app knows about, not just yours. It is the right place to answer "what else did they make in Great Northern?" — and the fastest way to build a want list that reflects what you actually collect.',
      steps: [
        { do: 'Open ' + chip('Master Catalog') + ' in the left menu.',
          why: 'The count at the right of the filter bar tells you how many items match what you have chosen so far.' },
        { do: 'To browse a road name, type it into the search box — "Great Northern", "Rutland", "C&amp;O".',
          why: 'The search understands abbreviations, so "C&amp;O" finds Chesapeake &amp; Ohio. It looks at item number, road name, description and type at once.' },
        { do: 'Narrow with the filter chips: manufacturer, scale, era and ' + chip('All Types') + '.',
          why: 'Type set to Boxcar plus a road name gives you exactly the boxcars that road ran — a shopping list in two presses.' },
        { do: 'Watch the <b>Owned</b> column as you scroll.',
          why: 'It marks what is already yours, so the gaps in a series are visible at a glance. That is usually where the next purchase comes from.' },
        { do: 'Click any row to open it, then use ' + chip('✓ Yes — Add to Collection', 'primary') + ' or the green ' + chip('+ Want List', 'green') + ' button.',
          why: 'Straight from browsing to owning or wanting, without retyping the number.' },
        { do: 'Press ' + chip('✕') + ' beside <b>Filters</b> to clear everything and start again.',
          why: 'Easy to forget an era filter is on and wonder why a search finds nothing.' }
      ],
      notes: [
        ['Finding a whole series', 'Search a road name with no other filters to see everything in the catalogue for that railroad across every era.'],
        ['If a search finds nothing', 'Check the chips first — an era or scale filter left on from earlier is the usual culprit.']
      ]
    },

    // v0.9.1539 (Brad): "we need to tell people we included it under Lionel."
    // A collector who owns K-Line by Lionel goes looking under K-Line, finds
    // nothing, and concludes the catalogue is missing 300 items. It isn't —
    // they are filed where Lionel itself filed them. Say so plainly, in the
    // place someone goes when a search comes up empty.
    grading: {
      title: 'Condition grading — the C-scale collectors use',
      blurb: 'What C-7 means, and how it lines up with our 1–10.',
      intro: 'Nearly every ad, price guide and show table in this hobby grades condition on the Train Collectors Association scale, written C-1 to C-10. It is worth knowing even if you never use the letters yourself, because the price you see quoted always assumes a grade. Descriptions below are our summary of the TCA standard, not their wording.',
      steps: [
        { do: '<b>C-10 Mint</b> — brand new, all original, never used, not a mark on it.',
          why: 'For most postwar items this also means the original box. A genuinely mint 1950s item is rare, and priced accordingly.' },
        { do: '<b>C-9 Factory New</b> — unused and all original, but may carry factory rubs or the faintest signs of having been handled or test-run.',
          why: 'The difference between C-9 and C-10 is often the box and the paperwork rather than the item.' },
        { do: '<b>C-8 Like New</b> — complete and original, no rust, nothing missing; may show its age or time on display, and may have been run.',
          why: 'This is the top grade most collectors ever apply to a train that has actually been used.' },
        { do: '<b>C-7 Excellent</b> — all original, with only minute scratches and paint nicks; no rust, nothing missing, nothing bent.',
          why: 'C-7 is the workhorse grade in listings. If an ad just says "excellent", this is what is meant.' },
        { do: '<b>C-6 Very Good</b> — minor scratches and nicks, small spots of surface rust, no dents; may have a minor part replaced.',
          why: 'The point where replaced parts start being acceptable without calling it restored.' },
        { do: '<b>C-5 Good</b> — clear play wear: scratches, some paint loss, small dents, minor surface rust.',
          why: 'Good means used, not bad. A great many well-loved postwar trains live here.' },
        { do: '<b>C-4 Fair</b> — scratched, moderate paint loss, dents, missing parts, surface rust.',
          why: 'Still displayable and often still runs, but the value is a fraction of the same item at C-7.' },
        { do: '<b>C-3 Poor</b> — heavily scratched, significant rust, parts missing. A restoration candidate.',
          why: 'Worth buying when the item is scarce enough to justify the work.' },
        { do: '<b>C-2 Restoration required</b> and <b>C-1 Junk</b> — the second is parts value only.',
          why: 'A C-1 is not worthless: somebody else\u2019s C-3 needs exactly the part you are holding.' }
      ],
      notes: [
        ['How this lines up with our 1\u201310',
         'Our slider agrees with TCA at the top and bottom \u2014 10 is Mint, 6 is Very Good \u2014 but through the middle our wording runs about one notch kinder: what we label 8 \u201CExcellent\u201D is closer to TCA\u2019s C-8 Like New, and TCA\u2019s C-7 Excellent sits nearer our 7. If you grade to TCA, set the number to match the TCA grade and ignore our label.'],
        ['Importing a spreadsheet graded in words',
         'Words like Excellent, Like New, Very Good and Fair are read automatically and turned into a number, and you are shown every one of those decisions on a conversion table before anything is written. Change any of them there \u2014 once \u2014 and every item using that word follows.'],
        ['The box is graded separately',
         'You will see grades written like <b>C-8/P-6</b>: the item is C-8, the box (packaging) is P-6. The app keeps item condition and box condition as two separate fields for the same reason.'],
        ['Where this comes from',
         'The Train Collectors Association has published this standard for decades; it is the common language at York and in every price guide. The wording above is ours, summarising theirs.']
      ]
    },

    whereFiled: {
      title: 'Why isn’t my item under the maker I expected?',
      blurb: 'K-Line by Lionel, Williams by Bachmann, and other bought-out brands.',
      intro: 'Toy train companies buy each other. When that happens the new owner usually re-catalogues the old line under its own name and numbering — so the item you know as one brand is listed here under another. We follow the numbering the manufacturer actually used, because that is what is printed in the catalogues, on the boxes, and in the price guides you are checking against.',
      steps: [
        { do: 'Search by <b>item number</b> before you search by maker.',
          why: 'The number is the one thing that does not change hands. Searching "6-21199" finds it whoever owns the name this decade.' },
        { do: 'For <b>K-Line by Lionel</b>, look under <b>Lionel</b> — MPC/Modern era, with a <b>6-</b> in front of the number.',
          why: 'Lionel bought K-Line’s assets in 2006 and re-issued the line under its own catalogue numbers, 2006 through 2009. Your 21199 is our 6-21199. Original K-Line items, made before the buyout, are still under K-Line.' },
        { do: 'For <b>Williams by Bachmann</b>, look under that full name.',
          why: 'Same story: Bachmann bought Williams in 2007 and kept the name on the product line.' },
        { do: 'If you keep your own list, type the maker the way YOU think of it.',
          why: 'Whatever you write on your own items is kept exactly as written, and it becomes one of the choices in your collection’s maker filter — so you can still pull up "my K-Line by Lionel" in one press even though the catalogue files them under Lionel.' }
      ],
      notes: [
        ['Importing a spreadsheet with a K-Line by Lionel tab', 'Those rows match automatically. The import tries your number with Lionel’s 6- prefix, which is how 26 of one tester’s 33 rows found their catalogue entry.'],
        ['Genuinely missing items', 'Some are real gaps — not every K-Line by Lionel item made it into the catalogue yet. If yours has no match it comes in as your own entry, keeping everything you wrote, and nothing is lost when we add it later.']
      ]
    }
  };

  // ── Renderer ─────────────────────────────────────────────────
  function stepsHtml(steps, notes) {
    var h = '';
    (steps || []).forEach(function (s, i) {
      h += '<div style="display:flex;gap:0.75rem;margin-bottom:1.05rem">'
        + '<div style="flex-shrink:0;width:30px;height:30px;border-radius:50%;background:var(--accent,#e8401c);'
        + 'color:#fff;font-weight:700;font-size:1.02rem;display:flex;align-items:center;justify-content:center">' + (i + 1) + '</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:1.14rem;color:var(--text,#eee);line-height:1.6;margin-bottom:0.2rem">' + s.do + '</div>'
        + '<div style="font-size:1.02rem;color:var(--text-dim,#999);line-height:1.55;font-style:italic">' + s.why + '</div>'
        + '</div></div>';
    });
    (notes || []).forEach(function (n) { h += callout(n[0], n[1]); });
    return h;
  }

  // ── v0.9.1457 (Brad): "this page needs to be on the left side of the
  // screen, and be able to drag it." A guide you cannot keep open while you
  // work is only half useful — so this is a FLOATING PANEL, not a modal:
  // no dark backdrop, the app stays clickable behind it, it starts on the
  // left, drags by its header, and remembers where it was put (rr_guides_box).
  // Same shape as the photographing guide, which earned this pattern.
  var BOX_KEY = 'rr_guides_box';
  function savedBox() {
    try { return JSON.parse(localStorage.getItem(BOX_KEY) || 'null'); } catch (e) { return null; }
  }
  function saveBox(l, t) {
    try { localStorage.setItem(BOX_KEY, JSON.stringify({ l: Math.round(l), t: Math.round(t) })); } catch (e) {}
  }

  function shell(titleHtml, bodyHtml, backLabel, backFn) {
    var old = document.getElementById('rrg-modal');
    if (old) old.remove();
    var narrow = (window.innerWidth || 0) < 780;
    var box = savedBox();
    // Default: left side, clear of the sidebar. A saved position wins, but is
    // clamped back on screen in case the window shrank since last time.
    var L = 236, T = 88;
    if (box) {
      L = Math.min(Math.max(0, box.l), Math.max(0, (window.innerWidth || 900) - 260));
      T = Math.min(Math.max(0, box.t), Math.max(0, (window.innerHeight || 700) - 120));
    }
    var p = document.createElement('div');
    p.id = 'rrg-modal';
    p.style.cssText = narrow
      ? 'position:fixed;left:0;right:0;bottom:0;max-height:72vh;overflow-y:auto;z-index:100010;'
        + 'background:var(--surface,#1a1a2e);border-top:2px solid var(--gold,#d4a843);'
        + 'box-shadow:0 -6px 26px rgba(0,0,0,0.5);color:var(--text,#eee);font-family:var(--font-body,sans-serif)'
      : 'position:fixed;left:' + L + 'px;top:' + T + 'px;width:470px;max-height:82vh;overflow-y:auto;'
        + 'z-index:100010;background:var(--surface,#1a1a2e);border:1px solid var(--border,#333);'
        + 'border-radius:14px;box-shadow:0 14px 44px rgba(0,0,0,0.55);color:var(--text,#eee);'
        + 'font-family:var(--font-body,sans-serif)';
    p.innerHTML =
      // Drag handle — the whole header bar, so there is a big target.
      '<div id="rrg-grip" style="' + (narrow ? '' : 'cursor:move;') + 'position:sticky;top:0;z-index:2;'
      + 'background:var(--surface,#1a1a2e);border-bottom:1px solid var(--border,#333);'
      + 'border-radius:14px 14px 0 0;padding:0.85rem 1.1rem 0.7rem;display:flex;align-items:flex-start;gap:0.6rem">'
      +   '<div style="flex:1;min-width:0">' + titleHtml + '</div>'
      +   (narrow ? '' : '<span title="Drag to move" style="flex-shrink:0;color:var(--text-dim,#888);'
            + 'font-size:1.1rem;line-height:1;padding-top:0.15rem">⠿</span>')
      +   '<button id="rrg-x" title="Close" style="flex-shrink:0;background:none;border:none;'
      + 'color:var(--text-dim,#888);font-size:1.4rem;cursor:pointer;line-height:1;padding:0">✕</button>'
      + '</div>'
      + '<div style="padding:1.1rem 1.2rem 1.3rem">' + bodyHtml
      +   '<div style="margin-top:1.3rem;padding-top:0.9rem;border-top:1px solid var(--border,#333);'
      + 'display:flex;gap:0.6rem;flex-wrap:wrap;justify-content:flex-end">'
      +   (backLabel ? '<button id="rrg-back" style="padding:0.6rem 1.1rem;border-radius:9px;'
          + 'border:1px solid var(--border,#444);background:var(--surface2,#242440);color:var(--text,#eee);'
          + 'font-family:inherit;font-size:1rem;font-weight:600;cursor:pointer">' + esc(backLabel) + '</button>' : '')
      +   '<button id="rrg-done" style="padding:0.6rem 1.4rem;border-radius:9px;border:none;'
      + 'background:var(--accent,#e8401c);color:#fff;font-family:inherit;font-size:1rem;font-weight:700;'
      + 'cursor:pointer">Got it</button>'
      +   '</div></div>';
    document.body.appendChild(p);

    var close = function () { p.remove(); };
    document.getElementById('rrg-x').onclick = close;
    document.getElementById('rrg-done').onclick = close;
    var b = document.getElementById('rrg-back');
    if (b) b.onclick = function () { close(); if (backFn) backFn(); };

    // Drag — pointer events so it works with a mouse, a finger or a pen.
    if (!narrow) {
      var grip = document.getElementById('rrg-grip');
      var dx = 0, dy = 0, dragging = false;
      grip.addEventListener('pointerdown', function (e) {
        // Let the close button behave like a button.
        if (e.target && e.target.id === 'rrg-x') return;
        dragging = true;
        var r = p.getBoundingClientRect();
        dx = e.clientX - r.left; dy = e.clientY - r.top;
        try { grip.setPointerCapture(e.pointerId); } catch (eC) {}
        e.preventDefault();
      });
      grip.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var nl = Math.min(Math.max(0, e.clientX - dx), (window.innerWidth || 900) - 80);
        var nt = Math.min(Math.max(0, e.clientY - dy), (window.innerHeight || 700) - 60);
        p.style.left = nl + 'px'; p.style.top = nt + 'px';
      });
      var end = function (e) {
        if (!dragging) return;
        dragging = false;
        try { grip.releasePointerCapture(e.pointerId); } catch (eR) {}
        saveBox(parseFloat(p.style.left) || 0, parseFloat(p.style.top) || 0);
      };
      grip.addEventListener('pointerup', end);
      grip.addEventListener('pointercancel', end);
    }
    if (window.BackStack && BackStack.wire) BackStack.wire(p);
  }

  function head(title, blurb) {
    return '<div style="font-family:var(--font-head,sans-serif);font-size:1.6rem;font-weight:700;'
      + 'margin-bottom:0.15rem;padding-right:2rem">' + esc(title) + '</div>'
      + (blurb ? '<div style="font-size:1.05rem;color:var(--gold,#d4a843);margin-bottom:1.1rem">' + esc(blurb) + '</div>' : '');
  }

  // Open a guide: branching guides show their chooser first.
  function rrgOpen(id) {
    var g = RRG[id];
    if (!g) return;
    var body = '<div style="font-size:1.12rem;color:var(--text-mid,#ccc);line-height:1.65;margin-bottom:1rem">'
      + g.intro + '</div>';
    if (g.paths) {
      body += '<div style="font-size:1.08rem;color:var(--text,#eee);font-weight:600;margin-bottom:0.7rem">'
        + esc(g.choose || 'Which one are you doing?') + '</div>';
      g.paths.forEach(function (p) {
        body += '<button onclick="rrgPath(\'' + id + '\',\'' + p.id + '\')" '
          + 'style="display:block;width:100%;box-sizing:border-box;text-align:left;background:var(--surface2,#242440);'
          + 'border:1px solid var(--border,#333);border-radius:10px;padding:0.75rem 0.9rem;margin-bottom:0.5rem;'
          + 'cursor:pointer;color:var(--text,#eee);font-family:inherit">'
          + '<span style="display:block;font-size:1.15rem;font-weight:700;margin-bottom:0.15rem">' + esc(p.label) + '</span>'
          + '<span style="display:block;font-size:1rem;color:var(--text-dim,#999);line-height:1.5">' + esc(p.desc) + '</span>'
          + '</button>';
      });
    } else {
      body += stepsHtml(g.steps, g.notes);
    }
    shell(head(g.title, g.blurb), body, '‹ All guides', rrgIndex);
  }

  // Open one path of a branching guide.
  function rrgPath(gid, pid) {
    var g = RRG[gid];
    if (!g || !g.paths) return;
    var p = null;
    g.paths.forEach(function (x) { if (x.id === pid) p = x; });
    if (!p) return;
    var title = head(g.title, p.label);
    var body = '<div style="font-size:1.08rem;color:var(--text-mid,#ccc);line-height:1.6;margin-bottom:1.1rem;'
      + 'padding-bottom:0.8rem;border-bottom:1px solid var(--border,#333)">' + esc(p.desc) + '</div>'
      + stepsHtml(p.steps, p.notes);
    shell(title, body, '‹ Back', function () { rrgOpen(gid); });
  }

  function rrgIndex() {
    var rows = Object.keys(RRG).map(function (k) {
      var g = RRG[k];
      return '<button onclick="rrgOpen(\'' + k + '\')" style="display:block;width:100%;box-sizing:border-box;'
        + 'text-align:left;background:var(--surface2,#242440);border:1px solid var(--border,#333);'
        + 'border-radius:10px;padding:0.75rem 0.9rem;margin-bottom:0.55rem;cursor:pointer;color:var(--text,#eee);'
        + 'font-family:inherit">'
        + '<span style="display:block;font-size:1.15rem;font-weight:700;margin-bottom:0.1rem">' + esc(g.title) + '</span>'
        + '<span style="display:block;font-size:1rem;color:var(--text-dim,#999)">' + esc(g.blurb) + '</span>'
        + '</button>';
    }).join('');
    shell(head('Step-by-step guides', 'Written walkthroughs for the things you will do most.'), rows, null, null);
  }

  window.rrgOpen = rrgOpen;
  window.rrgPath = rrgPath;
  window.rrgIndex = rrgIndex;

  // ── Hook into the Help Center without editing tutorial.js ────
  // v0.9.1455: the hub's markup carries NO ids or classes — every div is
  // anonymous — so the first attempt (querySelector('#help-hub, .help-hub'))
  // found nothing and the row never appeared. Verified live before this
  // rewrite. The reliable landmark is the EXISTING Suggestions row, the
  // photographing guide: find that button by its text and insert directly
  // after it, copying its own style so the new row cannot drift out of
  // fashion when the hub is restyled.
  function addRow() {
    var anchor = null;
    var btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      if (/Photographing/i.test(btns[i].textContent || '')) { anchor = btns[i]; break; }
    }
    if (!anchor || !anchor.parentElement) return false;
    if (document.getElementById('rrg-hub-row')) return true;
    var btn = document.createElement('button');
    btn.id = 'rrg-hub-row';
    btn.setAttribute('style', anchor.getAttribute('style') || '');
    btn.onclick = function () {
      // v0.9.1456: the hub is #help-hub-modal. The previous close hunted for an
      // inline position:fixed style, which that element does not carry — so the
      // hub stayed open ON TOP of the guides. Close it by id, with a walk-up
      // fallback in case the id ever changes.
      var hub = document.getElementById('help-hub-modal');
      if (!hub) {
        var p = btn.parentElement;
        while (p && p !== document.body) {
          if (getComputedStyle(p).position === 'fixed') { hub = p; break; }
          p = p.parentElement;
        }
      }
      if (hub && hub.remove) hub.remove();
      if (window.BackStack && BackStack.pop) { try { BackStack.pop('help-hub-modal'); } catch (e) {} }
      rrgIndex();
    };
    btn.innerHTML = '<span style="display:block;font-weight:700">Step-by-step guides</span>'
      + '<span style="display:block;font-size:0.92rem;color:var(--text-dim,#999)">'
      + 'Adding items, want list, parts, sales, contacts, research, catalogue search</span>';
    anchor.parentElement.insertBefore(btn, anchor.nextSibling);

    // v0.9.1551 (Brad: "i do not see the tca scale in the help menu"). It was
    // there — one click inside "Step-by-step guides", whose subtitle gives no
    // reason to look for grading. A thing nobody can find has not been added.
    // Condition grading gets its own row in the Help Center, because it is the
    // one piece of hobby knowledge every single item in the app depends on.
    if (!document.getElementById('rrg-hub-grading')) {
      var gbtn = document.createElement('button');
      gbtn.id = 'rrg-hub-grading';
      gbtn.setAttribute('style', anchor.getAttribute('style') || '');
      gbtn.onclick = function () {
        var hub = document.getElementById('help-hub-modal');
        if (!hub) {
          var p2 = gbtn.parentElement;
          while (p2 && p2 !== document.body) {
            if (getComputedStyle(p2).position === 'fixed') { hub = p2; break; }
            p2 = p2.parentElement;
          }
        }
        if (hub && hub.remove) hub.remove();
        if (window.BackStack && BackStack.pop) { try { BackStack.pop('help-hub-modal'); } catch (e) {} }
        rrgOpen('grading');
      };
      gbtn.innerHTML = '<span style="display:block;font-weight:700">Condition grading (the C-scale)</span>'
        + '<span style="display:block;font-size:0.92rem;color:var(--text-dim,#999)">'
        + 'C-1 to C-10 explained, and how it lines up with our 1\u201310</span>';
      btn.parentElement.insertBefore(gbtn, btn.nextSibling);
    }
    return true;
  }
  function inject() {
    if (typeof window.openHelpHub !== 'function' || window.openHelpHub._rrgWrapped) return false;
    var orig = window.openHelpHub;
    var wrapped = function () {
      var r = orig.apply(this, arguments);
      // The hub draws in one pass; a few retries covers any async paint.
      var n = 0;
      var t2 = setInterval(function () { n++; if (addRow() || n > 12) clearInterval(t2); }, 120);
      return r;
    };
    wrapped._rrgWrapped = true;
    window.openHelpHub = wrapped;
    return true;
  }
  var tries = 0;
  var t = setInterval(function () { tries++; if (inject() || tries > 60) clearInterval(t); }, 1000);
})();
