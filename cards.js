/**
 * Cardfight!! Vanguard D-Series Standard Card Database
 * Includes official DZ-TD01 cards with images from img/Card/ and full card abilities.
 */

const TRIGGER_TYPE = {
    NONE: 'NONE',
    CRITICAL: 'CRITICAL',
    DRAW: 'DRAW',
    FRONT: 'FRONT',
    HEAL: 'HEAL',
    OVER: 'OVER'
};

const SKILL_TYPE = {
    BOOST: 'BOOST',
    INTERCEPT: 'INTERCEPT',
    TWIN_DRIVE: 'TWIN_DRIVE',
    TRIPLE_DRIVE: 'TRIPLE_DRIVE',
    SENTINEL: 'SENTINEL'
};

const CARD_CATEGORY = {
    NORMAL_UNIT: 'Normal Unit',
    TRIGGER_UNIT: 'Trigger Unit',
    NORMAL_ORDER: 'Normal Order',
    SET_ORDER: 'Set Order',
    BLITZ_ORDER: 'Blitz Order',
    TOKEN: 'Token',
    CREST: 'Crest'
};

function isCrayElementalNation(nation) {
    if (!nation) return false;
    const n = String(nation).trim().toLowerCase();
    return n === 'cray elemental' || n === 'elemental cray';
}

function hasPersonaRide(c) {
    if (!c) return false;
    if (c.hasPersonaRide !== undefined) return !!c.hasPersonaRide;
    if (c.personaRide !== undefined) return !!c.personaRide;
    // In Standard D-Series, all Grade 3 Normal Units have the Persona Ride icon
    return c.grade === 3 && (c.cardType === CARD_CATEGORY.NORMAL_UNIT || !c.cardType || (c.power > 0 && c.trigger === TRIGGER_TYPE.NONE));
}

if (typeof window !== 'undefined') {
    window.isCrayElementalNation = isCrayElementalNation;
    window.hasPersonaRide = hasPersonaRide;
}

function getCardCategory(c) {
    if (!c) return CARD_CATEGORY.NORMAL_UNIT;
    if (c.cardType) return c.cardType;
    if (c.category) return c.category;
    if (c.isCrest || (c.ability && c.ability.includes('[Crest]'))) return CARD_CATEGORY.CREST;
    if (c.isToken) return CARD_CATEGORY.TOKEN;
    if (c.trigger && c.trigger !== TRIGGER_TYPE.NONE) return CARD_CATEGORY.TRIGGER_UNIT;
    if (c.orderType === 'Set Order' || (c.ability && c.ability.includes('[Set Order]'))) return CARD_CATEGORY.SET_ORDER;
    if (c.orderType === 'Blitz Order' || (c.ability && c.ability.includes('[Blitz Order]'))) return CARD_CATEGORY.BLITZ_ORDER;
    if (c.orderType === 'Normal Order' || (c.ability && c.ability.includes('[Normal Order]')) || ((c.power === 0 || c.basePower === 0) && c.grade === 2)) return CARD_CATEGORY.NORMAL_ORDER;
    return CARD_CATEGORY.NORMAL_UNIT;
}

function createCard(id, name, nation, grade, power, shield, critical, trigger = TRIGGER_TYPE.NONE, skill = [], image = '', ability = '', isCrest = false, effectScript = '', cardType = '') {
    let type = cardType;
    if (!type) {
        if (isCrest) type = CARD_CATEGORY.CREST;
        else if (trigger && trigger !== TRIGGER_TYPE.NONE) type = CARD_CATEGORY.TRIGGER_UNIT;
        else if (ability && ability.includes('[Set Order]')) type = CARD_CATEGORY.SET_ORDER;
        else if (ability && ability.includes('[Blitz Order]')) type = CARD_CATEGORY.BLITZ_ORDER;
        else if (ability && ability.includes('[Normal Order]')) type = CARD_CATEGORY.NORMAL_ORDER;
        else if (power === 0 && grade === 2) type = CARD_CATEGORY.NORMAL_ORDER;
        else type = CARD_CATEGORY.NORMAL_UNIT;
    }

    return {
        id,
        name,
        nation,
        grade,
        basePower: power,
        power,
        baseShield: shield,
        shield,
        baseCritical: critical,
        critical,
        trigger,
        skill: Array.isArray(skill) ? skill : [skill],
        image: image || '',
        ability: ability || '',
        cardType: type,
        isCrest: type === CARD_CATEGORY.CREST || !!isCrest,
        isToken: type === CARD_CATEGORY.TOKEN,
        effectScript: effectScript || ''
    };
}

// Base Default Card Catalog
const DEFAULT_CARD_CATALOG = [
    // DZ-TD01 Dragon Empire Cards (Start Deck 01 Official)
    createCard('DZ-TD01/001', 'Roaring Thunder Dragon, Triumph Dragon', 'Dragon Empire', 3, 13000, 0, 1, TRIGGER_TYPE.NONE, [SKILL_TYPE.TWIN_DRIVE], 'img/Card/dztd01_001.webp',
        '[ACT](VC)[1/turn]:[COST][Counter-Blast 1], search your deck for up to one card with the same card name as this unit, reveal it and put it into hand, shuffle the deck, and this unit gets [Power] +10000 until end of turn.\n[AUTO](VC):When this unit attacks a vanguard, [COST][Energy-Blast 4], choose one of your opponent\'s rear-guards, retire it, and this unit gets [Power] +5000/[Critical] +1 until end of that battle. (Use four Energy to pay [Energy-Blast 4]!)'),

    createCard('DZ-TD01/002', 'Roaring Thunder Beast, Kitenraiz', 'Dragon Empire', 2, 10000, 5000, 1, TRIGGER_TYPE.NONE, [SKILL_TYPE.INTERCEPT], 'img/Card/dztd01_002.webp',
        '[Auto](VC): When placed by riding from "Roaring Flame Beast, Karaleor", choose one of your opponent\'s rear-guards, and retire it.'),

    createCard('DZ-TD01/003', 'Roaring Flame Beast, Karaleor', 'Dragon Empire', 1, 8000, 5000, 1, TRIGGER_TYPE.NONE, [SKILL_TYPE.BOOST], 'img/Card/dz_td01_003.webp',
        '[Auto](VC): When placed by riding from "Heated Blade, Ardart", search your deck for up to one "Energy Generator", put it into the Order Zone, and shuffle your deck.'),

    createCard('DZ-TD01/004', 'Heated Blade, Ardart', 'Dragon Empire', 0, 6000, 5000, 1, TRIGGER_TYPE.NONE, [SKILL_TYPE.BOOST], 'img/Card/dz_td01_004.webp',
        '[Auto]: When this unit is rode upon, if you went second, draw a card.'),

    createCard('dz_005', 'Energy Generator', 'Dragon Empire', 0, 0, 0, 0, TRIGGER_TYPE.NONE, [], 'img/Card/dztd01_005.webp',
        '[Crest] At the beginning of your ride phase, if you went second and this is your first turn, or if this is your second turn or later, [Energy Charge] (3) (max 10). [Act][1/Turn]: [Cost: Energy Blast (7)], draw a card.', true),

    createCard('DZ-TD01/006', 'Quaydest Dragon', 'Dragon Empire', 3, 13000, 0, 1, TRIGGER_TYPE.NONE, [SKILL_TYPE.TWIN_DRIVE], 'img/Card/dz_td01_006.webp',
        '[Auto](RC): When this unit attacks, if you have a Grade 3 Vanguard, this unit gets [Power] +5000 until end of battle.'),

    createCard('DZ-TD01/007', 'Stealth Rogue of Sword Throwing, Kageichi', 'Dragon Empire', 2, 10000, 5000, 1, TRIGGER_TYPE.NONE, [SKILL_TYPE.INTERCEPT], 'img/Card/dz_td01_007.webp',
        '[Auto](RC): When placed, if your vanguard is Grade 3 or greater, [Cost: SB(1)], this unit gets [Power] +5000 until end of turn.'),

    createCard('DZ-TD01/008', 'Crushing Dragon, Spinoassaulter', 'Dragon Empire', 2, 10000, 5000, 1, TRIGGER_TYPE.NONE, [SKILL_TYPE.INTERCEPT], 'img/Card/dz_td01_008.webp',
        '[Auto](RC): When this unit attacks, [Cost: CB(1)], this unit gets [Power] +5000 until end of battle.'),

    createCard('DZ-TD01/009', 'Elecblow Dragon', 'Dragon Empire', 2, 10000, 5000, 1, TRIGGER_TYPE.NONE, [SKILL_TYPE.INTERCEPT], 'img/Card/dz_td01_009.webp',
        '[Auto](RC): When this unit attacks or boosts, this unit gets [Power] +2000 until end of battle.'),

    createCard('DZ-TD01/010', 'Stealth Dragon, Kudenmusubi', 'Dragon Empire', 1, 8000, 5000, 1, TRIGGER_TYPE.NONE, [SKILL_TYPE.BOOST], 'img/Card/dz_td01_010.webp',
        '[Auto](RC): When this unit boosts, choose one of your other units, it gets [Power] +2000 until end of turn.'),

    createCard('DZ-TD01/011', 'Dragritter, Yumna', 'Dragon Empire', 1, 8000, 5000, 1, TRIGGER_TYPE.NONE, [SKILL_TYPE.BOOST], 'img/Card/dz_td01_011.webp',
        '[Auto](RC): When placed, [Cost: SB(1)], look at top card of your deck.'),

    createCard('DZ-TD01/012', 'Iron Ball Dragon, Ankybowler', 'Dragon Empire', 1, 8000, 5000, 1, TRIGGER_TYPE.NONE, [SKILL_TYPE.BOOST], 'img/Card/dz_td01_012.webp',
        '[Auto](RC): When this unit boosts, if you have three or more other units, the boosted unit gets [Power] +2000 until end of battle.'),

    createCard('DZ-TD01/013', 'Escort Stealth Dragon, Hayashi Kaze', 'Dragon Empire', 1, 7000, 0, 1, TRIGGER_TYPE.NONE, [SKILL_TYPE.BOOST, SKILL_TYPE.SENTINEL], 'img/Card/dztd01_013.webp',
        '[Sentinel] (You may only have up to four Sentinels in a deck) [Auto]: When this unit is put on (GC) from hand, choose one of your units, and it cannot be hit until end of battle.'),

    createCard('DZ-TD01/014E', 'Rogue Beast, Sunegosuri', 'Dragon Empire', 0, 5000, 10000, 1, TRIGGER_TYPE.CRITICAL, [SKILL_TYPE.BOOST], 'img/Card/dztd01_014.webp',
        '[Trigger: Critical] When revealed in drive/damage check, choose a unit to get [Power] +10,000, and choose a unit to get [Critical] +1!'),

    createCard('DZ-TD01/015', 'Jaggy Dagger Dragon', 'Dragon Empire', 0, 5000, 5000, 1, TRIGGER_TYPE.DRAW, [SKILL_TYPE.BOOST], 'img/Card/dztd01_015.webp',
        '[Trigger: Draw] When revealed in drive/damage check, choose a unit to get [Power] +10,000, and draw one card!'),

    createCard('DZ-TD01/016', 'Electrake Dracokid', 'Dragon Empire', 0, 5000, 15000, 1, TRIGGER_TYPE.FRONT, [SKILL_TYPE.BOOST], 'img/Card/dztd01_016.webp',
        '[Trigger: Front] When revealed in drive/damage check, all front row units get [Power] +10,000 until end of turn!'),

    createCard('DZ-TD01/017', 'Refreshing Wind Dragon, Dinobreeze', 'Dragon Empire', 0, 5000, 15000, 1, TRIGGER_TYPE.HEAL, [SKILL_TYPE.BOOST], 'img/Card/dztd01_017.webp',
        '[Trigger: Heal] (Max 4 in deck) When revealed, choose a unit to get [Power] +10,000. If your damage count is >= opponent damage, heal one damage!'),

    createCard('D-LTD01/010', 'Spiritual King of Determination, Olbaria', 'Cray Elemental', 0, 5000, 50000, 1, TRIGGER_TYPE.OVER, [SKILL_TYPE.BOOST], 'img/Card/d_ltd01_010.webp',
        '[Over Trigger] (Max 1 in deck) When revealed, remove this card from game, draw 1, choose a unit to get [Power] +100,000,000! Additional: Choose one of your units, and it gets [Power] +100,000,000 until end of turn!'),

    createCard('DZSS06', 'Elementaria Sanctitude', 'Cray Elemental', 1, 0, 0, 1, TRIGGER_TYPE.NONE, [SKILL_TYPE.SENTINEL], 'img/Card/dzss06.webp',
        '[Blitz Order / Sentinel] (Kartu ini dianggap sebagai semua nation).\n[Cost: Discard 1 kartu], pilih 1 unitmu yang sedang diserang, dan unit tersebut tidak dapat terkena hit hingga akhir battle ini.', false, '', CARD_CATEGORY.BLITZ_ORDER),

    // Keter Sanctuary Cards (Bastion Line)
    createCard('ks_001', 'Rook', 'Keter Sanctuary', 0, 6000, 5000, 1, TRIGGER_TYPE.NONE, [SKILL_TYPE.BOOST], '',
        '[Auto]: When this unit is rode upon, if you went second, draw a card.'),
    createCard('ks_002', 'Knight of Bows, Dian Cecht', 'Keter Sanctuary', 1, 8000, 5000, 1, TRIGGER_TYPE.NONE, [SKILL_TYPE.BOOST], '',
        '[Auto](RC): When this unit boosts, if your vanguard is Grade 3 or greater, the boosted unit gets [Power] +5000.'),
    createCard('ks_003', 'Knight of Determination, Coil', 'Keter Sanctuary', 2, 10000, 5000, 1, TRIGGER_TYPE.NONE, [SKILL_TYPE.INTERCEPT], '',
        '[Auto](RC): When this unit attacks, [Cost: SB(1)], this unit gets [Power] +5000.'),
    createCard('ks_004', 'Apex Ruler, Bastion', 'Keter Sanctuary', 3, 13000, 0, 1, TRIGGER_TYPE.NONE, [SKILL_TYPE.TWIN_DRIVE], '',
        '[Auto](VC)[1/Turn]: At the end of the battle your grade 3 rear-guard attacked, [Cost: Discard 1], [Stand] that unit, and it gets [Power] +10,000 until end of turn!'),
    createCard('ks_005', 'Dark Strain Dragon', 'Keter Sanctuary', 3, 13000, 0, 1, TRIGGER_TYPE.NONE, [SKILL_TYPE.TWIN_DRIVE], '',
        '[Act](RC): [Cost: SB(2)], all your Grade 3 units get [Boost] skill until end of turn.'),
    createCard('ks_006', 'Aegis Guard (Sentinel)', 'Keter Sanctuary', 1, 8000, 0, 1, TRIGGER_TYPE.NONE, [SKILL_TYPE.BOOST, SKILL_TYPE.SENTINEL], '',
        '[Sentinel] When put on (GC) from hand, target unit cannot be hit until end of battle.'),
    createCard('ks_007', 'Knight of Falcon (Critical Trigger)', 'Keter Sanctuary', 0, 5000, 10000, 1, TRIGGER_TYPE.CRITICAL, [SKILL_TYPE.BOOST], '',
        '[Trigger: Critical] Choose a unit to get +10,000 Power, and choose a unit to get +1 Critical!'),
    createCard('ks_008', 'Protection Angel (Draw Trigger)', 'Keter Sanctuary', 0, 5000, 5000, 1, TRIGGER_TYPE.DRAW, [SKILL_TYPE.BOOST], '',
        '[Trigger: Draw] Choose a unit to get +10,000 Power, draw 1 card!'),
    createCard('ks_009', 'Healing Angel (Heal Trigger)', 'Keter Sanctuary', 0, 5000, 15000, 1, TRIGGER_TYPE.HEAL, [SKILL_TYPE.BOOST], '',
        '[Trigger: Heal] Choose a unit to get +10,000 Power. If damage >= opponent damage, heal 1!'),
    createCard('ks_010', 'Spiritual King of Miracles, Olbaria (Over Trigger)', 'Keter Sanctuary', 0, 5000, 50000, 1, TRIGGER_TYPE.OVER, [SKILL_TYPE.BOOST], '',
        '[Over Trigger] Choose a unit to get +100,000,000 Power!'),

    // Cray Elemental Cards (Neutral / Universal - Dapat masuk ke deck bangsa/nation apa saja)
    createCard('ce_001', 'Elementaria Sanctitude (Sentinel)', 'Cray Elemental', 1, 0, 0, 0, TRIGGER_TYPE.NONE, [SKILL_TYPE.SENTINEL], '',
        '[Blitz Order / Sentinel] (Kartu ini dianggap sebagai semua nation).\n[Cost: Discard 1 kartu], pilih 1 unitmu yang sedang diserang, dan unit tersebut tidak dapat terkena hit hingga akhir battle ini.'),
    createCard('ce_002', 'Rain Elemental, Tear', 'Cray Elemental', 1, 8000, 5000, 1, TRIGGER_TYPE.NONE, [SKILL_TYPE.BOOST], '',
        '[Auto](RC): Ketika diletakkan ke (RC), jika kamu tidak memiliki kartu face up di damage zone, [Cost: SB(1)], [Counter Charge (1)]. (Kartu ini dianggap sebagai semua nation).')
];

// Active Working Catalog (Mutable array reference used throughout the game)
const CARD_CATALOG = [];

// =========================================================
// CARD DATABASE CRUD & PERSISTENCE (ADMIN MANAGER)
// =========================================================
const CUSTOM_CARDS_STORAGE_KEY = 'vg_custom_cards';
const MODIFIED_CARDS_STORAGE_KEY = 'vg_modified_cards';
const DELETED_CARDS_STORAGE_KEY = 'vg_deleted_cards';

function getCustomCards() {
    try {
        const raw = localStorage.getItem(CUSTOM_CARDS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function getModifiedCards() {
    try {
        const raw = localStorage.getItem(MODIFIED_CARDS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function getDeletedCards() {
    try {
        const raw = localStorage.getItem(DELETED_CARDS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function reloadCardCatalog() {
    CARD_CATALOG.length = 0;
    const modified = getModifiedCards();
    const custom = getCustomCards();
    const deleted = getDeletedCards();

    // 1. Load base cards (skipping any deleted by user, applying modifications)
    DEFAULT_CARD_CATALOG.forEach(base => {
        if (deleted.includes(base.id)) return;
        if (modified[base.id]) {
            const merged = { ...base, ...modified[base.id] };
            merged.cardType = getCardCategory(merged);
            CARD_CATALOG.push(merged);
        } else {
            const cardObj = { ...base };
            cardObj.cardType = getCardCategory(cardObj);
            CARD_CATALOG.push(cardObj);
        }
    });

    // 2. Load cards added by user (skipping if deleted)
    custom.forEach(c => {
        if (deleted.includes(c.id)) return;
        const cardObj = { ...c };
        cardObj.cardType = getCardCategory(cardObj);
        CARD_CATALOG.push(cardObj);
    });

    return CARD_CATALOG;
}

function saveCardToDatabase(cardData, oldCardId = null) {
    if (!cardData || !cardData.id) return false;

    // Ensure category is assigned
    if (!cardData.cardType) {
        cardData.cardType = getCardCategory(cardData);
    }
    cardData.isCrest = cardData.cardType === CARD_CATEGORY.CREST || !!cardData.isCrest;
    cardData.isToken = cardData.cardType === CARD_CATEGORY.TOKEN;

    // If card was renamed / ID changed, remove previous ID to avoid unwanted duplicate
    if (oldCardId && oldCardId !== cardData.id) {
        deleteCardFromDatabase(oldCardId);
    }

    // Unmark as deleted if it was previously deleted
    const deleted = getDeletedCards().filter(id => id !== cardData.id);
    localStorage.setItem(DELETED_CARDS_STORAGE_KEY, JSON.stringify(deleted));

    // Check if card exists in default catalog
    const isDefault = DEFAULT_CARD_CATALOG.some(c => c.id === cardData.id);
    if (isDefault) {
        const modified = getModifiedCards();
        modified[cardData.id] = { ...cardData };
        localStorage.setItem(MODIFIED_CARDS_STORAGE_KEY, JSON.stringify(modified));
    } else {
        const custom = getCustomCards();
        const existingIdx = custom.findIndex(c => c.id === cardData.id);
        const cardToSave = { ...cardData };
        if (existingIdx >= 0) {
            custom[existingIdx] = cardToSave;
        } else {
            custom.push(cardToSave);
        }
        localStorage.setItem(CUSTOM_CARDS_STORAGE_KEY, JSON.stringify(custom));
    }

    // Auto-sync to localhost save_card.php
    try {
        fetch('save_card.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(getCustomCards())
        }).catch(() => {});
    } catch (e) {}

    reloadCardCatalog();
    return true;
}

function deleteCardFromDatabase(cardId) {
    if (!cardId) return false;

    // 1. Remove from custom cards
    const custom = getCustomCards();
    const filtered = custom.filter(c => c.id !== cardId);
    if (filtered.length !== custom.length) {
        localStorage.setItem(CUSTOM_CARDS_STORAGE_KEY, JSON.stringify(filtered));
        try {
            fetch('save_card.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(filtered)
            }).catch(() => {});
        } catch (e) {}
    }

    // 2. Remove from modified cards
    const modified = getModifiedCards();
    if (modified[cardId]) {
        delete modified[cardId];
        localStorage.setItem(MODIFIED_CARDS_STORAGE_KEY, JSON.stringify(modified));
    }

    // 3. Always add to deleted list to prevent reappearing from DEFAULT_CARD_CATALOG
    const deleted = getDeletedCards();
    if (!deleted.includes(cardId)) {
        deleted.push(cardId);
        localStorage.setItem(DELETED_CARDS_STORAGE_KEY, JSON.stringify(deleted));
    }

    reloadCardCatalog();
    return true;
}

function resetCardsDataToDefault() {
    localStorage.removeItem(CUSTOM_CARDS_STORAGE_KEY);
    localStorage.removeItem(MODIFIED_CARDS_STORAGE_KEY);
    localStorage.removeItem(DELETED_CARDS_STORAGE_KEY);
    reloadCardCatalog();
}

function exportCardsData() {
    return JSON.stringify({
        version: 1,
        exportedAt: new Date().toISOString(),
        customCards: getCustomCards(),
        modifiedCards: getModifiedCards()
    }, null, 2);
}

function importCardsData(jsonStr) {
    try {
        const data = JSON.parse(jsonStr);
        if (Array.isArray(data)) {
            localStorage.setItem(CUSTOM_CARDS_STORAGE_KEY, JSON.stringify(data));
        } else if (data && typeof data === 'object') {
            if (data.customCards && Array.isArray(data.customCards)) {
                localStorage.setItem(CUSTOM_CARDS_STORAGE_KEY, JSON.stringify(data.customCards));
            }
            if (data.modifiedCards && typeof data.modifiedCards === 'object') {
                localStorage.setItem(MODIFIED_CARDS_STORAGE_KEY, JSON.stringify(data.modifiedCards));
            }
        }
        reloadCardCatalog();
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

function resetCardsDataToDefault() {
    localStorage.removeItem(CUSTOM_CARDS_STORAGE_KEY);
    localStorage.removeItem(MODIFIED_CARDS_STORAGE_KEY);
    reloadCardCatalog();
}

// Initial populate of catalog
reloadCardCatalog();

// Helper to create starter deck from catalog
function createDefaultDecks() {
    return {
        "varga_dragres": {
            id: "varga_dragres",
            name: "Dragon Empire (Triumph Dragon - DZ-TD01)",
            nation: "Dragon Empire",
            rideDeckIds: [
                'DZ-TD01/004', // G0 Heated Blade, Ardart
                'DZ-TD01/003', // G1 Roaring Flame Beast, Karaleor
                'DZ-TD01/002', // G2 Roaring Thunder Beast, Kitenraiz
                'DZ-TD01/001', // G3 Roaring Thunder Dragon, Triumph Dragon
                'dz_005'       // Crest: Energy Generator
            ],
            mainDeckIds: [
                // Grade 3 (7 cards)
                'DZ-TD01/001', 'DZ-TD01/001', 'DZ-TD01/001',
                'DZ-TD01/006', 'DZ-TD01/006', 'DZ-TD01/006', 'DZ-TD01/006',

                // Grade 2 (11 cards)
                'DZ-TD01/002', 'DZ-TD01/002', 'DZ-TD01/002',
                'DZ-TD01/007', 'DZ-TD01/007', 'DZ-TD01/007', 'DZ-TD01/007',
                'DZ-TD01/008', 'DZ-TD01/008', 'DZ-TD01/008', 'DZ-TD01/008',

                // Grade 1 (16 cards)
                'DZ-TD01/003', 'DZ-TD01/003', 'DZ-TD01/003',
                'DZ-TD01/009', 'DZ-TD01/009', 'DZ-TD01/009',
                'DZ-TD01/010', 'DZ-TD01/010', 'DZ-TD01/010',
                'DZ-TD01/011', 'DZ-TD01/011', 'DZ-TD01/011',
                'DZ-TD01/013', 'DZ-TD01/013', 'DZ-TD01/013', 'DZ-TD01/013', // 4 Sentinel

                // Triggers (16 cards: 4 Crit, 3 Draw, 4 Front, 4 Heal, 1 Over)
                'DZ-TD01/014E', 'DZ-TD01/014E', 'DZ-TD01/014E', 'DZ-TD01/014E', // 4 Critical
                'DZ-TD01/015', 'DZ-TD01/015', 'DZ-TD01/015',                     // 3 Draw
                'DZ-TD01/016', 'DZ-TD01/016', 'DZ-TD01/016', 'DZ-TD01/016',     // 4 Front
                'DZ-TD01/017', 'DZ-TD01/017', 'DZ-TD01/017', 'DZ-TD01/017',     // 4 Heal
                'D-LTD01/010'                                                   // 1 Over Trigger
            ]
        },
        "bastion_sanctuary": {
            id: "bastion_sanctuary",
            name: "Keter Sanctuary (Apex Ruler - Bastion)",
            nation: "Keter Sanctuary",
            rideDeckIds: ['ks_001', 'ks_002', 'ks_003', 'ks_004', 'dz_005'],
            mainDeckIds: [
                'ks_004', 'ks_004', 'ks_004', 'ks_005', 'ks_005', 'ks_005', 'ks_005', 'ks_005',
                'ks_005', 'ks_005', 'ks_005', 'ks_005', 'ks_005', 'ks_005', 'ks_005', 'ks_005',
                'ks_003', 'ks_003', 'ks_003', 'ks_003', 'ks_003', 'ks_003',
                'ks_006', 'ks_006', 'ks_006', 'ks_006', 'ks_002', 'ks_002', 'ks_002', 'ks_002',
                'ks_002', 'ks_002', 'ks_002', 'ks_002',
                'ks_007', 'ks_007', 'ks_007', 'ks_007', 'ks_007', 'ks_007', 'ks_007', 'ks_007',
                'ks_008', 'ks_008', 'ks_008',
                'ks_009', 'ks_009', 'ks_009', 'ks_009',
                'ks_010'
            ]
        }
    };
}

// LocalStorage & Server Deck/Card Management
async function syncCardsFromServer() {
    try {
        const res = await fetch('cards/custom_cards.json?v=' + Date.now());
        if (res.ok) {
            const serverCards = await res.json();
            if (Array.isArray(serverCards) && serverCards.length > 0) {
                const localCards = getCustomCards();
                let hasChanges = false;
                serverCards.forEach(sc => {
                    const idx = localCards.findIndex(lc => lc.id === sc.id);
                    if (idx === -1) {
                        localCards.push(sc);
                        hasChanges = true;
                    } else if (JSON.stringify(localCards[idx]) !== JSON.stringify(sc)) {
                        localCards[idx] = sc;
                        hasChanges = true;
                    }
                });
                if (hasChanges) {
                    localStorage.setItem(CUSTOM_CARDS_STORAGE_KEY, JSON.stringify(localCards));
                    reloadCardCatalog();
                    if (window.gameUI && typeof window.gameUI.renderAdminCardList === 'function') {
                        window.gameUI.renderAdminCardList();
                    }
                }
            }
        }
    } catch (e) {}
}

async function syncDecksFromServer() {
    try {
        let res = await fetch('decks/decks.json?v=' + Date.now());
        if (!res.ok) {
            res = await fetch('decks.json?v=' + Date.now());
        }
        if (res.ok) {
            const serverDecks = await res.json();
            if (serverDecks && typeof serverDecks === 'object') {
                const localDecks = getSavedDecks();
                let hasChanges = false;
                for (const id in serverDecks) {
                    if (!localDecks[id] || JSON.stringify(localDecks[id]) !== JSON.stringify(serverDecks[id])) {
                        localDecks[id] = serverDecks[id];
                        hasChanges = true;
                    }
                }
                if (hasChanges) {
                    localStorage.setItem('vg_custom_decks', JSON.stringify(localDecks));
                    if (window.gameUI && typeof window.gameUI.renderDeckManager === 'function') {
                        window.gameUI.renderDeckManager();
                    }
                }
            }
        }
    } catch (e) {
        // Fallback silently if offline or running via file://
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        syncCardsFromServer();
        syncDecksFromServer();
    });
}

function getSavedDecks() {
    const raw = localStorage.getItem('vg_custom_decks');
    if (!raw) {
        const defaults = createDefaultDecks();
        localStorage.setItem('vg_custom_decks', JSON.stringify(defaults));
        return defaults;
    }
    try {
        const parsed = JSON.parse(raw);
        // Ensure default decks are always updated with latest fixes
        const defaults = createDefaultDecks();
        if (!parsed['varga_dragres'] || !parsed['varga_dragres'].rideDeckIds.includes('dz_005')) {
            parsed['varga_dragres'] = defaults['varga_dragres'];
            localStorage.setItem('vg_custom_decks', JSON.stringify(parsed));
        }
        return parsed;
    } catch (e) {
        return createDefaultDecks();
    }
}

function saveDeckToStorage(deck) {
    const decks = getSavedDecks();
    decks[deck.id] = deck;
    localStorage.setItem('vg_custom_decks', JSON.stringify(decks));

    // Auto-sync to localhost save_deck.php if running under Laragon / PHP server
    try {
        fetch('save_deck.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(decks)
        }).catch(() => {});
    } catch (e) {}
}

function deleteDeckFromStorage(deckId) {
    const decks = getSavedDecks();
    if (decks[deckId]) {
        delete decks[deckId];
        localStorage.setItem('vg_custom_decks', JSON.stringify(decks));

        try {
            fetch('save_deck.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(decks)
            }).catch(() => {});
        } catch (e) {}
    }
}

function getActiveDeckId() {
    return localStorage.getItem('vg_active_deck_id') || 'varga_dragres';
}

function setActiveDeckId(deckId) {
    localStorage.setItem('vg_active_deck_id', deckId);
}

function getCardById(cardId) {
    if (!cardId) return null;
    let card = CARD_CATALOG.find(c => c.id === cardId);
    if (card) return card;

    const aliases = {
        'dz_001': 'DZ-TD01/004',
        'dz_002': 'DZ-TD01/001',
        'dz_003': 'DZ-TD01/002',
        'dz_004': 'DZ-TD01/003',
        'dz_005': 'dz_005',
        'dz_006': 'DZ-TD01/006',
        'dz_007': 'DZ-TD01/007',
        'dz_008': 'DZ-TD01/008',
        'dz_009': 'DZ-TD01/009',
        'dz_010': 'DZ-TD01/010',
        'dz_011': 'DZ-TD01/014E',
        'dz_012': 'DZ-TD01/014E',
        'dz_013': 'DZ-TD01/016',
        'dz_014': 'DZ-TD01/015',
        'dz_015': 'DZ-TD01/017',
        'dz_016': 'D-LTD01/010',
        'dz_017': 'DZSS06',
        'DZ-TD01/005': 'dz_005'
    };

    if (aliases[cardId]) {
        const target = CARD_CATALOG.find(c => c.id === aliases[cardId]);
        if (target) return target;
    }
    for (const oldKey in aliases) {
        if (aliases[oldKey] === cardId) {
            const target = CARD_CATALOG.find(c => c.id === oldKey);
            if (target) return target;
        }
    }
    return null;
}

// Construct playable card objects for engine
function buildPlayableDeck(deckKey) {
    const decks = getSavedDecks();
    let deckData = decks[deckKey];
    if (!deckData) {
        deckData = decks['varga_dragres'] || createDefaultDecks()['varga_dragres'];
    }

    const rideDeck = (deckData.rideDeckIds || []).map(id => {
        const c = getCardById(id);
        return c ? { ...c, uid: `${c.id}_ride_${Math.random().toString(36).substr(2, 6)}` } : null;
    }).filter(Boolean);

    const mainDeck = (deckData.mainDeckIds || []).map(id => {
        const c = getCardById(id);
        return c ? { ...c, uid: `${c.id}_main_${Math.random().toString(36).substr(2, 6)}` } : null;
    }).filter(Boolean);

    return {
        id: deckData.id,
        name: deckData.name,
        nation: deckData.nation || 'Dragon Empire',
        rideDeck,
        mainDeck
    };
}
